"""Connection checks for an editable diagram.

A missing width or direction is reported as uncertainty. The check does not
fill one in. A bus slice such as ``(31 downto 22)`` is part of the endpoint
and is compared as that width, not as the whole net.
"""

from __future__ import annotations

import re

from app.models.design import Diagnostic, WidthStatus
from app.models.editable import EditableDiagram, EditablePort, NetEndpoint

_RANGE = re.compile(r"\(\s*(-?\d+)\s+(?:downto|to)\s+(-?\d+)\s*\)", re.IGNORECASE)
_SCALAR = {"std_logic", "std_ulogic", "bit"}
_NON_VECTOR = {"integer", "boolean", "natural", "positive", "character", "string"}


def connection_checks(diagram: EditableDiagram) -> list[Diagnostic]:
    ports = _ports(diagram)
    connected = {
        (endpoint.kind, endpoint.owner_id, endpoint.port_id)
        for net in diagram.nets
        for endpoint in net.endpoints
    }
    findings: list[Diagnostic] = []
    findings.extend(_duplicate_names(diagram))
    for net in diagram.nets:
        findings.extend(_net_findings(diagram, net.name, net.endpoints, ports))
    for instance in diagram.instances:
        for port in instance.ports:
            key = ("instance", instance.id, port.id)
            if port.direction == "in" and key not in connected:
                findings.append(
                    Diagnostic(
                        severity="warning",
                        code="unconnected_input",
                        message=f"Input '{port.name}' of '{instance.name}' has no net.",
                    )
                )
            elif port.direction is None and key not in connected:
                findings.append(
                    Diagnostic(
                        severity="info",
                        code="direction_unknown",
                        message=(
                            f"Port '{port.name}' of '{instance.name}' has no recorded direction, "
                            "so it is not treated as a required input."
                        ),
                    )
                )
    for port in diagram.diagram_ports:
        key = ("diagram_port", port.id, port.id)
        if port.direction == "in" and key not in connected:
            findings.append(
                Diagnostic(
                    severity="warning",
                    code="unconnected_input",
                    message=f"Diagram input '{port.name}' has no net.",
                )
            )
    return findings


def described_width(type_text: str | None, range_text: str | None) -> tuple[int | None, WidthStatus]:
    folded = (type_text or "").strip().lower()
    if folded in _NON_VECTOR and not range_text:
        return None, "not_applicable"
    parsed = range_width(range_text)
    if parsed is not None:
        return parsed, "literal"
    if folded in _SCALAR and not range_text:
        return 1, "scalar"
    return None, "unresolved"


def range_width(text: str | None) -> int | None:
    if not text:
        return None
    match = _RANGE.search(text)
    if match is None:
        return None
    return abs(int(match.group(1)) - int(match.group(2))) + 1


def _net_findings(diagram: EditableDiagram, name: str, endpoints: list[NetEndpoint], ports: dict) -> list[Diagnostic]:
    findings: list[Diagnostic] = []
    drivers: list[str] = []
    uncertain: list[str] = []
    widths: list[tuple[str, int]] = []
    unresolved = False
    types: list[tuple[str, str]] = []
    missing_type = False
    for endpoint in endpoints:
        port = ports.get((endpoint.kind, endpoint.owner_id, endpoint.port_id))
        label = _endpoint_label(diagram, endpoint, port)
        if port is None or port.direction is None or port.direction == "inout":
            uncertain.append(label)
        elif port.direction in {"out", "buffer"}:
            drivers.append(label)
        slice_width = range_width(endpoint.slice_text)
        if slice_width is not None:
            widths.append((label, slice_width))
        elif port is not None and port.width_status == "literal" and port.width is not None:
            widths.append((label, port.width))
        elif port is not None and port.width_status == "scalar":
            widths.append((label, 1))
        elif port is not None and port.width_status == "unresolved":
            unresolved = True
        known = _known_type(port)
        if known is None:
            missing_type = True
        else:
            types.append((label, known))
    if len(drivers) > 1:
        findings.append(
            Diagnostic(
                severity="warning",
                code="multiple_drivers",
                message=f"Net '{name}' has more than one driver: {', '.join(drivers)}.",
            )
        )
    elif drivers and uncertain:
        findings.append(
            Diagnostic(
                severity="info",
                code="driver_uncertain",
                message=(
                    f"Net '{name}' has driver {drivers[0]}. "
                    f"{', '.join(uncertain)} has no definite direction, so a second driver is not assumed."
                ),
            )
        )
    distinct = {width for _label, width in widths}
    if len(distinct) > 1:
        detail = ", ".join(f"{label} width {width}" for label, width in widths)
        findings.append(
            Diagnostic(
                severity="warning",
                code="width_mismatch",
                message=f"Net '{name}' connects different widths: {detail}.",
            )
        )
    elif unresolved:
        findings.append(
            Diagnostic(
                severity="info",
                code="width_unresolved",
                message=f"Net '{name}' has a port whose width is not stated. No width was invented.",
            )
        )
    distinct_types = {value for _label, value in types}
    if len(distinct_types) > 1:
        detail = ", ".join(f"{label} {value}" for label, value in types)
        findings.append(
            Diagnostic(
                severity="warning",
                code="type_mismatch",
                message=f"Net '{name}' connects different types: {detail}.",
            )
        )
    elif missing_type and types:
        findings.append(
            Diagnostic(
                severity="info",
                code="type_unresolved",
                message=f"Net '{name}' has a port whose type is not stated. No type was invented.",
            )
        )
    return findings


def _ports(diagram: EditableDiagram) -> dict[tuple[str, str, str], EditablePort]:
    found: dict[tuple[str, str, str], EditablePort] = {}
    for instance in diagram.instances:
        for port in instance.ports:
            found[("instance", instance.id, port.id)] = port
    for port in diagram.diagram_ports:
        found[("diagram_port", port.id, port.id)] = port
    return found


def _duplicate_names(diagram: EditableDiagram) -> list[Diagnostic]:
    findings = [
        *_repeated("Instance", [item.name for item in diagram.instances]),
        *_repeated("Top-level port", [item.name for item in diagram.diagram_ports]),
        *_repeated("Generic", [item.name for item in diagram.generics]),
    ]
    if any(not port.name.strip() for port in diagram.diagram_ports):
        findings.append(
            Diagnostic(severity="warning", code="interface_unnamed", message="A top-level port has no name.")
        )
    return findings


def _repeated(kind: str, names: list[str]) -> list[Diagnostic]:
    seen: set[str] = set()
    reported: set[str] = set()
    findings: list[Diagnostic] = []
    for name in names:
        key = name.strip().lower()
        if not key:
            continue
        if key in seen and key not in reported:
            findings.append(
                Diagnostic(
                    severity="warning",
                    code="duplicate_name",
                    message=f"{kind} name '{name}' is used more than once.",
                )
            )
            reported.add(key)
        seen.add(key)
    return findings


def _known_type(port: EditablePort | None) -> str | None:
    if port is None or port.type_text is None:
        return None
    folded = " ".join(port.type_text.lower().split())
    return folded or None


def _endpoint_label(diagram: EditableDiagram, endpoint: NetEndpoint, port: EditablePort | None) -> str:
    port_name = port.name if port else endpoint.port_id
    if endpoint.kind == "diagram_port":
        return port_name
    instance = next((item for item in diagram.instances if item.id == endpoint.owner_id), None)
    owner = instance.name if instance else endpoint.owner_id
    return f"{owner}.{port_name}"
