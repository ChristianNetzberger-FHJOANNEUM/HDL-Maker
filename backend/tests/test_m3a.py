"""Structural VHDL-93 and VHDL-2008 generation."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.editing.create import add_generic, add_instance, add_interface_port, new_diagram
from app.editing.nets import connect_ports
from app.hdl.generate import generate_structural
from app.identity import new_id
from app.main import app
from app.models.design import DiagramGeneric, Point
from app.models.editable import EditableBlock, EditableDiagram, EditablePort
from app.paths import repo_root
from app.storage.diagram_store import DiagramStoreError, load_editable, save_editable

client = TestClient(app)


@pytest.fixture(autouse=True)
def workspace(tmp_path, monkeypatch) -> Path:
    root = tmp_path / "ws"
    root.mkdir()
    monkeypatch.setenv("HDS_WORKSPACE", str(root))
    return root


def test_project_without_a_standard_loads_as_vhdl_93() -> None:
    from app.models.design import ProjectFile

    loaded = ProjectFile.model_validate(
        {
            "schema_version": 2,
            "project_id": "proj_old",
            "name": "local",
            "libraries": [],
            "design_units": [],
            "diagrams": [],
        }
    )
    assert loaded.vhdl_standard == "93"
    assert loaded.library_profile == "ieee"


def test_vhdl_standard_is_stored_on_the_project_not_the_ui(workspace: Path) -> None:
    ui = workspace / "ui.json"
    ui.write_text('{"state_text_px": 8, "board_id": "zybo", "hierarchy_root_id": "du_root"}\n', encoding="utf-8")
    saved = client.put("/api/project/vhdl-standard", json={"vhdl_standard": "2008"})
    assert saved.status_code == 200
    assert saved.json()["vhdl_standard"] == "2008"
    assert client.get("/api/project").json()["vhdl_standard"] == "2008"
    assert ui.read_text(encoding="utf-8") == '{"state_text_px": 8, "board_id": "zybo", "hierarchy_root_id": "du_root"}\n'
    rejected = client.put("/api/project/vhdl-standard", json={"vhdl_standard": "87"})
    assert rejected.status_code == 422
    assert client.get("/api/project").json()["vhdl_standard"] == "2008"


def test_reference_hierarchy_matches_in_both_standards(workspace: Path) -> None:
    top, load = _reference()
    first = generate_structural(top, "93", load)
    moved = _shift(top)
    second = generate_structural(moved, "93", load)
    later = generate_structural(moved, "2008", load)
    assert not any(item.severity == "error" for item in first.diagnostics)
    assert [item.entity_name for item in first.files] == ["stage_a", "stage_b", "top_chain"]
    assert _bodies(first) == _bodies(second) == _bodies(later)
    assert all(item.text.splitlines()[1] == "-- vhdl_standard: 93" for item in first.files)
    assert all(item.text.splitlines()[1] == "-- vhdl_standard: 2008" for item in later.files)
    top_text = first.files[2].text
    assert "signal mid : std_logic;" in top_text
    assert "WIDTH => WIDTH" in top_text
    assert "nibble => data(3 downto 0)" in top_text
    assert top_text.count("clk => clk") == 2
    assert "entity work.stage_a(rtl)" in top_text
    assert "entity work.stage_b(rtl)" in top_text
    assert "n_1" not in top_text
    assert "28000" not in top_text
    assert "process(all)" not in top_text.lower().replace(" ", "")
    assert "??" not in top_text
    assert ": type" not in top_text
    manifest = json.loads((workspace / "generated" / "vhdl-2008" / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["vhdl_standard"] == "2008"
    assert manifest["files"][2]["relative_path"] == "top_chain.vhd"
    assert _ghdl_matches_installation(first.ghdl)
    assert _ghdl_matches_installation(later.ghdl)
    assert first.ghdl_analysis == first.ghdl
    assert first.ghdl_elaboration == first.ghdl
    assert "nibble : in std_logic_vector(3 downto 0);" in first.files[0].text
    assert "WIDTH : integer := 8" in first.files[0].text
    assert "(7 downto 0)" not in first.files[0].text


def test_geometry_and_ui_settings_do_not_change_vhdl_or_sources(workspace: Path) -> None:
    top, load = _reference()
    for diagram in load.diagrams:
        save_editable(diagram)
    before = {path: path.read_bytes() for path in (workspace / "diagrams").glob("*.json")}
    ui = workspace / "ui.json"
    ui.write_text('{"state_text_px": 8}\n', encoding="utf-8")
    narrow = generate_structural(top, "93", load)
    ui.write_text('{"state_text_px": 16, "board_id": "other"}\n', encoding="utf-8")
    wide = generate_structural(_shift(top), "93", load)
    assert _bodies(narrow) == _bodies(wide)
    assert ui.read_text(encoding="utf-8") == '{"state_text_px": 16, "board_id": "other"}\n'
    assert {path: path.read_bytes() for path in (workspace / "diagrams").glob("*.json")} == before
    samples = sorted((repo_root() / "libs").rglob("*.sm"))
    assert samples
    sample = samples[0]
    original = sample.read_bytes()
    generate_structural(top, "2008", load)
    assert sample.read_bytes() == original
    assert "libs" not in Path(narrow.output_dir).parts


def test_generate_endpoint_uses_the_project_standard_and_leaves_the_diagram(workspace: Path) -> None:
    top, load = _reference()
    for diagram in load.diagrams:
        save_editable(diagram)
    stored = (workspace / "diagrams" / f"{top.id}.json").read_bytes()
    client.put("/api/project/vhdl-standard", json={"vhdl_standard": "93"})
    generated = client.post("/api/generate", json={"root_diagram_id": top.id})
    assert generated.status_code == 200, generated.text
    body = generated.json()
    assert body["vhdl_standard"] == "93"
    assert body["files"][2]["text"].splitlines()[1] == "-- vhdl_standard: 93"
    assert (workspace / "diagrams" / f"{top.id}.json").read_bytes() == stored
    assert load_editable(top.id).entity_name == "top_chain"


def test_unknown_type_and_width_are_not_invented(workspace: Path) -> None:
    missing = new_diagram("mystery", "lib_test")
    add_interface_port(missing, "anon", "in", None)
    failed = generate_structural(missing, "93", _only(missing))
    assert any(item.code == "port_type_missing" for item in failed.diagnostics)
    assert failed.files == []
    assert not (workspace / "generated" / "vhdl-93").exists()

    wide = new_diagram("wide_bus", "lib_test")
    add_interface_port(wide, "samples", "in", "std_logic_vector", None)
    generated = generate_structural(wide, "93", _only(wide))
    text = generated.files[0].text
    assert "samples : in std_logic_vector" in text
    assert "downto" not in text
    assert "to 0" not in text
    if shutil.which("ghdl") is None:
        assert generated.ghdl == "not_run"
        assert not any(item.severity == "error" for item in generated.diagnostics)
    else:
        assert generated.ghdl_analysis == "passed"
        assert generated.ghdl_elaboration == "failed"
        assert any("unconstrained" in item.message for item in generated.diagnostics)


def test_vhdl93_rejects_process_all_without_rewriting_it(workspace: Path) -> None:
    design, source = _process_all()
    failed = generate_structural(design, "93", _only(design))
    assert any(item.code == "vhdl93_unsupported" and "process(all)" in item.message for item in failed.diagnostics)
    assert failed.files == []
    assert list((workspace / "generated").glob("vhdl-93/*.vhd")) == []
    generated = generate_structural(design, "2008", _only(design))
    assert not any(item.severity == "error" for item in generated.diagnostics)
    assert source in generated.files[0].text
    assert _ghdl_matches_installation(generated.ghdl)


def test_vhdl2008_does_not_emit_an_unimplemented_construct() -> None:
    design = new_diagram("marker", "lib_test")
    add_interface_port(design, "d", "in", "std_logic")
    add_interface_port(design, "q", "out", "std_logic")
    design.embedded_blocks.append(_block("q <= d ?? '1';"))
    failed = generate_structural(design, "2008", _only(design))
    assert any(item.code == "construct_not_implemented" for item in failed.diagnostics)
    assert failed.files == []
    older = generate_structural(design, "93", _only(design))
    assert any(item.code == "vhdl93_unsupported" for item in older.diagnostics)


def test_type_generic_is_rejected_for_vhdl93_and_emitted_for_vhdl2008() -> None:
    design = new_diagram("typed", "lib_test")
    add_generic(design, "DATA_T", "type", None)
    rejected = generate_structural(design, "93", _only(design))
    assert any(item.code == "vhdl93_unsupported" for item in rejected.diagnostics)
    assert rejected.files == []
    generated = generate_structural(design, "2008", _only(design))
    assert "DATA_T : type" in generated.files[0].text


def test_unresolved_embedded_text_stops_the_design() -> None:
    design = new_diagram("vendor", "lib_test")
    add_interface_port(design, "clk", "in", "std_logic")
    design.embedded_blocks.append(_block("hello vendor flow"))
    failed = generate_structural(design, "93", _only(design))
    assert any(item.code == "embedded_context_unresolved" for item in failed.diagnostics)
    assert failed.files == []
    assert "hello vendor flow" not in "\n".join(item.text for item in failed.files)


def test_missing_stale_and_recursive_children_are_reported() -> None:
    child = new_diagram("stage_a", "lib_test")
    add_interface_port(child, "clk", "in", "std_logic")
    parent = new_diagram("board", "lib_test")
    add_instance(
        parent,
        component_name="stage_a",
        component_library=None,
        design_unit_id=None,
        child_diagram_id=child.id,
        ports=[_port("clock", "in", "std_logic", None)],
        generics=[],
    )
    stale = generate_structural(parent, "93", _store(child, parent))
    assert any(item.code == "stale_child_interface" for item in stale.diagnostics)
    assert stale.files == []

    missing = new_diagram("board", "lib_test")
    add_instance(
        missing,
        component_name="absent",
        component_library=None,
        design_unit_id=None,
        child_diagram_id=new_id("edg"),
        ports=[],
        generics=[],
    )
    lost = generate_structural(missing, "93", _only(missing))
    assert any(item.code == "missing_child" for item in lost.diagnostics)
    assert lost.files == []
    assert lost.ghdl == "not_run"
    assert lost.ghdl_analysis == "not_run"
    assert lost.ghdl_elaboration == "not_run"

    left = new_diagram("loop_a", "lib_test")
    right = new_diagram("loop_b", "lib_test")
    add_instance(left, component_name="loop_b", component_library=None, design_unit_id=None, child_diagram_id=right.id, ports=[], generics=[])
    add_instance(right, component_name="loop_a", component_library=None, design_unit_id=None, child_diagram_id=left.id, ports=[], generics=[])
    cycle = generate_structural(left, "93", _store(left, right))
    assert any(item.code == "recursive_hierarchy" for item in cycle.diagnostics)
    assert cycle.files == []


def test_a_width_mismatch_fails_analysis_without_a_rewritten_slice() -> None:
    child = new_diagram("narrow", "lib_test")
    add_interface_port(child, "nibble", "in", "std_logic_vector", "(3 downto 0)")
    add_interface_port(child, "y", "out", "std_logic")
    parent = new_diagram("wide_top", "lib_test")
    data = add_interface_port(parent, "data", "in", "std_logic_vector", "(7 downto 0)")
    result_port = add_interface_port(parent, "q", "out", "std_logic")
    instance = add_instance(
        parent,
        component_name="narrow",
        component_library=None,
        design_unit_id=None,
        child_diagram_id=child.id,
        ports=_copied(child),
        generics=[],
    )
    connect_ports(parent, _pin(data), _port_pin(instance, "nibble"))
    connect_ports(parent, _port_pin(instance, "y"), _pin(result_port))
    generated = generate_structural(parent, "93", _store(child, parent))
    top_text = next(item.text for item in generated.files if item.entity_name == "wide_top")
    assert "nibble => data" in top_text
    assert "data(3 downto 0)" not in top_text
    if shutil.which("ghdl") is None:
        assert generated.ghdl == "not_run"
        return
    assert generated.files
    assert generated.ghdl_analysis == "failed"
    assert generated.ghdl_elaboration == "not_run"
    message = "\n".join(item.message for item in generated.diagnostics)
    assert "wide_top.vhd:" in message
    assert "actual constraints don't match formal ones" in message
    assert "nibble => data" in message


def test_an_external_library_binding_elaborates_after_that_library_is_analyzed(workspace: Path) -> None:
    parent = new_diagram("board", "lib_test")
    clock = add_interface_port(parent, "clk", "in", "std_logic")
    result_port = add_interface_port(parent, "q", "out", "std_logic")
    instance = add_instance(
        parent,
        component_name="leaf",
        component_library="extras",
        design_unit_id=None,
        child_diagram_id=None,
        ports=[_port("clk", "in", "std_logic", None), _port("q", "out", "std_logic", None)],
        generics=[],
    )
    connect_ports(parent, _pin(clock), _port_pin(instance, "clk"))
    connect_ports(parent, _port_pin(instance, "q"), _pin(result_port))
    generated = generate_structural(parent, "93", _only(parent))
    text = generated.files[0].text
    assert "library extras;" in text
    assert "entity extras.leaf" in text
    assert any(item.code == "external_unit_not_generated" for item in generated.diagnostics)
    if shutil.which("ghdl") is None:
        assert generated.ghdl == "not_run"
        return
    assert generated.ghdl == "failed"
    message = "\n".join(item.message for item in generated.diagnostics)
    assert "board.vhd:" in message or "leaf" in message
    work = workspace / "external-ghdl"
    extras = work / "extras"
    unit = work / "work"
    extras.mkdir(parents=True)
    unit.mkdir()
    leaf = extras / "leaf.vhd"
    leaf.write_text(
        "\n".join(
            [
                "library ieee;",
                "use ieee.std_logic_1164.all;",
                "entity leaf is",
                "  port (",
                "    clk : in std_logic;",
                "    q : out std_logic",
                "  );",
                "end entity leaf;",
                "architecture rtl of leaf is",
                "begin",
                "end architecture rtl;",
                "",
            ]
        ),
        encoding="utf-8",
        newline="\n",
    )
    (unit / "board.vhd").write_text(text, encoding="utf-8", newline="\n")
    ghdl = shutil.which("ghdl")
    assert ghdl is not None
    for args in (
        ["-a", "--std=93", "--work=extras", f"--workdir={extras}", str(leaf)],
        ["-a", "--std=93", f"--workdir={unit}", f"-P{extras}", str(unit / "board.vhd")],
        ["-e", "--std=93", f"--workdir={unit}", f"-P{extras}", "board"],
    ):
        completed = subprocess.run([ghdl, *args], cwd=work, capture_output=True, text=True, timeout=60, check=False)
        assert completed.returncode == 0, completed.stderr or completed.stdout


def test_a_state_diagram_without_a_machine_is_not_generated() -> None:
    design = new_diagram("machine", "lib_test")
    design.kind = "state"
    failed = generate_structural(design, "93", _only(design))
    assert any(item.code == "fsm_clock_missing" for item in failed.diagnostics)
    assert failed.files == []
    assert failed.ghdl == "not_run"


def test_ghdl_is_invoked_with_one_standard_and_no_relaxed_mode(monkeypatch) -> None:
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
    top, load = _reference()
    result = generate_structural(top, "93", load)
    assert result.ghdl == "passed"
    assert result.ghdl_analysis == "passed"
    assert result.ghdl_elaboration == "passed"
    assert [call[1] for call in calls] == ["-a", "-a", "-a", "-e"]
    assert [call[4] for call in calls] == ["stage_a.vhd", "stage_b.vhd", "top_chain.vhd", "top_chain"]
    assert all(call[2] == "--std=93" for call in calls)
    assert len({call[3] for call in calls}) == 1
    assert calls[0][3].startswith("--workdir=")
    rendered = " ".join(" ".join(call) for call in calls)
    assert "--std=08" not in rendered
    assert "93c" not in rendered
    assert "relaxed" not in rendered
    assert "-fsynopsys" not in rendered
    assert "-fexplicit" not in rendered


def _reference() -> tuple[EditableDiagram, _Memory]:
    stage_a = new_diagram("stage_a", "lib_test")
    add_generic(stage_a, "WIDTH", "integer", "8")
    add_interface_port(stage_a, "clk", "in", "std_logic")
    add_interface_port(stage_a, "nibble", "in", "std_logic_vector", "(3 downto 0)")
    add_interface_port(stage_a, "y", "out", "std_logic")
    stage_b = new_diagram("stage_b", "lib_test")
    add_interface_port(stage_b, "clk", "in", "std_logic")
    add_interface_port(stage_b, "d", "in", "std_logic")
    add_interface_port(stage_b, "q", "out", "std_logic")
    top = new_diagram("top_chain", "lib_test")
    add_generic(top, "WIDTH", "integer", "8")
    clock = add_interface_port(top, "clk", "in", "std_logic")
    data = add_interface_port(top, "data", "in", "std_logic_vector", "(7 downto 0)")
    result = add_interface_port(top, "q", "out", "std_logic")
    front = add_instance(
        top,
        component_name="stage_a",
        component_library=None,
        design_unit_id=None,
        child_diagram_id=stage_a.id,
        ports=_copied(stage_a),
        generics=[DiagramGeneric(name="WIDTH", type_text="integer", value="WIDTH")],
    )
    back = add_instance(
        top,
        component_name="stage_b",
        component_library=None,
        design_unit_id=None,
        child_diagram_id=stage_b.id,
        ports=_copied(stage_b),
        generics=[],
    )
    connect_ports(top, _pin(clock), _port_pin(front, "clk"))
    connect_ports(top, _pin(clock), _port_pin(back, "clk"))
    connect_ports(top, _pin(data), _port_pin(front, "nibble"), "(3 downto 0)")
    connect_ports(top, _port_pin(front, "y"), _port_pin(back, "d"))
    connect_ports(top, _port_pin(back, "q"), _pin(result))
    y_port = next(item for item in front.ports if item.name == "y")
    next(net for net in top.nets if any(item.port_id == y_port.id for item in net.endpoints)).name = "mid"
    return top, _store(stage_a, stage_b, top)


def _process_all() -> tuple[EditableDiagram, str]:
    design = new_diagram("latch", "lib_test")
    add_interface_port(design, "d", "in", "std_logic")
    add_interface_port(design, "q", "out", "std_logic")
    source = "process(all)\nbegin\n  q <= d;\nend process;"
    design.embedded_blocks.append(_block(source))
    return design, source


def _shift(diagram: EditableDiagram) -> EditableDiagram:
    moved = diagram.model_copy(deep=True)
    moved.frame.scale = 1
    for instance in moved.instances:
        instance.x += 4000
    for wire in moved.wires:
        wire.points = [Point(x=3, y=9), Point(x=8, y=1)]
    return moved


def _bodies(result) -> list[str]:
    return ["\n".join(line for line in item.text.splitlines() if not line.startswith("-- vhdl_standard:")) for item in result.files]


def _ghdl_matches_installation(status: str) -> bool:
    if shutil.which("ghdl") is None:
        return status == "not_run"
    return status == "passed"


def _copied(diagram: EditableDiagram) -> list[EditablePort]:
    return [_port(item.name, item.direction, item.type_text, item.range_text) for item in diagram.diagram_ports]


def _port(name: str, direction, type_text, range_text) -> EditablePort:
    return EditablePort(
        id=new_id("dport"),
        name=name,
        direction=direction,
        type_text=type_text,
        range_text=range_text,
        width=None,
        width_status="unresolved",
    )


def _block(text: str) -> EditableBlock:
    return EditableBlock(id=new_id("blk"), name="logic", text=text, x=0, y=0, width=1000, height=1000)


def _pin(port) -> tuple[str, str, str]:
    return ("diagram_port", port.id, port.id)


def _port_pin(instance, name: str) -> tuple[str, str, str]:
    port = next(item for item in instance.ports if item.name == name)
    return ("instance", instance.id, port.id)


class _Memory:
    def __init__(self, diagrams: dict[str, EditableDiagram]) -> None:
        self.diagrams = list(diagrams.values())
        self._diagrams = diagrams

    def __call__(self, diagram_id: str) -> EditableDiagram:
        try:
            return self._diagrams[diagram_id]
        except KeyError as exc:
            raise DiagramStoreError("diagram_not_found", diagram_id) from exc


def _store(*diagrams: EditableDiagram) -> _Memory:
    return _Memory({item.id: item for item in diagrams})


def _only(diagram: EditableDiagram) -> _Memory:
    return _store(diagram)
