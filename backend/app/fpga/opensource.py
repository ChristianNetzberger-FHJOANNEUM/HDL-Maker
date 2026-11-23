"""Open-source FPGA builds for VHDL-93.

GHDL writes Verilog, Yosys synthesizes it, nextpnr-xilinx places and routes,
and Project X-Ray writes the bitstream. The chain does not call Vivado. VHDL-2008
is refused because that standard has not been run through these five stages.
Pin locations, I/O standards, and clock periods come from the selected XDC files.
"""

from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import threading
from datetime import datetime, timezone
from pathlib import Path

from app.fpga.constraints import check_constraints
from app.fpga.vivado import FpgaRequestError, _name_diagnostics, _settings_diagnostics
from app.hdl.simulate import resolve_entity
from app.identity import new_id
from app.models.design import DesignUnit, Diagnostic, FpgaBuildConfig, ProjectFile
from app.paths import builds_dir, workspace_dir
from app.storage.tools_store import OpenSourceSettings, load_opensource_tools

STAGES = ("ghdl", "yosys", "nextpnr", "fasm2frames", "xc7frames2bit")
_PART_KEY = re.compile(r"^(\S+):\s*$")
_PERIOD = re.compile(r"-period\s+([0-9]*\.?[0-9]+(?:[eE][-+]?\d+)?)", re.IGNORECASE)
_CREATE_CLOCK = re.compile(r"\bcreate_clock\b", re.IGNORECASE)
_IGNORED_OPTION = re.compile(r"-(?:name|waveform)\b", re.IGNORECASE)
_RUNS: dict[str, dict] = {}
_LOCK = threading.Lock()
_BUSY = False


def probe_opensource(settings: OpenSourceSettings | None = None) -> dict:
    """Check the five tools and locate the zynq7 database. Nothing is synthesized."""
    chosen = settings or load_opensource_tools()
    tools: dict[str, dict] = {}
    for name, configured, lookup in (
        ("ghdl", chosen.ghdl_path, "ghdl"),
        ("yosys", chosen.yosys_path, "yosys"),
        ("nextpnr_xilinx", chosen.nextpnr_xilinx_path, "nextpnr-xilinx"),
        ("fasm2frames", chosen.fasm2frames_path, "fasm2frames"),
        ("xc7frames2bit", chosen.xc7frames2bit_path, "xc7frames2bit"),
    ):
        path, problem = _resolve_tool(configured, lookup, name)
        version = None
        if path is not None:
            version, version_problem = _tool_version(name, path)
            if version is None and problem is None:
                problem = version_problem or "tool_failed"
        tools[name] = {"path": path, "version": version, "ok": path is not None and version is not None, "code": problem}
    database = _describe_database(chosen, tools["nextpnr_xilinx"]["path"])
    ready = all(item["ok"] for item in tools.values()) and database["zynq7"] is not None
    return {"ok": ready, "toolchain": "opensource", "tools": tools, "database": database}


def launch_build(project: ProjectFile, config: FpgaBuildConfig) -> dict:
    if not _acquire():
        raise FpgaRequestError("build_busy", "An open-source FPGA build is already running.")
    try:
        run, plan = _prepare(project, config)
    except Exception:
        _release()
        raise
    if run["status"] == "failed":
        _release()
        return run
    thread = threading.Thread(target=_worker, args=(run, plan), daemon=True)
    thread.start()
    return run


def run_build(project: ProjectFile, config: FpgaBuildConfig) -> dict:
    """Prepare and run in this thread. Tests use this. The API uses ``launch_build``."""
    run, plan = _prepare(project, config)
    if run["status"] == "failed":
        return run
    return execute_build(run, plan)


def execute_build(run: dict, plan: dict) -> dict:
    directory = Path(run["directory"])
    _require_workspace(directory)
    stages = ["ghdl", "yosys"] if run["target"] == "synthesis" else list(STAGES)
    for name in stages:
        run["stages"][name] = "running"
        _store(run)
        started = _clock()
        try:
            ok, message = _STAGE_RUNNERS[name](run, plan, directory)
        except subprocess.TimeoutExpired:
            ok, message = False, f"{name} exceeded its time limit."
        except OSError as exc:
            ok, message = False, str(exc)
        run["stage_seconds"][name] = round(_clock() - started, 3)
        if not ok:
            run["stages"][name] = "failed"
            run["status"] = "failed"
            run["diagnostics"].append(_error(f"{name}_failed", message or f"{name} failed.", None).model_dump(mode="json"))
            return _finish(run)
        run["stages"][name] = "passed"
        _store(run)
    run["status"] = "passed"
    return _finish(run)


def build_run(build_id: str) -> dict | None:
    with _LOCK:
        cached = _RUNS.get(build_id)
    if cached is not None:
        return cached
    return _read_report(builds_dir() / build_id)


def latest_build() -> dict | None:
    with _LOCK:
        if _RUNS:
            return max(_RUNS.values(), key=lambda item: item["started_at"])
    root = builds_dir()
    if not root.is_dir():
        return None
    found: list[dict] = []
    for path in root.iterdir():
        payload = _read_report(path)
        if payload is not None and payload.get("toolchain") == "opensource":
            found.append(payload)
    if not found:
        return None
    return max(found, key=lambda item: item.get("started_at") or "")


def parse_nextpnr_log(text: str) -> dict:
    """Numbers printed by nextpnr. Missing fields stay ``None``."""
    luts = re.search(r"SLICE_LUTX:\s+(\d+)/", text)
    flips = re.search(r"SLICE_FFX:\s+(\d+)/", text)
    carry = re.search(r"CARRY4:\s+(\d+)/", text)
    setups = re.findall(r"setup\s+[0-9.]+\s+([0-9.]+)\s+Source", text)
    pieces = re.findall(r"([0-9.]+) ns logic, ([0-9.]+) ns routing", text)
    frequencies = re.findall(r"Max frequency for clock .*?:\s*([0-9.]+) MHz", text)
    warnings = [line.strip() for line in text.splitlines() if "ignoring unsupported" in line.lower() or line.strip().startswith("Warning:")]
    return {
        "slice_lutx": int(luts.group(1)) if luts else None,
        "slice_ffx": int(flips.group(1)) if flips else None,
        "carry4": int(carry.group(1)) if carry else None,
        "critical_path_ns": float(setups[-1]) if setups else None,
        "logic_ns": float(pieces[-1][0]) if pieces else None,
        "routing_ns": float(pieces[-1][1]) if pieces else None,
        "max_frequency_mhz": float(frequencies[-1]) if frequencies else None,
        "warnings": warnings[:30],
    }


def parse_yosys_log(text: str) -> dict:
    cells: dict[str, int] = {}
    for count, name in re.findall(r"(?m)^\s+(\d+)\s+(FDRE|CARRY4|INV|BUFG|IBUF|OBUF)\s*$", text):
        cells[name] = int(count)
    return {"cells": cells}


def clock_period_ns(texts: list[str]) -> tuple[float | None, list[Diagnostic]]:
    """Read ``create_clock -period`` values. No period is invented."""
    periods: list[float] = []
    ignored: list[str] = []
    for text in texts:
        for raw in text.splitlines():
            line = raw.split("#", 1)[0].strip()
            if not line or not _CREATE_CLOCK.search(line):
                continue
            match = _PERIOD.search(line)
            if match is None:
                return None, [_error("clock_period_missing", "create_clock has no -period. No clock period was filled in.", None)]
            periods.append(float(match.group(1)))
            for option in _IGNORED_OPTION.findall(line):
                if option.lower() not in {item.lower() for item in ignored}:
                    ignored.append(option)
    if not periods:
        return None, [_error("clock_period_missing", "The XDC files have no create_clock -period. No clock period was filled in.", None)]
    unique = {round(item, 6) for item in periods}
    if len(unique) != 1:
        shown = ", ".join(str(item) for item in periods)
        return None, [_error("clock_period_ambiguous", f"The XDC files name more than one clock period: {shown}.", None)]
    diagnostics = []
    if ignored:
        diagnostics.append(
            Diagnostic(
                severity="warning",
                code="xdc_option_ignored",
                message=f"nextpnr ignores create_clock {' '.join(ignored)}. The period is passed as --freq.",
            )
        )
    return periods[0], diagnostics


def frequency_mhz(period_ns: float) -> str:
    freq = 1000.0 / period_ns
    return f"{freq:.6f}".rstrip("0").rstrip(".")


def _prepare(project: ProjectFile, config: FpgaBuildConfig) -> tuple[dict, dict]:
    run = _blank(config, project.vhdl_standard, project.library_profile)
    diagnostics = _settings_diagnostics(project, config)
    if project.vhdl_standard == "2008":
        diagnostics.append(
            _error(
                "vhdl2008_not_validated",
                "The open-source chain was validated for VHDL-93 only. VHDL-2008 was not run, and the VHDL-93 setting was not changed.",
                None,
            )
        )
    files = []
    top: DesignUnit | None = None
    if not any(item.code in {"top_missing", "top_not_vhdl"} for item in diagnostics):
        files, _signals, source_diagnostics = resolve_entity(
            project,
            config.top_unit_id,
            missing_code="top_missing",
            missing_message="Choose a VHDL top-level entity. The testbench and the hierarchy root are not used.",
            language_code="top_not_vhdl",
        )
        diagnostics.extend(source_diagnostics)
        top = next((unit for unit in project.design_units if unit.id == config.top_unit_id), None)
    if top is not None and not any(item.code in {"top_missing", "top_not_vhdl", "missing_dependency"} for item in diagnostics):
        diagnostics.extend(check_constraints(project, top, config.xdc_paths))
        diagnostics.extend(_name_diagnostics(top.name, config.part, files))
    settings = load_opensource_tools()
    resolved = _resolve_all(settings)
    for problem in resolved["problems"]:
        diagnostics.append(problem)
    period = None
    if not any(item.code in {"xdc_missing", "xdc_unreadable"} for item in diagnostics):
        texts, read_errors = _read_xdc(config.xdc_paths)
        diagnostics.extend(read_errors)
        if texts and not read_errors:
            period, period_diagnostics = clock_period_ns(texts)
            diagnostics.extend(period_diagnostics)
    family = None
    part_key = None
    part_yaml = None
    database_root = resolved["database_root"]
    if database_root is not None and not any(item.code in {"part_missing", "part_invalid", "part_conflict"} for item in diagnostics) and config.part:
        found = _family_for_part(database_root, config.part)
        if found["code"]:
            diagnostics.append(_error(found["code"], found["message"], str(database_root)))
        else:
            family = found["family"]
            part_key = found["part"]
            part_yaml = found["part_yaml"]
    if any(item.severity == "error" for item in diagnostics):
        run["status"] = "failed"
        run["diagnostics"] = [item.model_dump(mode="json") for item in diagnostics]
        run["finished_at"] = _now()
        _store(run)
        return run, {}
    assert top is not None and period is not None and family is not None and part_key is not None and part_yaml is not None
    directory = Path(run["directory"])
    _require_workspace(directory)
    directory.mkdir(parents=True, exist_ok=True)
    warnings = [item for item in diagnostics if item.severity == "warning"]
    run["diagnostics"] = [item.model_dump(mode="json") for item in warnings]
    run["top"] = top.name
    run["tools"] = resolved["tools"]
    run["inputs"] = _hash_inputs(files, config.xdc_paths)
    run["clock"] = {"period_ns": period, "frequency_mhz": frequency_mhz(period), "source": "create_clock -period"}
    run["database"] = {"root": str(database_root), "family": str(family), "part": part_key, "part_yaml": str(part_yaml)}
    _write_constraints(directory, config.xdc_paths)
    vhdl: list[str] = []
    seen_vhdl: set[str] = set()
    for item in files:
        key = str(Path(item.path).resolve()).casefold()
        if key in seen_vhdl:
            continue
        seen_vhdl.add(key)
        vhdl.append(str(Path(item.path)))
    plan = {
        "vhdl": vhdl,
        "top": top.name,
        "part": part_key,
        "frequency_mhz": run["clock"]["frequency_mhz"],
        "family": str(family),
        "part_yaml": str(part_yaml),
        "tools": {name: item["path"] for name, item in resolved["tools"].items()},
    }
    _store(run)
    return run, plan


def _resolve_all(settings: OpenSourceSettings) -> dict:
    problems: list[Diagnostic] = []
    tools: dict[str, dict] = {}
    specs = (
        ("ghdl", settings.ghdl_path, "ghdl"),
        ("yosys", settings.yosys_path, "yosys"),
        ("nextpnr_xilinx", settings.nextpnr_xilinx_path, "nextpnr-xilinx"),
        ("fasm2frames", settings.fasm2frames_path, "fasm2frames"),
        ("xc7frames2bit", settings.xc7frames2bit_path, "xc7frames2bit"),
    )
    for name, configured, lookup in specs:
        path, problem = _resolve_tool(configured, lookup, name)
        version = None
        if problem:
            problems.append(_tool_diagnostic(name, problem, configured or None))
        elif path is not None:
            version, version_problem = _tool_version(name, path)
            if version is None:
                problems.append(_error(f"{name}_failed", version_problem or f"{name} did not report a version.", path))
        tools[name] = {"path": path, "version": version}
    root, database_problem = _database_root(settings, tools["nextpnr_xilinx"]["path"])
    if database_problem == "invalid_database_path":
        problems.append(_error(database_problem, "The configured Project X-Ray database path is not a directory.", settings.prjxray_db_path))
    elif database_problem:
        problems.append(
            _error(
                database_problem,
                "The Project X-Ray database was not found beside nextpnr-xilinx. No other database was selected.",
                settings.prjxray_db_path or None,
            )
        )
    return {"tools": tools, "problems": problems, "database_root": root}


def _resolve_tool(configured: str, lookup: str, name: str) -> tuple[str | None, str | None]:
    text = configured.strip()
    if text:
        if Path(text).is_file():
            return str(Path(text)), None
        return None, "invalid_path"
    found = shutil.which(lookup) or shutil.which(f"{lookup}.exe")
    if found:
        return found, None
    return None, "missing"


def _tool_diagnostic(name: str, problem: str, path: str | None) -> Diagnostic:
    if problem == "invalid_path":
        return _error(f"invalid_{name}_path", f"The configured {name} path is not a file.", path)
    return _error(f"{name}_missing", f"{name} was not found. Set its path. Vivado is not used instead.", None)


def _tool_version(name: str, path: str) -> tuple[str | None, str | None]:
    if name == "ghdl":
        args = ["--version"]
    elif name == "yosys":
        args = ["-V"]
    elif name == "fasm2frames":
        args = ["--help"]
    else:
        args = ["--version"]
    try:
        code, output = _run(_argv(path, args), workspace_dir(), _child_env(Path(path), _extra_libs(name, Path(path))), 60)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return None, str(exc)
    text = output.strip()
    if name == "fasm2frames":
        if code != 0:
            return None, text[:500] or f"fasm2frames exited with status {code}."
        return _fasm_version(path) or "fasm2frames", None
    if code not in {0, 1} and name in {"nextpnr_xilinx", "xc7frames2bit"}:
        return None, text[:500] or f"{name} exited with status {code}."
    if code != 0 and name not in {"nextpnr_xilinx", "xc7frames2bit"}:
        return None, text[:500] or f"{name} exited with status {code}."
    line = next((item.strip() for item in text.splitlines() if item.strip()), "")
    if not line:
        return None, f"{name} printed no version."
    return line[:300], None


def _database_root(settings: OpenSourceSettings, nextpnr: str | None) -> tuple[Path | None, str | None]:
    configured = settings.prjxray_db_path.strip()
    if configured:
        path = Path(configured)
        if path.is_dir():
            return path, None
        return None, "invalid_database_path"
    if not nextpnr:
        return None, "database_missing"
    executable = Path(nextpnr).resolve()
    if len(executable.parents) < 2:
        return None, "database_missing"
    candidate = executable.parents[1] / "share" / "nextpnr" / "external" / "prjxray-db"
    if candidate.is_dir():
        return candidate, None
    return None, "database_missing"


def _fasm_version(executable: str) -> str | None:
    root = Path(executable).resolve()
    if len(root.parents) < 2:
        return None
    site = root.parents[1] / "lib" / "python3.12" / "site-packages"
    if not site.is_dir():
        return None
    for meta in site.glob("fasm-*.dist-info/METADATA"):
        for line in meta.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("Version:"):
                return f"fasm {line.split(':', 1)[1].strip()}"
    return None


def _describe_database(settings: OpenSourceSettings, nextpnr: str | None) -> dict:
    root, problem = _database_root(settings, nextpnr)
    zynq7 = None
    if root is not None:
        direct = root if root.name.casefold() == "zynq7" else root / "zynq7"
        if (direct / "mapping" / "devices.yaml").is_file():
            zynq7 = str(direct)
    return {"root": str(root) if root else None, "zynq7": zynq7, "code": problem}


def _family_for_part(root: Path, part: str) -> dict:
    families = _family_dirs(root)
    if not families:
        return {"code": "database_missing", "message": f"No Project X-Ray family map was found under {root}.", "family": None, "part": None, "part_yaml": None}
    matches = []
    for family in families:
        keys = _part_keys(family / "mapping" / "parts.yaml")
        exact = [key for key in keys if key == part]
        folded = [key for key in keys if key.casefold() == part.casefold()]
        if len(folded) > 1 and not exact:
            return {
                "code": "part_ambiguous",
                "message": f"Part '{part}' matches more than one database key. No part was selected.",
                "family": None,
                "part": None,
                "part_yaml": None,
            }
        chosen = exact[0] if exact else (folded[0] if len(folded) == 1 else None)
        if chosen is None:
            continue
        if not (family / "mapping" / "devices.yaml").is_file():
            return {
                "code": "database_missing",
                "message": f"The Project X-Ray family {family.name} has no mapping/devices.yaml.",
                "family": None,
                "part": None,
                "part_yaml": None,
            }
        part_yaml = family / chosen / "part.yaml"
        if not part_yaml.is_file():
            return {
                "code": "part_unknown",
                "message": f"Part '{chosen}' has no part.yaml in {family}. No other part was selected.",
                "family": None,
                "part": None,
                "part_yaml": None,
            }
        matches.append((family, chosen, part_yaml))
    if len(matches) == 1:
        family, chosen, part_yaml = matches[0]
        return {"code": None, "message": "", "family": family, "part": chosen, "part_yaml": part_yaml}
    if len(matches) > 1:
        return {
            "code": "database_ambiguous",
            "message": f"Part '{part}' is in more than one Project X-Ray family. No family was selected.",
            "family": None,
            "part": None,
            "part_yaml": None,
        }
    return {
        "code": "part_unknown",
        "message": f"Part '{part}' is not in the Project X-Ray database at {root}. No other part was selected.",
        "family": None,
        "part": None,
        "part_yaml": None,
    }


def _family_dirs(root: Path) -> list[Path]:
    if (root / "mapping" / "parts.yaml").is_file():
        return [root]
    return [child for child in sorted(root.iterdir()) if child.is_dir() and (child / "mapping" / "parts.yaml").is_file()]


def _part_keys(path: Path) -> list[str]:
    if not path.is_file():
        return []
    keys = []
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        match = _PART_KEY.match(raw.strip())
        if match and not raw.startswith(" "):
            keys.append(match.group(1).strip('"'))
    return keys


def _run_ghdl(run: dict, plan: dict, directory: Path) -> tuple[bool, str]:
    verilog = directory / f"{plan['top']}.v"
    command = _argv(plan["tools"]["ghdl"], ["--synth", "--std=93", "--out=verilog", *plan["vhdl"], "-e", plan["top"]])
    code, stdout, stderr = _run_split(command, directory, _child_env(Path(plan["tools"]["ghdl"])), 180)
    (directory / "ghdl.log").write_bytes(stderr)
    _record_command(run, "ghdl", command)
    if code != 0:
        return False, _tail(stderr) or f"GHDL exited with status {code}."
    text = stdout.decode("utf-8", errors="replace").lstrip("\ufeff")
    if "module" not in text:
        return False, "GHDL wrote no Verilog module."
    verilog.write_bytes(text.encode("utf-8"))
    run["outputs"]["verilog"] = str(verilog)
    return True, ""


def _run_yosys(run: dict, plan: dict, directory: Path) -> tuple[bool, str]:
    script = directory / "yosys.ys"
    script.write_text(
        "\n".join(
            [
                f"read_verilog {plan['top']}.v",
                f"synth_xilinx -flatten -abc9 -arch xc7 -top {plan['top']} -json {plan['top']}.json",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    command = _argv(plan["tools"]["yosys"], ["-l", "yosys.log", "-s", "yosys.ys"])
    code, output = _run(command, directory, _child_env(Path(plan["tools"]["yosys"]), _extra_libs("yosys", Path(plan["tools"]["yosys"]))), 600)
    log = directory / "yosys.log"
    if not log.is_file():
        log.write_text(output, encoding="utf-8")
    elif output.strip():
        log.write_text(log.read_text(encoding="utf-8", errors="replace") + "\n" + output, encoding="utf-8")
    _record_command(run, "yosys", command)
    netlist = directory / f"{plan['top']}.json"
    if code != 0:
        return False, _tail(output.encode("utf-8")) or f"Yosys exited with status {code}."
    if not netlist.is_file() or netlist.stat().st_size == 0:
        return False, "Yosys finished without a netlist."
    run["outputs"]["netlist"] = str(netlist)
    run["reports"]["yosys"] = parse_yosys_log(log.read_text(encoding="utf-8", errors="replace"))
    return True, ""


def _run_nextpnr(run: dict, plan: dict, directory: Path) -> tuple[bool, str]:
    command = _argv(
        plan["tools"]["nextpnr_xilinx"],
        [
            "--device",
            plan["part"],
            "--json",
            f"{plan['top']}.json",
            "--top",
            plan["top"],
            "--freq",
            plan["frequency_mhz"],
            "-o",
            "xdc=constraints.xdc",
            "-o",
            f"fasm={plan['top']}.fasm",
            "--report",
            "nextpnr-report.json",
            "-l",
            "nextpnr.log",
        ],
    )
    code, output = _run(command, directory, _child_env(Path(plan["tools"]["nextpnr_xilinx"])), 900)
    log = directory / "nextpnr.log"
    if log.is_file() and log.stat().st_size > 0:
        text = log.read_text(encoding="utf-8", errors="replace")
    else:
        text = output
        log.write_text(text, encoding="utf-8")
    _record_command(run, "nextpnr", command)
    parsed = parse_nextpnr_log(text)
    run["reports"]["nextpnr"] = parsed
    for line in parsed["warnings"]:
        run["diagnostics"].append(
            Diagnostic(severity="warning", code="xdc_option_ignored", message=line[:500]).model_dump(mode="json")
        )
    fasm = directory / f"{plan['top']}.fasm"
    if code != 0:
        return False, _first_problem(text) or f"nextpnr-xilinx exited with status {code}."
    if not fasm.is_file() or fasm.stat().st_size == 0:
        return False, "nextpnr-xilinx finished without a FASM file."
    run["outputs"]["fasm"] = str(fasm)
    return True, ""


def _run_fasm2frames(run: dict, plan: dict, directory: Path) -> tuple[bool, str]:
    command = _argv(
        plan["tools"]["fasm2frames"],
        ["--db-root", plan["family"], "--part", plan["part"], f"{plan['top']}.fasm", f"{plan['top']}.frames"],
    )
    code, output = _run(command, directory, _child_env(Path(plan["tools"]["fasm2frames"])), 300)
    (directory / "fasm2frames.log").write_text(output, encoding="utf-8")
    _record_command(run, "fasm2frames", command)
    frames = directory / f"{plan['top']}.frames"
    if code != 0:
        return False, _first_problem(output) or f"fasm2frames exited with status {code}."
    if not frames.is_file() or frames.stat().st_size == 0:
        return False, "fasm2frames finished without configuration frames."
    run["outputs"]["frames"] = str(frames)
    return True, ""


def _run_frames2bit(run: dict, plan: dict, directory: Path) -> tuple[bool, str]:
    bitstream = directory / f"{plan['top']}.bit"
    command = _argv(
        plan["tools"]["xc7frames2bit"],
        [
            "--part_file",
            plan["part_yaml"],
            "--part_name",
            plan["part"],
            "--frm_file",
            f"{plan['top']}.frames",
            "--output_file",
            f"{plan['top']}.bit",
        ],
    )
    code, output = _run(command, directory, _child_env(Path(plan["tools"]["xc7frames2bit"])), 300)
    (directory / "xc7frames2bit.log").write_text(output, encoding="utf-8")
    _record_command(run, "xc7frames2bit", command)
    if code != 0:
        return False, _first_problem(output) or f"xc7frames2bit exited with status {code}."
    if not bitstream.is_file() or bitstream.stat().st_size == 0:
        return False, "xc7frames2bit finished without a bitstream."
    run["outputs"]["bitstream"] = str(bitstream)
    run["bitstream_path"] = str(bitstream)
    run["bitstream_bytes"] = bitstream.stat().st_size
    return True, ""


_STAGE_RUNNERS = {
    "ghdl": _run_ghdl,
    "yosys": _run_yosys,
    "nextpnr": _run_nextpnr,
    "fasm2frames": _run_fasm2frames,
    "xc7frames2bit": _run_frames2bit,
}


def _argv(executable: str, args: list[str]) -> list[str]:
    if executable.lower().endswith((".bat", ".cmd")):
        return ["cmd.exe", "/d", "/c", subprocess.list2cmdline([executable, *args])]
    return [executable, *args]


def _extra_libs(name: str, executable: Path) -> list[Path]:
    if name != "yosys":
        return []
    lib = executable.resolve().parent.parent / "lib"
    return [lib] if lib.is_dir() else []


def _child_env(executable: Path, extra: list[Path] | None = None) -> dict[str, str]:
    env = os.environ.copy()
    dirs = [str(executable.resolve().parent)]
    dirs.extend(str(path) for path in extra or [])
    env["PATH"] = os.pathsep.join(dirs) + os.pathsep + env.get("PATH", "")
    return env


def _run(command: list[str], cwd: Path, env: dict[str, str], timeout: int) -> tuple[int, str]:
    code, stdout, stderr = _run_split(command, cwd, env, timeout)
    text = stdout.decode("utf-8", errors="replace")
    err = stderr.decode("utf-8", errors="replace")
    if err.strip():
        text = text + ("\n" if text else "") + err
    return code, text


def _run_split(command: list[str], cwd: Path, env: dict[str, str], timeout: int) -> tuple[int, bytes, bytes]:
    completed = subprocess.run(
        command,
        cwd=str(cwd),
        shell=False,
        capture_output=True,
        stdin=subprocess.DEVNULL,
        timeout=timeout,
        check=False,
        env=env,
    )
    return completed.returncode, completed.stdout or b"", completed.stderr or b""


def _write_constraints(directory: Path, paths: list[str]) -> None:
    chunks = []
    for raw in paths:
        text = Path(raw).read_text(encoding="utf-8", errors="replace")
        chunks.append(text if text.endswith("\n") else text + "\n")
    (directory / "constraints.xdc").write_text("".join(chunks), encoding="utf-8")


def _read_xdc(paths: list[str]) -> tuple[list[str], list[Diagnostic]]:
    texts: list[str] = []
    errors: list[Diagnostic] = []
    for raw in paths:
        path = Path(raw)
        if not path.is_file():
            continue
        try:
            texts.append(path.read_text(encoding="utf-8", errors="replace"))
        except OSError as exc:
            errors.append(_error("xdc_unreadable", str(exc), str(path)))
    return texts, errors


def _hash_inputs(files, xdc_paths: list[str]) -> list[dict]:
    records = []
    seen: set[str] = set()
    for item in files:
        path = Path(item.path)
        key = str(path.resolve()).casefold()
        if key in seen:
            continue
        seen.add(key)
        records.append({"role": "vhdl", "path": str(path), "sha256": _sha256(path)})
    for raw in xdc_paths:
        path = Path(raw)
        records.append({"role": "xdc", "path": str(path), "sha256": _sha256(path)})
    return records


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def _record_command(run: dict, stage: str, command: list[str]) -> None:
    run["commands"].append({"stage": stage, "argv": command})


def _blank(config: FpgaBuildConfig, standard: str, profile: str) -> dict:
    build_id = new_id("osb")
    return {
        "build_id": build_id,
        "toolchain": "opensource",
        "status": "running",
        "target": config.target,
        "top": "",
        "board_id": config.board_id,
        "part": config.part,
        "vhdl_standard": standard,
        "library_profile": profile,
        "xdc_paths": list(config.xdc_paths),
        "directory": str(builds_dir() / build_id),
        "tools": {},
        "database": None,
        "clock": None,
        "inputs": [],
        "commands": [],
        "outputs": {},
        "reports": {},
        "stages": {name: "not_run" for name in STAGES},
        "stage_seconds": {},
        "diagnostics": [],
        "bitstream_path": None,
        "bitstream_bytes": None,
        "started_at": _now(),
        "finished_at": None,
    }


def _worker(run: dict, plan: dict) -> None:
    try:
        execute_build(run, plan)
    except Exception as exc:
        run["status"] = "failed"
        run["diagnostics"].append(_error("build_failed", str(exc), None).model_dump(mode="json"))
        _finish(run)
    finally:
        _release()


def _store(run: dict) -> None:
    with _LOCK:
        _RUNS[run["build_id"]] = run
    _write_report(run)


def _finish(run: dict) -> dict:
    run["finished_at"] = _now()
    if run["stage_seconds"]:
        run["elapsed_seconds"] = round(sum(run["stage_seconds"].values()), 3)
    _store(run)
    return run


def _write_report(run: dict) -> None:
    import json

    directory = Path(run["directory"])
    _require_workspace(directory)
    directory.mkdir(parents=True, exist_ok=True)
    text = json.dumps(run, indent=2) + "\n"
    (directory / "report.json").write_text(text, encoding="utf-8")
    (directory / "manifest.json").write_text(text, encoding="utf-8")


def _read_report(directory: Path) -> dict | None:
    import json

    path = directory / "report.json"
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _require_workspace(path: Path) -> None:
    root = workspace_dir().resolve()
    resolved = path.resolve()
    if resolved != root and root not in resolved.parents:
        raise RuntimeError("Refusing to write a build outside the workspace.")


def _tail(payload: bytes | str) -> str:
    text = payload.decode("utf-8", errors="replace") if isinstance(payload, bytes) else payload
    for line in reversed(text.splitlines()):
        if line.strip():
            return line.strip()[:500]
    return ""


def _first_problem(text: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("ERROR") or "Error:" in stripped or "Traceback" in stripped:
            return stripped[:500]
    return _tail(text)


def _acquire() -> bool:
    global _BUSY
    with _LOCK:
        if _BUSY:
            return False
        _BUSY = True
        return True


def _release() -> None:
    global _BUSY
    with _LOCK:
        _BUSY = False


def _clock() -> float:
    return __import__("time").perf_counter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _error(code: str, message: str, path: str | None) -> Diagnostic:
    return Diagnostic(severity="error", code=code, message=message, path=path)
