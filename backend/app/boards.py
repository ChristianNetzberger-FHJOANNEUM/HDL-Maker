"""Catalog of Vivado board definitions under ``boardfiles/``.

Each ``board.xml`` is one selectable profile. The part number and the
revisions are copied from that file. Nothing is inferred when an attribute
is absent.
"""

from __future__ import annotations

import os
from pathlib import Path
from xml.etree import ElementTree

from pydantic import BaseModel, ConfigDict

from app.paths import boardfiles_dir


class BoardProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    display_name: str
    vendor: str
    file_version: str
    revisions: list[str]
    part_names: list[str]


class BoardCatalog(BaseModel):
    boards: list[BoardProfile]
    unreadable: list[str]


def list_boards() -> BoardCatalog:
    root = boardfiles_dir()
    boards: list[BoardProfile] = []
    unreadable: list[str] = []
    if not root.is_dir():
        return BoardCatalog(boards=[], unreadable=[])
    for path in _board_files(root):
        relative = path.relative_to(root).as_posix()
        try:
            boards.append(_read_board(path, relative))
        except (ElementTree.ParseError, OSError, ValueError):
            unreadable.append(relative)
    boards.sort(key=lambda board: (board.display_name.casefold(), board.id))
    return BoardCatalog(boards=boards, unreadable=unreadable)


def _board_files(root: Path) -> list[Path]:
    found: list[Path] = []
    for directory, dirnames, filenames in os.walk(root, followlinks=False):
        dirnames[:] = [name for name in dirnames if not name.startswith(".")]
        if "board.xml" in filenames:
            found.append(Path(directory) / "board.xml")
    return found


def _read_board(path: Path, relative: str) -> BoardProfile:
    board = ElementTree.parse(path).getroot()
    if board.tag != "board":
        raise ValueError(relative)
    revisions = [
        text.strip()
        for revision in board.findall("compatible_board_revisions/revision")
        if (text := (revision.text or "").strip())
    ]
    parts = [
        part
        for component in board.findall("components/component")
        if component.get("type") == "fpga" and (part := (component.get("part_name") or "").strip())
    ]
    name = board.get("name") or ""
    display = board.get("display_name") or name or relative
    version = (board.findtext("file_version") or "").strip()
    return BoardProfile(
        id=relative,
        name=name,
        display_name=display,
        vendor=board.get("vendor") or "",
        file_version=version,
        revisions=revisions,
        part_names=parts,
    )
