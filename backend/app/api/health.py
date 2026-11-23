"""Process health, including whether GHDL and GTKWave can be started."""

from __future__ import annotations

import platform
import shutil

from fastapi import APIRouter

from app import __version__
from app.fpga.vivado import resolve_vivado
from app.hdl.gtkwave import resolve_gtkwave
from app.models.design import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    gtkwave, _gtkwave_problem = resolve_gtkwave()
    vivado, _vivado_problem = resolve_vivado()
    return HealthResponse(
        status="ok",
        service="hdl-design-studio",
        version=__version__,
        python=platform.python_version(),
        ghdl=shutil.which("ghdl"),
        gtkwave=gtkwave,
        vivado=vivado,
    )
