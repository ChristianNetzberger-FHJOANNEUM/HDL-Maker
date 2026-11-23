"""SRAM programming through the local D2XX build of openFPGALoader.

The executable path is local tool configuration. ``ftd2xx.dll`` is not copied.
A scan opens interface A only when the serial is given, and it does not choose
a device. Programming is SRAM only, and only after that device is named and
confirmed. A mock run never reports that the FPGA was programmed.
"""

from __future__ import annotations

import json
import re
import subprocess
import threading
from pathlib import Path

from app.fpga.program import part_matches
from app.fpga.session import release_tool, try_acquire
from app.fpga.vivado import FpgaRequestError
from app.identity import new_id
from app.models.design import ProjectFile
from app.paths import builds_dir, hardware_dir, workspace_dir
from app.storage.tools_store import load_opensource_tools

_LOCK = threading.Lock()
_SCANS: dict[str, dict] = {}
_PROGRAMS: dict[str, dict] = {}
_RUNNER = None
_FREQ = "1000000"
_INDEX = re.compile(r"index (\d+):")
_IDCODE = re.compile(r"idcode\s+(0x[0-9a-fA-F]+)")
_MODEL = re.compile(r"model\s+(\S+)")
_TYPE = re.compile(r"type\s+(.+)")
_RAW = re.compile(r"-\s+(\d+)\s+->\s+(0x[0-9a-fA-F]+)")


def set_runner(runner) -> None:
    """Tests install a callable. ``None`` restores the real process."""
    global _RUNNER
    _RUNNER = runner


def loader_board(board_id: str) -> str | None:
    """The one board this transport has programmed. Other names are not guessed."""
    if "zybo-z7-20" in board_id.replace("\\", "/"):
        return "zybo_z7_20"
    return None


def serial_error(serial: str) -> str | None:
    text = serial.strip()
    if not text:
        return "A JTAG serial number is required. The first FTDI device is not opened."
    if text[-1] == "B":
        return "Interface B is not opened. Choose the interface A serial."
    if text[-1] != "A":
        return "The serial must be interface A. A shorter prefix is not opened."
    return None


def detect_command(executable: str, board: str, serial: str) -> list[str]:
    return [
        executable,
        "-b",
        board,
        "--usb-serial-num",
        serial,
        "--freq",
        _FREQ,
        "--detect",
        "--verbose-level",
        "2",
    ]


def sram_command(executable: str, board: str, serial: str, bitstream: str) -> list[str]:
    command = [
        executable,
        "-b",
        board,
        "--usb-serial-num",
        serial,
        "--freq",
        _FREQ,
        "-m",
        "--verbose-level",
        "1",
        bitstream,
    ]
    if "-f" in command or "--write-flash" in command:
        raise RuntimeError("SRAM programming must not pass a flash flag.")
    return command


def parse_detect(text: str, expected_part: str) -> list[dict]:
    raw_values = [value for _index, value in _RAW.findall(text)]
    devices = []
    for block in re.split(r"(?=index \d+:)", text):
        header = _INDEX.search(block)
        if header is None:
            continue
        index = int(header.group(1))
        idcode_match = _IDCODE.search(block)
        idcode = idcode_match.group(1) if idcode_match else ""
        model = _MODEL.search(block)
        kind_match = _TYPE.search(block)
        part = model.group(1) if model else ""
        kind = "fpga" if part else "other"
        printed = int(idcode, 16) if idcode.lower().startswith("0x") else None
        raw_idcode = None
        for value in raw_values:
            number = int(value, 16)
            if printed is not None and (number == printed or (number & 0x0FFFFFFF) == printed):
                raw_idcode = value
                break
        devices.append(
            {
                "device_id": f"index-{index}",
                "index": index,
                "idcode": idcode,
                "raw_idcode": raw_idcode,
                "name": part or (kind_match.group(1).strip() if kind_match else f"device {index}"),
                "kind": kind,
                "part": part,
                "matches_part": bool(part) and part_matches(part, expected_part),
            }
        )
    return devices


def _loader_path() -> Path | None:
    raw = load_opensource_tools().openfpga_loader_path.strip()
    if not raw:
        return None
    path = Path(raw)
    if not path.is_file():
        return None
    return path


def _subprocess_runner(argv: list[str]) -> tuple[int, str]:
    completed = subprocess.run(
        argv,
        cwd=str(workspace_dir()),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=180,
        check=False,
    )
    return completed.returncode, f"{completed.stdout}{completed.stderr}"


def _active_runner():
    return _RUNNER or _subprocess_runner


def launch_open_scan(project: ProjectFile, serial: str) -> dict:
    scan = _prepare_scan(project, serial)
    if scan["status"] == "failed":
        return _store_scan(scan)
    if not try_acquire():
        raise FpgaRequestError("hardware_busy", "A build or a hardware operation is already running.")
    runner = _active_runner()
    scan["mock"] = _RUNNER is not None
    try:
        if scan["mock"]:
            return _execute_scan(scan, runner)
        thread = threading.Thread(target=_scan_worker, args=(scan, runner), daemon=True)
        thread.start()
        return _store_scan(scan)
    except Exception:
        release_tool()
        raise


def launch_open_program(project: ProjectFile, scan_id: str, device_id: str, build_id: str, confirm: bool) -> dict:
    program = _prepare_program(project, scan_id, device_id, build_id, confirm)
    if program["status"] == "failed":
        return _store_program(program)
    if not try_acquire():
        raise FpgaRequestError("hardware_busy", "A build or a hardware operation is already running.")
    runner = _active_runner()
    program["mock"] = _RUNNER is not None
    try:
        if program["mock"]:
            return _execute_program(program, runner)
        thread = threading.Thread(target=_program_worker, args=(program, runner), daemon=True)
        thread.start()
        return _store_program(program)
    except Exception:
        release_tool()
        raise


def open_scan(scan_id: str) -> dict | None:
    with _LOCK:
        cached = _SCANS.get(scan_id)
    if cached is not None:
        return cached
    return _read_record(hardware_dir() / "open-scans" / scan_id)


def open_program(program_id: str) -> dict | None:
    with _LOCK:
        cached = _PROGRAMS.get(program_id)
    if cached is not None:
        return cached
    return _read_record(hardware_dir() / "open-programs" / program_id)


def latest_open_scan() -> dict | None:
    return _latest(_SCANS, hardware_dir() / "open-scans")


def latest_open_program() -> dict | None:
    return _latest(_PROGRAMS, hardware_dir() / "open-programs")


def _prepare_scan(project: ProjectFile, serial: str) -> dict:
    scan = _blank_scan(serial.strip())
    if project.fpga.toolchain != "opensource":
        return _fail(scan, "This scan belongs to the open-source backend. Vivado was not called.")
    reason = serial_error(serial)
    if reason:
        return _fail(scan, reason)
    board = loader_board(project.fpga.board_id)
    if board is None:
        return _fail(scan, "This board has no tested openFPGALoader name. No other board was guessed.")
    if not project.fpga.part:
        return _fail(scan, "Choose the FPGA part before scanning. No part was filled in.")
    loader = _loader_path()
    if loader is None:
        return _fail(scan, "Set the local openFPGALoader path. ftd2xx.dll is not shipped with HDL-Maker.")
    scan["board"] = board
    scan["part"] = project.fpga.part
    scan["executable"] = str(loader)
    scan["command"] = detect_command(str(loader), board, scan["serial"])
    scan["status"] = "running"
    scan["message"] = "Scanning the named JTAG serial."
    return scan


def _prepare_program(project: ProjectFile, scan_id: str, device_id: str, build_id: str, confirm: bool) -> dict:
    program = _blank_program(scan_id, device_id, build_id, confirm)
    if project.fpga.toolchain != "opensource":
        return _fail(program, "Open-source programming is not used while Vivado is the selected backend.")
    scan = open_scan(scan_id)
    build = _read_report(builds_dir() / build_id) if build_id else None
    if scan is None or scan.get("status") != "devices":
        return _fail(program, "Scan the named JTAG serial before programming.")
    if build is None or build.get("toolchain") != "opensource" or build.get("status") != "passed":
        return _fail(program, "Programming needs a finished open-source bitstream.")
    bitstream = Path(str(build.get("bitstream_path") or ""))
    if not bitstream.is_file():
        return _fail(program, "The open-source bitstream file is not on disk.")
    if not part_matches(str(project.fpga.part), str(build.get("part") or "")):
        return _fail(program, "The project part does not match the bitstream part. Nothing was programmed.")
    chosen = next((item for item in scan.get("devices") or [] if item.get("device_id") == device_id), None)
    if chosen is None:
        return _fail(program, "Choose a device. The first device was not selected.")
    if chosen.get("kind") != "fpga" or not chosen.get("matches_part"):
        return _fail(program, "The selected device is not the FPGA named by the bitstream. The ARM DAP is not programmed.")
    if not confirm:
        return _fail(program, "Programming starts only after an explicit confirmation.")
    loader = _loader_path()
    if loader is None:
        return _fail(program, "Set the local openFPGALoader path. ftd2xx.dll is not shipped with HDL-Maker.")
    program["serial"] = scan["serial"]
    program["part"] = str(build.get("part") or "")
    program["bitstream_path"] = str(bitstream)
    program["device_name"] = chosen.get("name") or ""
    program["command"] = sram_command(str(loader), str(scan["board"]), str(scan["serial"]), str(bitstream))
    program["status"] = "running"
    program["message"] = "Programming SRAM on the selected device."
    program["mode"] = "sram"
    return program


def _execute_scan(scan: dict, runner) -> dict:
    try:
        code, output = runner(scan["command"])
    except Exception as exc:
        scan["status"] = "failed"
        scan["message"] = str(exc)
        scan["programmed"] = False
        return _finish_scan(scan)
    finally:
        release_tool()
    devices = parse_detect(output, scan["part"])
    scan["devices"] = devices
    scan["exit_code"] = code
    _write_log(scan, output)
    if code != 0 or not devices:
        scan["status"] = "failed"
        scan["message"] = "The JTAG scan failed. Nothing was programmed."
    else:
        scan["status"] = "devices"
        scan["message"] = f"{len(devices)} JTAG device(s). Choose one before programming."
        if scan["mock"]:
            scan["message"] = f"Mock scan. {scan['message']} The FPGA was not programmed."
    scan["programmed"] = False
    if scan["mock"]:
        scan["jtag_download"] = "not_run_mock"
    elif scan["status"] == "devices":
        scan["jtag_download"] = "detected"
    else:
        scan["jtag_download"] = "not_tested_no_hardware"
    finished = _finish_scan(scan)
    from app.fpga.artifacts import note_jtag_detect

    note_jtag_detect(finished)
    return finished


def _execute_program(program: dict, runner) -> dict:
    try:
        code, output = runner(program["command"])
    except Exception as exc:
        program["status"] = "failed"
        program["message"] = str(exc)
        program["programmed"] = False
        return _finish_program(program)
    finally:
        release_tool()
    program["exit_code"] = code
    _write_log(program, output)
    if program["mock"]:
        program["status"] = "mock_passed" if code == 0 else "failed"
        program["programmed"] = False
        program["jtag_download"] = "not_run_mock"
        program["message"] = "Mock test. The FPGA was not programmed."
        return _finish_program(program)
    if code == 0 and "done 1" in output:
        program["status"] = "passed"
        program["programmed"] = True
        program["jtag_download"] = "sram"
        program["message"] = f"SRAM programmed {program['device_name']}."
    else:
        program["status"] = "failed"
        program["programmed"] = False
        program["jtag_download"] = "failed"
        program["message"] = "SRAM programming failed. It was not repeated."
    finished = _finish_program(program)
    from app.fpga.artifacts import note_sram_programmed

    note_sram_programmed(finished)
    return finished


def _scan_worker(scan: dict, runner) -> None:
    try:
        _execute_scan(scan, runner)
    except Exception:
        release_tool()


def _program_worker(program: dict, runner) -> None:
    try:
        _execute_program(program, runner)
    except Exception:
        release_tool()


def _blank_scan(serial: str) -> dict:
    scan_id = new_id("osc")
    return {
        "scan_id": scan_id,
        "status": "failed",
        "mock": False,
        "programmed": False,
        "jtag_download": "not_run",
        "serial": serial,
        "board": "",
        "part": "",
        "executable": "",
        "command": [],
        "devices": [],
        "message": "",
        "directory": str(hardware_dir() / "open-scans" / scan_id),
        "exit_code": None,
    }


def _blank_program(scan_id: str, device_id: str, build_id: str, confirm: bool) -> dict:
    program_id = new_id("opr")
    return {
        "program_id": program_id,
        "scan_id": scan_id,
        "device_id": device_id,
        "build_id": build_id,
        "confirm": confirm,
        "status": "failed",
        "mock": False,
        "programmed": False,
        "jtag_download": "not_run",
        "mode": "sram",
        "serial": "",
        "part": "",
        "bitstream_path": "",
        "device_name": "",
        "command": [],
        "message": "",
        "directory": str(hardware_dir() / "open-programs" / program_id),
        "exit_code": None,
    }


def _fail(record: dict, message: str) -> dict:
    record["status"] = "failed"
    record["message"] = message
    record["programmed"] = False
    return record


def _store_scan(scan: dict) -> dict:
    with _LOCK:
        _SCANS[scan["scan_id"]] = scan
    _write_record(scan)
    return scan


def _store_program(program: dict) -> dict:
    with _LOCK:
        _PROGRAMS[program["program_id"]] = program
    _write_record(program)
    return program


def _finish_scan(scan: dict) -> dict:
    return _store_scan(scan)


def _finish_program(program: dict) -> dict:
    return _store_program(program)


def _write_record(record: dict) -> None:
    directory = Path(record["directory"])
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "record.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")


def _write_log(record: dict, output: str) -> None:
    directory = Path(record["directory"])
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "console.log").write_text(output, encoding="utf-8")


def _read_record(directory: Path) -> dict | None:
    return _read_json(directory / "record.json")


def _read_report(directory: Path) -> dict | None:
    return _read_json(directory / "report.json")


def _read_json(path: Path) -> dict | None:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _latest(cache: dict[str, dict], root: Path) -> dict | None:
    with _LOCK:
        if cache:
            return max(cache.values(), key=lambda item: item.get("scan_id") or item.get("program_id") or "")
    if not root.is_dir():
        return None
    found = []
    for path in root.iterdir():
        record = _read_record(path)
        if record is not None:
            found.append(record)
    if not found:
        return None
    return found[-1]
