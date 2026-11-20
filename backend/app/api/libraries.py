"""Library inventory API. Scanning reads the directory the client names."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.importers.errors import ScanError
from app.importers.inventory import examples_library_path, import_library, read_unit_source
from app.models.design import DesignUnit, ProjectFile, SourceText
from app.storage.project_store import load_project

router = APIRouter(tags=["libraries"])


class ScanRequest(BaseModel):
    path: str = Field(min_length=1)
    library_name: str | None = None


class ExamplesPath(BaseModel):
    path: str


def _scan_error(exc: ScanError) -> HTTPException:
    status = 404 if exc.code in {"path_not_found", "unit_not_found", "source_missing"} else 400
    return HTTPException(status_code=status, detail={"code": exc.code, "message": exc.message})


@router.get("/project", response_model=ProjectFile)
def get_project() -> ProjectFile:
    return load_project()


@router.get("/examples/path", response_model=ExamplesPath)
def get_examples_path() -> ExamplesPath:
    return ExamplesPath(path=examples_library_path())


@router.post("/libraries/scan", response_model=ProjectFile)
def scan_library(body: ScanRequest) -> ProjectFile:
    try:
        return import_library(body.path, body.library_name)
    except ScanError as exc:
        raise _scan_error(exc) from exc


@router.get("/design-units/{unit_id}", response_model=DesignUnit)
def get_design_unit(unit_id: str) -> DesignUnit:
    project = load_project()
    unit = next((item for item in project.design_units if item.id == unit_id), None)
    if unit is None:
        raise HTTPException(status_code=404, detail={"code": "unit_not_found", "message": "Design unit not found."})
    return unit


@router.get("/design-units/{unit_id}/source", response_model=SourceText)
def get_design_unit_source(unit_id: str) -> SourceText:
    project = load_project()
    unit = next((item for item in project.design_units if item.id == unit_id), None)
    if unit is None:
        raise HTTPException(status_code=404, detail={"code": "unit_not_found", "message": "Design unit not found."})
    library = next((item for item in project.libraries if item.id == unit.library_id), None)
    if library is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "library_not_found", "message": "The library for this design unit is no longer in the project."},
        )
    try:
        return read_unit_source(unit, library)
    except ScanError as exc:
        raise _scan_error(exc) from exc
