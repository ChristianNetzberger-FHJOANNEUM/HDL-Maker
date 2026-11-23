"""Semantic extract for the HDL Designer records observed in this library.

Only fields that appear in the sample ``.bd``, ``.sb``, and ``.sm`` files are
read. A record type that was not in those samples is stored whole. Placed
states and transitions are read by ``states.read_machine``.
"""

from __future__ import annotations

import json

from app.identity import new_id
from app.importers.hds.fsm_machine import read_fsm_interface
from app.importers.hds.states import read_machine
from app.importers.hds.grammar import (
    Array,
    Atom,
    HdsSyntaxError,
    Node,
    Record,
    Ref,
    atom_text,
    parse_document,
)
from app.models.design import (
    DiagramDocument,
    DiagramGeneric,
    DiagramInstance,
    DiagramJunction,
    DiagramNet,
    DiagramPort,
    DiagramWire,
    Diagnostic,
    EmbeddedBlock,
    Point,
    PreservedRecord,
)

# Record types present in hds/audio_gain/struct.bd, symbol.sb, and
# hds/audio_fifo_ctrl/fsm.sm. Types outside this set are preserved verbatim.
OBSERVED_TYPES = frozenset(
    {
        "Arc2D",
        "BdArchDeclBlock",
        "BdJunction",
        "BiTextGroup",
        "Blk",
        "BlockDiag",
        "BoundsColHdr",
        "Bundle",
        "CPTG",
        "Circle",
        "CircleInOctagon",
        "ColumnHdr",
        "CommentText",
        "CommonDM",
        "CompositeShape",
        "CompositeState",
        "ConcurrentSM",
        "CptPort",
        "CustomPolygon",
        "Decl",
        "Diamond",
        "DmPackageRef",
        "DocumentHdr",
        "EmbeddedInstance",
        "EmbeddedText",
        "Encoding",
        "EntryPoint",
        "EolColHdr",
        "ExitPoint",
        "FilterRowHdr",
        "Frame",
        "FrameSequenceNumber",
        "GenericAssociation",
        "GenericInterface",
        "GiElement",
        "GlobalConnector",
        "Grid",
        "GroupColHdr",
        "Grouping",
        "GroupingShape",
        "HdlText",
        "HdmGraphicsRef",
        "Hexagon",
        "InitColHdr",
        "Instance",
        "InterruptPoint",
        "Junction",
        "LEmptyRow",
        "LeafLogPort",
        "Line",
        "Line2D",
        "Link",
        "LogGeneric",
        "LogPort",
        "LogicalDM",
        "LogicalPort",
        "MLText",
        "MRCItem",
        "MVa",
        "MWC",
        "Machine",
        "Matrix",
        "MlTextGroup",
        "ModeColHdr",
        "NameColHdr",
        "Net",
        "OrthoPolyLine",
        "PackageList",
        "Panel",
        "Pentagon",
        "PhysicalDM",
        "PortIoBuffer",
        "PortIoIn",
        "PortIoInOut",
        "PortIoOut",
        "PortMapFrame",
        "PortSigDisplay",
        "PragmaColHdr",
        "Property",
        "RectFrame",
        "Rectangle",
        "RefLabelColHdr",
        "RefLabelRowHdr",
        "RequirementText",
        "Ripper",
        "RowExpandColHdr",
        "SaComponent",
        "Sheet",
        "SheetCol",
        "SheetRow",
        "SmClockPoint",
        "SmControlCondition",
        "SmEnablePoint",
        "SmGenChar",
        "SmLocalDecl",
        "SmProcessDecl",
        "SmRecoveryStatePoint",
        "SmResetPoint",
        "SmSignalGenStatus",
        "SmStateActionsBlock",
        "Spline",
        "State",
        "StateDiagram",
        "StateMachine",
        "SymDeclBlock",
        "Symbol",
        "SymbolBody",
        "Text",
        "TextAssociate",
        "TitleRowHdr",
        "Transition",
        "TransitionBlock",
        "TransitionPriority",
        "Triangle",
        "TripleCircle",
        "TypeColHdr",
        "VaSet",
        "VariableExpander",
        "VerilogComponent",
        "VhdlComponent",
        "WTG",
        "Wire",
        "ZoomableIcon",
        "mwParamsVisibilityOptions",
        "pair",
        "vvPair",
    }
)

_VIEW_BY_MODEL = {
    "BlockDiag": "block",
    "Symbol": "symbol",
    "StateMachine": "state",
}
_PORT_DIRECTION = {
    "PortIoIn": "in",
    "PortIoOut": "out",
    "PortIoInOut": "inout",
    "PortIoBuffer": "buffer",
}
_STOP = frozenset({"SaComponent", "EmbeddedText", "Wire", "Net", "CptPort", "LogPort"})


def extract_graphical(text: str, *, relative: str, file_hash: str, library_id: str) -> DiagramDocument:
    try:
        document = parse_document(text)
    except HdsSyntaxError as exc:
        return _empty(
            relative,
            file_hash,
            library_id,
            "unsupported",
            [
                Diagnostic(
                    severity="error",
                    code="hds_syntax",
                    message=str(exc),
                    path=relative,
                    line=exc.line,
                )
            ],
        )
    counts: dict[str, int] = {}
    preserved: list[PreservedRecord] = []
    _collect(document.fields, counts, preserved)
    model = _record(document.first("model"))
    view = _VIEW_BY_MODEL.get(model.type_name, "unknown") if model else "unknown"
    variables = _variables(model) if model else {}
    machine_name, state_signal = _machine(document.first("Header"))
    diagram = DiagramDocument(
        id=new_id("dg"),
        library_id=library_id,
        source_path=relative,
        sha256=file_hash,
        view=view,  # type: ignore[arg-type]
        format_version=_atom(document.first("DocumentHdrVersion")),
        app_version=_atom(document.first("appVersion")),
        entity_name=variables.get("entity_name") or variables.get("unit"),
        architecture_name=variables.get("arch_name"),
        machine_name=machine_name,
        state_signal_name=state_signal,
        parse_status="parsed",
        record_counts=dict(sorted(counts.items())),
        preserved_records=preserved,
    )
    if diagram.format_version not in {None, "1.1"}:
        diagram.diagnostics.append(
            Diagnostic(
                severity="warning",
                code="hds_version_differs",
                message=f"{relative} declares DocumentHdrVersion {diagram.format_version!r}. Parsing continued.",
                path=relative,
            )
        )
    if model is None:
        diagram.parse_status = "unsupported"
        diagram.diagnostics.append(
            Diagnostic(
                severity="error",
                code="hds_model_missing",
                message=f"{relative} has no model record.",
                path=relative,
            )
        )
        return diagram
    if view == "unknown":
        diagram.parse_status = "partial"
        diagram.diagnostics.append(
            Diagnostic(
                severity="warning",
                code="hds_model_unsupported",
                message=f"{relative} uses model {model.type_name}, which this importer does not map to a diagram.",
                path=relative,
            )
        )
    elif view == "block":
        _read_block(diagram, model, document.first("Header"))
    elif view == "symbol":
        _read_symbol(diagram, model)
    else:
        states, transitions, findings = read_machine(model, relative)
        machine, machine_findings = read_fsm_interface(model, document.first("Header"))
        diagram.states = states
        diagram.transitions = transitions
        diagram.fsm = machine
        diagram.diagnostics.extend(findings)
        diagram.diagnostics.extend(machine_findings)
        if any(item.severity == "warning" for item in findings):
            diagram.parse_status = "partial"
    if preserved:
        diagram.parse_status = "partial"
        names = ", ".join(sorted({item.type_name for item in preserved}))
        diagram.diagnostics.append(
            Diagnostic(
                severity="warning",
                code="hds_record_preserved",
                message=f"{relative} contains record types that are not in the observed grammar: {names}. Their fields were kept.",
                path=relative,
            )
        )
    return diagram


def _read_block(diagram: DiagramDocument, model: Record, header: Node | None) -> None:
    header_instances = {
        uid: record
        for record in _array_records(_record(header).first("instances") if _record(header) else None, "Instance")
        if (uid := _atom(record.first("uid")))
    }
    for child in _descendants(model):
        if child.type_name in _PORT_DIRECTION:
            port = _diagram_port(child, direction=_PORT_DIRECTION[child.type_name])
            if port is not None:
                diagram.ports.append(port)
        elif child.type_name == "SaComponent":
            diagram.instances.append(_instance(child, header_instances))
        elif child.type_name == "Net":
            net = _net(child)
            if net is not None:
                diagram.nets.append(net)
        elif child.type_name == "Wire":
            diagram.wires.append(_wire(child))
        elif child.type_name == "HdlText":
            block = _embedded(child)
            if block is not None:
                diagram.embedded_blocks.append(block)
        elif child.type_name == "BdJunction":
            junction = _junction(child)
            if junction is not None:
                diagram.junctions.append(junction)
    if not diagram.instances and not diagram.ports:
        diagram.parse_status = "partial"
        diagram.diagnostics.append(
            Diagnostic(
                severity="warning",
                code="block_diagram_empty",
                message=f"{diagram.source_path} parsed, and no component instances or diagram ports were found.",
                path=diagram.source_path,
            )
        )


def _read_symbol(diagram: DiagramDocument, model: Record) -> None:
    drawn: list[DiagramPort] = []
    logical: list[DiagramPort] = []
    for record in _descendants(model):
        if record.type_name == "SymbolBody":
            for child in _array_records(record.first("optionalChildren"), "CptPort"):
                port = _diagram_port(child, direction=None)
                if port is not None:
                    drawn.append(port)
        elif record.type_name == "LogPort":
            port = _diagram_port(record, direction=None)
            if port is not None:
                logical.append(port)
    diagram.ports = drawn or logical
    drawn_names = {port.name for port in drawn}
    logical_names = {port.name for port in logical}
    if drawn and logical and drawn_names != logical_names:
        diagram.parse_status = "partial"
        diagram.diagnostics.append(
            Diagnostic(
                severity="warning",
                code="symbol_port_names_differ",
                message=(
                    f"{diagram.source_path} symbol body and logical port list do not name the same ports. "
                    "The symbol body was kept."
                ),
                path=diagram.source_path,
            )
        )


def _instance(record: Record, header_instances: dict[str, Record]) -> DiagramInstance:
    uid = _atom(record.first("uid"))
    header = header_instances.get(uid) if uid else None
    name = _managed(record, "InstanceNameMgr") or (_atom(header.first("name")) if header else None) or ""
    component = _managed(record, "CptNameMgr") or (_atom(header.first("duName")) if header else None)
    library = _managed(record, "BdLibraryNameMgr") or (_atom(header.first("duLibraryName")) if header else None)
    generics = _generics(record.first("ga"))
    if not generics and header is not None:
        generics = _generics(header)
    ports: list[DiagramPort] = []
    for child in _array_records(record.first("optionalChildren"), "CptPort"):
        port = _diagram_port(child, direction=None)
        if port is not None:
            ports.append(port)
    x1, y1, x2, y2 = _extent(record.first("shape"))
    return DiagramInstance(
        id=new_id("inst"),
        name=name or f"instance_{record.object_id}",
        component_name=component,
        component_library=library,
        hds_uid=uid,
        hds_object=record.object_id,
        x1=x1,
        y1=y1,
        x2=x2,
        y2=y2,
        generics=generics,
        ports=ports,
    )


def _diagram_port(record: Record, *, direction: str | None) -> DiagramPort | None:
    decl = _decl(record)
    name = _atom(decl.first("n")) if decl else None
    if not name:
        name = _managed(record, "WireNameMgr") or _managed(record, "CptPortNameMgr")
    if not name:
        return None
    x1, y1, x2, y2 = _extent(record.first("shape"))
    return DiagramPort(
        id=new_id("dport"),
        name=name,
        direction=direction,  # type: ignore[arg-type]
        type_text=_atom(decl.first("t")) if decl else None,
        range_text=_atom(decl.first("b")) if decl else None,
        hds_uid=_atom(record.first("uid")),
        hds_object=record.object_id,
        marker_m=_marker(record),
        x1=x1,
        y1=y1,
        x2=x2,
        y2=y2,
    )


def _net(record: Record) -> DiagramNet | None:
    decl = _decl(record)
    name = _atom(decl.first("n")) if decl else None
    if not name:
        return None
    return DiagramNet(
        id=new_id("net"),
        name=name,
        type_text=_atom(decl.first("t")) if decl else None,
        range_text=_atom(decl.first("b")) if decl else None,
        hds_uid=_atom(record.first("uid")),
        hds_object=record.object_id,
    )


def _wire(record: Record) -> DiagramWire:
    points: list[Point] = []
    shape = _record(record.first("shape"))
    pts = shape.first("pts") if shape else None
    if isinstance(pts, Array):
        for item in pts.items:
            parsed = _pair(_atom(item))
            if parsed is not None:
                points.append(Point(x=parsed[0], y=parsed[1]))
    return DiagramWire(
        id=new_id("wire"),
        hds_uid=_atom(record.first("uid")),
        hds_object=record.object_id,
        start_object=_ref(record.first("start")),
        end_object=_ref(record.first("end")),
        net_object=_ref(record.first("on")),
        slice_text=_slice_text(record),
        points=points,
    )


def _embedded(record: Record) -> EmbeddedBlock | None:
    name = _managed(record, "HdlTextNameMgr")
    if not name:
        return None
    x1, y1, x2, y2 = _extent(record.first("shape"))
    return EmbeddedBlock(
        id=new_id("emb"),
        name=name,
        number=_managed(record, "HdlTextNumberMgr"),
        text=_hdl_source(record),
        hds_uid=_atom(record.first("uid")),
        hds_object=record.object_id,
        x1=x1,
        y1=y1,
        x2=x2,
        y2=y2,
    )


def _junction(record: Record) -> DiagramJunction | None:
    x1, y1, x2, y2 = _extent(record.first("shape"))
    if x1 is None or y1 is None or x2 is None or y2 is None:
        return None
    return DiagramJunction(
        id=new_id("junc"),
        hds_uid=_atom(record.first("uid")),
        hds_object=record.object_id,
        x=(x1 + x2) // 2,
        y=(y1 + y2) // 2,
    )


def _slice_text(record: Record) -> str | None:
    raw = _atom(record.first("sl"))
    if raw is None:
        return None
    folded = raw.lower()
    if "downto" in folded or " to " in folded:
        return raw.strip()
    return None


def _hdl_source(record: Record) -> str | None:
    for item in _deep(record):
        if item.type_name != "MLText":
            continue
        if _atom(item.first("tm")) != "HdlTextMgr":
            continue
        return _atom(item.first("st"))
    return None


def _deep(node: Node):
    if isinstance(node, Record):
        yield node
        for key, value in node.fields:
            if key.startswith("default"):
                continue
            yield from _deep(value)
    elif isinstance(node, Array):
        for item in node.items:
            yield from _deep(item)


def _generics(node: Node | None) -> list[DiagramGeneric]:
    record = _record(node)
    if record is None:
        return []
    elements = record.first("elements")
    if not isinstance(elements, Array):
        return []
    found: list[DiagramGeneric] = []
    for item in elements.items:
        element = _record(item)
        if element is None or element.type_name != "GiElement":
            continue
        name = _atom(element.first("name"))
        if not name:
            continue
        found.append(
            DiagramGeneric(
                name=name,
                type_text=_atom(element.first("type")),
                value=_atom(element.first("value")),
            )
        )
    return found


def _decl(record: Record) -> Record | None:
    for key in ("decl", "thePort", "port"):
        node = _record(record.first(key))
        if node is None:
            continue
        if node.type_name == "Decl":
            return node
        nested = _record(node.first("decl"))
        if nested is not None and nested.type_name == "Decl":
            return nested
    return None


def _marker(record: Record) -> int | None:
    for key in ("thePort", "port"):
        logical = _record(record.first(key))
        if logical is None:
            continue
        raw = _atom(logical.first("m"))
        if raw is None or not raw.lstrip("-").isdigit():
            return None
        return int(raw)
    return None


def _managed(record: Record, manager: str) -> str | None:
    for item in _descendants(record):
        if item.type_name != "Text":
            continue
        if _atom(item.first("tm")) == manager:
            return _atom(item.first("st"))
    return None


def _extent(node: Node | None) -> tuple[int | None, int | None, int | None, int | None]:
    record = _record(node)
    if record is None:
        return None, None, None, None
    direct = _quad(_atom(record.first("xt")))
    if direct is not None:
        return direct
    boxes = [_quad(_atom(item.first("xt"))) for item in _descendants(record)]
    present = [box for box in boxes if box is not None]
    if not present:
        return None, None, None, None
    return (
        min(box[0] for box in present),
        min(box[1] for box in present),
        max(box[2] for box in present),
        max(box[3] for box in present),
    )


def _variables(model: Record) -> dict[str, str]:
    found: dict[str, str] = {}
    for record in _descendants(model):
        if record.type_name != "vvPair":
            continue
        name = _atom(record.first("variable"))
        value = _atom(record.first("value"))
        if name and value is not None and name not in found:
            found[name] = value
    return found


def _machine(header: Node | None) -> tuple[str | None, str | None]:
    record = _record(header)
    if record is None:
        return None, None
    machine = _record(record.first("machine"))
    if machine is None:
        return None, None
    name = _atom(machine.first("name"))
    signal = _atom(machine.first("stateSignalName"))
    for child in _descendants(machine):
        if child.type_name == "Machine" and signal is None:
            signal = _atom(child.first("stateSignalName"))
            name = name or _atom(child.first("name"))
    return name, signal


def _descendants(record: Record):
    return _walk_record(record, root=True)


def _walk_record(node: Node, *, root: bool):
    if isinstance(node, Record):
        if not root and node.type_name in _STOP:
            yield node
            return
        yield node
        for key, value in node.fields:
            if key.startswith("default"):
                continue
            yield from _walk_record(value, root=False)
    elif isinstance(node, Array):
        for item in node.items:
            yield from _walk_record(item, root=False)


def _array_records(node: Node | None, type_name: str) -> list[Record]:
    if not isinstance(node, Array):
        return []
    found: list[Record] = []
    for item in node.items:
        record = _record(item)
        if record is None:
            continue
        if type_name and record.type_name != type_name:
            continue
        found.append(record)
    return found


def _collect(fields: list[tuple[str, Node]], counts: dict[str, int], preserved: list[PreservedRecord]) -> None:
    for _key, value in fields:
        _collect_node(value, counts, preserved)


def _collect_node(node: Node, counts: dict[str, int], preserved: list[PreservedRecord]) -> None:
    if isinstance(node, Array):
        for item in node.items:
            _collect_node(item, counts, preserved)
        return
    if not isinstance(node, Record):
        return
    counts[node.type_name] = counts.get(node.type_name, 0) + 1
    if node.type_name not in OBSERVED_TYPES:
        preserved.append(
            PreservedRecord(
                type_name=node.type_name,
                line=node.line,
                hds_object=node.object_id,
                payload=json.dumps(_serialize(node), ensure_ascii=False),
            )
        )
        return
    for _key, value in node.fields:
        _collect_node(value, counts, preserved)


def _serialize(node: Node):
    if isinstance(node, Atom):
        return node.text
    if isinstance(node, Ref):
        return {"ref": node.target}
    if isinstance(node, Array):
        return [_serialize(item) for item in node.items]
    return {
        "type": node.type_name,
        "object": node.object_id,
        "fields": [{"name": key, "value": _serialize(value)} for key, value in node.fields],
    }


def _empty(relative: str, file_hash: str, library_id: str, status: str, diagnostics: list[Diagnostic]) -> DiagramDocument:
    return DiagramDocument(
        id=new_id("dg"),
        library_id=library_id,
        source_path=relative,
        sha256=file_hash,
        view="unknown",
        parse_status=status,  # type: ignore[arg-type]
        diagnostics=diagnostics,
    )


def _record(node: Node | None) -> Record | None:
    return node if isinstance(node, Record) else None


def _atom(node: Node | None) -> str | None:
    return atom_text(node)


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
