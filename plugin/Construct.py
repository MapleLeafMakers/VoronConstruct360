import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent.resolve() / 'lib'))

import adsk.core, adsk.fusion, adsk.cam
from . import fusion360utils as futil
from . import kv
from .rpc import rpc
from . import commands


futil.general_utils.DEBUG = True

def run(context):
    app = adsk.core.Application.get()
    try:
         kv.start_background_thread(app)
         commands.start()
    except:
        futil.handle_error('run')


def stop(context):

    try:
        futil.clear_handlers()
        commands.stop()
        kv.stop_background_thread()
    except:
        futil.handle_error('stop')
