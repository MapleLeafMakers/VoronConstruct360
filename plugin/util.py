import tempfile
import os
import contextlib

import requests
from . import fusion360utils as futil


@contextlib.contextmanager
def download(url, token, filename=None, extension=''):

    if not filename:
        filename = 'model'

    filename = '{}.{}'.format(filename, extension)
    response = requests.get(url, headers={'Accept': 'application/vnd.github.raw', 'Authorization': 'Bearer {}'.format(token)})

    with tempfile.TemporaryDirectory() as temp_dir:
        full_path = os.path.join(temp_dir, filename)

        with open(full_path, 'wb') as temp_file:
            temp_file.write(response.content)

        yield full_path


def create_import_options(filename, ext):
    if ext in ('stp', 'step'):
        return futil.app.importManager.createSTEPImportOptions(filename)
    elif ext == 'f3d':
        return futil.app.importManager.createFusionArchiveImportOptions(filename)
    elif ext == 'svg':
        return futil.app.importManager.createSVGImportOptions(filename)
