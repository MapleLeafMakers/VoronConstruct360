try:
    import adsk.core, adsk.fusion, adsk.cam
    has_adsk = True
except ImportError:
    has_adsk = False

import traceback
import tempfile
import json
import os
import sys, pathlib
import base64
from contextlib import closing
import sqlite3
path = str(pathlib.Path(__file__).parent.resolve() / 'lib')
sys.path.insert(0, path)

import jsonrpcserver, requests


_db_file = str(pathlib.Path(__file__).parent.resolve() / 'cache.sqlite3')

rpc = jsonrpcserver.Service()

conn = sqlite3.connect(_db_file)
conn.execute('''CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT
);''')


def _load_legacy_state():
    _legacy_save_file = str(pathlib.Path(__file__).parent.resolve() / '_save.json')
    if os.path.exists(_legacy_save_file):
        with open(_legacy_save_file, 'r') as f:
            state = json.load(f)
            if 'token' in state and state['token']:
                kv_set('token', state['token'])
            if 'repo_list' in state and state['repo_list']:
                kv_set('collections', state['repo_list'])
        os.unlink(_legacy_save_file)

def _download(apiUrl, token, extension=''):
    if extension:
        extension = '.{}'.format(extension)

    # Create a temporary file with the file extension
    response = requests.get(apiUrl, headers={'Accept': 'application/vnd.github.raw', 'Authorization': 'Bearer {}'.format(token)})
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=extension)
    temp_file.write(response.content)
    return temp_file.name


@rpc.method
def kv_get(key):
    with closing(conn.execute('SELECT value FROM kv WHERE key = ?', (key,))) as cursor:
        val = cursor.fetchone()
        if val:
            return json.loads(val[0])


@rpc.method
def kv_set(key, value):
    conn.execute('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', (key, json.dumps(value)))
    conn.commit()


@rpc.method
def kv_mget(keys):
    q = 'SELECT key, value FROM kv WHERE key IN ({})'.format(', '.join('?' * len(keys)))
    with closing(conn.execute(q, keys)) as cursor:
        result = dict()
        for row in cursor.fetchall():
            result[row[0]] = json.loads(row[1])
        return result


@rpc.method
def kv_mset(obj):
    rows = [(k, json.dumps(v)) for k, v in obj.items()]
    conn.executemany('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', rows)


@rpc.method
def get_screenshot(width=256, height=256):
    with tempfile.TemporaryDirectory() as tmp_dir:
        fname = os.path.join(tmp_dir, 'thumbnail.png')
        _app.activeViewport.saveAsImageFile(fname, height, width)
        with open(fname, 'rb') as f:
            return 'data:image/png;base64,{}'.format(base64.b64encode(f.read()).decode('utf8'))


@rpc.method
def open_model(url, content_type, token):
    fileName = _download(url, token, extension=content_type)
    app = adsk.core.Application.get()

    importManager = app.importManager
    try:
        options = create_import_options(fileName, content_type)
    except:
        raise ValueError("Failed to create options for {} | {}".format(fileName, content_type))

    try:
        importManager.importToNewDocument(options)
    except:
         if _ui:
            _ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))


@rpc.method
def import_model(url, content_type, token):
    fileName = _download(url, token, extension=content_type)
    app = adsk.core.Application.get()
    importManager = app.importManager

    # Get active design
    product = app.activeProduct
    design = adsk.fusion.Design.cast(product)

    options = create_import_options(fileName, content_type)

    target = design.activeComponent
    if isinstance(options, (adsk.core.DXF2DImportOptions, adsk.core.SVGImportOptions)):
        target = design.activeEditObject
    try:
        importManager.importToTarget(options, target);
    except:
         if _ui:
            _ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))


@rpc.method
def export_model(step=True, f3d=True):
    design = adsk.fusion.Design.cast(_app.activeProduct)
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


def create_import_options(filename, ext):
    if ext in ('stp', 'step'):
        return adsk.core.Application.get().importManager.createSTEPImportOptions(filename)
    elif ext == 'f3d':
        return adsk.core.Application.get().importManager.createFusionArchiveImportOptions(filename)
    elif ext == 'svg':
        return adsk.core.Application.get().importManager.createSVGImportOptions(filename)
    elif ext == 'dxf':
        return adsk.core.Application.get().importManager.createDXF2DImportOptions(filename)

_load_legacy_state()

if has_adsk:

    # global set of event handlers to keep them referenced for the duration of the command
    handlers = []
    _app = adsk.core.Application.cast(None)
    _ui = adsk.core.UserInterface.cast(None)
    num = 0


    # Event handler for the commandExecuted event.
    class ShowPaletteCommandExecuteHandler(adsk.core.CommandEventHandler):
        def __init__(self):
            super().__init__()
        def notify(self, args):
            try:
                # Create and display the palette.
                palette = _ui.palettes.itemById('voronConstruct')
                if not palette:
                    palette = _ui.palettes.add('voronConstruct', 'Voron Construct, CAD...Lots of CAD', 'https://mapleleafmakers.github.io/VoronConstruct360/', True, True, True, 700, 200, True)

                    # Dock the palette to the right side of Fusion window.
                    palette.dockingState = adsk.core.PaletteDockingStates.PaletteDockStateRight

                    # Add handler to HTMLEvent of the palette.
                    onHTMLEvent = MyHTMLEventHandler()
                    palette.incomingFromHTML.add(onHTMLEvent)
                    handlers.append(onHTMLEvent)

                    # Add handler to CloseEvent of the palette.
                else:
                    palette.isVisible = True
            except:
                _ui.messageBox('Command executed failed: {}'.format(traceback.format_exc()))


    # Event handler for the commandCreated event.
    class ShowPaletteCommandCreatedHandler(adsk.core.CommandCreatedEventHandler):
        def __init__(self):
            super().__init__()
        def notify(self, args):
            try:
                command = args.command
                onExecute = ShowPaletteCommandExecuteHandler()
                command.execute.add(onExecute)
                handlers.append(onExecute)

            except:
                _ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))



    # Event handler for the commandExecuted event.
    class SendInfoCommandExecuteHandler(adsk.core.CommandEventHandler):
        def __init__(self):
            super().__init__()
        def notify(self, args):
            try:
                # Send information to the palette. This will trigger an event in the javascript
                # within the html so that it can be handled.
                palette = _ui.palettes.itemById('voronConstruct')
                if palette:
                    global num
                    num += 1
                    palette.sendInfoToHTML('send', 'This is a message sent to the palette from Fusion. It has been sent {} times.'.format(num))
            except:
                _ui.messageBox('Command executed failed: {}'.format(traceback.format_exc()))


    # Event handler for the palette HTML event.
    class MyHTMLEventHandler(adsk.core.HTMLEventHandler):
        def __init__(self):
            super().__init__()
        def notify(self, args):
            try:
                htmlArgs = adsk.core.HTMLEventArgs.cast(args)
                if htmlArgs.action == 'jsonrpc':
                    response = rpc.handle_request_body(htmlArgs.data);
                    if response is not None:
                        palette = _ui.palettes.itemById('voronConstruct')
                        palette.sendInfoToHTML('jsonrpc', response);
            except:
                _ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))


    def run(context):
        try:
            global _ui, _app
            _app = adsk.core.Application.get()
            _ui  = _app.userInterface

            # Add a command that displays the panel.
            showPaletteCmdDef = _ui.commandDefinitions.itemById('openVoronConstruct')
            if not showPaletteCmdDef:
                showPaletteCmdDef = _ui.commandDefinitions.addButtonDefinition('openVoronConstruct', 'Voron Construct', 'I Need CAD...Lots of CAD', 'Resources/openVoronConstruct')

                # Connect to Command Created event.
                onCommandCreated = ShowPaletteCommandCreatedHandler()
                showPaletteCmdDef.commandCreated.add(onCommandCreated)
                handlers.append(onCommandCreated)


            # Add the command to the toolbar.
            panel = _ui.workspaces.itemById('FusionSolidEnvironment').toolbarPanels.itemById('InsertPanel')

            cntrl = panel.controls.itemById('openVoronConstruct')
            if not cntrl:
                cntrl = panel.controls.addCommand(showPaletteCmdDef, )
                cntrl.isPromoted = True

        except:
            if _ui:
                _ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))


    def stop(context):
        try:
            # Delete the palette created by this add-in.
            palette = _ui.palettes.itemById('voronConstruct')
            if palette:
                palette.deleteMe()

            cmd = _ui.commandDefinitions.itemById('openVoronConstruct')
            if cmd:
                cmd.deleteMe()

            # Delete controls and associated command definitions created by this add-ins
            panel = _ui.workspaces.itemById('FusionSolidEnvironment').toolbarPanels.itemById('InsertPanel')
            if panel:
                cmd = panel.controls.itemById('openVoronConstruct')
                if cmd:
                    cmd.deleteMe()
        except:
            if _ui:
                _ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))
