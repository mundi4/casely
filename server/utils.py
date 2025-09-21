import sys
from datetime import datetime
import threading
import time

def log_message(msg, *args, stream=None):
    """
    Thread-safe, timestamped log output. Use like log_message('msg %s', var)
    """
    if args:
        msg = msg % args
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    #thread = threading.current_thread().name
    out = f"[{now}] {msg}\n"
    (stream or sys.stdout).write(out)
    (stream or sys.stdout).flush()


def now_ms() -> int:
    return int(time.time() * 1000)