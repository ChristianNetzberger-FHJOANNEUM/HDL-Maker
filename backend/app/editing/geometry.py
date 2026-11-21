"""Move a diagram object without folding its orthogonal wires into new nets.

A wire's points are geometry. The net id on that wire is the signal. Moving
an instance updates the attached end and the next bend. It does not retarget
the net.
"""

from __future__ import annotations

from app.models.design import Point
from app.models.editable import EditableDiagram, EditablePort


def translate_owner(diagram: EditableDiagram, owner_id: str, dx: int, dy: int) -> None:
    if dx == 0 and dy == 0:
        return
    _move_box(diagram, owner_id, dx, dy)
    for wire in diagram.wires:
        attached = _attached_ends(wire.start, wire.end, owner_id)
        if attached == {"start", "end"}:
            for point in wire.points:
                point.x += dx
                point.y += dy
        elif "start" in attached:
            stick_end(wire.points, at_start=True, dx=dx, dy=dy)
        elif "end" in attached:
            stick_end(wire.points, at_start=False, dx=dx, dy=dy)


def stick_end(points: list[Point], *, at_start: bool, dx: int, dy: int) -> None:
    if not points:
        return
    if len(points) == 1:
        points[0].x += dx
        points[0].y += dy
        return
    index = 0 if at_start else len(points) - 1
    neighbor = 1 if at_start else len(points) - 2
    origin = points[index]
    other = points[neighbor]
    moved = Point(x=origin.x + dx, y=origin.y + dy)
    horizontal = origin.y == other.y and origin.x != other.x
    vertical = origin.x == other.x and origin.y != other.y
    far_end = len(points) == 2
    if horizontal and far_end and moved.y != other.y:
        _insert_corner(points, at_start, moved, Point(x=other.x, y=moved.y))
        return
    if vertical and far_end and moved.x != other.x:
        _insert_corner(points, at_start, moved, Point(x=moved.x, y=other.y))
        return
    origin.x = moved.x
    origin.y = moved.y
    if far_end:
        return
    if horizontal:
        other.y = moved.y
    elif vertical:
        other.x = moved.x


def _insert_corner(points: list[Point], at_start: bool, endpoint: Point, corner: Point) -> None:
    if at_start:
        points[0] = endpoint
        points.insert(1, corner)
        return
    points[-1] = endpoint
    points.insert(len(points) - 1, corner)


def _attached_ends(start, end, owner_id: str) -> set[str]:
    found: set[str] = set()
    if start is not None and start.owner_id == owner_id:
        found.add("start")
    if end is not None and end.owner_id == owner_id:
        found.add("end")
    return found


def _move_box(diagram: EditableDiagram, owner_id: str, dx: int, dy: int) -> None:
    for instance in diagram.instances:
        if instance.id != owner_id:
            continue
        instance.x += dx
        instance.y += dy
        for port in instance.ports:
            _shift_port(port, dx, dy)
        return
    for port in diagram.diagram_ports:
        if port.id == owner_id:
            port.x += dx
            port.y += dy
            return
    for block in diagram.embedded_blocks:
        if block.id == owner_id:
            block.x += dx
            block.y += dy
            return
    for junction in diagram.junctions:
        if junction.id == owner_id:
            junction.x += dx
            junction.y += dy
            return
    for label in diagram.labels:
        if label.id == owner_id:
            label.x += dx
            label.y += dy
            return


def _shift_port(port: EditablePort, dx: int, dy: int) -> None:
    if port.x1 is not None:
        port.x1 += dx
    if port.x2 is not None:
        port.x2 += dx
    if port.y1 is not None:
        port.y1 += dy
    if port.y2 is not None:
        port.y2 += dy
