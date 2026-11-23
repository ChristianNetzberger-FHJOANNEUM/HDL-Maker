# O2b.1 — How to program through the FTDI driver

O2b.1 is a study. Nothing was installed, no driver was changed, and the FPGA was not programmed. The recommendation for O2b.2 is a D2XX transport under the existing openFPGALoader MPSSE class. UrJTAG is not that path. WinUSB stays the fallback that needs its own approval.

Sources were read on 23 November 2026. This file is not a licence opinion and not a clearance to ship `ftd2xx.dll`.

## What is already shown

| Step | Status |
| --- | --- |
| Open-source bitstream | Passed. `osb_574eb1ad8c3b4ac8a36b359745d3534d`, 4,045,674 bytes, SHA-256 `277aa58dfbfe90b207da7c44d648232af4358162a2210c58ed57aece2abad88e`. |
| D2XX open of interface A `210351B4009EA` | Passed. Driver remains `FTDIBUS` 2.12.36.20. |
| IDCODEs `0x23727093` and `0x4BA00477` | Passed. Read at 100 kHz with the `digilent` pin levels. |
| openFPGALoader on D2XX | Not available. v1.2.0, revision `e3d8d947`, links libftdi and fails `usb_open()`. |
| Bitstream loaded, LED0 confirmed | Not done. |

The D2XX scan shows that the cable speaks MPSSE under the driver Vivado already uses. It does not show that a configuration sequence has been accepted by the FPGA.

## A — UrJTAG

Not installed and not run.

The UrJTAG manual says a Windows build can link FTDI's D2XX library, and that `FTDIBUS.SYS` and `FTD2XX.DLL` from the CDM package are what an FTDI cable needs. If both libftdi and FTD2XX are present, UrJTAG prefers FTD2XX. The `cable` command can take VID, PID, interface, and `desc=`, because FTD2XX otherwise may open the wrong FTDI device. That matches this machine: interface A and interface B are two D2XX devices.

The same manual's command list has `detect`, `shift`, and `svf`. It has no command that loads a Xilinx 7-series `.bit` file. `svf` plays an SVF into one selected part. The documented player does not implement `HIR`, `HDR`, `TIR`, or `TDR`; those are the SVF commands that pad the other devices in a chain. The manual says the part selection is supposed to replace them. That has not been tried on this Zynq, whose chain is an ARM DAP with instruction length 4 and an FPGA with instruction length 6.

A 2013 report says a Kintex-7 was configured from an SVF after the Xilinx BSDL file was edited. A 2015 message says a `pld load` command had been used with some Xilinx 6 `.bit` files. That command is not in the command list read here. Neither report is this bitstream, this part, or this cable.

Using UrJTAG for O2b would need a second configuration path: an SVF we do not have, or a Xilinx player UrJTAG's manual does not provide. Most of UrJTAG is GPL. Some headers and cable drivers are BSD or MIT. Shipping a GPL program linked to the proprietary D2XX DLL is a separate distribution question and is not decided here.

UrJTAG remains a possible later check of the same cable. It is not the shortest way to load `zybo_counter.bit`.

## B — Where openFPGALoader would accept D2XX

The upstream CMake options turn FTDI cables on through libftdi only. There is no D2XX switch. The split that matters is already in the sources read for this note.

`zybo_z7_20` is a JTAG board entry: cable `digilent`, part `xc7z020clg400`, clock `CABLE_DEFAULT`. The `digilent` cable is MPSSE on interface A, low value `0xE8`, low direction `0xEB`, high value `0x00`, high direction `0x60`. That is the pin setup the D2XX scan already used.

The call stack is:

1. `xilinx` programming uses the `Jtag` object. It does not call libftdi.
2. `Jtag` walks the TAP and calls `writeTMS`, `writeTDI`, and the clock helpers on a `JtagInterface`.
3. `FtdiJtagMPSSE` implements those calls by storing MPSSE bytes. The Xilinx sequence is not built here.
4. `FTDIpp_MPSSE` is the only layer that opens the USB device and reads or writes those bytes. It calls `ftdi_usb_open_desc`, `ftdi_set_interface`, `ftdi_set_bitmode`, `ftdi_set_latency_timer`, `ftdi_usb_purge_buffers`, `ftdi_write_data`, and `ftdi_read_data`.

A D2XX backend replaces that last layer. `FtdiJtagMPSSE` and the Xilinx programmer stay as they are. The MPSSE opcodes, the TAP moves, the part table, and the SRAM load of a `.bit` file stay the ones already used for `zybo_z7_20`.

Two differences from libftdi have to be handled in that transport, not in the programmer:

- libftdi treats the FT2232 as one USB device with interface A or B. D2XX lists them as two devices. On this board they are `210351B4009EA` (`Digilent Adept USB Device A`) and `210351B4009EB`. The backend must open the A serial. Opening the first FTDI device on a bus is the failure UrJTAG documents.
- `FtdiJtagMPSSE` switches the read edge when the clock is at least 15 MHz and the product string begins with `Digilent USB Device`. The string read over D2XX is `Digilent Adept USB Device A`, which does not begin that way. The 100 kHz scan did not depend on that rule. The first D2XX build should detect at a clock well below 15 MHz before any faster load is tried.

D2XX status codes replace the negative libftdi codes at this boundary. The exceptions the upper layers already raise can stay.

Linux and the current libftdi build stay the other side of a Windows-only compile flag. This does not remove the OSS CAD Suite binary.

## C — Choice

| | UrJTAG | D2XX under openFPGALoader |
| --- | --- | --- |
| Work | A full second tool, plus an SVF or an unproven `.bit` player for this Zynq. | One transport behind `FTDIpp_MPSSE`. The Xilinx load stays. |
| What has been shown | Documented D2XX open and SVF playback on other parts. Not run here. | The same cable, pins, and IDCODEs already answered through `ftd2xx.dll`. The configuration sequence has not been run. |
| Windows | Needs its own build and the FTDI DLL. | The DLL is already installed. A local build is still required. |
| Vivado | Same `FTDIBUS` driver, so no WinUSB change. Only interface A would be opened. | Same. Interface B and COM20 stay unused. |
| Licence of the tool | Mostly GPL. | Apache-2.0, which HDL-Maker can ship with its notices. |
| Student ZIP | GPL source plus an unresolved DLL. | The patched loader can be shipped as Apache-2.0. The DLL should not be inside the ZIP. |

### FTDI's own text

Two FTDI pages were read, and they do not say the same thing in the same width.

The D2XX driver page says the drivers may be used only with products based on FTDI parts, and that they may be distributed in any form as long as the licence information is not modified.

The driver licence, sections 1.3 and 1.4, grants use to a user of a device that contains a genuine FTDI component, including installing the software on a computer in order to use that device. A seller or distributor of such a device may distribute the software with the device. Section 3.1.7 says the software is not to be made available to any person except as that licence sets out. Section 3.1.2 says the software is not to be modified.

HDL-Maker is not the seller of the Zybo. The short page is not a clearance to put `FTD2XX.DLL` or `FTDIBUS.SYS` into a student archive. The safe use for O2b.2 is the DLL already loaded by the installed FTDI driver, opened from `C:\Windows\System32\ftd2xx.dll`. It is not copied into the repository and not into a release ZIP. Calling that installed DLL is how the D2XX programmer's guide says an application uses the driver. Bundling a second copy is a later licence question, not part of this study.

The CDM guide also says one interface is not used through D2XX and through its COM port at the same time. Interface A is the JTAG device. Interface B is the UART. Opening only A leaves that rule intact.

## O2b.2, after a separate approval

Build openFPGALoader from the revision already in use, `e3d8d947`, or from a newer revision only after its `FTDIpp_MPSSE` and `FtdiJtagMPSSE` files have been compared with that revision. Add the Windows D2XX transport under `FTDIpp_MPSSE` only. Do not edit the Xilinx programmer. Do not write a new configuration sequence. Load the system `ftd2xx.dll`. Do not change `FTDIBUS`.

The first run is a detect, not a download:

- board `zybo_z7_20`, cable `digilent`, serial `210351B4009EA`
- clock at or below the 100 kHz rate that already returned both IDCODEs, and in any case below 15 MHz
- expect raw `0x23727093` on the FPGA and `0x4BA00477` on the ARM DAP

The approved detect was run at 1 MHz and is recorded in [o2b2-d2xx-transport.md](o2b2-d2xx-transport.md). The SRAM load of `workspace/builds/o2a-zybo-counter/zybo_counter.bit` stays behind a further approval. The command remains the openFPGALoader SRAM load, with no `-f`. The local Python scan is not the programmer.

UrJTAG is not installed for this step. WinUSB is not applied.
