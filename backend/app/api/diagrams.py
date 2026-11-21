"""Read and write editable diagrams. Imported HDL Designer files stay untouched."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import Field

from app.editing.convert import editable_from_import
from app.editing.create import new_diagram
from app.editing.hierarchy import hierarchy_checks
from app.editing.validate import connection_checks
from app.models.design import APIModel
from app.models.editable import EditableDiagram, EditableSummary
from app.storage.diagram_store import DiagramStoreError, find_by_source, list_editable, load_editable, save_editable
from app.storage.project_store import load_project

router = APIRouter(tags=["diagrams"])


class NewDesignRequest(APIModel):
    name: str = Field(min_length=1)
    library_id: str = Field(min_length=1)


def _store_error(exc: DiagramStoreError) -> HTTPException:
    status = 404 if exc.code == "diagram_not_found" else 400
    return HTTPException(status_code=status, detail={"code": exc.code, "message": exc.message})


@router.get("/editable-diagrams", response_model=list[EditableSummary])
def get_editable_diagrams() -> list[EditableSummary]:
    return list_editable()


@router.get("/editable-diagrams/{diagram_id}", response_model=EditableDiagram)
def get_editable_diagram(diagram_id: str) -> EditableDiagram:
    try:
        return load_editable(diagram_id)
    except DiagramStoreError as exc:
        raise _store_error(exc) from exc


@router.put("/editable-diagrams/{diagram_id}", response_model=EditableDiagram)
def put_editable_diagram(diagram_id: str, body: EditableDiagram) -> EditableDiagram:
    if body.id != diagram_id:
        raise HTTPException(
            status_code=400,
            detail={"code": "diagram_id_mismatch", "message": "The document id and the URL id differ."},
        )
    try:
        load_editable(diagram_id)
    except DiagramStoreError as exc:
        raise _store_error(exc) from exc
    body.checks = connection_checks(body) + hierarchy_checks(body, load_editable)
    try:
        return save_editable(body)
    except DiagramStoreError as exc:
        raise _store_error(exc) from exc


@router.post("/editable-diagrams", response_model=EditableDiagram)
def post_editable_diagram(body: NewDesignRequest) -> EditableDiagram:
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail={"code": "design_name_empty", "message": "The design needs a name."})
    project = load_project()
    if not any(library.id == body.library_id for library in project.libraries):
        raise HTTPException(
            status_code=404,
            detail={"code": "library_not_found", "message": "The design must belong to an imported library."},
        )
    try:
        return save_editable(new_diagram(name, body.library_id))
    except DiagramStoreError as exc:
        raise _store_error(exc) from exc


@router.post("/editable-diagrams/from-import/{source_id}", response_model=EditableDiagram)
def post_editable_from_import(source_id: str) -> EditableDiagram:
    existing = find_by_source(source_id)
    if existing is not None:
        return existing
    project = load_project()
    source = next((item for item in project.diagrams if item.id == source_id), None)
    if source is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "diagram_not_found", "message": "Imported diagram not found."},
        )
    if source.view != "block":
        raise HTTPException(
            status_code=400,
            detail={"code": "diagram_not_block", "message": "Only a block diagram can be edited in this milestone."},
        )
    created = editable_from_import(source, project.design_units)
    try:
        return save_editable(created)
    except DiagramStoreError as exc:
        raise _store_error(exc) from exc
