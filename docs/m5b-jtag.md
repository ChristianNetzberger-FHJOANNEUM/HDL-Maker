# M5b JTAG programming

M5b programs a finished bitstream through the Vivado 2019.1 Hardware Manager. The download is volatile: it is lost when the board powers off. Flash, boot images, Vitis, and the Zynq processing system are not part of this step.

The Zybo Z7-10 was not the board used for the download. The software path is implemented and tested. On 2026-11-23 a Zybo Z7-20, part `xc7z020`, was programmed with the `xc7z020clg400-1` bitstream. Vivado reported end of startup HIGH, and the DONE pin read back as 1. At the board, LED0 blinked about once per second and the DONE LED was green.

## Commands in Vivado 2019.1

`help` after `load_features labtools` shows these commands: `open_hw`, `connect_hw_server`, `get_hw_targets`, `get_hw_devices`, `open_hw_target`, `current_hw_device`, `program_hw_devices`, `close_hw`, and `disconnect_hw_server`.

`open_hw_manager` is not a command in this install (`Common 17-25`). The scripts use `open_hw`.

`connect_hw_server` defaults to `localhost:3121` and launches `hw_server` when it is not already running. `get_hw_devices` can be filtered with `NAME` and `PART`. `program_hw_devices` takes the device object and reads `PROGRAM.FILE`. The file type used here is `-type bit`.

With no cable attached, this machine reported:

```text
INFO: [Labtools 27-2285] Connecting to hw_server url TCP:localhost:3121
INFO: [Labtools 27-2222] Launching hw_server...
ERROR: [Labtoolstcl 44-199] No matching targets found on connected servers: localhost
```

`get_hw_targets` without `-quiet` stops the Tcl script on that error. The scan uses `get_hw_targets -quiet` and, when the list is empty, records `HDL-MAKER-NO-HARDWARE`. No device is invented.

## What the user has to do

Scan and Program are separate actions. Opening the FPGA Build tab does not scan and does not program.

The scan lists every device it finds, including a DAP that is not the FPGA. The device menu starts at "Choose a device". The first device is not selected. Programming stays disabled until one device is selected and the confirmation names that device and its target.

The request is rejected when:

- no scan exists, or the scan found no target
- the build is not a finished bitstream
- the bitstream file is missing
- confirmation is false
- no device was named
- the selected device's part does not match the bitstream part
- more than one device matches and none was named

A JTAG part of `xc7z010` matches a bitstream part of `xc7z010clg400-1`. `arm_dap` and `xc7z020` do not. The part comes from the bitstream build's saved report, not from a guess.

The programming script opens only the selected target, then keeps the device only when `get_hw_devices -filter {NAME == "..."}` returns exactly one object. It does not use `lindex [get_hw_devices] 0`.

## Mock results

Tests can supply a device list without starting Vivado. That scan is `mock: true`. A program of that scan returns `mock_passed`, `programmed: false`, and `jtag_download: not_run_mock`. The message is "Mock test. The FPGA was not programmed." The studio shows that sentence and does not show it as a programmed FPGA.

## This machine

A scan with no cable reports no target. `programmed` is false and `jtag_download` is `not_tested_no_hardware`. That copy is `workspace/hardware/m5b-no-board`. Vivado writes the same `puts` lines into `vivado.log`. The device list is parsed from the process output only, so a connected board is not listed twice.

### Zybo Z7-20, scan only

A Zybo Z7-20 was enumerated on 2026-11-23. The cable, the power LED, jumper JP5, and any SD card were not inspected visually. The Hardware Manager result shows that a Digilent USB-JTAG adapter answered and that the board was powered far enough to return IDCODEs.

Vivado v2019.1 launched `hw_server` and opened one target, `localhost:3121/xilinx_tcf/Digilent/210351B4009EA`. The log has no cable-driver error. The target contains two devices:

| Device | Part property | IDCODE_HEX | Matches `xc7z020clg400-1` |
| --- | --- | --- | --- |
| `arm_dap_0` | `arm_dap` | `4BA00477` | no |
| `xc7z020_1` | `xc7z020` | `23727093` | yes, as the device prefix |

The ARM DAP is listed first. It is not selected. The scan record is `scn_74409733466b4f218229b6da49a17877`. `programmed` is false.

The Z7-10 bitstream is the wrong part for this board. A separate build, `bld_34d0198b02b84f73b25a8aa305579d5a`, uses `boardfiles/zybo-z7-20/A.0/board.xml` and therefore part `xc7z020clg400-1`. The VHDL is the existing `examples/fpga/zybo-z7-10-counter/zybo_counter.vhd`. The constraints are `examples/fpga/zybo-z7-20-counter/zybo_counter.xdc`. That XDC uses only pins named by both the Z7-20 board pin file and Digilent's `Zybo-Z7-Master.xdc` (Rev. B, compatible with the Z7-20 and the Z7-10): clock `K17` LVCMOS33, period 8.000 ns from the board frequency 125000000, waveform `{0 4}`, and LED0 `M14` LVCMOS33.

Vivado 2019.1 wrote `bitstream.bit`, 4,045,672 bytes. Implementation timing met the constraint: WNS 5.520 ns, WHS 0.040 ns, clock `sys_clk` at 125.000 MHz. Utilization is 1 LUT, 27 registers, 7 slices, 2 bonded IOBs, and 1 BUFGCTRL. The DRC warnings are Place 46-29 and ZPS7-1. ZPS7-1 is the same PL-only warning as on the Z7-10 bitstream. The reference VHDL was not given a PS7 cell.

`workspace/ui.json` and `workspace/project.json` were not modified. The Z7-10 example files were not modified.

The programming script for `xc7z020_1` on that target was reviewed at `workspace/hardware/m5b-z720-program-prepared/program.tcl` before it was run. A request with no device is `device_required`. The DAP is `part_mismatch`. The FPGA without confirmation is `confirm_required`.

### Zybo Z7-20 download

The user confirmed that the board was ready and that jumper JP5 was on JTAG. Program `prg_c96275d4116948768d5c9c8079532cc8` then ran the product path with confirmation, device `hw_9345eb2b2bf746ccb2b7736617fd09c6` (`xc7z020_1` only), and build `bld_34d0198b02b84f73b25a8aa305579d5a`. The result is `programmed` true, `mock` false, and `jtag_download` `completed`.

Vivado v2019.1 printed `INFO: [Labtools 27-3164] End of startup status: HIGH` and `HDL-MAKER-PROGRAM-DONE`. A later read, which did not program again, showed `REGISTER.CONFIG_STATUS.BIT14_DONE_PIN` as 1 and `REGISTER.CONFIG_STATUS.BIT13_DONE_INTERNAL_SIGNAL_STATUS` as 1. Vivado also reported that `xc7z020` index 1 holds a design with no debug core. The ARM DAP was not programmed.

`program_hw_devices -type bit` produced `WARNING: [Labtoolstcl 44-560]`: on this install `-type` is ignored unless `HWX.FILE` is set. The bitstream still came from `PROGRAM.FILE`, which was the Z7-20 `bitstream.bit`. The warning did not leave DONE low.

The counter drives LED0 from bit 26 of a 27-bit count at 125 MHz. The full period is 2^27 / 125000000, about 1.074 s. The output changes every half period, about 0.537 s. At the board, LED0 blinked about once per second and the DONE LED was green. The cable socket, the power LED, and any SD card were not inspected from this session.

### Hardware results

These three checks stay separate. A passed program command is not the same fact as the DONE pin, and neither one is the LED.

| Check | Status | Evidence |
| --- | --- | --- |
| JTAG programming | Tested on hardware | `program_hw_devices` finished. `programmed` is true, `mock` is false, `jtag_download` is `completed`. Record `prg_c96275d4116948768d5c9c8079532cc8`. |
| FPGA configuration | Tested on hardware | Startup status HIGH. A second read, without programming again, showed `BIT14_DONE_PIN` 1 and `BIT13_DONE_INTERNAL_SIGNAL_STATUS` 1. The DONE LED was green. |
| Counter function | Tested on hardware | LED0 on M14 blinked about once per second, which matches the 1.074 s period. |

`WARNING: [Labtoolstcl 44-560]` did not block the download. On this Vivado 2019.1 install, `program_hw_devices -type bit` is ignored unless `HWX.FILE` is set. The bitstream was taken from `PROGRAM.FILE`. Cleaning that Tcl flag is later work. It is not part of this hardware result.

## ZPS7-1

The M5a bitstream log contains:

```text
WARNING: [DRC ZPS7-1] PS7 block required: The PS7 cell must be used in this Zynq design in order to enable correct default configuration.
```

The reference counter is PL-only. Its clock is package pin K17 and its LED is package pin M14, both from the Zybo Z7-10 board file. The netlist has no PS7 cell, so Vivado warns that the Zynq processing-system configuration block is absent. The check was a warning. `write_bitstream` still wrote the file, 2,083,848 bytes, and the timing constraints were met.

Removing the warning would mean adding a PS7 block. That is Zynq PS configuration, which this milestone does not do. `examples/fpga/zybo-z7-10-counter` is unchanged.

The Z7-10 bitstream was not programmed. The separate Z7-20 bitstream was programmed, and LED0 on that board blinked about once per second.
