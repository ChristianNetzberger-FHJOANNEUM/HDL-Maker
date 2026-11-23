"""Find GTKWave and start it without waiting.

The executable path is local tool configuration. A missing program, a path
that is not a file, or a missing waveform is reported. No signal name is
invented to fill a gap in the prepared map.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

from app.models.design import Diagnostic
from app.storage.tools_store import load_tools

_UNMAPPED_LIMIT = 50


def resolve_gtkwave(configured: str | None = None) -> tuple[str | None, str | None]:
    """Return ``(executable, problem)``.

    A configured path is used as given. It is not replaced by ``PATH`` when
    the file is missing. An empty setting searches ``PATH``.
    """
    text = load_tools().gtkwave_path if configured is None else configured
    text = text.strip()
    if text:
        if Path(text).is_file():
            return str(Path(text)), None
        return None, "invalid_gtkwave_path"
    found = shutil.which("gtkwave")
    if found:
        return found, None
    return None, "gtkwave_missing"


def launch_viewer(executable: str, arguments: list[str], cwd: Path) -> int:
    """Start a viewer and return its pid. The caller does not wait.

    On Windows the process is detached from this console and process group,
    so closing the API process does not wait for GTKWave and does not send
    it the server's console control events.
    """
    kwargs: dict = {
        "cwd": str(cwd),
        "shell": False,
        "stdin": subprocess.DEVNULL,
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
        "close_fds": True,
    }
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True
    process = subprocess.Popen([executable, *arguments], **kwargs)
    return process.pid


def diagnose_signal_map(waveform: Path, signal_map: list[dict]) -> list[Diagnostic]:
    """Compare the prepared map with names actually stored in a VCD file.

    GHW is binary. Its names are not guessed. A VCD name with no object id
    is reported and is not given one.
    """
    if waveform.suffix.lower() != ".vcd":
        return [
            Diagnostic(
                severity="info",
                code="waveform_names_unchecked",
                message="GHW signal names were not read back from the waveform. The prepared map was not changed.",
                path=str(waveform),
            )
        ]
    names = vcd_signal_names(waveform)
    if names is None:
        return [
            Diagnostic(
                severity="info",
                code="waveform_names_unreadable",
                message="The VCD header could not be read. The prepared map was not changed.",
                path=str(waveform),
            )
        ]
    present = {_hierarchy_key(name) for name in names}
    diagnostics: list[Diagnostic] = []
    for row in signal_map:
        stored = str(row.get("vhdl_path") or "")
        if _hierarchy_key(stored) in present:
            continue
        diagnostics.append(
            Diagnostic(
                severity="info",
                code="signal_not_in_waveform",
                message=f"{stored} is not a name in the VCD file.",
                path=stored,
                unit_id=str(row.get("object_id") or "") or None,
            )
        )
    mapped = {_hierarchy_key(str(row.get("vhdl_path") or "")) for row in signal_map}
    missing = [name for name in names if _hierarchy_key(name) not in mapped]
    for name in missing[:_UNMAPPED_LIMIT]:
        diagnostics.append(
            Diagnostic(
                severity="info",
                code="unmapped_waveform_signal",
                message=f"{name} is in the VCD file and has no HDL-Maker object id.",
                path=name,
            )
        )
    if len(missing) > _UNMAPPED_LIMIT:
        diagnostics.append(
            Diagnostic(
                severity="info",
                code="unmapped_waveform_signal",
                message=f"{len(missing) - _UNMAPPED_LIMIT} further VCD names have no HDL-Maker object id.",
                path=str(waveform),
            )
        )
    return diagnostics


def vcd_signal_names(path: Path) -> list[str] | None:
    """Hierarchical names from the VCD header, up to ``$enddefinitions``."""
    names: list[str] = []
    stack: list[str] = []
    try:
        handle = path.open(encoding="utf-8", errors="replace")
    except OSError:
        return None
    with handle:
        for line in handle:
            text = line.strip()
            if text.startswith("$scope"):
                parts = text.split()
                if len(parts) >= 3:
                    stack.append(parts[2])
            elif text.startswith("$upscope"):
                if stack:
                    stack.pop()
            elif text.startswith("$var"):
                parts = text.split()
                if len(parts) >= 5:
                    names.append(".".join([*stack, parts[4]]))
            elif text.startswith("$enddefinitions"):
                break
    return names


def _hierarchy_key(value: str) -> str:
    text = value.strip().replace("\\", "/")
    if text.startswith("/"):
        text = text[1:]
    return text.replace("/", ".").lower()
