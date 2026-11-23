"""O3a backend selection and the mocked D2XX programmer.

The open-source builder is the O2a pipeline. These tests do not start that
pipeline's real tools and they do not open a USB device. A mock scan never
counts as programming the FPGA.
"""

from __future__ import annotations

from pathlib import Path

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.fpga import open_loader
from app.fpga.open_loader import detect_command, parse_detect, serial_error, set_runner, sram_command
from app.fpga.session import reset_tool
from app.main import app
from app.models.design import DesignUnit, FpgaBuildConfig, Library, Port, ProjectFile, SourceSpan
from app.storage.project_store import save_project
from app.storage.tools_store import OpenSourceSettings, save_opensource_tools

client = TestClient(app)
DETECT = """
Raw IDCODE:
- 0 -> 0x23727093
- 1 -> 0x4ba00477
- 2 -> 0xffffffff
index 0:
	idcode   0x4ba00477
	type     ARM cortex A9
	irlength 4
index 1:
	idcode 0x3727093
	manufacturer xilinx
	family zynq
	model  xc7z020
	irlength 6
"""


@pytest.fixture(autouse=True)
def workspace(tmp_path, monkeypatch) -> Path:
    root = tmp_path / "ws"
    root.mkdir()
    monkeypatch.setenv("HDS_WORKSPACE", str(root))
    open_loader._SCANS.clear()
    open_loader._PROGRAMS.clear()
    set_runner(None)
    reset_tool()
    return root


def test_the_project_stores_the_backend_and_defaults_to_vivado(workspace: Path) -> None:
    save_project(_project(workspace))
    stored = client.get("/api/project")
    assert stored.json()["fpga"]["toolchain"] == "vivado"
    changed = client.put(
        "/api/fpga",
        json={
            "top_unit_id": "unit-counter",
            "board_id": "zybo-z7-20/A.0/board.xml",
            "part": "xc7z020clg400-1",
            "xdc_paths": [],
            "target": "bitstream",
            "toolchain": "opensource",
        },
    )
    assert changed.status_code == 200
    assert changed.json()["fpga"]["toolchain"] == "opensource"
    again = client.get("/api/project")
    assert again.json()["fpga"]["toolchain"] == "opensource"
    assert again.json()["vhdl_standard"] == "93"


def test_a_missing_loader_is_reported_and_not_replaced(workspace: Path) -> None:
    _select_opensource(workspace)
    save_opensource_tools(OpenSourceSettings(openfpga_loader_path=str(workspace / "missing-loader.exe")))
    calls: list[list[str]] = []
    set_runner(lambda argv: calls.append(argv) or (0, DETECT))
    scan = client.post("/api/fpga/opensource/hardware/scans", json={"serial": "210351B4009EA"})
    assert scan.status_code == 200
    assert scan.json()["status"] == "failed"
    assert "ftd2xx.dll" in scan.json()["message"]
    assert calls == []


def test_interface_b_is_refused_before_the_loader_runs(workspace: Path) -> None:
    _ready(workspace)
    calls: list[list[str]] = []
    set_runner(lambda argv: calls.append(argv) or (0, DETECT))
    scan = client.post("/api/fpga/opensource/hardware/scans", json={"serial": "210351B4009EB"})
    assert scan.json()["status"] == "failed"
    assert "Interface B" in scan.json()["message"]
    assert calls == []
    assert serial_error("") is not None
    assert serial_error("210351B4009E") is not None


def test_a_mock_scan_lists_both_devices_and_does_not_program(workspace: Path) -> None:
    _ready(workspace)
    calls: list[list[str]] = []

    def runner(argv: list[str]) -> tuple[int, str]:
        calls.append(argv)
        return 0, DETECT

    set_runner(runner)
    scan = client.post("/api/fpga/opensource/hardware/scans", json={"serial": "210351B4009EA"}).json()
    assert scan["mock"] is True
    assert scan["programmed"] is False
    assert scan["status"] == "devices"
    assert [item["device_id"] for item in scan["devices"]] == ["index-0", "index-1"]
    arm, fpga = scan["devices"]
    assert arm["kind"] == "other"
    assert arm["matches_part"] is False
    assert fpga["part"] == "xc7z020"
    assert fpga["matches_part"] is True
    assert fpga["raw_idcode"].lower() == "0x23727093"
    assert calls[0] == detect_command(calls[0][0], "zybo_z7_20", "210351B4009EA")
    assert "-f" not in calls[0]


def test_programming_requires_the_fpga_and_confirmation(workspace: Path) -> None:
    _ready(workspace)
    build_id = _finished_build(workspace)
    calls: list[list[str]] = []
    set_runner(lambda argv: calls.append(argv) or (0, DETECT))
    scan = client.post("/api/fpga/opensource/hardware/scans", json={"serial": "210351B4009EA"}).json()
    calls.clear()
    refused = client.post(
        "/api/fpga/opensource/hardware/programs",
        json={"scan_id": scan["scan_id"], "device_id": "index-0", "build_id": build_id, "confirm": True},
    ).json()
    assert refused["status"] == "failed"
    assert refused["programmed"] is False
    assert calls == []
    unconfirmed = client.post(
        "/api/fpga/opensource/hardware/programs",
        json={"scan_id": scan["scan_id"], "device_id": "index-1", "build_id": build_id, "confirm": False},
    ).json()
    assert unconfirmed["programmed"] is False
    assert calls == []
    programmed = client.post(
        "/api/fpga/opensource/hardware/programs",
        json={"scan_id": scan["scan_id"], "device_id": "index-1", "build_id": build_id, "confirm": True},
    ).json()
    assert programmed["status"] == "mock_passed"
    assert programmed["programmed"] is False
    assert programmed["mode"] == "sram"
    assert programmed["command"] == sram_command(
        programmed["command"][0], "zybo_z7_20", "210351B4009EA", programmed["bitstream_path"]
    )
    assert "-f" not in programmed["command"]
    assert "--write-flash" not in programmed["command"]


def test_a_part_mismatch_is_not_programmed(workspace: Path) -> None:
    _ready(workspace, part="xc7z010clg400-1")
    build_id = _finished_build(workspace, part="xc7z020clg400-1")
    set_runner(lambda argv: (0, DETECT))
    scan = client.post("/api/fpga/opensource/hardware/scans", json={"serial": "210351B4009EA"}).json()
    fpga = next(item for item in scan["devices"] if item["kind"] == "fpga")
    assert fpga["matches_part"] is False
    result = client.post(
        "/api/fpga/opensource/hardware/programs",
        json={"scan_id": scan["scan_id"], "device_id": fpga["device_id"], "build_id": build_id, "confirm": True},
    ).json()
    assert result["programmed"] is False
    assert result["status"] == "failed"


def test_vivado_is_not_a_fallback_for_the_open_scan(workspace: Path) -> None:
    save_project(_project(workspace))
    calls: list[list[str]] = []
    set_runner(lambda argv: calls.append(argv) or (0, DETECT))
    scan = client.post("/api/fpga/opensource/hardware/scans", json={"serial": "210351B4009EA"}).json()
    assert scan["status"] == "failed"
    assert "Vivado" in scan["message"]
    assert calls == []


def test_parse_detect_keeps_the_raw_fpga_idcode() -> None:
    devices = parse_detect(DETECT, "xc7z020clg400-1")
    assert devices[1]["raw_idcode"].lower() == "0x23727093"
    assert devices[0]["raw_idcode"].lower() == "0x4ba00477"


def _ready(workspace: Path, part: str = "xc7z020clg400-1") -> None:
    _select_opensource(workspace, part)
    loader = workspace / "openFPGALoader.exe"
    loader.write_text("not a real loader\n", encoding="utf-8")
    save_opensource_tools(OpenSourceSettings(openfpga_loader_path=str(loader)))


def _select_opensource(workspace: Path, part: str = "xc7z020clg400-1") -> None:
    project = _project(workspace, part)
    project.fpga.toolchain = "opensource"
    save_project(project)


def _finished_build(workspace: Path, part: str = "xc7z020clg400-1") -> str:
    build_id = "osb_test"
    directory = workspace / "builds" / build_id
    directory.mkdir(parents=True)
    bitstream = directory / "zybo_counter.bit"
    bitstream.write_bytes(b"bit")
    report = {
        "build_id": build_id,
        "toolchain": "opensource",
        "status": "passed",
        "target": "bitstream",
        "part": part,
        "bitstream_path": str(bitstream),
        "started_at": "2026-11-23T00:00:00+00:00",
    }
    (directory / "report.json").write_text(__import__("json").dumps(report), encoding="utf-8")
    return build_id


def _project(workspace: Path, part: str = "xc7z020clg400-1") -> ProjectFile:
    now = datetime.now(timezone.utc)
    source = workspace / "zybo_counter.vhd"
    return ProjectFile(
        project_id="project-o3a",
        name="o3a",
        vhdl_standard="93",
        library_profile="ieee",
        libraries=[Library(id="lib-local", name="work", root_path=str(workspace), imported_at=now, updated_at=now)],
        design_units=[
            DesignUnit(
                id="unit-counter",
                library_id="lib-local",
                name="zybo_counter",
                kind="entity",
                language="vhdl",
                ports=[
                    Port(id="po-clk", name="clk", direction="in", type_text="std_logic", width_status="scalar"),
                    Port(id="po-led", name="led", direction="out", type_text="std_logic", width_status="scalar"),
                ],
                source=SourceSpan(path=str(source), sha256="a" * 64, start_line=1, end_line=2),
                parse_status="parsed",
            )
        ],
        fpga=FpgaBuildConfig(
            top_unit_id="unit-counter",
            board_id="zybo-z7-20/A.0/board.xml",
            part=part,
            xdc_paths=[],
            target="bitstream",
            toolchain="vivado",
        ),
    )
