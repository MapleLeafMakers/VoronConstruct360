import tempfile
import os
import traceback
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
    importManager = futil.app.importManager
    doc = None
    try:
        with download(url, token, extension=content_type) as file_path:
            options = create_import_options(file_path, content_type)
            doc = importManager.importToNewDocument(options)
            adsk.doEvents()
            futil.app.activeViewport.fit()
            adsk.doEvents()
            return get_screenshot(width, height, transparent=transparent, antialias=antialias)
    except Exception:
        futil.log(
            'autothumb failed for {}:\n{}'.format(url, traceback.format_exc()),
            adsk.core.LogLevels.ErrorLogLevel,
            force_console=True,
        )
        return None
    finally:
        if doc:
            doc.close(False)


@rpc.method
def autof3d(url, token, content_type='step'):
    importManager = futil.app.importManager
    doc = None
    try:
        with download(url, token, extension=content_type) as file_path:
            options = create_import_options(file_path, content_type)
            doc = importManager.importToNewDocument(options)
            adsk.doEvents()
            design = adsk.fusion.Design.cast(doc.products.itemByProductType('DesignProductType'))
            if not design:
                design = adsk.fusion.Design.cast(futil.app.activeProduct)
            exportManager = design.exportManager
            with tempfile.TemporaryDirectory() as tmp_dir:
                fname = os.path.join(tmp_dir, 'model.f3d')
                export_options = exportManager.createFusionArchiveExportOptions(fname, design.rootComponent)
                exportManager.execute(export_options)
                with open(fname, 'rb') as f:
                    return base64.b64encode(f.read()).decode('utf8')
    except Exception:
        futil.log(
            'autof3d failed for {}:\n{}'.format(url, traceback.format_exc()),
            adsk.core.LogLevels.ErrorLogLevel,
            force_console=True,
        )
        return None
    finally:
        if doc:
            doc.close(False)


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
