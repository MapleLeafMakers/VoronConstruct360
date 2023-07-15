import queue
import os
import sqlite3
import pathlib
from .rpc import rpc
import time
import json
from contextlib import closing
from . import fusion360utils as futil
import threading

stopFlag = None
timerEvent = None
timerQueue = queue.Queue()
EVENT_ID = 'ConstructTimerEvent'



class TimerThread(threading.Thread):
    def __init__(self, event, q, app):
        threading.Thread.__init__(self)
        self.stopped = event
        self.q = q
        self.app = app

    def run(self):
        while not self.stopped.wait(0.5):
            if self.q.qsize():
                while self.q.qsize():
                    self.q.get()

            else:
                self.app.fireCustomEvent(EVENT_ID, 'ok')


def start_background_thread(app):
    global stopFlag
    global timerQueue

    global timerEvent;
    timerEvent = app.registerCustomEvent(EVENT_ID)
    futil.add_handler(timerEvent, on_cache_timer)
    # Create a new thread for the other processing.
    stopFlag = threading.Event()
    myThread = TimerThread(stopFlag, timerQueue, futil.app)
    myThread.start()


def stop_background_thread():
    stopFlag.set()


def on_cache_timer(event):
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

    with closing(conn.execute('DELETE FROM kvaccess WHERE accesstime <= ? OR key NOT IN (SELECT key FROM kv)', (one_month_ago,))) as cursor:
        conn.commit()


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
_load_legacy_state()

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
