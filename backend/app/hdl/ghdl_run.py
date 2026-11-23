"""GHDL command flags shared by generation and the legacy validation runner.

The language standard and the library profile are independent. The IEEE profile
passes only ``--std``. The Synopsys legacy profile adds the two GHDL options
required to analyze the historical packages without editing the VHDL text.
"""

from __future__ import annotations

import shutil
import subprocess
import threading
import time
from typing import Literal

from app.hdl.vhdl import VhdlStandard

LibraryProfile = Literal["ieee", "synopsys"]
GhdlStatus = Literal["not_run", "passed", "failed"]


def ghdl_prefix(standard: VhdlStandard, profile: LibraryProfile) -> list[str]:
    prefix = ["--std=93" if standard == "93" else "--std=08"]
    if profile == "synopsys":
        # -fsynopsys exposes std_logic_arith and std_logic_unsigned.
        # GHDL 6.0.0 then reports an overloaded "=" and names -fexplicit.
        # Both flags are passed on analysis, elaboration, and simulation.
        prefix.extend(["-fsynopsys", "-fexplicit"])
    return prefix


def run_ghdl(
    args: list[str],
    workdir,
    timeout: int = 60,
    cancel: threading.Event | None = None,
) -> tuple[int | None, str]:
    """Run one GHDL invocation. The source files are only read.

    The argument list is passed to the process directly. The shell is not used.
    """
    executable = shutil.which("ghdl")
    if executable is None:
        return None, "ghdl was not found on PATH."
    try:
        process = subprocess.Popen(
            [executable, *args],
            cwd=workdir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            shell=False,
        )
    except OSError as exc:
        return 1, str(exc)
    stdout: list[str] = []
    stderr: list[str] = []
    threads = [
        threading.Thread(target=_drain, args=(process.stdout, stdout), daemon=True),
        threading.Thread(target=_drain, args=(process.stderr, stderr), daemon=True),
    ]
    for thread in threads:
        thread.start()
    deadline = time.monotonic() + timeout
    while process.poll() is None:
        if cancel is not None and cancel.is_set():
            _stop(process)
            _join(threads)
            return 1, "Cancelled."
        if time.monotonic() >= deadline:
            _stop(process)
            _join(threads)
            return 1, f"Timed out after {timeout}s."
        time.sleep(0.05)
    _join(threads)
    detail = ("".join(stderr) or "".join(stdout) or "").strip()
    return process.returncode, detail[:4000]


def _drain(pipe, bucket: list[str]) -> None:
    if pipe is None:
        return
    bucket.append(pipe.read())


def _join(threads: list[threading.Thread]) -> None:
    for thread in threads:
        thread.join(timeout=2)


def _stop(process: subprocess.Popen) -> None:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)
