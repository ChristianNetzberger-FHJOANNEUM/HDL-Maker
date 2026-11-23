"""GHDL simulation runs, waveform files, and the studio settings."""

from __future__ import annotations

import shutil
import threading
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.hdl.m3c import LIBRARY, _testbench
from app.hdl.simulate import CompiledFile, execute_simulation, resolve_testbench, simulation_commands
from app.main import app
from app.models.design import DesignUnit, GenericOverride, Library, Port, ProjectFile, SimulationConfig, SourceSpan
from app.storage.project_store import save_project

client = TestClient(app)

GATE = """library ieee;
use ieee.std_logic_1164.all;
entity gate is
  port (
    a : in std_logic;
    b : in std_logic;
    y : out std_logic
  );
end entity gate;
architecture rtl of gate is
begin
  y <= a and b;
end architecture rtl;
"""

GATE_TB = """library ieee;
use ieee.std_logic_1164.all;
entity gate_tb is
end entity gate_tb;
architecture sim of gate_tb is
  signal a : std_logic := '0';
  signal b : std_logic := '0';
  signal y : std_logic;
begin
  uut : entity work.gate(rtl) port map (a => a, b => b, y => y);
  stimulus : process
  begin
    a <= '1';
    b <= '1';
    wait for 10 ns;
    assert y = '1' report "and failed" severity failure;
    wait;
  end process;
end architecture sim;
"""

SIZED = """entity sized is
  generic (WIDTH : integer := 8);
  port (y : out integer);
end entity sized;
architecture rtl of sized is
begin
  y <= WIDTH;
end architecture rtl;
"""

SIZED_TB = """entity sized_tb is
  generic (WIDTH : integer := 8);
end entity sized_tb;
architecture sim of sized_tb is
  signal y : integer;
begin
  uut : entity work.sized(rtl) generic map (WIDTH => WIDTH) port map (y => y);
  stimulus : process
  begin
    wait for 1 ns;
    assert y = 4 report "generic was not applied" severity failure;
    wait;
  end process;
end architecture sim;
"""

FAIL_TB = """entity fail_tb is
end entity fail_tb;
architecture sim of fail_tb is
begin
  stimulus : process
  begin
    assert false report "boom" severity failure;
    wait;
  end process;
end architecture sim;
"""


@pytest.fixture(autouse=True)
def workspace(tmp_path, monkeypatch) -> Path:
    root = tmp_path / "ws"
    root.mkdir()
    monkeypatch.setenv("HDS_WORKSPACE", str(root))
    from app.hdl import simulate

    simulate._RUNS.clear()
    simulate._CANCEL.clear()
    return root


def test_simulation_commands_follow_the_project_profile_without_a_shell() -> None:
    files = [CompiledFile(path=Path("gate.vhd"), ghdl_library="work")]
    commands = simulation_commands(
        "2008",
        "synopsys",
        Path("C:/sim"),
        files,
        "gate_tb",
        "1us",
        Path("C:/sim/waveform.ghw"),
        "ghw",
        [("WIDTH", "4")],
    )
    rendered = [" ".join(command) for command in commands]
    assert [command[0] for command in commands] == ["-a", "-e", "-r"]
    assert all("--std=08" in command and "-fsynopsys" in command and "-fexplicit" in command for command in rendered)
    assert "-gWIDTH=4" in commands[1]
    assert "-gWIDTH=4" in commands[2]
    assert "--stop-time=1us" in commands[2]
    assert any(part.startswith("--wave=") for part in commands[2])
    assert all("--vcd=" not in command for command in rendered)
    ieee = simulation_commands("93", "ieee", Path("C:/sim"), files, "gate_tb", "10ns", Path("C:/sim/waveform.vcd"), "vcd", [])
    ieee_text = " ".join(" ".join(command) for command in ieee)
    assert "-fsynopsys" not in ieee_text
    assert "-fexplicit" not in ieee_text
    assert "--std=93" in ieee_text
    assert any(part.startswith("--vcd=") for part in ieee[2])


def test_an_invalid_stop_time_is_rejected_before_ghdl() -> None:
    with pytest.raises(ValidationError):
        SimulationConfig(stop_time="later")
    with pytest.raises(ValidationError):
        SimulationConfig(stop_time="0ns")
    with pytest.raises(ValidationError):
        GenericOverride(name="WIDTH", value="4 ns")


def test_a_missing_dependency_is_reported_and_ghdl_is_not_started(monkeypatch) -> None:
    def forbidden(*_args, **_kwargs):
        raise AssertionError("GHDL should not start")

    monkeypatch.setattr("app.hdl.ghdl_run.run_ghdl", forbidden)
    root = Path("C:/missing")
    project = _project(
        root,
        [
            _unit(root / "gate_tb.vhd", "entity", "gate_tb", unit_id="du_tb"),
            _unit(root / "gate_tb.vhd", "architecture", "sim", parent="gate_tb", instantiates=["absent"], unit_id="du_tb_arch"),
        ],
    )
    files, _signals, diagnostics = resolve_testbench(project, "du_tb")
    assert files == []
    assert any(item.code == "missing_dependency" and "absent" in item.message for item in diagnostics)


def test_a_structural_design_produces_a_waveform(workspace: Path) -> None:
    assert shutil.which("ghdl") is not None
    gate = workspace / "gate.vhd"
    bench = workspace / "gate_tb.vhd"
    gate.write_text(GATE, encoding="utf-8")
    bench.write_text(GATE_TB, encoding="utf-8")
    project = _project(
        workspace,
        [
            _unit(gate, "entity", "gate", unit_id="du_gate", ports=[_port("po_y", "y", "out")]),
            _unit(gate, "architecture", "rtl", parent="gate", unit_id="du_gate_arch"),
            _unit(bench, "entity", "gate_tb", unit_id="du_tb"),
            _unit(
                bench,
                "architecture",
                "sim",
                parent="gate_tb",
                instantiates=["gate"],
                unit_id="du_tb_arch",
                end_line=20,
            ),
        ],
    )
    files, signals, diagnostics = resolve_testbench(project, "du_tb")
    assert diagnostics == []
    assert [item.path.name for item in files] == ["gate.vhd", "gate_tb.vhd"]
    assert any(item["object_id"] == "po_y" and item["vhdl_path"] == "/gate_tb/uut/y" for item in signals)
    first = execute_simulation(workspace / "simulations" / "one", files, "gate_tb", "93", "ieee", SimulationConfig(stop_time="100ns"), signals)
    second = execute_simulation(workspace / "simulations" / "two", files, "gate_tb", "93", "ieee", SimulationConfig(stop_time="100ns", waveform_format="vcd"), signals)
    assert first["ghdl_analysis"] == "passed", first["diagnostics"]
    assert first["ghdl_elaboration"] == "passed", first["diagnostics"]
    assert first["ghdl_simulation"] == "passed", first["diagnostics"]
    assert first["status"] == "passed"
    assert Path(first["waveform_path"]).is_file()
    assert Path(first["waveform_path"]).stat().st_size > 0
    assert Path(second["waveform_path"]).is_file()
    assert Path(first["waveform_path"]).is_file()
    assert first["directory"] != second["directory"]


def test_a_generic_override_changes_the_simulated_value(workspace: Path) -> None:
    assert shutil.which("ghdl") is not None
    design = workspace / "sized.vhd"
    bench = workspace / "sized_tb.vhd"
    design.write_text(SIZED, encoding="utf-8")
    bench.write_text(SIZED_TB, encoding="utf-8")
    files = [CompiledFile(design, "work"), CompiledFile(bench, "work")]
    config = SimulationConfig(stop_time="20ns", generic_overrides=[GenericOverride(name="WIDTH", value="4")])
    report = execute_simulation(workspace / "simulations" / "generic", files, "sized_tb", "93", "ieee", config)
    assert report["ghdl_simulation"] == "passed", report["diagnostics"]


def test_a_failing_assertion_is_a_simulation_failure(workspace: Path) -> None:
    assert shutil.which("ghdl") is not None
    bench = workspace / "fail_tb.vhd"
    bench.write_text(FAIL_TB, encoding="utf-8")
    report = execute_simulation(
        workspace / "simulations" / "fail",
        [CompiledFile(bench, "work")],
        "fail_tb",
        "93",
        "ieee",
        SimulationConfig(stop_time="20ns"),
    )
    assert report["ghdl_analysis"] == "passed", report["diagnostics"]
    assert report["ghdl_elaboration"] == "passed", report["diagnostics"]
    assert report["ghdl_simulation"] == "failed"
    assert report["status"] == "failed"
    assert any("boom" in item["message"] for item in report["diagnostics"])


def test_the_morse_testbench_simulates_under_the_legacy_profile(workspace: Path) -> None:
    assert shutil.which("ghdl") is not None
    bench = workspace / "morse_compare_tb.vhd"
    bench.write_text(_testbench(), encoding="utf-8")
    hdl = LIBRARY / "hdl"
    files = [
        CompiledFile(hdl / "utilities_pkg.vhd", "work"),
        CompiledFile(hdl / "utilities_pkg_body.vhd", "work"),
        CompiledFile(hdl / "morse_transmitter_fsm.vhd", "work"),
        CompiledFile(bench, "work"),
    ]
    before = (hdl / "morse_transmitter_fsm.vhd").read_bytes()
    report = execute_simulation(
        workspace / "simulations" / "morse",
        files,
        "morse_compare_tb",
        "93",
        "synopsys",
        SimulationConfig(stop_time="1us", waveform_format="ghw"),
    )
    assert (hdl / "morse_transmitter_fsm.vhd").read_bytes() == before
    assert report["ghdl_analysis"] == "passed", report["diagnostics"]
    assert report["ghdl_elaboration"] == "passed", report["diagnostics"]
    assert report["ghdl_simulation"] == "passed", report["diagnostics"]
    assert Path(report["waveform_path"]).suffix == ".ghw"
    assert Path(report["waveform_path"]).stat().st_size > 0


def test_simulation_settings_stay_out_of_the_ui_file(workspace: Path) -> None:
    ui = workspace / "ui.json"
    ui.write_text('{"state_text_px": 8, "board_id": "zybo", "hierarchy_root_id": "du_root"}\n', encoding="utf-8")
    saved = client.put(
        "/api/simulation",
        json={"testbench_unit_id": "du_tb", "stop_time": "2us", "waveform_format": "vcd", "generic_overrides": []},
    )
    assert saved.status_code == 200
    body = saved.json()
    assert body["simulation"]["stop_time"] == "2us"
    assert body["simulation"]["testbench_unit_id"] == "du_tb"
    assert body["vhdl_standard"] == "93"
    assert body["library_profile"] == "ieee"
    assert ui.read_text(encoding="utf-8") == '{"state_text_px": 8, "board_id": "zybo", "hierarchy_root_id": "du_root"}\n'
    rejected = client.put("/api/simulation", json={"stop_time": "soon"})
    assert rejected.status_code == 422


def test_the_request_returns_while_the_simulation_is_still_running(workspace: Path, monkeypatch) -> None:
    bench = workspace / "gate_tb.vhd"
    bench.write_text("entity gate_tb is end;", encoding="utf-8")
    project = _project(workspace, [_unit(bench, "entity", "gate_tb", unit_id="du_tb")])
    project.simulation = SimulationConfig(testbench_unit_id="du_tb", stop_time="1us")
    save_project(project)
    release = threading.Event()

    def slow(*_args, **_kwargs):
        release.wait(3)
        return {
            "run_id": "sim_slow",
            "status": "passed",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "directory": str(workspace / "simulations" / "slow"),
            "diagnostics": [],
            "ghdl_analysis": "passed",
            "ghdl_elaboration": "passed",
            "ghdl_simulation": "passed",
        }

    monkeypatch.setattr("app.hdl.simulate.execute_simulation", slow)
    started = datetime.now(timezone.utc)
    response = client.post("/api/simulation/runs")
    elapsed = (datetime.now(timezone.utc) - started).total_seconds()
    release.set()
    assert response.status_code == 200
    assert response.json()["status"] == "running"
    assert elapsed < 1


def test_a_missing_gtkwave_keeps_the_waveform(workspace: Path, monkeypatch) -> None:
    waveform = workspace / "simulations" / "kept" / "waveform.ghw"
    waveform.parent.mkdir(parents=True)
    waveform.write_bytes(b"ghw")
    report = {
        "run_id": "kept",
        "status": "passed",
        "waveform_path": str(waveform),
        "directory": str(waveform.parent),
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    (waveform.parent / "report.json").write_text(__import__("json").dumps(report), encoding="utf-8")
    monkeypatch.setattr("app.hdl.gtkwave.shutil.which", lambda name: None if name == "gtkwave" else shutil.which(name))
    opened = client.post("/api/simulation/runs/kept/gtkwave")
    assert opened.status_code == 200
    body = opened.json()
    assert body["opened"] is False
    assert "GTKWave was not found" in body["message"]
    assert waveform.is_file()


def _project(root: Path, units: list[DesignUnit]) -> ProjectFile:
    now = datetime.now(timezone.utc)
    return ProjectFile(
        project_id="proj_test",
        name="sim",
        libraries=[Library(id="lib_test", name="demo", root_path=str(root), imported_at=now, updated_at=now)],
        design_units=units,
    )


def _unit(
    path: Path,
    kind: str,
    name: str,
    parent: str | None = None,
    instantiates: list[str] | None = None,
    unit_id: str = "du_unit",
    ports: list[Port] | None = None,
    end_line: int = 40,
) -> DesignUnit:
    return DesignUnit(
        id=unit_id,
        library_id="lib_test",
        kind=kind,
        name=name,
        language="vhdl",
        parent_name=parent,
        instantiates=instantiates or [],
        ports=ports or [],
        source=SourceSpan(path=str(path), sha256="a" * 64, start_line=1, end_line=end_line),
        parse_status="parsed",
    )


def _port(port_id: str, name: str, direction: str) -> Port:
    return Port(id=port_id, name=name, direction=direction, type_text="std_logic", width_status="scalar")
