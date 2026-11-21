"""Recursive library inventory.

The scan reads a directory the user selected. It does not copy or modify
those files. Object ids are assigned here and kept by the project store when
the same design unit or diagram is imported again.
"""

from __future__ import annotations

import hashlib
import os
import re
from datetime import datetime, timezone
from pathlib import Path

from app.identity import new_id
from app.importers.errors import ScanError
from app.importers.hds.extract import extract_graphical
from app.importers.hds.vhdl_check import check_against_vhdl
from app.importers.hds.views import parse_view_reference
from app.importers.vhdl.extract import ExtractedUnit, extract_design_units
from app.models.design import (
    DesignUnit,
    Diagnostic,
    DiagramDocument,
    FileEntry,
    FileRole,
    ImportReport,
    Library,
    ProjectFile,
    Severity,
    SourceSpan,
    SourceText,
    ViewReference,
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
    ".bd": "block_diagram",
    ".sb": "symbol",
    ".sm": "state_diagram",
    ".ibd": "interface_diagram",
    ".fc": "flowchart",
    ".tt": "truth_table",
    "._epf": "view_reference",
    ".hds": "metadata_candidate",
    ".hdp": "metadata_candidate",
    ".hde": "metadata_candidate",
    ".bde": "metadata_candidate",
    ".fsm": "metadata_candidate",
    ".sde": "metadata_candidate",
}
_GRAPHICAL_ROLES = {"block_diagram", "symbol", "state_diagram"}


def import_library(
    path: str,
    library_name: str | None = None,
    max_bytes: int = MAX_FILE_BYTES,
    include_side_data: bool = False,
) -> ProjectFile:
    library, units, diagrams = scan_directory(
        path,
        library_name,
        max_bytes=max_bytes,
        include_side_data=include_side_data,
    )
    return upsert_library(library, units, diagrams)


def examples_library_path() -> str:
    return str(examples_dir())


def scan_directory(
    path: str,
    library_name: str | None = None,
    max_bytes: int = MAX_FILE_BYTES,
    include_side_data: bool = False,
) -> tuple[Library, list[DesignUnit], list[DiagramDocument]]:
    root = resolve_directory(path)
    name = _library_name(library_name, root)
    library_id = new_id("lib")
    files: list[FileEntry] = []
    units: list[DesignUnit] = []
    diagrams: list[DiagramDocument] = []
    view_references: list[ViewReference] = []
    report_diagnostics: list[Diagnostic] = []
    now = datetime.now(timezone.utc)

    for file_path in _iter_files(root, include_side_data):
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
        side_data = _in_hidden_directory(relative)
        if side_data:
            entry.binary = _looks_binary(file_path)
            files.append(entry)
            report_diagnostics.append(
                _file_diagnostic(
                    "info",
                    "side_data_listed",
                    f"{relative} is inside a hidden directory. It was listed and not parsed.",
                    relative,
                )
            )
            continue
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
        if role in _GRAPHICAL_ROLES or role in {"interface_diagram", "flowchart", "truth_table"}:
            entry.binary = _looks_binary(file_path)
            files.append(entry)
            if entry.binary:
                report_diagnostics.append(
                    _file_diagnostic(
                        "warning",
                        "graphical_binary_not_parsed",
                        f"{relative} looks binary and was not parsed as a diagram.",
                        relative,
                    )
                )
                continue
            if role not in _GRAPHICAL_ROLES:
                report_diagnostics.append(
                    _file_diagnostic(
                        "info",
                        "graphical_role_not_parsed",
                        f"{relative} is a {role.replace('_', ' ')}. No sample of this view was available, so it was not parsed.",
                        relative,
                    )
                )
                continue
            diagram, notes = _graphical_diagram(file_path, relative, library_id, root)
            report_diagnostics.extend(notes)
            if diagram is not None:
                diagrams.append(diagram)
                report_diagnostics.extend(diagram.diagnostics)
                report_diagnostics.extend(_checks_as_diagnostics(diagram))
            continue
        if role == "view_reference":
            entry.binary = _looks_binary(file_path)
            files.append(entry)
            if entry.binary:
                report_diagnostics.append(
                    _file_diagnostic(
                        "warning",
                        "view_reference_binary",
                        f"{relative} looks binary and was not read as a view reference.",
                        relative,
                    )
                )
                continue
            text, latin1 = _decode(file_path)
            if latin1:
                report_diagnostics.append(
                    _file_diagnostic(
                        "info",
                        "decoded_as_latin1",
                        f"{relative} is not valid UTF-8 and was read as Latin-1.",
                        relative,
                    )
                )
            reference = parse_view_reference(relative, text)
            view_references.append(
                ViewReference(
                    path=reference.path,
                    default_file=reference.default_file,
                    default_architecture=reference.default_architecture,
                    unrecognized_lines=reference.unrecognized_lines or [],
                )
            )
            for line in reference.unrecognized_lines or []:
                report_diagnostics.append(
                    _file_diagnostic(
                        "warning",
                        "view_reference_unrecognized",
                        f"{relative} has an unrecognized line: {line}",
                        relative,
                    )
                )
            continue
        entry.binary = _looks_binary(file_path)
        files.append(entry)
        report_diagnostics.append(_deferred_diagnostic(entry))

    _annotate_relationships(units)
    files.sort(key=lambda item: item.path)
    units.sort(key=lambda item: (item.source.path, item.source.start_line, item.kind, item.name.lower()))
    diagrams.sort(key=lambda item: item.source_path)
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
            view_references=sorted(view_references, key=lambda item: item.path),
        ),
    )
    return library, units, diagrams


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
        from app.paths import relative_base

        candidate = relative_base() / candidate
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


def _iter_files(root: Path, include_side_data: bool) -> list[Path]:
    found: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        kept: list[str] = []
        for name in dirnames:
            if name in _SKIP_DIRS:
                continue
            if name.startswith(".") and not include_side_data:
                continue
            kept.append(name)
        dirnames[:] = kept
        for filename in filenames:
            found.append(Path(dirpath) / filename)
    return found


def _in_hidden_directory(relative: str) -> bool:
    return any(part.startswith(".") for part in Path(relative).parts[:-1])


def _graphical_diagram(
    file_path: Path,
    relative: str,
    library_id: str,
    root: Path,
) -> tuple[DiagramDocument | None, list[Diagnostic]]:
    text, latin1 = _decode(file_path)
    notes: list[Diagnostic] = []
    if latin1:
        notes.append(
            _file_diagnostic(
                "info",
                "decoded_as_latin1",
                f"{relative} is not valid UTF-8 and was read as Latin-1.",
                relative,
            )
        )
    file_hash = hashlib.sha256(file_path.read_bytes()).hexdigest()
    diagram = extract_graphical(text, relative=relative, file_hash=file_hash, library_id=library_id)
    if diagram.view == "block":
        diagram.vhdl_check = check_against_vhdl(diagram, root)
    return diagram, notes


def _checks_as_diagnostics(diagram: DiagramDocument) -> list[Diagnostic]:
    copied: list[Diagnostic] = []
    for item in diagram.vhdl_check:
        if item.severity == "info":
            continue
        copied.append(
            Diagnostic(
                severity=item.severity,
                code=item.code,
                message=item.message,
                path=diagram.source_path,
            )
        )
    return copied


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
    unit_id = new_id("du")
    ports = []
    for port in extracted.ports:
        copied = port.model_copy(deep=True)
        copied.id = new_id("port")
        ports.append(copied)
    generics = []
    for generic in extracted.generics:
        copied = generic.model_copy(deep=True)
        copied.id = new_id("gen")
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
        instantiates=extracted.instantiates,
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
        "block_diagrams": sum(1 for item in files if item.role == "block_diagram"),
        "symbols": sum(1 for item in files if item.role == "symbol"),
        "state_diagrams": sum(1 for item in files if item.role == "state_diagram"),
        "interface_diagrams": sum(1 for item in files if item.role == "interface_diagram"),
        "flowcharts": sum(1 for item in files if item.role == "flowchart"),
        "truth_tables": sum(1 for item in files if item.role == "truth_table"),
        "view_references": sum(1 for item in files if item.role == "view_reference"),
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
    if role == "unrecognized":
        return "unknown_extension"
    return role


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
