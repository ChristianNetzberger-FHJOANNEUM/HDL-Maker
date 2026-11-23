"""Vivado batch builds, constraint checks, and the Zybo Z7-10 reference design.

The product code does not hardcode a part or a pin. The reference XDC is checked
against the board files. A real Vivado run is skipped when vivado.bat is absent.
"""

from __future__ import annotations

import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

import pytest
from fastapi.testclient import TestClient

from app.boards import list_boards
from app.fpga.constraints import check_constraints, parse_xdc
from app.fpga.vivado import launch_build, render_tcl, resolve_vivado, vhdl2008_supported
from app.hdl.simulate import CompiledFile
from app.main import app
from app.models.design import DesignUnit, FpgaBuildConfig, Library, Port, ProjectFile, SourceSpan
from app.storage.tools_store import ToolSettings, save_tools

client = TestClient(app)
VIVADO = Path(r"C:\Xilinx\Vivado\2019.1\bin\vivado.bat")
REPO = Path(__file__).resolve().parents[2]
EXAMPLE = REPO / "examples" / "fpga" / "zybo-z7-10-counter"
BOARD_ID = "zybo-z7-10/A.0/board.xml"


@pytest.fixture(autouse=True)
def workspace(tmp_path, monkeypatch) -> Path:
    root = tmp_path / "ws"
    root.mkdir()
    monkeypatch.setenv("HDS_WORKSPACE", str(root))
    from app.fpga import vivado
    from app.fpga.session import reset_tool

    vivado._RUNS.clear()
    vivado._CANCEL.clear()
    vivado._PROCS.clear()
    reset_tool()
    return root


def test_missing_and_invalid_vivado_paths(workspace: Path, monkeypatch) -> None:
    monkeypatch.setattr("app.fpga.vivado.shutil.which", lambda _name: None)
    missing, problem = resolve_vivado("")
    assert missing is None and problem == "vivado_missing"
    save_tools(ToolSettings(vivado_path=str(workspace / "missing-vivado.bat")))
    invalid, problem = resolve_vivado()
    assert invalid is None and problem == "invalid_vivado_path"
    project = _counter_project(workspace)
    project.fpga = _config(workspace)
    opened = launch_build(project, project.fpga)
    assert opened["status"] == "failed"
    assert any(item["code"] == "invalid_vivado_path" for item in opened["diagnostics"])
    assert opened["stages"]["synthesis"] == "not_run"


def test_a_missing_top_level_is_rejected(workspace: Path) -> None:
    save_tools(ToolSettings(vivado_path=_touch(workspace / "vivado.bat")))
    project = _counter_project(workspace)
    project.fpga = _config(workspace, top="")
    run = launch_build(project, project.fpga)
    assert any(item["code"] == "top_missing" for item in run["diagnostics"])
    assert run["stages"]["bitstream"] == "not_run"


def test_a_part_must_be_named_by_the_selected_board(workspace: Path) -> None:
    save_tools(ToolSettings(vivado_path=_touch(workspace / "vivado.bat")))
    project = _counter_project(workspace)
    project.fpga = _config(workspace, part="xc7z020clg400-1")
    run = launch_build(project, project.fpga)
    assert any(item["code"] == "part_conflict" and "xc7z020clg400-1" in item["message"] for item in run["diagnostics"])
    project.fpga = _config(workspace, part="")
    empty = launch_build(project, project.fpga)
    assert any(item["code"] == "part_missing" for item in empty["diagnostics"])
    assert "xc7z010clg400-1" in next(item["message"] for item in empty["diagnostics"] if item["code"] == "part_missing")


def test_missing_and_incomplete_constraints_do_not_invent_pins(workspace: Path) -> None:
    project = _counter_project(workspace)
    top = next(unit for unit in project.design_units if unit.kind == "entity")
    missing = check_constraints(project, top, [])
    assert any(item.code == "xdc_missing" for item in missing)
    absent = workspace / "absent.xdc"
    assert any(item.code == "xdc_missing" for item in check_constraints(project, top, [str(absent)]))
    partial = workspace / "partial.xdc"
    partial.write_text("set_property PACKAGE_PIN K17 [get_ports {clk}]\nset_property IOSTANDARD LVCMOS33 [get_ports {clk}]\n", encoding="utf-8")
    diagnostics = check_constraints(project, top, [str(partial)])
    assert any(item.code == "pin_missing" and item.unit_id == "po_led" for item in diagnostics)
    assert any(item.code == "clock_missing" and "clk" in item.message for item in diagnostics)
    assert all(item.code != "iostandard_missing" or "led" in item.message for item in diagnostics)
    stranger = workspace / "stranger.xdc"
    stranger.write_text(
        "\n".join(
            [
                "set_property PACKAGE_PIN K17 [get_ports {clk}]",
                "set_property IOSTANDARD LVCMOS33 [get_ports {clk}]",
                "create_clock -period 8.000 [get_ports {clk}]",
                "set_property PACKAGE_PIN M14 [get_ports {led}]",
                "set_property IOSTANDARD LVCMOS33 [get_ports {led}]",
                "set_property PACKAGE_PIN A1 [get_ports {other}]",
            ]
        ),
        encoding="utf-8",
    )
    extra = check_constraints(project, top, [str(stranger)])
    assert any(item.code == "port_not_in_top" and "other" in item.message for item in extra)


def test_the_reference_xdc_matches_the_board_files() -> None:
    pins = ElementTree.parse(REPO / "boardfiles" / "zybo-z7-10" / "A.0" / "part0_pins.xml")
    clock = next(pin for pin in pins.findall("pins/pin") if pin.get("name") == "sys_clk")
    led = next(pin for pin in pins.findall("pins/pin") if pin.get("name") == "leds_4bits_tri_o_0")
    board = ElementTree.parse(REPO / "boardfiles" / "zybo-z7-10" / "A.0" / "board.xml")
    frequency = next(
        parameter.get("value")
        for parameter in board.findall(".//interface[@name='sys_clock']/parameters/parameter")
        if parameter.get("name") == "frequency"
    )
    period = f"{1_000_000_000 / int(frequency):.3f}"
    text = (EXAMPLE / "zybo_counter.xdc").read_text(encoding="utf-8")
    facts = parse_xdc(text)
    assert facts.pins["clk"] == clock.get("loc")
    assert facts.standards["clk"] == clock.get("iostandard")
    assert facts.pins["led"] == led.get("loc")
    assert facts.standards["led"] == led.get("iostandard")
    assert "clk" in facts.clocks
    assert period in text
    assert set(facts.pins) == {"clk", "led"}


def test_tcl_follows_the_standard_and_does_not_pass_ghdl_flags(tmp_path: Path) -> None:
    source = tmp_path / "zybo_counter.vhd"
    source.write_text("entity zybo_counter is end;", encoding="utf-8")
    files = [CompiledFile(source, "work")]
    xdc = tmp_path / "zybo_counter.xdc"
    xdc.write_text("# xdc\n", encoding="utf-8")
    part = _part()
    synthesis = render_tcl(files, [str(xdc)], "zybo_counter", part, "93", "synopsys", "synthesis")
    assert "read_vhdl -library work " in synthesis
    assert "-vhdl2008" not in synthesis
    assert "-fsynopsys" not in synthesis
    assert "-fexplicit" not in synthesis
    assert f"synth_design -top zybo_counter -part {part}" in synthesis
    assert "write_bitstream" not in synthesis
    bitstream = render_tcl(files, [str(xdc)], "zybo_counter", part, "2008", "ieee", "bitstream")
    assert "read_vhdl -library work -vhdl2008" in bitstream
    assert "opt_design" in bitstream
    assert "place_design" in bitstream
    assert "route_design" in bitstream
    assert "write_bitstream -force bitstream.bit" in bitstream
    assert vhdl2008_supported("Vivado v2019.1 (64-bit)")
    assert vhdl2008_supported("Vivado v2016.1") is False


def test_an_old_vivado_does_not_switch_vhdl_93(workspace: Path, monkeypatch) -> None:
    save_tools(ToolSettings(vivado_path=_touch(workspace / "vivado.bat")))
    monkeypatch.setattr("app.fpga.vivado._version_text", lambda _path: ("Vivado v2016.1", ""))
    project = _counter_project(workspace)
    project.vhdl_standard = "2008"
    project.fpga = _config(workspace)
    run = launch_build(project, project.fpga)
    assert project.vhdl_standard == "2008"
    assert any(item["code"] == "vhdl2008_unsupported" for item in run["diagnostics"])
    assert not (Path(run["directory"]) / "build.tcl").exists()


def test_a_fake_synthesis_is_not_reported_as_a_bitstream(workspace: Path) -> None:
    script = workspace / "fake-vivado.cmd"
    script.write_text(
        "@echo off\r\n"
        "echo HDL-MAKER-STAGE synthesis-start\r\n"
        "echo HDL-MAKER-STAGE synthesis-done\r\n"
        "echo WARNING: sample warning\r\n",
        encoding="utf-8",
    )
    save_tools(ToolSettings(vivado_path=str(script)))
    project = _counter_project(workspace)
    project.fpga = _config(workspace, target="synthesis")
    started = launch_build(project, project.fpga)
    finished = _wait(started["build_id"])
    assert finished["status"] == "passed", finished
    assert finished["target"] == "synthesis"
    assert finished["stages"]["synthesis"] == "passed"
    assert finished["stages"]["bitstream"] == "not_run"
    assert finished["bitstream_path"] is None
    assert finished["warning_count"] == 1
    tcl = (Path(finished["directory"]) / "build.tcl").read_text(encoding="utf-8")
    assert "write_bitstream" not in tcl
    assert (Path(finished["directory"]) / "console.log").is_file()
    assert (Path(finished["directory"]) / "config.json").is_file()
    assert client.get(f"/api/fpga/builds/{finished['build_id']}/reports/console.log").status_code == 200


def test_a_running_build_can_be_cancelled(workspace: Path) -> None:
    script = workspace / "slow-vivado.cmd"
    script.write_text(
        "@echo off\r\necho HDL-MAKER-STAGE synthesis-start\r\nping -n 30 127.0.0.1 >nul\r\n",
        encoding="utf-8",
    )
    save_tools(ToolSettings(vivado_path=str(script)))
    project = _counter_project(workspace)
    project.fpga = _config(workspace)
    started = launch_build(project, project.fpga)
    deadline = time.time() + 10
    while time.time() < deadline and started["status"] == "running" and not _seen_stage(started["build_id"]):
        time.sleep(0.05)
    from app.fpga.vivado import cancel_build

    cancel_build(started["build_id"])
    finished = _wait(started["build_id"], timeout=15)
    assert finished["status"] == "failed"
    assert any(item["code"] == "cancelled" for item in finished["diagnostics"])


def test_fpga_settings_do_not_change_the_ui_board(workspace: Path) -> None:
    ui = workspace / "ui.json"
    ui.write_text('{"state_text_px": 8, "board_id": "zybo-z7-10/A.0/board.xml", "hierarchy_root_id": "du_root"}\n', encoding="utf-8")
    saved = client.put(
        "/api/fpga",
        json={"top_unit_id": "du_top", "board_id": BOARD_ID, "part": _part(), "xdc_paths": ["C:/lab/demo.xdc"], "target": "synthesis"},
    )
    assert saved.status_code == 200
    assert saved.json()["fpga"]["part"] == _part()
    assert saved.json()["vhdl_standard"] == "93"
    assert ui.read_text(encoding="utf-8") == '{"state_text_px": 8, "board_id": "zybo-z7-10/A.0/board.xml", "hierarchy_root_id": "du_root"}\n'


@pytest.mark.skipif(not VIVADO.is_file(), reason="Vivado 2019.1 is not installed")
def test_installed_vivado_synthesizes_and_builds_a_bitstream(workspace: Path) -> None:
    save_tools(ToolSettings(vivado_path=str(VIVADO)))
    project = _counter_project(workspace, EXAMPLE / "zybo_counter.vhd", EXAMPLE / "zybo_counter.xdc")
    project.fpga = _config(workspace, xdc=EXAMPLE / "zybo_counter.xdc", target="synthesis")
    started = launch_build(project, project.fpga)
    assert started["status"] == "running", started["diagnostics"]
    synthesized = _wait(started["build_id"], timeout=1200)
    assert synthesized["status"] == "passed", synthesized["diagnostics"] or synthesized["errors"]
    assert synthesized["stages"]["synthesis"] == "passed"
    assert synthesized["stages"]["bitstream"] == "not_run"
    assert "Vivado v2019.1" in (synthesized["vivado_version"] or "")
    project.fpga = _config(workspace, xdc=EXAMPLE / "zybo_counter.xdc", target="bitstream")
    started = launch_build(project, project.fpga)
    assert started["status"] == "running", started["diagnostics"]
    implemented = _wait(started["build_id"], timeout=2400)
    assert implemented["status"] == "passed", implemented["diagnostics"] or implemented["errors"]
    assert implemented["stages"]["bitstream"] == "passed"
    assert Path(implemented["bitstream_path"]).is_file()
    assert Path(implemented["bitstream_path"]).stat().st_size > 0
    _keep(synthesized)
    _keep(implemented)


def _keep(run: dict) -> None:
    from app.fpga.artifacts import archive_build

    archive_build(Path(run["directory"]), Path(r"C:\_Git\HDL-Maker\workspace\builds") / run["build_id"])


def _wait(build_id: str, timeout: int = 10) -> dict:
    from app.fpga.vivado import build_run

    deadline = time.time() + timeout
    while time.time() < deadline:
        run = build_run(build_id)
        if run is not None and run["status"] != "running":
            return run
        time.sleep(0.05)
    raise AssertionError(build_id)


def _seen_stage(build_id: str) -> bool:
    from app.fpga.vivado import build_run

    run = build_run(build_id)
    return bool(run and run["stages"]["synthesis"] == "running")


def _config(workspace: Path, top: str = "du_top", part: str | None = None, target: str = "synthesis", xdc: Path | None = None) -> FpgaBuildConfig:
    return FpgaBuildConfig(
        top_unit_id=top,
        board_id=BOARD_ID,
        part=_part() if part is None else part,
        xdc_paths=[str(xdc or (EXAMPLE / "zybo_counter.xdc"))],
        target=target,  # type: ignore[arg-type]
    )


def _part() -> str:
    board = next(item for item in list_boards().boards if item.id == BOARD_ID)
    assert board.part_names
    return board.part_names[0]


def _counter_project(workspace: Path, source: Path | None = None, xdc: Path | None = None) -> ProjectFile:
    vhd = source or (EXAMPLE / "zybo_counter.vhd")
    now = datetime.now(timezone.utc)
    return ProjectFile(
        project_id="proj_fpga",
        name="fpga",
        libraries=[Library(id="lib_test", name="demo", root_path=str(vhd.parent), imported_at=now, updated_at=now)],
        design_units=[
            _unit(vhd, "entity", "zybo_counter", unit_id="du_top", ports=[_port("po_clk", "clk", "in"), _port("po_led", "led", "out")]),
            _unit(vhd, "architecture", "rtl", parent="zybo_counter", unit_id="du_arch"),
        ],
        fpga=_config(workspace, xdc=xdc),
    )


def _unit(path: Path, kind: str, name: str, parent: str | None = None, unit_id: str = "du", ports: list[Port] | None = None) -> DesignUnit:
    return DesignUnit(
        id=unit_id,
        library_id="lib_test",
        kind=kind,
        name=name,
        language="vhdl",
        parent_name=parent,
        ports=ports or [],
        source=SourceSpan(path=str(path), sha256="a" * 64, start_line=1, end_line=40),
        parse_status="parsed",
    )


def _port(port_id: str, name: str, direction: str) -> Port:
    return Port(id=port_id, name=name, direction=direction, type_text="std_logic", width_status="scalar")


def _touch(path: Path) -> str:
    path.write_text("", encoding="utf-8")
    return str(path)
