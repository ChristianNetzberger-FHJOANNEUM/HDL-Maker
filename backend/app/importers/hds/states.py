"""Read placed states and transitions from an HDL Designer state diagram.

A record without ``uid`` is a palette prototype. It is reported and is not
placed. Missing names, conditions, actions, encodings, and extents stay empty.
"""

from __future__ import annotations

from app.identity import new_id
from app.importers.hds.grammar import Array, Node, Record, Ref, atom_text
from app.models.design import DiagramState, DiagramTextBox, DiagramTransition, Diagnostic, FsmEndKind, Point


def read_machine(
    model: Record,
    relative: str,
) -> tuple[list[DiagramState], list[DiagramTransition], list[Diagnostic]]:
    diagnostics: list[Diagnostic] = []
    states: list[DiagramState] = []
    pending: list[tuple[Record, DiagramTransition]] = []
    by_object: dict[int, DiagramState] = {}
    objects = {record.object_id: record for record in _walk(model) if record.object_id is not None}
    for record in _walk(model):
        if record.type_name == "State":
            _take_state(record, relative, states, by_object, diagnostics)
        elif record.type_name == "Transition":
            _take_transition(record, relative, pending, diagnostics)
    by_name: dict[str, DiagramState | None] = {}
    for state in states:
        if not state.name:
            continue
        if state.name in by_name:
            by_name[state.name] = None
        else:
            by_name[state.name] = state
    transitions: list[DiagramTransition] = []
    for record, transition in pending:
        _bind(record, transition, objects, by_object, by_name, relative, diagnostics)
        transitions.append(transition)
    return states, transitions, diagnostics


def _take_state(
    record: Record,
    relative: str,
    states: list[DiagramState],
    by_object: dict[int, DiagramState],
    diagnostics: list[Diagnostic],
) -> None:
    uid = atom_text(record.first("uid"))
    name = _label(record)
    if not uid:
        shown = name or "unnamed"
        diagnostics.append(
            Diagnostic(
                severity="info",
                code="state_prototype_not_placed",
                message=(
                    f"{relative} contains a State record without a uid ({shown}). "
                    "It is a palette prototype and was not placed."
                ),
                path=relative,
                line=record.line,
            )
        )
        return
    box = _shape_box(record)
    if box is None:
        diagnostics.append(
            Diagnostic(
                severity="warning",
                code="state_extent_missing",
                message=f"{relative} state {name or uid} has a uid and no shape extent.",
                path=relative,
                line=record.line,
            )
        )
    if not name:
        diagnostics.append(
            Diagnostic(
                severity="warning",
                code="state_name_missing",
                message=f"{relative} state {uid} has a uid and no name text.",
                path=relative,
                line=record.line,
            )
        )
    actions = _record(record.first("actionBlk"))
    state = DiagramState(
        id=new_id("st"),
        name=name or "",
        hds_uid=uid,
        hds_object=record.object_id,
        x1=box[0] if box else None,
        y1=box[1] if box else None,
        x2=box[2] if box else None,
        y2=box[3] if box else None,
        entry_actions=_ml(actions, "entryActions"),
        during_actions=_ml(actions, "inActions"),
        exit_actions=_ml(actions, "exitActions"),
        encoding=_ml(record, "encoding"),
        wait_text=_ml(record, "wait"),
        text_boxes=_text_boxes(
            actions,
            (("entryActions", "entry"), ("inActions", "during"), ("exitActions", "exit")),
            relative,
            diagnostics,
            record.line,
        ),
    )
    states.append(state)
    if record.object_id is None:
        return
    if record.object_id in by_object:
        diagnostics.append(
            Diagnostic(
                severity="warning",
                code="state_object_repeated",
                message=f"{relative} uses object {record.object_id} for more than one placed state.",
                path=relative,
                line=record.line,
            )
        )
        return
    by_object[record.object_id] = state


def _take_transition(
    record: Record,
    relative: str,
    pending: list[tuple[Record, DiagramTransition]],
    diagnostics: list[Diagnostic],
) -> None:
    uid = atom_text(record.first("uid"))
    if not uid:
        diagnostics.append(
            Diagnostic(
                severity="info",
                code="transition_prototype_not_placed",
                message=(
                    f"{relative} contains a Transition record without a uid. "
                    "It is a palette prototype and was not placed."
                ),
                path=relative,
                line=record.line,
            )
        )
        return
    condition, action_text = _condition_and_actions(record, relative, diagnostics)
    pending.append(
        (
            record,
            DiagramTransition(
                id=new_id("trn"),
                hds_uid=uid,
                hds_object=record.object_id,
                start_object=_ref(record.first("start")),
                end_object=_ref(record.first("end")),
                condition=condition,
                actions=action_text,
                priority=_priority(record),
                points=_shape_points(record),
                text_boxes=_text_boxes(
                    _record(record.first("tb")),
                    (("condition", "condition"), ("actions", "actions")),
                    relative,
                    diagnostics,
                    record.line,
                ),
            ),
        )
    )


_ANCHORS = {
    "SmResetPoint": "reset",
    "SmRecoveryStatePoint": "recovery",
    "InterruptPoint": "interrupt",
}


def _bind(
    record: Record,
    transition: DiagramTransition,
    objects: dict[int, Record],
    by_object: dict[int, DiagramState],
    by_name: dict[str, DiagramState | None],
    relative: str,
    diagnostics: list[Diagnostic],
) -> None:
    start, start_kind = _endpoint(
        transition.start_object, objects, by_object, by_name, relative, diagnostics, record.line, transition.hds_uid
    )
    end, end_kind = _endpoint(
        transition.end_object, objects, by_object, by_name, relative, diagnostics, record.line, transition.hds_uid
    )
    transition.start_state_id = start.id if start else None
    transition.end_state_id = end.id if end else None
    transition.start_kind = start_kind
    transition.end_kind = end_kind


def _endpoint(
    object_id: int | None,
    objects: dict[int, Record],
    by_object: dict[int, DiagramState],
    by_name: dict[str, DiagramState | None],
    relative: str,
    diagnostics: list[Diagnostic],
    line: int,
    uid: str | None,
) -> tuple[DiagramState | None, FsmEndKind | None]:
    if object_id is None:
        return None, None
    direct = by_object.get(object_id)
    if direct is not None:
        return direct, "state"
    target = objects.get(object_id)
    if target is None:
        diagnostics.append(
            Diagnostic(
                severity="warning",
                code="transition_end_unresolved",
                message=f"{relative} transition {uid} refers to object {object_id}, which is not in the file.",
                path=relative,
                line=line,
            )
        )
        return None, "unresolved"
    if target.type_name == "Link":
        name = _label(target)
        state = by_name.get(name) if name else None
        if state is None:
            diagnostics.append(
                Diagnostic(
                    severity="warning",
                    code="transition_end_unresolved",
                    message=(
                        f"{relative} transition {uid} ends at a Link named {name!r}, "
                        "which does not match one placed state."
                    ),
                    path=relative,
                    line=line,
                )
            )
            return None, "unresolved"
        return state, "state"
    anchor = _ANCHORS.get(target.type_name)
    if anchor is not None:
        diagnostics.append(
            Diagnostic(
                severity="info",
                code="transition_anchor",
                message=(
                    f"{relative} transition {uid} meets a {target.type_name} at object {object_id}. "
                    "That end is not a state."
                ),
                path=relative,
                line=line,
            )
        )
        return None, anchor
    diagnostics.append(
        Diagnostic(
            severity="warning",
            code="transition_end_unresolved",
            message=(
                f"{relative} transition {uid} meets {target.type_name} at object {object_id}, "
                "which is not a state or a link."
            ),
            path=relative,
            line=line,
        )
    )
    return None, "unresolved"


def _condition_and_actions(
    record: Record,
    relative: str,
    diagnostics: list[Diagnostic],
) -> tuple[str | None, str | None]:
    atom = atom_text(record.first("cond"))
    block = _record(record.first("tb"))
    written = _ml(_record(block.first("condition")) if block else None, "st")
    if written is None and block is not None:
        written = _ml(block, "condition")
    actions = _ml(block, "actions") if block else None
    if atom is not None and written is not None and atom != written:
        diagnostics.append(
            Diagnostic(
                severity="info",
                code="transition_condition_differs",
                message=(
                    f"{relative} transition stores cond {atom!r} and condition text {written!r}. "
                    "The cond atom is kept as the condition."
                ),
                path=relative,
                line=record.line,
            )
        )
    return (atom if atom is not None else written), actions


def _priority(record: Record) -> str | None:
    block = _record(record.first("tp"))
    text = _record(block.first("pr")) if block else None
    return atom_text(text.first("st")) if text else None


def _text_boxes(
    container: Record | None,
    roles: tuple[tuple[str, str], ...],
    relative: str,
    diagnostics: list[Diagnostic],
    line: int,
) -> list[DiagramTextBox]:
    if container is None:
        return []
    shape = _record(container.first("shape"))
    fallback = _quad(atom_text(shape.first("xt"))) if shape else None
    fallback_hidden = _hidden(shape) if shape else True
    boxes: list[DiagramTextBox] = []
    for key, role in roles:
        placed = _place_text(
            _record(container.first(key)),
            role,
            fallback if not fallback_hidden else None,
            relative,
            diagnostics,
            line,
        )
        if placed is not None:
            boxes.append(placed)
    return boxes


def _place_text(
    text: Record | None,
    role: str,
    fallback: tuple[int, int, int, int] | None,
    relative: str,
    diagnostics: list[Diagnostic],
    line: int,
) -> DiagramTextBox | None:
    if text is None:
        return None
    body = atom_text(text.first("st"))
    if not body:
        return None
    if _hidden(text):
        diagnostics.append(
            Diagnostic(
                severity="info",
                code="text_box_hidden",
                message=f"{relative} keeps a hidden {role} text and does not draw that rectangle.",
                path=relative,
                line=line,
            )
        )
        return None
    extent = _quad(atom_text(text.first("xt")))
    if not _positive(extent):
        extent = fallback if _positive(fallback) else None
    if extent is None:
        diagnostics.append(
            Diagnostic(
                severity="warning",
                code="text_box_extent_missing",
                message=f"{relative} states a {role} text and no rectangle with an area.",
                path=relative,
                line=line,
            )
        )
        return None
    return DiagramTextBox(id=new_id("tbx"), role=role, x1=extent[0], y1=extent[1], x2=extent[2], y2=extent[3])


def _hidden(record: Record) -> bool:
    visual = _record(record.first("va"))
    return atom_text(visual.first("isHidden")) == "1" if visual else False


def _positive(box: tuple[int, int, int, int] | None) -> bool:
    if box is None:
        return False
    return abs(box[2] - box[0]) > 0 and abs(box[3] - box[1]) > 0


def _label(record: Record) -> str | None:
    named = record.first("name")
    direct = atom_text(named)
    if direct:
        return direct
    text = _record(named)
    if text is not None and text.type_name == "TextAssociate":
        text = _record(text.first("text"))
    if text is None:
        return None
    return atom_text(text.first("st"))


def _ml(record: Record | None, key: str) -> str | None:
    if record is None:
        return None
    child = record.first(key)
    if isinstance(child, Record):
        return atom_text(child.first("st"))
    return atom_text(child)


def _shape_box(record: Record) -> tuple[int, int, int, int] | None:
    shape = _record(record.first("shape"))
    if shape is None:
        return None
    return _quad(atom_text(shape.first("xt")))


def _shape_points(record: Record) -> list[Point]:
    shape = _record(record.first("shape"))
    pts = shape.first("pts") if shape else None
    points: list[Point] = []
    if isinstance(pts, Array):
        for item in pts.items:
            parsed = _pair(atom_text(item))
            if parsed is not None:
                points.append(Point(x=parsed[0], y=parsed[1]))
    return points


def _walk(node: Node):
    if isinstance(node, Record):
        yield node
        for _, value in node.fields:
            yield from _walk(value)
    elif isinstance(node, Array):
        for item in node.items:
            yield from _walk(item)


def _record(node: Node | None) -> Record | None:
    return node if isinstance(node, Record) else None


def _ref(node: Node | None) -> int | None:
    return node.target if isinstance(node, Ref) else None


def _pair(text: str | None) -> tuple[int, int] | None:
    if not text or text.count(",") != 1:
        return None
    left, right = text.split(",")
    if not _integer(left) or not _integer(right):
        return None
    return int(left), int(right)


def _quad(text: str | None) -> tuple[int, int, int, int] | None:
    if not text or text.count(",") != 3:
        return None
    parts = text.split(",")
    if not all(_integer(part) for part in parts):
        return None
    return int(parts[0]), int(parts[1]), int(parts[2]), int(parts[3])


def _integer(text: str) -> bool:
    return bool(text) and text.lstrip("-").isdigit()
