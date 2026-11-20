"""Repository and workspace locations.

The workspace directory holds generated project state. Original HDL libraries
are never copied or modified; the project file only records paths.
"""

from __future__ import annotations

import os
from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def workspace_dir() -> Path:
    override = os.environ.get("HDS_WORKSPACE")
    path = Path(override) if override else repo_root() / "workspace"
    path.mkdir(parents=True, exist_ok=True)
    return path


def project_file() -> Path:
    return workspace_dir() / "project.json"


def examples_dir() -> Path:
    return repo_root() / "examples"
