"""Read XDC files and compare them with a top-level entity.

Pin locations, I/O standards, and clock periods are never filled in. A board
definition is not treated as an XDC file.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from app.models.design import DesignUnit, Diagnostic, ProjectFile

_GET_PORTS = re.compile(r"get_ports\s*(\{[^}]*\}|\S+)", re.IGNORECASE)
_PACKAGE_PIN = re.compile(r"PACKAGE_PIN\s+([A-Za-z0-9]+)", re.IGNORECASE)
_LOC = re.compile(r"(?:^|\s|\{)LOC\s+([A-Za-z0-9]+)", re.IGNORECASE)
_IOSTANDARD = re.compile(r"IOSTANDARD\s+([A-Za-z0-9_]+)", re.IGNORECASE)
_CLOCK_USE = re.compile(
    r"(?:rising_edge|falling_edge)\s*\(\s*([A-Za-z_]\w*)\s*\)|([A-Za-z_]\w*)\s*'\s*event",
    re.IGNORECASE,
)


@dataclass
class XdcFacts:
    pins: dict[str, str] = field(default_factory=dict)
    standards: dict[str, str] = field(default_factory=dict)
    clocks: set[str] = field(default_factory=set)
    ports: set[str] = field(default_factory=set)


def check_constraints(project: ProjectFile, top: DesignUnit, xdc_paths: list[str]) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    facts = XdcFacts()
    if not any(path.strip() for path in xdc_paths):
        diagnostics.append(_error("xdc_missing", "Choose an XDC file. The board file is not a constraint file.", None))
        return diagnostics
    for raw in xdc_paths:
        path = Path(raw)
        if not raw.strip() or not path.is_file():
            diagnostics.append(_error("xdc_missing", f"XDC file was not found: {raw}", raw or None))
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            diagnostics.append(_error("xdc_unreadable", str(exc), str(path)))
            continue
        parsed = parse_xdc(text)
        facts.pins.update(parsed.pins)
        facts.standards.update(parsed.standards)
        facts.clocks.update(parsed.clocks)
        facts.ports.update(parsed.ports)
    if any(item.code == "xdc_missing" for item in diagnostics):
        return diagnostics
    known = {port.name.casefold(): port.name for port in top.ports}
    for name in sorted(facts.ports):
        if name.casefold() not in known:
            diagnostics.append(
                _error("port_not_in_top", f"XDC port '{name}' is not a port of {top.name}.", name, top.id)
            )
    clocks = _clock_ports(project, top)
    for port in top.ports:
        key = port.name.casefold()
        pinned = _lookup(facts.pins, key)
        standard = _lookup(facts.standards, key)
        if pinned is None:
            diagnostics.append(
                _error("pin_missing", f"Port '{port.name}' has no PACKAGE_PIN or LOC in the XDC files.", port.name, port.id)
            )
        elif standard is None:
            diagnostics.append(
                _error("iostandard_missing", f"Port '{port.name}' has no IOSTANDARD in the XDC files.", port.name, port.id)
            )
        if key in clocks and _lookup(facts.clocks, key) is None:
            diagnostics.append(
                _error(
                    "clock_missing",
                    f"Port '{port.name}' is used as a clock and has no create_clock constraint.",
                    port.name,
                    port.id,
                )
            )
    return diagnostics


def parse_xdc(text: str) -> XdcFacts:
    facts = XdcFacts()
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line or line.startswith("#"):
            continue
        ports = _ports_on_line(line)
        if not ports:
            continue
        facts.ports.update(ports)
        pin = _PACKAGE_PIN.search(line) or _LOC.search(line)
        standard = _IOSTANDARD.search(line)
        for port in ports:
            if pin is not None:
                facts.pins[port.casefold()] = pin.group(1)
            if standard is not None:
                facts.standards[port.casefold()] = standard.group(1)
            if re.search(r"\bcreate_clock\b", line, re.IGNORECASE):
                facts.clocks.add(port.casefold())
    return facts


def _ports_on_line(line: str) -> list[str]:
    found: list[str] = []
    for match in _GET_PORTS.finditer(line):
        token = match.group(1).strip().strip("{}")
        for part in token.split():
            base = re.split(r"[\[{]", part, maxsplit=1)[0].strip()
            if re.fullmatch(r"[A-Za-z_]\w*", base):
                found.append(base)
    return found


def _clock_ports(project: ProjectFile, top: DesignUnit) -> set[str]:
    names = {port.name.casefold() for port in top.ports}
    found: set[str] = set()
    for unit in project.design_units:
        if unit.kind != "architecture" or unit.library_id != top.library_id:
            continue
        if (unit.parent_name or "").casefold() != top.name.casefold():
            continue
        path = _unit_path(project, unit)
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for line in text.splitlines():
            code = line.split("--", 1)[0]
            for match in _CLOCK_USE.finditer(code):
                name = (match.group(1) or match.group(2) or "").casefold()
                if name in names:
                    found.add(name)
    return found


def _unit_path(project: ProjectFile, unit: DesignUnit) -> Path:
    path = Path(unit.source.path)
    if path.is_absolute():
        return path
    library = next(item for item in project.libraries if item.id == unit.library_id)
    return Path(library.root_path) / path


def _lookup(mapping: dict[str, str] | set[str], key: str) -> str | None:
    if isinstance(mapping, set):
        return key if key in mapping else None
    return mapping.get(key)


def _error(code: str, message: str, path: str | None, unit_id: str | None = None) -> Diagnostic:
    return Diagnostic(severity="error", code=code, message=message, path=path, unit_id=unit_id)
