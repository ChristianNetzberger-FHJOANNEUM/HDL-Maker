# M3c validation

M3c checks the FSMs generated in M3b against GHDL without rewriting their VHDL. It is not the M4 simulation UI and it does not run Vivado.

## Two settings

| Setting | Values | Effect |
| --- | --- | --- |
| `vhdl_standard` | `93` or `2008` | Selects the generated syntax and GHDL `--std=93` or `--std=08`. |
| `library_profile` | `ieee` or `synopsys` | Selects the GHDL library flags. The default is `ieee`. |

The profile is stored on the project, next to the language standard. A project file that has no field loads as `ieee`. Preferences edits it. `ui.json` does not. The two settings can be combined: VHDL-2008 with the Synopsys profile passes both `--std=08` and the legacy flags.

`ieee` passes only the standard flag. `synopsys` also passes `-fsynopsys` and `-fexplicit` on every `ghdl -a`, `ghdl -e`, and `ghdl -r` for that run. The same profile is used for the package, the architecture, and the testbench.

`-fsynopsys` makes GHDL 6.0.0 provide `ieee.std_logic_arith` and `ieee.std_logic_unsigned`. Those packages are not part of the IEEE standard set. With only that flag, GHDL 6.0.0 still stops on the original `morse_transmitter` at the comparison `morse_ticker = morse_speed` (`morse_transmitter_fsm.vhd:262:44`) because `=` is declared both by `std_logic_1164` and by `std_logic_unsigned`. The diagnostic names `-fexplicit`. That flag gives the explicitly declared operator priority. It is part of the legacy profile because the reference files do not analyze without it. It is not passed by the default `ieee` profile, and it is not a reason to edit the expression.

The generated text is the same under both profiles. `use ieee.std_logic_arith` and `use ieee.std_logic_unsigned` stay. They are not replaced with `numeric_std`.

## External files

The runner reads these files and does not write them:

- `libs/sbus_rtc_lib/hdl/utilities_pkg.vhd`
- `libs/sbus_rtc_lib/hdl/utilities_pkg_body.vhd`
- `libs/sbus_rtc_lib/hdl/morse_transmitter_fsm.vhd`
- `libs/sbus_rtc_lib/hdl/audio_fifo_ctrl_fsm.vhd`
- `libs/sbus_rtc_lib/hdl/speed_trap_fsm.vhd`
- `libs/sbus_rtc_lib/hds/<machine>/fsm.sm`

`utilities` is analyzed before the architecture: the package, then the package body, then the FSM. A missing file produces `missing_dependency`. Analysis, elaboration, simulation, and the functional comparison stay `not_run`. No package is invented.

GHDL 6.0.0 mcode is the compiler (`ghdl.ghdl.ucrt64.mcode` on `PATH`). Each machine, each source, and each standard has its own `--workdir` under `workspace/validation/m3c/`. The original and the generated entity have the same name, so they are never analyzed into one library.

## Result levels

`workspace/validation/m3c/report.json` keeps these apart:

1. `vhdl_generated` — the generator wrote a file.
2. `ghdl_analysis` — `ghdl -a` returned success.
3. `ghdl_elaboration` — `ghdl -e` returned success. This is not a functional comparison.
4. `simulation` — `ghdl -r` ran the testbench.
5. `functional_comparison` — the output change logs are identical and the stimulus reached the checks below.

An analysis failure leaves elaboration, simulation, and the comparison at `not_run`.

## Reference machines

With `library_profile` `synopsys`, GHDL 6.0.0 analyzed and elaborated the original file and the generated file of each machine for `--std=93` and `--std=08`:

- `morse_transmitter`
- `audio_fifo_ctrl`
- `speed_trap`

The generated combinational process lists signals that are read. `fifo2_rd_tx`, `fifo2_we_rx`, and `timer_reset` are only assigned, so they are not sensitivity inputs. `--std=93` rejects an `out` port in a sensitivity list; the original HDL Designer processes do not list them either.

`audio_fifo_ctrl` and `speed_trap` were not simulated. Their enable and interrupt behavior is therefore elaborated, not shown to match the original cycle by cycle.

## morse_transmitter comparison

The testbench is written into each simulation work directory. It is VHDL that GHDL accepts for both `--std=93` and `--std=08`. It drives both architectures with the same open-loop sequence: reset, a held speed command long enough for the reset speed of 150 ms ticks, a zero speed operand, an FCW of 100, a zero FCW operand, an unknown opcode, one window with `fifo_size = 0`, a break, three Morse operands (`0001`, `8000`, and `C000`), and reset again. The word stays on `fifo_data` for the whole window, so a machine that returns to `s_wait` fetches it again on the next tick. The testbench does not change the next input when `fifo_rd` pulses.

`current_state` is not a port. The comparison watches `fifo_rd`, `morse_code`, and `morse_fcw`. After each rising edge the bench appends a line only when one of those values changes. The original log is the expected side. A difference records the cycle, the signal name, the expected value, and the actual value.

The stimulus is accepted only when the original log shows at least four `fifo_rd` pulses, the reset `morse_fcw` value 2400, the programmed value 100, and two different low runs of `morse_code`. A log that matches only because a tick was missed is `stimulus_incomplete`, not a pass.

The VHDL-93 run compared 19,300,012 cycles. The logs were identical. The original log showed 19 `fifo_rd` pulses, `morse_fcw` changing from 2400 to 100 and back to 2400 on the final reset, a gap in `fifo_rd` while the FIFO was empty, and `morse_code` low for 99,998 cycles and later for 299,998 cycles. No difference was recorded. The VHDL-2008 files were analyzed and elaborated, not simulated for this comparison.

GHDL printed assertion notes from `std_logic_arith` at time 0 because some operands are still `'U'` before the first reset edge. Both runs returned success. Those notes are not a functional difference.

This is one stimulus, not a proof for every input, and it says nothing about Mentor versus GHDL package differences beyond the values this stimulus produced. Both sides were compiled with the same GHDL and the same flags, so they saw the same `conv_std_logic_vector`.

## What was not done

- M4 studio simulation, cancellation, and a VCD view
- a cycle-accurate comparison of `audio_fifo_ctrl` or `speed_trap`
- M5 Vivado or the Zybo board
- new FSM drawing tools
- a rewrite onto `numeric_std`
- a new portable ZIP
