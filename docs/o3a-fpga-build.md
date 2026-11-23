# O3a — Open-source backend in FPGA Build

O3a puts the O2a builder and the tested D2XX programmer behind the FPGA Build tab. VHDL is still generated once. The window chooses a backend and calls that backend only. Vivado is not a fallback, and the open-source flow is not a fallback.

O2b remains **Tested on hardware**. This step did not program the FPGA again.

## Backend choice

The project field `fpga.toolchain` is `vivado` or `opensource`. Existing projects stay on Vivado. The choice is saved with the other FPGA settings. The VHDL standard and the library profile stay on the project. VHDL-2008 is still refused by the open-source builder, and the window does not change a VHDL-2008 project back to VHDL-93.

## Open-source build

The buttons call the O2a endpoints: check, start, and poll. The five stages are `ghdl`, `yosys`, `nextpnr`, `fasm2frames`, and `xc7frames2bit`. The tab shows their status, the diagnostics, the nextpnr resource and timing numbers when a build has them, the bitstream path, and `manifest.json` in the build directory.

## SRAM programming

The openFPGALoader path is `openfpga_loader_path` in `workspace/opensource-tools.json`. It is not stored in the project and `ftd2xx.dll` is not copied.

A scan requires the interface A serial. An empty serial, a prefix, and a serial that ends in `B` are refused before the program runs. The first FTDI device is not opened. The scan lists every device and does not choose one. Programming requires the FPGA whose part matches the bitstream and the project part, plus an explicit confirmation. The command is `-m` at 1 MHz with `--usb-serial-num`. It does not pass `-f`.

Only `zybo-z7-20` is mapped to the loader board `zybo_z7_20`. Another board name is an error. No other name is invented.

The Z7-20 counter was built again through the existing O2a test. The bitstream is 4,045,674 bytes, SHA-256 `cd9dd41e66f7c17b758207bbad0812b85ffdceb4ae41e3e3d06121ffe1520027`, at `workspace/builds/o2a-zybo-counter/zybo_counter.bit`. nextpnr reports 56 SLICE_LUTX, 27 SLICE_FFX, 7 CARRY4, and a critical path of 2.68 ns. This file was not programmed. The earlier programmed bitstream, SHA-256 `277aa58dfbfe90b207da7c44d648232af4358162a2210c58ed57aece2abad88e`, is no longer the file in that directory. The O2b record keeps that hash.

The local tool paths used for that build are stored in `workspace/opensource-tools.json`, including the D2XX `openFPGALoader.exe`. `ftd2xx.dll` is not in that file and was not copied.

## Tests

`backend/tests/test_o3a.py` covers the stored choice, a missing loader, interface B, the two-device scan, confirmation, a part mismatch, and the refusal to call Vivado from the open-source scan. The mock scan and the mock SRAM request leave `programmed` false. No USB device was opened. The existing O2a tests still cover the builder, including VHDL-2008 and the rule that an open-source bitstream is not offered to the Vivado programmer.
