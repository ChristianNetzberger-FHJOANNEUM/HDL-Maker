# O3b — Build records and separate hardware status

Each FPGA build keeps the directory created for its build id. A later build does not delete or replace that directory. The manifest records the build id, the toolchain, the part, the VHDL standard, and the SHA-256 of the bitstream when a bitstream file exists.

A passed build is not a hardware test. Four states stay separate:

| State | Meaning |
| --- | --- |
| `build_passed` | The toolchain finished the requested build. |
| `jtag_detected` | A named JTAG scan listed devices. |
| `programming_completed` | SRAM was written. |
| `hardware_function_verified` | Someone observed the board after that load. |

The FPGA Build tab shows the latest passed Vivado bitstream and the latest passed open-source bitstream beside each other. Vivado timing is slack (WNS). The open-source timing is the nextpnr critical path. The tab says those are different measurements. SRAM stays the only programming action. Flash is not offered.

## Records kept from earlier loads

| Toolchain | Build | SHA-256 | File now |
| --- | --- | --- | --- |
| Vivado | `bld_34d0198b02b84f73b25a8aa305579d5a` | `3ccfd8c0916b8619dc565a957146c8057d81eaaf456b5bd6025407deb7dc81c7` | Present when this hash still matches `bitstream.bit` in that directory. |
| Open source | `osb_574eb1ad8c3b4ac8a36b359745d3534d` | `277aa58dfbfe90b207da7c44d648232af4358162a2210c58ed57aece2abad88e` | Not in the workspace. The O3a test copied a later build over `workspace/builds/o2a-zybo-counter/`. |

The later open-source file, build `osb_cc37a7ea1af24185abd2c85c04f4278d`, SHA-256 `cd9dd41e66f7c17b758207bbad0812b85ffdceb4ae41e3e3d06121ffe1520027`, is a passed build. It was not programmed. Its hash is not the O2b result.

On 23 November 2026 a JTAG detect through the open-source API, serial `210351B4009EA`, listed the ARM DAP `0x4ba00477` and the FPGA `xc7z020` `0x23727093`. `programmed` stayed false. No SRAM load was started. The project was put back to Vivado and VHDL-93. The Vivado file still matches its recorded hash. The open-source file from O2b does not.
