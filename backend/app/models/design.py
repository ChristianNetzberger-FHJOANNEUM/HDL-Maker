"""Language-neutral inventory model.

Schema version 1 describes imported libraries and design-unit interfaces.
Block diagrams and state machines are separate documents so graphical layout
never becomes the semantic model. Keep this module aligned with
``schemas/design.schema.json``.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SCHEMA_VERSION = 1

Direction = Literal["in", "out", "inout", "buffer", "linkage"]
WidthStatus = Literal["literal", "scalar", "not_applicable", "unresolved"]
UnitKind = Literal[
    "entity",
    "architecture",
    "package",
    "package_body",
    "configuration",
    "context",
]
Language = Literal["vhdl", "systemverilog", "verilog", "unknown"]
ParseStatus = Literal["parsed", "partial", "unsupported", "skipped"]
GenericKind = Literal["value", "type", "package", "function", "procedure", "unknown"]
FileRole = Literal["vhdl", "systemverilog", "verilog", "metadata_candidate", "unrecognized"]
Severity = Literal["error", "warning", "info"]


class APIModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Diagnostic(APIModel):
    severity: Severity
    code: str
    message: str
    path: str | None = None
    line: int | None = None
    unit_id: str | None = None


class SourceSpan(APIModel):
    path: str
    sha256: str
    start_line: int = Field(ge=1)
    end_line: int = Field(ge=1)


class Port(APIModel):
    id: str
    name: str
    direction: Direction | None = None
    type_text: str
    range_text: str | None = None
    width: int | None = Field(default=None, ge=1)
    width_status: WidthStatus
    default_text: str | None = None


class GenericPort(APIModel):
    id: str
    name: str
    generic_kind: GenericKind
    type_text: str | None = None
    default_text: str | None = None


class DesignUnit(APIModel):
    id: str
    library_id: str
    kind: UnitKind
    name: str
    language: Language
    parent_name: str | None = None
    generics: list[GenericPort] = Field(default_factory=list)
    ports: list[Port] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    source: SourceSpan
    parse_status: ParseStatus
    diagnostics: list[Diagnostic] = Field(default_factory=list)


class FileEntry(APIModel):
    path: str
    extension: str
    size: int = Field(ge=0)
    role: FileRole
    classification: str
    binary: bool


class ImportReport(APIModel):
    library_id: str
    library_name: str
    root_path: str
    scanned_at: datetime
    files: list[FileEntry]
    unit_ids: list[str]
    counts: dict[str, int]
    diagnostics: list[Diagnostic]


class Library(APIModel):
    id: str
    name: str
    root_path: str
    imported_at: datetime
    updated_at: datetime
    last_import: ImportReport | None = None


class ProjectFile(APIModel):
    schema_version: Literal[1] = SCHEMA_VERSION
    project_id: str
    name: str
    libraries: list[Library] = Field(default_factory=list)
    design_units: list[DesignUnit] = Field(default_factory=list)


class HealthResponse(APIModel):
    status: Literal["ok"]
    service: str
    version: str
    python: str
    ghdl: str | None = None


class SourceText(APIModel):
    path: str
    start_line: int = Field(ge=1)
    end_line: int = Field(ge=1)
    text: str
    truncated: bool
    language: Language
