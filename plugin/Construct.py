try:
    import adsk.core, adsk.fusion, adsk.cam
    has_adsk = True
except ImportError:
    has_adsk = False

import threading
import contextlib
import time
import traceback
import tempfile
import json
import os
import sys, pathlib
import base64
from contextlib import closing
import queue
import sqlite3

path = str(pathlib.Path(__file__).parent.resolve() / 'lib')
sys.path.insert(0, path)

import jsonrpcserver, requests

rpc = jsonrpcserver.Service()

EVENT_ID = 'ConstructTimerEvent'
stopFlag = None
timerEvent = None
timerQueue = queue.Queue()

# Initialize Database
_db_file = str(pathlib.Path(__file__).parent.resolve() / 'db.sqlite3')
if not os.path.exists(_db_file):
    # renamed to db.sqlite3 to emphasize that you shouldn't just delete it.
    _old_db_file = str(pathlib.Path(__file__).parent.resolve() / 'cache.sqlite3')
    if os.path.exists(_old_db_file):
        os.rename(_old_db_file, _db_file)

conn = sqlite3.connect(_db_file)

conn.execute('''CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT
);''')

conn.execute('''CREATE TABLE IF NOT EXISTS kvaccess (key TEXT PRIMARY KEY, accesstime integer);''')

access_times = dict()

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


class TimerThread(threading.Thread):
    def __init__(self, event, q):
        threading.Thread.__init__(self)
        self.stopped = event
        self.q = q

    def run(self):
        while not self.stopped.wait(0.5):
            if self.q.qsize():
                while self.q.qsize():
                    self.q.get()

            else:
                _app.fireCustomEvent(EVENT_ID, 'ok')


@contextlib.contextmanager
def download(apiUrl, token, filename=None, extension=''):

    if not filename:
        filename = 'model'

    filename = '{}.{}'.format(filename, extension)
    response = requests.get(apiUrl, headers={'Accept': 'application/vnd.github.raw', 'Authorization': 'Bearer {}'.format(token)})

    with tempfile.TemporaryDirectory() as temp_dir:
        full_path = os.path.join(temp_dir, filename)

        with open(full_path, 'wb') as temp_file:
            temp_file.write(response.content)

        yield full_path


@rpc.method
def get_version():
    return 3


@rpc.method
def kv_get(key):
    access_times[key] = int(time.time())
    timerQueue.put(True)
    with closing(conn.execute('SELECT value FROM kv WHERE key = ?', (key,))) as cursor:
        val = cursor.fetchone()
        if val:
            return json.loads(val[0])


@rpc.method
def kv_mget(keys=None, pattern=None):

    q = 'SELECT key, value FROM kv WHERE key IN ({})'.format(', '.join('?' * len(keys)))
    args = list(keys)
    if pattern:
        args.append(pattern)
        q += ' OR key LIKE ?'

    with closing(conn.execute(q, keys)) as cursor:
        result = dict()
        for row in cursor.fetchall():
            access_times[row[0]] = time.time()
            result[row[0]] = json.loads(row[1])
        timerQueue.put(True)
        return result


@rpc.method
def kv_keys(pattern=None):
    query = "SELECT key FROM kv";
    params = ()
    if pattern:
        query = f'{query} WHERE key LIKE ?'
        params = (pattern,)
    with closing(conn.execute(query, params)) as cursor:
        return [r[0] for r in cursor.fetchall()]


@rpc.method
def kv_set(key, value):
    conn.execute('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', (key, json.dumps(value)))
    conn.commit()



@rpc.method
def kv_mset(obj):
    rows = [(k, json.dumps(v)) for k, v in obj.items()]
    conn.executemany('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', rows)
    conn.commit()

@rpc.method
def kv_del(key):
    conn.execute('DELETE FROM kv WHERE key=?',(key,))
    conn.commit()

@rpc.method
def kv_mdel(keys=None, pattern=None):
    if keys:
        conn.execute('DELETE FROM kv WHERE key IN ({})'.format(', '.join('?' * len(keys))), keys)
    if pattern:
        conn.execute('DELETE FROM kv WHERE key LIKE ?', (pattern,))
    conn.commit()

@rpc.method
def get_screenshot(width=256, height=256, transparent=False, antialias=True):
    with tempfile.TemporaryDirectory() as tmp_dir:
        fname = os.path.join(tmp_dir, 'thumbnail.png')
        options = adsk.core.SaveImageFileOptions.create(fname)
        options.height = height
        options.width = width
        options.isBackgroundTransparent = transparent
        options.antialias = antialias
        _app.activeViewport.saveAsImageFileWithOptions(options)
        with open(fname, 'rb') as f:
            return 'data:image/png;base64,{}'.format(base64.b64encode(f.read()).decode('utf8'))


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

    with download(url, token, extension=content_type, filename=filename) as file_path:
        options = create_import_options(file_path, content_type)
        if isinstance(options, (adsk.core.DXF2DImportOptions, adsk.core.SVGImportOptions)):
            target = design.activeEditObject
        importManager.importToTarget(options, target);


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

@rpc.method
def close():
    palette = _ui.palettes.itemById('voronConstruct')
    palette.isVisible = False

@rpc.method
def autothumb(url, content_type, token, width=256, height=256, transparent=False, antialias=True):

    app = adsk.core.Application.get()
    screenshot = None
    importManager = app.importManager
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


    class TimerThreadEventHandler(adsk.core.CustomEventHandler):
        def __init__(self):
            super().__init__()

        def notify(self, args):
            global access_times
            if not access_times:
                return
            # global access_times
            items = list(access_times.items())
            with closing(conn.executemany('INSERT OR REPLACE INTO kvaccess (key, accesstime) VALUES (?, ?)', items)) as cursor:
                conn.commit()
                access_times = dict()

            one_month_ago = time.time() - (86400 * 30)
            with closing(conn.execute("DELETE FROM kv WHERE key LIKE 'cache:%' AND key NOT IN (SELECT key FROM kvaccess where accesstime > ?)", (one_month_ago,))) as cursor:
                conn.commit()

            with closing(conn.execute('DLETE FROM kvaccess WHERE accesstime <= ? OR key NOT IN (SELECT key FROM kv)', (one_month_ago,))) as cursor:
                conn.commit()


    # Event handler for the commandExecuted event.
    class ShowPaletteCommandExecuteHandler(adsk.core.CommandEventHandler):
        def __init__(self):
            super().__init__()
        def notify(self, args):
            try:
                # Create and display the palette.
                palette = _ui.palettes.itemById('voronConstruct')
                if not palette:
                    interface_url = 'https://mapleleafmakers.github.io/VoronConstruct360/'
                    prefs = kv_get('preferences')
                    if prefs and prefs.get('interfaceUrl'):
                        interface_url = prefs.get('interfaceUrl');
                    palette = _ui.palettes.add('voronConstruct', 'Voron Construct, CAD...Lots of CAD',
                                               interface_url,
                                               True, False, True, 700, 200, True)

                    # Dock the palette to the right side of Fusion window.
                    palette.dockingState = adsk.core.PaletteDockingStates.PaletteDockStateRight

                    # Add handler to HTMLEvent of the palette.
                    onHTMLEvent = MyHTMLEventHandler()
                    palette.incomingFromHTML.add(onHTMLEvent)
                    handlers.append(onHTMLEvent)

                    onNavigatingURL = MyNavigatingURLHandler()
                    palette.navigatingURL.add(onNavigatingURL)
                    handlers.append(onNavigatingURL)

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


    class MyNavigatingURLHandler(adsk.core.NavigationEventHandler):
        def __init__(self):
            super().__init__()
        def notify(self, args: adsk.core.NavigationEventArgs):
            navArgs = adsk.core.NavigationEventArgs.cast(args)
            # Code to react to the event.
            navArgs.launchExternally = True

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

            global timerEvent;
            timerEvent = _app.registerCustomEvent(EVENT_ID)
            onThreadEvent = TimerThreadEventHandler()
            timerEvent.add(onThreadEvent)
            handlers.append(onThreadEvent)

            # Create a new thread for the other processing.
            global stopFlag
            global timerQueue
            stopFlag = threading.Event()
            myThread = TimerThread(stopFlag, timerQueue)
            myThread.start()
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

            stopFlag.set()

        except:
            if _ui:
                _ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))
