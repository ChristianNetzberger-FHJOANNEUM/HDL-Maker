"""Extract VHDL design-unit interfaces.

This is not a VHDL analyzer. It finds library units and reads entity
generics and ports. Architecture bodies, package declarations, and
configurations are inventoried and left for a later milestone. Anything
that cannot be read is returned as a diagnostic together with the raw text.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.models.design import Diagnostic, GenericKind, GenericPort, ParseStatus, Port, Severity

_UNIT_RE = re.compile(
    r"(?i)\b(?:"
    r"package\s+body\s+([A-Za-z]\w*)\s+is"
    r"|package\s+([A-Za-z]\w*)\s+is"
    r"|entity\s+([A-Za-z]\w*)\s+is"
    r"|architecture\s+([A-Za-z]\w*)\s+of\s+([A-Za-z]\w*)\s+is"
    r"|configuration\s+([A-Za-z]\w*)\s+of\s+([A-Za-z]\w*)"
    r"|context\s+([A-Za-z]\w*)\s+is"
    r")"
)
_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9_]*|:=|\d+|[(){};,:]")
_IDENT_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]*$")
_LIBRARY_RE = re.compile(r"(?i)\blibrary\s+([A-Za-z]\w*)\s*;")
_USE_RE = re.compile(
    r"(?i)\buse\s+([A-Za-z]\w*(?:\s*\.\s*[A-Za-z]\w*)*?)(?:\s*\.\s*all)?\s*;"
)
_RANGE_RE = re.compile(r"\(([^()]*)\)")
_LITERAL_RANGE_RE = re.compile(r"(?i)^\s*(\d+)\s+(downto|to)\s+(\d+)\s*$")
_DIRECTIONS = {"in", "out", "inout", "buffer", "linkage"}
_OPENERS = {
    "if",
    "case",
    "loop",
    "process",
    "block",
    "component",
    "function",
    "procedure",
    "record",
    "protected",
    "generate",
}
_END_NAMES = _OPENERS | {"entity", "architecture", "package", "configuration", "context", "body"}
_SCALAR_BITS = {"std_logic", "std_ulogic", "bit"}
_NOT_APPLICABLE = {
    "integer",
    "natural",
    "positive",
    "boolean",
    "real",
    "time",
    "string",
    "character",
    "severity_level",
}
_GENERIC_CLASSES: dict[str, GenericKind] = {
    "type": "type",
    "package": "package",
    "function": "function",
    "procedure": "procedure",
}
_OBJECT_PREFIXES = {"constant", "signal", "variable", "file"}


@dataclass
class ExtractedUnit:
    kind: str
    name: str
    parent_name: str | None
    generics: list[GenericPort] = field(default_factory=list)
    ports: list[Port] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    start_line: int = 1
    end_line: int = 1
    parse_status: ParseStatus = "parsed"
    diagnostics: list[Diagnostic] = field(default_factory=list)


def extract_design_units(text: str) -> list[ExtractedUnit]:
    blanked = _blank_comments_and_strings(text)
    matches = list(_UNIT_RE.finditer(blanked))
    units: list[ExtractedUnit] = []
    previous_end = 0
    covered_until = 0
    for match in matches:
        if match.start() < covered_until:
            continue
        kind, name, parent = _classify(match)
        end = _unit_end(blanked, match.end())
        if end >= len(blanked) and not _has_end_keyword(blanked, match.end()):
            diagnostics = [
                _diagnostic(
                    "error",
                    "unterminated_design_unit",
                    f"{kind} '{name}' has no terminating end.",
                    _line_number(text, match.start()),
                )
            ]
            status: ParseStatus = "partial"
        else:
            diagnostics = []
            status = "parsed"
        unit = ExtractedUnit(
            kind=kind,
            name=name,
            parent_name=parent,
            dependencies=_dependencies(blanked[previous_end : match.start()]),
            start_line=_line_number(text, match.start()),
            end_line=_line_number(text, max(end - 1, match.start())),
            parse_status=status,
            diagnostics=diagnostics,
        )
        if kind == "entity":
            _read_entity_interface(text, blanked, match.end(), end, unit)
        elif kind in {"package", "package_body", "configuration", "context"}:
            unit.parse_status = "skipped"
            unit.diagnostics.append(
                _diagnostic(
                    "info",
                    "declarations_not_imported",
                    f"{kind.replace('_', ' ')} '{name}' is listed. Its declarations are not imported in this version.",
                    unit.start_line,
                )
            )
        _set_status_from_errors(unit)
        units.append(unit)
        previous_end = end
        covered_until = end
    return units


def _classify(match: re.Match[str]) -> tuple[str, str, str | None]:
    if match.group(1):
        return "package_body", match.group(1), match.group(1)
    if match.group(2):
        return "package", match.group(2), None
    if match.group(3):
        return "entity", match.group(3), None
    if match.group(4):
        return "architecture", match.group(4), match.group(5)
    if match.group(6):
        return "configuration", match.group(6), match.group(7)
    return "context", match.group(8) or "unknown", None


def _read_entity_interface(
    original: str,
    blanked: str,
    region_start: int,
    region_end: int,
    unit: ExtractedUnit,
) -> None:
    header_end = _header_end(blanked, region_start, region_end)
    clauses = _interface_clauses(blanked, region_start, header_end)
    seen: set[str] = set()
    for kind, open_paren in clauses:
        if kind in seen:
            unit.diagnostics.append(
                _diagnostic(
                    "error",
                    "duplicate_interface_clause",
                    f"Entity '{unit.name}' has more than one {kind} clause. The extra clause was not imported.",
                    _line_number(original, open_paren),
                )
            )
            continue
        seen.add(kind)
        close_paren = _matching_paren(blanked, open_paren)
        if close_paren < 0 or close_paren > header_end:
            unit.diagnostics.append(
                _diagnostic(
                    "error",
                    "unparsed_interface_item",
                    f"The {kind} clause of entity '{unit.name}' is not closed.",
                    _line_number(original, open_paren),
                )
            )
            continue
        for item_start, item_end in _split_items(blanked, open_paren + 1, close_paren):
            raw = _collapse(_strip_comments(original[item_start:item_end]))
            if not raw:
                continue
            if kind == "port":
                _read_port_item(raw, unit, _line_number(original, item_start))
            else:
                _read_generic_item(raw, unit, _line_number(original, item_start))


def _read_port_item(raw: str, unit: ExtractedUnit, line: int) -> None:
    name_text, remainder = _split_colon(raw)
    if name_text is None or remainder is None:
        _reject_item(unit, "port", raw, line)
        return
    names = _names(name_text)
    if not names or remainder == "":
        _reject_item(unit, "port", raw, line)
        return
    type_and_default = remainder
    default_text: str | None = None
    default_at = _separator_index(type_and_default, ":=")
    if default_at >= 0:
        default_text = _collapse(type_and_default[default_at + 2 :]) or None
        type_and_default = type_and_default[:default_at]
    direction, type_text = _port_type(type_and_default)
    if not type_text:
        _reject_item(unit, "port", raw, line)
        return
    if direction is None:
        unit.diagnostics.append(
            _diagnostic(
                "warning",
                "missing_port_mode",
                f"Port '{names[0]}' has no mode. It was kept and the mode was not guessed.",
                line,
            )
        )
    range_text, width, width_status = _analyze_width(type_text)
    if width_status == "unresolved":
        unit.diagnostics.append(
            _diagnostic(
                "warning",
                "width_unresolved",
                f"Width of port '{names[0]}' ({type_text}) is not a literal and was not inferred.",
                line,
            )
        )
    for index, name in enumerate(names):
        if any(port.name.lower() == name.lower() for port in unit.ports):
            unit.diagnostics.append(
                _diagnostic(
                    "error",
                    "duplicate_port_name",
                    f"Port '{name}' is declared more than once and the later declaration was not imported.",
                    line,
                )
            )
            continue
        unit.ports.append(
            Port(
                id=f"pending-port-{index}-{name}",
                name=name,
                direction=direction,
                type_text=type_text,
                range_text=range_text,
                width=width,
                width_status=width_status,
                default_text=default_text,
            )
        )


def _read_generic_item(raw: str, unit: ExtractedUnit, line: int) -> None:
    name_text, remainder = _split_colon(raw)
    if name_text is None:
        _read_generic_without_colon(raw, unit, line)
        return
    names = _names(name_text)
    if not names or remainder is None or remainder == "":
        _reject_item(unit, "generic", raw, line)
        return
    default_text: str | None = None
    type_text = remainder
    default_at = _separator_index(type_text, ":=")
    if default_at >= 0:
        default_text = _collapse(type_text[default_at + 2 :]) or None
        type_text = _collapse(type_text[:default_at])
    if not type_text:
        _reject_item(unit, "generic", raw, line)
        return
    _append_generics(unit, names, "value", type_text, default_text, line, value_generic=True)


def _read_generic_without_colon(raw: str, unit: ExtractedUnit, line: int) -> None:
    parts = raw.split(maxsplit=2)
    keyword = parts[0].lower() if parts else ""
    generic_kind = _GENERIC_CLASSES.get(keyword)
    if generic_kind is None or len(parts) < 2 or not _IDENT_RE.match(parts[1]):
        _reject_item(unit, "generic", raw, line)
        return
    type_text = parts[2] if len(parts) > 2 else None
    unit.diagnostics.append(
        _diagnostic(
            "info",
            "generic_not_a_value",
            f"Generic '{parts[1]}' is a {generic_kind} interface, not a value generic.",
            line,
        )
    )
    _append_generics(unit, [parts[1]], generic_kind, type_text, None, line, value_generic=False)


def _append_generics(
    unit: ExtractedUnit,
    names: list[str],
    generic_kind: GenericKind,
    type_text: str | None,
    default_text: str | None,
    line: int,
    value_generic: bool,
) -> None:
    for index, name in enumerate(names):
        if any(item.name.lower() == name.lower() for item in unit.generics):
            unit.diagnostics.append(
                _diagnostic(
                    "error",
                    "duplicate_generic_name",
                    f"Generic '{name}' is declared more than once and the later declaration was not imported.",
                    line,
                )
            )
            continue
        unit.generics.append(
            GenericPort(
                id=f"pending-generic-{index}-{name}",
                name=name,
                generic_kind=generic_kind,
                type_text=type_text if value_generic or type_text else None,
                default_text=default_text,
            )
        )


def _reject_item(unit: ExtractedUnit, clause: str, raw: str, line: int) -> None:
    unit.diagnostics.append(
        _diagnostic(
            "error",
            "unparsed_interface_item",
            f"Could not read this {clause} item, so it was not given a port or generic definition: {raw}",
            line,
        )
    )


def _names(name_text: str) -> list[str] | None:
    cleaned = _collapse(name_text)
    if not cleaned:
        return None
    tokens = cleaned.split(maxsplit=1)
    if tokens[0].lower() in _OBJECT_PREFIXES:
        cleaned = tokens[1] if len(tokens) == 2 else ""
    parts = [part.strip() for part in cleaned.split(",") if part.strip()]
    if not parts or any(_IDENT_RE.match(part) is None for part in parts):
        return None
    return parts


def _port_type(text: str) -> tuple[str | None, str]:
    collapsed = _collapse(text)
    match = re.match(r"(?i)^(in|out|inout|buffer|linkage)\b\s*(.*)$", collapsed)
    if not match:
        return None, collapsed
    return match.group(1).lower(), match.group(2).strip()


def _analyze_width(type_text: str) -> tuple[str | None, int | None, str]:
    literal_widths: list[int | None] = []
    range_texts: list[str] = []
    saw_nonliteral = False
    for inner in _RANGE_RE.findall(type_text):
        if not re.search(r"(?i)\b(?:downto|to)\b", inner):
            continue
        range_texts.append(_collapse(inner))
        literal = _LITERAL_RANGE_RE.match(inner)
        if literal:
            literal_widths.append(abs(int(literal.group(1)) - int(literal.group(3))) + 1)
        else:
            literal_widths.append(None)
            saw_nonliteral = True
    if saw_nonliteral or len(literal_widths) > 1:
        return (range_texts[0] if range_texts else None), None, "unresolved"
    if len(literal_widths) == 1 and literal_widths[0] is not None:
        return range_texts[0], literal_widths[0], "literal"
    base = _type_base(type_text)
    if base in _SCALAR_BITS:
        return None, 1, "scalar"
    if base in _NOT_APPLICABLE:
        return None, None, "not_applicable"
    return None, None, "unresolved"


def _type_base(type_text: str) -> str:
    head = type_text.split("(", 1)[0].strip()
    if not head:
        return ""
    return head.split(".")[-1].strip().lower()


def _dependencies(region: str) -> list[str]:
    found: list[str] = []
    for match in _LIBRARY_RE.finditer(region):
        found.append(f"library:{match.group(1).lower()}")
    for match in _USE_RE.finditer(region):
        normalized = re.sub(r"\s+", "", match.group(1).lower())
        found.append(f"use:{normalized}")
    return found


def _header_end(blanked: str, start: int, end: int) -> int:
    depth = 0
    index = start
    while index < end:
        char = blanked[index]
        if char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        elif depth == 0 and _is_word(blanked, index, "begin"):
            return index
        index += 1
    return end


def _interface_clauses(blanked: str, start: int, end: int) -> list[tuple[str, int]]:
    found: list[tuple[str, int]] = []
    depth = 0
    index = start
    while index < end:
        char = blanked[index]
        if char == "(":
            depth += 1
            index += 1
            continue
        if char == ")":
            depth = max(0, depth - 1)
            index += 1
            continue
        if depth == 0:
            for word in ("generic", "port"):
                if _is_word(blanked, index, word):
                    cursor = index + len(word)
                    while cursor < end and blanked[cursor].isspace():
                        cursor += 1
                    if cursor < end and blanked[cursor] == "(":
                        found.append((word, cursor))
                        index = cursor
                    break
        index += 1
    return found


def _split_items(blanked: str, start: int, end: int) -> list[tuple[int, int]]:
    items: list[tuple[int, int]] = []
    depth = 0
    item_start = start
    for index in range(start, end):
        char = blanked[index]
        if char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        elif char == ";" and depth == 0:
            items.append((item_start, index))
            item_start = index + 1
    if _collapse(blanked[item_start:end]):
        items.append((item_start, end))
    return items


def _unit_end(blanked: str, start: int) -> int:
    tokens = list(_TOKEN_RE.finditer(blanked, start))
    count = 0
    paren = 0
    skip_closer_name = False
    for index, token in enumerate(tokens):
        text = token.group(0).lower()
        if skip_closer_name:
            skip_closer_name = False
            if text in _END_NAMES:
                continue
        if text == "(":
            paren += 1
            continue
        if text == ")":
            paren = max(0, paren - 1)
            continue
        if paren != 0:
            continue
        if text == "end":
            if count == 0:
                for closer in tokens[index:]:
                    if closer.group(0) == ";":
                        return closer.end()
                return len(blanked)
            count -= 1
            skip_closer_name = True
            continue
        if text not in _OPENERS:
            continue
        if text == "if" and _opens_generate(tokens, index):
            continue
        if text in {"function", "procedure"} and not _subprogram_is_body(tokens, index):
            continue
        count += 1
    return len(blanked)


def _subprogram_is_body(tokens: list[re.Match[str]], keyword_index: int) -> bool:
    """A declaration ends at ';' before 'is'. A body contains 'is' first."""
    paren = 0
    for token in tokens[keyword_index + 1 :]:
        text = token.group(0).lower()
        if text == "(":
            paren += 1
        elif text == ")":
            paren = max(0, paren - 1)
        elif paren == 0 and text == "is":
            return True
        elif paren == 0 and text == ";":
            return False
    return False


def _opens_generate(tokens: list[re.Match[str]], if_index: int) -> bool:
    paren = 0
    for token in tokens[if_index + 1 :]:
        text = token.group(0).lower()
        if text == "(":
            paren += 1
        elif text == ")":
            paren = max(0, paren - 1)
        elif paren == 0 and text == "generate":
            return True
        elif paren == 0 and text in {"then", ";"}:
            return False
    return False


def _has_end_keyword(blanked: str, start: int) -> bool:
    return _unit_end(blanked, start) < len(blanked)


def _matching_paren(text: str, open_index: int) -> int:
    depth = 0
    for index in range(open_index, len(text)):
        if text[index] == "(":
            depth += 1
        elif text[index] == ")":
            depth -= 1
            if depth == 0:
                return index
    return -1


def _split_colon(text: str) -> tuple[str | None, str | None]:
    index = _separator_index(text, ":")
    if index < 0:
        return None, None
    return text[:index], text[index + 1 :]


def _separator_index(text: str, separator: str) -> int:
    depth = 0
    index = 0
    while index < len(text):
        char = text[index]
        if char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        elif depth == 0 and text.startswith(separator, index):
            if separator == ":" and index + 1 < len(text) and text[index + 1] == "=":
                index += 2
                continue
            return index
        index += 1
    return -1


def _is_word(text: str, index: int, word: str) -> bool:
    if not text.lower().startswith(word, index):
        return False
    before_ok = index == 0 or not (text[index - 1].isalnum() or text[index - 1] == "_")
    after = index + len(word)
    after_ok = after >= len(text) or not (text[after].isalnum() or text[after] == "_")
    return before_ok and after_ok


def _blank_comments_and_strings(text: str) -> str:
    chars = list(text)
    index = 0
    while index < len(chars):
        if chars[index] == "-" and index + 1 < len(chars) and chars[index + 1] == "-":
            while index < len(chars) and chars[index] != "\n":
                chars[index] = " "
                index += 1
            continue
        if chars[index] == '"':
            chars[index] = " "
            index += 1
            while index < len(chars):
                if chars[index] == '"' and index + 1 < len(chars) and chars[index + 1] == '"':
                    chars[index] = " "
                    chars[index + 1] = " "
                    index += 2
                    continue
                if chars[index] == '"':
                    chars[index] = " "
                    index += 1
                    break
                if chars[index] != "\n":
                    chars[index] = " "
                index += 1
            continue
        if chars[index] == "'" and index + 2 < len(chars) and chars[index + 2] == "'" and chars[index + 1] != "'":
            chars[index] = chars[index + 1] = chars[index + 2] = " "
            index += 3
            continue
        index += 1
    return "".join(chars)


def _strip_comments(text: str) -> str:
    chars = list(text)
    index = 0
    while index < len(chars):
        if chars[index] == "-" and index + 1 < len(chars) and chars[index + 1] == "-":
            while index < len(chars) and chars[index] != "\n":
                chars[index] = " "
                index += 1
            continue
        if chars[index] == '"':
            index += 1
            while index < len(chars):
                if chars[index] == '"' and index + 1 < len(chars) and chars[index + 1] == '"':
                    index += 2
                    continue
                if chars[index] == '"':
                    index += 1
                    break
                index += 1
            continue
        index += 1
    return "".join(chars)


def _collapse(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _line_number(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def _set_status_from_errors(unit: ExtractedUnit) -> None:
    if unit.parse_status == "skipped":
        return
    if any(item.severity == "error" for item in unit.diagnostics):
        unit.parse_status = "partial"


def _diagnostic(severity: Severity, code: str, message: str, line: int | None) -> Diagnostic:
    return Diagnostic(severity=severity, code=code, message=message, line=line)
