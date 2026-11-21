"""Read and write workspace/project.json.

The file is the inventory for this machine. It stores paths to the original
libraries and does not contain copies of the HDL sources.
"""

from __future__ import annotations

from app.identity import rebind
from app.ids import stable_id
from app.models.design import DesignUnit, DiagramDocument, Library, ProjectFile
from app.paths import project_file


def load_project() -> ProjectFile:
    path = project_file()
    if not path.exists():
        return ProjectFile(project_id=stable_id("proj", "local"), name="local")
    return ProjectFile.model_validate_json(path.read_text(encoding="utf-8"))


def save_project(project: ProjectFile) -> None:
    project.schema_version = 2
    path = project_file()
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(project.model_dump_json(indent=2), encoding="utf-8")
    temporary.replace(path)


def upsert_library(
    library: Library,
    units: list[DesignUnit],
    diagrams: list[DiagramDocument] | None = None,
) -> ProjectFile:
    project = load_project()
    diagrams = diagrams or []
    rebind(project, library, units, diagrams)
    if library.last_import is not None:
        library.last_import.library_id = library.id
        library.last_import.unit_ids = [unit.id for unit in units]
        _refresh_severity_counts(library, units)
    existing = next((item for item in project.libraries if item.id == library.id), None)
    if existing is not None:
        library.imported_at = existing.imported_at
        project.libraries = [library if item.id == library.id else item for item in project.libraries]
    else:
        project.libraries.append(library)
    project.design_units = [unit for unit in project.design_units if unit.library_id != library.id]
    project.design_units.extend(units)
    project.diagrams = [item for item in project.diagrams if item.library_id != library.id]
    project.diagrams.extend(diagrams)
    save_project(project)
    return project


def _refresh_severity_counts(library: Library, units: list[DesignUnit]) -> None:
    report = library.last_import
    if report is None:
        return
    report.counts["errors"] = sum(1 for unit in units for item in unit.diagnostics if item.severity == "error") + sum(
        1 for item in report.diagnostics if item.severity == "error"
    )
    report.counts["warnings"] = sum(
        1 for unit in units for item in unit.diagnostics if item.severity == "warning"
    ) + sum(1 for item in report.diagnostics if item.severity == "warning")
