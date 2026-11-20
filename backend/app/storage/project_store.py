"""Read and write workspace/project.json.

The file is the inventory for this machine. It stores paths to the original
libraries and does not contain copies of the HDL sources.
"""

from __future__ import annotations

from app.ids import stable_id
from app.models.design import DesignUnit, Library, ProjectFile
from app.paths import project_file


def load_project() -> ProjectFile:
    path = project_file()
    if not path.exists():
        return ProjectFile(project_id=stable_id("proj", "local"), name="local")
    return ProjectFile.model_validate_json(path.read_text(encoding="utf-8"))


def save_project(project: ProjectFile) -> None:
    path = project_file()
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(project.model_dump_json(indent=2), encoding="utf-8")
    temporary.replace(path)


def upsert_library(library: Library, units: list[DesignUnit]) -> ProjectFile:
    project = load_project()
    existing = next((item for item in project.libraries if item.id == library.id), None)
    if existing is not None:
        library.imported_at = existing.imported_at
        project.libraries = [library if item.id == library.id else item for item in project.libraries]
    else:
        project.libraries.append(library)
    project.design_units = [unit for unit in project.design_units if unit.library_id != library.id]
    project.design_units.extend(units)
    save_project(project)
    return project
