"""JTAG programming through the Vivado 2019.1 Hardware Manager.

A scan lists every device and does not choose one. Programming starts only
when the request names one device and sets ``confirm``. A mock scan never
reports that the FPGA was programmed. Without a connected board the download
stays ``not_tested_no_hardware``.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path

from app.fpga.session import release_tool, try_acquire
from app.fpga.vivado import FpgaRequestError, resolve_vivado, vivado_command
from app.identity import new_id
from app.models.design import Diagnostic, FpgaProgramRequest
from app.paths import builds_dir, hardware_dir, workspace_dir

_UNSAFE = set('"{}\\$\n\r\t[]')
_SCANS: dict[str, dict] = {}
_PROGRAMS: dict[str, dict] = {}
_LOCK = threading.Lock()


def part_matches(hardware_part: str, build_part: str) -> bool:
    """True when the JTAG part is the bitstream part, or its device prefix.

    Vivado often reports ``xc7z010`` for a bitstream built for
    ``xc7z010clg400-1``. A different device, including an ARM DAP, does not match.
    """
    hardware = hardware_part.strip().lower()
    build = build_part.strip().lower()
    if not hardware or not build:
        return False
    if hardware == build:
        return True
    return hardware.startswith("xc") and len(hardware) >= 7 and build.startswith(hardware)


def render_scan_tcl() -> str:
    """Hardware Manager scan for Vivado 2019.1.

    ``open_hw_manager`` is not a command in this version. ``get_hw_targets``
    without ``-quiet`` is an error when no cable is connected, so the scan
    catches that and records it.
    """
    return """load_features labtools
open_hw
if {[catch {connect_hw_server -url localhost:3121} message]} {
  puts "HDL-MAKER-HW-ERROR\tconnect\t$message"
  catch {close_hw}
  exit 1
}
set targets {}
if {[catch {set targets [get_hw_targets -quiet]} message]} {
  puts "HDL-MAKER-NO-HARDWARE\t$message"
  set targets {}
}
if {[llength $targets] == 0} {
  puts "HDL-MAKER-NO-HARDWARE\tno targets"
}
foreach target $targets {
  set tname [get_property NAME $target]
  if {[catch {open_hw_target $target} message]} {
    puts "HDL-MAKER-HW-ERROR\topen_target\t$message"
    continue
  }
  foreach dev [get_hw_devices -quiet] {
    set name [get_property NAME $dev]
    set part [get_property PART $dev]
    puts "HDL-MAKER-DEVICE\t$tname\t$name\t$part"
  }
  catch {close_hw_target}
}
catch {disconnect_hw_server}
catch {close_hw}
exit 0
"""


def render_program_tcl(target: str, name: str, build_part: str, bitstream: Path) -> str:
    """Program one named device. An unfiltered first device is not used."""
    bit = bitstream.resolve().as_posix()
    return f"""load_features labtools
open_hw
if {{[catch {{connect_hw_server -url localhost:3121}} message]}} {{
  puts "HDL-MAKER-HW-ERROR\tconnect\t$message"
  catch {{close_hw}}
  exit 1
}}
set targets [get_hw_targets -quiet -filter {{NAME == "{target}"}}]
if {{[llength $targets] != 1}} {{
  puts "HDL-MAKER-HW-ERROR\ttarget_not_unique\t[llength $targets]"
  catch {{disconnect_hw_server}}
  catch {{close_hw}}
  exit 1
}}
open_hw_target [lindex $targets 0]
set devices [get_hw_devices -quiet -filter {{NAME == "{name}"}}]
if {{[llength $devices] != 1}} {{
  puts "HDL-MAKER-HW-ERROR\tdevice_not_unique\t[llength $devices]"
  catch {{close_hw_target}}
  catch {{disconnect_hw_server}}
  catch {{close_hw}}
  exit 1
}}
set dev [lindex $devices 0]
set found [string tolower [get_property PART $dev]]
set expected [string tolower "{build_part}"]
if {{$found eq "" || !($found eq $expected || ([string length $found] >= 7 && [string match -nocase "$found*" $expected]))}} {{
  puts "HDL-MAKER-HW-ERROR\tpart_mismatch\t$found"
  catch {{close_hw_target}}
  catch {{disconnect_hw_server}}
  catch {{close_hw}}
  exit 1
}}
current_hw_device $dev
set_property PROGRAM.FILE {{{bit}}} $dev
program_hw_devices -type bit $dev
puts "HDL-MAKER-PROGRAM-DONE"
catch {{close_hw_target}}
catch {{disconnect_hw_server}}
catch {{close_hw}}
exit 0
"""


def launch_scan(part: str, *, runner=None) -> dict:
    if not try_acquire():
        raise FpgaRequestError("hardware_busy", "Vivado is already running a build or a hardware operation.")
    try:
        scan = _blank_scan(part, mock=runner is not None)
        _write_scan_script(scan)
    except Exception:
        release_tool()
        raise
    if runner is not None:
        try:
            return execute_scan(scan, runner)
        finally:
            release_tool()
    thread = threading.Thread(target=_scan_worker, args=(scan,), daemon=True)
    thread.start()
    return scan


def execute_scan(scan: dict, runner) -> dict:
    directory = Path(scan["directory"])
    code, output = runner(directory / "scan.tcl", directory)
    # Vivado copies the same puts lines into vivado.log. Parsing the combined
    # text would list every device twice, so the device list comes from the
    # process output only. The log is still kept in console.log.
    devices, notes = _parse_devices(output, scan["part"])
    log = directory / "vivado.log"
    console = output
    if log.is_file():
        console = f"{output}\n{log.read_text(encoding='utf-8', errors='replace')}"
    (directory / "console.log").write_text(console, encoding="utf-8")
    scan["vivado_version"] = _version_line(console)
    scan["devices"] = devices
    scan["notes"] = notes
    if any(line.startswith("HDL-MAKER-HW-ERROR") for line in output.splitlines()) and not devices:
        scan["status"] = "failed"
        scan["message"] = _hardware_error(output) or "The hardware scan failed."
    elif not devices:
        scan["status"] = "no_hardware"
        scan["message"] = "No JTAG target was found. The bitstream was not downloaded."
    else:
        scan["status"] = "devices"
        scan["message"] = f"{len(devices)} JTAG device(s). Choose one before programming."
        if scan["mock"]:
            scan["message"] = f"Mock scan. {scan['message']} The FPGA was not programmed."
    scan["programmed"] = False
    scan["jtag_download"] = "not_tested_no_hardware"
    return _finish_scan(scan, code)


def launch_program(request: FpgaProgramRequest, *, runner=None) -> dict:
    if not try_acquire():
        raise FpgaRequestError("hardware_busy", "Vivado is already running a build or a hardware operation.")
    try:
        prepared = _prepare_program(request)
    except Exception:
        release_tool()
        raise
    if prepared["status"] == "failed":
        release_tool()
        return prepared
    if prepared["mock"]:
        try:
            return execute_program(prepared, runner)
        finally:
            release_tool()
    thread = threading.Thread(target=_program_worker, args=(prepared,), daemon=True)
    thread.start()
    return prepared


def execute_program(program: dict, runner) -> dict:
    directory = Path(program["directory"])
    if program["mock"]:
        program["status"] = "mock_passed"
        program["programmed"] = False
        program["jtag_download"] = "not_run_mock"
        program["message"] = "Mock test. The FPGA was not programmed."
        return _finish_program(program)
    code, output = runner(directory / "program.tcl", directory)
    (directory / "console.log").write_text(output, encoding="utf-8")
    if code == 0 and "HDL-MAKER-PROGRAM-DONE" in output:
        program["status"] = "passed"
        program["programmed"] = True
        program["mock"] = False
        program["jtag_download"] = "completed"
        program["message"] = f"Programmed {program['device_name']} on {program['target']}."
        return _finish_program(program)
    program["status"] = "failed"
    program["programmed"] = False
    program["mock"] = False
    program["jtag_download"] = "not_tested_no_hardware" if "HDL-MAKER-PROGRAM-DONE" not in output else "failed"
    program["message"] = _hardware_error(output) or "The JTAG programming did not finish."
    return _finish_program(program)


def scan_record(scan_id: str) -> dict | None:
    with _LOCK:
        cached = _SCANS.get(scan_id)
    if cached is not None:
        return cached
    return _read_record(hardware_dir() / "scans" / scan_id)


def latest_scan() -> dict | None:
    return _latest(_SCANS, hardware_dir() / "scans")


def program_record(program_id: str) -> dict | None:
    with _LOCK:
        cached = _PROGRAMS.get(program_id)
    if cached is not None:
        return cached
    return _read_record(hardware_dir() / "programs" / program_id)


def latest_program() -> dict | None:
    return _latest(_PROGRAMS, hardware_dir() / "programs")


def latest_bitstream() -> dict | None:
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
        if payload.get("target") == "bitstream" and payload.get("status") == "passed" and payload.get("bitstream_path"):
            runs.append(payload)
    if not runs:
        return None
    return max(runs, key=lambda item: item.get("started_at") or "")


def _prepare_program(request: FpgaProgramRequest) -> dict:
    scan = scan_record(request.scan_id)
    build = _read_record(builds_dir() / request.build_id) if request.build_id else None
    program = _blank_program(request)
    diagnostics: list[Diagnostic] = []
    if scan is None:
        diagnostics.append(_error("scan_missing", "Scan the JTAG chain before programming.", request.scan_id))
    elif scan.get("status") == "running":
        diagnostics.append(_error("scan_running", "The hardware scan is still running.", request.scan_id))
    elif scan.get("status") == "no_hardware":
        diagnostics.append(_error("no_hardware", "No JTAG target was found. The bitstream was not downloaded.", request.scan_id))
    elif scan.get("status") == "failed":
        diagnostics.append(_error("scan_failed", "The hardware scan failed. Nothing was programmed.", request.scan_id))
    if build is None:
        diagnostics.append(_error("bitstream_not_ready", "Choose a bitstream build that finished.", request.build_id))
    elif build.get("target") != "bitstream" or build.get("status") != "passed":
        diagnostics.append(_error("bitstream_not_ready", "Programming needs a finished bitstream build. Synthesis is not enough.", request.build_id))
    elif not build.get("part"):
        diagnostics.append(_error("part_missing", "The bitstream build has no part.", request.build_id))
    else:
        bit = Path(str(build.get("bitstream_path") or ""))
        if not bit.is_file() or bit.stat().st_size <= 0:
            diagnostics.append(_error("bitstream_missing", "The bitstream file from that build is not on disk.", str(bit)))
        else:
            program["bitstream_path"] = str(bit)
            program["part"] = str(build["part"])
    if not request.confirm:
        diagnostics.append(_error("confirm_required", "Programming starts only after an explicit confirmation.", None))
    if scan is not None and scan.get("status") != "running":
        devices = list(scan.get("devices") or [])
        chosen = next((item for item in devices if item.get("device_id") == request.device_id), None)
        if not request.device_id or chosen is None:
            names = ", ".join(f"{item['name']} ({item['part'] or 'no part'})" for item in devices) or "none"
            diagnostics.append(
                _error(
                    "device_required",
                    f"Choose a device. The first device was not selected. Devices: {names}.",
                    None,
                )
            )
        elif program["part"] and not part_matches(str(chosen.get("part") or ""), program["part"]):
            diagnostics.append(
                _error(
                    "part_mismatch",
                    f"Device {chosen['name']} part {chosen.get('part') or 'empty'} does not match the bitstream part {program['part']}.",
                    chosen["name"],
                )
            )
        else:
            program["device_id"] = chosen["device_id"]
            program["device_name"] = chosen["name"]
            program["target"] = chosen["target"]
            program["hardware_part"] = chosen.get("part") or ""
            if _tcl_text(chosen["target"]) is None or _tcl_text(chosen["name"]) is None or _tcl_text(program["part"]) is None:
                diagnostics.append(_error("device_name_unsafe", "The device name cannot be placed in the Tcl filter.", chosen["name"]))
    if scan is not None:
        program["mock"] = bool(scan.get("mock"))
    if diagnostics:
        program["status"] = "failed"
        program["programmed"] = False
        program["mock"] = bool(scan and scan.get("mock"))
        program["jtag_download"] = "not_run_mock" if program["mock"] else "not_tested_no_hardware"
        program["diagnostics"] = [item.model_dump(mode="json") for item in diagnostics]
        program["message"] = diagnostics[0].message
        return _finish_program(program)
    assert program["bitstream_path"]
    script = render_program_tcl(program["target"], program["device_name"], program["part"], Path(program["bitstream_path"]))
    if "lindex [get_hw_devices] 0" in script or "open_hw_manager" in script:
        program["status"] = "failed"
        program["message"] = "The programming script selected a device by position."
        program["diagnostics"] = [_error("tcl_invalid", program["message"], None).model_dump(mode="json")]
        return _finish_program(program)
    directory = Path(program["directory"])
    _require_workspace(directory)
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "program.tcl").write_text(script, encoding="utf-8")
    program["status"] = "running"
    _store_program(program)
    return program


def _scan_worker(scan: dict) -> None:
    try:
        executable, problem = resolve_vivado()
        if problem or not executable:
            scan["status"] = "failed"
            scan["programmed"] = False
            scan["jtag_download"] = "not_tested_no_hardware"
            scan["message"] = "Vivado was not found. Set the path to vivado.bat."
            scan["diagnostics"] = [_error(problem or "vivado_missing", scan["message"], None).model_dump(mode="json")]
            _finish_scan(scan, 1)
            return
        scan["vivado"] = executable

        def run(script: Path, directory: Path) -> tuple[int, str]:
            return _run_vivado(executable, script, directory)

        execute_scan(scan, run)
    except Exception as exc:
        scan["status"] = "failed"
        scan["message"] = str(exc)
        scan["programmed"] = False
        scan["jtag_download"] = "not_tested_no_hardware"
        _finish_scan(scan, 1)
    finally:
        release_tool()


def _program_worker(program: dict) -> None:
    try:
        executable, problem = resolve_vivado()
        if problem or not executable:
            program["status"] = "failed"
            program["programmed"] = False
            program["jtag_download"] = "not_tested_no_hardware"
            program["message"] = "Vivado was not found. Set the path to vivado.bat."
            _finish_program(program)
            return

        def run(script: Path, directory: Path) -> tuple[int, str]:
            return _run_vivado(executable, script, directory)

        execute_program(program, run)
    except Exception as exc:
        program["status"] = "failed"
        program["programmed"] = False
        program["message"] = str(exc)
        program["jtag_download"] = "not_tested_no_hardware"
        _finish_program(program)
    finally:
        release_tool()


def _run_vivado(executable: str, script: Path, directory: Path) -> tuple[int, str]:
    import subprocess

    command = vivado_command(executable, script, directory)
    completed = subprocess.run(
        command,
        cwd=str(directory),
        shell=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdin=subprocess.DEVNULL,
        timeout=180,
        check=False,
    )
    return completed.returncode, f"{completed.stdout}\n{completed.stderr}"


def _blank_scan(part: str, *, mock: bool) -> dict:
    scan_id = new_id("scn")
    directory = hardware_dir() / "scans" / scan_id
    scan = {
        "scan_id": scan_id,
        "status": "running",
        "mock": mock,
        "programmed": False,
        "jtag_download": "not_tested_no_hardware",
        "part": part,
        "devices": [],
        "notes": [],
        "diagnostics": [],
        "message": "Scanning JTAG targets.",
        "vivado": None,
        "vivado_version": None,
        "directory": str(directory),
    }
    _require_workspace(directory)
    directory.mkdir(parents=True, exist_ok=True)
    _store_scan(scan)
    return scan


def _write_scan_script(scan: dict) -> None:
    path = Path(scan["directory"]) / "scan.tcl"
    path.write_text(render_scan_tcl(), encoding="utf-8")


def _blank_program(request: FpgaProgramRequest) -> dict:
    program_id = new_id("prg")
    directory = hardware_dir() / "programs" / program_id
    return {
        "program_id": program_id,
        "scan_id": request.scan_id,
        "build_id": request.build_id,
        "device_id": request.device_id,
        "status": "running",
        "mock": False,
        "programmed": False,
        "jtag_download": "not_tested_no_hardware",
        "part": "",
        "hardware_part": "",
        "device_name": "",
        "target": "",
        "bitstream_path": None,
        "diagnostics": [],
        "message": "",
        "directory": str(directory),
    }


def _parse_devices(output: str, expected_part: str) -> tuple[list[dict], list[str]]:
    devices: list[dict] = []
    notes: list[str] = []
    for raw in output.splitlines():
        line = raw.strip()
        if line.startswith("HDL-MAKER-NO-HARDWARE") or "Labtoolstcl 44-199" in line or "No matching targets" in line:
            if line not in notes:
                notes.append(line)
        if not line.startswith("HDL-MAKER-DEVICE\t"):
            continue
        pieces = line.split("\t")
        if len(pieces) < 4:
            continue
        target, name, part = pieces[1], pieces[2], pieces[3]
        if not target or not name:
            continue
        devices.append(
            {
                "device_id": new_id("hw"),
                "target": target,
                "name": name,
                "part": part,
                "matches_part": part_matches(part, expected_part),
            }
        )
    return devices, notes


def _hardware_error(output: str) -> str:
    for line in output.splitlines():
        if "HDL-MAKER-HW-ERROR" in line or line.strip().startswith("ERROR:"):
            return line.strip()[:500]
    return ""


def _version_line(output: str) -> str | None:
    for line in output.splitlines():
        if "Vivado v" in line:
            return line.strip().lstrip("* ").strip()
    return None


def _tcl_text(value: str) -> str | None:
    if not value or any(character in value for character in _UNSAFE):
        return None
    return value


def _finish_scan(scan: dict, code: int) -> dict:
    if scan["status"] == "running":
        scan["status"] = "failed"
        scan["message"] = scan["message"] or f"Vivado exited with status {code}."
    _store_scan(scan)
    return scan


def _finish_program(program: dict) -> dict:
    if program["mock"] and program["status"] == "passed":
        program["status"] = "mock_passed"
        program["programmed"] = False
        program["jtag_download"] = "not_run_mock"
        program["message"] = "Mock test. The FPGA was not programmed."
    if program["mock"]:
        program["programmed"] = False
    _store_program(program)
    return program


def _store_scan(scan: dict) -> None:
    with _LOCK:
        _SCANS[scan["scan_id"]] = scan
    _write_json(Path(scan["directory"]), scan)


def _store_program(program: dict) -> None:
    with _LOCK:
        _PROGRAMS[program["program_id"]] = program
    _write_json(Path(program["directory"]), program)


def _write_json(directory: Path, payload: dict) -> None:
    _require_workspace(directory)
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "report.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def _read_record(directory: Path) -> dict | None:
    path = directory / "report.json"
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _latest(cache: dict[str, dict], root: Path) -> dict | None:
    with _LOCK:
        if cache:
            return max(cache.values(), key=lambda item: item.get("directory") or "")
    if not root.is_dir():
        return None
    reports = [path for path in root.iterdir() if (path / "report.json").is_file()]
    if not reports:
        return None
    newest = max(reports, key=lambda path: path.stat().st_mtime)
    return _read_record(newest)


def _require_workspace(path: Path) -> None:
    root = workspace_dir().resolve()
    resolved = path.resolve()
    if resolved != root and root not in resolved.parents:
        raise RuntimeError("Refusing to write a hardware record outside the workspace.")


def _error(code: str, message: str, path: str | None) -> Diagnostic:
    return Diagnostic(severity="error", code=code, message=message, path=path)
