"""Run a VHDL testbench with GHDL and keep the waveform.

The language standard and the library profile come from the project. The
command flags are the same ones used for analysis and elaboration elsewhere.
Each run has its own directory. Library sources are read and not written.
"""

from __future__ import annotations

import json
import shutil
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from app.hdl.ghdl_run import LibraryProfile, ghdl_prefix, run_ghdl
from app.hdl.gtkwave import diagnose_signal_map, launch_viewer, resolve_gtkwave
from app.hdl.vhdl import VhdlStandard
from app.identity import new_id
from app.importers.vhdl.hierarchy import instantiation_sites
from app.models.design import DesignUnit, Diagnostic, ProjectFile, SimulationConfig
from app.paths import simulations_dir, workspace_dir

_EXTERNAL = {"ieee", "std", "std_logic_1164", "numeric_std", "std_logic_arith", "std_logic_unsigned"}
_RUNS: dict[str, dict] = {}
_CANCEL: dict[str, threading.Event] = {}
_LOCK = threading.Lock()


@dataclass
class CompiledFile:
    path: Path
    ghdl_library: str
    unit_ids: list[str] = field(default_factory=list)


def simulation_commands(
    standard: VhdlStandard,
    profile: LibraryProfile,
    work_directory: Path,
    files: list[CompiledFile],
    top: str,
    stop_time: str,
    waveform: Path,
    waveform_format: str,
    generics: list[tuple[str, str]],
) -> list[list[str]]:
    """Argument lists for analyze, elaborate, and run. The shell is not involved."""
    prefix = ghdl_prefix(standard, profile)
    libraries = sorted({item.ghdl_library for item in files if item.ghdl_library != "work"})
    lib_dirs = {name: work_directory / "libs" / name for name in libraries}
    search = [f"-P{lib_dirs[name]}" for name in libraries]
    work = work_directory / "work"
    commands: list[list[str]] = []
    for item in files:
        if item.ghdl_library == "work":
            commands.append(["-a", *prefix, f"--workdir={work}", *search, str(item.path)])
        else:
            commands.append(
                ["-a", *prefix, f"--work={item.ghdl_library}", f"--workdir={lib_dirs[item.ghdl_library]}", str(item.path)]
            )
    generic_flags = [f"-g{name}={value}" for name, value in generics]
    # Mcode binds top-level generics when the simulation starts, so -g is repeated on -r.
    commands.append(["-e", *prefix, f"--workdir={work}", *search, *generic_flags, top])
    wave = f"--wave={waveform}" if waveform_format == "ghw" else f"--vcd={waveform}"
    commands.append(["-r", *prefix, f"--workdir={work}", *search, *generic_flags, top, f"--stop-time={stop_time}", wave])
    return commands


def resolve_testbench(project: ProjectFile, unit_id: str) -> tuple[list[CompiledFile], list[dict], list[Diagnostic]]:
    """Files in analysis order, a signal-name map, and diagnostics."""
    return resolve_entity(project, unit_id)


def resolve_entity(
    project: ProjectFile,
    unit_id: str,
    *,
    missing_code: str = "testbench_missing",
    missing_message: str = "Choose a VHDL testbench entity. The hierarchy root is not used.",
    language_code: str = "testbench_not_vhdl",
) -> tuple[list[CompiledFile], list[dict], list[Diagnostic]]:
    """Files in analysis order for one VHDL entity. The hierarchy root is not used."""
    units = {unit.id: unit for unit in project.design_units}
    top = units.get(unit_id)
    if top is None or top.kind != "entity":
        return [], [], [_error(missing_code, missing_message, unit_id)]
    if top.language not in {"vhdl", "unknown"}:
        return [], [], [_error(language_code, f"'{top.name}' is not a VHDL design.", top.id)]
    selected: dict[str, DesignUnit] = {}
    ghdl_library: dict[str, str] = {}
    diagnostics: list[Diagnostic] = []

    def add_package(package: DesignUnit, library: str) -> None:
        if package.id in selected:
            return
        selected[package.id] = package
        ghdl_library[package.id] = library
        body = _package_body(project, package)
        if body is not None:
            selected[body.id] = body
            ghdl_library[body.id] = library
        _follow_uses(package, package.library_id, library)
        if body is not None:
            _follow_uses(body, package.library_id, library)

    def add_entity(entity: DesignUnit, library: str) -> None:
        if entity.id in selected:
            return
        selected[entity.id] = entity
        ghdl_library[entity.id] = library
        architectures = _architectures(project, entity)
        for architecture in architectures:
            selected[architecture.id] = architecture
            ghdl_library[architecture.id] = library
        for unit in (entity, *architectures):
            _follow_uses(unit, entity.library_id, library)
        for architecture in architectures:
            for name in architecture.instantiates:
                child, child_library = _find_entity(project, name, entity.library_id)
                if child is None:
                    diagnostics.append(
                        _error("missing_dependency", f"Instantiated design '{name}' is not in the project.", architecture.id)
                    )
                    continue
                add_entity(child, child_library)

    def _follow_uses(unit: DesignUnit, home_library_id: str, library: str) -> None:
        for dependency in unit.dependencies:
            target = _use_target(dependency)
            if target is None:
                continue
            used_library, used_name = target
            if used_library in {"ieee", "std"} or used_name in _EXTERNAL:
                continue
            if used_library == "work":
                package = _find_package(project, used_name, home_library_id)
                package_library = library
            else:
                package = _find_package(project, used_name, None, used_library)
                package_library = used_library
            if package is None:
                diagnostics.append(
                    _error("missing_dependency", f"Package '{used_library}.{used_name}' is not in the project.", unit.id)
                )
                continue
            add_package(package, package_library)

    add_entity(top, "work")
    if diagnostics:
        return [], _signal_map(project, top), diagnostics
    files, order_diagnostics = _order_files(project, selected, ghdl_library)
    diagnostics.extend(order_diagnostics)
    if diagnostics:
        return [], _signal_map(project, top), diagnostics
    return files, _signal_map(project, top), []


def launch_simulation(project: ProjectFile, config: SimulationConfig) -> dict:
    if not config.testbench_unit_id:
        raise SimulationRequestError("testbench_missing", "Choose a VHDL testbench entity. The hierarchy root is not used.")
    with _LOCK:
        if any(item.get("status") == "running" for item in _RUNS.values()):
            raise SimulationRequestError("simulation_busy", "A simulation is already running.")
    files, signals, diagnostics = resolve_testbench(project, config.testbench_unit_id)
    run = _blank_run(project, config)
    run["signal_map"] = signals
    if diagnostics:
        run["status"] = "failed"
        run["diagnostics"] = [item.model_dump(mode="json") for item in diagnostics]
        run["finished_at"] = _now()
        _store(run)
        return run
    top = next(unit for unit in project.design_units if unit.id == config.testbench_unit_id)
    run["top"] = top.name
    run["files"] = [{"path": str(item.path), "ghdl_library": item.ghdl_library} for item in files]
    _store(run)
    cancel = threading.Event()
    with _LOCK:
        _CANCEL[run["run_id"]] = cancel
    thread = threading.Thread(
        target=_worker,
        args=(run["run_id"], files, top.name, project.vhdl_standard, project.library_profile, config, cancel),
        daemon=True,
    )
    thread.start()
    return run


def simulation_run(run_id: str) -> dict | None:
    with _LOCK:
        cached = _RUNS.get(run_id)
    if cached is not None:
        return cached
    path = simulations_dir() / run_id / "report.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def latest_simulation() -> dict | None:
    with _LOCK:
        if _RUNS:
            return max(_RUNS.values(), key=lambda item: item["started_at"])
    runs = [path for path in simulations_dir().iterdir() if (path / "report.json").is_file()]
    if not runs:
        return None
    newest = max(runs, key=lambda path: path.stat().st_mtime)
    return json.loads((newest / "report.json").read_text(encoding="utf-8"))


def cancel_simulation(run_id: str) -> dict | None:
    with _LOCK:
        cancel = _CANCEL.get(run_id)
        run = _RUNS.get(run_id)
    if cancel is not None:
        cancel.set()
    return run


def open_waveform(run_id: str) -> dict:
    run = simulation_run(run_id)
    if run is None:
        raise SimulationRequestError("run_not_found", "That simulation run does not exist.")
    waveform = run.get("waveform_path")
    if not waveform or not Path(waveform).is_file():
        raise SimulationRequestError("waveform_missing", "This run has no waveform file.")
    executable, problem = resolve_gtkwave()
    if problem == "invalid_gtkwave_path":
        return {
            "opened": False,
            "code": "invalid_gtkwave_path",
            "gtkwave": None,
            "waveform_path": waveform,
            "message": "The configured GTKWave path is not a file. The waveform file is kept.",
        }
    if executable is None:
        return {
            "opened": False,
            "code": "gtkwave_missing",
            "gtkwave": None,
            "waveform_path": waveform,
            "message": "GTKWave was not found on PATH. The waveform file is kept for later.",
        }
    gtkw = str(run.get("gtkw_path") or "").strip()
    if gtkw and not Path(gtkw).is_file():
        return {
            "opened": False,
            "code": "gtkw_missing",
            "gtkwave": executable,
            "waveform_path": waveform,
            "message": "The .gtkw file for this simulation configuration is missing. GTKWave was not started, and the waveform file is kept.",
        }
    arguments = [waveform]
    if gtkw:
        arguments.append(gtkw)
    pid = launch_viewer(executable, arguments, Path(waveform).parent)
    return {
        "opened": True,
        "code": "gtkwave_started",
        "gtkwave": executable,
        "waveform_path": waveform,
        "gtkw_path": gtkw or None,
        "pid": pid,
        "message": "GTKWave was started.",
    }


def execute_simulation(
    run_dir: Path,
    files: list[CompiledFile],
    top: str,
    standard: VhdlStandard,
    profile: LibraryProfile,
    config: SimulationConfig,
    signal_map: list[dict] | None = None,
    cancel: threading.Event | None = None,
) -> dict:
    """Analyze, elaborate, and run. Callers that already resolved files use this directly."""
    _require_workspace(run_dir)
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "work").mkdir(exist_ok=True)
    waveform = run_dir / f"waveform.{config.waveform_format}"
    generics = [(item.name, item.value) for item in config.generic_overrides]
    commands = simulation_commands(
        standard,
        profile,
        run_dir,
        files,
        top,
        config.stop_time,
        waveform,
        config.waveform_format,
        generics,
    )
    for item in files:
        if item.ghdl_library != "work":
            (run_dir / "libs" / item.ghdl_library).mkdir(parents=True, exist_ok=True)
    report = _blank_run_in(run_dir, standard, profile, config, top)
    report["signal_map"] = signal_map or []
    report["files"] = [{"path": str(item.path), "ghdl_library": item.ghdl_library} for item in files]
    report["commands"] = commands
    _write_json(run_dir / "config.json", config.model_dump(mode="json") | {"vhdl_standard": standard, "library_profile": profile})
    _write_json(run_dir / "manifest.json", {"files": report["files"], "signal_map": report["signal_map"], "commands": commands})
    if shutil.which("ghdl") is None:
        report["status"] = "failed"
        report["diagnostics"] = [_error("ghdl_missing", "ghdl was not found on PATH.", None).model_dump(mode="json")]
        return _finish(run_dir, report)
    analysis_log: list[str] = []
    for command in commands:
        if cancel is not None and cancel.is_set():
            report["status"] = "failed"
            report["diagnostics"] = [_error("cancelled", "Cancelled.", None).model_dump(mode="json")]
            return _finish(run_dir, report)
        stage = _stage(command)
        timeout = 600 if stage == "simulation" else 60
        code, detail = run_ghdl(command, run_dir, timeout=timeout, cancel=cancel)
        _append(run_dir / f"{stage}.log", command, detail)
        if stage == "analysis":
            analysis_log.append(detail)
        if code is None:
            report["status"] = "failed"
            report["diagnostics"] = [_error("ghdl_missing", detail or "ghdl was not found on PATH.", None).model_dump(mode="json")]
            return _finish(run_dir, report)
        if code != 0:
            report[_stage_field(stage)] = "failed"
            report["status"] = "failed"
            report["diagnostics"] = [_error("ghdl_failed", detail or f"GHDL {stage} failed.", None).model_dump(mode="json")]
            report["stderr"] = detail
            return _finish(run_dir, report)
        report[_stage_field(stage)] = "passed"
    if waveform.is_file():
        report["waveform_path"] = str(waveform)
    else:
        report["status"] = "failed"
        report["ghdl_simulation"] = "failed"
        report["diagnostics"] = [_error("waveform_missing", "GHDL finished without writing a waveform.", str(waveform)).model_dump(mode="json")]
        return _finish(run_dir, report)
    report["status"] = "passed"
    report["diagnostics"] = [item.model_dump(mode="json") for item in diagnose_signal_map(waveform, report["signal_map"])]
    return _finish(run_dir, report)


class SimulationRequestError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def _worker(
    run_id: str,
    files: list[CompiledFile],
    top: str,
    standard: VhdlStandard,
    profile: LibraryProfile,
    config: SimulationConfig,
    cancel: threading.Event,
) -> None:
    run_dir = simulations_dir() / run_id
    try:
        current = simulation_run(run_id) or {}
        report = execute_simulation(
            run_dir,
            files,
            top,
            standard,
            profile,
            config,
            current.get("signal_map") or [],
            cancel,
        )
        report["run_id"] = run_id
        report["started_at"] = current.get("started_at", report["started_at"])
        if report.get("finished_at") and report.get("started_at"):
            started = datetime.fromisoformat(report["started_at"])
            finished = datetime.fromisoformat(report["finished_at"])
            report["duration_ms"] = int((finished - started).total_seconds() * 1000)
        _store(report)
    except Exception as exc:
        failed = simulation_run(run_id) or _blank_run_in(run_dir, standard, profile, config, top)
        failed["status"] = "failed"
        failed["diagnostics"] = [_error("simulation_failed", str(exc), None).model_dump(mode="json")]
        failed["finished_at"] = _now()
        _store(failed)
    finally:
        with _LOCK:
            _CANCEL.pop(run_id, None)


def _order_files(
    project: ProjectFile,
    selected: dict[str, DesignUnit],
    libraries: dict[str, str],
) -> tuple[list[CompiledFile], list[Diagnostic]]:
    nodes: dict[str, CompiledFile] = {}
    needs: dict[str, set[str]] = {}
    unit_key: dict[str, str] = {}
    diagnostics: list[Diagnostic] = []
    for unit in selected.values():
        path = _unit_path(project, unit)
        if not path.is_file():
            diagnostics.append(_error("missing_dependency", f"Required library file is missing: {path}", unit.id))
            continue
        key = f"{libraries[unit.id]}:{path.resolve()}"
        unit_key[unit.id] = key
        node = nodes.get(key)
        if node is None:
            nodes[key] = CompiledFile(path=path, ghdl_library=libraries[unit.id], unit_ids=[unit.id])
            needs[key] = set()
        elif unit.id not in node.unit_ids:
            node.unit_ids.append(unit.id)
    if diagnostics:
        return [], diagnostics
    for unit in selected.values():
        key = unit_key[unit.id]
        for dependency_id in _predecessor_ids(project, unit, selected):
            earlier = unit_key.get(dependency_id)
            if earlier and earlier != key:
                needs[key].add(earlier)
    ordered: list[CompiledFile] = []
    ready = [key for key, deps in needs.items() if not deps]
    seen: set[str] = set()
    while ready:
        key = ready.pop(0)
        if key in seen:
            continue
        seen.add(key)
        ordered.append(nodes[key])
        for other, deps in needs.items():
            deps.discard(key)
            if not deps and other not in seen and other not in ready:
                ready.append(other)
    if len(ordered) != len(nodes):
        return [], [_error("dependency_cycle", "The testbench dependencies contain a cycle.", None)]
    return ordered, []


def _predecessor_ids(project: ProjectFile, unit: DesignUnit, selected: dict[str, DesignUnit]) -> list[str]:
    found: list[str] = []
    if unit.kind == "architecture":
        entity = next(
            (
                item
                for item in selected.values()
                if item.kind == "entity" and item.library_id == unit.library_id and item.name.lower() == (unit.parent_name or "").lower()
            ),
            None,
        )
        if entity is not None:
            found.append(entity.id)
        for name in unit.instantiates:
            child, _library = _find_entity(project, name, unit.library_id)
            if child is None or child.id not in selected:
                continue
            found.append(child.id)
            found.extend(item.id for item in _architectures(project, child) if item.id in selected)
    if unit.kind == "package_body":
        package = next(
            (
                item
                for item in selected.values()
                if item.kind == "package" and item.library_id == unit.library_id and item.name.lower() == (unit.parent_name or unit.name).lower()
            ),
            None,
        )
        if package is not None:
            found.append(package.id)
    for dependency in unit.dependencies:
        target = _use_target(dependency)
        if target is None or target[0] in {"ieee", "std"}:
            continue
        package = _find_package(
            project,
            target[1],
            unit.library_id if target[0] == "work" else None,
            None if target[0] == "work" else target[0],
        )
        if package is None or package.id not in selected:
            continue
        found.append(package.id)
        body = _package_body(project, package)
        if body is not None and body.id in selected:
            found.append(body.id)
    return found


def _signal_map(project: ProjectFile, top: DesignUnit) -> list[dict]:
    rows: list[dict] = []
    seen: set[tuple[str, str]] = set()

    def add(object_id: str, kind: str, path: str, unit_id: str) -> None:
        if not object_id or (object_id, path) in seen or len(rows) >= 500:
            return
        seen.add((object_id, path))
        rows.append({"object_id": object_id, "object_kind": kind, "vhdl_path": path, "design_unit_id": unit_id})

    def walk(entity: DesignUnit, prefix: str, depth: int) -> None:
        if depth > 8:
            return
        for port in entity.ports:
            add(port.id, "port", f"{prefix}/{port.name}", entity.id)
        for diagram in project.diagrams:
            if (diagram.entity_name or "").lower() != entity.name.lower():
                continue
            for port in diagram.ports:
                add(port.id, "diagram_port", f"{prefix}/{port.name}", entity.id)
            for net in diagram.nets:
                add(net.id, "net", f"{prefix}/{net.name}", entity.id)
        if depth == 8:
            return
        for architecture in _architectures(project, entity):
            for site in _sites(project, architecture):
                child_path = f"{prefix}/{site.label}"
                for diagram in project.diagrams:
                    if (diagram.entity_name or "").lower() != entity.name.lower():
                        continue
                    for instance in diagram.instances:
                        if instance.name == site.label:
                            add(instance.id, "instance", child_path, entity.id)
                child, _library = _find_entity(
                    project,
                    f"{site.library}.{site.unit}" if site.library else site.unit,
                    entity.library_id,
                )
                if child is not None:
                    walk(child, child_path, depth + 1)

    walk(top, f"/{top.name}", 0)
    return rows


def _sites(project: ProjectFile, architecture: DesignUnit):
    path = _unit_path(project, architecture)
    if not path.is_file():
        return []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    start = max(architecture.source.start_line - 1, 0)
    end = architecture.source.end_line or len(lines)
    text = "\n".join(lines[start:end])
    return instantiation_sites(text)


def _architectures(project: ProjectFile, entity: DesignUnit) -> list[DesignUnit]:
    return [
        unit
        for unit in project.design_units
        if unit.kind == "architecture"
        and unit.library_id == entity.library_id
        and (unit.parent_name or "").lower() == entity.name.lower()
    ]


def _package_body(project: ProjectFile, package: DesignUnit) -> DesignUnit | None:
    return next(
        (
            unit
            for unit in project.design_units
            if unit.kind == "package_body"
            and unit.library_id == package.library_id
            and (unit.parent_name or unit.name).lower() == package.name.lower()
        ),
        None,
    )


def _find_entity(project: ProjectFile, name: str, home_library_id: str) -> tuple[DesignUnit | None, str]:
    if "." in name:
        library_name, unit_name = name.split(".", 1)
        library = next((item for item in project.libraries if item.name.lower() == library_name.lower()), None)
        if library is None:
            return None, library_name
        return _named(project, "entity", unit_name, library.id), library_name
    return _named(project, "entity", name, home_library_id), "work"


def _find_package(
    project: ProjectFile,
    name: str,
    home_library_id: str | None,
    library_name: str | None = None,
) -> DesignUnit | None:
    if library_name:
        library = next((item for item in project.libraries if item.name.lower() == library_name.lower()), None)
        if library is None:
            return None
        return _named(project, "package", name, library.id)
    if home_library_id is None:
        return None
    return _named(project, "package", name, home_library_id)


def _named(project: ProjectFile, kind: str, name: str, library_id: str) -> DesignUnit | None:
    return next(
        (
            unit
            for unit in project.design_units
            if unit.kind == kind and unit.library_id == library_id and unit.name.lower() == name.lower()
        ),
        None,
    )


def _use_target(dependency: str) -> tuple[str, str] | None:
    if not dependency.startswith("use:"):
        return None
    parts = dependency[4:].split(".")
    if len(parts) < 2:
        return None
    return parts[0], parts[1]


def _unit_path(project: ProjectFile, unit: DesignUnit) -> Path:
    path = Path(unit.source.path)
    if path.is_absolute():
        return path
    library = next(item for item in project.libraries if item.id == unit.library_id)
    return Path(library.root_path) / path


def _blank_run(project: ProjectFile, config: SimulationConfig) -> dict:
    run_id = new_id("sim")
    run_dir = simulations_dir() / run_id
    _require_workspace(run_dir)
    run_dir.mkdir(parents=True, exist_ok=True)
    report = _blank_run_in(run_dir, project.vhdl_standard, project.library_profile, config, "")
    report["run_id"] = run_id
    _write_json(run_dir / "config.json", config.model_dump(mode="json") | {"vhdl_standard": project.vhdl_standard, "library_profile": project.library_profile})
    return report


def _blank_run_in(run_dir: Path, standard: str, profile: str, config: SimulationConfig, top: str) -> dict:
    return {
        "run_id": run_dir.name,
        "status": "running",
        "top": top,
        "vhdl_standard": standard,
        "library_profile": profile,
        "stop_time": config.stop_time,
        "waveform_format": config.waveform_format,
        "gtkw_path": config.gtkw_path,
        "ghdl_analysis": "not_run",
        "ghdl_elaboration": "not_run",
        "ghdl_simulation": "not_run",
        "started_at": _now(),
        "finished_at": None,
        "duration_ms": None,
        "waveform_path": None,
        "directory": str(run_dir),
        "diagnostics": [],
        "stderr": "",
        "signal_map": [],
        "files": [],
        "commands": [],
    }


def _stage(command: list[str]) -> str:
    if command and command[0] == "-a":
        return "analysis"
    if command and command[0] == "-e":
        return "elaboration"
    return "simulation"


def _stage_field(stage: str) -> str:
    return {"analysis": "ghdl_analysis", "elaboration": "ghdl_elaboration", "simulation": "ghdl_simulation"}[stage]


def _finish(run_dir: Path, report: dict) -> dict:
    finished = datetime.now(timezone.utc)
    report["finished_at"] = finished.isoformat()
    started = datetime.fromisoformat(report["started_at"])
    report["duration_ms"] = int((finished - started).total_seconds() * 1000)
    _write_json(run_dir / "report.json", report)
    return report


def _store(report: dict) -> None:
    if report.get("finished_at") is None and report.get("status") != "running":
        report["finished_at"] = _now()
    directory = Path(report["directory"])
    _require_workspace(directory)
    directory.mkdir(parents=True, exist_ok=True)
    _write_json(directory / "report.json", report)
    with _LOCK:
        _RUNS[report["run_id"]] = report


def _append(path: Path, command: list[str], detail: str) -> None:
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write("$ " + " ".join(command) + "\n")
        if detail:
            handle.write(detail + "\n")


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def _require_workspace(path: Path) -> None:
    root = workspace_dir().resolve()
    resolved = path.resolve()
    if resolved != root and root not in resolved.parents:
        raise RuntimeError("Refusing to write a simulation outside the workspace.")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _error(code: str, message: str, unit_id: str | None) -> Diagnostic:
    return Diagnostic(severity="error", code=code, message=message, path=unit_id, unit_id=unit_id)
