# M3b limitations

M3b generates VHDL for an editable state diagram. The project setting `vhdl_standard` selects VHDL-93 or VHDL-2008. Both backends use one FSM netlist. Text-box positions, spline points, and zoom are not read.

A copy imported before this step has no interface table. Generation stops until the diagram is copied from the import again. The original `.sm` file is not written.

## What the three machines store

`morse_transmitter`, `audio_fifo_ctrl`, and `speed_trap` were compared with their HDL Designer `*_fsm.vhd` files.

- The clock expression, reset expression, and enable expression are stored on the interface row. On these machines the diagram text matches that row. Reset mode `0` is the synchronous test inside the clock condition. Enable `beforeResets` `0` places the enable after reset.
- Encoding scheme `3` is an enumeration. No per-state bit code is stored. The enum order is the stored `stateOrder`, not the position on the canvas.
- The current-state signal name is stored. The names `state_type` and `next_state` are generator names because the file does not name them.
- A blank transition priority means the file order of the conditions. A blank condition is the default else. When no default transition is stored, the state holds. That is the behavior in the original next-state processes.
- Entry and exit actions are empty on these machines. The state text that HDL Designer put in the clocked or output process is the during text. Transition actions are stored on the transition, and clocked outputs are already written with the stored suffix, such as `fifo_rd_cld`.
- Scheme `1` is clocked and scheme `0` is combinational. A during text that assigns both is split by that scheme. `audio_fifo_ctrl` puts `cnt` in the clocked process and `fifo2_rd_tx` in the output process. `speed_trap` does the same with `us_cnt` and `timer_reset`.
- An interrupt is a separate arc. `audio_fifo_ctrl` uses `fifo2_reset = '1'` to `s_reset`. `speed_trap` uses `speed_trap_en = '0'` to `s_wait`. The original processes suppress the state actions and choose that next state. These arcs have no action text.
- The recovery arc is the `when others` target. On these machines it is `s_reset`.
- Architecture declarations, concurrent statements, generics, and package clauses are copied as stored. That includes `ieee.std_logic_arith`, `ieee.std_logic_unsigned`, and `work.utilities`.

## What is generated

For a machine whose controls match the list above:

- entity ports and generics from the interface table, in the stored order
- the copied declarations, then one register for each clocked output
- the state enumeration, the current-state signal, and `next_state`
- a clocked process with the stored clock expression, synchronous reset, reset values, the optional enable, clocked defaults, and clocked actions
- a combinational next-state process; conditional transitions keep their order, and an explicit priority number is used when every condition on that state has a unique number, smallest first
- an output process only when a combinational signal has a default or an action
- an interrupt test around the next state and around the actions when an interrupt arc is stored
- concurrent assignments from each clocked output to its register, then the copied concurrent text

VHDL-93 and VHDL-2008 receive the same processes. `process(all)` and `??` in a stored text stop VHDL-93 generation. They are not rewritten.

## GHDL 6.0.0

Analysis and elaboration stay separate, with one work directory per standard. The default project profile is `ieee`. It passes `--std` and no `-fsynopsys`.

A machine whose only package is `ieee.std_logic_1164` is analyzed and elaborated for `--std=93` and `--std=08`.

The three imported machines keep `ieee.std_logic_arith` and `ieee.std_logic_unsigned`. Under the default profile, GHDL analysis stops at that clause and names the file and line. The clause is not replaced with `numeric_std`, and elaboration does not start. The optional profile that passes `-fsynopsys` and `-fexplicit` is M3c, not a silent change to this default.

The combinational output process lists signals that are read. A name that is only assigned, including an `out` port, is not put in that sensitivity list. GHDL 6.0.0 with `--std=93` rejects an `out` port there. VHDL-2008 accepts the read, but the original HDL Designer process does not list those ports either.

## Equivalence

The generated text was checked against the original files for state order, transition conditions and targets, priority order, reset state, reset values, interrupt targets, the enable expression, and the split of clocked and combinational actions.

M3b did not simulate the machines. The first cycle-accurate comparison is `morse_transmitter` in M3c. `audio_fifo_ctrl` and `speed_trap` are analyzed and elaborated there and are not yet compared cycle by cycle. A passed elaboration is not that comparison. See `docs/m3c-validation.md`.

## Not generated

Generation stops, and no file is written, when any of these is present:

- a missing clock expression, reset expression, or current-state name
- a clock, reset, or enable text that disagrees with the interface table
- an encoding other than the enumeration, an asynchronous reset, or a clocked next state
- an enable stored ahead of reset
- entry or exit actions
- an interrupt with actions, or a reset or recovery arc whose actions are not empty or `< Automatic >`
- two default transitions, a repeated priority, or a priority on only some conditions
- an assignment whose target is not a stored signal
- one statement that assigns both a clocked and a combinational signal
- `case`, `loop`, `wait`, or a similar action form

Unsupported constructs on one machine do not change the text of another design. The run writes nothing when any selected design reports an error.

## Not in this milestone

- the simulation UI and waveform viewer (M4). The M3c runner is a separate backend check, not that UI.
- Vivado synthesis (M5)
- new tools for drawing states or transitions
- SystemVerilog
- a new portable ZIP
