"""Immutable build files and separate hardware-validation records.

A build directory is created once. A later build does not replace it. The
manifest names the build, the toolchain, the part, the VHDL standard, and the
bitstream hash. A passed build is not a hardware test. JTAG detection,
SRAM programming, and an observed board function are recorded on their own.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
from datetime import datetime
from pathlib import Path

from app.identity import new_id
from app.paths import builds_dir, hardware_dir

# The O2b SRAM load and the M5b Vivado load. The hashes are the files that
# were programmed, not a later rebuild of the same counter.
_OPENSOURCE_PROGRAMMED = {
    "build_id": "osb_574eb1ad8c3b4ac8a36b359745d3534d",
    "toolchain": "opensource",
    "part": "xc7z020clg400-1",
    "vhdl_standard": "93",
    "bitstream_sha256": "277aa58dfbfe90b207da7c44d648232af4358162a2210c58ed57aece2abad88e",
    "bitstream_bytes": 4045674,
    "evidence": "O2b SRAM load on 23 November 2026. Exit 0, JTAG done 1. DONE LED green. LED0 about 1 s.",
}
_VIVADO_PROGRAMMED = {
    "build_id": "bld_34d0198b02b84f73b25a8aa305579d5a",
    "toolchain": "vivado",
    "part": "xc7z020clg400-1",
    "vhdl_standard": "93",
    "bitstream_sha256": "3ccfd8c0916b8619dc565a957146c8057d81eaaf456b5bd6025407deb7dc81c7",
    "bitstream_bytes": 4045672,
    "evidence": "M5b JTAG load on 23 November 2026. DONE HIGH. DONE LED green. LED0 about 1 s.",
}

_SLICE_LUTS = re.compile(r"^\|\s+Slice LUTs\s+\|\s+(\d+)\s+\|", re.M)
_SLICE_REGS = re.compile(r"^\|\s+Slice Registers\s+\|\s+(\d+)\s+\|", re.M)
_CARRY4 = re.compile(r"^\|\s+CARRY4\s+\|\s+(\d+)\s+\|", re.M)
_SLACK = re.compile(
    r"^\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+\d+\s+\d+\s+(-?\d+\.\d+)\s+",
    re.M,
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def reserve_build_directory(directory: Path) -> None:
    """Create a build directory. An existing one is left as it is."""
    if directory.exists():
        from app.fpga.vivado import FpgaRequestError

        raise FpgaRequestError(
            "build_exists",
            "That build directory already exists. It was not overwritten.",
        )
    directory.mkdir(parents=True, exist_ok=False)


def archive_build(source: Path, destination: Path) -> bool:
    """Copy a finished build. An existing destination is left unchanged."""
    if destination.exists():
        return False
    shutil.copytree(source, destination)
    return True


def attach_bitstream(run: dict) -> None:
    raw = run.get("bitstream_path")
    path = Path(raw) if raw else None
    if path is None or not path.is_file():
        run["bitstream_sha256"] = None
        return
    run["bitstream_sha256"] = sha256_file(path)
    run["bitstream_bytes"] = path.stat().st_size


def manifest_fields(run: dict) -> dict:
    return {
        "build_id": run.get("build_id"),
        "toolchain": run.get("toolchain") or "vivado",
        "part": run.get("part") or "",
        "vhdl_standard": run.get("vhdl_standard") or "",
        "bitstream_sha256": run.get("bitstream_sha256"),
        "bitstream_bytes": run.get("bitstream_bytes"),
        "bitstream_path": run.get("bitstream_path"),
        "status": run.get("status"),
    }


def write_manifest(directory: Path, run: dict) -> None:
    path = directory / "manifest.json"
    current: dict = {}
    if path.is_file():
        try:
            loaded = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                current = loaded
        except (OSError, json.JSONDecodeError):
            current = {}
    current.update(manifest_fields(run))
    path.write_text(json.dumps(current, indent=2) + "\n", encoding="utf-8")


def validations_dir() -> Path:
    path = hardware_dir() / "validations"
    path.mkdir(parents=True, exist_ok=True)
    return path


def list_validations() -> list[dict]:
    _ensure_history()
    found: list[dict] = []
    root = validations_dir()
    for path in sorted(root.glob("*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(payload, dict):
            found.append(payload)
    return found


def validation_for_build(build_id: str | None, run_status: str | None) -> dict:
    """Four states. A passed build fills only the build state."""
    matched = [item for item in list_validations() if item.get("build_id") == build_id]

    def tri(name: str):
        values = [item.get(name) for item in matched if item.get(name) is not None]
        if True in values:
            return True
        if False in values:
            return False
        return None

    if run_status == "passed":
        build_passed = True
    elif run_status == "failed":
        build_passed = False
    else:
        build_passed = tri("build_passed")
    return {
        "build_passed": build_passed,
        "jtag_detected": tri("jtag_detected"),
        "programming_completed": tri("programming_completed"),
        "hardware_function_verified": tri("hardware_function_verified"),
    }


def note_jtag_detect(scan: dict) -> None:
    """A real scan that listed devices. A mock scan writes nothing."""
    if scan.get("mock") or scan.get("status") != "devices":
        return
    _write_new(
        {
            "build_id": None,
            "toolchain": "opensource",
            "part": scan.get("part") or "",
            "vhdl_standard": "",
            "bitstream_path": None,
            "bitstream_sha256": None,
            "bitstream_bytes": None,
            "file_present": False,
            "build_passed": None,
            "jtag_detected": True,
            "programming_completed": None,
            "hardware_function_verified": None,
            "evidence": "JTAG detect only. SRAM was not written.",
            "serial": scan.get("serial") or "",
            "devices": [
                {"name": item.get("name"), "part": item.get("part"), "raw_idcode": item.get("raw_idcode")}
                for item in scan.get("devices") or []
            ],
        }
    )


def note_sram_programmed(program: dict) -> None:
    """A real SRAM load. The board function is still not claimed."""
    if program.get("mock") or not program.get("programmed"):
        return
    bitstream = Path(str(program.get("bitstream_path") or ""))
    digest = sha256_file(bitstream) if bitstream.is_file() else None
    _write_new(
        {
            "build_id": program.get("build_id"),
            "toolchain": "opensource",
            "part": program.get("part") or "",
            "vhdl_standard": "",
            "bitstream_path": str(bitstream) if bitstream else None,
            "bitstream_sha256": digest,
            "bitstream_bytes": bitstream.stat().st_size if bitstream.is_file() else None,
            "file_present": bitstream.is_file(),
            "build_passed": True,
            "jtag_detected": True,
            "programming_completed": True,
            "hardware_function_verified": None,
            "evidence": "SRAM load finished. The DONE LED and the design function were not observed from this record.",
            "serial": program.get("serial") or "",
        }
    )


def summarize_build(run: dict | None) -> dict | None:
    if not run:
        return None
    toolchain = run.get("toolchain") or "vivado"
    directory = Path(run["directory"]) if run.get("directory") else None
    if toolchain == "opensource":
        report = (run.get("reports") or {}).get("nextpnr") or {}
        resources = {
            "slice_lutx": report.get("slice_lutx"),
            "slice_ffx": report.get("slice_ffx"),
            "carry4": report.get("carry4"),
        }
        timing = {
            "critical_path_ns": report.get("critical_path_ns"),
            "max_frequency_mhz": report.get("max_frequency_mhz"),
            "method": "nextpnr critical path",
        }
        warnings = [
            item.get("message")
            for item in run.get("diagnostics") or []
            if isinstance(item, dict) and item.get("severity") == "warning"
        ]
    else:
        resources, timing = _vivado_numbers(directory)
        warnings = [item for item in run.get("warnings") or [] if isinstance(item, str)]
    digest = run.get("bitstream_sha256")
    bitstream = Path(run["bitstream_path"]) if run.get("bitstream_path") else None
    if digest is None and bitstream is not None and bitstream.is_file():
        digest = sha256_file(bitstream)
    return {
        "build_id": run.get("build_id"),
        "toolchain": toolchain,
        "part": run.get("part") or "",
        "vhdl_standard": run.get("vhdl_standard") or "",
        "status": run.get("status"),
        "elapsed_seconds": run.get("elapsed_seconds") if run.get("elapsed_seconds") is not None else _elapsed(run),
        "bitstream_path": run.get("bitstream_path"),
        "bitstream_sha256": digest,
        "bitstream_bytes": run.get("bitstream_bytes"),
        "resources": resources,
        "timing": timing,
        "warnings": warnings,
        "validation": validation_for_build(run.get("build_id"), run.get("status")),
    }


def comparison() -> dict:
    from app.fpga.opensource import latest_build as latest_open
    from app.fpga.vivado import latest_build as latest_vivado

    return {
        "timing_note": "Vivado reports slack (WNS). The open-source flow reports the nextpnr critical path. Those numbers are not the same measurement.",
        "resource_note": "Vivado counts Slice LUTs and registers after implementation. nextpnr counts SLICE_LUTX and SLICE_FFX.",
        "vivado": summarize_build(_passed_bitstream(latest_vivado())),
        "opensource": summarize_build(_passed_bitstream(latest_open())),
        "validations": list_validations(),
    }


def _passed_bitstream(run: dict | None) -> dict | None:
    if not run or run.get("status") != "passed" or not run.get("bitstream_path"):
        return None
    return run


def _vivado_numbers(directory: Path | None) -> tuple[dict, dict]:
    resources = {"slice_luts": None, "slice_registers": None, "carry4": None}
    timing = {"wns_ns": None, "whs_ns": None, "method": "Vivado slack"}
    if directory is None:
        return resources, timing
    util = directory / "utilization_impl.rpt"
    if util.is_file():
        text = util.read_text(encoding="utf-8", errors="replace")
        luts = _SLICE_LUTS.search(text)
        regs = _SLICE_REGS.search(text)
        carry = _CARRY4.search(text)
        if luts:
            resources["slice_luts"] = int(luts.group(1))
        if regs:
            resources["slice_registers"] = int(regs.group(1))
        if carry:
            resources["carry4"] = int(carry.group(1))
    timing_path = directory / "timing_impl.rpt"
    if timing_path.is_file():
        found = _SLACK.search(timing_path.read_text(encoding="utf-8", errors="replace"))
        if found:
            timing["wns_ns"] = float(found.group(1))
            timing["whs_ns"] = float(found.group(3))
    return resources, timing


def _elapsed(run: dict) -> float | None:
    try:
        start = datetime.fromisoformat(run["started_at"])
        end = datetime.fromisoformat(run["finished_at"])
    except (KeyError, TypeError, ValueError):
        return None
    return round((end - start).total_seconds(), 3)


def _ensure_history() -> None:
    for known in (_VIVADO_PROGRAMMED, _OPENSOURCE_PROGRAMMED):
        if _history_recorded(known["build_id"]):
            continue
        _write_history(known, _find_hash(known["bitstream_sha256"]))


def _history_recorded(build_id: str) -> bool:
    root = validations_dir()
    for path in root.glob("*.json"):
        try:
            current = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if (
            isinstance(current, dict)
            and current.get("build_id") == build_id
            and current.get("hardware_function_verified") is True
        ):
            return True
    return False


def _find_hash(digest: str) -> Path | None:
    root = builds_dir()
    if not root.is_dir():
        return None
    for path in root.rglob("*.bit"):
        if path.is_file() and sha256_file(path) == digest:
            return path
    return None


def _write_history(known: dict, found: Path | None) -> None:
    payload = {
        "validation_id": new_id("val"),
        "build_id": known["build_id"],
        "toolchain": known["toolchain"],
        "part": known["part"],
        "vhdl_standard": known["vhdl_standard"],
        "bitstream_path": str(found) if found else None,
        "bitstream_sha256": known["bitstream_sha256"],
        "bitstream_bytes": known["bitstream_bytes"],
        "file_present": found is not None,
        "build_passed": True,
        "jtag_detected": True,
        "programming_completed": True,
        "hardware_function_verified": True,
        "evidence": known["evidence"],
    }
    _write_new(payload)


def _write_new(payload: dict) -> None:
    validation_id = payload.get("validation_id") or new_id("val")
    payload["validation_id"] = validation_id
    payload.setdefault("recorded_at", datetime.now().astimezone().isoformat())
    path = validations_dir() / f"{validation_id}.json"
    if path.exists():
        return
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
