"""Tiny ``._epf`` view-reference files.

The samples in this library are two lines, for example::

    DEFAULT_FILE atom audio_gain/struct.bd
    DEFAULT_ARCHITECTURE atom struct
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ViewReference:
    path: str
    default_file: str | None = None
    default_architecture: str | None = None
    unrecognized_lines: list[str] | None = None


def parse_view_reference(path: str, text: str) -> ViewReference:
    reference = ViewReference(path=path, unrecognized_lines=[])
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        parts = line.split(maxsplit=2)
        if len(parts) == 3 and parts[1] == "atom" and parts[0] == "DEFAULT_FILE":
            reference.default_file = parts[2]
            continue
        if len(parts) == 3 and parts[1] == "atom" and parts[0] == "DEFAULT_ARCHITECTURE":
            reference.default_architecture = parts[2]
            continue
        reference.unrecognized_lines.append(line)
    return reference
