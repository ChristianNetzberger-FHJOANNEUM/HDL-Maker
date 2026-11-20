"""Recursive library inventory.

The scan reads a directory the user selected. It does not copy or modify
those files. Design-unit ids are derived from the library path, the unit
kind, the name, and the library-relative path, so scanning the same tree
again updates the same records.
"""

from __future__ import annotations

import hashlib
import os
import re
from datetime import datetime, timezone
from pathlib import Path

from app.ids import stable_id
from app.importers.errors import ScanError
from app.importers.vhdl.extract import ExtractedUnit, extract_design_units
from app.models.design import (
    DesignUnit,
    Diagnostic,
    FileEntry,
    FileRole,
    ImportReport,
    Library,
    ProjectFile,
    Severity,
    SourceSpan,
    SourceText,
)
from app.paths import examples_dir
from app.storage.project_store import upsert_library

MAX_FILE_BYTES = 2_000_000
SOURCE_TEXT_LIMIT = 200_000
_SKIP_DIRS = {".git", "__pycache__", "node_modules", ".venv", "venv", "dist", ".pytest_cache"}
_LIBRARY_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_-]*$")
_ROLE_BY_SUFFIX: dict[str, FileRole] = {
    ".vhd": "vhdl",
    ".vhdl": "vhdl",
    ".sv": "systemverilog",
    ".svh": "systemverilog",
    ".v": "verilog",
    ".vh": "verilog",
    ".hds": "metadata_candidate",
    ".hdp": "metadata_candidate",
    ".hde": "metadata_candidate",
    ".bd": "metadata_candidate",
    ".bde": "metadata_candidate",
    ".fsm": "metadata_candidate",
    ".sde": "metadata_candidate",
}


def import_library(path: str, library_name: str | None = None, max_bytes: int = MAX_FILE_BYTES) -> ProjectFile:
    library, units = scan_directory(path, library_name, max_bytes=max_bytes)
    return upsert_library(library, units)


def examples_library_path() -> str:
    return str(examples_dir())


def scan_directory(
    path: str,
    library_name: str | None = None,
    max_bytes: int = MAX_FILE_BYTES,
) -> tuple[Library, list[DesignUnit]]:
    root = resolve_directory(path)
    name = _library_name(library_name, root)
    library_id = stable_id("lib", os.path.normcase(str(root)))
    files: list[FileEntry] = []
    units: list[DesignUnit] = []
    report_diagnostics: list[Diagnostic] = []
    now = datetime.now(timezone.utc)

    for file_path in _iter_files(root):
        relative = file_path.relative_to(root).as_posix()
        suffix = file_path.suffix.lower()
        role = _ROLE_BY_SUFFIX.get(suffix, "unrecognized")
        size = file_path.stat().st_size
        entry = FileEntry(
            path=relative,
            extension=suffix,
            size=size,
            role=role,
            classification=_classification(suffix, role),
            binary=False,
        )
        if size > max_bytes:
            entry.binary = _looks_binary(file_path)
            files.append(entry)
            report_diagnostics.append(
                _file_diagnostic(
                    "warning",
                    "file_too_large",
                    f"{relative} is larger than {max_bytes} bytes and was not parsed.",
                    relative,
                )
            )
            continue
        if role == "vhdl":
            parsed, binary, diagnostics = _vhdl_units(file_path, relative, library_id)
            entry.binary = binary
            files.append(entry)
            report_diagnostics.extend(diagnostics)
            units.extend(parsed)
            continue
        entry.binary = _looks_binary(file_path)
        files.append(entry)
        report_diagnostics.append(_deferred_diagnostic(entry))

    _annotate_relationships(units)
    files.sort(key=lambda item: item.path)
    units.sort(key=lambda item: (item.source.path, item.source.start_line, item.kind, item.name.lower()))
    counts = _counts(files, units, report_diagnostics)
    library = Library(
        id=library_id,
        name=name,
        root_path=str(root),
        imported_at=now,
        updated_at=now,
        last_import=ImportReport(
            library_id=library_id,
            library_name=name,
            root_path=str(root),
            scanned_at=now,
            files=files,
            unit_ids=[unit.id for unit in units],
            counts=counts,
            diagnostics=report_diagnostics,
        ),
    )
    return library, units


def read_unit_source(unit: DesignUnit, library: Library) -> SourceText:
    root = Path(library.root_path).resolve()
    file_path = (root / unit.source.path).resolve()
    if not file_path.is_relative_to(root):
        raise ScanError("path_escapes_library", "The recorded source path leaves the library root.")
    if not file_path.is_file():
        raise ScanError("source_missing", f"Source file no longer exists: {unit.source.path}")
    if file_path.stat().st_size > MAX_FILE_BYTES:
        raise ScanError("file_too_large", f"{unit.source.path} is too large to display.")
    text, _binary = _decode(file_path)
    truncated = len(text) > SOURCE_TEXT_LIMIT
    if truncated:
        text = text[:SOURCE_TEXT_LIMIT]
    return SourceText(
        path=unit.source.path,
        start_line=unit.source.start_line,
        end_line=unit.source.end_line,
        text=text,
        truncated=truncated,
        language=unit.language,
    )


def resolve_directory(path: str) -> Path:
    if not path or not path.strip():
        raise ScanError("path_required", "A directory path is required.")
    candidate = Path(path.strip()).expanduser()
    if not candidate.is_absolute():
        from app.paths import repo_root

        candidate = repo_root() / candidate
    try:
        resolved = candidate.resolve(strict=True)
    except FileNotFoundError as exc:
        raise ScanError("path_not_found", f"Directory not found: {path}") from exc
    if not resolved.is_dir():
        raise ScanError("not_a_directory", f"Path is not a directory: {resolved}")
    return resolved


def _library_name(requested: str | None, root: Path) -> str:
    name = requested.strip() if requested else root.name
    if not _LIBRARY_NAME_RE.match(name):
        raise ScanError(
            "invalid_library_name",
            "Library name must start with a letter or underscore and contain only letters, digits, underscores, or hyphens.",
        )
    return name


def _iter_files(root: Path) -> list[Path]:
    found: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        dirnames[:] = [name for name in dirnames if name not in _SKIP_DIRS and not name.startswith(".")]
        for filename in filenames:
            found.append(Path(dirpath) / filename)
    return found


def _vhdl_units(
    file_path: Path,
    relative: str,
    library_id: str,
) -> tuple[list[DesignUnit], bool, list[Diagnostic]]:
    if _looks_binary(file_path):
        return [], True, [
            _file_diagnostic(
                "warning",
                "binary_not_parsed",
                f"{relative} looks binary and was not parsed as VHDL.",
                relative,
            )
        ]
    text, decoded_latin1 = _decode(file_path)
    diagnostics: list[Diagnostic] = []
    if decoded_latin1:
        diagnostics.append(
            _file_diagnostic(
                "info",
                "decoded_as_latin1",
                f"{relative} is not valid UTF-8 and was read as Latin-1.",
                relative,
            )
        )
    file_hash = hashlib.sha256(file_path.read_bytes()).hexdigest()
    units: list[DesignUnit] = []
    for extracted in extract_design_units(text):
        unit = _to_design_unit(extracted, library_id, relative, file_hash)
        for item in unit.diagnostics:
            item.path = relative
        units.append(unit)
    return units, False, diagnostics


def _to_design_unit(extracted: ExtractedUnit, library_id: str, relative: str, file_hash: str) -> DesignUnit:
    unit_id = stable_id("du", library_id, extracted.kind, extracted.name.lower(), relative)
    ports = []
    for port in extracted.ports:
        copied = port.model_copy(deep=True)
        copied.id = stable_id("port", unit_id, port.name.lower())
        ports.append(copied)
    generics = []
    for generic in extracted.generics:
        copied = generic.model_copy(deep=True)
        copied.id = stable_id("gen", unit_id, generic.name.lower())
        generics.append(copied)
    return DesignUnit(
        id=unit_id,
        library_id=library_id,
        kind=extracted.kind,  # type: ignore[arg-type]
        name=extracted.name,
        language="vhdl",
        parent_name=extracted.parent_name,
        generics=generics,
        ports=ports,
        dependencies=extracted.dependencies,
        source=SourceSpan(
            path=relative,
            sha256=file_hash,
            start_line=extracted.start_line,
            end_line=extracted.end_line,
        ),
        parse_status=extracted.parse_status,
        diagnostics=extracted.diagnostics,
    )


def _annotate_relationships(units: list[DesignUnit]) -> None:
    grouped: dict[tuple[str, str], list[DesignUnit]] = {}
    for unit in units:
        if unit.kind in {"entity", "package"}:
            grouped.setdefault((unit.kind, unit.name.lower()), []).append(unit)
    for group in grouped.values():
        if len(group) < 2:
            continue
        paths = ", ".join(unit.source.path for unit in group)
        for unit in group:
            unit.diagnostics.append(
                Diagnostic(
                    severity="warning",
                    code="duplicate_unit_name",
                    message=f"{unit.kind} '{unit.name}' is declared in more than one file: {paths}. Both were kept.",
                    path=unit.source.path,
                    line=unit.source.start_line,
                    unit_id=unit.id,
                )
            )
    entity_names = {unit.name.lower() for unit in units if unit.kind == "entity"}
    for unit in units:
        if unit.kind != "architecture" or not unit.parent_name:
            continue
        if unit.parent_name.lower() not in entity_names:
            unit.diagnostics.append(
                Diagnostic(
                    severity="warning",
                    code="architecture_entity_missing",
                    message=(
                        f"Architecture '{unit.name}' names entity '{unit.parent_name}', "
                        "which was not found in this library. No entity was invented."
                    ),
                    path=unit.source.path,
                    line=unit.source.start_line,
                    unit_id=unit.id,
                )
            )


def _counts(files: list[FileEntry], units: list[DesignUnit], diagnostics: list[Diagnostic]) -> dict[str, int]:
    unit_errors = sum(1 for unit in units for item in unit.diagnostics if item.severity == "error")
    unit_warnings = sum(1 for unit in units for item in unit.diagnostics if item.severity == "warning")
    counts = {
        "files": len(files),
        "entities": sum(1 for unit in units if unit.kind == "entity"),
        "architectures": sum(1 for unit in units if unit.kind == "architecture"),
        "packages": sum(1 for unit in units if unit.kind == "package"),
        "package_bodies": sum(1 for unit in units if unit.kind == "package_body"),
        "metadata_candidates": sum(1 for item in files if item.role == "metadata_candidate"),
        "systemverilog": sum(1 for item in files if item.role == "systemverilog"),
        "verilog": sum(1 for item in files if item.role == "verilog"),
        "unrecognized": sum(1 for item in files if item.role == "unrecognized"),
        "errors": unit_errors + sum(1 for item in diagnostics if item.severity == "error"),
        "warnings": unit_warnings + sum(1 for item in diagnostics if item.severity == "warning"),
    }
    return counts


def _deferred_diagnostic(entry: FileEntry) -> Diagnostic:
    if entry.binary and entry.role == "metadata_candidate":
        return _file_diagnostic(
            "info",
            "metadata_not_interpreted",
            f"{entry.path} looks binary. The extension is only a candidate; the format was not interpreted.",
            entry.path,
        )
    if entry.role == "metadata_candidate":
        return _file_diagnostic(
            "info",
            "metadata_not_interpreted",
            f"{entry.path} has a diagram or HDL Designer candidate extension. The format was not interpreted.",
            entry.path,
        )
    if entry.role == "systemverilog":
        return _file_diagnostic(
            "warning",
            "systemverilog_deferred",
            f"{entry.path} is SystemVerilog. The file was inventoried and its module interface was not extracted.",
            entry.path,
        )
    if entry.role == "verilog":
        return _file_diagnostic(
            "warning",
            "verilog_deferred",
            f"{entry.path} is Verilog. The file was inventoried and its module interface was not extracted.",
            entry.path,
        )
    if entry.binary:
        return _file_diagnostic(
            "info",
            "unrecognized_file",
            f"{entry.path} is an unrecognized binary file and was not parsed.",
            entry.path,
        )
    return _file_diagnostic(
        "info",
        "unrecognized_file",
        f"{entry.path} has an unrecognized extension and was not parsed.",
        entry.path,
    )


def _classification(suffix: str, role: FileRole) -> str:
    if role == "vhdl":
        return "vhdl_source"
    if role == "systemverilog":
        return "systemverilog_source"
    if role == "verilog":
        return "verilog_source"
    if role == "metadata_candidate":
        return f"uninterpreted_{suffix.lstrip('.') or 'file'}"
    return "unknown_extension"


def _looks_binary(path: Path) -> bool:
    with path.open("rb") as handle:
        return b"\x00" in handle.read(8192)


def _decode(path: Path) -> tuple[str, bool]:
    data = path.read_bytes()
    try:
        return data.decode("utf-8-sig"), False
    except UnicodeDecodeError:
        return data.decode("latin-1"), True


def _file_diagnostic(severity: Severity, code: str, message: str, path: str) -> Diagnostic:
    return Diagnostic(severity=severity, code=code, message=message, path=path)
