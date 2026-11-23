"""One Vivado process at a time.

Builds and hardware operations share this lock. A scan does not run beside a
bitstream build.
"""

from __future__ import annotations

import threading

_LOCK = threading.Lock()
_HELD = False


def try_acquire() -> bool:
    global _HELD
    with _LOCK:
        if _HELD:
            return False
        _HELD = True
        return True


def release_tool() -> None:
    global _HELD
    with _LOCK:
        _HELD = False


def reset_tool() -> None:
    release_tool()
