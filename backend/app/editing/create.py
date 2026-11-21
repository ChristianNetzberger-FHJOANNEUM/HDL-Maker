"""Build a new editable design and its interface.

Top-level ports and generics are part of the design, not decorations. A port
width is filled in only when the type or range states it.
"""

from __future__ import annotations

from app.editing.validate import described_width
from app.identity import new_id
from app.models.design import DiagramGeneric, Direction
from app.models.editable import (
    DiagramGenericDef,
    DiagramProvenance,
    EditableDiagram,
    EditableDiagramPort,
    EditableInstance,
    EditablePort,
    LayoutFrame,
)


def new_diagram(name: str, library_id: str) -> EditableDiagram:
    title = name.strip()
    return EditableDiagram(
        id=new_id("edg"),
        name=title,
        entity_name=title,
        architecture_name=None,
        frame=LayoutFrame(origin_x=0, origin_y=0, scale=0.05),
        provenance=DiagramProvenance(library_id=library_id, origin="created"),
    )


def add_generic(diagram: EditableDiagram, name: str, type_text: str | None, default_text: str | None) -> DiagramGenericDef:
    item = DiagramGenericDef(
        id=new_id("gen"),
        name=name.strip(),
        type_text=_blank(type_text),
        default_text=_blank(default_text),
    )
    diagram.generics.append(item)
    return item


def add_interface_port(
    diagram: EditableDiagram,
    name: str,
    direction: Direction | None,
    type_text: str | None,
    range_text: str | None = None,
    default_text: str | None = None,
) -> EditableDiagramPort:
    width, status = described_width(type_text, range_text)
    index = len(diagram.diagram_ports)
    outgoing = direction in {"out", "buffer"}
    port = EditableDiagramPort(
        id=new_id("port"),
        name=name.strip(),
        direction=direction,
        type_text=_blank(type_text),
        range_text=_blank(range_text),
        width=width,
        width_status=status,
        default_text=_blank(default_text),
        x=diagram.frame.origin_x + (28000 if outgoing else 0),
        y=diagram.frame.origin_y - index * 4000,
        box_width=6400,
        box_height=1600,
    )
    diagram.diagram_ports.append(port)
    return port


def add_instance(
    diagram: EditableDiagram,
    *,
    component_name: str | None,
    component_library: str | None,
    design_unit_id: str | None,
    child_diagram_id: str | None,
    ports: list[EditablePort],
    generics: list[DiagramGeneric],
) -> EditableInstance:
    height = max(3000, len(ports) * 900)
    right = diagram.frame.origin_x
    for item in diagram.instances:
        right = max(right, item.x + item.width)
    instance = EditableInstance(
        id=new_id("inst"),
        name=_instance_name(diagram),
        component_name=component_name,
        component_library=component_library,
        design_unit_id=design_unit_id,
        child_diagram_id=child_diagram_id,
        x=right + 2000,
        y=diagram.frame.origin_y,
        width=9000,
        height=height,
        generics=generics,
        ports=ports,
    )
    diagram.instances.append(instance)
    return instance


def _instance_name(diagram: EditableDiagram) -> str:
    used = {item.name for item in diagram.instances}
    number = 0
    while f"U_{number}" in used:
        number += 1
    return f"U_{number}"


def _blank(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None
