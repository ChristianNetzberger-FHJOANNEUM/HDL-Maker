"""Names instantiated by one architecture.

This is the same information Vivado uses before elaboration: a component
instantiation and a direct entity instantiation. A component name binds to
the entity of the same name in this library. ``work`` means that library.
Another library prefix is kept as ``library.entity`` and is not rewritten
into a local entity. A component declaration, a signal declaration, and a
configuration specification are not instantiations. An instantiation
without a port or generic map is not recorded.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_INST_RE = re.compile(
    r"""(?ix)
    \b(?P<label>[A-Za-z]\w*)\s*:\s*
    (?:(?P<binding>entity|component|configuration)\s+)?
    (?:(?P<library>[A-Za-z]\w*)\s*\.\s*)?
    (?P<unit>[A-Za-z]\w*)
    (?:\s*\(\s*(?P<architecture>[A-Za-z]\w*)\s*\))?
    """
)
_LABEL_WORDS = {
    "alias",
    "all",
    "architecture",
    "assert",
    "attribute",
    "begin",
    "block",
    "case",
    "component",
    "configuration",
    "constant",
    "disconnect",
    "end",
    "entity",
    "file",
    "for",
    "function",
    "generate",
    "generic",
    "group",
    "if",
    "impure",
    "map",
    "package",
    "port",
    "procedure",
    "process",
    "pure",
    "report",
    "return",
    "signal",
    "subtype",
    "type",
    "variable",
    "wait",
    "when",
    "with",
}
_UNIT_WORDS = {
    "and",
    "block",
    "buffer",
    "downto",
    "generate",
    "generic",
    "in",
    "inout",
    "is",
    "linkage",
    "map",
    "nand",
    "nor",
    "not",
    "of",
    "or",
    "out",
    "port",
    "process",
    "select",
    "to",
    "xnor",
    "xor",
}
_FOLLOWS = re.compile(r"(?i)\s*(?:generic|port)\s+map\b")


@dataclass(frozen=True)
class InstantiationSite:
    label: str
    library: str | None
    unit: str


def instantiation_sites(architecture_body: str) -> list[InstantiationSite]:
    """Each direct or component instantiation, in source order."""
    found: list[InstantiationSite] = []
    for match in _INST_RE.finditer(architecture_body):
        label = match.group("label")
        unit = match.group("unit")
        if label.lower() in _LABEL_WORDS or unit.lower() in _UNIT_WORDS:
            continue
        if _FOLLOWS.match(architecture_body, match.end()) is None:
            continue
        library = match.group("library")
        if library and library.lower() == "work":
            library = None
        found.append(InstantiationSite(label=label, library=library, unit=unit))
    return found


def instantiation_names(architecture_body: str) -> list[str]:
    """Return instantiated design names in source order, without duplicates."""
    found: list[str] = []
    seen: set[str] = set()
    for site in instantiation_sites(architecture_body):
        name = f"{site.library}.{site.unit}" if site.library else site.unit
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        found.append(name)
    return found
