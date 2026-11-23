"""Render one structural netlist as VHDL-93 or VHDL-2008 text.

The two standards share this renderer. VHDL-2008-only constructs never reach
it: the analyzer rejects them for VHDL-93 and rejects unimplemented ones for
VHDL-2008 before a design is built.
"""

from __future__ import annotations

import re
from typing import Literal

from app.hdl.ir import IrAssoc, IrDesign, IrFsm, IrFsmSignal, IrFsmState, IrGeneric, IrPort, IrSignal

VhdlStandard = Literal["93", "2008"]


def render_vhdl(design: IrDesign, standard: VhdlStandard) -> str:
    if design.fsm is not None:
        return _render_fsm(design, design.fsm, standard)
    lines = [
        "-- HDL-Maker structural VHDL",
        f"-- vhdl_standard: {standard}",
        "",
    ]
    if design.needs_std_logic or design.needs_numeric:
        lines.append("library ieee;")
        if design.needs_std_logic:
            lines.append("use ieee.std_logic_1164.all;")
        if design.needs_numeric:
            lines.append("use ieee.numeric_std.all;")
        lines.append("")
    lines.append(f"entity {design.entity_name} is")
    if design.generics:
        lines.append("  generic (")
        lines.extend(_separated([_generic_line(item) for item in design.generics], ";"))
        lines.append("  );")
    if design.ports:
        lines.append("  port (")
        lines.extend(_separated([_port_line(item) for item in design.ports], ";"))
        lines.append("  );")
    lines.append(f"end entity {design.entity_name};")
    lines.append("")
    for name in _resource_libraries(design):
        lines.append(f"library {name};")
    lines.append(f"architecture {design.architecture_name} of {design.entity_name} is")
    for signal in design.signals:
        lines.append(f"  signal {signal.name} : {_typed(signal)};")
    for block in design.texts:
        if block.role == "declarations":
            lines.append(_embedded(block.text))
    lines.append("begin")
    for instance in design.instances:
        lines.extend(_instance_lines(instance))
    for block in design.texts:
        if block.role == "statements":
            lines.append(_embedded(block.text))
    lines.append(f"end architecture {design.architecture_name};")
    lines.append("")
    return "\n".join(lines)


def _render_fsm(design: IrDesign, fsm: IrFsm, standard: VhdlStandard) -> str:
    context = _context(fsm.packages)
    lines = ["-- HDL-Maker FSM VHDL", f"-- vhdl_standard: {standard}", ""]
    lines.extend(context)
    if context:
        lines.append("")
    lines.append(f"entity {design.entity_name} is")
    if design.generics:
        lines.append("  generic (")
        lines.extend(_separated([_generic_line(item) for item in design.generics], ";"))
        lines.append("  );")
    if design.ports:
        lines.append("  port (")
        lines.extend(_separated([_port_line(item) for item in design.ports], ";"))
        lines.append("  );")
    lines.append(f"end entity {design.entity_name};")
    lines.append("")
    lines.extend(context)
    if context:
        lines.append("")
    lines.append(f"architecture {design.architecture_name} of {design.entity_name} is")
    if fsm.declarations:
        lines.append(fsm.declarations.rstrip())
    for signal in fsm.signals:
        if signal.register_name and signal.register_name not in _words(fsm.declarations or ""):
            lines.append(f"  signal {signal.register_name} : {_with_range(signal.type_text, signal.range_text)};")
    names = ",\n".join(f"    {state.name}" for state in fsm.states)
    lines.append("  type state_type is (")
    lines.append(names)
    lines.append("  );")
    lines.append(f"  signal {fsm.state_signal} : state_type;")
    lines.append("  signal next_state : state_type;")
    lines.append("begin")
    lines.extend(_clocked_process(fsm))
    lines.extend(_next_process(fsm))
    lines.extend(_output_process(fsm))
    for signal in fsm.signals:
        if signal.register_name:
            lines.append(f"  {signal.name} <= {signal.register_name};")
    if fsm.concurrent:
        lines.append(fsm.concurrent.rstrip())
    lines.append(f"end architecture {design.architecture_name};")
    lines.append("")
    return "\n".join(lines)


def _context(packages: tuple[tuple[str, str], ...]) -> list[str]:
    lines: list[str] = []
    library = None
    for name, unit in packages:
        if name != library:
            if library is not None:
                lines.append("")
            lines.append(f"library {name};")
            library = name
        lines.append(f"use {name}.{unit}.all;")
    return lines


def _clocked_process(fsm: IrFsm) -> list[str]:
    lines = ["  clocked_proc : process (", f"    {fsm.clock_name}", "  )", "  begin", f"    if ({fsm.clock_expr}) then"]
    lines.append(f"      if ({fsm.reset_expr}) then")
    lines.append(f"        {fsm.state_signal} <= {fsm.reset_state};")
    for signal in fsm.signals:
        if signal.reset_text and signal.scheme == "clocked":
            lines.append(f"        {_driven(signal)} <= {signal.reset_text};")
    follow = "elsif" if fsm.enable_expr else "else"
    lines.append(f"      {follow} ({fsm.enable_expr}) then" if fsm.enable_expr else "      else")
    lines.append(f"        {fsm.state_signal} <= next_state;")
    for signal in fsm.signals:
        if signal.default_text and signal.scheme == "clocked":
            lines.append(f"        {_driven(signal)} <= {signal.default_text};")
    case = [_indent(line, 8) for line in _action_case(fsm, "clocked")]
    lines.extend(_guarded(fsm, case, 8, False))
    lines.append("      end if;")
    lines.append("    end if;")
    lines.append("  end process clocked_proc;")
    return lines


def _next_process(fsm: IrFsm) -> list[str]:
    texts = [item.condition for item in fsm.interrupts]
    texts.extend(branch.condition or "" for state in fsm.states for branch in state.branches)
    lines = ["  nextstate_proc : process ("]
    lines.extend(_sensitivity([fsm.state_signal, *_mentioned(texts, fsm)]))
    lines.append("  )")
    lines.append("  begin")
    body = [f"    case {fsm.state_signal} is"]
    for state in fsm.states:
        body.extend(_indent(line, 6) for line in _next_state(state, fsm.state_signal))
    body.append("      when others =>")
    body.append(f"        next_state <= {fsm.recovery_state};")
    body.append("    end case;")
    lines.extend(_guarded(fsm, body, 4, True))
    lines.append("  end process nextstate_proc;")
    return lines


def _output_process(fsm: IrFsm) -> list[str]:
    case = _action_case(fsm, "combinational")
    defaults = [signal for signal in fsm.signals if signal.default_text and signal.scheme == "combinational"]
    if not case and not defaults:
        return []
    expressions = [item.condition for item in fsm.interrupts]
    expressions.extend(signal.default_text or "" for signal in defaults)
    statements: list[str] = []
    for state in fsm.states:
        statements.extend(state.combinational_during)
        statements.extend(action for branch in state.branches for action in branch.combinational_actions)
    # Assignment targets are written, not read. An out port in this list is illegal in VHDL-93.
    names = [*_mentioned(expressions, fsm), *_mentioned(_without_assignment_targets(statements), fsm)]
    if case:
        names = [fsm.state_signal, *names]
    if not names and not fsm.interrupts:
        return [f"  {signal.name} <= {signal.default_text};" for signal in defaults]
    lines = ["  output_proc : process ("]
    lines.extend(_sensitivity(names))
    lines.append("  )")
    lines.append("  begin")
    for signal in defaults:
        lines.append(f"    {signal.name} <= {signal.default_text};")
    lines.extend(_guarded(fsm, [_indent(line, 4) for line in case], 4, False))
    lines.append("  end process output_proc;")
    return lines


def _guarded(fsm: IrFsm, body: list[str], spaces: int, assign_next: bool) -> list[str]:
    if not body:
        return []
    if not fsm.interrupts:
        return body
    pad = " " * spaces
    lines: list[str] = []
    for index, item in enumerate(fsm.interrupts):
        word = "if" if index == 0 else "elsif"
        lines.append(f"{pad}{word} ({item.condition}) then")
        if assign_next:
            lines.append(f"{pad}  next_state <= {item.target};")
        else:
            lines.append(f"{pad}  null;")
    lines.append(f"{pad}else")
    lines.extend(f"  {line}" if line else line for line in body)
    lines.append(f"{pad}end if;")
    return lines


def _indent(line: str, spaces: int) -> str:
    return f"{' ' * spaces}{line}" if line else line


def _action_case(fsm: IrFsm, kind: str) -> list[str]:
    lines = [f"case {fsm.state_signal} is"]
    present = False
    for state in fsm.states:
        body = _action_body(state, kind)
        if not body:
            continue
        present = True
        lines.append(f"  when {state.name} =>")
        for line in body:
            lines.extend(_indent(part, 4) for part in line.splitlines())
    if not present:
        return []
    lines.append("  when others =>")
    lines.append("    null;")
    lines.append("end case;")
    return lines


def _action_body(state: IrFsmState, kind: str) -> list[str]:
    during = state.clocked_during if kind == "clocked" else state.combinational_during
    selected = "clocked_actions" if kind == "clocked" else "combinational_actions"
    conditionals = [branch for branch in state.branches if branch.condition is not None]
    default = next((branch for branch in state.branches if branch.condition is None), None)
    lines = list(during)
    used = [branch for branch in conditionals if getattr(branch, selected)]
    default_actions = list(getattr(default, selected)) if default is not None else []
    if not used and not default_actions:
        return lines
    if not conditionals:
        lines.extend(default_actions)
        return lines
    for index, branch in enumerate(conditionals):
        word = "if" if index == 0 else "elsif"
        lines.append(f"{word} ({branch.condition}) then")
        lines.extend(f"  {line}" if line else line for line in getattr(branch, selected))
    if default_actions:
        lines.append("else")
        lines.extend(f"  {line}" if line else line for line in default_actions)
    lines.append("end if;")
    return lines


def _next_state(state: IrFsmState, current: str) -> list[str]:
    conditionals = [branch for branch in state.branches if branch.condition is not None]
    default = next((branch for branch in state.branches if branch.condition is None), None)
    held = default.target if default is not None else state.name
    lines = [f"when {state.name} =>"]
    if not conditionals:
        lines.append(f"  next_state <= {held};")
        return lines
    for index, branch in enumerate(conditionals):
        word = "if" if index == 0 else "elsif"
        lines.append(f"  {word} ({branch.condition}) then")
        lines.append(f"    next_state <= {branch.target};")
    lines.append("  else")
    lines.append(f"    next_state <= {held};")
    lines.append("  end if;")
    return lines


def _sensitivity(names: list[str]) -> list[str]:
    unique: list[str] = []
    for name in names:
        if name and name not in unique:
            unique.append(name)
    if not unique:
        unique.append("open")
    return _separated([f"    {name}" for name in unique], ",")


def _without_assignment_targets(statements: list[str]) -> list[str]:
    """Drop names that are assigned so a sensitivity list keeps the values that are read.

    A stored action uses ``<=`` as assignment. A condition is not passed here, so a
    relational ``<=`` in a condition stays visible to the caller.
    """
    reduced: list[str] = []
    for statement in statements:
        reduced.append(
            re.sub(
                r"(?:(?<=^)|(?<=;)|(?<=\bthen)|(?<=\belse))\s*[A-Za-z_][A-Za-z0-9_]*\s*(?:\([^;]*\))?\s*<=",
                " ",
                statement,
                flags=re.MULTILINE,
            )
        )
    return reduced


def _mentioned(texts: list[str], fsm: IrFsm) -> list[str]:
    blob = "\n".join(texts)
    found: list[str] = []
    for signal in fsm.signals:
        if re.search(rf"\b{re.escape(signal.name)}\b", blob):
            found.append(signal.name)
        if signal.register_name and re.search(rf"\b{re.escape(signal.register_name)}\b", blob):
            found.append(signal.register_name)
    return found


def _driven(signal: IrFsmSignal) -> str:
    return signal.register_name or signal.name


def _words(text: str) -> set[str]:
    return set(re.findall(r"[A-Za-z][A-Za-z0-9_]*", text))


def _resource_libraries(design: IrDesign) -> list[str]:
    """Libraries other than the implicit ones, in a stable order.

    A context clause applies to the next design unit, so these clauses sit
    directly in front of the architecture that instantiates them.
    """
    found: list[str] = []
    seen: set[str] = set()
    for instance in design.instances:
        name = instance.library_name
        key = name.casefold()
        if key in {"work", "std", "ieee"} or key in seen:
            continue
        seen.add(key)
        found.append(name)
    return sorted(found, key=str.casefold)


def _separated(lines: list[str], separator: str) -> list[str]:
    """Join a VHDL list. Interfaces use ';'. Associations use ','."""
    if not lines:
        return []
    return [f"{line}{separator}" for line in lines[:-1]] + [lines[-1]]


def _typed(item: IrSignal) -> str:
    return _with_range(item.type_text, item.range_text)


def _with_range(type_text: str, range_text: str | None) -> str:
    if not range_text:
        return type_text
    span = range_text.strip()
    if span.startswith("("):
        return f"{type_text}{span}"
    return f"{type_text} {span}"


def _generic_line(item: IrGeneric) -> str:
    if item.kind == "type":
        return f"    {item.name} : type"
    text = f"    {item.name} : {item.type_text}"
    if item.default_text:
        text += f" := {item.default_text}"
    return text


def _port_line(item: IrPort) -> str:
    text = f"    {item.name} : {item.direction} {_with_range(item.type_text, item.range_text)}"
    if item.default_text:
        text += f" := {item.default_text}"
    return text


def _instance_lines(instance) -> list[str]:
    binding = f"entity {instance.library_name}.{instance.entity_name}"
    if instance.architecture_name:
        binding += f"({instance.architecture_name})"
    lines = [f"  {instance.label} : {binding}"]
    if instance.generics:
        lines.append("    generic map (")
        lines.extend(_separated([_assoc(item) for item in instance.generics], ","))
        lines.append("    )")
    if instance.ports:
        lines.append("    port map (")
        lines.extend(_separated([_assoc(item) for item in instance.ports], ","))
        lines.append("    );")
    elif instance.generics:
        lines[-1] = "    );"
    else:
        lines[0] = f"{lines[0]};"
    return lines


def _assoc(item: IrAssoc) -> str:
    return f"      {item.formal} => {item.actual}"


def _embedded(text: str) -> str:
    if text.endswith("\n"):
        return text[:-1]
    return text
