import sys
import inspect


def get_signature(func):
    if hasattr(inspect, 'getfullargspec'): # Python 3+
        return inspect.getfullargspec(func)

    return inspect.getargspec(func)


def format_signature(signature_or_argspec):
    if isinstance(signature_or_argspec, tuple):
        return inspect.formatargspec(*signature_or_argspec)
    
    return str(signature_or_argspec)


def validate_signature(func, *args, **kwargs):
    if hasattr(inspect,'getcallargs'):
        return inspect.getcallargs(func, *args, **kwargs)
    
    return inspect.signature(func).bind(*args, **kwargs)


def trim_docstring(docstring):
    if not docstring:
        return ''
    # Convert tabs to spaces (following the normal Python rules)
    # and split into a list of lines:
    lines = docstring.expandtabs().splitlines()
    # Determine minimum indentation (first line doesn't count):
    indent = sys.maxint
    for line in lines[1:]:
        stripped = line.lstrip()
        if stripped:
            indent = min(indent, len(line) - len(stripped))
    # Remove indentation (first line is special):
    trimmed = [lines[0].strip()]
    if indent < sys.maxint:
        for line in lines[1:]:
            trimmed.append(line[indent:].rstrip())
    # Strip off trailing and leading blank lines:
    while trimmed and not trimmed[-1]:
        trimmed.pop()
    while trimmed and not trimmed[0]:
        trimmed.pop(0)
    # Return a single string:
    return '\n'.join(trimmed)


def introspect(service, url):
    methods = []
    for method, meta in service.public_methods().items():
        callback = meta['callback']
        methods.append({
            'name': method,
            'description': trim_docstring(callback.__doc__),
            'args': meta['signature'].args,
            'invocation': '%s%s' % (method,
                format_signature(meta['signature'])),
            })
    return {
            'methods': methods,
            'url': url,
            'name': getattr(service, '__name__', service.__class__.__name__),
            'description': trim_docstring(service.__doc__),
            }


