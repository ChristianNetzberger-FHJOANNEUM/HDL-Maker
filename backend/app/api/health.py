"""Process health, including whether GHDL is on PATH."""

from __future__ import annotations

import platform
import shutil

from fastapi import APIRouter

from app import __version__
from app.models.design import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="hdl-design-studio",
        version=__version__,
        python=platform.python_version(),
        ghdl=shutil.which("ghdl"),
    )
