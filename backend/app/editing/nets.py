"""Net identity for an editable diagram.

Connecting two ports that already belong to different nets does not merge them.
The caller has to choose a surviving net and call ``merge_nets`` first.
Splitting moves one HDL endpoint onto a new net and drops wires that would
otherwise join the two nets.
"""

from __future__ import annotations

from typing import Literal

from app.identity import new_id
from app.models.design import Point
from app.models.editable import EditableDiagram, EditableNet, EditableWire, NetEndpoint, WireEnd

EndKind = Literal["instance", "diagram_port"]
WhichEnd = Literal["start", "end"]


class NetChoiceRequired(Exception):
    """The two ports are already on different nets. Nothing was changed."""

    def __init__(self, left_id: str, right_id: str) -> None:
        self.left_id = left_id
        self.right_id = right_id
        super().__init__(left_id)


def connect_ports(
    diagram: EditableDiagram,
    left: tuple[EndKind, str, str],
    right: tuple[EndKind, str, str],
    slice_text: str | None = None,
) -> EditableWire:
    if left == right:
        raise ValueError("A port cannot be connected to itself.")
    net_left = _net_of(diagram, left)
    net_right = _net_of(diagram, right)
    if net_left is not None and net_right is not None and net_left.id != net_right.id:
        raise NetChoiceRequired(net_left.id, net_right.id)
    net = net_left or net_right
    if net is None:
        net = EditableNet(id=new_id("net"), name=_net_name(diagram), endpoints=[])
        diagram.nets.append(net)
    _add_endpoint(net, left, slice_text if left != right else None)
    _add_endpoint(net, right, None)
    if slice_text:
        for endpoint in net.endpoints:
            if (endpoint.kind, endpoint.owner_id, endpoint.port_id) == left:
                endpoint.slice_text = slice_text
    wire = EditableWire(
        id=new_id("wire"),
        net_id=net.id,
        points=_elbow(_center(diagram, left), _center(diagram, right)),
        start=WireEnd(kind=left[0], owner_id=left[1], port_id=left[2]),
        end=WireEnd(kind=right[0], owner_id=right[1], port_id=right[2]),
        slice_text=slice_text,
    )
    diagram.wires.append(wire)
    return wire


def merge_nets(diagram: EditableDiagram, keep_id: str, drop_id: str) -> None:
    """Move every endpoint and wire from ``drop_id`` onto ``keep_id``.

    The surviving net keeps its own type and range. The other net's type is
    not copied and is not combined.
    """
    if keep_id == drop_id:
        return
    keep = _require_net(diagram, keep_id)
    drop = _require_net(diagram, drop_id)
    present = {(item.kind, item.owner_id, item.port_id) for item in keep.endpoints}
    for endpoint in drop.endpoints:
        key = (endpoint.kind, endpoint.owner_id, endpoint.port_id)
        if key not in present:
            keep.endpoints.append(endpoint)
            present.add(key)
    for wire in diagram.wires:
        if wire.net_id == drop_id:
            wire.net_id = keep_id
    diagram.nets = [net for net in diagram.nets if net.id != drop_id]


def split_endpoint(diagram: EditableDiagram, wire_id: str, which: WhichEnd) -> EditableNet:
    """Move one end of a wire onto a new net and delete wires that crossed the cut."""
    wire = next((item for item in diagram.wires if item.id == wire_id), None)
    if wire is None:
        raise ValueError("Wire not found.")
    end = wire.start if which == "start" else wire.end
    if end is None or end.port_id is None or end.kind not in ("instance", "diagram_port"):
        raise ValueError("This end is not an HDL port.")
    net = next((item for item in diagram.nets if item.id == wire.net_id), None)
    if net is None or len(net.endpoints) < 2:
        raise ValueError("This net has nothing to split.")
    key = (end.kind, end.owner_id, end.port_id)
    moved = [item for item in net.endpoints if (item.kind, item.owner_id, item.port_id) == key]
    if not moved:
        raise ValueError("This end is not on the wire's net.")
    net.endpoints = [item for item in net.endpoints if (item.kind, item.owner_id, item.port_id) != key]
    fresh = EditableNet(id=new_id("net"), name=_net_name(diagram), endpoints=list(moved))
    diagram.nets.append(fresh)
    remaining = {(item.kind, item.owner_id, item.port_id) for item in net.endpoints}
    kept: list[EditableWire] = []
    for item in diagram.wires:
        if item.net_id != net.id:
            kept.append(item)
            continue
        if not _wire_touches(item, key):
            kept.append(item)
            continue
        if _crosses(item, key, remaining):
            continue
        item.net_id = fresh.id
        kept.append(item)
    diagram.wires = kept
    if not net.endpoints and not any(item.net_id == net.id for item in diagram.wires):
        diagram.nets = [item for item in diagram.nets if item.id != net.id]
    return fresh


def _net_of(diagram: EditableDiagram, end: tuple[EndKind, str, str]) -> EditableNet | None:
    return next(
        (
            net
            for net in diagram.nets
            if any((item.kind, item.owner_id, item.port_id) == end for item in net.endpoints)
        ),
        None,
    )


def _require_net(diagram: EditableDiagram, net_id: str) -> EditableNet:
    net = next((item for item in diagram.nets if item.id == net_id), None)
    if net is None:
        raise ValueError("Net not found.")
    return net


def _add_endpoint(net: EditableNet, end: tuple[EndKind, str, str], slice_text: str | None) -> None:
    if any((item.kind, item.owner_id, item.port_id) == end for item in net.endpoints):
        return
    net.endpoints.append(
        NetEndpoint(id=new_id("ep"), kind=end[0], owner_id=end[1], port_id=end[2], slice_text=slice_text)
    )


def _net_name(diagram: EditableDiagram) -> str:
    used = {net.name for net in diagram.nets}
    number = len(diagram.nets) + 1
    while f"n_{number}" in used:
        number += 1
    return f"n_{number}"


def _wire_touches(wire: EditableWire, key: tuple[str, str, str]) -> bool:
    return any(_end_key(end) == key for end in (wire.start, wire.end))


def _crosses(wire: EditableWire, moved: tuple[str, str, str], remaining: set[tuple[str, str, str]]) -> bool:
    for end in (wire.start, wire.end):
        key = _end_key(end)
        if key is None or key == moved:
            continue
        if key in remaining:
            return True
    return False


def _end_key(end: WireEnd | None) -> tuple[str, str, str] | None:
    if end is None or end.port_id is None or end.kind not in ("instance", "diagram_port"):
        return None
    return (end.kind, end.owner_id, end.port_id)


def _center(diagram: EditableDiagram, end: tuple[EndKind, str, str]) -> tuple[int, int]:
    kind, owner, port_id = end
    if kind == "diagram_port":
        port = next((item for item in diagram.diagram_ports if item.id == owner), None)
        if port is None:
            return (0, 0)
        return (port.x + port.box_width // 2, port.y - port.box_height // 2)
    instance = next((item for item in diagram.instances if item.id == owner), None)
    if instance is None:
        return (0, 0)
    port = next((item for item in instance.ports if item.id == port_id), None)
    outgoing = port is not None and port.direction in {"out", "buffer"}
    return (instance.x + instance.width if outgoing else instance.x, instance.y - instance.height // 2)


def _elbow(start: tuple[int, int], end: tuple[int, int]) -> list[Point]:
    return [Point(x=start[0], y=start[1]), Point(x=start[0], y=end[1]), Point(x=end[0], y=end[1])]
