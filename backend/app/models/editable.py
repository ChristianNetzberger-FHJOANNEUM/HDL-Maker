"""Editable block-diagram document.

This is the studio's own file. It is not an HDL Designer diagram and it is not
a Vue Flow graph. Imported geometry, nets, and HDL text are copied into it.
The original import stays unchanged.

Schema version stays 1. M2b adds optional fields (a created design has no
source file, a diagram can declare generics, an instance can point at another
editable design, a top-level port can carry a default). Old files still load.
Do not raise the version without a migration that rewrites existing documents.
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.models.design import (
    APIModel,
    DiagramGeneric,
    Diagnostic,
    Direction,
    Point,
    PreservedRecord,
    WidthStatus,
)

EDITABLE_SCHEMA_VERSION = 1
DiagramOrigin = Literal["import", "created"]

OwnerKind = Literal["instance", "diagram_port", "embedded", "junction"]
EndpointKind = Literal["instance", "diagram_port"]


class LayoutFrame(APIModel):
    origin_x: int
    origin_y: int
    scale: float = Field(gt=0)


class EditablePort(APIModel):
    id: str
    name: str
    direction: Direction | None = None
    type_text: str | None = None
    range_text: str | None = None
    width: int | None = Field(default=None, ge=1)
    width_status: WidthStatus = "unresolved"
    hds_object: int | None = None
    x1: int | None = None
    y1: int | None = None
    x2: int | None = None
    y2: int | None = None


class EditableInstance(APIModel):
    id: str
    name: str
    component_name: str | None = None
    component_library: str | None = None
    design_unit_id: str | None = None
    x: int
    y: int
    width: int = Field(ge=1)
    height: int = Field(ge=1)
    hds_uid: str | None = None
    hds_object: int | None = None
    child_diagram_id: str | None = None
    generics: list[DiagramGeneric] = Field(default_factory=list)
    ports: list[EditablePort] = Field(default_factory=list)


class EditableDiagramPort(APIModel):
    id: str
    name: str
    direction: Direction | None = None
    type_text: str | None = None
    range_text: str | None = None
    width: int | None = Field(default=None, ge=1)
    width_status: WidthStatus = "unresolved"
    default_text: str | None = None
    hds_object: int | None = None
    x: int
    y: int
    box_width: int = Field(ge=1)
    box_height: int = Field(ge=1)


class EditableJunction(APIModel):
    id: str
    x: int
    y: int
    hds_object: int | None = None


class EditableBlock(APIModel):
    id: str
    name: str
    number: str | None = None
    text: str = ""
    x: int
    y: int
    width: int = Field(ge=1)
    height: int = Field(ge=1)
    hds_object: int | None = None


class EditableLabel(APIModel):
    id: str
    text: str
    x: int
    y: int


class WireEnd(APIModel):
    kind: OwnerKind
    owner_id: str
    port_id: str | None = None


class EditableWire(APIModel):
    id: str
    net_id: str | None = None
    points: list[Point] = Field(default_factory=list)
    start: WireEnd | None = None
    end: WireEnd | None = None
    slice_text: str | None = None
    hds_object: int | None = None


class NetEndpoint(APIModel):
    id: str
    kind: EndpointKind
    owner_id: str
    port_id: str
    slice_text: str | None = None


class EditableNet(APIModel):
    id: str
    name: str
    type_text: str | None = None
    range_text: str | None = None
    hds_object: int | None = None
    endpoints: list[NetEndpoint] = Field(default_factory=list)


class DiagramGenericDef(APIModel):
    """A generic of the design itself. Instance values live on the instance."""

    id: str
    name: str
    type_text: str | None = None
    default_text: str | None = None


class DiagramProvenance(APIModel):
    library_id: str
    origin: DiagramOrigin = "import"
    source_diagram_id: str | None = None
    source_path: str | None = None
    source_sha256: str | None = None


class EditableDiagram(APIModel):
    schema_version: Literal[1] = EDITABLE_SCHEMA_VERSION
    id: str
    name: str
    entity_name: str | None = None
    architecture_name: str | None = None
    frame: LayoutFrame
    provenance: DiagramProvenance
    generics: list[DiagramGenericDef] = Field(default_factory=list)
    instances: list[EditableInstance] = Field(default_factory=list)
    diagram_ports: list[EditableDiagramPort] = Field(default_factory=list)
    junctions: list[EditableJunction] = Field(default_factory=list)
    nets: list[EditableNet] = Field(default_factory=list)
    wires: list[EditableWire] = Field(default_factory=list)
    embedded_blocks: list[EditableBlock] = Field(default_factory=list)
    labels: list[EditableLabel] = Field(default_factory=list)
    preserved_records: list[PreservedRecord] = Field(default_factory=list)
    checks: list[Diagnostic] = Field(default_factory=list)


class EditableSummary(APIModel):
    id: str
    name: str
    library_id: str
    origin: DiagramOrigin = "import"
    source_diagram_id: str | None = None
    source_path: str | None = None
    entity_name: str | None = None
