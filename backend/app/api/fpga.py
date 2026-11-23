"""FPGA build configuration, Vivado batch runs, and JTAG programming.

A build or a hardware operation returns while Vivado continues on a worker
thread. Programming requires an explicit device and confirmation. A mock
result never claims that the FPGA was programmed.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.fpga.program import (
    latest_bitstream,
    latest_program,
    latest_scan,
    launch_program,
    launch_scan,
    program_record,
    scan_record,
)
from app.fpga.vivado import (
    FpgaRequestError,
    build_run,
    cancel_build,
    latest_build,
    launch_build,
    probe_vivado,
    report_text,
)
from app.models.design import FpgaBuildConfig, FpgaProgramRequest, ProjectFile
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


@router.get("/fpga/bitstreams/latest")
def get_latest_bitstream() -> dict | None:
    return latest_bitstream()


@router.post("/fpga/hardware/scans")
def post_scan() -> dict:
    project = load_project()
    bitstream = latest_bitstream()
    part = str(bitstream["part"]) if bitstream and bitstream.get("part") else project.fpga.part
    try:
        return launch_scan(part)
    except FpgaRequestError as exc:
        raise HTTPException(status_code=400, detail={"code": exc.code, "message": exc.message}) from exc


@router.get("/fpga/hardware/scans/latest")
def get_latest_scan() -> dict | None:
    return latest_scan()


@router.get("/fpga/hardware/scans/{scan_id}")
def get_scan(scan_id: str) -> dict:
    scan = scan_record(scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail={"code": "scan_not_found", "message": "That hardware scan does not exist."})
    return scan


@router.post("/fpga/hardware/programs")
def post_program(body: FpgaProgramRequest) -> dict:
    try:
        return launch_program(body)
    except FpgaRequestError as exc:
        raise HTTPException(status_code=400, detail={"code": exc.code, "message": exc.message}) from exc


@router.get("/fpga/hardware/programs/latest")
def get_latest_program() -> dict | None:
    return latest_program()


@router.get("/fpga/hardware/programs/{program_id}")
def get_program(program_id: str) -> dict:
    program = program_record(program_id)
    if program is None:
        raise HTTPException(status_code=404, detail={"code": "program_not_found", "message": "That programming attempt does not exist."})
    return program


@router.get("/fpga/builds/{build_id}/reports/{name}")
def get_report(build_id: str, name: str) -> dict:
    text = report_text(build_id, name)
    if text is None:
        raise HTTPException(status_code=404, detail={"code": "report_missing", "message": "That report is not in this build."})
    return {"name": name, "text": text}
