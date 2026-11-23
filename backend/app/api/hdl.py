"""Project VHDL standard and structural generation."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import Field

from app.hdl.generate import GenerateResult, generate_structural
from app.hdl.ghdl_run import LibraryProfile
from app.hdl.vhdl import VhdlStandard
from app.models.design import APIModel, ProjectFile
from app.storage.diagram_store import DiagramStoreError, load_editable
from app.storage.project_store import load_project, save_project

router = APIRouter(tags=["hdl"])


class VhdlStandardUpdate(APIModel):
    vhdl_standard: VhdlStandard


class LibraryProfileUpdate(APIModel):
    library_profile: LibraryProfile


class GenerateRequest(APIModel):
    root_diagram_id: str = Field(min_length=1)


@router.put("/project/vhdl-standard", response_model=ProjectFile)
def put_vhdl_standard(body: VhdlStandardUpdate) -> ProjectFile:
    project = load_project()
    project.vhdl_standard = body.vhdl_standard
    save_project(project)
    return project


@router.put("/project/library-profile", response_model=ProjectFile)
def put_library_profile(body: LibraryProfileUpdate) -> ProjectFile:
    project = load_project()
    project.library_profile = body.library_profile
    save_project(project)
    return project


@router.post("/generate", response_model=GenerateResult)
def post_generate(body: GenerateRequest) -> GenerateResult:
    try:
        root = load_editable(body.root_diagram_id)
    except DiagramStoreError as exc:
        status = 404 if exc.code == "diagram_not_found" else 400
        raise HTTPException(status_code=status, detail={"code": exc.code, "message": exc.message}) from exc
    project = load_project()
    standard: Literal["93", "2008"] = project.vhdl_standard
    return generate_structural(root, standard, load_editable, project.library_profile)
