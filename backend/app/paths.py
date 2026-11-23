"""Repository and workspace locations.

The workspace directory holds generated project state. Original HDL libraries
are never copied or modified; the project file only records paths.

Development keeps that state in the repository ``workspace/`` directory.
A packaged student build keeps it under the user's Documents folder so an
application update does not replace their projects.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def is_packaged() -> bool:
    return bool(getattr(sys, "frozen", False))


def repo_root() -> Path:
    """Source checkout, or the PyInstaller bundle when the app is frozen."""
    if is_packaged():
        return Path(getattr(sys, "_MEIPASS"))
    return Path(__file__).resolve().parents[2]


def relative_base() -> Path:
    """Base for a library path the user typed without a drive letter."""
    if is_packaged():
        return user_projects_dir()
    return repo_root()


def documents_dir() -> Path:
    found = _windows_documents()
    if found is not None:
        return found
    return Path.home() / "Documents"


def user_projects_dir() -> Path:
    return documents_dir() / "HDL-Maker" / "Projects"


def workspace_dir() -> Path:
    override = os.environ.get("HDS_WORKSPACE")
    if override:
        path = Path(override)
    elif is_packaged():
        path = user_projects_dir()
    else:
        path = Path(__file__).resolve().parents[2] / "workspace"
    path.mkdir(parents=True, exist_ok=True)
    return path


def frontend_dist() -> Path | None:
    dist = repo_root() / "frontend" / "dist"
    if (dist / "index.html").is_file():
        return dist
    return None


def serve_frontend() -> bool:
    """The Vite dev server owns the UI during development.

    The packaged executable, or an explicit test opt-in, serves the built files
    from this process so the browser and the API share one localhost origin.
    """
    if os.environ.get("HDS_SERVE_UI") == "0":
        return False
    if is_packaged():
        return True
    return os.environ.get("HDS_SERVE_UI") == "1"


def builds_dir() -> Path:
    """One directory per FPGA build. Earlier builds are left in place."""
    path = workspace_dir() / "builds"
    path.mkdir(parents=True, exist_ok=True)
    return path


def hardware_dir() -> Path:
    """JTAG scans and programming attempts. Earlier attempts are left in place."""
    path = workspace_dir() / "hardware"
    path.mkdir(parents=True, exist_ok=True)
    return path


def simulations_dir() -> Path:
    """One directory per simulation run. Earlier runs are left in place."""
    path = workspace_dir() / "simulations"
    path.mkdir(parents=True, exist_ok=True)
    return path


def generated_vhdl_dir(standard: str) -> Path:
    """Dedicated generator output. This is not a source directory and not libs/."""
    return workspace_dir() / "generated" / f"vhdl-{standard}"


def project_file() -> Path:
    return workspace_dir() / "project.json"


def ui_file() -> Path:
    return workspace_dir() / "ui.json"


def tools_file() -> Path:
    """Local tool paths, such as the GTKWave executable. Not a diagram."""
    return workspace_dir() / "tools.json"


def opensource_tools_file() -> Path:
    """Local open-source FPGA tool paths. Not the Vivado path and not a diagram."""
    return workspace_dir() / "opensource-tools.json"


def examples_dir() -> Path:
    return repo_root() / "examples"


def boardfiles_dir() -> Path:
    """Vivado board definitions shipped with this checkout.

    A new board is added by placing a folder that contains ``board.xml`` here.
    The catalog is read from these files. Part numbers are not hardcoded.
    """
    return repo_root() / "boardfiles"


def _windows_documents() -> Path | None:
    if sys.platform != "win32":
        return None
    try:
        import ctypes
        from ctypes import wintypes

        class _GUID(ctypes.Structure):
            _fields_ = [
                ("Data1", ctypes.c_ulong),
                ("Data2", ctypes.c_ushort),
                ("Data3", ctypes.c_ushort),
                ("Data4", ctypes.c_ubyte * 8),
            ]

        folder_id = _GUID(
            0xFDD39AD0,
            0x238F,
            0x46AF,
            (ctypes.c_ubyte * 8)(0xAD, 0xB4, 0x6C, 0x85, 0x48, 0x03, 0x69, 0xC7),
        )
        shell32 = ctypes.WinDLL("shell32", use_last_error=True)
        ole32 = ctypes.WinDLL("ole32", use_last_error=True)
        shell32.SHGetKnownFolderPath.argtypes = [
            ctypes.POINTER(_GUID),
            wintypes.DWORD,
            wintypes.HANDLE,
            ctypes.POINTER(ctypes.c_wchar_p),
        ]
        shell32.SHGetKnownFolderPath.restype = ctypes.HRESULT
        pointer = ctypes.c_wchar_p()
        result = shell32.SHGetKnownFolderPath(ctypes.byref(folder_id), 0, None, ctypes.byref(pointer))
        if result != 0 or not pointer.value:
            return None
        path = Path(pointer.value)
        ole32.CoTaskMemFree(pointer)
        return path
    except (OSError, AttributeError, ValueError):
        return None
