"""Persistent identities for imported design objects.

A new object receives a random id. Importing the same library again, including
after the directory has moved, reuses the stored id when the logical identity
matches. Absolute paths are only a hint for finding the previous library.
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass

from app.models.design import DesignUnit, DiagramDocument, Library, ProjectFile


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


@dataclass
class LibraryMatch:
    library: Library
    relocated: bool


def rebind(
    project: ProjectFile,
    library: Library,
    units: list[DesignUnit],
    diagrams: list[DiagramDocument],
) -> None:
    """Replace fresh ids with previously stored ids. Objects are updated in place."""
    match = _match_library(project, library)
    if match is None:
        return
    previous = match.library
    library.id = previous.id
    library.imported_at = previous.imported_at
    if library.last_import is not None:
        library.last_import.library_id = previous.id
        if match.relocated:
            library.last_import.diagnostics.append(
                _info(
                    "library_relocated",
                    (
                        f"Library '{library.name}' was previously imported from {previous.root_path}. "
                        "Stored ids were kept and the root path was updated."
                    ),
                )
            )
    for unit in units:
        unit.library_id = previous.id
    for diagram in diagrams:
        diagram.library_id = previous.id
    _rebind_units(project, previous.id, units)
    _rebind_diagrams(project, previous.id, diagrams)


def _match_library(project: ProjectFile, library: Library) -> LibraryMatch | None:
    wanted = os.path.normcase(library.root_path)
    by_path = [item for item in project.libraries if os.path.normcase(item.root_path) == wanted]
    if len(by_path) == 1:
        return LibraryMatch(by_path[0], relocated=False)
    if len(by_path) > 1:
        _ambiguous(library, "Several stored libraries use this directory. A new library id was assigned.")
        return None
    by_name = [item for item in project.libraries if item.name == library.name]
    if len(by_name) == 1:
        return LibraryMatch(by_name[0], relocated=by_name[0].root_path != library.root_path)
    if len(by_name) > 1:
        _ambiguous(
            library,
            f"Several stored libraries are named '{library.name}'. This import was kept separate.",
        )
    return None


def _ambiguous(library: Library, message: str) -> None:
    if library.last_import is None:
        return
    library.last_import.diagnostics.append(
        _warning("library_identity_ambiguous", message)
    )


def _rebind_units(project: ProjectFile, library_id: str, units: list[DesignUnit]) -> None:
    previous = {
        (unit.kind, unit.name.lower(), unit.source.path): unit
        for unit in project.design_units
        if unit.library_id == library_id
    }
    for unit in units:
        old = previous.get((unit.kind, unit.name.lower(), unit.source.path))
        if old is None:
            continue
        unit.id = old.id
        old_ports = {port.name.lower(): port.id for port in old.ports}
        for port in unit.ports:
            port.id = old_ports.get(port.name.lower(), port.id)
        old_generics = {generic.name.lower(): generic.id for generic in old.generics}
        for generic in unit.generics:
            generic.id = old_generics.get(generic.name.lower(), generic.id)


def _rebind_diagrams(project: ProjectFile, library_id: str, diagrams: list[DiagramDocument]) -> None:
    previous = {
        diagram.source_path: diagram
        for diagram in project.diagrams
        if diagram.library_id == library_id
    }
    for diagram in diagrams:
        old = previous.get(diagram.source_path)
        if old is None:
            continue
        diagram.id = old.id
        _reuse(_index(old.instances), diagram.instances)
        _reuse(_index(old.ports), diagram.ports)
        _reuse(_index(old.nets), diagram.nets)
        _reuse(_index(old.wires), diagram.wires)
        _reuse(_index(old.embedded_blocks), diagram.embedded_blocks)
        for instance, old_instance in _pairs(old.instances, diagram.instances):
            _reuse(_index(old_instance.ports), instance.ports)


def _index(items) -> dict[str, str]:
    found: dict[str, str] = {}
    for item in items:
        key = _object_key(item)
        if key is not None and key not in found:
            found[key] = item.id
    return found


def _reuse(old_ids: dict[str, str], items) -> None:
    for item in items:
        key = _object_key(item)
        if key is not None and key in old_ids:
            item.id = old_ids[key]


def _pairs(old_items, new_items):
    old_by_key = {}
    for item in old_items:
        key = _object_key(item)
        if key is not None:
            old_by_key.setdefault(key, item)
    for item in new_items:
        key = _object_key(item)
        if key is not None and key in old_by_key:
            yield item, old_by_key[key]


def _object_key(item) -> str | None:
    uid = getattr(item, "hds_uid", None)
    if uid:
        return f"uid:{uid}"
    number = getattr(item, "hds_object", None)
    if number is not None:
        return f"obj:{number}"
    return None


def _info(code: str, message: str):
    from app.models.design import Diagnostic

    return Diagnostic(severity="info", code=code, message=message)


def _warning(code: str, message: str):
    from app.models.design import Diagnostic

    return Diagnostic(severity="warning", code=code, message=message)
