"""Placed states and transitions from HDL Designer .sm files."""

import hashlib
from pathlib import Path

from app.editing.convert import editable_from_import
from app.importers.hds.extract import extract_graphical
from app.models.editable import EditableDiagram
from app.paths import repo_root
from app.storage.diagram_store import load_editable, save_editable


LIBRARY = repo_root() / "libs" / "sbus_rtc_lib"


def _load(path: Path):
    text = path.read_text(encoding="utf-8", errors="replace")
    relative = path.relative_to(LIBRARY).as_posix()
    return extract_graphical(text, relative=relative, file_hash="b" * 64, library_id="lib_test")


def test_audio_fifo_ctrl_places_states_and_keeps_reset_geometry() -> None:
    path = LIBRARY / "hds" / "audio_fifo_ctrl" / "fsm.sm"
    if not path.is_file():
        return
    before = path.read_bytes()
    diagram = _load(path)
    assert path.read_bytes() == before
    assert diagram.record_counts["State"] == 7
    assert diagram.record_counts["Transition"] == 9
    assert len(diagram.states) == 5
    assert len(diagram.transitions) == 8
    reset = next(item for item in diagram.states if item.name == "s_reset")
    assert reset.x1 == 26306
    assert reset.y1 == 14437
    assert reset.x2 == 32306
    assert reset.y2 == 20437
    reset_arc = next(item for item in diagram.transitions if item.condition == "reset = '1'")
    assert reset_arc.end_state_id == reset.id
    assert reset_arc.start_state_id is None
    assert reset_arc.points[0].x == 5500
    assert any(item.start_state_id and item.end_state_id for item in diagram.transitions)
    assert all(item.hds_uid for item in diagram.states)
    assert any(item.code == "state_prototype_not_placed" for item in diagram.diagnostics)
    prototypes = [item for item in diagram.diagnostics if item.code == "state_prototype_not_placed"]
    assert len(diagram.states) == diagram.record_counts["State"] - len(prototypes)


def test_library_places_126_states_and_189_transitions() -> None:
    if not LIBRARY.is_dir():
        return
    files = sorted(LIBRARY.rglob("*.sm"))
    assert len(files) == 14
    hashes = {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in files}
    states = 0
    transitions = 0
    for path in files:
        diagram = _load(path)
        states += len(diagram.states)
        transitions += len(diagram.transitions)
        assert all(item.hds_uid for item in diagram.states)
        assert all(item.hds_uid for item in diagram.transitions)
    assert states == 126
    assert transitions == 189
    assert hashes == {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in files}


def test_state_copy_saves_under_the_workspace_and_keeps_the_source(tmp_path, monkeypatch) -> None:
    path = LIBRARY / "hds" / "audio_fifo_ctrl" / "fsm.sm"
    if not path.is_file():
        return
    before = hashlib.sha256(path.read_bytes()).hexdigest()
    monkeypatch.setenv("HDS_WORKSPACE", str(tmp_path / "ws"))
    diagram = _load(path)
    editable = editable_from_import(diagram, [])
    assert editable.kind == "state"
    assert editable.schema_version == 1
    assert len(editable.states) == 5
    assert len(editable.transitions) == 8
    assert editable.states[0].id.startswith("st_")
    saved = save_editable(editable)
    origin_x = saved.states[0].x
    saved.states[0].name = "s_reset_renamed"
    saved.states[0].x += 100
    save_editable(saved)
    reloaded = load_editable(saved.id)
    assert reloaded.kind == "state"
    assert reloaded.schema_version == 1
    assert reloaded.states[0].name == "s_reset_renamed"
    assert reloaded.states[0].x == origin_x + 100
    assert hashlib.sha256(path.read_bytes()).hexdigest() == before
    assert (tmp_path / "ws" / "diagrams" / f"{saved.id}.json").is_file()


def test_morse_transmitter_keeps_text_boxes_apart_from_the_words() -> None:
    path = LIBRARY / "hds" / "morse_transmitter" / "fsm.sm"
    if not path.is_file():
        return
    before = hashlib.sha256(path.read_bytes()).hexdigest()
    diagram = _load(path)
    fetch = next(state for state in diagram.states if state.name == "s_fetch")
    during = next(box for box in fetch.text_boxes if box.role == "during")
    assert fetch.during_actions is not None and "\n" not in fetch.during_actions
    assert 'cnt <= "100"' in fetch.during_actions
    assert abs(during.x2 - during.x1) == 15300
    assert abs(during.y2 - during.y1) == 1000
    code = next(state for state in diagram.states if state.name == "s_code0")
    assert code.during_actions is not None and "\n" in code.during_actions
    reset = next(state for state in diagram.states if state.name == "s_reset")
    assert reset.text_boxes == []
    coded = next(item for item in diagram.transitions if item.condition == "opcode = op_morsecode_c")
    condition = next(box for box in coded.text_boxes if box.role == "condition")
    actions = next(box for box in coded.text_boxes if box.role == "actions")
    assert abs(condition.x2 - condition.x1) == 10300
    assert coded.actions is not None and coded.actions.startswith("code_shr <= operand")
    assert abs(actions.x2 - actions.x1) == 13200
    assert any(item.code == "text_box_hidden" for item in diagram.diagnostics)
    editable = editable_from_import(diagram, [])
    copied = next(item for item in editable.transitions if item.condition == "opcode = op_morsecode_c")
    box = next(item for item in editable.text_boxes if item.owner_id == copied.id and item.role == "condition")
    box.x += 250
    box.width += 100
    assert copied.condition == "opcode = op_morsecode_c"
    assert hashlib.sha256(path.read_bytes()).hexdigest() == before


def test_block_document_without_state_fields_still_loads() -> None:
    loaded = EditableDiagram.model_validate(
        {
            "schema_version": 1,
            "id": "edg_" + "a" * 32,
            "name": "older",
            "frame": {"origin_x": 0, "origin_y": 0, "scale": 1},
            "provenance": {"library_id": "lib_test"},
            "instances": [],
            "nets": [],
            "wires": [],
        }
    )
    assert loaded.kind == "block"
    assert loaded.states == []
    assert loaded.transitions == []
    assert loaded.text_boxes == []
