"""JTAG programming.

A mock program can pass its own checks. It is marked as a mock and does not
claim that the FPGA was programmed. The installed Vivado scan must not program
a device. With no cable it records no target. With a cable it records the
devices and still leaves the download untested.
"""

from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.fpga.program import launch_program, launch_scan, part_matches, render_scan_tcl
from app.fpga.session import reset_tool
from app.main import app
from app.models.design import FpgaProgramRequest
from app.storage.tools_store import ToolSettings, save_tools

client = TestClient(app)
VIVADO = Path(r"C:\Xilinx\Vivado\2019.1\bin\vivado.bat")
PART = "xc7z010clg400-1"
TARGET_A = "localhost:3121/xilinx_tcf/Digilent/A"
TARGET_B = "localhost:3121/xilinx_tcf/Digilent/B"


@pytest.fixture(autouse=True)
def workspace(tmp_path, monkeypatch) -> Path:
    root = tmp_path / "ws"
    root.mkdir()
    monkeypatch.setenv("HDS_WORKSPACE", str(root))
    from app.fpga import program

    program._SCANS.clear()
    program._PROGRAMS.clear()
    reset_tool()
    return root


def test_part_match_accepts_the_device_prefix_and_rejects_other_devices() -> None:
    assert part_matches("xc7z010", PART)
    assert part_matches(PART, PART)
    assert not part_matches("xc7z020", PART)
    assert not part_matches("arm_dap", PART)
    assert not part_matches("", PART)


def test_a_vivado_log_echo_does_not_duplicate_devices(workspace: Path) -> None:
    payload = _chain()

    def run(_script: Path, directory: Path) -> tuple[int, str]:
        (directory / "vivado.log").write_text(payload, encoding="utf-8")
        return 0, payload

    scan = launch_scan(PART, runner=run)
    assert scan["status"] == "devices"
    assert len(scan["devices"]) == 3
    assert [(item["target"], item["name"]) for item in scan["devices"]] == [
        (TARGET_A, "arm_dap_0"),
        (TARGET_A, "xc7z010_1"),
        (TARGET_B, "xc7z010_1"),
    ]


def test_scan_tcl_uses_the_2019_1_hardware_commands() -> None:
    script = render_scan_tcl()
    assert "open_hw_manager" not in script
    assert "load_features labtools" in script
    assert "open_hw" in script
    assert "connect_hw_server -url localhost:3121" in script
    assert "get_hw_targets -quiet" in script
    assert "get_hw_devices -quiet" in script
    assert "lindex [get_hw_devices] 0" not in script


def test_no_hardware_is_not_a_successful_program(workspace: Path) -> None:
    _bitstream(workspace)
    scan = launch_scan(PART, runner=_text("HDL-MAKER-NO-HARDWARE\tno targets\nERROR: [Labtoolstcl 44-199] No matching targets found\n"))
    assert scan["status"] == "no_hardware"
    assert scan["mock"] is True
    assert scan["programmed"] is False
    assert scan["jtag_download"] == "not_tested_no_hardware"
    attempt = launch_program(_request(scan["scan_id"], "", confirm=True))
    assert attempt["status"] == "failed"
    assert attempt["programmed"] is False
    assert attempt["status"] != "mock_passed"
    assert any(item["code"] == "no_hardware" for item in attempt["diagnostics"])
    assert not (Path(attempt["directory"]) / "program.tcl").exists()


def test_the_first_device_is_not_selected_and_a_mock_program_is_labeled(workspace: Path) -> None:
    _bitstream(workspace)
    scan = launch_scan(PART, runner=_text(_chain()))
    assert scan["status"] == "devices"
    assert scan["programmed"] is False
    assert "Mock scan" in scan["message"]
    assert [item["matches_part"] for item in scan["devices"]] == [False, True, True]
    missing = launch_program(_request(scan["scan_id"], "", confirm=True))
    assert missing["programmed"] is False
    assert any(item["code"] == "device_required" for item in missing["diagnostics"])
    assert "first device was not selected" in missing["message"]
    dap = scan["devices"][0]
    rejected = launch_program(_request(scan["scan_id"], dap["device_id"], confirm=True))
    assert rejected["status"] == "failed"
    assert rejected["programmed"] is False
    assert any(item["code"] == "part_mismatch" for item in rejected["diagnostics"])
    chosen = scan["devices"][2]
    unconfirmed = launch_program(_request(scan["scan_id"], chosen["device_id"], confirm=False))
    assert any(item["code"] == "confirm_required" for item in unconfirmed["diagnostics"])
    assert unconfirmed["programmed"] is False
    programmed = launch_program(_request(scan["scan_id"], chosen["device_id"], confirm=True))
    assert programmed["status"] == "mock_passed"
    assert programmed["mock"] is True
    assert programmed["programmed"] is False
    assert programmed["jtag_download"] == "not_run_mock"
    assert programmed["message"] == "Mock test. The FPGA was not programmed."
    script = (Path(programmed["directory"]) / "program.tcl").read_text(encoding="utf-8")
    assert f'NAME == "{TARGET_B}"' in script
    assert TARGET_A not in script
    assert 'NAME == "xc7z010_1"' in script
    assert "arm_dap_0" not in script
    assert "program_hw_devices -type bit" in script
    assert "set_property PROGRAM.FILE" in script
    assert "open_hw_manager" not in script
    assert "lindex [get_hw_devices] 0" not in script
    assert "load_features labtools" in script


def test_a_synthesis_build_and_an_unsafe_name_are_rejected(workspace: Path) -> None:
    build = _bitstream(workspace)
    report = json.loads((Path(build["directory"]) / "report.json").read_text(encoding="utf-8"))
    report["target"] = "synthesis"
    report["bitstream_path"] = None
    (Path(build["directory"]) / "report.json").write_text(json.dumps(report), encoding="utf-8")
    scan = launch_scan(PART, runner=_text(_chain()))
    attempt = launch_program(_request(scan["scan_id"], scan["devices"][1]["device_id"], confirm=True))
    assert any(item["code"] == "bitstream_not_ready" for item in attempt["diagnostics"])
    assert attempt["programmed"] is False
    quoted = launch_scan(
        PART,
        runner=_text(f"HDL-MAKER-DEVICE\t{TARGET_A}\txc7z010\"\txc7z010\n"),
    )
    unsafe = launch_program(_request(quoted["scan_id"], quoted["devices"][0]["device_id"], confirm=True, build_id=_fresh_bitstream(workspace)))
    assert any(item["code"] == "device_name_unsafe" for item in unsafe["diagnostics"])
    assert unsafe["programmed"] is False


def test_program_settings_do_not_change_the_ui_board(workspace: Path) -> None:
    ui = workspace / "ui.json"
    ui.write_text('{"state_text_px": 8, "board_id": "zybo-z7-10/A.0/board.xml"}\n', encoding="utf-8")
    _bitstream(workspace)
    scan = launch_scan(PART, runner=_text(_chain()))
    saved = client.post(
        "/api/fpga/hardware/programs",
        json={"scan_id": scan["scan_id"], "device_id": scan["devices"][1]["device_id"], "build_id": "bld_test", "confirm": False},
    )
    assert saved.status_code == 200
    assert saved.json()["programmed"] is False
    assert ui.read_text(encoding="utf-8") == '{"state_text_px": 8, "board_id": "zybo-z7-10/A.0/board.xml"}\n'


@pytest.mark.skipif(not VIVADO.is_file(), reason="Vivado 2019.1 is not installed")
def test_installed_vivado_scan_does_not_program(workspace: Path) -> None:
    save_tools(ToolSettings(vivado_path=str(VIVADO)))
    started = launch_scan(PART)
    assert started["status"] == "running"
    assert started["mock"] is False
    finished = _wait(started["scan_id"])
    assert finished["status"] in {"no_hardware", "devices"}, finished["message"]
    assert finished["mock"] is False
    assert finished["programmed"] is False
    assert finished["jtag_download"] == "not_tested_no_hardware"
    assert "Vivado v2019.1" in (finished["vivado_version"] or "")
    text = (Path(finished["directory"]) / "console.log").read_text(encoding="utf-8")
    assert "HDL-MAKER-PROGRAM-DONE" not in text
    assert "program_hw_devices" not in (Path(finished["directory"]) / "scan.tcl").read_text(encoding="utf-8")
    assert "open_hw_manager" not in (Path(finished["directory"]) / "scan.tcl").read_text(encoding="utf-8")
    identities = [(item["target"], item["name"]) for item in finished["devices"]]
    assert len(identities) == len(set(identities))
    if finished["status"] == "no_hardware":
        assert finished["devices"] == []
        assert "HDL-MAKER-NO-HARDWARE" in text or "Labtoolstcl 44-199" in text
        destination = Path(r"C:\_Git\HDL-Maker\workspace\hardware\m5b-no-board")
        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(finished["directory"], destination)
    else:
        assert finished["devices"]
        assert Path(r"C:\_Git\HDL-Maker\workspace\hardware\m5b-no-board").is_dir()


def _wait(scan_id: str) -> dict:
    from app.fpga.program import scan_record

    deadline = time.time() + 180
    while time.time() < deadline:
        scan = scan_record(scan_id)
        if scan is not None and scan["status"] != "running":
            return scan
        time.sleep(0.2)
    raise AssertionError(scan_id)


def _request(scan_id: str, device_id: str, *, confirm: bool, build_id: str = "bld_test") -> FpgaProgramRequest:
    return FpgaProgramRequest(scan_id=scan_id, device_id=device_id, build_id=build_id, confirm=confirm)


def _bitstream(workspace: Path, build_id: str = "bld_test") -> dict:
    directory = workspace / "builds" / build_id
    directory.mkdir(parents=True)
    bit = directory / "bitstream.bit"
    bit.write_bytes(b"not a real bitstream")
    report = {
        "build_id": build_id,
        "status": "passed",
        "target": "bitstream",
        "part": PART,
        "bitstream_path": str(bit),
        "started_at": "2026-01-01T00:00:00+00:00",
        "directory": str(directory),
    }
    (directory / "report.json").write_text(json.dumps(report), encoding="utf-8")
    return report


def _fresh_bitstream(workspace: Path) -> str:
    _bitstream(workspace, "bld_second")
    return "bld_second"


def _chain() -> str:
    return (
        f"HDL-MAKER-DEVICE\t{TARGET_A}\tarm_dap_0\tarm_dap\n"
        f"HDL-MAKER-DEVICE\t{TARGET_A}\txc7z010_1\txc7z010\n"
        f"HDL-MAKER-DEVICE\t{TARGET_B}\txc7z010_1\txc7z010\n"
    )


def _text(payload: str):
    def run(_script: Path, _directory: Path) -> tuple[int, str]:
        return 0, payload

    return run
