# M5a Vivado batch

M5a runs AMD Vivado in non-project mode. It can synthesize a VHDL design, or implement that design and write a bitstream. It does not program the FPGA, start Vitis, configure the Zynq processing system, or build a block design.

The flow follows Vivado 2019.1 non-project use as described in UG892: read the sources, synthesize, optionally place and route, then write a bitstream.

## Prerequisite

Vivado is an optional local install. HDL-Maker does not download it and does not change the global `PATH`.

On this machine the executable is `C:\Xilinx\Vivado\2019.1\bin\vivado.bat`. `vivado.bat -version` reports Vivado v2019.1 (64-bit), SW Build 2552052. The part used for the reference run is `xc7z010clg400-1`, read from `boardfiles/zybo-z7-10/A.0/board.xml`. That part is not hardcoded in the builder. Another board file that names a different part can be selected, and the build uses the part the user chooses from that file.

`workspace/tools.json` stores `vivado_path` next to `gtkwave_path`. Preferences edits one path without dropping the other. An empty Vivado path uses `vivado.bat` or `vivado` on `PATH`. A path that is not a file is `invalid_vivado_path` and is not replaced with a different install. Check Vivado runs the configured executable with `-nolog -nojournal -version`, so the probe does not write a journal into the source tree.

## What the project stores

`project.json` keeps one optional `fpga` object:

- `top_unit_id` — the VHDL entity to synthesize. It is not the simulation testbench and not the hierarchy root.
- `board_id` — a `board.xml` path from the board catalog.
- `part` — one of the part names in that file. An empty part is `part_missing`. A part the file does not name is `part_conflict`. Neither case is filled in.
- `xdc_paths` — external constraint files.
- `target` — `synthesis` or `bitstream`.

`vhdl_standard` and `library_profile` stay the existing project fields and are copied into the build snapshot. The studio board choice in `ui.json` is not written by the FPGA settings.

## Constraints

Board files are not XDC files. Before Vivado starts, HDL-Maker checks the selected XDC files:

- each file exists
- every `get_ports` name is a port of the top-level entity
- every top-level port has `PACKAGE_PIN` or `LOC`
- every pinned port has `IOSTANDARD`
- a top-level port that the top architecture uses with `rising_edge`, `falling_edge`, or `'event` has a `create_clock`

A failure is a diagnostic and the run does not start. No pin, I/O standard, or clock period is invented.

## Tcl

The script is written into the build directory. For VHDL-93 it does not pass `-vhdl2008`. For VHDL-2008 it passes `read_vhdl -vhdl2008` only when the reported Vivado version is 2017.4 or newer. On this 2019.1 install, `help read_vhdl` lists `-vhdl2008` and describes it as marking the file as VHDL 2008. That flag is not the whole VHDL-2008 language. A project set to VHDL-93 is not switched to VHDL-2008.

The Synopsys library profile is recorded as a comment. Package clauses stay in the VHDL. `-fsynopsys` and `-fexplicit` are GHDL flags and are not passed to Vivado.

The script then checks that `get_parts` knows the selected part, reads the VHDL and XDC files, and runs:

```
synth_design -top <top> -part <part>
report_utilization
report_timing_summary
write_checkpoint
```

A bitstream target also runs `opt_design`, `place_design`, `route_design`, the implementation reports, `report_drc`, and `write_bitstream`. Marker lines `HDL-MAKER-STAGE <stage>-start` and `<stage>-done` set the stage state.

## Execution

The API returns while the build continues. One build runs at a time. Cancel stops the process tree. Synthesis is allowed 1200 seconds and a bitstream run 2700 seconds.

On Windows, `vivado.bat` is started through `cmd.exe /d /c` with an argument list and `shell=False`, because CreateProcess does not run a batch file by itself. The arguments are still the batch path, `-mode batch`, `-notrace`, `-source`, `-log`, and `-journal`.

Each build is `workspace/builds/<build-id>/` and contains `config.json`, `manifest.json`, `build.tcl`, `console.log`, `vivado.log`, the reports, and `bitstream.bit` when that target succeeds. An earlier directory is not overwritten. A synthesis success leaves optimization, placement, routing, and bitstream at `not_run`, and `bitstream_path` is null.

## Reference run

`examples/fpga/zybo-z7-10-counter` is a 27-bit counter with ports `clk` and `led`. The XDC uses only values stated by the Zybo Z7-10 board files:

- `sys_clk` is package pin K17, I/O standard LVCMOS33
- the board file sets the clock frequency to 125000000, which is a period of 8.000 ns
- `leds_4bits_tri_o_0` is package pin M14, I/O standard LVCMOS33

The XDC does not set a duty-cycle waveform. Vivado's timing report shows the default waveform `{0.000 4.000}` for that period.

Vivado v2019.1, part `xc7z010clg400-1`:

| Run | Result | Time |
| --- | --- | --- |
| Synthesis | passed, bitstream stage `not_run` | about 35 s |
| Implementation and bitstream | passed | about 111 s |

Synthesis utilization: 1 LUT, 27 flip-flops, device `7z010clg400-1`. Setup slack 4.995 ns, hold slack 0.131 ns, no failing endpoints. The synthesis log has no `WARNING` or `ERROR` line.

After routing: 1 LUT, 27 flip-flops, 7 slices, 2 bonded IOBs, 1 BUFG. Setup slack 5.316 ns, hold slack 0.094 ns, pulse-width slack 3.500 ns. All user timing constraints are met. `bitstream.bit` is 2,083,848 bytes.

The bitstream log has two warnings and no errors:

- `WARNING: [Place 46-29] place_design is not in timing mode. Skip physical synthesis in placer`
- `WARNING: [DRC ZPS7-1] PS7 block required: The PS7 cell must be used in this Zynq design in order to enable correct default configuration.`

ZPS7-1 is a warning, not an error. The design is PL-only. M5a does not add a PS7 cell, a block design, or a Vitis project to clear it. The bitstream was still written.

Copies of the two build directories are under `workspace/builds/m5a-zybo-counter-synthesis` and `workspace/builds/m5a-zybo-counter-bitstream`. Those directories are gitignored.

## Limits

- VHDL-2008 support is the `read_vhdl -vhdl2008` switch. Constructs this Vivado version rejects still fail during synthesis, and the project standard is not changed to hide that.
- A Zynq part can warn that PS7 is absent. Programming that bitstream, and any PS configuration, is outside M5a.
- JTAG, ILA, timing summaries inside the studio beyond opening the report files, and other FPGA vendors are not part of this step.
