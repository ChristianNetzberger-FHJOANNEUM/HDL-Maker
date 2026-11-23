"""FPGA build configuration and Vivado batch runs.

The request returns while a long build continues on a worker thread.
Programming the device is not part of this interface.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.fpga.vivado import (
    FpgaRequestError,
    build_run,
    cancel_build,
    latest_build,
    launch_build,
    probe_vivado,
    report_text,
)
from app.models.design import FpgaBuildConfig, ProjectFile
from app.storage.project_store import load_project, save_project

router = APIRouter(tags=["fpga"])


@router.put("/fpga", response_model=ProjectFile)
def put_fpga(body: FpgaBuildConfig) -> ProjectFile:
    project = load_project()
    project.fpga = body
    save_project(project)
    return project


@router.post("/fpga/vivado-check")
def post_vivado_check() -> dict:
    return probe_vivado()


@router.post("/fpga/builds")
def post_build() -> dict:
    project = load_project()
    try:
        return launch_build(project, project.fpga)
    except FpgaRequestError as exc:
        raise HTTPException(status_code=400, detail={"code": exc.code, "message": exc.message}) from exc


@router.get("/fpga/builds/latest")
def get_latest() -> dict | None:
    return latest_build()


@router.get("/fpga/builds/{build_id}")
def get_build(build_id: str) -> dict:
    run = build_run(build_id)
    if run is None:
        raise HTTPException(status_code=404, detail={"code": "build_not_found", "message": "That FPGA build does not exist."})
    return run


@router.post("/fpga/builds/{build_id}/cancel")
def post_cancel(build_id: str) -> dict:
    run = cancel_build(build_id)
    if run is None:
        raise HTTPException(status_code=404, detail={"code": "build_not_found", "message": "That FPGA build does not exist."})
    return run


@router.get("/fpga/builds/{build_id}/reports/{name}")
def get_report(build_id: str, name: str) -> dict:
    text = report_text(build_id, name)
    if text is None:
        raise HTTPException(status_code=404, detail={"code": "report_missing", "message": "That report is not in this build."})
    return {"name": name, "text": text}
