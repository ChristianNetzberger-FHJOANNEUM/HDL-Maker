# M2c limitations

M2c imports placed states and transitions from the 14 HDL Designer `.sm` files and stores an editable copy under `workspace/diagrams/`. The original `.sm` file is not written.

## What is kept

A state with a `uid` keeps its name, circle extent, entry actions, during actions, exit actions, encoding, and wait text when the file contains that text. A transition with a `uid` keeps its spline points, condition, action text, and priority. A `Link` is bound to the single placed state whose name it repeats. Across `libs/sbus_rtc_lib` that is 126 states and 189 transitions.

## What is reported and not invented

- A `State` or `Transition` without a `uid` is a palette prototype. The diagnostic is `state_prototype_not_placed` or `transition_prototype_not_placed`. It is not drawn.
- A transition end that is `SmResetPoint`, `SmRecoveryStatePoint`, or `InterruptPoint` stays an anchor (`transition_anchor`). The editor does not turn it into a state.
- An empty action, encoding, or condition stays empty.
- If `cond` and the condition text differ, the `cond` atom is the stored condition and `transition_condition_differs` quotes the other text.

## Editing

The copy can move a state. Transition points that name that state move with it. An anchor end stays where it was imported. Names, conditions, actions, and priority can be edited. The editor does not add a new state or transition, and it does not generate VHDL. Schema version stays 1. A block diagram saved before M2c still loads.

Readable text boxes for state actions and transition conditions and actions are M2d (`docs/m2d-limitations.md`). VHDL for the machine is M3b (`docs/m3b-limitations.md`).
