"""FSM VHDL from imported state diagrams and one self-contained machine."""

from __future__ import annotations

import shutil

from app.editing.convert import editable_from_import
from app.editing.create import new_diagram
from app.hdl.generate import generate_structural
from app.identity import new_id
from app.importers.hds.extract import extract_graphical
from app.models.design import FsmMachine, FsmPackage, FsmSignal
from app.models.editable import EditableState, EditableTextBox, EditableTransition
from app.paths import repo_root

LIBRARY = repo_root() / "libs" / "sbus_rtc_lib"


def _only(diagram):
    def load(diagram_id: str):
        if diagram_id != diagram.id:
            raise AssertionError(diagram_id)
        return diagram

    return load


def _imported(name: str):
    path = LIBRARY / "hds" / name / "fsm.sm"
    text = path.read_text(encoding="utf-8", errors="replace")
    relative = path.relative_to(LIBRARY).as_posix()
    diagram = extract_graphical(text, relative=relative, file_hash="c" * 64, library_id="lib_test")
    return editable_from_import(diagram, [])


def test_morse_transmitter_keeps_transitions_reset_and_actions() -> None:
    design = _imported("morse_transmitter")
    moved = design.model_copy(deep=True)
    moved.states[0].x += 400
    moved.transitions[0].points[0].x += 250
    if moved.text_boxes:
        moved.text_boxes[0].x += 80
    first = generate_structural(design, "93", _only(design))
    second = generate_structural(moved, "93", _only(moved))
    assert first.files and second.files
    assert first.files[0].text == second.files[0].text
    text = first.files[0].text
    assert "type state_type is (" in text
    assert "signal current_state : state_type;" in text
    assert "if (clk'event and clk = '1') then" in text
    assert "if (reset = '1') then" in text
    assert "current_state <= s_reset;" in text
    assert "fifo_rd_cld <= '0';" in text
    assert "morse_fcw_cld <= conv_std_logic_vector(2400,27);" in text
    assert "nibble" not in text
    fetch = text.split("when s_fetch =>", 1)[1].split("when s_", 1)[0]
    assert fetch.index("opcode = op_speed_c") < fetch.index("opcode = op_fcw_c")
    assert fetch.index("opcode = op_fcw_c") < fetch.index("opcode = op_break_c")
    assert fetch.index("opcode = op_break_c") < fetch.index("opcode = op_morsecode_c")
    assert "code_shr <= operand(15 downto 0);" in text
    assert "cnt <= \"100\";" in text
    assert "next_state <= s_reset;" in text
    assert "constant op_speed_c" in text
    assert "morse_code <= not morse_code_tmp;" in text
    assert "library ieee;" in text
    assert "use ieee.std_logic_arith.all;" in text
    later = generate_structural(design, "2008", _only(design))
    assert later.files[0].text != text
    assert "vhdl_standard: 2008" in later.files[0].text
    assert "when s_fetch =>" in later.files[0].text
    if shutil.which("ghdl") is None:
        assert first.ghdl == "not_run"
        return
    assert first.ghdl_analysis == "failed"
    assert first.ghdl_elaboration == "not_run"
    message = "\n".join(item.message for item in first.diagnostics)
    assert "morse_transmitter.vhd:" in message
    assert "std_logic_arith" in message
    assert "synopsys" in message


def test_audio_fifo_ctrl_keeps_enable_interrupt_and_output_defaults() -> None:
    design = _imported("audio_fifo_ctrl")
    generated = generate_structural(design, "93", _only(design))
    text = generated.files[0].text
    assert "generic (" in text
    assert "awidth_g : integer := 10" in text
    assert "elsif (sample_en = '1') then" in text
    assert "if (fifo2_reset = '1') then" in text
    assert "next_state <= s_reset;" in text
    assert "fifo2_rd_tx <= '0';" in text
    assert "fifo2_we_rx <= '0';" in text
    assert "cnt <= cnt + 1;" in text
    assert "fifo2_rd_tx <= sample_en;" in text
    clocked = text.split("clocked_proc", 1)[1].split("nextstate_proc", 1)[0]
    output = text.split("output_proc", 1)[1]
    assert "fifo2_rd_tx <= sample_en;" not in clocked
    assert "cnt <= cnt + 1;" not in output
    sensitivity = output.split(")", 1)[0]
    assert "fifo2_rd_tx" not in sensitivity
    assert "fifo2_we_rx" not in sensitivity
    assert "sample_en" in sensitivity
    assert "fifo2_reset" in sensitivity


def test_speed_trap_splits_clocked_and_combinational_actions() -> None:
    design = _imported("speed_trap")
    generated = generate_structural(design, "93", _only(design))
    assert generated.files, [item.message for item in generated.diagnostics]
    text = generated.files[0].text
    assert "if (speed_trap_en = '0') then" in text
    assert "next_state <= s_wait;" in text
    assert "timer_reset <= '0';" in text
    assert "timer_reset <= '1';" in text
    assert "data_rdy <= data_rdy_cld;" in text
    output = text.split("output_proc", 1)[1].split("end process output_proc", 1)[0]
    assert "us_cnt <=" not in output
    assert "timer_reset" not in output.split(")", 1)[0]
    assert "speed_trap_en" in output.split(")", 1)[0]
    assert "data <= phase & timer;" in text


def test_a_self_contained_machine_analyzes_and_elaborates_in_both_standards() -> None:
    design = _toggle()
    for standard in ("93", "2008"):
        generated = generate_structural(design, standard, _only(design))
        assert generated.files, [item.message for item in generated.diagnostics]
        text = generated.files[0].text
        assert "use ieee.std_logic_arith" not in text
        assert "if (go = '1') then" in text
        assert "next_state <= busy;" in text
        assert "next_state <= idle;" in text
        assert "flag_cld <= '1';" in text
        if shutil.which("ghdl") is None:
            assert generated.ghdl == "not_run"
            continue
        assert generated.ghdl_analysis == "passed", generated.diagnostics
        assert generated.ghdl_elaboration == "passed", generated.diagnostics
        assert generated.ghdl == "passed"


def test_equal_priorities_and_missing_clock_do_not_generate() -> None:
    design = _toggle()
    idle = next(state for state in design.states if state.name == "idle")
    extra = EditableTransition(
        id=new_id("trn"),
        start_state_id=idle.id,
        end_state_id=idle.id,
        start_kind="state",
        end_kind="state",
        condition="go = '0'",
        priority="1",
        points=[],
    )
    for item in design.transitions:
        if item.start_state_id == idle.id and item.condition:
            item.priority = "1"
    design.transitions.append(extra)
    failed = generate_structural(design, "93", _only(design))
    assert any(item.code == "fsm_priority_conflict" for item in failed.diagnostics)
    assert failed.files == []
    assert failed.ghdl_analysis == "not_run"
    bare = new_diagram("bare", "lib_test")
    bare.kind = "state"
    bare.state_signal_name = "current_state"
    missing = generate_structural(bare, "93", _only(bare))
    assert any(item.code == "fsm_clock_missing" for item in missing.diagnostics)
    assert missing.files == []


def test_entry_actions_and_unknown_targets_stop_the_machine() -> None:
    design = _toggle()
    design.states[0].entry_actions = "flag_cld <= '0';"
    failed = generate_structural(design, "93", _only(design))
    assert any(item.code == "fsm_entry_exit_unsupported" for item in failed.diagnostics)
    assert failed.files == []
    design = _toggle()
    busy = next(state for state in design.states if state.name == "busy")
    for item in design.transitions:
        if item.start_state_id == busy.id:
            item.actions = "mystery <= '1';"
    failed = generate_structural(design, "93", _only(design))
    assert any(item.code == "fsm_action_target_unknown" for item in failed.diagnostics)
    assert failed.files == []


def test_moving_a_text_box_does_not_change_the_clean_machine() -> None:
    design = _toggle()
    design.text_boxes.append(
        EditableTextBox(id=new_id("tbx"), owner_id=design.states[0].id, role="during", x=1, y=2, width=3, height=4)
    )
    moved = design.model_copy(deep=True)
    moved.text_boxes[0].x += 20
    moved.states[0].y += 15
    assert generate_structural(design, "93", _only(design)).files[0].text == generate_structural(moved, "93", _only(moved)).files[0].text


def _toggle():
    idle = EditableState(id=new_id("st"), name="idle", hds_object=1, x=0, y=0, width=10, height=10)
    busy = EditableState(
        id=new_id("st"),
        name="busy",
        hds_object=2,
        x=30,
        y=0,
        width=10,
        height=10,
        during_actions="flag_cld <= '1';",
    )
    design = new_diagram("toggle", "lib_test")
    design.kind = "state"
    design.architecture_name = "fsm"
    design.state_signal_name = "current_state"
    design.states = [idle, busy]
    design.transitions = [
        EditableTransition(
            id=new_id("trn"),
            start_kind="reset",
            end_kind="state",
            end_state_id=idle.id,
            condition="reset = '1'",
            actions="< Automatic >",
            points=[],
        ),
        EditableTransition(
            id=new_id("trn"),
            start_kind="recovery",
            end_kind="state",
            end_state_id=idle.id,
            points=[],
        ),
        EditableTransition(
            id=new_id("trn"),
            start_state_id=idle.id,
            end_state_id=busy.id,
            start_kind="state",
            end_kind="state",
            condition="go = '1'",
            priority="1",
            actions="flag_cld <= '1';",
            points=[],
        ),
        EditableTransition(
            id=new_id("trn"),
            start_state_id=busy.id,
            end_state_id=idle.id,
            start_kind="state",
            end_kind="state",
            points=[],
        ),
    ]
    design.fsm = FsmMachine(
        encoding_scheme=3,
        next_state_clocking=0,
        reset_mode=0,
        controls_agree=True,
        clock_suffix="_cld",
        state_order=[1, 2],
        packages=[FsmPackage(library_name="ieee", unit_name="std_logic_1164")],
        generics=[],
        signals=[
            FsmSignal(name="clk", type_text="std_logic", mode="in", role="clock", expression="clk'event and clk = '1'", order=1),
            FsmSignal(name="reset", type_text="std_logic", mode="in", role="reset", expression="reset = '1'", order=2),
            FsmSignal(name="go", type_text="std_logic", mode="in", role="data", order=3),
            FsmSignal(
                name="flag",
                type_text="std_logic",
                mode="out",
                role="data",
                scheme="clocked",
                default_text="'0'",
                reset_text="'0'",
                order=4,
            ),
        ],
    )
    return design
