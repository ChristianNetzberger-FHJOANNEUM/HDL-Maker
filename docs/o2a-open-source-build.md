# O2a — Repeatable open-source build

O2a is in the Python backend. It repeats the O1 chain for VHDL-93 and does not call Vivado. The bitstream was not programmed, and the Vue window does not start this flow.

The paths live in `workspace/opensource-tools.json`. Saving GTKWave or Vivado in `workspace/tools.json` does not clear them. An empty path uses the executable name on `PATH` for that one tool. A path that is set and is not a file is an error. The process `PATH` is not changed. Yosys receives its `bin` and `lib` directories only in the child process, because those DLLs are required to start it.

## Stages

Each stage is `not_run`, `running`, `passed`, or `failed`. A failure leaves the later stages at `not_run`.

| Stage | Tool | Output |
| --- | --- | --- |
| `ghdl` | `ghdl --synth --std=93 --out=verilog` | `<top>.v`, UTF-8 without a BOM |
| `yosys` | `synth_xilinx -flatten -abc9 -arch xc7` | `<top>.json` |
| `nextpnr` | `nextpnr-xilinx --device <part> --freq <mhz>` | `<top>.fasm` and `nextpnr.log` |
| `fasm2frames` | `--db-root` is the family directory that contains the part | `<top>.frames` |
| `xc7frames2bit` | `--part_file` is that part's `part.yaml` | `<top>.bit` |

A synthesis target stops after Yosys. A bitstream target runs all five. VHDL-2008 is refused with `vhdl2008_not_validated` and the project's VHDL-93 setting is left as it is. That standard has not been run through this chain.

The Project X-Ray root is the configured directory, or `share/nextpnr/external/prjxray-db` beside `nextpnr-xilinx`. The family is the directory whose `mapping/parts.yaml` lists the requested part and whose `<part>/part.yaml` exists. For `xc7z020clg400-1` that directory is `zynq7`. A part that is absent is `part_unknown`. No other part is substituted.

`create_clock -period` supplies `--freq`. The value is `1000 / period` in MHz. A missing period is `clock_period_missing`. Two different periods are `clock_period_ambiguous`. Nothing is filled in from the board file. `create_clock -name` and `-waveform` are reported as `xdc_option_ignored` and the build continues, which is the same warning nextpnr prints for the Z7-20 XDC. The pin and I/O-standard checks from the Vivado flow still apply.

The build directory is `workspace/builds/osb_<id>/`. `manifest.json` and `report.json` hold the input hashes, tool versions, command lines, stage times, logs' parsed counts, and the bitstream length. The Vivado build list and the Vivado programming request skip a report whose toolchain is `opensource`.

The endpoints are `GET` and `PUT /api/fpga/opensource/tools`, `POST /api/fpga/opensource/check`, and `POST` and `GET /api/fpga/opensource/builds`. The FPGA Build tab calls them when the project toolchain is Open Source.

## Zybo Z7-20 counter

Build `osb_574eb1ad8c3b4ac8a36b359745d3534d` used `examples/fpga/zybo-z7-10-counter/zybo_counter.vhd`, `examples/fpga/zybo-z7-20-counter/zybo_counter.xdc`, and part `xc7z020clg400-1`. The tools were GHDL 6.0.0, Yosys 0.70+329 (`b8d84f823`), nextpnr-xilinx `42d06c5f`, and fasm 0.0.2.post66. The database was the `zynq7` directory inside the openXC7 tree from O1. A copy of that build is `workspace/builds/o2a-zybo-counter/`.

The parsed nextpnr log matches the O1 log for this counter:

| Report field | O1 log | O2a log |
| --- | --- | --- |
| `SLICE_LUTX` | 56 | 56 |
| `SLICE_FFX` | 27 | 27 |
| `CARRY4` | 7 | 7 |
| Critical path | 2.68 ns | 2.68 ns |
| Logic / routing | 2.00 ns / 0.69 ns | 2.00 ns / 0.69 ns |
| Max frequency | 372.58 MHz | 372.58 MHz |
| XDC warnings | `-name`, `-waveform` | `-name`, `-waveform` |

Yosys counted 27 `FDRE`, 7 `CARRY4`, 1 `INV`, 1 `BUFG`, 1 `IBUF`, and 1 `OBUF`. The bitstream is 4,045,674 bytes, the same length as the O1 file. The SHA-256 values differ. The header of each file contains its own generation time, so equal length is not the same bitstream. Neither open-source file has been programmed.

Stage times for this run were GHDL 0.143 s, Yosys 4.024 s, nextpnr 5.363 s, fasm2frames 2.030 s, and xc7frames2bit 0.152 s. The sum is 11.712 s. O1's manual shells were about 21 s. These are two measurements of one small counter, not a general speed comparison.

## O2b

O2b.3 has loaded that bitstream into SRAM through the D2XX build of openFPGALoader. The load exited 0. The DONE LED was green and LED0 blinked about once per second. O3a can start the same builder from the FPGA Build tab. O2a does not hand the file to the Vivado programmer. The record is [o2b-open-source-hardware.md](o2b-open-source-hardware.md).
