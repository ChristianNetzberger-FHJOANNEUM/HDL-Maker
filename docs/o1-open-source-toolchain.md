# O1 — Open-source FPGA toolchain on Windows 11

O1 is investigated. A bitstream for the existing `zybo_counter` was written for `xc7z020clg400-1` without Vivado. That bitstream was not programmed, and the flow is not in the HDL-Maker interface.

The comparison baseline stays the Vivado 2019.1 build `bld_34d0198b02b84f73b25a8aa305579d5a` and the hardware run `prg_c96275d4116948768d5c9c8079532cc8` on the Zybo Z7-20. Those files were not rebuilt. `examples/fpga/zybo-z7-10-counter` was not modified. The tools were extracted under `workspace/toolchains/o1/`, which is gitignored. The installed Vivado tree and the installed GHDL were not changed.

## What the Windows packages contain

Two archives were used. Nightly tags after 2026-11-19 were left unused. Apio was not installed.

| Tool | Version used | Source | License read for this run | Download | Installed size | Role on Windows |
| --- | --- | --- | --- | --- | --- | --- |
| openXC7 toolchain | tag `2026-11-19`, Windows amd64 | `cavearr/toolchain-openxc7-releases` | See the component rows below. The tarball itself has no `LICENSE` file. | 123,599,073 bytes. SHA256 `ec52f5104fa5ce78cf5b1805aa8582a48547cf82cf1caf2d06da82b9d4483ba9`, matching the published `SHA256SUMS`. | 1,255,448,234 bytes | Place and route, FASM, frames, bitstream, and the 7-series database. No Yosys and no GHDL. |
| nextpnr-xilinx | `42d06c5f` (`YosysHQ/nextpnr`, 2026-11-19) | Inside the openXC7 tarball | `COPYING` at that revision: permissive grant, copyright 2018–2020 Claire Xenia Wolf, gatecat, Dan Gisselquist, Serge Bazanski, Miodrag Milanovic, Eddie Hung | Included above | Included above | `--device xc7z020clg400-1` is accepted. Options used: `--json`, `--top`, `--freq`, `-o xdc=`, `-o fasm=`. |
| Project X-Ray tools | `db4f31e9` | `f4pga/prjxray` at that revision | `LICENSE` at that revision: permissive grant, copyright 2017–2020 The Project X-Ray Authors | Included above | Included above | `xc7frames2bit.exe` writes the `.bit` file. |
| prjxray-db | `0c3504f2` | `f4pga/prjxray-db` at that revision | `LICENSE` at that revision: CC0 1.0 | Included above | Included above | `zynq7/xc7z020clg400-1` exists. `part.yaml` records idcode `0x3727093`. |
| fasm | `0.0.2.post66`, revision `2f57ccb1` | `chipsalliance/fasm`, bundled for Python 3.12 | Apache-2.0, from the package `LICENSE` | Included above | Included above | `fasm2frames.cmd` calls the bundled Python. |
| Eigen | 3.4.0, named in `BUILD-INFO` | Build dependency of nextpnr | No Eigen license file in the Windows package | Included above | Included above | Not invoked directly. |
| OSS CAD Suite | tag `2026-11-04`, Windows x64 | `YosysHQ/oss-cad-suite-build` | The suite bundles many licenses. The ones used here are below. The archive checksum was not recomputed. | 604,163,135 bytes | 2,138,921,674 bytes | Yosys and openFPGALoader. Its `nextpnr` is revision `64c09988` and is the generic YosysHQ nextpnr, not nextpnr-xilinx. It was not used. |
| Yosys | 0.70+329, git `b8d84f823` | Inside OSS CAD Suite | ISC, copyright 2012–2026 Claire Xenia Wolf, plus the licenses of the bundled libraries named in `LICENSE.yosys` | Included above | Included above | `synth_xilinx -arch xc7` |
| openFPGALoader | v1.2.0, git `e3d8d947` | Inside OSS CAD Suite | Apache-2.0 | Included above | Included above | Present. Not run. |
| GHDL | 6.0.0 Dunoon, mcode, GNAT 15.2.0 | The existing WinGet install | `ghdl --version` says the GNU General Public License | Not downloaded for O1 | Not remeasured | `ghdl --synth --std=93 --out=verilog` |
| Vivado | v2019.1, SW Build 2552052 | `C:\Xilinx\Vivado\2019.1` | Unchanged. Redistribution remains unresolved. | Not measured | 19,808,638,819 bytes | Reference only. Not called during the open-source run. |
| Apio | Not installed | `FPGAwars/apio` redistributes openXC7 archives | Not read, because it was not installed | — | — | Not required for this run. |

The openXC7 installer README names the Nix toolchain as the recommended full set and says that set includes the GHDL plugin in Yosys. The Windows OSS CAD Suite used here has `yosys.exe` and the plugins `eqy_combine.so`, `eqy_partition.so`, `eqy_recode.so`, and `slang.so`. It has no `ghdl.exe` and no GHDL plugin. A Windows nextpnr and bitstream package therefore does not synthesize VHDL by itself.

Yosys and openFPGALoader exit `0xC0000135` unless that process has both `oss-cad-suite\bin` and `oss-cad-suite\lib` on `PATH`. `environment.bat` sets this for one shell. The user `PATH`, the GHDL install, and the Vivado install were left unchanged.

## VHDL synthesis

The source was `examples/fpga/zybo-z7-10-counter/zybo_counter.vhd`, VHDL-93, entity `zybo_counter`. VHDL-2008 was not run.

```text
ghdl --synth --std=93 --out=verilog zybo_counter.vhd -e zybo_counter
```

`ghdl --synth` has no `-o` option. The Verilog has to be taken from stdout. A PowerShell `>` redirection wrote UTF-16, and Yosys then stopped at line 1 with `syntax error, unexpected invalid token`. The same GHDL text, saved as UTF-8 without a BOM, was accepted. That encoding step is part of a Windows student setup. It is not a change to the VHDL.

Yosys then ran:

```text
read_verilog zybo_counter.v
synth_xilinx -flatten -abc9 -arch xc7 -top zybo_counter -json zybo_counter.json
```

Exit code 0 in 6.17 s. The statistics before packing are 27 `FDRE`, 7 `CARRY4`, 1 `INV`, 1 `BUFG`, 1 `IBUF`, and 1 `OBUF`. Yosys estimates 0 logic cells because the increment sits in the carry chain.

This is the existing GHDL mcode compiler emitting Verilog. It is not the GHDL Yosys plugin.

## Constraints

`examples/fpga/zybo-z7-20-counter/zybo_counter.xdc` was passed to nextpnr unchanged with `-o xdc=`.

| XDC text | Result |
| --- | --- |
| `PACKAGE_PIN K17` on `clk` | Applied. The FASM uses `RIOB33_X73Y125`, which `package_pins.csv` lists as K17. |
| `PACKAGE_PIN M14` on `led` | Applied. The FASM uses `RIOB33_X73Y103`, which that file lists as M14. |
| `IOSTANDARD LVCMOS33` on both ports | Applied. K17 is an input in the LVCMOS33 group. M14 is an output in the LVCMOS33 group. |
| `create_clock -period 8.000` | Applied as 125.0 MHz. `--freq 125` was also passed and names the same period. |
| `-name sys_clk` and `-waveform {0 4}` | Ignored, with two warnings. |

nextpnr also wrote `PULLTYPE.NONE` on both pins and, on M14, `DRIVE.I12_I16` and `SLEW.SLOW`. Those values are not in the XDC. No second constraint file was required for this counter.

`fasm2frames` looks for `mapping/devices.yaml` under `--db-root`. That file is in the `zynq7` directory, not in the top of `prjxray-db`. The first call used the top directory and failed. The second call used the `zynq7` directory and wrote the frames.

## Place, route, and bitstream

```text
nextpnr-xilinx --device xc7z020clg400-1 --json zybo_counter.json --top zybo_counter --freq 125 -o xdc=zybo_counter.xdc -o fasm=zybo_counter.fasm
fasm2frames --db-root <prjxray-db>/zynq7 --part xc7z020clg400-1 zybo_counter.fasm zybo_counter.frames
xc7frames2bit --part_file <zynq7>/xc7z020clg400-1/part.yaml --part_name xc7z020clg400-1 --frm_file zybo_counter.frames --output_file zybo_counter.bit
```

nextpnr finished in 4.94 s with 2 warnings and 0 errors. `fasm2frames` finished in 1.77 s. `xc7frames2bit` finished in 1.33 s. The `.bit` file is 4,045,674 bytes. It was not programmed. openFPGALoader was not started.

nextpnr reports `PS7` as 0 of 1. This counter stays PL-only, as the Vivado build did. The Vivado log still contains DRC `ZPS7-1` for that choice. The open-source log does not emit that DRC code, and it also does not insert a PS7 cell.

nextpnr prints `clock-tree: no clock delays measured for xc7z020, global clocks keep their routed delay`. The post-route critical path is 2.68 ns, of which 2.00 ns is logic and 0.69 ns is routing, including 0.10 ns setup. The clock is reported at 372.58 MHz and passes the requested 125 MHz. The slack histogram starts at 5,316 ps. Hold slack is not reported. These numbers use the same 8.000 ns period as the XDC, and they do not use the same timing model as Vivado.

After packing, nextpnr counts 56 `SLICE_LUTX`, created from 56 `LUT1`, plus 27 `SLICE_FFX`, 7 `CARRY4`, 1 `BUFGCTRL`, and 2 pads. The 56 LUT1 cells are the split carry inputs. They are not 56 independent logic LUTs in the Vivado report sense. Yosys, before that split, counted 7 `CARRY4`, 27 `FDRE`, and 1 `INV`.

## Comparison with Vivado 2019.1

Vivado session start `Mon Nov 23 11:31:23 2026`, exit `11:33:24 2026`, so 121 s of wall time. `synth_design` elapsed 25 s, `route_design` elapsed 37 s, and `write_bitstream` elapsed 44 s. Open-source memory was not measured. Vivado's peak in that log is 2,016 MB during `write_bitstream`.

| Criterion | Vivado 2019.1 | Open source |
| --- | --- | --- |
| Synthesis | Passed. `synth_design` elapsed 25 s. | Passed. GHDL Verilog export and the UTF-8 write, 6.5 s in one shell. Yosys 6.17 s. |
| Place and route | Passed. `route_design` elapsed 37 s. | Passed. nextpnr-xilinx 4.94 s. Two XDC warnings. |
| Bitstream | 4,045,672 bytes. `write_bitstream` elapsed 44 s. Programmed and observed on the Z7-20. | 4,045,674 bytes. Frames plus bitgen 3.10 s. Not programmed. |
| LUTs | 1 `LUT1`, and 7 `CARRY4` | Yosys: 1 `INV`, 7 `CARRY4`. nextpnr after the carry split: 56 `SLICE_LUTX`. |
| Registers | 27 `FDRE` | 27 `FDRE` / `SLICE_FFX` |
| Slices | 7 | Not reported as a slice count. 7 `CARRY4`. |
| Other cells | 1 `BUFG`, 1 `IBUF`, 1 `OBUF`, 2 bonded IOBs | 1 `BUFGCTRL`, 2 pads |
| Setup slack | WNS 5.520 ns | 5.32 ns from the 8.000 ns period minus the 2.68 ns critical path. Clock-tree delays for `xc7z020` were not measured. |
| Hold slack | WHS 0.040 ns | Not reported |
| Whole build | 121 s wall time, including reports and license checkout | About 21 s for the successful stages above, excluding downloads |
| Toolchain size | 19,808,638,819 bytes installed | 123,599,073 + 604,163,135 bytes downloaded. 1,255,448,234 + 2,138,921,674 bytes extracted. |

The two bitstream lengths differ by 2 bytes. A 7-series bitstream for this part is mostly a fixed frame image, so a similar length does not show that the configuration matches. The files were not compared bit for bit, and the open-source file was not loaded onto the FPGA.

## Limits recorded for this counter

- The Windows archives do not contain the GHDL Yosys plugin. VHDL entered through `ghdl --synth --out=verilog` and had to be UTF-8.
- VHDL-2008, other entities, and vendor packages were not run.
- `-name` and `-waveform` are ignored. Pin, I/O standard, and period were honored for this file.
- nextpnr adds output drive and slew that the XDC does not state.
- Hold timing and `xc7z020` clock-tree delays are absent from the report.
- No PS7 cell is inserted. The same PL-only counter produced Vivado warning `ZPS7-1`.
- `fasm2frames` needs the family database directory as `--db-root`.
- openFPGALoader can see the cable only after a later, separate approval. It was not used.

## Recommendation for O2

O2a now runs this chain from the backend. The record is [o2a-open-source-build.md](o2a-open-source-build.md). O2b, the first programming of that bitstream, is not started.

The runner keeps five steps visible: GHDL 6.0.0 `--std=93 --out=verilog`, UTF-8 without a BOM, Yosys `synth_xilinx -arch xc7`, nextpnr-xilinx for `xc7z020clg400-1` with the existing Z7-20 XDC, then `fasm2frames` against the `zynq7` database and `xc7frames2bit`. It must not call Vivado when one of those steps fails. It must not copy the first JTAG device, and it must not start openFPGALoader.

A student package should not swallow the GHDL step. The Windows Yosys bundle does not provide it, and the openXC7 installer names that plugin for the Nix toolchain. Shipping the whole OSS CAD Suite in the student ZIP is a later O4 decision: the suite contains many tools that this counter does not use, and GHDL remains GPL.

Programming the 4,045,674-byte bitstream is O2b. It needs its own approval. Before that approval, the open points are the missing PS7, the unmeasured clock-tree delay, the missing hold report, and the fact that the file has not been shown to match the Vivado bitstream that already blinks LED0.
