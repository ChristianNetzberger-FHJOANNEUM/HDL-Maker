"""Language-neutral inventory and imported-diagram model.

Schema version 2 adds read-only diagram documents. Version 1 project files
still load. Graphical coordinates stay on the diagram and are not part of the
VHDL interface. Keep this module aligned with ``schemas/design.schema.json``.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SCHEMA_VERSION = 2

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
FileRole = Literal[
    "vhdl",
    "systemverilog",
    "verilog",
    "block_diagram",
    "symbol",
    "state_diagram",
    "interface_diagram",
    "flowchart",
    "truth_table",
    "view_reference",
    "metadata_candidate",
    "unrecognized",
]
DiagramView = Literal["block", "symbol", "state", "unknown"]
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
    instantiates: list[str] = Field(default_factory=list)
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


class DiagramGeneric(APIModel):
    name: str
    type_text: str | None = None
    value: str | None = None


class Point(APIModel):
    x: int
    y: int


class DiagramPort(APIModel):
    id: str
    name: str
    direction: Direction | None = None
    type_text: str | None = None
    range_text: str | None = None
    hds_uid: str | None = None
    hds_object: int | None = None
    marker_m: int | None = None
    x1: int | None = None
    y1: int | None = None
    x2: int | None = None
    y2: int | None = None


class DiagramInstance(APIModel):
    id: str
    name: str
    component_name: str | None = None
    component_library: str | None = None
    hds_uid: str | None = None
    hds_object: int | None = None
    x1: int | None = None
    y1: int | None = None
    x2: int | None = None
    y2: int | None = None
    generics: list[DiagramGeneric] = Field(default_factory=list)
    ports: list[DiagramPort] = Field(default_factory=list)


class DiagramNet(APIModel):
    id: str
    name: str
    type_text: str | None = None
    range_text: str | None = None
    hds_uid: str | None = None
    hds_object: int | None = None


class DiagramWire(APIModel):
    id: str
    hds_uid: str | None = None
    hds_object: int | None = None
    start_object: int | None = None
    end_object: int | None = None
    net_object: int | None = None
    slice_text: str | None = None
    points: list[Point] = Field(default_factory=list)


class EmbeddedBlock(APIModel):
    id: str
    name: str
    number: str | None = None
    text: str | None = None
    hds_uid: str | None = None
    hds_object: int | None = None
    x1: int | None = None
    y1: int | None = None
    x2: int | None = None
    y2: int | None = None


class DiagramJunction(APIModel):
    id: str
    hds_uid: str | None = None
    hds_object: int | None = None
    x: int
    y: int


class PreservedRecord(APIModel):
    type_name: str
    line: int = Field(ge=1)
    hds_object: int | None = None
    payload: str


class VhdlCheck(APIModel):
    severity: Severity
    code: str
    message: str


class DiagramDocument(APIModel):
    id: str
    library_id: str
    source_path: str
    sha256: str
    view: DiagramView
    format_version: str | None = None
    app_version: str | None = None
    entity_name: str | None = None
    architecture_name: str | None = None
    machine_name: str | None = None
    state_signal_name: str | None = None
    parse_status: ParseStatus
    instances: list[DiagramInstance] = Field(default_factory=list)
    ports: list[DiagramPort] = Field(default_factory=list)
    nets: list[DiagramNet] = Field(default_factory=list)
    wires: list[DiagramWire] = Field(default_factory=list)
    embedded_blocks: list[EmbeddedBlock] = Field(default_factory=list)
    junctions: list[DiagramJunction] = Field(default_factory=list)
    record_counts: dict[str, int] = Field(default_factory=dict)
    preserved_records: list[PreservedRecord] = Field(default_factory=list)
    diagnostics: list[Diagnostic] = Field(default_factory=list)
    vhdl_check: list[VhdlCheck] = Field(default_factory=list)


class ViewReference(APIModel):
    path: str
    default_file: str | None = None
    default_architecture: str | None = None
    unrecognized_lines: list[str] = Field(default_factory=list)


class ImportReport(APIModel):
    library_id: str
    library_name: str
    root_path: str
    scanned_at: datetime
    files: list[FileEntry]
    unit_ids: list[str]
    counts: dict[str, int]
    diagnostics: list[Diagnostic]
    view_references: list[ViewReference] = Field(default_factory=list)


class Library(APIModel):
    id: str
    name: str
    root_path: str
    imported_at: datetime
    updated_at: datetime
    last_import: ImportReport | None = None


class ProjectFile(APIModel):
    schema_version: Literal[1, 2] = SCHEMA_VERSION
    project_id: str
    name: str
    libraries: list[Library] = Field(default_factory=list)
    design_units: list[DesignUnit] = Field(default_factory=list)
    diagrams: list[DiagramDocument] = Field(default_factory=list)


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
