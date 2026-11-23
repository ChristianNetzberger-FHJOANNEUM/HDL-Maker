"""Legacy GHDL profile and the first morse_transmitter comparison."""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.hdl.generate import generate_structural
from app.hdl.m3c import LIBRARY, check_machine, compare_morse_transmitter, compile_reference_machines
from app.importers.hds.extract import extract_graphical
from app.editing.convert import editable_from_import
from app.main import app

client = TestClient(app)
SOURCES = (
    LIBRARY / "hdl" / "utilities_pkg.vhd",
    LIBRARY / "hdl" / "utilities_pkg_body.vhd",
    LIBRARY / "hdl" / "morse_transmitter_fsm.vhd",
    LIBRARY / "hdl" / "audio_fifo_ctrl_fsm.vhd",
    LIBRARY / "hdl" / "speed_trap_fsm.vhd",
)


@pytest.fixture(autouse=True)
def workspace(tmp_path, monkeypatch) -> Path:
    root = tmp_path / "ws"
    root.mkdir()
    monkeypatch.setenv("HDS_WORKSPACE", str(root))
    return root


def test_library_profile_is_stored_on_the_project_not_the_ui(workspace: Path) -> None:
    ui = workspace / "ui.json"
    ui.write_text('{"state_text_px": 8, "board_id": "zybo", "hierarchy_root_id": "du_root"}\n', encoding="utf-8")
    saved = client.put("/api/project/library-profile", json={"library_profile": "synopsys"})
    assert saved.status_code == 200
    body = saved.json()
    assert body["library_profile"] == "synopsys"
    assert body["vhdl_standard"] == "93"
    assert client.get("/api/project").json()["library_profile"] == "synopsys"
    assert ui.read_text(encoding="utf-8") == '{"state_text_px": 8, "board_id": "zybo", "hierarchy_root_id": "du_root"}\n'
    rejected = client.put("/api/project/library-profile", json={"library_profile": "mentor"})
    assert rejected.status_code == 422


def test_synopsys_profile_changes_the_command_and_not_the_vhdl(monkeypatch) -> None:
    calls: list[list[str]] = []

    def fake_which(name: str) -> str | None:
        return "ghdl" if name == "ghdl" else None

    def fake_run(args, **_kwargs):
        calls.append(list(args))

        class Completed:
            returncode = 0
            stderr = ""
            stdout = ""

        return Completed()

    monkeypatch.setattr("app.hdl.generate.shutil.which", fake_which)
    monkeypatch.setattr("app.hdl.generate.subprocess.run", fake_run)
    design = _imported("morse_transmitter")
    ieee = generate_structural(design, "2008", _only(design), "ieee")
    ieee_calls = list(calls)
    calls.clear()
    synopsys = generate_structural(design, "2008", _only(design), "synopsys")
    assert ieee.files[0].text == synopsys.files[0].text
    assert "use ieee.std_logic_arith.all;" in synopsys.files[0].text
    assert "numeric_std" not in synopsys.files[0].text
    assert synopsys.library_profile == "synopsys"
    assert all("-fsynopsys" not in " ".join(call) and "-fexplicit" not in " ".join(call) for call in ieee_calls)
    assert all(call[2] == "--std=08" and "-fsynopsys" in call and "-fexplicit" in call for call in calls)
    assert [call[1] for call in calls] == ["-a", "-e"]


def test_a_missing_library_file_is_reported_before_ghdl(tmp_path: Path) -> None:
    result = check_machine("morse_transmitter", "93", "synopsys", "original", library=tmp_path / "empty")
    assert result["vhdl_generated"] == "not_run"
    assert result["ghdl_analysis"] == "not_run"
    assert result["ghdl_elaboration"] == "not_run"
    assert result["simulation"] == "not_run"
    assert result["functional_comparison"] == "not_run"
    assert any(item["code"] == "missing_dependency" for item in result["diagnostics"])


def test_the_ieee_profile_still_rejects_the_synopsys_packages() -> None:
    before = _source_bytes()
    result = check_machine("morse_transmitter", "93", "ieee", "generated")
    assert _source_bytes() == before
    assert result["vhdl_generated"] == "passed"
    assert result["ghdl_analysis"] == "failed"
    assert result["ghdl_elaboration"] == "not_run"
    assert result["simulation"] == "not_run"
    assert any("std_logic_arith" in item["message"] for item in result["diagnostics"])


@pytest.mark.parametrize("standard", ["93", "2008"])
def test_reference_machines_analyze_and_elaborate(standard: str) -> None:
    assert shutil.which("ghdl") is not None
    before = _source_bytes()
    results = compile_reference_machines(standard, "synopsys")
    assert _source_bytes() == before
    assert len(results) == 6
    for result in results:
        assert result["ghdl_analysis"] == "passed", result["diagnostics"]
        assert result["ghdl_elaboration"] == "passed", result["diagnostics"]
        assert result["simulation"] == "not_run"
        assert result["functional_comparison"] == "not_run"
        assert result["compiler_options"] == ["--std=93" if standard == "93" else "--std=08", "-fsynopsys", "-fexplicit"]
        if result["source"] == "generated":
            assert result["vhdl_generated"] == "passed"


def test_morse_transmitter_matches_the_original_on_the_same_stimulus() -> None:
    assert shutil.which("ghdl") is not None
    before = _source_bytes()
    result = compare_morse_transmitter("93", "synopsys")
    assert _source_bytes() == before
    assert result["vhdl_generated"] == "passed"
    assert result["ghdl_analysis"] == "passed"
    assert result["ghdl_elaboration"] == "passed"
    assert result["simulation"] == "passed"
    assert result["functional_comparison"] == "passed", result
    assert result["differences"] == []
    assert result["landmarks"] == []
    assert result["cycles"] == 19_300_012
    assert result["observed"]["fifo_rd_pulses"] >= 4
    assert len(result["observed"]["morse_code_low_runs"]) >= 2


def _source_bytes() -> dict[str, bytes]:
    return {str(path): path.read_bytes() for path in SOURCES}


def _imported(name: str):
    path = LIBRARY / "hds" / name / "fsm.sm"
    diagram = extract_graphical(
        path.read_text(encoding="utf-8", errors="replace"),
        relative=path.relative_to(LIBRARY).as_posix(),
        file_hash="c" * 64,
        library_id="lib_test",
    )
    return editable_from_import(diagram, [])


def _only(diagram):
    def load(diagram_id: str):
        if diagram_id != diagram.id:
            raise AssertionError(diagram_id)
        return diagram

    return load
