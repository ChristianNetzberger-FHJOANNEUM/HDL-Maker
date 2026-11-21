"""Compare a parsed block diagram with the generated structural VHDL.

Only names that both sides state are compared. A missing VHDL file is reported.
Differences are not rewritten on either side.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from app.models.design import DiagramDocument, VhdlCheck


@dataclass
class _VhdlInstance:
    name: str
    component: str
    generics: dict[str, str]
    ports: dict[str, str]


def check_against_vhdl(diagram: DiagramDocument, library_root: Path) -> list[VhdlCheck]:
    if diagram.view != "block" or not diagram.entity_name or not diagram.architecture_name:
        return []
    relative = f"hdl/{diagram.entity_name}_{diagram.architecture_name}.vhd"
    source = library_root / relative
    if not source.is_file():
        return [
            VhdlCheck(
                severity="warning",
                code="vhdl_struct_missing",
                message=f"No generated file {relative} was found to compare with {diagram.source_path}.",
            )
        ]
    text = source.read_text(encoding="utf-8", errors="replace")
    vhdl_instances = {item.name: item for item in _structural_instances(text)}
    findings: list[VhdlCheck] = []
    seen: set[str] = set()
    for instance in diagram.instances:
        seen.add(instance.name)
        other = vhdl_instances.get(instance.name)
        if other is None:
            findings.append(
                VhdlCheck(
                    severity="warning",
                    code="instance_missing_in_vhdl",
                    message=f"Diagram instance '{instance.name}' has no matching instantiation in {relative}.",
                )
            )
            continue
        if instance.component_name and other.component.lower() != instance.component_name.lower():
            findings.append(
                VhdlCheck(
                    severity="warning",
                    code="component_name_differs",
                    message=(
                        f"Instance '{instance.name}' is '{instance.component_name}' in the diagram "
                        f"and '{other.component}' in {relative}."
                    ),
                )
            )
        for generic in instance.generics:
            vhdl_value = other.generics.get(generic.name.lower())
            if generic.value is None or vhdl_value is None:
                continue
            if vhdl_value != generic.value:
                findings.append(
                    VhdlCheck(
                        severity="warning",
                        code="generic_value_differs",
                        message=(
                            f"Generic '{generic.name}' of '{instance.name}' is '{generic.value}' in the diagram "
                            f"and '{vhdl_value}' in {relative}."
                        ),
                    )
                )
        diagram_ports = _diagram_port_nets(diagram, instance)
        for port_name, net_name in diagram_ports.items():
            actual = other.ports.get(port_name.lower())
            if actual is None:
                findings.append(
                    VhdlCheck(
                        severity="warning",
                        code="port_missing_in_vhdl",
                        message=f"Port '{port_name}' of '{instance.name}' is connected in the diagram and absent from {relative}.",
                    )
                )
                continue
            if actual.lower() == "open":
                findings.append(
                    VhdlCheck(
                        severity="info",
                        code="port_open_in_vhdl",
                        message=f"Port '{port_name}' of '{instance.name}' is open in {relative}. The diagram net is '{net_name}'.",
                    )
                )
                continue
            if _compact(actual) != _compact(net_name):
                findings.append(
                    VhdlCheck(
                        severity="warning",
                        code="port_net_differs",
                        message=(
                            f"Port '{port_name}' of '{instance.name}' connects to '{net_name}' in the diagram "
                            f"and to '{actual}' in {relative}."
                        ),
                    )
                )
    for name in sorted(set(vhdl_instances) - seen):
        findings.append(
            VhdlCheck(
                severity="warning",
                code="instance_missing_in_diagram",
                message=f"VHDL instance '{name}' in {relative} has no component instance in the diagram.",
            )
        )
    if not findings:
        findings.append(
            VhdlCheck(
                severity="info",
                code="vhdl_struct_matches",
                message=f"Instance names, components, generics, and connected ports match {relative}.",
            )
        )
    return findings


def _diagram_port_nets(diagram: DiagramDocument, instance) -> dict[str, str]:
    port_objects = {port.hds_object: port.name for port in instance.ports if port.hds_object is not None}
    nets = {net.hds_object: net.name for net in diagram.nets if net.hds_object is not None}
    found: dict[str, str] = {}
    for wire in diagram.wires:
        net_name = nets.get(wire.net_object) if wire.net_object is not None else None
        if net_name is None:
            continue
        for endpoint in (wire.start_object, wire.end_object):
            port_name = port_objects.get(endpoint)
            if not port_name:
                continue
            sliced = endpoint == wire.start_object and wire.slice_text
            expression = f"{net_name}{wire.slice_text}" if sliced else net_name
            previous = found.get(port_name)
            if previous is None or (sliced and "(" not in previous):
                found[port_name] = expression
    return found


def _compact(text: str) -> str:
    return re.sub(r"\s+", "", text).lower()


def _structural_instances(text: str) -> list[_VhdlInstance]:
    blanked = _blank_comments(text)
    pattern = re.compile(r"\b([A-Za-z]\w*)\s*:\s*([A-Za-z]\w*)\b", re.IGNORECASE)
    matches = list(pattern.finditer(blanked))
    found: list[_VhdlInstance] = []
    for index, match in enumerate(matches):
        label, component = match.group(1), match.group(2)
        if label.lower() in {"signal", "component", "for", "all", "entity", "configuration"}:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(blanked)
        window = blanked[match.end() : end]
        if not re.match(r"\s*(generic\s+map|port\s+map)\b", window, re.IGNORECASE):
            continue
        generics = _map_clause(window, "generic")
        ports = _map_clause(window, "port")
        found.append(_VhdlInstance(label, component, generics, ports))
    return found


def _map_clause(text: str, keyword: str) -> dict[str, str]:
    match = re.search(rf"\b{keyword}\s+map\s*\(", text, re.IGNORECASE)
    if not match:
        return {}
    start = match.end()
    depth = 1
    index = start
    while index < len(text) and depth:
        if text[index] == "(":
            depth += 1
        elif text[index] == ")":
            depth -= 1
        index += 1
    body = text[start : index - 1]
    pairs: dict[str, str] = {}
    for item in _split_top(body):
        association = re.match(r"\s*([A-Za-z]\w*)\s*=>\s*(.+)\s*$", item, re.IGNORECASE | re.DOTALL)
        if not association:
            continue
        pairs[association.group(1).lower()] = re.sub(r"\s+", " ", association.group(2)).strip()
    return pairs


def _split_top(text: str) -> list[str]:
    items: list[str] = []
    buf: list[str] = []
    depth = 0
    for char in text:
        if char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        if char == "," and depth == 0:
            item = "".join(buf).strip()
            if item:
                items.append(item)
            buf = []
            continue
        buf.append(char)
    tail = "".join(buf).strip()
    if tail:
        items.append(tail)
    return items


def _blank_comments(text: str) -> str:
    chars = list(text)
    index = 0
    while index < len(chars):
        if chars[index] == "-" and index + 1 < len(chars) and chars[index + 1] == "-":
            while index < len(chars) and chars[index] != "\n":
                chars[index] = " "
                index += 1
            continue
        index += 1
    return "".join(chars)
