"""Turn editable block diagrams into one structural netlist.

Vue Flow nodes, wire points, frame scale, and text-box rectangles are not
read. A missing type, direction, width, or default stays missing.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from app.hdl.fsm import fsm_design
from app.hdl.ir import IrAssoc, IrDesign, IrGeneric, IrInstance, IrPort, IrSignal, IrText
from app.hdl.vhdl import VhdlStandard
from app.models.design import Diagnostic
from app.models.editable import (
    EditableDiagram,
    EditableDiagramPort,
    EditableInstance,
    EditableNet,
    EditablePort,
    NetEndpoint,
)
from app.storage.diagram_store import DiagramStoreError

Loader = Callable[[str], EditableDiagram]
Outcome = Literal["ok", "open", "error"]

_IDENTIFIER = re.compile(r"^[A-Za-z][A-Za-z0-9_]*\Z")
_DECL = re.compile(
    r"^(library|use|signal|constant|type|subtype|component|function|procedure|alias|attribute|file|package|shared|impure|pure)\b",
    re.IGNORECASE,
)
_CONCURRENT = re.compile(
    r"^(?:process|postponed|assert|with|block)\b|<=|:\s*(?:entity|component)\b|:\s*[A-Za-z_]",
    re.IGNORECASE,
)
_PROCESS_ALL = re.compile(r"process\s*\(\s*all\s*\)", re.IGNORECASE)
_PROCESS_REGION = re.compile(r"\bprocess\b.*?\bend\s+process\b", re.IGNORECASE | re.DOTALL)
_WHEN = re.compile(r"\bwhen\b", re.IGNORECASE)
_STD_LOGIC = re.compile(r"\bstd_logic(?:_vector)?\b|\bstd_ulogic(?:_vector)?\b", re.IGNORECASE)
_NUMERIC = re.compile(r"\b(?:unsigned|signed)\b|\bnumeric_std\b", re.IGNORECASE)
_INTERFACE_GENERIC = {
    "type": "type generic",
    "package": "package generic",
    "function": "function generic",
    "procedure": "procedure generic",
}
_KEYWORDS = {
    "abs",
    "access",
    "after",
    "alias",
    "all",
    "and",
    "architecture",
    "array",
    "assert",
    "attribute",
    "begin",
    "block",
    "body",
    "buffer",
    "bus",
    "case",
    "component",
    "configuration",
    "constant",
    "disconnect",
    "downto",
    "else",
    "elsif",
    "end",
    "entity",
    "exit",
    "file",
    "for",
    "function",
    "generate",
    "generic",
    "group",
    "guarded",
    "if",
    "impure",
    "in",
    "inertial",
    "inout",
    "is",
    "label",
    "library",
    "linkage",
    "literal",
    "loop",
    "map",
    "mod",
    "nand",
    "new",
    "next",
    "nor",
    "not",
    "null",
    "of",
    "on",
    "open",
    "or",
    "others",
    "out",
    "package",
    "port",
    "postponed",
    "procedure",
    "process",
    "pure",
    "range",
    "record",
    "register",
    "reject",
    "rem",
    "report",
    "return",
    "rol",
    "ror",
    "select",
    "severity",
    "signal",
    "shared",
    "sla",
    "sll",
    "sra",
    "srl",
    "subtype",
    "then",
    "to",
    "transport",
    "type",
    "unaffected",
    "units",
    "until",
    "use",
    "variable",
    "wait",
    "when",
    "while",
    "with",
    "xnor",
    "xor",
}


@dataclass
class _Carrier:
    name: str
    slice_text: str | None
    is_signal: bool
    type_text: str | None = None
    range_text: str | None = None


@dataclass
class _NetUse:
    outcome: Outcome
    carrier: _Carrier | None = None


def analyze(
    root: EditableDiagram,
    standard: VhdlStandard,
    load: Loader,
) -> tuple[list[IrDesign], list[Diagnostic]]:
    diagnostics: list[Diagnostic] = []
    order = _dependency_order(root, load, diagnostics)
    designs: list[IrDesign] = []
    seen_names: dict[str, str] = {}
    for diagram in order:
        if diagram.kind == "state":
            design, findings = fsm_design(diagram, standard)
            diagnostics.extend(findings)
        else:
            design = _design(diagram, standard, load, diagnostics)
        if design is None:
            continue
        previous = seen_names.get(design.entity_name.casefold())
        if previous is not None:
            diagnostics.append(
                _error(
                    diagram,
                    "entity_name_duplicate",
                    f"Entity '{design.entity_name}' is already used by diagram '{previous}'.",
                )
            )
            continue
        seen_names[design.entity_name.casefold()] = diagram.id
        designs.append(design)
    return designs, diagnostics


def _dependency_order(
    root: EditableDiagram,
    load: Loader,
    diagnostics: list[Diagnostic],
) -> list[EditableDiagram]:
    order: list[EditableDiagram] = []
    seen: set[str] = set()
    stack: list[str] = []

    def visit(diagram: EditableDiagram) -> None:
        if diagram.id in stack:
            diagnostics.append(
                _error(diagram, "recursive_hierarchy", f"Design '{diagram.name}' contains itself through its instances.")
            )
            return
        if diagram.id in seen:
            return
        stack.append(diagram.id)
        if diagram.kind == "state":
            stack.pop()
            if diagram.id not in seen:
                seen.add(diagram.id)
                order.append(diagram)
            return
        for instance in diagram.instances:
            child_id = instance.child_diagram_id
            if not child_id:
                continue
            try:
                child = load(child_id)
            except DiagramStoreError:
                diagnostics.append(
                    _error(
                        diagram,
                        "missing_child",
                        f"Instance '{instance.name}' references missing design '{child_id}'.",
                    )
                )
                continue
            if child.id != child_id:
                diagnostics.append(
                    _error(
                        diagram,
                        "missing_child",
                        f"Instance '{instance.name}' resolved to a different design than '{child_id}'.",
                    )
                )
                continue
            visit(child)
        stack.pop()
        if diagram.id not in seen and diagram.kind == "block":
            seen.add(diagram.id)
            order.append(diagram)

    visit(root)
    return order


def _design(
    diagram: EditableDiagram,
    standard: VhdlStandard,
    load: Loader,
    diagnostics: list[Diagnostic],
) -> IrDesign | None:
    before = len(diagnostics)
    entity_name = (diagram.entity_name or diagram.name or "").strip()
    if not _valid_name(entity_name):
        diagnostics.append(_error(diagram, "entity_name_missing", f"Design '{diagram.name}' has no usable entity name."))
        return None
    architecture_name = (diagram.architecture_name or "").strip() or "rtl"
    if not _valid_name(architecture_name):
        diagnostics.append(
            _error(diagram, "identifier_invalid", f"Architecture name '{architecture_name}' is not a VHDL identifier.")
        )
        return None

    generics = _generics(diagram, standard, diagnostics)
    ports = _ports(diagram, standard, diagnostics)
    net_uses = {net.id: _net_use(diagram, net, standard, diagnostics) for net in diagram.nets}
    _driver_warnings(diagram, net_uses, diagnostics)
    signals = _signals(diagram, net_uses)
    instances = _instances(diagram, standard, load, net_uses, diagnostics)
    texts = _embedded(diagram, standard, diagnostics)
    _unique_names(diagram, generics, ports, signals, diagnostics)
    if any(item.severity == "error" for item in diagnostics[before:]):
        return None
    declared = "\n".join(block.text for block in texts)
    needs_std_logic = _needs(_STD_LOGIC, generics, ports, signals, declared) and "std_logic_1164" not in declared.lower()
    needs_numeric = _needs(_NUMERIC, generics, ports, signals, declared) and "numeric_std" not in declared.lower()
    return IrDesign(
        diagram_id=diagram.id,
        entity_name=entity_name,
        architecture_name=architecture_name,
        generics=tuple(generics),
        ports=tuple(ports),
        signals=tuple(signals),
        instances=tuple(instances),
        texts=tuple(texts),
        needs_std_logic=needs_std_logic,
        needs_numeric=needs_numeric,
    )


def _generics(diagram: EditableDiagram, standard: VhdlStandard, diagnostics: list[Diagnostic]) -> list[IrGeneric]:
    found: list[IrGeneric] = []
    for item in diagram.generics:
        name = item.name.strip()
        if not _valid_name(name):
            diagnostics.append(_error(diagram, "identifier_invalid", f"Generic '{item.name}' is not a VHDL identifier."))
            continue
        kind_name = (item.type_text or "").strip().lower()
        if kind_name in _INTERFACE_GENERIC:
            if standard == "93" or kind_name != "type":
                code = "vhdl93_unsupported" if standard == "93" else "construct_not_implemented"
                diagnostics.append(
                    _error(
                        diagram,
                        code,
                        f"Generic '{name}' is a VHDL-2008 {_INTERFACE_GENERIC[kind_name]}. "
                        + (
                            "VHDL-93 generation stopped."
                            if standard == "93"
                            else "That form is not implemented for VHDL-2008 yet."
                        ),
                    )
                )
                continue
            if item.default_text:
                diagnostics.append(
                    _error(
                        diagram,
                        "construct_not_implemented",
                        f"Type generic '{name}' has a default. M3a does not emit a default for a type generic.",
                    )
                )
                continue
            found.append(IrGeneric(name=name, kind="type"))
            continue
        if not item.type_text:
            diagnostics.append(
                _error(diagram, "generic_type_missing", f"Generic '{name}' has no type. No type was assumed.")
            )
            continue
        if item.default_text and _reject_actual(diagram, standard, item.default_text, f"generic '{name}'", diagnostics):
            continue
        found.append(IrGeneric(name=name, kind="value", type_text=item.type_text.strip(), default_text=item.default_text))
    return found


def _ports(diagram: EditableDiagram, standard: VhdlStandard, diagnostics: list[Diagnostic]) -> list[IrPort]:
    found: list[IrPort] = []
    for item in diagram.diagram_ports:
        port = _require_port(diagram, item.name, item.direction, item.type_text, item.range_text, diagnostics)
        if port is None:
            continue
        if item.default_text and _reject_actual(diagram, standard, item.default_text, f"port '{item.name}'", diagnostics):
            continue
        found.append(
            IrPort(
                name=port.name,
                direction=port.direction,
                type_text=port.type_text,
                range_text=item.range_text,
                default_text=item.default_text,
            )
        )
    return found


def _require_port(
    diagram: EditableDiagram,
    name: str,
    direction: str | None,
    type_text: str | None,
    range_text: str | None,
    diagnostics: list[Diagnostic],
) -> IrPort | None:
    del range_text
    clean = name.strip()
    if not _valid_name(clean):
        diagnostics.append(_error(diagram, "identifier_invalid", f"Port '{name}' is not a VHDL identifier."))
        return None
    if direction is None:
        diagnostics.append(_error(diagram, "port_direction_missing", f"Port '{clean}' has no direction. No direction was assumed."))
        return None
    if not type_text or not type_text.strip():
        diagnostics.append(_error(diagram, "port_type_missing", f"Port '{clean}' has no type. No type was assumed."))
        return None
    return IrPort(name=clean, direction=direction, type_text=type_text.strip())


def _net_use(
    diagram: EditableDiagram,
    net: EditableNet,
    standard: VhdlStandard,
    diagnostics: list[Diagnostic],
) -> _NetUse:
    diagram_ends = [item for item in net.endpoints if item.kind == "diagram_port"]
    instance_ends = [item for item in net.endpoints if item.kind == "instance"]
    if len(diagram_ends) + len(instance_ends) < 2:
        return _NetUse("open")
    if len(diagram_ends) > 1:
        diagnostics.append(
            _error(
                diagram,
                "net_has_multiple_diagram_ports",
                f"Net '{net.name}' joins more than one top-level port. No signal was invented to join them.",
            )
        )
        return _NetUse("error")
    for endpoint in net.endpoints:
        if endpoint.slice_text and _reject_actual(diagram, standard, endpoint.slice_text, f"net '{net.name}'", diagnostics):
            return _NetUse("error")
    if len(diagram_ends) == 1:
        port = _diagram_port(diagram, diagram_ends[0])
        if port is None or not _valid_name(port.name):
            diagnostics.append(
                _error(diagram, "endpoint_unresolved", f"Net '{net.name}' refers to a top-level port that is not on this design.")
            )
            return _NetUse("error")
        return _NetUse("ok", _Carrier(name=port.name.strip(), slice_text=diagram_ends[0].slice_text, is_signal=False))
    if not _valid_name(net.name):
        diagnostics.append(_error(diagram, "identifier_invalid", f"Net '{net.name}' is not a usable signal name."))
        return _NetUse("error")
    typed = _signal_type(diagram, net, diagnostics)
    if typed is None:
        return _NetUse("error")
    type_text, range_text = typed
    return _NetUse(
        "ok",
        _Carrier(name=net.name.strip(), slice_text=None, is_signal=True, type_text=type_text, range_text=range_text),
    )


def _signal_type(
    diagram: EditableDiagram,
    net: EditableNet,
    diagnostics: list[Diagnostic],
) -> tuple[str, str | None] | None:
    if net.type_text and net.type_text.strip():
        return net.type_text.strip(), net.range_text
    types: list[str] = []
    ranges: list[str | None] = []
    for endpoint in net.endpoints:
        port = _endpoint_port(diagram, endpoint)
        if port is None or not port.type_text or not port.type_text.strip():
            diagnostics.append(
                _error(
                    diagram,
                    "signal_type_missing",
                    f"Internal net '{net.name}' has no type, and a connected port does not state one. No type was assumed.",
                )
            )
            return None
        types.append(port.type_text.strip())
        ranges.append(port.range_text)
    if len(set(types)) != 1 or len(set(ranges)) != 1:
        diagnostics.append(
            _error(
                diagram,
                "signal_type_missing",
                f"Internal net '{net.name}' connects ports whose types or ranges differ. No common type was assumed.",
            )
        )
        return None
    return types[0], ranges[0]


def _signals(diagram: EditableDiagram, net_uses: dict[str, _NetUse]) -> list[IrSignal]:
    found: list[IrSignal] = []
    for net in diagram.nets:
        use = net_uses[net.id]
        carrier = use.carrier
        if use.outcome != "ok" or carrier is None or not carrier.is_signal or carrier.type_text is None:
            continue
        found.append(IrSignal(name=carrier.name, type_text=carrier.type_text, range_text=carrier.range_text))
    return found


def _driver_warnings(diagram: EditableDiagram, net_uses: dict[str, _NetUse], diagnostics: list[Diagnostic]) -> None:
    for net in diagram.nets:
        if net_uses[net.id].outcome != "ok":
            continue
        drivers = 0
        for endpoint in net.endpoints:
            port = _endpoint_port(diagram, endpoint)
            if port is None or port.direction is None:
                continue
            if endpoint.kind == "diagram_port" and port.direction in {"in", "inout"}:
                drivers += 1
            elif endpoint.kind == "instance" and port.direction in {"out", "inout", "buffer"}:
                drivers += 1
        if drivers > 1:
            diagnostics.append(
                Diagnostic(
                    severity="warning",
                    code="multiple_drivers",
                    message=f"Net '{net.name}' has more than one driver.",
                    path=diagram.id,
                )
            )


def _instances(
    diagram: EditableDiagram,
    standard: VhdlStandard,
    load: Loader,
    net_uses: dict[str, _NetUse],
    diagnostics: list[Diagnostic],
) -> list[IrInstance]:
    found: list[IrInstance] = []
    for instance in diagram.instances:
        built = _instance(diagram, instance, standard, load, net_uses, diagnostics)
        if built is not None:
            found.append(built)
    names = [item.name for item in diagram.diagram_ports] + [item.name for item in diagram.generics]
    names.extend(signal.name for signal in _signals(diagram, net_uses))
    folded = {item.casefold() for item in names}
    for instance in found:
        if not _valid_name(instance.label):
            diagnostics.append(_error(diagram, "identifier_invalid", f"Instance label '{instance.label}' is not a VHDL identifier."))
        elif instance.label.casefold() in folded:
            diagnostics.append(
                _error(diagram, "name_conflict", f"Instance label '{instance.label}' uses a name already used on this design.")
            )
        folded.add(instance.label.casefold())
    return found


def _instance(
    diagram: EditableDiagram,
    instance: EditableInstance,
    standard: VhdlStandard,
    load: Loader,
    net_uses: dict[str, _NetUse],
    diagnostics: list[Diagnostic],
) -> IrInstance | None:
    child: EditableDiagram | None = None
    if instance.child_diagram_id:
        try:
            loaded = load(instance.child_diagram_id)
        except DiagramStoreError:
            return None
        if loaded.id != instance.child_diagram_id or loaded.kind != "block":
            return None
        child = loaded
        _stale_interface(diagram, instance, child, diagnostics)
    elif not (instance.component_name or "").strip():
        diagnostics.append(
            _error(diagram, "missing_dependency", f"Instance '{instance.name}' has no child design and no component name.")
        )
        return None
    else:
        diagnostics.append(
            Diagnostic(
                severity="warning",
                code="external_unit_not_generated",
                message=(
                    f"Instance '{instance.name}' names component '{instance.component_name}'. "
                    "That design unit is not generated from a workspace diagram."
                ),
                path=diagram.id,
            )
        )
    entity_name = _child_entity(instance, child)
    if child is not None and not _valid_name(entity_name):
        return None
    if not _valid_name(entity_name):
        diagnostics.append(
            _error(diagram, "missing_dependency", f"Instance '{instance.name}' has no entity name.")
        )
        return None
    architecture = _architecture_name(child) if child is not None else None
    library_name = (instance.component_library or "").strip() or "work"
    if not _valid_name(library_name):
        diagnostics.append(
            _error(diagram, "identifier_invalid", f"Library '{instance.component_library}' is not a VHDL identifier.")
        )
        return None
    generics = _generic_map(diagram, instance, child, standard, diagnostics)
    ports = _port_map(diagram, instance, child, net_uses, diagnostics)
    return IrInstance(
        label=instance.name,
        library_name=library_name,
        entity_name=entity_name,
        architecture_name=architecture,
        generics=tuple(generics),
        ports=tuple(ports),
    )


def _child_entity(instance: EditableInstance, child: EditableDiagram | None) -> str:
    if child is None:
        return (instance.component_name or "").strip()
    return (child.entity_name or child.name or "").strip()


def _architecture_name(diagram: EditableDiagram) -> str:
    return (diagram.architecture_name or "").strip() or "rtl"


def _stale_interface(
    diagram: EditableDiagram,
    instance: EditableInstance,
    child: EditableDiagram,
    diagnostics: list[Diagnostic],
) -> None:
    child_entity = (child.entity_name or child.name or "").strip()
    if instance.component_name and instance.component_name.strip() != child_entity:
        diagnostics.append(
            _error(
                diagram,
                "stale_child_interface",
                f"Instance '{instance.name}' names '{instance.component_name}', but design '{child.id}' is entity '{child_entity}'.",
            )
        )
    child_ports = {item.name: item for item in child.diagram_ports}
    instance_ports = {item.name: item for item in instance.ports}
    if set(child_ports) != set(instance_ports):
        diagnostics.append(
            _error(
                diagram,
                "stale_child_interface",
                f"Instance '{instance.name}' ports do not match the ports of '{child_entity}'.",
            )
        )
        return
    for name, port in instance_ports.items():
        child_port = child_ports[name]
        if _differs(port.direction, child_port.direction) or _differs(port.type_text, child_port.type_text) or _differs(port.range_text, child_port.range_text):
            diagnostics.append(
                _error(
                    diagram,
                    "stale_child_interface",
                    f"Port '{name}' on instance '{instance.name}' does not match '{child_entity}'.",
                )
            )
    child_generics = {item.name: item for item in child.generics}
    for item in instance.generics:
        if item.name not in child_generics:
            diagnostics.append(
                _error(
                    diagram,
                    "stale_child_interface",
                    f"Generic '{item.name}' on instance '{instance.name}' is not declared by '{child_entity}'.",
                )
            )


def _generic_map(
    diagram: EditableDiagram,
    instance: EditableInstance,
    child: EditableDiagram | None,
    standard: VhdlStandard,
    diagnostics: list[Diagnostic],
) -> list[IrAssoc]:
    child_generics = {item.name: item for item in child.generics} if child is not None else {}
    provided = {item.name: item for item in instance.generics}
    if child is not None:
        for name, item in child_generics.items():
            value = provided.get(name)
            if value is None or value.value is None or not str(value.value).strip():
                if not item.default_text:
                    diagnostics.append(
                        _error(
                            diagram,
                            "generic_unmapped",
                            f"Generic '{name}' on instance '{instance.name}' has no value and the child has no default.",
                        )
                    )
    found: list[IrAssoc] = []
    for item in instance.generics:
        if item.value is None or not str(item.value).strip():
            continue
        if _reject_actual(diagram, standard, item.value, f"generic '{item.name}' on '{instance.name}'", diagnostics):
            continue
        found.append(IrAssoc(formal=item.name, actual=item.value.strip()))
    return found


def _port_map(
    diagram: EditableDiagram,
    instance: EditableInstance,
    child: EditableDiagram | None,
    net_uses: dict[str, _NetUse],
    diagnostics: list[Diagnostic],
) -> list[IrAssoc]:
    child_ports = {item.name: item for item in child.diagram_ports} if child is not None else {}
    by_port: dict[str, tuple[EditableNet, NetEndpoint]] = {}
    for net in diagram.nets:
        for endpoint in net.endpoints:
            if endpoint.kind == "instance" and endpoint.owner_id == instance.id:
                by_port[endpoint.port_id] = (net, endpoint)
    found: list[IrAssoc] = []
    for port in instance.ports:
        linked = by_port.get(port.id)
        child_port = child_ports.get(port.name)
        default_text = child_port.default_text if child_port is not None else None
        if linked is None:
            if port.direction in {"in", "inout"} and not default_text:
                diagnostics.append(
                    _error(
                        diagram,
                        "port_unmapped",
                        f"Input '{port.name}' on instance '{instance.name}' is not connected and has no default.",
                    )
                )
            continue
        net, endpoint = linked
        use = net_uses.get(net.id)
        if use is None or use.outcome == "error" or use.carrier is None:
            if use is not None and use.outcome == "open" and port.direction in {"in", "inout"} and not default_text:
                diagnostics.append(
                    _error(
                        diagram,
                        "port_unmapped",
                        f"Input '{port.name}' on instance '{instance.name}' is not connected and has no default.",
                    )
                )
            continue
        formal = _qualify(port.name, endpoint.slice_text)
        actual = _qualify(use.carrier.name, use.carrier.slice_text)
        found.append(IrAssoc(formal=formal, actual=actual))
    return found


def _embedded(diagram: EditableDiagram, standard: VhdlStandard, diagnostics: list[Diagnostic]) -> list[IrText]:
    found: list[IrText] = []
    for block in diagram.embedded_blocks:
        if not block.text.strip():
            continue
        region = _region(block.text)
        if region == "skip":
            continue
        if region == "unresolved":
            diagnostics.append(
                _error(
                    diagram,
                    "embedded_context_unresolved",
                    f"Embedded HDL block '{block.name}' has no supported context, so it was not inserted.",
                )
            )
            continue
        if "??" in block.text:
            code = "vhdl93_unsupported" if standard == "93" else "construct_not_implemented"
            diagnostics.append(
                _error(
                    diagram,
                    code,
                    "The condition operator ?? is not emitted. The embedded text was left unchanged and was not inserted.",
                )
            )
            continue
        if _PROCESS_ALL.search(block.text):
            if standard == "93":
                diagnostics.append(
                    _error(
                        diagram,
                        "vhdl93_unsupported",
                        "process(all) is VHDL-2008. VHDL-93 generation stopped for this design.",
                    )
                )
                continue
            if region != "statements":
                diagnostics.append(
                    _error(
                        diagram,
                        "construct_not_implemented",
                        "process(all) is only emitted as a concurrent statement.",
                    )
                )
                continue
        found.append(IrText(text=block.text, role=region))
    return found


def _region(original: str) -> Literal["declarations", "statements", "skip", "unresolved"]:
    if not original.strip():
        return "skip"
    stripped = _collapse_processes(_strip_comments(original)).strip()
    if not stripped:
        return "declarations"
    statements = [item for item in _split_statements(stripped) if item.strip()]
    if not statements:
        return "declarations"
    kinds: set[str] = set()
    for statement in statements:
        if _DECL.match(statement.lstrip()):
            kinds.add("declarations")
            continue
        if _CONCURRENT.search(statement.lstrip()):
            kinds.add("statements")
            continue
        return "unresolved"
    if len(kinds) != 1:
        return "unresolved"
    kind = kinds.pop()
    if kind == "declarations":
        return "declarations"
    return "statements"


def _collapse_processes(text: str) -> str:
    return _PROCESS_REGION.sub("process;", text)


def _strip_comments(text: str) -> str:
    lines: list[str] = []
    for line in text.splitlines():
        kept: list[str] = []
        in_string = False
        index = 0
        while index < len(line):
            character = line[index]
            if character == '"':
                in_string = not in_string
                kept.append(character)
            elif character == "-" and not in_string and index + 1 < len(line) and line[index + 1] == "-":
                break
            else:
                kept.append(character)
            index += 1
        lines.append("".join(kept))
    return "\n".join(lines)


def _split_statements(text: str) -> list[str]:
    parts: list[str] = []
    buffer: list[str] = []
    depth = 0
    in_string = False
    for character in text:
        if character == '"':
            in_string = not in_string
            buffer.append(character)
            continue
        if not in_string and character == "(":
            depth += 1
        elif not in_string and character == ")":
            depth = max(0, depth - 1)
        elif not in_string and character == ";" and depth == 0:
            parts.append("".join(buffer).strip())
            buffer = []
            continue
        buffer.append(character)
    tail = "".join(buffer).strip()
    if tail:
        parts.append(tail)
    return parts


def _reject_actual(
    diagram: EditableDiagram,
    standard: VhdlStandard,
    text: str,
    where: str,
    diagnostics: list[Diagnostic],
) -> bool:
    reason = _actual_issue(text)
    if reason is None:
        return False
    if standard == "93":
        diagnostics.append(
            _error(
                diagram,
                "vhdl93_unsupported",
                f"{where} uses {reason}, which is not emitted for VHDL-93. The expression was not rewritten.",
            )
        )
    else:
        diagnostics.append(
            _error(
                diagram,
                "construct_not_implemented",
                f"{where} uses {reason}. That VHDL-2008 form is not implemented.",
            )
        )
    return True


def _actual_issue(text: str) -> str | None:
    if _PROCESS_ALL.search(text):
        return "process(all)"
    if "??" in text:
        return "??"
    if _WHEN.search(text):
        return "a conditional expression"
    return None


def _qualify(name: str, slice_text: str | None) -> str:
    if not slice_text:
        return name
    span = slice_text.strip()
    if span.startswith("("):
        return f"{name}{span}"
    return f"{name}({span})"


def _needs(pattern: re.Pattern[str], generics: list[IrGeneric], ports: list[IrPort], signals: list[IrSignal], declared: str) -> bool:
    chunks = [declared]
    chunks.extend(item.type_text or "" for item in generics)
    chunks.extend(item.default_text or "" for item in generics)
    for port in ports:
        chunks.append(port.type_text)
        chunks.append(port.range_text or "")
    for signal in signals:
        chunks.append(signal.type_text)
        chunks.append(signal.range_text or "")
    return any(pattern.search(chunk) for chunk in chunks)


def _endpoint_port(diagram: EditableDiagram, endpoint: NetEndpoint) -> EditableDiagramPort | EditablePort | None:
    if endpoint.kind == "diagram_port":
        return _diagram_port(diagram, endpoint)
    instance = next((item for item in diagram.instances if item.id == endpoint.owner_id), None)
    if instance is None:
        return None
    return next((item for item in instance.ports if item.id == endpoint.port_id), None)


def _diagram_port(diagram: EditableDiagram, endpoint: NetEndpoint) -> EditableDiagramPort | None:
    return next((item for item in diagram.diagram_ports if item.id in {endpoint.owner_id, endpoint.port_id}), None)


def _differs(left: str | None, right: str | None) -> bool:
    return (left or "").strip() != (right or "").strip()


def _unique_names(
    diagram: EditableDiagram,
    generics: list[IrGeneric],
    ports: list[IrPort],
    signals: list[IrSignal],
    diagnostics: list[Diagnostic],
) -> None:
    seen: set[str] = set()
    for name in [item.name for item in generics] + [item.name for item in ports] + [item.name for item in signals]:
        key = name.casefold()
        if key in seen:
            diagnostics.append(_error(diagram, "name_conflict", f"Name '{name}' is used more than once in this design."))
        seen.add(key)


def _valid_name(name: str) -> bool:
    return bool(_IDENTIFIER.match(name)) and name.casefold() not in _KEYWORDS


def _error(diagram: EditableDiagram, code: str, message: str) -> Diagnostic:
    return Diagnostic(severity="error", code=code, message=message, path=diagram.id)
