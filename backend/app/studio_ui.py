"""Serve the built Vue app from this process.

Development keeps using the Vite server on port 5173. The packaged executable
serves these files itself, so the browser never needs the Vite proxy.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.paths import frontend_dist, serve_frontend


def install_frontend(application: FastAPI) -> bool:
    if not serve_frontend():
        return False
    dist = frontend_dist()
    if dist is None:
        return False
    assets = dist / "assets"
    if assets.is_dir():
        application.mount("/assets", StaticFiles(directory=assets), name="studio-assets")
    index = dist / "index.html"

    @application.get("/", include_in_schema=False)
    def studio_index() -> FileResponse:
        return FileResponse(index)

    return True
