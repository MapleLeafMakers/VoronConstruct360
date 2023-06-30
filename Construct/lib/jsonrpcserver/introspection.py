import sys
import inspect


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
            'args': meta['argspec'].args,
            'invocation': '%s%s' % (method,
                inspect.formatargspec(*meta['argspec'])),
            })
    return {
            'methods': methods,
            'url': url,
            'name': getattr(service, '__name__', service.__class__.__name__),
            'description': trim_docstring(service.__doc__),
            }


