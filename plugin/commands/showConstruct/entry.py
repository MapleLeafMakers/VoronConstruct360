import json
import adsk.core
import os
import http.server
import socketserver
import threading
from ... import fusion360utils as futil
from ... import config
from ...rpc import rpc
from ... import kv
from datetime import datetime

app = adsk.core.Application.get()
ui = app.userInterface

# Local UI HTTP server instance
_local_server = None
_local_port = None


def get_or_start_local_ui_server(ui_dir: str) -> int:
    global _local_server, _local_port
    if _local_server is not None and _local_port is not None:
        return _local_port

    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=ui_dir, **kwargs)

        def translate_path(self, path):
            if path.startswith('/VoronConstruct360/'):
                path = path[len('/VoronConstruct360'):]
            return super().translate_path(path)

        def log_message(self, format, *args):
            pass

    class QuietTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    server = QuietTCPServer(('127.0.0.1', 0), QuietHandler)
    _local_server = server
    port = server.server_address[1]
    _local_port = port
    threading.Thread(target=server.serve_forever, daemon=True).start()
    futil.log(f'Local UI server started on port {port}')
    return port

# TODO ********************* Change these names *********************
CMD_ID = f'{config.ADDIN_NAME}_PalleteShow'
CMD_NAME = 'Load the Construct'
CMD_Description = 'I Need CAD...Lots of CAD'
PALETTE_NAME = 'Voron Construct - CAD, Lots of CAD'
IS_PROMOTED = True

# Using "global" variables by referencing values from /config.py
PALETTE_ID = config.construct_palette_id

# Specify the full path to the local html. You can also use a web URL
# such as 'https://www.autodesk.com/'
PALETTE_URL = 'https://crashingtardis.github.io/VoronConstruct360/'

# Set a default docking behavior for the palette
PALETTE_DOCKING = adsk.core.PaletteDockingStates.PaletteDockStateRight

# TODO *** Define the location where the command button will be created. ***
# This is done by specifying the workspace, the tab, and the panel, and the
# command it will be inserted beside. Not providing the command to position it
# will insert it at the end.
WORKSPACE_ID = 'FusionSolidEnvironment'
PANEL_ID = 'InsertPanel'
COMMAND_BESIDE_ID = ''

# Resource location for command icons, here we assume a sub folder in this directory named "resources".
ICON_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'resources', '')

# Local list of event handlers used to maintain a reference so
# they are not released and garbage collected.
local_handlers = []


# Executed when add-in is run.
def start():
    # Create a command Definition.
    cmd_def = ui.commandDefinitions.addButtonDefinition(CMD_ID, CMD_NAME, CMD_Description, ICON_FOLDER)

    # Add command created handler. The function passed here will be executed when the command is executed.
    futil.add_handler(cmd_def.commandCreated, command_created)

    # ******** Add a button into the UI so the user can run the command. ********
    # Get the target workspace the button will be created in.
    workspace = ui.workspaces.itemById(WORKSPACE_ID)

    # Get the panel the button will be created in.
    panel = workspace.toolbarPanels.itemById(PANEL_ID)

    # Create the button command control in the UI after the specified existing command.
    control = panel.controls.addCommand(cmd_def, COMMAND_BESIDE_ID, False)

    # Specify if the command is promoted to the main toolbar.
    control.isPromoted = IS_PROMOTED


# Executed when add-in is stopped.
def stop():
    global _local_server, _local_port

    # Get the various UI elements for this command
    workspace = ui.workspaces.itemById(WORKSPACE_ID)
    panel = workspace.toolbarPanels.itemById(PANEL_ID)
    command_control = panel.controls.itemById(CMD_ID)
    command_definition = ui.commandDefinitions.itemById(CMD_ID)
    palette = ui.palettes.itemById(PALETTE_ID)

    # Delete the button command control
    if command_control:
        command_control.deleteMe()

    # Delete the command definition
    if command_definition:
        command_definition.deleteMe()

    # Delete the Palette
    if palette:
        palette.deleteMe()

    if _local_server is not None:
        try:
            _local_server.shutdown()
        except Exception:
            pass
        _local_server = None
        _local_port = None


# Event handler that is called when the user clicks the command button in the UI.
# To have a dialog, you create the desired command inputs here. If you don't need
# a dialog, don't create any inputs and the execute event will be immediately fired.
# You also need to connect to any command related events here.
def command_created(args: adsk.core.CommandCreatedEventArgs):
    # General logging for debug.
    futil.log(f'{CMD_NAME}: Command created event.')

    # Create the event handlers you will need for this instance of the command
    futil.add_handler(args.command.execute, command_execute, local_handlers=local_handlers)
    futil.add_handler(args.command.destroy, command_destroy, local_handlers=local_handlers)


# Because no command inputs are being added in the command created event, the execute
# event is immediately fired.
def command_execute(args: adsk.core.CommandEventArgs):
    # General logging for debug.
    futil.log(f'{CMD_NAME}: Command execute event.')
    prefs = kv.kv_get('preferences') or dict()

    palettes = ui.palettes
    palette = palettes.itemById(PALETTE_ID)

    # Check for locally deployed UI in Construct/ui/index.html
    local_ui_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'ui')
    if os.path.isfile(os.path.join(local_ui_dir, 'index.html')):
        port = get_or_start_local_ui_server(local_ui_dir)
        default_url = f'http://127.0.0.1:{port}/index.html'
    else:
        default_url = PALETTE_URL

    url = prefs.get('interfaceUrl', default_url)
    if not url.strip():
        url = default_url

    if palette is None:
        palette = palettes.add(
            id=PALETTE_ID,
            name=PALETTE_NAME,
            htmlFileURL=url,
            isVisible=True,
            showCloseButton=True,
            isResizable=True,
            width=650,
            height=600,
            useNewWebBrowser=True
        )
        futil.add_handler(palette.closed, palette_closed)
        futil.add_handler(palette.navigatingURL, palette_navigating)
        futil.add_handler(palette.incomingFromHTML, palette_incoming)
        futil.log(f'{CMD_NAME}: Created a new palette: ID = {palette.id}, Name = {palette.name}')

    if palette.dockingState == adsk.core.PaletteDockingStates.PaletteDockStateFloating:
        palette.dockingState = PALETTE_DOCKING  # type: ignore

    palette.isVisible = True


# Use this to handle a user closing your palette.
def palette_closed(args: adsk.core.UserInterfaceGeneralEventArgs):
    # General logging for debug.
    futil.log(f'{CMD_NAME}: Palette was closed.')


# Use this to handle a user navigating to a new page in your palette.
def palette_navigating(args: adsk.core.NavigationEventArgs):
    # General logging for debug.
    futil.log(f'{CMD_NAME}: Palette navigating event.')

    # Get the URL the user is navigating to:
    url = args.navigationURL

    log_msg = f"User is attempting to navigate to {url}\n"
    futil.log(log_msg, adsk.core.LogLevels.InfoLogLevel)

    # Check if url is an external site and open in user's default browser.
    # Do not launch externally if navigating to the palette's own URL or a local server.
    if url.startswith("http") and not url.startswith(PALETTE_URL) and not url.startswith("http://localhost") and not url.startswith("http://127.0.0.1"):
        args.launchExternally = True


# Use this to handle events sent from javascript in your palette.
def palette_incoming(html_args: adsk.core.HTMLEventArgs):
    message_action = html_args.action
    if message_action == 'jsonrpc':
        response = rpc.handle_request_body(html_args.data);
        if response is not None:
            palette = app.userInterface.palettes.itemById(PALETTE_ID)
            palette.sendInfoToHTML('jsonrpc', response);


# This event handler is called when the command terminates.
def command_destroy(args: adsk.core.CommandEventArgs):
    # General logging for debug.
    futil.log(f'{CMD_NAME}: Command destroy event.')

    global local_handlers
    local_handlers = []
