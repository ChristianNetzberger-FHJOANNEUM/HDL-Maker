"""Editable diagrams live under the workspace, one JSON file each.

Writes replace the file through a temporary name. Source libraries are never
opened for writing here.
"""

from __future__ import annotations

import re

from pydantic import ValidationError

from app.models.editable import EditableDiagram, EditableSummary
from app.paths import workspace_dir

_ID = re.compile(r"edg_[0-9a-f]{32}\Z")


class DiagramStoreError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def diagrams_dir():
    path = workspace_dir() / "diagrams"
    path.mkdir(parents=True, exist_ok=True)
    return path


def list_editable() -> list[EditableSummary]:
    found: list[EditableSummary] = []
    for path in sorted(diagrams_dir().glob("edg_*.json")):
        if not _ID.fullmatch(path.stem):
            continue
        try:
            diagram = EditableDiagram.model_validate_json(path.read_text(encoding="utf-8"))
        except (OSError, ValidationError):
            continue
        found.append(
            EditableSummary(
                id=diagram.id,
                name=diagram.name,
                library_id=diagram.provenance.library_id,
                origin=diagram.provenance.origin,
                source_diagram_id=diagram.provenance.source_diagram_id,
                source_path=diagram.provenance.source_path,
                entity_name=diagram.entity_name,
            )
        )
    return found


def load_editable(diagram_id: str) -> EditableDiagram:
    path = _file(diagram_id)
    if not path.is_file():
        raise DiagramStoreError("diagram_not_found", "Editable diagram not found.")
    try:
        return EditableDiagram.model_validate_json(path.read_text(encoding="utf-8"))
    except ValidationError as exc:
        raise DiagramStoreError("diagram_unreadable", "The editable diagram file could not be read.") from exc


def save_editable(diagram: EditableDiagram) -> EditableDiagram:
    path = _file(diagram.id)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(diagram.model_dump_json(indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)
    return diagram


def find_by_source(source_diagram_id: str) -> EditableDiagram | None:
    for summary in list_editable():
        if summary.source_diagram_id is not None and summary.source_diagram_id == source_diagram_id:
            return load_editable(summary.id)
    return None


def _file(diagram_id: str):
    if not _ID.fullmatch(diagram_id):
        raise DiagramStoreError("diagram_id_invalid", "Editable diagram id is not a studio id.")
    return diagrams_dir() / f"{diagram_id}.json"
