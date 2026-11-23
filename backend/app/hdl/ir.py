"""Language-neutral structural netlist.

Coordinates, wire polylines, and font size are not part of this model.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


TextRole = Literal["declarations", "statements"]
GenericKind = Literal["value", "type"]


@dataclass(frozen=True)
class IrGeneric:
    name: str
    kind: GenericKind
    type_text: str | None = None
    default_text: str | None = None


@dataclass(frozen=True)
class IrPort:
    name: str
    direction: str
    type_text: str
    range_text: str | None = None
    default_text: str | None = None


@dataclass(frozen=True)
class IrSignal:
    name: str
    type_text: str
    range_text: str | None = None


@dataclass(frozen=True)
class IrAssoc:
    formal: str
    actual: str


@dataclass(frozen=True)
class IrInstance:
    label: str
    library_name: str
    entity_name: str
    architecture_name: str | None
    generics: tuple[IrAssoc, ...]
    ports: tuple[IrAssoc, ...]


@dataclass(frozen=True)
class IrText:
    text: str
    role: TextRole


@dataclass(frozen=True)
class IrFsmBranch:
    condition: str | None
    target: str
    clocked_actions: tuple[str, ...]
    combinational_actions: tuple[str, ...]


@dataclass(frozen=True)
class IrFsmState:
    name: str
    clocked_during: tuple[str, ...]
    combinational_during: tuple[str, ...]
    branches: tuple[IrFsmBranch, ...]


@dataclass(frozen=True)
class IrFsmInterrupt:
    condition: str
    target: str


@dataclass(frozen=True)
class IrFsmSignal:
    name: str
    direction: str
    type_text: str
    range_text: str | None
    scheme: str | None
    default_text: str | None
    reset_text: str | None
    register_name: str | None


@dataclass(frozen=True)
class IrFsm:
    state_signal: str
    clock_name: str
    clock_expr: str
    reset_expr: str
    reset_state: str
    enable_expr: str | None
    recovery_state: str
    interrupts: tuple[IrFsmInterrupt, ...]
    states: tuple[IrFsmState, ...]
    signals: tuple[IrFsmSignal, ...]
    declarations: str | None
    concurrent: str | None
    packages: tuple[tuple[str, str], ...]


@dataclass(frozen=True)
class IrDesign:
    diagram_id: str
    entity_name: str
    architecture_name: str
    generics: tuple[IrGeneric, ...]
    ports: tuple[IrPort, ...]
    signals: tuple[IrSignal, ...]
    instances: tuple[IrInstance, ...]
    texts: tuple[IrText, ...]
    needs_std_logic: bool
    needs_numeric: bool
    fsm: IrFsm | None = None
