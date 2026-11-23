"""Read the state-machine interface table. Canvas coordinates are ignored."""

from __future__ import annotations

from app.importers.hds.grammar import Array, Node, Record, Ref, atom_text, walk
from app.models.design import Diagnostic, FsmGeneric, FsmMachine, FsmMode, FsmPackage, FsmRole, FsmScheme, FsmSignal


def read_fsm_interface(
    model: Record,
    header: Node | None,
) -> tuple[FsmMachine, list[Diagnostic]]:
    diagnostics: list[Diagnostic] = []
    machine = FsmMachine(
        packages=_packages(header),
        generics=_generics(model, diagnostics),
        signals=_signals(model, diagnostics),
        declarations=_declaration_text(model),
        concurrent=_concurrent_text(model),
        state_order=_state_order(model),
        clock_suffix=_suffix(model),
        encoding_scheme=_one_int(model, "Encoding", "scheme"),
        next_state_clocking=_one_int(model, "SmGenChar", "nextStateClocking"),
        reset_mode=_placed_int(model, "SmResetPoint", "mode"),
        enable_before_reset=_placed_int(model, "SmEnablePoint", "beforeResets"),
        controls_agree=_controls_agree(model),
    )
    return machine, diagnostics


def _packages(header: Node | None) -> list[FsmPackage]:
    record = header if isinstance(header, Record) else None
    if record is None:
        return []
    found: list[FsmPackage] = []
    for item in walk(record):
        if not isinstance(item, Record) or item.type_name != "DmPackageRef":
            continue
        library = atom_text(item.first("library"))
        unit = atom_text(item.first("unitName"))
        if library and unit:
            found.append(FsmPackage(library_name=library, unit_name=unit))
    return found


def _generics(model: Record, diagnostics: list[Diagnostic]) -> list[FsmGeneric]:
    found: list[FsmGeneric] = []
    seen: set[str] = set()
    for record in _records(model):
        if record.type_name != "LogGeneric":
            continue
        element = record.first("generic")
        if not isinstance(element, Record):
            continue
        name = atom_text(element.first("name"))
        type_text = atom_text(element.first("type"))
        if not name or not type_text:
            continue
        if name in seen:
            diagnostics.append(
                Diagnostic(
                    severity="warning",
                    code="fsm_generic_repeated",
                    message=f"Generic '{name}' is declared more than once.",
                    line=record.line,
                )
            )
            continue
        seen.add(name)
        found.append(FsmGeneric(name=name, type_text=type_text, default_text=atom_text(element.first("value"))))
    return found


def _signals(model: Record, diagnostics: list[Diagnostic]) -> list[FsmSignal]:
    found: list[FsmSignal] = []
    seen: set[str] = set()
    for record in _records(model):
        if record.type_name != "LeafLogPort":
            continue
        port = record.first("port")
        if not isinstance(port, Record):
            continue
        decl = port.first("decl")
        if not isinstance(decl, Record):
            continue
        name = atom_text(decl.first("n"))
        type_text = atom_text(decl.first("t"))
        order = _int(atom_text(decl.first("o")))
        if not name or not type_text or order is None:
            diagnostics.append(
                Diagnostic(
                    severity="warning",
                    code="fsm_signal_incomplete",
                    message="A state-machine interface row has no name, type, or order and was not kept.",
                    line=record.line,
                )
            )
            continue
        if name in seen:
            diagnostics.append(
                Diagnostic(
                    severity="warning",
                    code="fsm_signal_repeated",
                    message=f"Signal '{name}' is declared more than once.",
                    line=record.line,
                )
            )
            continue
        seen.add(name)
        found.append(
            FsmSignal(
                name=name,
                type_text=type_text,
                range_text=atom_text(decl.first("b")),
                mode=_mode(atom_text(port.first("m"))),
                role=_role(atom_text(record.first("cat"))),
                expression=_blank(atom_text(record.first("expr"))),
                scheme=_scheme(atom_text(record.first("scheme"))),
                default_text=_blank(atom_text(record.first("defVal"))),
                reset_text=_blank(atom_text(record.first("rstVal"))),
                order=order,
            )
        )
    return found


def _declaration_text(model: Record) -> str | None:
    parts: list[str] = []
    for record in _records(model):
        if record.type_name != "SmLocalDecl" or atom_text(record.first("declType")) != "2":
            continue
        text = _ml(record.first("second"))
        if text:
            parts.append(text)
    return "\n".join(parts) if parts else None


def _concurrent_text(model: Record) -> str | None:
    parts: list[str] = []
    for record in _records(model):
        if record.type_name != "BiTextGroup":
            continue
        if _ml(record.first("first")) != "Concurrent Statements":
            continue
        text = _ml(record.first("second"))
        if text:
            parts.append(text)
    return "\n".join(parts) if parts else None


def _state_order(model: Record) -> list[int]:
    for record in _records(model):
        order = record.first("stateOrder")
        if not isinstance(order, Array):
            continue
        found = [item.target for item in order.items if isinstance(item, Ref)]
        if found:
            return found
    return []


def _suffix(model: Record) -> str | None:
    for record in _records(model):
        text = atom_text(record.first("clockSuffix"))
        if text:
            return text
    return None


def _one_int(model: Record, type_name: str, key: str) -> int | None:
    for record in _records(model):
        if record.type_name == type_name:
            value = _int(atom_text(record.first(key)))
            if value is not None:
                return value
    return None


def _placed_int(model: Record, type_name: str, key: str) -> int | None:
    for record in _records(model):
        if record.type_name == type_name and record.first("uid") is not None:
            return _int(atom_text(record.first(key)))
    return None


def _controls_agree(model: Record) -> bool:
    graphic = {
        "SmClockPoint": _placed_text(model, "SmClockPoint"),
        "SmResetPoint": _placed_text(model, "SmResetPoint"),
        "SmEnablePoint": _placed_text(model, "SmEnablePoint"),
    }
    table = {"clock": None, "reset": None, "enable": None}
    roles = {"1": "clock", "12": "reset", "15": "enable"}
    for record in _records(model):
        if record.type_name != "LeafLogPort":
            continue
        role = roles.get(atom_text(record.first("cat")) or "")
        if role is None:
            continue
        table[role] = _blank(atom_text(record.first("expr")))
    pairs = (
        (graphic["SmClockPoint"], table["clock"]),
        (graphic["SmResetPoint"], table["reset"]),
        (graphic["SmEnablePoint"], table["enable"]),
    )
    return all(left is None or right is None or left == right for left, right in pairs)


def _placed_text(model: Record, type_name: str) -> str | None:
    for record in _records(model):
        if record.type_name == type_name and record.first("uid") is not None:
            return _blank(_ml(record.first("cond")))
    return None


def _mode(value: str | None) -> FsmMode:
    if value is None:
        return "in"
    return {"1": "out", "4": "local"}.get(value, "unknown")  # type: ignore[return-value]


def _role(value: str | None) -> FsmRole:
    if value is None:
        return "data"
    return {"1": "clock", "12": "reset", "15": "enable"}.get(value, "unknown")  # type: ignore[return-value]


def _scheme(value: str | None) -> FsmScheme | None:
    if value is None:
        return None
    return {"0": "combinational", "1": "clocked"}.get(value)  # type: ignore[return-value]


def _ml(node: Node | None) -> str | None:
    if isinstance(node, Record):
        direct = atom_text(node.first("st"))
        if direct is not None:
            return direct
        return _ml(node.first("text")) or _ml(node.first("cond"))
    return atom_text(node)


def _blank(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    return value


def _int(value: str | None) -> int | None:
    if value is None or not value.lstrip("-").isdigit():
        return None
    return int(value)


def _records(model: Record):
    return (item for item in walk(model) if isinstance(item, Record))
