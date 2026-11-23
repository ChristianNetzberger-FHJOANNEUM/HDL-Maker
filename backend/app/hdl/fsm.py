"""FSM netlist from the stored interface, states, and transitions.

Text-box positions and spline points are not read. A missing clock, reset,
encoding, or priority is reported and the machine is not written.
"""

from __future__ import annotations

import re

from app.hdl.ir import (
    IrDesign,
    IrFsm,
    IrFsmBranch,
    IrFsmInterrupt,
    IrFsmSignal,
    IrFsmState,
    IrGeneric,
    IrPort,
)
from app.hdl.vhdl import VhdlStandard
from app.models.design import Diagnostic, FsmMachine
from app.models.editable import EditableDiagram, EditableState, EditableTransition

_NAME = re.compile(r"^[A-Za-z][A-Za-z0-9_]*\Z")
_PROCESS_ALL = re.compile(r"process\s*\(\s*all\s*\)", re.IGNORECASE)
_CONDITION = re.compile(r"\?\?")


def fsm_design(
    diagram: EditableDiagram,
    standard: VhdlStandard,
) -> tuple[IrDesign | None, list[Diagnostic]]:
    diagnostics: list[Diagnostic] = []
    machine = diagram.fsm
    entity = (diagram.entity_name or diagram.name or "").strip()
    if not _NAME.fullmatch(entity):
        return None, [_error(diagram, "entity_name_missing", f"Design '{diagram.name}' has no usable entity name.")]
    architecture = (diagram.architecture_name or "").strip() or "rtl"
    if not _NAME.fullmatch(architecture):
        return None, [_error(diagram, "identifier_invalid", f"Architecture name '{architecture}' is not a VHDL identifier.")]
    if machine is None:
        return None, [_error(diagram, "fsm_clock_missing", f"State diagram '{diagram.name}' has no clock, reset, or interface table.")]
    state_signal = (diagram.state_signal_name or "").strip()
    if not _NAME.fullmatch(state_signal):
        diagnostics.append(_error(diagram, "fsm_state_signal_missing", "The current-state signal name is not stored."))
    _require_controls(diagram, machine, diagnostics)
    if any(item.severity == "error" for item in diagnostics):
        return None, diagnostics

    signals = _signal_table(diagram, machine, diagnostics)
    states = _ordered_states(diagram, machine, diagnostics)
    if any(item.severity == "error" for item in diagnostics):
        return None, diagnostics
    by_id = {state.id: state for state in diagram.states}
    reset_state, recovery, interrupts, grouped = _arcs(diagram, machine, by_id, diagnostics)
    if any(item.severity == "error" for item in diagnostics) or reset_state is None or recovery is None:
        return None, diagnostics

    built: list[IrFsmState] = []
    for state in states:
        outgoing = grouped.get(state.id, [])
        branches = _branches(diagram, state, outgoing, by_id, signals, diagnostics)
        if branches is None:
            continue
        during_clocked, during_comb = _classify_block(diagram, state.during_actions, signals, diagnostics, f"state {state.name}")
        built.append(
            IrFsmState(
                name=state.name,
                clocked_during=tuple(during_clocked or []),
                combinational_during=tuple(during_comb or []),
                branches=tuple(branches),
            )
        )
    if any(item.severity == "error" for item in diagnostics):
        return None, diagnostics
    copied = "\n".join(part for part in (machine.declarations, machine.concurrent) if part)
    actions = "\n".join(
        text
        for state in built
        for text in (
            *state.clocked_during,
            *state.combinational_during,
            *(action for branch in state.branches for action in (*branch.clocked_actions, *branch.combinational_actions)),
        )
    )
    if standard == "93" and (_PROCESS_ALL.search(copied) or _PROCESS_ALL.search(actions) or _CONDITION.search(copied) or _CONDITION.search(actions)):
        diagnostics.append(
            _error(diagram, "vhdl93_unsupported", "A stored FSM text uses a VHDL-2008 form. VHDL-93 generation stopped.")
        )
        return None, diagnostics
    enable = next(item for item in machine.signals if item.role == "enable") if any(item.role == "enable" for item in machine.signals) else None
    clock = next(item for item in machine.signals if item.role == "clock")
    reset = next(item for item in machine.signals if item.role == "reset")
    fsm = IrFsm(
        state_signal=state_signal,
        clock_name=clock.name,
        clock_expr=clock.expression or "",
        reset_expr=reset.expression or "",
        reset_state=reset_state,
        enable_expr=enable.expression if enable else None,
        recovery_state=recovery,
        interrupts=tuple(interrupts),
        states=tuple(built),
        signals=tuple(signals),
        declarations=machine.declarations,
        concurrent=machine.concurrent,
        packages=tuple((item.library_name, item.unit_name) for item in machine.packages),
    )
    ports = tuple(
        IrPort(name=item.name, direction=item.direction, type_text=item.type_text, range_text=item.range_text)
        for item in signals
        if item.direction in {"in", "out"}
    )
    generics = tuple(
        IrGeneric(name=item.name, kind="value", type_text=item.type_text, default_text=item.default_text)
        for item in machine.generics
    )
    return (
        IrDesign(
            diagram_id=diagram.id,
            entity_name=entity,
            architecture_name=architecture,
            generics=generics,
            ports=ports,
            signals=(),
            instances=(),
            texts=(),
            needs_std_logic=False,
            needs_numeric=False,
            fsm=fsm,
        ),
        diagnostics,
    )


def _require_controls(diagram: EditableDiagram, machine: FsmMachine, diagnostics: list[Diagnostic]) -> None:
    if machine.encoding_scheme != 3:
        diagnostics.append(
            _error(diagram, "fsm_encoding_unsupported", "Only the stored enumerated state encoding is generated. No bit encoding was chosen.")
        )
    if machine.next_state_clocking != 0:
        diagnostics.append(
            _error(diagram, "fsm_clocking_unsupported", "The next state is not stored as a separate combinational signal.")
        )
    if machine.reset_mode != 0:
        diagnostics.append(
            _error(diagram, "fsm_reset_unsupported", "The reset is not stored as synchronous inside the clock condition.")
        )
    if not machine.controls_agree:
        diagnostics.append(
            _error(diagram, "fsm_control_text_differs", "A clock, reset, or enable expression on the diagram differs from the interface table.")
        )
    if machine.enable_before_reset not in {None, 0}:
        diagnostics.append(
            _error(diagram, "fsm_enable_unsupported", "The enable is stored ahead of reset, and that order is not generated.")
        )
    clocks = [item for item in machine.signals if item.role == "clock"]
    resets = [item for item in machine.signals if item.role == "reset"]
    enables = [item for item in machine.signals if item.role == "enable"]
    if len(clocks) != 1 or not clocks[0].expression:
        diagnostics.append(_error(diagram, "fsm_clock_missing", "The machine does not store exactly one clock expression."))
    if len(resets) != 1 or not resets[0].expression:
        diagnostics.append(_error(diagram, "fsm_reset_missing", "The machine does not store exactly one reset expression."))
    if len(enables) > 1 or any(not item.expression for item in enables):
        diagnostics.append(_error(diagram, "fsm_enable_unsupported", "The machine does not store one enable expression."))
    for item in machine.signals:
        if item.mode == "unknown" or item.role == "unknown":
            diagnostics.append(_error(diagram, "fsm_signal_unsupported", f"Signal '{item.name}' has a mode or category that was not recognized."))
        if item.mode in {"out", "local"} and item.scheme is None:
            diagnostics.append(_error(diagram, "fsm_signal_unsupported", f"Signal '{item.name}' has no clocked or combinational scheme."))
        if item.scheme == "combinational" and item.reset_text:
            diagnostics.append(
                _error(diagram, "fsm_reset_value_unplaced", f"Combinational signal '{item.name}' has a reset value, and its process is not known.")
            )
        if not _NAME.fullmatch(item.name):
            diagnostics.append(_error(diagram, "identifier_invalid", f"Signal '{item.name}' is not a VHDL identifier."))
    if any(item.mode == "out" and item.scheme == "clocked" for item in machine.signals) and not machine.clock_suffix:
        diagnostics.append(_error(diagram, "fsm_clock_suffix_missing", "A clocked output has no stored register suffix."))


def _signal_table(diagram: EditableDiagram, machine: FsmMachine, diagnostics: list[Diagnostic]) -> list[IrFsmSignal]:
    suffix = machine.clock_suffix or ""
    found: list[IrFsmSignal] = []
    for item in sorted(machine.signals, key=lambda signal: signal.order):
        register = None
        if item.mode == "out" and item.scheme == "clocked":
            register = f"{item.name}{suffix}"
            if not _NAME.fullmatch(register):
                diagnostics.append(_error(diagram, "identifier_invalid", f"Register name '{register}' is not a VHDL identifier."))
        found.append(
            IrFsmSignal(
                name=item.name,
                direction=item.mode,
                type_text=item.type_text,
                range_text=item.range_text,
                scheme=item.scheme,
                default_text=item.default_text,
                reset_text=item.reset_text,
                register_name=register,
            )
        )
    names = [item.name for item in found] + [item.register_name or "" for item in found]
    if diagram.state_signal_name in names or "next_state" in names or "state_type" in names:
        diagnostics.append(
            _error(diagram, "fsm_name_conflict", "The state signal, next_state, or state_type collides with a stored signal.")
        )
    return found


def _ordered_states(diagram: EditableDiagram, machine: FsmMachine, diagnostics: list[Diagnostic]) -> list[EditableState]:
    by_object = {state.hds_object: state for state in diagram.states if state.hds_object is not None}
    if len(by_object) != len(diagram.states) or not machine.state_order:
        diagnostics.append(_error(diagram, "fsm_state_order_incomplete", "The stored state order does not name every state."))
        return []
    ordered: list[EditableState] = []
    for object_id in machine.state_order:
        state = by_object.get(object_id)
        if state is None or not _NAME.fullmatch(state.name):
            diagnostics.append(_error(diagram, "fsm_state_order_incomplete", "The stored state order names a state that is not placed."))
            return []
        ordered.append(state)
    if len(ordered) != len(diagram.states) or len({item.name.casefold() for item in ordered}) != len(ordered):
        diagnostics.append(_error(diagram, "fsm_state_order_incomplete", "The stored state order does not match the placed states."))
        return []
    for state in ordered:
        if _text(state.entry_actions) or _text(state.exit_actions):
            diagnostics.append(
                _error(
                    diagram,
                    "fsm_entry_exit_unsupported",
                    f"State '{state.name}' has entry or exit actions. Their clock position is not stored, so they were not emitted.",
                )
            )
    return ordered


def _arcs(
    diagram: EditableDiagram,
    machine: FsmMachine,
    by_id: dict[str, EditableState],
    diagnostics: list[Diagnostic],
) -> tuple[str | None, str | None, list[IrFsmInterrupt], dict[str, list[EditableTransition]]]:
    grouped: dict[str, list[EditableTransition]] = {state_id: [] for state_id in by_id}
    resets: list[EditableTransition] = []
    recoveries: list[EditableTransition] = []
    interrupts: list[IrFsmInterrupt] = []
    for transition in diagram.transitions:
        if transition.start_kind == "state" and transition.start_state_id in grouped:
            if transition.end_kind != "state" or transition.end_state_id not in by_id:
                diagnostics.append(_error(diagram, "fsm_anchor_unresolved", "A transition does not end on one placed state."))
                continue
            grouped[transition.start_state_id].append(transition)
            continue
        target = by_id.get(transition.end_state_id or "")
        if transition.start_kind == "reset":
            resets.append(transition)
        elif transition.start_kind == "recovery":
            recoveries.append(transition)
        elif transition.start_kind == "interrupt":
            condition = _text(transition.condition)
            if target is None or not condition or _text(transition.actions):
                diagnostics.append(
                    _error(diagram, "fsm_interrupt_actions_unsupported", "An interrupt has no condition, no target, or stored actions.")
                )
            elif target is not None and condition:
                interrupts.append(IrFsmInterrupt(condition=condition, target=target.name))
        else:
            diagnostics.append(_error(diagram, "fsm_anchor_unresolved", "A transition start is not a state, reset, recovery, or interrupt."))
    reset_name = _single_target(diagram, resets, "reset", diagnostics)
    reset_expr = next((item.expression for item in machine.signals if item.role == "reset"), None)
    if resets and reset_expr and _text(resets[0].condition) != reset_expr.strip():
        diagnostics.append(
            _error(diagram, "fsm_reset_mismatch", "The reset arc condition differs from the reset expression in the interface table.")
        )
    recovery_name = _single_target(diagram, recoveries, "recovery", diagnostics)
    return reset_name, recovery_name, interrupts, grouped


def _single_target(
    diagram: EditableDiagram,
    arcs: list[EditableTransition],
    kind: str,
    diagnostics: list[Diagnostic],
) -> str | None:
    if len(arcs) != 1 or arcs[0].end_kind != "state" or not arcs[0].end_state_id:
        diagnostics.append(_error(diagram, f"fsm_{kind}_missing", f"The machine does not store exactly one {kind} target state."))
        return None
    actions = _text(arcs[0].actions)
    if actions and actions != "< Automatic >":
        diagnostics.append(
            _error(diagram, "fsm_reset_actions_unsupported", f"The {kind} arc has actions other than the interface reset values.")
        )
    state = next(item for item in diagram.states if item.id == arcs[0].end_state_id)
    return state.name


def _branches(
    diagram: EditableDiagram,
    state: EditableState,
    outgoing: list[EditableTransition],
    by_id: dict[str, EditableState],
    signals: list[IrFsmSignal],
    diagnostics: list[Diagnostic],
) -> list[IrFsmBranch] | None:
    conditionals = [item for item in outgoing if _text(item.condition)]
    defaults = [item for item in outgoing if not _text(item.condition)]
    if len(defaults) > 1:
        diagnostics.append(_error(diagram, "fsm_priority_conflict", f"State '{state.name}' has more than one transition without a condition."))
        return None
    numbers = [_priority(item.priority) for item in conditionals]
    if any(number is None for number in numbers) and any(number is not None for number in numbers):
        diagnostics.append(_error(diagram, "fsm_priority_incomplete", f"State '{state.name}' numbers only some transition priorities."))
        return None
    if numbers and all(number is not None for number in numbers):
        if len(set(numbers)) != len(numbers):
            diagnostics.append(_error(diagram, "fsm_priority_conflict", f"State '{state.name}' repeats a transition priority."))
            return None
        default_number = _priority(defaults[0].priority) if defaults else None
        if defaults and default_number is None:
            diagnostics.append(_error(diagram, "fsm_priority_incomplete", f"State '{state.name}' numbers conditions but not the default transition."))
            return None
        if default_number is not None and any(default_number <= number for number in numbers if number is not None):
            diagnostics.append(
                _error(diagram, "fsm_priority_conflict", f"State '{state.name}' gives the default transition priority over a condition.")
            )
            return None
        conditionals = [item for _, item in sorted(zip(numbers, conditionals, strict=True), key=lambda pair: pair[0] or 0)]
    branches: list[IrFsmBranch] = []
    failed = False
    for item in conditionals:
        clocked, combinational = _classify_block(diagram, item.actions, signals, diagnostics, f"state {state.name}")
        if clocked is None:
            failed = True
            continue
        target = by_id[item.end_state_id or ""].name
        branches.append(
            IrFsmBranch(
                condition=_text(item.condition),
                target=target,
                clocked_actions=tuple(clocked),
                combinational_actions=tuple(combinational or []),
            )
        )
    if defaults:
        clocked, combinational = _classify_block(diagram, defaults[0].actions, signals, diagnostics, f"state {state.name}")
        if clocked is None:
            failed = True
        else:
            branches.append(
                IrFsmBranch(
                    condition=None,
                    target=by_id[defaults[0].end_state_id or ""].name,
                    clocked_actions=tuple(clocked),
                    combinational_actions=tuple(combinational or []),
                )
            )
    if failed:
        return None
    return branches


def _classify_block(
    diagram: EditableDiagram,
    text: str | None,
    signals: list[IrFsmSignal],
    diagnostics: list[Diagnostic],
    where: str,
) -> tuple[list[str] | None, list[str] | None]:
    raw = _text(text)
    if raw is None:
        return [], []
    if raw == "< Automatic >":
        diagnostics.append(_error(diagram, "fsm_action_unsupported", f"An action on {where} is marked automatic."))
        return None, None
    statements, problem = _statements(raw)
    if problem is not None or statements is None:
        diagnostics.append(_error(diagram, "fsm_action_unsupported", f"An action on {where} uses {problem or 'an unsupported form'}."))
        return None, None
    clocked: list[str] = []
    combinational: list[str] = []
    for statement in statements:
        targets = _targets(statement)
        if not targets:
            diagnostics.append(_error(diagram, "fsm_action_unsupported", f"An action on {where} contains no assignment."))
            return None, None
        classes = {_class_of(target, signals) for target in targets}
        if None in classes:
            unknown = next(target for target in targets if _class_of(target, signals) is None)
            diagnostics.append(_error(diagram, "fsm_action_target_unknown", f"Assignment to '{unknown}' on {where} matches no stored signal."))
            return None, None
        if len(classes) != 1:
            diagnostics.append(_error(diagram, "fsm_action_unsplit", f"One action on {where} assigns both a clocked and a combinational signal."))
            return None, None
        (clocked if "clocked" in classes else combinational).append(_terminated(statement))
    return clocked, combinational


def _class_of(target: str, signals: list[IrFsmSignal]) -> str | None:
    for signal in signals:
        if signal.register_name and target == signal.register_name and signal.scheme == "clocked":
            return "clocked"
        if target == signal.name and signal.scheme == "clocked":
            return "clocked"
        if target == signal.name and signal.scheme == "combinational":
            return "combinational"
    return None


def _terminated(statement: str) -> str:
    body = statement.rstrip()
    return body if body.endswith(";") else f"{body};"


def _statements(text: str) -> tuple[list[str] | None, str | None]:
    statements: list[str] = []
    start = 0
    depth = 0
    index = 0
    while index < len(text):
        index = _skip_noise(text, index)
        if index >= len(text):
            break
        if text[index] == ";":
            if depth == 0:
                piece = text[start:index].strip()
                if piece:
                    statements.append(piece)
                start = index + 1
            index += 1
            continue
        word, after = _word_at(text, index)
        if word is None:
            index += 1
            continue
        lower = word.lower()
        if lower in {"case", "loop", "wait", "assert", "for", "while", "return"} and depth == 0:
            return None, lower
        if lower == "if":
            depth += 1
            index = after
            continue
        if lower == "end":
            following, done = _word_at(text, _skip_noise(text, after))
            if following and following.lower() == "if":
                depth -= 1
                index = done
                continue
        index = after
    if text[_skip_noise(text, start):].strip():
        return None, "an unterminated statement"
    return statements, None


def _targets(statement: str) -> list[str]:
    found: list[str] = []
    for region in _regions(statement):
        index = 0
        while True:
            pos = region.find("<=", index)
            if pos < 0:
                break
            left = region[:pos].rstrip()
            if left.endswith(")"):
                depth = 0
                cut = len(left)
                for cursor in range(len(left) - 1, -1, -1):
                    if left[cursor] == ")":
                        depth += 1
                    elif left[cursor] == "(":
                        depth -= 1
                        if depth == 0:
                            cut = cursor
                            break
                left = left[:cut].rstrip()
            match = re.search(r"([A-Za-z][A-Za-z0-9_]*)\s*$", left)
            if match:
                found.append(match.group(1))
            index = pos + 2
    return found


def _regions(statement: str) -> list[str]:
    if _word_at(statement.lstrip(), 0)[0] is None or _word_at(statement.lstrip(), 0)[0].lower() != "if":
        return [statement]
    regions: list[str] = []
    depth = 0
    capturing = False
    start = 0
    index = 0
    while index < len(statement):
        word, after = _word_at(statement, index)
        if word is None:
            index += 1
            continue
        lower = word.lower()
        if lower == "if":
            depth += 1
            index = after
            continue
        if lower == "then" and depth == 1:
            capturing = True
            start = after
            index = after
            continue
        if lower in {"elsif", "else"} and depth == 1:
            if capturing:
                regions.append(statement[start:index])
            capturing = lower == "else"
            start = after
            index = after
            continue
        if lower == "end":
            following, done = _word_at(statement, _skip_noise(statement, after))
            if following and following.lower() == "if":
                depth -= 1
                if depth == 0 and capturing:
                    regions.append(statement[start:index])
                    capturing = False
                index = done
                continue
        index = after
    return regions


def _skip_noise(text: str, index: int) -> int:
    while index < len(text):
        if text[index].isspace():
            index += 1
            continue
        if text.startswith("--", index):
            newline = text.find("\n", index)
            index = len(text) if newline < 0 else newline + 1
            continue
        if text[index] == '"':
            index += 1
            while index < len(text):
                if text[index] == '"':
                    if index + 1 < len(text) and text[index + 1] == '"':
                        index += 2
                        continue
                    index += 1
                    break
                index += 1
            continue
        if text[index] == "'" and index + 2 < len(text) and text[index + 2] == "'":
            index += 3
            continue
        break
    return index


def _word_at(text: str, index: int) -> tuple[str | None, int]:
    index = _skip_noise(text, index)
    if index >= len(text) or not (text[index].isalpha() or text[index] == "_"):
        return None, index
    end = index + 1
    while end < len(text) and (text[end].isalnum() or text[end] == "_"):
        end += 1
    return text[index:end], end


def _priority(value: str | None) -> int | None:
    text = _text(value)
    if text is None or not text.isdigit():
        return None
    return int(text)


def _text(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    return value.strip()


def _error(diagram: EditableDiagram, code: str, message: str) -> Diagnostic:
    return Diagnostic(severity="error", code=code, message=message, path=diagram.id)
