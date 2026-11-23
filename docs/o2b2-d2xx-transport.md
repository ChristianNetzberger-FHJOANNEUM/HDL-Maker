# O2b.2 — D2XX transport under openFPGALoader

O2b.2 is a Windows transport. It sits under the existing MPSSE layer of openFPGALoader and opens one FTDI interface through the driver that is already installed. The Xilinx programmer, the JTAG state machine, and the MPSSE command bytes are the upstream code. The later SRAM load is recorded in [o2b-open-source-hardware.md](o2b-open-source-hardware.md). The DONE LED was green and LED0 blinked about once per second, so O2b is Tested on hardware.

This build is not part of the Python backend. HDL-Maker does not call it.

## Architecture

openFPGALoader v1.2.0, revision `e3d8d947a3df36b5dedbfe720cd3d242aa7ca232`, talks to an FTDI cable through libftdi. On this PC that path cannot open `FTDIBUS`. The OSS CAD Suite binary is unchanged and still fails there.

The D2XX build does not replace those classes. `src/ftdipp_mpsse.cpp`, `src/ftdiJtagMPSSE.cpp`, and `src/xilinx.cpp` are the upstream files. A Windows-only shim provides the `ftdi_*` and `libusb_*` symbols those files already call. CMake selects it with `HDL_MAKER_D2XX`. The default is off, so a normal build of other cables and of other platforms does not include this transport.

The shim loads `ftd2xx.dll` with `LoadLibrary`. It does not link an import library and it does not copy the DLL. `FT_OpenEx` is called with `FT_OPEN_BY_SERIAL_NUMBER` and the exact serial `210351B4009EA`. A shorter prefix is rejected. A description that does not end in `A` is rejected before `FT_OpenEx`. After the open, `FT_GetDeviceInfo` must still report that serial and a description ending in `A`, or the handle is closed at once. `ftdi_set_interface` accepts only interface A. Opening the first device, or opening by USB bus address, returns an error and does not call `FT_OpenEx`.

The cable entry stays `digilent`: interface A, low value `0xE8`, low direction `0xEB`, high value `0x00`, high direction `0x60`.

`FT_Write` is repeated until every requested byte has been sent. A zero-length write is a timeout. `FT_Read` returns one result, including a zero-length read on timeout. `FT_STATUS` errors from either call are returned to the MPSSE layer. On close the transport resets the bit mode, purges the buffers, and calls `FT_Close`. A second close does not call `FT_Close` again.

## Changed files

The source tree is the gitignored checkout `workspace/toolchains/o2b/openFPGALoader-tmp`, detached at `e3d8d947`. It is not an HDL-Maker product source and it is not under `libs/`.

| File | Change |
| --- | --- |
| `CMakeLists.txt` | Option `HDL_MAKER_D2XX`, default off. When on, Windows only, FTDI MPSSE and Xilinx only, no pkg-config. |
| `src/main.cpp` | With the transport compiled in, an empty serial is an error, and a requested frequency above 1 MHz is reduced to 1 MHz. |
| `hdlmaker/include/ftdi.h`, `hdlmaker/include/libusb.h` | Declarations the upstream FTDI sources include. |
| `hdlmaker/d2xx_transport.hpp`, `hdlmaker/d2xx_transport.cpp` | Device selection, partial reads and writes, timeouts, purge, MPSSE bit mode, close. |
| `hdlmaker/ftdi_d2xx_shim.cpp` | The symbols `FTDIpp_MPSSE` already calls. |
| `hdlmaker/d2xx_transport_test.cpp` | Tests with a stand-in for the DLL. No hardware. |

`backend/`, `libs/`, and the O2a pipeline were not edited. No `ftd2xx.dll` was added to the tree.

## Build

The compiler used here was WinLibs GCC 15.2.0, with CMake and Ninja. Nothing was installed for this step.

```text
cmake -S workspace/toolchains/o2b/openFPGALoader-tmp ^
  -B workspace/toolchains/o2b/openFPGALoader-d2xx-build ^
  -G Ninja -DCMAKE_BUILD_TYPE=Release -DHDL_MAKER_D2XX=ON
cmake --build workspace/toolchains/o2b/openFPGALoader-d2xx-build
```

The link adds `-static-libstdc++` and `-static-libgcc`. The resulting `openFPGALoader.exe` still loads `ftd2xx.dll` from the Windows installation at run time. The executable `d2xx_transport_test.exe` is the software test.

This build has no zlib and no gzip. Detect does not need them. An uncompressed `.bit` does not need them. Compressed bitstreams and Altera flash are outside this build. The configure log says so.

## Dependencies

- Windows, and the FTDI driver already installed on this PC: `FTDIBUS` 2.12.36.20 on both channels of VID `0403` PID `6010`.
- `ftd2xx.dll` resolved by `LoadLibrary("ftd2xx.dll")` from that installation. Vivado's copy of the DLL was not used.
- The experimental binary under `workspace/toolchains/o2b/openFPGALoader-d2xx-build/`.
- The board cable, serial `210351B4009EA` for interface A. Interface B stays `210351B4009EB`, COM20.

No driver was installed or changed.

## Software tests

`d2xx_transport_test.exe` exited 0. Every case below passed. The stand-in never opens a USB device.

| Case | Result |
| --- | --- |
| Exact serial `210351B4009EA` | Opened once. Description ends in `A`. FT2232H is reported to the MPSSE layer as type 4. Timeouts are set. |
| Empty serial, and the prefix `210351B4009E` | Rejected. `FT_OpenEx` is not called. |
| Serial `210351B4009EB` | Rejected as interface B before `FT_OpenEx`. No handle remains. |
| Serial absent from the device list | Rejected. `FT_OpenEx` is not called. |
| `FT_OpenEx` returns status 3 | Reported as locked. No handle, and `FT_Close` is not called. |
| Write returns 3 bytes and then 7 | 10 bytes, original order. |
| Write returns 0 bytes | Timeout. |
| Read returns 2 bytes, then 0, then status 4 | Partial read, timeout, and the status are reported separately. |
| Null API pointer, and DLL name `hdlmaker-no-such-ftd2xx.dll` | Load fails. The missing name is not opened. |
| Close, then close again | `FT_Close` runs once. |

## JTAG detect

The command was detect only. No bitstream path and no `-f` were passed.

```text
openFPGALoader.exe -b zybo_z7_20 --usb-serial-num 210351B4009EA --freq 1000000 --detect --verbose-level 2
```

Exit code 0. Requested frequency 1.00 MHz, reported real frequency 1.00 MHz. That is the ceiling for this transport. The run did not go above it.

Raw IDCODEs, TDO side first:

| Index | Raw value |
| --- | --- |
| 0 | `0x23727093` |
| 1 | `0x4ba00477` |
| 2 | `0xffffffff` (end of chain) |

The printed chain, after openFPGALoader inserts each new device at the front, is:

| Index | IDCODE shown | Device |
| --- | --- | --- |
| 0 | `0x4ba00477` | ARM Cortex-A9, instruction length 4 |
| 1 | `0x3727093` | Xilinx Zynq xc7z020, instruction length 6 |

`0x3727093` is the part-table key. The table stores the version nibble as 0. The raw line `0x23727093` is the FPGA IDCODE. Index 0 is the ARM DAP and index 1 is the FPGA, which is the order Vivado printed in M5b. `--detect` returns before `program()` is called. No configuration was started.

The process then left. Its destructor resets the bit mode, purges, and closes the D2XX handle. The log has no close error. No `openFPGALoader` process remained.

## Error handling

| Condition | Behaviour |
| --- | --- |
| `ftd2xx.dll` cannot be loaded | `ftdi_new` fails. The message is `ftd2xx.dll was not found in the Windows installation`. |
| Serial missing, empty, or only a prefix | No open. |
| Interface B, or a description that does not end in `A` | No open. |
| Opened handle is not interface A, or VID/PID is not `0403:6010` | Handle closed immediately. |
| Device locked | `FT_OpenEx` status is reported. Nothing is closed, because nothing was opened. |
| Short write | Further writes until the buffer is done. |
| Write or read status error | Returned as failure to the MPSSE layer. |
| Zero-length write | Timeout. |
| Zero-length read | Returned as no bytes. The MPSSE layer decides whether to wait again. |
| Close | Bit mode reset, purge, `FT_Close`. A second close is a no-op. |
| Frequency above 1 MHz | Reduced to 1 MHz, with a warning. |
| Interface other than A, or a request to open the first device | Error, no `FT_OpenEx`. |

## Vivado compatibility

After the detect process had exited, and before Vivado was started:

| Check | Result |
| --- | --- |
| `openFPGALoader`, `vivado`, `hw_server` | None running |
| COM20 | Present, status OK, service `FTSER2K` |
| USB Serial Converter A and B | Service `FTDIBUS`, version 2.12.36.20, provider FTDI |

Vivado 2019.1, SW build 2552052, then ran a read-only Hardware Manager scan. The script opens the target, prints each device, and closes the target. It does not call `program_hw_devices`. The script is `workspace/toolchains/o2b/o2b2-vivado-scan.tcl`. It is not part of `backend/app/fpga/program.py`.

```text
HDL-MAKER-DEVICE  localhost:3121/xilinx_tcf/Digilent/210351B4009EA  arm_dap_0  arm_dap  4BA00477
HDL-MAKER-DEVICE  localhost:3121/xilinx_tcf/Digilent/210351B4009EA  xc7z020_1  xc7z020  23727093
```

That is the same target and the same two devices as the M5b scan. The batch log records `Closing hw_target` after those lines. The batch process was then stopped before Vivado printed its own exit line, and the `hw_server` it had started was stopped afterwards. No driver was changed and nothing was programmed.

After that stop:

| Check | Result |
| --- | --- |
| `vivado`, `hw_server`, `openFPGALoader` | None running |
| COM20 | Still present |
| Both converters | Still `FTDIBUS` 2.12.36.20 |

## Licence

openFPGALoader is Apache-2.0. The shim is local source in the experimental tree and is not a release.

`ftd2xx.dll` is FTDI software. This step only loads the copy already installed with the FTDI driver. The file was not copied into the repository, into the build output as a companion to ship, or into a release ZIP. HDL-Maker is not the seller of the Zybo. The D2XX pages read for O2b.1 are not a clearance to put `FTD2XX.DLL` or `FTDIBUS.SYS` into a student archive. That question stays with O2b.1: [o2b1-d2xx-programming.md](o2b1-d2xx-programming.md).

## Status

JTAG detect through this transport passed on 23 November 2026. The approved SRAM load of `workspace/builds/o2a-zybo-counter/zybo_counter.bit` later exited 0, with JTAG `done 1`, and did not touch flash. The DONE LED was green and LED0 blinked about once per second. O2b is Tested on hardware. No commit and no release ZIP were part of this step.
