# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller onedir build for the portable Windows student edition.

The source checkout's ``libs/`` and ``workspace/`` are not data files.
"""

import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_submodules

root = Path(SPECPATH).resolve().parent
sys.path.insert(0, str(root / "backend"))

datas = [
    (str(root / "frontend" / "dist"), "frontend/dist"),
    (str(root / "examples"), "examples"),
    (str(root / "boardfiles"), "boardfiles"),
]
binaries = []
hidden = collect_submodules("app") + collect_submodules("uvicorn")
for package in ("fastapi", "starlette", "pydantic", "pydantic_core", "anyio", "h11"):
    extra_datas, extra_binaries, extra_hidden = collect_all(package)
    datas += extra_datas
    binaries += extra_binaries
    hidden += extra_hidden

a = Analysis(
    [str(root / "backend" / "app" / "launcher.py")],
    pathex=[str(root / "backend")],
    binaries=binaries,
    datas=datas,
    hiddenimports=hidden
    + [
        "app.main",
        "uvicorn.logging",
        "uvicorn.loops.auto",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan.on",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["pytest", "tkinter"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="HDL-Maker",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="HDL-Maker",
)
