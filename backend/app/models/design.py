"""Language-neutral inventory and imported-diagram model.

Schema version 2 adds read-only diagram documents. Version 1 project files
still load. Graphical coordinates stay on the diagram and are not part of the
VHDL interface. Keep this module aligned with ``schemas/design.schema.json``.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

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


class DiagramTextBox(APIModel):
    """A text rectangle stored by HDL Designer, separate from the state circle and the spline."""

    id: str
    role: Literal["entry", "during", "exit", "condition", "actions"]
    x1: int
    y1: int
    x2: int
    y2: int


class DiagramState(APIModel):
    """A placed state. Fields stay empty when the source record does not state them."""

    id: str
    name: str
    hds_uid: str | None = None
    hds_object: int | None = None
    x1: int | None = None
    y1: int | None = None
    x2: int | None = None
    y2: int | None = None
    entry_actions: str | None = None
    during_actions: str | None = None
    exit_actions: str | None = None
    encoding: str | None = None
    wait_text: str | None = None
    text_boxes: list[DiagramTextBox] = Field(default_factory=list)


FsmEndKind = Literal["state", "reset", "recovery", "interrupt", "unresolved"]
FsmMode = Literal["in", "out", "local", "unknown"]
FsmRole = Literal["clock", "reset", "enable", "data", "unknown"]
FsmScheme = Literal["clocked", "combinational"]


class FsmPackage(APIModel):
    library_name: str
    unit_name: str


class FsmGeneric(APIModel):
    name: str
    type_text: str
    default_text: str | None = None


class FsmSignal(APIModel):
    """One row of the state-machine interface table. Geometry is not included."""

    name: str
    type_text: str
    range_text: str | None = None
    mode: FsmMode
    role: FsmRole
    expression: str | None = None
    scheme: FsmScheme | None = None
    default_text: str | None = None
    reset_text: str | None = None
    order: int


class FsmMachine(APIModel):
    """Semantic controls copied from the state diagram. An empty action stays empty."""

    encoding_scheme: int | None = None
    next_state_clocking: int | None = None
    reset_mode: int | None = None
    enable_before_reset: int | None = None
    controls_agree: bool = True
    clock_suffix: str | None = None
    state_order: list[int] = Field(default_factory=list)
    declarations: str | None = None
    concurrent: str | None = None
    packages: list[FsmPackage] = Field(default_factory=list)
    generics: list[FsmGeneric] = Field(default_factory=list)
    signals: list[FsmSignal] = Field(default_factory=list)


class DiagramTransition(APIModel):
    id: str
    hds_uid: str | None = None
    hds_object: int | None = None
    start_state_id: str | None = None
    end_state_id: str | None = None
    start_kind: FsmEndKind | None = None
    end_kind: FsmEndKind | None = None
    start_object: int | None = None
    end_object: int | None = None
    condition: str | None = None
    actions: str | None = None
    priority: str | None = None
    points: list[Point] = Field(default_factory=list)
    text_boxes: list[DiagramTextBox] = Field(default_factory=list)


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
    fsm: FsmMachine | None = None
    parse_status: ParseStatus
    instances: list[DiagramInstance] = Field(default_factory=list)
    states: list[DiagramState] = Field(default_factory=list)
    transitions: list[DiagramTransition] = Field(default_factory=list)
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


class GenericOverride(APIModel):
    name: str
    value: str

    @field_validator("name")
    @classmethod
    def identifier(cls, value: str) -> str:
        if re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", value) is None:
            raise ValueError("A generic name must be a VHDL identifier.")
        return value

    @field_validator("value")
    @classmethod
    def one_token(cls, value: str) -> str:
        if re.fullmatch(r"-?[A-Za-z0-9_\".]+", value) is None:
            raise ValueError("A generic value must be one token, without spaces.")
        return value


def valid_stop_time(value: str) -> bool:
    match = re.fullmatch(r"(\d+(?:\.\d+)?)(fs|ps|ns|us|ms|sec|min|hr)", value)
    if match is None:
        return False
    return float(match.group(1)) > 0


class SimulationConfig(APIModel):
    """Project simulation settings. Graphical preferences stay in ui.json.

    ``gtkw_path`` is an optional GTKWave save file for this configuration.
    The GTKWave executable is local tool configuration, not this object.
    """

    testbench_unit_id: str = ""
    stop_time: str = "1us"
    waveform_format: Literal["ghw", "vcd"] = "ghw"
    generic_overrides: list[GenericOverride] = Field(default_factory=list)
    gtkw_path: str = ""

    @field_validator("gtkw_path")
    @classmethod
    def gtkw_path_is_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("stop_time")
    @classmethod
    def stop_time_is_a_duration(cls, value: str) -> str:
        if not valid_stop_time(value):
            raise ValueError("Stop time must be a positive number and a unit, such as 1us.")
        return value


class FpgaBuildConfig(APIModel):
    """FPGA build settings. The testbench and the hierarchy root are not used.

    ``vhdl_standard`` and ``library_profile`` stay on the project. The board
    part is stored only when it is named; an empty part is not filled in.
    """

    top_unit_id: str = ""
    board_id: str = ""
    part: str = ""
    xdc_paths: list[str] = Field(default_factory=list)
    target: Literal["synthesis", "bitstream"] = "synthesis"
    toolchain: Literal["vivado", "opensource"] = "vivado"

    @field_validator("part", "board_id", "top_unit_id")
    @classmethod
    def strip_choice(cls, value: str) -> str:
        return value.strip()

    @field_validator("xdc_paths")
    @classmethod
    def strip_paths(cls, value: list[str]) -> list[str]:
        return [item.strip() for item in value if isinstance(item, str)]


class FpgaProgramRequest(APIModel):
    """An explicit request to program one device from one scan.

    ``confirm`` must be true. The server does not choose a device when this
    field is omitted.
    """

    scan_id: str
    device_id: str = ""
    build_id: str
    confirm: bool = False

    @field_validator("scan_id", "device_id", "build_id")
    @classmethod
    def strip_program_fields(cls, value: str) -> str:
        return value.strip()


class OpenScanRequest(APIModel):
    """A JTAG detect for one interface-A serial. The first device is not opened."""

    serial: str = ""

    @field_validator("serial")
    @classmethod
    def strip_serial(cls, value: str) -> str:
        return value.strip()


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
    vhdl_standard: Literal["93", "2008"] = "93"
    library_profile: Literal["ieee", "synopsys"] = "ieee"
    simulation: SimulationConfig = Field(default_factory=SimulationConfig)
    fpga: FpgaBuildConfig = Field(default_factory=FpgaBuildConfig)
    libraries: list[Library] = Field(default_factory=list)
    design_units: list[DesignUnit] = Field(default_factory=list)
    diagrams: list[DiagramDocument] = Field(default_factory=list)


class HealthResponse(APIModel):
    status: Literal["ok"]
    service: str
    version: str
    python: str
    ghdl: str | None = None
    gtkwave: str | None = None
    vivado: str | None = None


class SourceText(APIModel):
    path: str
    start_line: int = Field(ge=1)
    end_line: int = Field(ge=1)
    text: str
    truncated: bool
    language: Language
