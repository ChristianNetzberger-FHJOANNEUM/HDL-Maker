"""Copy an imported block diagram into an editable studio document.

The import remains the immutable reference. Object ids in the copy are new
and then stay fixed for the life of the file. Nets and wire geometry are
separate lists: several wires may belong to one net, and a wire keeps its
own points and slice.
"""

from __future__ import annotations

from app.editing.validate import connection_checks, described_width
from app.identity import new_id
from app.models.design import DesignUnit, Diagnostic, DiagramDocument, DiagramPort, Point
from app.models.editable import (
    DiagramProvenance,
    EditableBlock,
    EditableDiagram,
    EditableDiagramPort,
    EditableInstance,
    EditableJunction,
    EditableNet,
    EditablePort,
    EditableState,
    EditableTextBox,
    EditableTransition,
    EditableWire,
    LayoutFrame,
    NetEndpoint,
    WireEnd,
)


def editable_from_import(diagram: DiagramDocument, units: list[DesignUnit]) -> EditableDiagram:
    if diagram.view == "state":
        return _from_state(diagram)
    if diagram.view != "block":
        raise ValueError("Only a block diagram or a state diagram can be copied into the editor.")
    entities = _entities(diagram.library_id, units)
    instances = [_instance(item, entities) for item in diagram.instances]
    diagram_ports = [_diagram_port(item) for item in diagram.ports]
    blocks = [_block(item) for item in diagram.embedded_blocks]
    junctions = [_junction(item) for item in diagram.junctions]
    ends = _ends(instances, diagram_ports, blocks, junctions)
    nets = [
        EditableNet(
            id=new_id("net"),
            name=item.name,
            type_text=item.type_text,
            range_text=item.range_text,
            hds_object=item.hds_object,
        )
        for item in diagram.nets
    ]
    net_by_object = {item.hds_object: item for item in nets if item.hds_object is not None}
    wires: list[EditableWire] = []
    for source in diagram.wires:
        start = ends.get(source.start_object) if source.start_object is not None else None
        end = ends.get(source.end_object) if source.end_object is not None else None
        net = net_by_object.get(source.net_object) if source.net_object is not None else None
        label_box = _label_box(source.label)
        wires.append(
            EditableWire(
                id=new_id("wire"),
                net_id=net.id if net else None,
                points=[Point(x=point.x, y=point.y) for point in source.points],
                start=start,
                end=end,
                slice_text=source.slice_text,
                hds_object=source.hds_object,
                label_x=label_box[0],
                label_y=label_box[1],
                label_width=label_box[2],
                label_height=label_box[3],
                label_hidden=bool(source.label and source.label.hidden),
            )
        )
        if net is None:
            continue
        _endpoint(net, start, source.slice_text)
        _endpoint(net, end, None)
    editable = EditableDiagram(
        id=new_id("edg"),
        name=diagram.entity_name or diagram.source_path,
        entity_name=diagram.entity_name,
        architecture_name=diagram.architecture_name,
        frame=_frame(instances, diagram_ports, blocks, junctions, wires),
        provenance=DiagramProvenance(
            origin="import",
            source_diagram_id=diagram.id,
            source_path=diagram.source_path,
            source_sha256=diagram.sha256,
            library_id=diagram.library_id,
        ),
        instances=instances,
        diagram_ports=diagram_ports,
        junctions=junctions,
        nets=nets,
        wires=wires,
        embedded_blocks=blocks,
        preserved_records=list(diagram.preserved_records),
    )
    editable.checks = connection_checks(editable)
    return editable


def _from_state(diagram: DiagramDocument) -> EditableDiagram:
    checks: list[Diagnostic] = []
    states: list[EditableState] = []
    text_boxes: list[EditableTextBox] = []
    id_map: dict[str, str] = {}
    for source in diagram.states:
        if source.x1 is None or source.y1 is None or source.x2 is None or source.y2 is None:
            checks.append(
                Diagnostic(
                    severity="warning",
                    code="state_extent_missing",
                    message=f"State {source.name or source.hds_uid or source.id} has no extent and was not placed.",
                )
            )
            continue
        left, right = sorted((source.x1, source.x2))
        bottom, top = sorted((source.y1, source.y2))
        copied = EditableState(
            id=new_id("st"),
            name=source.name,
            hds_uid=source.hds_uid,
            hds_object=source.hds_object,
            x=left,
            y=top,
            width=max(right - left, 1),
            height=max(top - bottom, 1),
            entry_actions=source.entry_actions,
            during_actions=source.during_actions,
            exit_actions=source.exit_actions,
            encoding=source.encoding,
            wait_text=source.wait_text,
        )
        states.append(copied)
        id_map[source.id] = copied.id
        text_boxes.extend(_text_boxes(source.text_boxes, copied.id, checks))
    transitions: list[EditableTransition] = []
    for source in diagram.transitions:
        start = id_map.get(source.start_state_id) if source.start_state_id else None
        end = id_map.get(source.end_state_id) if source.end_state_id else None
        if source.start_state_id and start is None or source.end_state_id and end is None:
            checks.append(
                Diagnostic(
                    severity="warning",
                    code="transition_end_unplaced",
                    message=(
                        f"Transition {source.hds_uid or source.id} refers to a state that has no extent."
                    ),
                )
            )
        transitions.append(
            EditableTransition(
                id=new_id("trn"),
                hds_uid=source.hds_uid,
                hds_object=source.hds_object,
                start_state_id=start,
                end_state_id=end,
                start_kind=source.start_kind,
                end_kind=source.end_kind,
                condition=source.condition,
                actions=source.actions,
                priority=source.priority,
                points=[Point(x=point.x, y=point.y) for point in source.points],
            )
        )
        text_boxes.extend(_text_boxes(source.text_boxes, transitions[-1].id, checks))
    return EditableDiagram(
        id=new_id("edg"),
        name=diagram.entity_name or diagram.source_path,
        kind="state",
        entity_name=diagram.entity_name,
        architecture_name=diagram.architecture_name,
        state_signal_name=diagram.state_signal_name,
        fsm=diagram.fsm.model_copy(deep=True) if diagram.fsm is not None else None,
        frame=_state_frame(states, transitions, text_boxes),
        provenance=DiagramProvenance(
            origin="import",
            source_diagram_id=diagram.id,
            source_path=diagram.source_path,
            source_sha256=diagram.sha256,
            library_id=diagram.library_id,
        ),
        states=states,
        transitions=transitions,
        text_boxes=text_boxes,
        checks=checks,
        preserved_records=list(diagram.preserved_records),
    )


def _text_boxes(sources, owner_id: str, checks: list[Diagnostic]) -> list[EditableTextBox]:
    copied: list[EditableTextBox] = []
    for source in sources:
        left, right = sorted((source.x1, source.x2))
        bottom, top = sorted((source.y1, source.y2))
        width = right - left
        height = top - bottom
        if width < 1 or height < 1:
            checks.append(
                Diagnostic(
                    severity="warning",
                    code="text_box_extent_missing",
                    message=f"A {source.role} text has no area and was not placed.",
                )
            )
            continue
        copied.append(
            EditableTextBox(
                id=new_id("tbx"),
                owner_id=owner_id,
                role=source.role,
                x=left,
                y=top,
                width=width,
                height=height,
            )
        )
    return copied


def _state_frame(
    states: list[EditableState],
    transitions: list[EditableTransition],
    text_boxes: list[EditableTextBox],
) -> LayoutFrame:
    xs: list[int] = []
    ys: list[int] = []
    for state in states:
        xs.extend((state.x, state.x + state.width))
        ys.extend((state.y, state.y - state.height))
    for transition in transitions:
        for point in transition.points:
            xs.append(point.x)
            ys.append(point.y)
    for box in text_boxes:
        xs.extend((box.x, box.x + box.width))
        ys.extend((box.y, box.y - box.height))
    if not xs:
        return LayoutFrame(origin_x=0, origin_y=0, scale=1)
    origin_x = min(xs)
    origin_y = max(ys)
    span = max(max(xs) - origin_x, origin_y - min(ys), 1)
    return LayoutFrame(origin_x=origin_x, origin_y=origin_y, scale=1100 / span)


def _entities(library_id: str, units: list[DesignUnit]) -> dict[str, DesignUnit | None]:
    found: dict[str, DesignUnit | None] = {}
    for unit in units:
        if unit.library_id != library_id or unit.kind != "entity":
            continue
        key = unit.name.lower()
        if key in found:
            found[key] = None
        else:
            found[key] = unit
    return found


def _instance(source, entities: dict[str, DesignUnit | None]) -> EditableInstance:
    unit = entities.get((source.component_name or "").lower())
    ports = [_port(item, unit) for item in source.ports]
    x, y, width, height = _box(source.x1, source.y1, source.x2, source.y2)
    return EditableInstance(
        id=new_id("inst"),
        name=source.name,
        component_name=source.component_name,
        component_library=source.component_library,
        design_unit_id=unit.id if unit else None,
        x=x,
        y=y,
        width=width,
        height=height,
        hds_uid=source.hds_uid,
        hds_object=source.hds_object,
        generics=list(source.generics),
        ports=ports,
    )


def _port(source: DiagramPort, unit: DesignUnit | None) -> EditablePort:
    known = _unit_port(unit, source.name)
    type_text = source.type_text or (known.type_text if known else None)
    range_text = source.range_text or (known.range_text if known else None)
    direction = source.direction or (known.direction if known else None)
    if known and known.width_status != "unresolved":
        width, status = known.width, known.width_status
    else:
        width, status = described_width(type_text, range_text)
    return EditablePort(
        id=new_id("dport"),
        name=source.name,
        direction=direction,
        type_text=type_text,
        range_text=range_text,
        width=width,
        width_status=status,
        hds_object=source.hds_object,
        x1=source.x1,
        y1=source.y1,
        x2=source.x2,
        y2=source.y2,
    )


def _diagram_port(source: DiagramPort) -> EditableDiagramPort:
    width, status = described_width(source.type_text, source.range_text)
    x, y, box_width, box_height = _box(source.x1, source.y1, source.x2, source.y2, fallback=(0, 0, 1500, 750))
    return EditableDiagramPort(
        id=new_id("dport"),
        name=source.name,
        direction=source.direction,
        type_text=source.type_text,
        range_text=source.range_text,
        width=width,
        width_status=status,
        hds_object=source.hds_object,
        x=x,
        y=y,
        box_width=box_width,
        box_height=box_height,
    )


def _block(source) -> EditableBlock:
    x, y, width, height = _box(source.x1, source.y1, source.x2, source.y2)
    return EditableBlock(
        id=new_id("emb"),
        name=source.name,
        number=source.number,
        text=source.text or "",
        x=x,
        y=y,
        width=width,
        height=height,
        hds_object=source.hds_object,
    )


def _junction(source) -> EditableJunction:
    return EditableJunction(id=new_id("junc"), x=source.x, y=source.y, hds_object=source.hds_object)


def _ends(instances, diagram_ports, blocks, junctions) -> dict[int, WireEnd]:
    found: dict[int, WireEnd] = {}
    for instance in instances:
        for port in instance.ports:
            if port.hds_object is not None:
                found[port.hds_object] = WireEnd(kind="instance", owner_id=instance.id, port_id=port.id)
    for port in diagram_ports:
        if port.hds_object is not None:
            found[port.hds_object] = WireEnd(kind="diagram_port", owner_id=port.id, port_id=port.id)
    for block in blocks:
        if block.hds_object is not None:
            found[block.hds_object] = WireEnd(kind="embedded", owner_id=block.id)
    for junction in junctions:
        if junction.hds_object is not None:
            found[junction.hds_object] = WireEnd(kind="junction", owner_id=junction.id)
    return found


def _endpoint(net: EditableNet, end: WireEnd | None, slice_text: str | None) -> None:
    if end is None or end.kind not in {"instance", "diagram_port"} or end.port_id is None:
        return
    for current in net.endpoints:
        if current.kind == end.kind and current.owner_id == end.owner_id and current.port_id == end.port_id:
            if slice_text and not current.slice_text:
                current.slice_text = slice_text
            return
    net.endpoints.append(
        NetEndpoint(
            id=new_id("ep"),
            kind=end.kind,  # type: ignore[arg-type]
            owner_id=end.owner_id,
            port_id=end.port_id,
            slice_text=slice_text,
        )
    )


def _unit_port(unit: DesignUnit | None, name: str):
    if unit is None:
        return None
    folded = name.lower()
    return next((port for port in unit.ports if port.name.lower() == folded), None)


def _label_box(label) -> tuple[int | None, int | None, int | None, int | None]:
    if label is None:
        return None, None, None, None
    left, top, width, height = _box(label.x1, label.y1, label.x2, label.y2)
    return left, top, width, height


def _box(
    x1: int | None,
    y1: int | None,
    x2: int | None,
    y2: int | None,
    fallback: tuple[int, int, int, int] = (0, 0, 4000, 2500),
) -> tuple[int, int, int, int]:
    if x1 is None or y1 is None or x2 is None or y2 is None:
        x1, y1, x2, y2 = fallback
    left, right = sorted((x1, x2))
    bottom, top = sorted((y1, y2))
    return left, top, max(right - left, 1), max(top - bottom, 1)


def _frame(instances, diagram_ports, blocks, junctions, wires) -> LayoutFrame:
    xs: list[int] = []
    ys: list[int] = []
    for instance in instances:
        xs.extend((instance.x, instance.x + instance.width))
        ys.extend((instance.y, instance.y - instance.height))
    for port in diagram_ports:
        xs.extend((port.x, port.x + port.box_width))
        ys.extend((port.y, port.y - port.box_height))
    for block in blocks:
        xs.extend((block.x, block.x + block.width))
        ys.extend((block.y, block.y - block.height))
    for junction in junctions:
        xs.append(junction.x)
        ys.append(junction.y)
    for wire in wires:
        for point in wire.points:
            xs.append(point.x)
            ys.append(point.y)
        if wire.label_x is not None and wire.label_y is not None and wire.label_width and wire.label_height:
            xs.extend((wire.label_x, wire.label_x + wire.label_width))
            ys.extend((wire.label_y, wire.label_y - wire.label_height))
    if not xs:
        return LayoutFrame(origin_x=0, origin_y=0, scale=1)
    origin_x = min(xs)
    origin_y = max(ys)
    span = max(max(xs) - origin_x, origin_y - min(ys), 1)
    return LayoutFrame(origin_x=origin_x, origin_y=origin_y, scale=1100 / span)
