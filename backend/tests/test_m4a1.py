"""GTKWave path, save file, and waveform-name checks.

The viewer executable is local tool configuration. These tests do not install
GTKWave and do not invent an object id for a signal the project does not have.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.hdl.gtkwave import diagnose_signal_map, launch_viewer, resolve_gtkwave, vcd_signal_names
from app.hdl.simulate import execute_simulation, resolve_testbench
from app.main import app
from app.models.design import DesignUnit, Library, Port, ProjectFile, SimulationConfig, SourceSpan
from app.storage.tools_store import save_tools, ToolSettings

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


def test_missing_executable_keeps_the_waveform(workspace: Path, monkeypatch) -> None:
    waveform = _waveform(workspace, "missing-exe")
    monkeypatch.setattr("app.hdl.gtkwave.shutil.which", lambda name: None)
    opened = client.post("/api/simulation/runs/missing-exe/gtkwave")
    assert opened.status_code == 200
    body = opened.json()
    assert body["opened"] is False
    assert body["code"] == "gtkwave_missing"
    assert waveform.is_file()


def test_invalid_executable_path_does_not_start_a_viewer(workspace: Path, monkeypatch) -> None:
    waveform = _waveform(workspace, "bad-exe")
    save_tools(ToolSettings(gtkwave_path=str(workspace / "no-such-gtkwave.exe")))
    started = {"called": False}

    def refuse(*_args, **_kwargs):
        started["called"] = True
        raise AssertionError("GTKWave was started from an invalid path.")

    monkeypatch.setattr("app.hdl.simulate.launch_viewer", refuse)
    opened = client.post("/api/simulation/runs/bad-exe/gtkwave")
    assert opened.status_code == 200
    body = opened.json()
    assert body["opened"] is False
    assert body["code"] == "invalid_gtkwave_path"
    assert started["called"] is False
    assert waveform.is_file()
    health = client.get("/api/health")
    assert health.json()["gtkwave"] is None


def test_missing_waveform_is_rejected(workspace: Path) -> None:
    directory = workspace / "simulations" / "no-wave"
    directory.mkdir(parents=True)
    report = {
        "run_id": "no-wave",
        "status": "failed",
        "waveform_path": str(directory / "waveform.ghw"),
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    (directory / "report.json").write_text(json.dumps(report), encoding="utf-8")
    opened = client.post("/api/simulation/runs/no-wave/gtkwave")
    assert opened.status_code == 400
    assert opened.json()["detail"]["code"] == "waveform_missing"
    assert not (directory / "waveform.ghw").exists()


def test_a_save_file_is_passed_through_and_a_missing_one_is_not_invented(workspace: Path, monkeypatch) -> None:
    waveform = _waveform(workspace, "with-save")
    executable = workspace / "gtkwave.exe"
    executable.write_bytes(b"")
    save_tools(ToolSettings(gtkwave_path=str(executable)))
    gtkw = workspace / "signals.gtkw"
    gtkw.write_text("[*]\n", encoding="utf-8")
    calls: list[list[str]] = []

    def record(exe: str, arguments: list[str], cwd: Path) -> int:
        calls.append([exe, *arguments])
        return 77

    monkeypatch.setattr("app.hdl.simulate.launch_viewer", record)
    report_path = waveform.parent / "report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    report["gtkw_path"] = str(gtkw)
    report_path.write_text(json.dumps(report), encoding="utf-8")
    opened = client.post("/api/simulation/runs/with-save/gtkwave")
    assert opened.status_code == 200
    assert opened.json()["opened"] is True
    assert calls == [[str(executable), str(waveform), str(gtkw)]]
    assert gtkw.read_text(encoding="utf-8") == "[*]\n"

    report["gtkw_path"] = str(workspace / "absent.gtkw")
    report_path.write_text(json.dumps(report), encoding="utf-8")
    calls.clear()
    missing = client.post("/api/simulation/runs/with-save/gtkwave")
    assert missing.status_code == 200
    assert missing.json()["code"] == "gtkw_missing"
    assert calls == []
    assert not (workspace / "absent.gtkw").exists()
    assert waveform.is_file()


def test_the_executable_path_is_not_written_into_the_ui_file(workspace: Path) -> None:
    ui = workspace / "ui.json"
    ui.write_text('{"state_text_px": 8, "board_id": "zybo", "hierarchy_root_id": "du_root"}\n', encoding="utf-8")
    saved = client.put("/api/tools", json={"gtkwave_path": "C:/tools/gtkwave.exe"})
    assert saved.status_code == 200
    assert saved.json()["gtkwave_path"] == "C:/tools/gtkwave.exe"
    assert ui.read_text(encoding="utf-8") == '{"state_text_px": 8, "board_id": "zybo", "hierarchy_root_id": "du_root"}\n'
    project = client.get("/api/project")
    assert "gtkwave_path" not in project.text


def test_launch_returns_without_waiting(monkeypatch, tmp_path: Path) -> None:
    seen: dict = {}

    class FakeProcess:
        pid = 42

        def wait(self, *_args, **_kwargs):
            seen["waited"] = True

    def popen(args, **kwargs):
        seen["args"] = args
        seen["kwargs"] = kwargs
        return FakeProcess()

    monkeypatch.setattr("app.hdl.gtkwave.subprocess.Popen", popen)
    pid = launch_viewer(sys.executable, ["waveform.ghw"], tmp_path)
    assert pid == 42
    assert "waited" not in seen
    assert seen["kwargs"]["shell"] is False
    if os.name == "nt":
        flags = seen["kwargs"]["creationflags"]
        assert flags & subprocess.DETACHED_PROCESS
        assert flags & subprocess.CREATE_NEW_PROCESS_GROUP


def test_a_detached_viewer_outlives_the_process_that_started_it(tmp_path: Path) -> None:
    if os.name != "nt":
        pytest.skip("This check uses the Windows detached process flags.")
    marker = tmp_path / "pid.txt"
    child = tmp_path / "child.py"
    child.write_text(
        "import os, time\n"
        "from pathlib import Path\n"
        f"Path(r'{marker}').write_text(str(os.getpid()))\n"
        "time.sleep(20)\n",
        encoding="utf-8",
    )
    parent = tmp_path / "parent.py"
    backend = Path(__file__).resolve().parents[1]
    parent.write_text(
        "import sys\n"
        "from pathlib import Path\n"
        f"sys.path.insert(0, r'{backend}')\n"
        "from app.hdl.gtkwave import launch_viewer\n"
        "launch_viewer(sys.executable, [sys.argv[1]], Path(sys.argv[1]).parent)\n",
        encoding="utf-8",
    )
    pid: int | None = None
    try:
        completed = subprocess.run([sys.executable, str(parent), str(child)], cwd=str(backend), timeout=15, check=False)
        assert completed.returncode == 0
        deadline = time.time() + 5
        while time.time() < deadline and not marker.is_file():
            time.sleep(0.05)
        assert marker.is_file()
        pid = int(marker.read_text(encoding="utf-8"))
        listed = subprocess.run(["tasklist", "/FI", f"PID eq {pid}"], capture_output=True, text=True, check=False)
        assert str(pid) in listed.stdout
    finally:
        if pid is not None:
            subprocess.run(["taskkill", "/PID", str(pid), "/F"], capture_output=True, check=False)


def test_vcd_names_that_are_absent_are_reported_and_not_filled_in(tmp_path: Path) -> None:
    waveform = tmp_path / "waveform.vcd"
    waveform.write_text(
        "$scope module gate_tb $end\n"
        "$var wire 1 ! a $end\n"
        "$scope module uut $end\n"
        "$var wire 1 \" y $end\n"
        "$upscope $end\n"
        "$upscope $end\n"
        "$enddefinitions $end\n",
        encoding="utf-8",
    )
    signal_map = [
        {"object_id": "po_y", "object_kind": "port", "vhdl_path": "/gate_tb/uut/y", "design_unit_id": "du_gate"},
        {"object_id": "po_missing", "object_kind": "port", "vhdl_path": "/gate_tb/uut/z", "design_unit_id": "du_gate"},
    ]
    diagnostics = diagnose_signal_map(waveform, signal_map)
    assert not any(item.code == "signal_not_in_waveform" and item.unit_id == "po_y" for item in diagnostics)
    missing = next(item for item in diagnostics if item.unit_id == "po_missing")
    assert missing.code == "signal_not_in_waveform"
    extra = [item for item in diagnostics if item.code == "unmapped_waveform_signal"]
    assert [item.path for item in extra] == ["gate_tb.a"]
    assert all(item.unit_id is None for item in extra)
    assert signal_map[0]["vhdl_path"] == "/gate_tb/uut/y"
    assert vcd_signal_names(tmp_path / "waveform.ghw") is None
    unchecked = diagnose_signal_map(tmp_path / "waveform.ghw", signal_map)
    assert unchecked[0].code == "waveform_names_unchecked"


def test_a_real_vcd_is_compared_with_the_prepared_map(workspace: Path) -> None:
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
            _unit(bench, "architecture", "sim", parent="gate_tb", instantiates=["gate"], unit_id="du_tb_arch", end_line=20),
        ],
    )
    files, signals, diagnostics = resolve_testbench(project, "du_tb")
    assert diagnostics == []
    before = [dict(item) for item in signals]
    report = execute_simulation(
        workspace / "simulations" / "vcd",
        files,
        "gate_tb",
        "93",
        "ieee",
        SimulationConfig(stop_time="100ns", waveform_format="vcd"),
        signals,
    )
    assert report["status"] == "passed", report["diagnostics"]
    assert report["signal_map"] == before
    names = vcd_signal_names(Path(report["waveform_path"]))
    assert names
    lowered = {name.lower() for name in names}
    mapped = next(item for item in report["signal_map"] if item["object_id"] == "po_y")
    if "gate_tb.uut.y" in lowered:
        assert not any(
            item["code"] == "signal_not_in_waveform" and item["unit_id"] == "po_y" for item in report["diagnostics"]
        )
    else:
        assert any(item["code"] == "signal_not_in_waveform" and item["unit_id"] == "po_y" for item in report["diagnostics"])
    for item in report["diagnostics"]:
        if item["code"] == "unmapped_waveform_signal":
            assert item["unit_id"] is None
    assert mapped["vhdl_path"] == "/gate_tb/uut/y"
    ghw = execute_simulation(
        workspace / "simulations" / "ghw",
        files,
        "gate_tb",
        "93",
        "ieee",
        SimulationConfig(stop_time="100ns", waveform_format="ghw"),
        signals,
    )
    assert ghw["status"] == "passed", ghw["diagnostics"]
    assert ghw["signal_map"] == before
    assert any(item["code"] == "waveform_names_unchecked" for item in ghw["diagnostics"])
    assert Path(ghw["waveform_path"]).stat().st_size > 0


def test_resolve_uses_a_configured_file_before_path(tmp_path: Path, monkeypatch) -> None:
    executable = tmp_path / "gtkwave.exe"
    executable.write_bytes(b"")
    monkeypatch.setattr("app.hdl.gtkwave.shutil.which", lambda _name: "from-path")
    found, problem = resolve_gtkwave(str(executable))
    assert found == str(executable)
    assert problem is None
    missing, problem = resolve_gtkwave(str(tmp_path / "missing.exe"))
    assert missing is None
    assert problem == "invalid_gtkwave_path"
    fallback, problem = resolve_gtkwave("")
    assert fallback == "from-path"
    assert problem is None


def _waveform(workspace: Path, run_id: str) -> Path:
    waveform = workspace / "simulations" / run_id / "waveform.ghw"
    waveform.parent.mkdir(parents=True)
    waveform.write_bytes(b"ghw")
    report = {
        "run_id": run_id,
        "status": "passed",
        "waveform_path": str(waveform),
        "directory": str(waveform.parent),
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    (waveform.parent / "report.json").write_text(json.dumps(report), encoding="utf-8")
    return waveform


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
