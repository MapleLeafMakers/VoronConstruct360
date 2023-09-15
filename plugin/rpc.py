import tempfile
import os
import adsk.core, adsk.fusion
import base64
from . import importing
from .util import download, create_import_options
from . import fusion360utils as futil
from . import jsonrpcserver

rpc = jsonrpcserver.Service()


@rpc.method
def get_version():
    return 4


@rpc.method
def close():
    palette = futil.ui.palettes.itemById('voronConstruct')
    palette.isVisible = False


@rpc.method
def get_screenshot(width=256, height=256, transparent=False, antialias=True):
    with tempfile.TemporaryDirectory() as tmp_dir:
        fname = os.path.join(tmp_dir, 'thumbnail.png')
        options = adsk.core.SaveImageFileOptions.create(fname)
        options.height = height
        options.width = width
        options.isBackgroundTransparent = transparent
        options.antialias = antialias
        futil.app.activeViewport.saveAsImageFileWithOptions(options)
        with open(fname, 'rb') as f:
            return 'data:image/png;base64,{}'.format(base64.b64encode(f.read()).decode('utf8'))


@rpc.method
def autothumb(url, content_type, token, width=256, height=256, transparent=False, antialias=True):
    screenshot = None
    importManager = futil.app.importManager
    with download(url, token, extension=content_type) as file_path:
        options = create_import_options(file_path, content_type)
        doc = None
        try:
            doc = importManager.importToNewDocument(options)
            screenshot = get_screenshot(256, 256, transparent=transparent, antialias=antialias)
        except:
            pass
        finally:
            if doc:
                doc.close(False)

        return screenshot


@rpc.method
def open_model(url, token, content_type=None, filename=None):
    app = adsk.core.Application.get()
    importManager = app.importManager

    with download(url, token, filename=filename, extension=content_type) as file_path:
        options = create_import_options(file_path, content_type)
        importManager.importToNewDocument(options)


@rpc.method
def import_model(url, token, content_type=None, filename=None):
    app = adsk.core.Application.get()
    importManager = app.importManager

    # Get active design
    product = app.activeProduct
    design = adsk.fusion.Design.cast(product)
    target = design.activeComponent
    if content_type in ('step', 'f3d', 'svg'):
        with download(url, token, extension=content_type, filename=filename) as file_path:
             options = create_import_options(file_path, content_type)
             if content_type == 'svg':
                 target = design.activeEditObject
             importManager.importToTarget(options, target);
    elif content_type == 'dxf':
        importing.set_importing(dict(url=url, token=token, extension=content_type, filename=filename))
        cmd = futil.app.userInterface.commandDefinitions.itemById('voronConstruct_InsertSketch')
        cmd.execute()


@rpc.method
def export_model(step=True, f3d=True):
    design = adsk.fusion.Design.cast(futil.app.activeProduct)
    exportManager = design.exportManager
    comp = design.activeComponent

    with tempfile.TemporaryDirectory() as tmp_dir:
        data = dict()

        if step:
            fname = os.path.join(tmp_dir, 'model.step')
            options = exportManager.createSTEPExportOptions(fname, comp)
            exportManager.execute(options)
            with open(fname, 'rb') as f:
                data['step'] = 'data:application/octet-stream;base64,{}'.format(base64.b64encode(f.read()).decode('utf8'))

        if f3d:
            fname = os.path.join(tmp_dir, 'model.f3d')
            options = exportManager.createFusionArchiveExportOptions(fname, comp)
            exportManager.execute(options)
            with open(fname, 'rb') as f:
                data['f3d'] = 'data:application/octet-stream;base64,{}'.format(base64.b64encode(f.read()).decode('utf8'))

        data['name'] = comp.name

        return data
