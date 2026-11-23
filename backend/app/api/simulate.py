"""Simulation configuration and GHDL runs.

The request returns while a long run continues on a worker thread.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.hdl.simulate import (
    SimulationRequestError,
    cancel_simulation,
    latest_simulation,
    launch_simulation,
    open_waveform,
    simulation_run,
)
from app.models.design import ProjectFile, SimulationConfig
from app.storage.project_store import load_project, save_project

router = APIRouter(tags=["simulation"])


@router.put("/simulation", response_model=ProjectFile)
def put_simulation(body: SimulationConfig) -> ProjectFile:
    project = load_project()
    project.simulation = body
    save_project(project)
    return project


@router.post("/simulation/runs")
def post_simulation() -> dict:
    project = load_project()
    try:
        return launch_simulation(project, project.simulation)
    except SimulationRequestError as exc:
        raise HTTPException(status_code=400, detail={"code": exc.code, "message": exc.message}) from exc


@router.get("/simulation/runs/latest")
def get_latest_simulation() -> dict | None:
    return latest_simulation()


@router.get("/simulation/runs/{run_id}")
def get_simulation(run_id: str) -> dict:
    run = simulation_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail={"code": "run_not_found", "message": "That simulation run does not exist."})
    return run


@router.post("/simulation/runs/{run_id}/cancel")
def post_cancel(run_id: str) -> dict:
    run = cancel_simulation(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail={"code": "run_not_found", "message": "That simulation run does not exist."})
    return run


@router.post("/simulation/runs/{run_id}/gtkwave")
def post_gtkwave(run_id: str) -> dict:
    try:
        return open_waveform(run_id)
    except SimulationRequestError as exc:
        raise HTTPException(status_code=400, detail={"code": exc.code, "message": exc.message}) from exc
