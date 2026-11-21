"""Start the studio for a student and open the browser.

The server listens on 127.0.0.1 only. A second launch finds the running
instance, opens the browser, and does not start another server.
"""

from __future__ import annotations

import ctypes
import http.client
import json
import sys
import threading
import webbrowser
from collections.abc import Callable
from typing import Literal

import uvicorn

from app import __version__
from app.paths import workspace_dir

HOST = "127.0.0.1"
DEFAULT_PORT = 8000
SERVICE_NAME = "hdl-design-studio"
Decision = Literal["free", "ours", "other", "unknown"]

_mutex_handle: int | None = None
_console_handler = None


def bind_host() -> str:
    return HOST


def listen_port() -> int:
    import os

    raw = os.environ.get("HDS_PORT", str(DEFAULT_PORT))
    try:
        port = int(raw)
    except ValueError:
        return DEFAULT_PORT
    if not 1 <= port <= 65535:
        return DEFAULT_PORT
    return port


def port_is_free(port: int) -> bool:
    """Return True when this process can bind the listen port.

    A TCP connect is not used for that decision. On this Windows setup a closed
    localhost port can drop the handshake, so a connect timeout does not mean
    that another server is running.
    """
    import socket

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind((HOST, port))
    except OSError:
        return False
    finally:
        sock.close()
    return True


def classify_health(status: int | None, body: dict | None) -> Decision:
    if status is None:
        return "free"
    if status < 0:
        return "unknown"
    if status == 200 and isinstance(body, dict) and body.get("service") == SERVICE_NAME and body.get("status") == "ok":
        return "ours"
    return "other"


def request_health(port: int, timeout: float = 2.0) -> tuple[int | None, dict | None]:
    """Return the health status, or ``(None, None)`` when nothing is listening.

    A full Windows ephemeral-port pool raises EADDRINUSE on connect. A reserved
    local port is tried next. That does not change the Windows port range.
    """
    last_in_use = False
    for local_port in (None, *range(44760, 44768)):
        try:
            kwargs = {"timeout": timeout}
            if local_port is not None:
                kwargs["source_address"] = (HOST, local_port)
            connection = http.client.HTTPConnection(HOST, port, **kwargs)
            connection.request("GET", "/api/health")
            response = connection.getresponse()
            raw = response.read()
            status = response.status
            connection.close()
            try:
                body = json.loads(raw.decode("utf-8"))
            except (UnicodeError, json.JSONDecodeError):
                body = None
            return status, body if isinstance(body, dict) else None
        except (ConnectionRefusedError, TimeoutError):
            return None, None
        except OSError as exc:
            if _addr_in_use(exc):
                last_in_use = True
                continue
            return -1, None
    if last_in_use:
        return -1, None
    return -1, None


def acquire_instance(port: int) -> bool:
    """Return True when this process may start the server."""
    if sys.platform == "win32":
        return _acquire_mutex(port)
    return _acquire_file_lock(port)


def release_instance() -> None:
    global _mutex_handle
    if sys.platform == "win32" and _mutex_handle:
        ctypes.WinDLL("kernel32").CloseHandle(_mutex_handle)
        _mutex_handle = None
        return
    lock = _lock_file()
    if lock is not None and not lock.closed:
        lock.close()


def install_console_stop(stop: Callable[[], None]) -> None:
    global _console_handler
    if sys.platform != "win32":
        return
    from ctypes import wintypes

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.DWORD)
    def handler(ctrl_type: int) -> bool:
        if ctrl_type in (0, 1, 2, 5, 6):
            stop()
            return True
        return False

    _console_handler = handler
    ctypes.WinDLL("kernel32").SetConsoleCtrlHandler(handler, True)


def studio_url(port: int) -> str:
    return f"http://{HOST}:{port}/"


def open_browser(url: str) -> None:
    import os

    if os.environ.get("HDS_NO_BROWSER") == "1":
        print(f"Browser start skipped: {url}")
        return
    webbrowser.open(url)


def _show_status() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is None:
            continue
        try:
            reconfigure(line_buffering=True)
        except (OSError, ValueError):
            continue


def main() -> int:
    _show_status()
    port = listen_port()
    url = studio_url(port)
    if not acquire_instance(port):
        return _attach(port, url)
    try:
        if port_is_free(port):
            return _serve(port, url)
        decision = classify_health(*request_health(port, timeout=0.5))
        if decision == "ours":
            open_browser(url)
            print(f"HDL-Maker {__version__} läuft bereits. Der Browser wird geöffnet: {url}")
            return 0
        print(f"Port {port} auf {HOST} wird von einem anderen Programm verwendet. HDL-Maker wurde nicht gestartet.")
        return 1
    finally:
        release_instance()


def _attach(port: int, url: str) -> int:
    for _ in range(40):
        decision = classify_health(*request_health(port, timeout=0.5))
        if decision == "ours":
            open_browser(url)
            print(f"HDL-Maker {__version__} läuft bereits. Der Browser wird geöffnet: {url}")
            return 0
        if decision == "other":
            print(f"Port {port} auf {HOST} wird von einem anderen Programm verwendet. HDL-Maker wurde nicht gestartet.")
            return 1
        import time

        time.sleep(0.25)
    print("Eine andere HDL-Maker-Instanz hat nicht rechtzeitig geantwortet.")
    return 1


def _serve(port: int, url: str) -> int:
    projects = workspace_dir()
    config = uvicorn.Config(
        "app.main:app",
        host=HOST,
        port=port,
        log_level="info",
        access_log=False,
        use_colors=False,
    )
    server = uvicorn.Server(config)
    install_console_stop(lambda: setattr(server, "should_exit", True))

    def open_when_ready() -> None:
        for _ in range(80):
            if classify_health(*request_health(port, timeout=0.5)) == "ours":
                print(f"HDL-Maker {__version__} läuft auf {url}", flush=True)
                print(f"Projekte: {projects}", flush=True)
                print("Dieses Fenster schließen beendet das Programm.", flush=True)
                open_browser(url)
                return
            if server.should_exit:
                return
            import time

            time.sleep(0.25)
        print("Der lokale Server ist nicht bereit geworden.")
        server.should_exit = True

    threading.Thread(target=open_when_ready, name="hdl-maker-browser", daemon=True).start()
    try:
        server.run()
    except OSError as exc:
        if _addr_in_use(exc):
            print(f"Port {port} auf {HOST} wird von einem anderen Programm verwendet. HDL-Maker wurde nicht gestartet.")
            return 1
        raise
    return 0


def _addr_in_use(exc: OSError) -> bool:
    winerror = getattr(exc, "winerror", None)
    if winerror == 10048 or exc.errno in {98, 10048}:
        return True
    return "address already in use" in str(exc).lower() or "eaddrinuse" in str(exc).lower()


def _acquire_mutex(port: int) -> bool:
    global _mutex_handle
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    handle = kernel32.CreateMutexW(None, True, f"Local\\HDLMaker-{port}")
    if not handle:
        return True
    if ctypes.get_last_error() == 183:
        kernel32.CloseHandle(handle)
        return False
    _mutex_handle = handle
    return True


_lock_handle = None


def _lock_file():
    return _lock_handle


def _acquire_file_lock(port: int) -> bool:
    global _lock_handle
    import os

    path = workspace_dir() / f"hdl-maker-{port}.lock"
    handle = open(path, "a+b")
    try:
        if sys.platform == "win32":
            import msvcrt

            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        handle.close()
        return False
    _lock_handle = handle
    os.environ["HDS_LOCK_HELD"] = "1"
    return True


if __name__ == "__main__":
    import multiprocessing

    multiprocessing.freeze_support()
    sys.exit(main())
