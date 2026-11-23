"""Vivado 2019.1 non-project builds.

The executable path is local tool configuration. The Tcl script is generated
from the project. Pin assignments and clock periods are not invented. GHDL
flags are not passed to Vivado.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import threading
from datetime import datetime, timezone
from pathlib import Path

from app.boards import list_boards
from app.fpga.constraints import check_constraints
from app.hdl.simulate import CompiledFile, resolve_entity
from app.identity import new_id
from app.models.design import DesignUnit, Diagnostic, FpgaBuildConfig, ProjectFile
from app.paths import builds_dir, workspace_dir
from app.storage.tools_store import load_tools

_PART = re.compile(r"^[A-Za-z0-9-]+$")
_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_STAGE = re.compile(r"HDL-MAKER-STAGE ([a-z]+)-(start|done)")
_RUNS: dict[str, dict] = {}
_PROCS: dict[str, subprocess.Popen[str]] = {}
_CANCEL: dict[str, threading.Event] = {}
_LOCK = threading.Lock()
_SYNTH_STAGES = ("validation", "synthesis")
_BIT_STAGES = ("validation", "synthesis", "optimization", "placement", "routing", "bitstream")


class FpgaRequestError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def resolve_vivado(configured: str | None = None) -> tuple[str | None, str | None]:
    """Return ``(executable, problem)``. A bad configured path is not replaced."""
    text = load_tools().vivado_path if configured is None else configured
    text = text.strip()
    if text:
        if Path(text).is_file():
            return str(Path(text)), None
        return None, "invalid_vivado_path"
    found = shutil.which("vivado.bat") or shutil.which("vivado")
    if found:
        return found, None
    return None, "vivado_missing"


def vivado_command(executable: str, script: Path, build_dir: Path) -> list[str]:
    """Argument list for one batch run. ``shell=True`` is not used."""
    command = [
        str(executable),
        "-mode",
        "batch",
        "-notrace",
        "-source",
        str(script),
        "-log",
        str(build_dir / "vivado.log"),
        "-journal",
        str(build_dir / "vivado.jou"),
    ]
    if executable.lower().endswith((".bat", ".cmd")):
        return ["cmd.exe", "/d", "/c", *command]
    return command


def _should_probe(executable: str) -> bool:
    return Path(executable).name.casefold() in {"vivado.bat", "vivado.exe", "vivado"}


def vhdl2008_supported(version: str) -> bool:
    """Vivado 2017.4 and later accept ``read_vhdl -vhdl2008``."""
    match = re.search(r"Vivado v(\d+)\.(\d+)", version)
    if match is None:
        return False
    return (int(match.group(1)), int(match.group(2))) >= (2017, 4)


def probe_vivado(executable: str | None = None) -> dict:
    resolved, problem = resolve_vivado(executable)
    if problem == "invalid_vivado_path":
        return {"ok": False, "code": problem, "path": executable or load_tools().vivado_path, "version": None, "message": "The configured Vivado path is not a file."}
    if resolved is None:
        return {"ok": False, "code": "vivado_missing", "path": None, "version": None, "message": "Vivado was not found. Set the path to vivado.bat."}
    version, detail = _version_text(resolved)
    if version is None:
        return {"ok": False, "code": "vivado_failed", "path": resolved, "version": None, "message": detail or "Vivado did not report a version."}
    return {"ok": True, "code": "vivado_ready", "path": resolved, "version": version, "message": version}


def render_tcl(
    files: list[CompiledFile],
    xdc_paths: list[str],
    top: str,
    part: str,
    standard: str,
    profile: str,
    target: str,
) -> str:
    lines = [
        "# HDL-Maker Vivado non-project build.",
        f"# vhdl_standard={standard} library_profile={profile}",
        "# GHDL compatibility flags are not passed to Vivado.",
    ]
    if profile == "synopsys":
        lines.append("# Synopsys package clauses stay in the VHDL. Vivado resolves them from its own IEEE library.")
    lines.append(f"if {{[llength [get_parts {part}]] == 0}} {{")
    lines.append(f'  error "HDL-Maker: part {part} is not installed in this Vivado"')
    lines.append("}")
    seen: set[tuple[str, str]] = set()
    for item in files:
        key = (item.ghdl_library, str(Path(item.path).resolve()).casefold())
        if key in seen:
            continue
        seen.add(key)
        flag = " -vhdl2008" if standard == "2008" else ""
        lines.append(f"read_vhdl -library {item.ghdl_library}{flag} {{{Path(item.path).as_posix()}}}")
    for raw in xdc_paths:
        lines.append(f"read_xdc {{{Path(raw).as_posix()}}}")
    lines.extend(
        [
            'puts "HDL-MAKER-STAGE synthesis-start"',
            f"synth_design -top {top} -part {part}",
            'puts "HDL-MAKER-STAGE synthesis-done"',
            "write_checkpoint -force post_synth.dcp",
            "report_utilization -file utilization_synth.rpt",
            "report_timing_summary -file timing_synth.rpt",
        ]
    )
    if target == "bitstream":
        lines.extend(
            [
                'puts "HDL-MAKER-STAGE optimization-start"',
                "opt_design",
                'puts "HDL-MAKER-STAGE optimization-done"',
                "write_checkpoint -force post_opt.dcp",
                'puts "HDL-MAKER-STAGE placement-start"',
                "place_design",
                'puts "HDL-MAKER-STAGE placement-done"',
                "write_checkpoint -force post_place.dcp",
                'puts "HDL-MAKER-STAGE routing-start"',
                "route_design",
                'puts "HDL-MAKER-STAGE routing-done"',
                "report_timing_summary -file timing_impl.rpt",
                "report_drc -file drc.rpt",
                "report_utilization -file utilization_impl.rpt",
                "write_checkpoint -force post_route.dcp",
                'puts "HDL-MAKER-STAGE bitstream-start"',
                "write_bitstream -force bitstream.bit",
                'puts "HDL-MAKER-STAGE bitstream-done"',
            ]
        )
    return "\n".join(lines) + "\n"


def launch_build(project: ProjectFile, config: FpgaBuildConfig) -> dict:
    from app.fpga.session import release_tool, try_acquire

    if not try_acquire():
        raise FpgaRequestError("build_busy", "Vivado is already running a build or a hardware operation.")
    try:
        prepared = _prepare(project, config)
    except Exception:
        release_tool()
        raise
    run = prepared["run"]
    if run["status"] == "failed":
        _store(run)
        release_tool()
        return run
    cancel = threading.Event()
    with _LOCK:
        _CANCEL[run["build_id"]] = cancel
    thread = threading.Thread(target=_worker, args=(run, prepared["files"], cancel), daemon=True)
    thread.start()
    return run


def execute_build(run: dict, files: list[CompiledFile], cancel: threading.Event | None = None) -> dict:
    """Run the Tcl script already written for this build. Used by the worker and by tests."""
    build_dir = Path(run["directory"])
    _require_workspace(build_dir)
    executable = run.get("vivado")
    if not executable or not Path(executable).is_file():
        run["status"] = "failed"
        run["diagnostics"] = [_error("vivado_missing", "Vivado was not found.", None).model_dump(mode="json")]
        return _finish(run)
    command = vivado_command(str(executable), build_dir / "build.tcl", build_dir)
    run["command"] = command
    timeout = 2700 if run["target"] == "bitstream" else 1200
    code, output = _run_process(run, command, build_dir, timeout, cancel)
    log_path = build_dir / "console.log"
    log_path.write_text(output, encoding="utf-8")
    _apply_stages(run, output)
    _collect_messages(run, output)
    if cancel is not None and cancel.is_set():
        run["status"] = "failed"
        run["diagnostics"] = [_error("cancelled", "The Vivado build was cancelled.", None).model_dump(mode="json")]
        return _finish(run)
    if code != 0:
        run["status"] = "failed"
        _fail_open_stage(run)
        message = _first_error(output) or f"Vivado exited with status {code}."
        run["diagnostics"] = [_error("vivado_failed", message, None).model_dump(mode="json")]
        return _finish(run)
    if run["target"] == "bitstream" and not (build_dir / "bitstream.bit").is_file():
        run["status"] = "failed"
        run["stages"]["bitstream"] = "failed"
        run["diagnostics"] = [_error("bitstream_missing", "Vivado finished without writing a bitstream.", None).model_dump(mode="json")]
        return _finish(run)
    required = _BIT_STAGES if run["target"] == "bitstream" else _SYNTH_STAGES
    if any(run["stages"].get(name) != "passed" for name in required):
        run["status"] = "failed"
        run["diagnostics"] = [_error("vivado_failed", "Vivado exited before every requested stage finished.", None).model_dump(mode="json")]
        return _finish(run)
    run["status"] = "passed"
    run["bitstream_path"] = str(build_dir / "bitstream.bit") if run["target"] == "bitstream" else None
    return _finish(run)


def build_run(build_id: str) -> dict | None:
    with _LOCK:
        cached = _RUNS.get(build_id)
    if cached is not None:
        return cached
    path = builds_dir() / build_id / "report.json"
    if not path.is_file():
        return None
    import json

    return json.loads(path.read_text(encoding="utf-8"))


def latest_build() -> dict | None:
    import json

    with _LOCK:
        if _RUNS:
            return max(_RUNS.values(), key=lambda item: item["started_at"])
    runs = []
    root = builds_dir()
    if not root.is_dir():
        return None
    for path in root.iterdir():
        report = path / "report.json"
        if not report.is_file():
            continue
        try:
            payload = json.loads(report.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if payload.get("toolchain") == "opensource":
            continue
        runs.append(path)
    if not runs:
        return None
    newest = max(runs, key=lambda path: path.stat().st_mtime)
    return json.loads((newest / "report.json").read_text(encoding="utf-8"))


def cancel_build(build_id: str) -> dict | None:
    with _LOCK:
        cancel = _CANCEL.get(build_id)
        process = _PROCS.get(build_id)
        run = _RUNS.get(build_id)
    if cancel is not None:
        cancel.set()
    if process is not None and process.poll() is None:
        _stop_process(process)
    return run


def report_text(build_id: str, name: str) -> str | None:
    allowed = {
        "vivado.log",
        "console.log",
        "utilization_synth.rpt",
        "timing_synth.rpt",
        "utilization_impl.rpt",
        "timing_impl.rpt",
        "drc.rpt",
    }
    if name not in allowed:
        return None
    path = builds_dir() / build_id / name
    if not path.is_file():
        return None
    text = path.read_text(encoding="utf-8", errors="replace")
    return text[-20000:]


def _prepare(project: ProjectFile, config: FpgaBuildConfig) -> dict:
    run = _blank(config, project.vhdl_standard, project.library_profile)
    diagnostics = _settings_diagnostics(project, config)
    files: list[CompiledFile] = []
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
    executable, problem = resolve_vivado()
    version = None
    if problem == "invalid_vivado_path":
        diagnostics.append(_error("invalid_vivado_path", "The configured Vivado path is not a file.", load_tools().vivado_path))
    elif executable is None:
        diagnostics.append(_error("vivado_missing", "Vivado was not found. Set the path to vivado.bat.", None))
    elif not diagnostics and _should_probe(executable):
        version, detail = _version_text(executable)
        if version is None:
            diagnostics.append(_error("vivado_failed", detail or "Vivado did not report a version.", executable))
        elif project.vhdl_standard == "2008" and not vhdl2008_supported(version):
            diagnostics.append(
                _error(
                    "vhdl2008_unsupported",
                    f"{version} does not accept read_vhdl -vhdl2008. The VHDL-93 setting was not changed.",
                    executable,
                )
            )
    if diagnostics:
        run["status"] = "failed"
        run["stages"]["validation"] = "failed"
        run["diagnostics"] = [item.model_dump(mode="json") for item in diagnostics]
        run["finished_at"] = _now()
        return {"run": run, "files": []}
    assert top is not None
    assert executable is not None
    build_dir = Path(run["directory"])
    _require_workspace(build_dir)
    build_dir.mkdir(parents=True, exist_ok=True)
    script = render_tcl(files, config.xdc_paths, top.name, config.part, project.vhdl_standard, project.library_profile, config.target)
    (build_dir / "build.tcl").write_text(script, encoding="utf-8")
    run["top"] = top.name
    run["vivado"] = executable
    run["vivado_version"] = version
    run["stages"]["validation"] = "passed"
    run["files"] = [{"path": str(item.path), "library": item.ghdl_library} for item in files]
    _write_snapshot(build_dir, project, config, run)
    _store(run)
    return {"run": run, "files": files}


def _settings_diagnostics(project: ProjectFile, config: FpgaBuildConfig) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    if not config.top_unit_id:
        diagnostics.append(_error("top_missing", "Choose a VHDL top-level entity. The testbench and the hierarchy root are not used.", None))
    if not config.board_id:
        diagnostics.append(_error("board_missing", "Choose a board. The part is not taken from another board.", None))
    else:
        board = next((item for item in list_boards().boards if item.id == config.board_id), None)
        if board is None:
            diagnostics.append(_error("board_missing", f"Board file '{config.board_id}' is not in the catalog.", config.board_id))
        elif not config.part:
            named = ", ".join(board.part_names) or "none"
            diagnostics.append(
                _error("part_missing", f"Choose a part. The board file names: {named}. No part was filled in.", config.board_id)
            )
        elif config.part not in board.part_names:
            named = ", ".join(board.part_names) or "none"
            diagnostics.append(
                _error(
                    "part_conflict",
                    f"Part '{config.part}' is not named by {board.id}. That file names: {named}.",
                    config.part,
                )
            )
    if config.target not in {"synthesis", "bitstream"}:
        diagnostics.append(_error("target_invalid", "The build target must be synthesis or bitstream.", config.target))
    if project.vhdl_standard not in {"93", "2008"}:
        diagnostics.append(_error("standard_invalid", "The VHDL standard must be 93 or 2008.", project.vhdl_standard))
    return diagnostics


def _name_diagnostics(top: str, part: str, files: list[CompiledFile]) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    if not _IDENT.fullmatch(top):
        diagnostics.append(_error("top_invalid", f"Top-level name '{top}' is not a VHDL identifier.", top))
    if not _PART.fullmatch(part):
        diagnostics.append(_error("part_invalid", f"Part '{part}' is not a Vivado part token.", part))
    for item in files:
        if not _IDENT.fullmatch(item.ghdl_library):
            diagnostics.append(_error("library_invalid", f"Library name '{item.ghdl_library}' cannot be passed to read_vhdl.", item.ghdl_library))
    return diagnostics


def _worker(run: dict, files: list[CompiledFile], cancel: threading.Event) -> None:
    try:
        execute_build(run, files, cancel)
    except Exception as exc:
        run["status"] = "failed"
        run["diagnostics"] = [_error("build_failed", str(exc), None).model_dump(mode="json")]
        _finish(run)
    finally:
        with _LOCK:
            _CANCEL.pop(run["build_id"], None)
            _PROCS.pop(run["build_id"], None)
        from app.fpga.session import release_tool

        release_tool()


def _run_process(
    run: dict,
    command: list[str],
    build_dir: Path,
    timeout: int,
    cancel: threading.Event | None,
) -> tuple[int, str]:
    process = subprocess.Popen(
        command,
        cwd=str(build_dir),
        shell=False,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    with _LOCK:
        _PROCS[run["build_id"]] = process
    chunks: list[str] = []

    def read() -> None:
        assert process.stdout is not None
        for line in process.stdout:
            chunks.append(line)
            _apply_stages(run, "".join(chunks))
            _store(run)

    reader = threading.Thread(target=read, daemon=True)
    reader.start()
    limit = timeout
    while process.poll() is None:
        if cancel is not None and cancel.is_set():
            _stop_process(process)
            break
        if limit <= 0:
            _stop_process(process)
            chunks.append("\nHDL-Maker: the Vivado build exceeded its time limit.\n")
            break
        try:
            process.wait(timeout=0.2)
        except subprocess.TimeoutExpired:
            limit -= 0.2
    reader.join(timeout=2)
    code = process.poll()
    return (code if code is not None else 1), "".join(chunks)


def _stop_process(process: subprocess.Popen[str]) -> None:
    if os.name == "nt":
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(process.pid)], check=False, capture_output=True)
    else:
        process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()


def _apply_stages(run: dict, output: str) -> None:
    for name, event in _STAGE.findall(output):
        if name not in run["stages"]:
            continue
        run["stages"][name] = "passed" if event == "done" else "running"


def _fail_open_stage(run: dict) -> None:
    for name in _BIT_STAGES:
        if run["stages"].get(name) == "running":
            run["stages"][name] = "failed"
            return
    if run["stages"].get("synthesis") == "not_run":
        run["stages"]["synthesis"] = "failed"


def _collect_messages(run: dict, output: str) -> None:
    warnings = [line.strip() for line in output.splitlines() if "WARNING:" in line or line.strip().startswith("WARNING")]
    errors = [line.strip() for line in output.splitlines() if "ERROR:" in line or line.strip().startswith("ERROR")]
    run["warning_count"] = len(warnings)
    run["error_count"] = len(errors)
    run["warnings"] = warnings[:30]
    run["errors"] = errors[:30]


def _first_error(output: str) -> str:
    for line in output.splitlines():
        if "ERROR:" in line or line.startswith("ERROR"):
            return line.strip()[:500]
    return ""


def _version_text(executable: str) -> tuple[str | None, str]:
    command = [str(executable), "-nolog", "-nojournal", "-version"]
    if executable.lower().endswith((".bat", ".cmd")):
        command = ["cmd.exe", "/d", "/c", *command]
    try:
        completed = subprocess.run(
            command,
            cwd=str(workspace_dir()),
            shell=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdin=subprocess.DEVNULL,
            timeout=180,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return None, str(exc)
    text = f"{completed.stdout}\n{completed.stderr}"
    match = re.search(r"Vivado v\d+\.\d+[^\n]*", text)
    if match is None:
        detail = text.strip()[:500]
        return None, detail or f"Vivado exited with status {completed.returncode} and printed no version."
    return match.group(0).strip(), text


def _blank(config: FpgaBuildConfig, standard: str, profile: str) -> dict:
    build_id = new_id("bld")
    build_dir = builds_dir() / build_id
    return {
        "build_id": build_id,
        "status": "running",
        "target": config.target,
        "top": "",
        "board_id": config.board_id,
        "part": config.part,
        "vhdl_standard": standard,
        "library_profile": profile,
        "xdc_paths": list(config.xdc_paths),
        "directory": str(build_dir),
        "vivado": None,
        "vivado_version": None,
        "command": [],
        "files": [],
        "stages": {name: "not_run" for name in _BIT_STAGES},
        "diagnostics": [],
        "warnings": [],
        "errors": [],
        "warning_count": 0,
        "error_count": 0,
        "bitstream_path": None,
        "started_at": _now(),
        "finished_at": None,
    }


def _write_snapshot(build_dir: Path, project: ProjectFile, config: FpgaBuildConfig, run: dict) -> None:
    import json

    payload = config.model_dump(mode="json") | {
        "vhdl_standard": project.vhdl_standard,
        "library_profile": project.library_profile,
    }
    (build_dir / "config.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    manifest = {"files": run["files"], "xdc_paths": run["xdc_paths"], "part": run["part"], "top": run["top"]}
    (build_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def _store(run: dict) -> None:
    with _LOCK:
        _RUNS[run["build_id"]] = run
    _write_report(run)


def _finish(run: dict) -> dict:
    run["finished_at"] = _now()
    _store(run)
    return run


def _write_report(run: dict) -> None:
    import json

    directory = Path(run["directory"])
    _require_workspace(directory)
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "report.json").write_text(json.dumps(run, indent=2) + "\n", encoding="utf-8")


def _require_workspace(path: Path) -> None:
    root = workspace_dir().resolve()
    resolved = path.resolve()
    if resolved != root and root not in resolved.parents:
        raise RuntimeError("Refusing to write a build outside the workspace.")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _error(code: str, message: str, path: str | None) -> Diagnostic:
    return Diagnostic(severity="error", code=code, message=message, path=path)
