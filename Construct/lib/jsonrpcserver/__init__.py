import collections
import json
import inspect
import six

import logging
log = logging.getLogger(__name__)


class BaseJsonRpcException(Exception):
    code = -32603

    def __init__(self, message=None, data=None):
        super(BaseJsonRpcException, self).__init__(message)
        self.message = message
        self.data = data


class AlreadyRegistered(Exception):
    pass


class InvalidParametersException(BaseJsonRpcException):
    code = -32602

    def __init__(self, message=None, data=None):
        super(InvalidParametersException, self).__init__(
                                    message=message, data=data)


class RpcException(BaseJsonRpcException):
    def __init__(self, code, message=None, data=None):
        if code >= -32768 and code <= -32000:
            raise ValueError(
                'Codes between (-32768, -32000) are reserved '
                'for internal use only')
        self.code = code
        super(RpcException, self).__init__(message, data=data)


class Result(object):
    def __init__(self, id, result):
        self.version = '2.0'
        self.id = id
        self.result = result

    def as_dict(self):
        return {
                'jsonrpc': self.version,
                'id': self.id,
                'result': self.result,
                }


class Error(object):
    def __init__(self, id, message, code, data=None):
        self.version = '2.0'
        self.id = id
        self.message = message
        self.code = int(code)
        self.data = data

    def as_dict(self):
        error = {
            'message': self.message,
            'code': self.code,
            }

        if self.data is not None:
            error['data'] = self.data

        return {
            'jsonrpc': self.version,
            'id': self.id,
            'error': error,
            }


class MethodNotFoundError(Error):
    def __init__(self, id, method, data=None):
        super(MethodNotFoundError, self).__init__(
            id, 'Method not found `%s`' % method, -32601, data=data)


class InvalidRequestError(Error):
    def __init__(self, id, message, data=None):
        super(InvalidRequestError, self).__init__(
            id, message, -32600, data=data)


class ParseError(Error):
    def __init__(self, message, data=None):
        super(ParseError, self).__init__(
            None, 'Server received invalid JSON: %s' % message,
            -32700, data=data)


class InvalidParametersError(Error):
    def __init__(self, id, message=None, data=None):
        super(InvalidParametersError, self).__init__(
            id, message or 'Invalid parameters number or format',
            -32602, data=data)


class InternalError(Error):
    def __init__(self, id, message=None, data=None):
        super(InternalError, self).__init__(
            id, message or 'Internal Error', -32603, data=data)


class Service(object):
    def __init__(self):
        self._methods = {}
        self.register('trait_names', self.trait_names)
        self.register('_getAttributeNames', self.get_attribute_names)

        try:
            getattr(inspect, 'getcallargs')  # Python 2.7+
        except AttributeError:
            self._validate_method_args = False  # Python 2.6 or older
        else:
            self._validate_method_args = True  # Python 2.7 or newer

    def handle_http_request(self, request):
        """
        Handle HTTP request

        :param request: Python object with `body` attribute which must contain
                        stringified JSON-RPC request object

        Returns:
            stringified JSON-RPC response
        """

        return self.handle_request_body(request.body, request)

    def handle_request_body(self, body, http_request=None):
        log.debug('Got request raw body: %s', body)

        request_dict = self.parse_request_body(body)
        response = self.dispatch(request_dict, http_request)

        try:
            response = json.dumps(response.as_dict()) if response else ''
            log.debug('Sending raw response: %s', response)
            return response
        except (TypeError, ValueError) as ex:
            log.debug('Internal error: %s', ex)
            return json.dumps(InternalError(
                request_dict.get('id'), six.text_type(ex)).as_dict())

    def parse_request_body(self, body):
        try:
            return json.loads(body)
        except (ValueError, TypeError) as ex:
            log.debug('Parse error: %s', ex)
            return ParseError(six.text_type(ex)).as_dict()

    def dispatch(self, request, http_request=None):
        ident = request.get('id')

        log.debug('Dispatching request ID: %s', ident)
        try:
            version = request['jsonrpc']
        except KeyError:
            log.debug('Missing `jsonrpc` key in request payload')
            if ident:
                return InvalidRequestError(
                    ident, 'Missing `jsonrpc` key in request object')
            else:
                return

        if not version == '2.0':
            log.debug('Requested unsupported JSON-RPC version: %s', version)
            if ident:
                return InvalidRequestError(
                    ident, 'Server supports only version 2.0 of '
                           'the JSON-RPC protocol')
            else:
                return

        try:
            method = request['method']
        except KeyError:
            log.debug('Missing `method` key in request payload')
            if ident:
                return InvalidRequestError(
                    ident, 'Missing `method` key in request object')
            else:
                return

        try:
            log.debug('Calling method `%s`', method)
            method = self._methods[method]
        except KeyError:
            log.debug('Method not found: `%s`', method)
            if ident:
                return MethodNotFoundError(ident, method)
            else:
                return

        args = []
        kwargs = {}

        try:
            params = request['params']
        except KeyError:
            pass
        else:
            if params:
                if isinstance(params, collections.Mapping):
                    log.debug('Assuming params as a dictionary-like object')
                    kwargs = params
                else:
                    log.debug('Assuming params as a list-like object')
                    args = params

        if method['takes_http_request']:
            args = [http_request]+args

        if self._validate_method_args:
            try:
                inspect.getcallargs(method['callback'], *args, **kwargs)
            except TypeError as ex:
                log.debug('Invalid method parameters: %s', ex)
                if ident:
                    return InvalidParametersError(
                        ident, data=six.text_type(ex))
                else:
                    return

        try:
            result = method['callback'](*args, **kwargs)
        except BaseJsonRpcException as ex:
            return Error(ident, ex.message, ex.code, data=ex.data)
        else:
            return Result(ident, result) if ident else None

    def method(self, method=None, takes_http_request=False):

        if callable(method):
            self.register(method.__name__, method, takes_http_request)
            return method
        else:
            def wrapper(func):
                self.register(
                    method or func.__name__, func, takes_http_request)
                return func
            return wrapper

    def register(self, method, func, takes_http_request=False):
        if method in self._methods:
            raise AlreadyRegistered(
                    'Method `%s` already registered.' % method)

        log.debug('Registering method `%s`', method)
        self._methods[method] = {
                'callback': func,
                'takes_http_request': takes_http_request,
                'argspec': inspect.getargspec(func),
                }

    def trait_names(self):
        return self.public_methods().keys()

    def get_attribute_names(self):
        return []

    def public_methods(self):
        return dict(filter(
            lambda x: (not x[0].startswith('_')
                       and not x[0] == 'trait_names'),
            self._methods.items()))
