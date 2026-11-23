"""Open-source FPGA build pipeline.

Fake tools cover the failure paths. The Zybo Z7-20 counter runs on the local
openXC7 and OSS CAD Suite trees when those files are present. The pipeline
does not call Vivado and does not program the FPGA.
"""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.boards import list_boards
from app.fpga.opensource import (
    STAGES,
    build_run,
    launch_build,
    parse_nextpnr_log,
    probe_opensource,
    run_build,
)
from app.fpga.program import latest_bitstream, launch_program
from app.fpga.session import reset_tool
from app.fpga.vivado import latest_build
from app.main import app
from app.models.design import DesignUnit, FpgaBuildConfig, FpgaProgramRequest, Library, Port, ProjectFile, SourceSpan
from app.storage.project_store import save_project
from app.storage.tools_store import OpenSourceSettings, save_opensource_tools

client = TestClient(app)
REPO = Path(__file__).resolve().parents[2]
VHDL = REPO / "examples" / "fpga" / "zybo-z7-10-counter" / "zybo_counter.vhd"
XDC = REPO / "examples" / "fpga" / "zybo-z7-20-counter" / "zybo_counter.xdc"
BOARD_ID = "zybo-z7-20/A.0/board.xml"
O1 = REPO / "workspace" / "toolchains" / "o1"
GHDL = Path(r"C:\Users\net\AppData\Local\Microsoft\WinGet\Packages\ghdl.ghdl.ucrt64.mcode_Microsoft.Winget.Source_8wekyb3d8bbwe\bin\ghdl.EXE")
FAKE = r"""
import sys
from pathlib import Path
kind = sys.argv[1]
args = sys.argv[2:]
fail = Path(__file__).with_name("fail-" + kind)
if fail.is_file() and "--version" not in args and "-V" not in args and "--help" not in args:
    print(fail.read_text(encoding="utf-8"))
    raise SystemExit(1)
if "--version" in args or "-V" in args:
    print(kind + " test-version")
    raise SystemExit(0)
if "--help" in args:
    print(kind + " help")
    raise SystemExit(0)
if kind == "ghdl":
    if "--std=08" in args or "--std=2008" in args:
        print("VHDL-2008 was invoked")
        raise SystemExit(1)
    sys.stdout.buffer.write("module zybo_counter\n  // \u00e4\nendmodule\n".encode("utf-8"))
    raise SystemExit(0)
cwd = Path.cwd()
if kind == "yosys":
    script = (cwd / "yosys.ys").read_text(encoding="utf-8")
    name = "design.json"
    marker = "-json "
    if marker in script:
        name = script.split(marker, 1)[1].split()[0]
    (cwd / name).write_text("{}\n", encoding="utf-8")
    print("       27   FDRE")
    print("        7   CARRY4")
    print("        1   INV")
elif kind == "nextpnr":
    fasm = next((item.split("=", 1)[1] for item in args if item.startswith("fasm=")), "design.fasm")
    (cwd / fasm).write_text("FASM\n", encoding="utf-8")
    print("Info: \t          SLICE_LUTX:      56/  53200     0%")
    print("Info: \t           SLICE_FFX:      27/ 106400     0%")
    print("Info: \t              CARRY4:       7/  13300     0%")
    print("Info:      setup  0.10  2.68 Source ff.D")
    print("Info: 2.00 ns logic, 0.69 ns routing")
    print("Info: Max frequency for clock 'clk': 372.58 MHz (PASS at 125.00 MHz)")
    print("Warning: ignoring unsupported XDC option '-name' (on line 16)")
elif kind == "fasm2frames":
    target = args[-1] if args else "design.frames"
    (cwd / target).write_bytes(b"frames\n")
elif kind == "xc7frames2bit":
    target = "design.bit"
    if "--output_file" in args:
        target = args[args.index("--output_file") + 1]
    (cwd / target).write_bytes(b"bit\n")
raise SystemExit(0)
"""


@pytest.fixture(autouse=True)
def workspace(tmp_path, monkeypatch) -> Path:
    root = tmp_path / "ws"
    root.mkdir()
    monkeypatch.setenv("HDS_WORKSPACE", str(root))
    from app.fpga import opensource, vivado

    vivado._RUNS.clear()
    opensource._RUNS.clear()
    opensource._BUSY = False
    reset_tool()
    monkeypatch.setattr("app.fpga.vivado.launch_build", _vivado_forbidden)
    return root


def test_vhdl2008_is_refused_before_synthesis(workspace: Path) -> None:
    _install_fakes(workspace)
    project = _project(workspace)
    project.vhdl_standard = "2008"
    run = run_build(project, project.fpga)
    assert run["status"] == "failed"
    assert any(item["code"] == "vhdl2008_not_validated" for item in run["diagnostics"])
    assert run["stages"] == {name: "not_run" for name in STAGES}
    assert run["commands"] == []


def test_a_missing_tool_does_not_fall_back_to_vivado(workspace: Path, monkeypatch) -> None:
    monkeypatch.setattr("app.fpga.opensource.shutil.which", lambda _name: None)
    project = _project(workspace)
    run = run_build(project, project.fpga)
    assert run["status"] == "failed"
    assert any(item["code"] == "yosys_missing" for item in run["diagnostics"])
    assert all(item["code"] != "vivado_missing" for item in run["diagnostics"])
    assert run["stages"]["ghdl"] == "not_run"
    assert run["commands"] == []


def test_an_invalid_tool_path_is_not_replaced(workspace: Path) -> None:
    settings = _settings(workspace)
    settings = settings.model_copy(update={"ghdl_path": str(workspace / "missing-ghdl.exe")})
    save_opensource_tools(settings)
    run = run_build(_project(workspace), _project(workspace).fpga)
    assert any(item["code"] == "invalid_ghdl_path" for item in run["diagnostics"])
    assert run["stages"]["yosys"] == "not_run"


def test_an_unknown_part_is_not_replaced(workspace: Path) -> None:
    _install_fakes(workspace, part="xc7z010clg400-1")
    run = run_build(_project(workspace), _project(workspace).fpga)
    assert run["status"] == "failed"
    assert any(item["code"] == "part_unknown" and "xc7z020clg400-1" in item["message"] for item in run["diagnostics"])
    assert run["stages"]["ghdl"] == "not_run"


def test_a_missing_database_is_reported(workspace: Path) -> None:
    _install_fakes(workspace, database=False)
    run = run_build(_project(workspace), _project(workspace).fpga)
    assert any(item["code"] == "database_missing" for item in run["diagnostics"])
    assert run["commands"] == []


def test_a_clock_without_a_period_is_not_invented(workspace: Path) -> None:
    _install_fakes(workspace)
    xdc = workspace / "no-period.xdc"
    xdc.write_text(
        "\n".join(
            [
                "set_property PACKAGE_PIN K17 [get_ports {clk}]",
                "set_property IOSTANDARD LVCMOS33 [get_ports {clk}]",
                "create_clock -name sys_clk [get_ports {clk}]",
                "set_property PACKAGE_PIN M14 [get_ports {led}]",
                "set_property IOSTANDARD LVCMOS33 [get_ports {led}]",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    project = _project(workspace, xdc)
    run = run_build(project, project.fpga)
    assert any(item["code"] == "clock_period_missing" for item in run["diagnostics"])
    assert run["clock"] is None
    assert run["commands"] == []


def test_a_yosys_failure_stops_the_later_stages(workspace: Path) -> None:
    _install_fakes(workspace)
    (workspace / "tools" / "fail-yosys").write_text("ERROR: yosys rejected the netlist\n", encoding="utf-8")
    run = run_build(_project(workspace), _project(workspace).fpga)
    assert run["stages"]["ghdl"] == "passed"
    assert run["stages"]["yosys"] == "failed"
    assert run["stages"]["nextpnr"] == "not_run"
    assert run["stages"]["fasm2frames"] == "not_run"
    assert run["stages"]["xc7frames2bit"] == "not_run"
    assert run["status"] == "failed"


def test_ghdl_verilog_is_utf8_without_a_bom(workspace: Path) -> None:
    _install_fakes(workspace)
    run = run_build(_project(workspace), _project(workspace).fpga)
    assert run["status"] == "passed", run["diagnostics"]
    verilog = Path(run["outputs"]["verilog"]).read_bytes()
    assert not verilog.startswith(b"\xef\xbb\xbf")
    assert "ä".encode("utf-8") in verilog
    assert run["clock"]["frequency_mhz"] == "125"
    assert run["clock"]["period_ns"] == 8.0
    nextpnr = " ".join(next(item["argv"] for item in run["commands"] if item["stage"] == "nextpnr"))
    assert "--freq 125" in nextpnr
    assert any(item["code"] == "xdc_option_ignored" for item in run["diagnostics"])
    assert run["reports"]["nextpnr"]["slice_lutx"] == 56
    assert run["reports"]["nextpnr"]["slice_ffx"] == 27
    assert run["reports"]["nextpnr"]["carry4"] == 7
    assert run["reports"]["yosys"]["cells"]["FDRE"] == 27
    assert Path(run["bitstream_path"]).is_file()
    assert run["bitstream_bytes"] == Path(run["bitstream_path"]).stat().st_size
    assert all("vivado" not in " ".join(item["argv"]).lower() for item in run["commands"])
    manifest = json.loads((Path(run["directory"]) / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["inputs"][0]["sha256"]
    assert manifest["toolchain"] == "opensource"


def test_synthesis_stops_after_yosys(workspace: Path) -> None:
    _install_fakes(workspace)
    project = _project(workspace)
    project.fpga.target = "synthesis"
    run = run_build(project, project.fpga)
    assert run["status"] == "passed", run["diagnostics"]
    assert run["stages"]["yosys"] == "passed"
    assert run["stages"]["nextpnr"] == "not_run"
    assert run["bitstream_path"] is None


def test_the_process_path_is_unchanged(workspace: Path) -> None:
    _install_fakes(workspace)
    before = os.environ.get("PATH")
    run_build(_project(workspace), _project(workspace).fpga)
    assert os.environ.get("PATH") == before


def test_an_opensource_bitstream_is_not_offered_for_programming(workspace: Path) -> None:
    build = workspace / "builds" / "osb_kept"
    build.mkdir(parents=True)
    bit = build / "design.bit"
    bit.write_bytes(b"abc")
    report = {
        "toolchain": "opensource",
        "target": "bitstream",
        "status": "passed",
        "bitstream_path": str(bit),
        "part": "xc7z020clg400-1",
        "started_at": "2026-11-23T00:00:02+00:00",
        "build_id": "osb_kept",
    }
    (build / "report.json").write_text(json.dumps(report), encoding="utf-8")
    vivado_build = workspace / "builds" / "bld_kept"
    vivado_build.mkdir()
    vivado_bit = vivado_build / "bitstream.bit"
    vivado_bit.write_bytes(b"vivado")
    (vivado_build / "report.json").write_text(
        json.dumps(
            {
                "target": "bitstream",
                "status": "passed",
                "bitstream_path": str(vivado_bit),
                "part": "xc7z010clg400-1",
                "started_at": "2026-11-23T00:00:01+00:00",
                "build_id": "bld_kept",
            }
        ),
        encoding="utf-8",
    )
    os.utime(build / "report.json", None)
    assert latest_bitstream()["build_id"] == "bld_kept"
    assert latest_build()["build_id"] == "bld_kept"
    from app.fpga.opensource import latest_build as latest_open

    assert latest_open()["build_id"] == "osb_kept"
    program = launch_program(FpgaProgramRequest(scan_id="missing", build_id="osb_kept", confirm=True))
    assert program["programmed"] is False
    assert any(item["code"] == "opensource_not_programmed" for item in program["diagnostics"])


def test_the_check_endpoint_reports_the_configured_tools(workspace: Path) -> None:
    _install_fakes(workspace)
    opened = client.post("/api/fpga/opensource/check")
    assert opened.status_code == 200
    body = opened.json()
    assert body["tools"]["yosys"]["ok"] is True
    assert body["database"]["zynq7"]
    saved = client.put("/api/fpga/opensource/tools", json={"ghdl_path": str(workspace / "tools" / "ghdl.cmd")})
    assert saved.status_code == 200
    assert saved.json()["yosys_path"] == ""


def test_installed_tools_match_the_o1_counter(workspace: Path) -> None:
    tools = _installed_tools()
    if tools is None:
        pytest.skip("openXC7 or OSS CAD Suite is not extracted on this machine")
    save_opensource_tools(tools)
    probed = probe_opensource()
    assert probed["ok"] is True, probed
    assert probed["database"]["zynq7"]
    assert Path(probed["database"]["zynq7"]).name.casefold() == "zynq7"
    project = _project(workspace)
    save_project(project)
    started = launch_build(project, project.fpga)
    assert started["status"] == "running", started["diagnostics"]
    run = _wait(started["build_id"], timeout=180)
    assert run["status"] == "passed", run["diagnostics"]
    assert list(run["stages"].values()) == ["passed"] * len(STAGES)
    log = (Path(run["directory"]) / "nextpnr.log").read_text(encoding="utf-8", errors="replace")
    parsed = parse_nextpnr_log(log)
    assert run["reports"]["nextpnr"]["slice_lutx"] == parsed["slice_lutx"]
    assert run["reports"]["nextpnr"]["slice_ffx"] == parsed["slice_ffx"]
    assert run["reports"]["nextpnr"]["carry4"] == parsed["carry4"]
    assert run["reports"]["nextpnr"]["critical_path_ns"] == parsed["critical_path_ns"]
    assert run["bitstream_bytes"] == Path(run["bitstream_path"]).stat().st_size
    verilog = Path(run["outputs"]["verilog"]).read_bytes()
    assert not verilog.startswith(b"\xef\xbb\xbf")
    o1_log = O1 / "zybo-counter-build" / "nextpnr.log"
    o1_bit = O1 / "zybo-counter-build" / "zybo_counter.bit"
    comparison = {"o2a": run["reports"]["nextpnr"], "bitstream_bytes": run["bitstream_bytes"], "elapsed_seconds": run["elapsed_seconds"]}
    if o1_log.is_file():
        comparison["o1"] = parse_nextpnr_log(o1_log.read_text(encoding="utf-8", errors="replace"))
        assert comparison["o2a"]["slice_ffx"] == comparison["o1"]["slice_ffx"]
        assert comparison["o2a"]["carry4"] == comparison["o1"]["carry4"]
        assert comparison["o2a"]["slice_lutx"] == comparison["o1"]["slice_lutx"]
        assert comparison["o2a"]["critical_path_ns"] == comparison["o1"]["critical_path_ns"]
    if o1_bit.is_file():
        comparison["o1_bitstream_bytes"] = o1_bit.stat().st_size
        assert run["bitstream_bytes"] == comparison["o1_bitstream_bytes"]
    yosys_log = (Path(run["directory"]) / "yosys.log").read_text(encoding="utf-8", errors="replace")
    assert "27" in yosys_log and "FDRE" in yosys_log
    destination = REPO / "workspace" / "builds" / run["build_id"]
    from app.fpga.artifacts import archive_build

    if archive_build(Path(run["directory"]), destination):
        for name in ("report.json", "manifest.json"):
            path = destination / name
            payload = json.loads(path.read_text(encoding="utf-8"))
            path.write_text(json.dumps(_retarget(payload, run["directory"], str(destination)), indent=2) + "\n", encoding="utf-8")
        (destination / "o1-comparison.json").write_text(json.dumps(comparison, indent=2) + "\n", encoding="utf-8")
    assert "vivado" not in json.dumps(run["commands"]).lower()


def _retarget(value, source: str, destination: str):
    if isinstance(value, str):
        return value.replace(source, destination)
    if isinstance(value, list):
        return [_retarget(item, source, destination) for item in value]
    if isinstance(value, dict):
        return {key: _retarget(item, source, destination) for key, item in value.items()}
    return value


def _wait(build_id: str, timeout: int) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        run = build_run(build_id)
        if run is not None and run["status"] != "running":
            return run
        time.sleep(0.05)
    raise AssertionError(build_id)


def _installed_tools() -> OpenSourceSettings | None:
    yosys = O1 / "oss-cad-suite" / "bin" / "yosys.exe"
    nextpnr = O1 / "openxc7" / "bin" / "nextpnr-xilinx.exe"
    frames = O1 / "openxc7" / "bin" / "fasm2frames.cmd"
    bitgen = O1 / "openxc7" / "bin" / "xc7frames2bit.exe"
    paths = (GHDL, yosys, nextpnr, frames, bitgen)
    if not all(path.is_file() for path in paths):
        return None
    return OpenSourceSettings(
        ghdl_path=str(GHDL),
        yosys_path=str(yosys),
        nextpnr_xilinx_path=str(nextpnr),
        fasm2frames_path=str(frames),
        xc7frames2bit_path=str(bitgen),
    )


def _install_fakes(workspace: Path, part: str = "xc7z020clg400-1", database: bool = True) -> None:
    tools = workspace / "tools"
    tools.mkdir()
    (tools / "fake_tool.py").write_text(FAKE, encoding="utf-8")
    names = {
        "ghdl_path": "ghdl",
        "yosys_path": "yosys",
        "nextpnr_xilinx_path": "nextpnr",
        "fasm2frames_path": "fasm2frames",
        "xc7frames2bit_path": "xc7frames2bit",
    }
    paths = {}
    for field, kind in names.items():
        command = tools / f"{field}.cmd"
        command.write_text(f'@echo off\r\n"{sys.executable}" "{tools / "fake_tool.py"}" {kind} %*\r\n', encoding="utf-8")
        paths[field] = str(command)
    database_path = ""
    if database:
        root = workspace / "prjxray-db"
        family = root / "zynq7"
        (family / "mapping").mkdir(parents=True)
        (family / "mapping" / "devices.yaml").write_text("devices: {}\n", encoding="utf-8")
        (family / "mapping" / "parts.yaml").write_text(f"{part}:\n  device: demo\n", encoding="utf-8")
        (family / part).mkdir()
        (family / part / "part.yaml").write_text("idcode: 1\n", encoding="utf-8")
        database_path = str(root)
    save_opensource_tools(OpenSourceSettings(prjxray_db_path=database_path, **paths))


def _settings(workspace: Path) -> OpenSourceSettings:
    _install_fakes(workspace)
    from app.storage.tools_store import load_opensource_tools

    return load_opensource_tools()


def _project(workspace: Path, xdc: Path | None = None) -> ProjectFile:
    chosen = xdc or XDC
    now = datetime.now(timezone.utc)
    board = next(item for item in list_boards().boards if item.id == BOARD_ID)
    part = next(name for name in board.part_names if name == "xc7z020clg400-1")
    return ProjectFile(
        project_id="proj_o2a",
        name="o2a",
        libraries=[Library(id="lib_test", name="demo", root_path=str(VHDL.parent), imported_at=now, updated_at=now)],
        design_units=[
            _unit("entity", "zybo_counter", "du_top", ports=[_port("po_clk", "clk", "in"), _port("po_led", "led", "out")]),
            _unit("architecture", "rtl", "du_arch", parent="zybo_counter"),
        ],
        fpga=FpgaBuildConfig(top_unit_id="du_top", board_id=BOARD_ID, part=part, xdc_paths=[str(chosen)], target="bitstream"),
    )


def _unit(kind: str, name: str, unit_id: str, parent: str | None = None, ports: list[Port] | None = None) -> DesignUnit:
    return DesignUnit(
        id=unit_id,
        library_id="lib_test",
        kind=kind,
        name=name,
        language="vhdl",
        parent_name=parent,
        ports=ports or [],
        source=SourceSpan(path=str(VHDL), sha256="a" * 64, start_line=1, end_line=40),
        parse_status="parsed",
    )


def _port(port_id: str, name: str, direction: str) -> Port:
    return Port(id=port_id, name=name, direction=direction, type_text="std_logic", width_status="scalar")


def _vivado_forbidden(*_args, **_kwargs):
    raise AssertionError("The open-source build called Vivado.")
