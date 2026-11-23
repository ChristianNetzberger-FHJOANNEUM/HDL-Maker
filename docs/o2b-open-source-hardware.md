# O2b — Open-source bitstream on the Zybo Z7-20

O2b is the hardware check of the O2a bitstream. It is **Tested on hardware**. The SRAM load exited 0, the JTAG DONE bit was 1, the DONE LED was green, and LED0 blinked about once per second. O3, O4, and O5 are unchanged.

| Step | Result |
| --- | --- |
| Toolchain, O2a build `osb_574eb1ad8c3b4ac8a36b359745d3534d` | Passed in software. Bitstream 4,045,674 bytes. |
| USB access for the OSS CAD Suite `openFPGALoader.exe` | Failed. libusb cannot open the FTDI driver. |
| USB access through the installed FTDI D2XX library | Passed for a read-only IDCODE scan, and again through the O2b.2 transport. No driver was replaced. |
| JTAG chain read | Passed on 23 November 2026, including the pre-check before the SRAM load. Raw `0x23727093` and `0x4BA00477`. |
| FPGA programmed with the open-source bitstream | SRAM load exited 0. JTAG status `done 1`. No flash. |
| DONE LED and LED0 for that bitstream | Passed. DONE LED green. LED0 blinked about once per second. |

## Bitstream

The only file prepared for a later SRAM load is `workspace/builds/o2a-zybo-counter/zybo_counter.bit`.

| Item | Value |
| --- | --- |
| Build | `osb_574eb1ad8c3b4ac8a36b359745d3534d` |
| Toolchain | `opensource` |
| Part | `xc7z020clg400-1` |
| Generator | `xc7frames2bit` |
| Bytes | 4,045,674 |
| SHA-256 | `277aa58dfbfe90b207da7c44d648232af4358162a2210c58ed57aece2abad88e` |

The Vivado file `workspace/builds/bld_34d0198b02b84f73b25a8aa305579d5a/bitstream.bit` is 4,045,672 bytes and has a different hash. It is not the O2b file. No flash command and no SD-card change were used.

## What openFPGALoader can and cannot do here

`workspace/toolchains/o1/oss-cad-suite/bin/openFPGALoader.exe` is v1.2.0, revision `e3d8d947`, Apache-2.0. Its board list contains `zybo_z7_20` with cable `digilent` and part `xc7z020clg400`. The official board page marks volatile configuration as available and flash as not available. `-m` is the SRAM default. `-f` was not passed.

The Windows build links libftdi and libusb. The CMake options of the upstream project enable FTDI cables only through libftdi. There is no D2XX build switch. Rebuilding the same source would still need a libusb driver.

On this machine the cable is an FT2232, VID `0403`, PID `6010`, serial base `210351B4009E`. Interface A is `210351B4009EA`, described by D2XX as `Digilent Adept USB Device A`. Interface B is `210351B4009EB` and is the UART, COM20. Both interfaces use FTDI `FTDIBUS` 2.12.36.20. After the scan below, both still did.

`openFPGALoader --scan-usb` reports error `-5` for `0403:6010`. `openFPGALoader -c digilent --detect` ends with `usb_open() failed`, error `-4`. That failure was repeated after the D2XX scan. No `hw_server` or `vivado` process was holding the cable. The blocker is the driver interface, not a busy Hardware Server.

The cable entry `digilent` is MPSSE on interface A with low value `0xE8`, low direction `0xEB`, high value `0x00`, and high direction `0x60`. The part table stores `xc7z020` as `0x03727093`. The comment in the upstream table says the version nibble is zero in the table. A wire value is matched with that nibble masked. The ARM DAP entry is `0x4BA00477`, described as ARM Cortex-A9, instruction length 4.

## D2XX scan

The FTDI driver already installs `C:\Windows\System32\ftd2xx.dll`. That file was opened in place. It was not copied into the repository or into a release package. Its redistribution terms were not reviewed. Vivado's own `FTD2XX.dll` was not used.

A local read-only script, `workspace/toolchains/o2b/d2xx_idcode.py`, opened only serial `210351B4009EA`, put interface A into MPSSE at 100 kHz, applied the `digilent` pin levels, shifted 64 data bits after Test-Logic-Reset, and returned the TAP to Test-Logic-Reset. Interface B was not opened. No bitstream was passed to any tool.

The 64 bits, first byte first, were `93 70 72 23 77 04 a0 4b`.

| Shift order, TDO side first | Raw IDCODE | Masked with `0x0FFFFFFF` | Match |
| --- | --- | --- | --- |
| First | `0x23727093` | `0x03727093` | xc7z020. Version nibble is 2. |
| Second | `0x4BA00477` | `0x0BA00477` | ARM DAP. The table key is the unmasked value. |

`0x23727093` is the raw IDCODE M5b recorded for `xc7z020_1`. Masking bits 31–28 produces the openFPGALoader key `0x03727093`. The device that answers `0x23727093` is the FPGA. The device that answers `0x4BA00477` is the ARM DAP and is not a programming target.

openFPGALoader inserts each newly shifted device at the front of its list. With that order, its printed index 0 would be the ARM DAP and index 1 the FPGA. Vivado's M5b scan listed `arm_dap_0` and then `xc7z020_1` on `localhost:3121/xilinx_tcf/Digilent/210351B4009EA`. The same two IDCODEs were read here, by a different stack.

This scan does not load a configuration. It is not the LED test.

## Paths that were not taken

### WSL2 and usbipd

Debian on WSL2 is installed and has `lsusb`. It does not have openFPGALoader. usbipd-win 5.3.0 is installed. `usbipd list` shows bus `5-2`, `0403:6010`, state `Not shared`. Nothing was bound or attached.

`usbipd bind` without `--force` is described by that version as leaving the device usable on Windows until it is attached. Attaching it to WSL takes it away from Windows until detach. This machine also prints that the USBPcap filter is incompatible and that `bind --force` would be required. `--force` means the host cannot use the device. That would block Vivado for as long as the forced binding lasts. Binding was not run. It needs an administrator and is a driver-stack change.

### WinUSB on interface A only

Not done. Interface A is `USB\VID_0403&PID_6010&MI_00`. Interface B is `MI_01`. openFPGALoader's `digilent` cable uses interface A, so a WinUSB driver on A alone is the selective change that could make this binary open the JTAG port while COM20 stays on `FTDIBUS`. Vivado's JTAG path uses the FTDI driver on A. While A is WinUSB, that path cannot open the same interface. Using Vivado and openFPGALoader one after the other would mean switching A's driver each time. Restoring `FTDIBUS` was not rehearsed. The change needs an administrator. It stays behind a separate approval.

## O2b.3 SRAM load

The file checked before programming was `workspace/builds/o2a-zybo-counter/zybo_counter.bit`: 4,045,674 bytes, SHA-256 `277aa58dfbfe90b207da7c44d648232af4358162a2210c58ed57aece2abad88e`, part `xc7z020clg400-1`, generator `xc7frames2bit`. No `hw_server` was running. The pre-check detect at 1 MHz printed the same raw IDCODEs as O2b.2. Index 0 is the ARM DAP. Index 1 is `xc7z020`, the only device in the FPGA list, and that is the device the existing Xilinx path programs.

The completed command used the D2XX build, not the OSS CAD Suite binary. `-m` is SRAM. `-f` was not passed. The log says `write to ram`.

```text
openFPGALoader.exe -b zybo_z7_20 --usb-serial-num 210351B4009EA --freq 1000000 -m --verbose-level 2 C:\_Git\HDL-Maker\workspace\builds\o2a-zybo-counter\zybo_counter.bit
```

Two earlier starts of that same command were cut off while the progress bar was near 80 percent, before any status word was printed. They are not a device rejection. The run that finished took 35.4 seconds and exited 0. Stdout is `workspace/toolchains/o2b/o2b3-program-out.log`. Stderr is empty. The exit line is `workspace/toolchains/o2b/o2b3-program-exit.txt`.

The bit parser warned `Unknown key Generator` for the `xc7frames2bit` header field, then reported parse `DONE`. The header it did read names `xc7z020clg400-1`.

After the load the JTAG instruction-capture status was:

| Field | Value |
| --- | --- |
| Shift IR | `0x35` |
| ir | 1 |
| isc_done | 1 |
| isc_ena | 0 |
| init | 1 |
| done | 1 |

`done 1` is the FPGA status bit in that capture. Because the bit was 1, the programmer did not go on to read the STAT register. At the board, the DONE LED was green and LED0 blinked about once per second. The counter period is 2^27 / 125 MHz, about 1.074 seconds. M5b reported the same two observations for the Vivado bitstream: a green DONE LED and a blink of about one second.

## Vivado after the load

The same read-only scan as O2b.2 ran after the load. It does not call `program_hw_devices`. Vivado 2019.1 exited 0 and printed:

```text
HDL-MAKER-DEVICE  localhost:3121/xilinx_tcf/Digilent/210351B4009EA  arm_dap_0  arm_dap  4BA00477
HDL-MAKER-DEVICE  localhost:3121/xilinx_tcf/Digilent/210351B4009EA  xc7z020_1  xc7z020  23727093
```

The target was closed. No `hw_server` remained. COM20 was still present. Both converters were still `FTDIBUS` 2.12.36.20. No driver was changed.

The OSS CAD Suite binary still cannot open this cable. The D2XX build is not in the Python backend and not in the window. A student package that ships only the suite binary still needs a driver change. `ftd2xx.dll` is not part of the HDL-Maker package.

O2b is **Tested on hardware**. O3a is in the FPGA Build tab and did not program the board again.
