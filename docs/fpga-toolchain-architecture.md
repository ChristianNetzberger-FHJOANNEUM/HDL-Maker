# FPGA toolchain architecture

HDL-Maker has one code line and one MIT license. An FPGA toolchain is an optional backend behind a shared build boundary. Vivado, an open-source flow, another vendor's tools, and a remote build server are not separate products and not later editions of HDL-Maker.

This file is the architecture proposal. It does not add a Python interface, install a toolchain, or change the Vivado flow in M5a and M5b. The schedule is in `docs/roadmap.md`.

## Status words

| Label | Meaning |
| --- | --- |
| Implemented | The function is in a commit or in the working tree. |
| Tested in software | A test or a tool run checked the function without the FPGA board. |
| Tested on hardware | The bitstream was downloaded and the board behavior was checked. |
| Planned | Recorded as future work. No code and no tool run for that item. |
| Experimental | An external project describes the flow as incomplete or unofficial. HDL-Maker has not accepted it as a supported backend. |
| License unresolved | The right to run a tool on this machine and the right to redistribute its files have not both been read and recorded. |

A published binary, a device database, or a vendor board file is not evidence that a backend can synthesize, place, route, and program a design. That evidence is a build this repository has run, with the reports kept.

## One studio, external tools

The core does not contain a synthesizer or a place-and-route algorithm. It keeps the design, asks a backend to build it, and stores the reports the backend actually wrote.

Every variant is the same MIT-licensed HDL-Maker. The external tools keep their own licenses. A right to run a tool locally is a different question from a right to place its files in a public HDL-Maker package. A copy that runs is not by itself a copy that may be given to students. No Vivado file is copied into this repository or into a release ZIP. Third-party board files already in `boardfiles/` stay under the notices in `docs/third-party-notices.md`.

## Core

These functions stay in the core and do not depend on which FPGA backend is installed:

- Migration of HDL Designer libraries, without writing those proprietary files.
- Block-diagram editor.
- FSM editor.
- VHDL-93 and VHDL-2008 generation from one netlist.
- GHDL simulation and optional GTKWave.
- Project, library, and hierarchy management.
- Board selection and the part named by the selected board file.
- Constraint files supplied by the user.
- Build status and the reports a backend returns.

The studio documents and their stable object ids are the shared model. A backend reads that model. It does not receive its own diagram JSON. VHDL generation is not rewritten so that one backend will accept a construct another backend rejects. An unsupported construct stays a diagnostic.

## Variants

The tiers below are installation choices. They are not license editions.

| Variant | Tools | Who it is for | Status |
| --- | --- | --- | --- |
| HDL-Maker Core | HDL-Maker, GHDL, optional GTKWave | HDL design and simulation, including students without an FPGA toolchain | Implemented through M4a.1. The existing student ZIP predates M2c. |
| HDL-Maker + Vivado | A Vivado install the user is allowed to run | FPGA builds with the vendor flow, including larger Zynq designs | Branch V. M5a implemented. M5b tested on hardware: JTAG download, DONE pin, and LED0 counter. |
| HDL-Maker + Open Source | GHDL, Yosys, nextpnr, and the bitstream tools that flow requires | FPGA builds without Vivado, for devices a study has actually built | Branch O. Planned. Experimental. Not installed and not run. |
| HDL-Maker Remote Build | Local HDL-Maker, toolchain on an authorized server | Teaching labs that keep one toolchain install | Branch R. Planned. Not implemented. License unresolved. |

Vivado is the vendor-supported flow for designs that need it, including Zynq work that is outside the current PL-only counter. That is not a claim that every design finishes faster under Vivado. The open-source tier lists only boards and devices for which a backend has recorded a real build. There is no promise that every FPGA works with every toolchain.

## Shared build boundary

The boundary is vendor-neutral. The names below describe the operations. They are not a commitment to these Python methods.

- `detect_toolchain()`
- `list_supported_devices()`
- `validate_project()`
- `synthesize()`
- `implement()`
- `generate_bitstream()`
- `detect_hardware()`
- `program_device()`
- `parse_reports()`

Each backend states its own capabilities. A missing capability is reported. It is not filled in by calling a different tool silently.

Rules for every backend:

- HDL semantics stay in the core. The backend does not grow a second VHDL generator.
- Diagram documents stay backend-independent.
- Pin numbers, I/O standards, clock periods, and part names come from the board file or from a constraint file the user supplied. A missing value stops the build.
- Constraint formats may differ. Vivado uses the user's XDC. Another backend must name the constraint form it accepts. HDL-Maker does not invent a mapping to satisfy that form.
- Build status uses the same vocabulary (`passed`, `failed`, `not_run`, and the hardware results already used in M5b). The report files stay in the backend's own format.
- VHDL the backend cannot read is a diagnostic. It is not rewritten, and a Synopsys package is not replaced with `numeric_std` to make the backend succeed.
- Programming starts only after the user selects one device and confirms it. The first device in a list is not used automatically.
- A simulated or mock program is labeled as a mock. `programmed` stays false.

Today the only implemented adapter is Vivado, in `backend/app/fpga/vivado.py` and `backend/app/fpga/program.py`. The operations above are not a second code path.

## Branch V — Vivado

Audience: a machine with a Vivado install the user may run.

| Item | Status |
| --- | --- |
| M5a synthesis, implementation, bitstream | Implemented. Vivado 2019.1 wrote a bitstream for `examples/fpga/zybo-z7-10-counter`, part `xc7z010clg400-1`. The board was not programmed. |
| M5b JTAG scan and programming | Implemented. Tested on hardware as three results: JTAG download, DONE pin, and LED0 counter. |
| M5c timing, resources, DRC summary, ILA | Planned. |
| V1 minimal-install study | Planned. License unresolved for redistribution. |

V1 reads the existing Vivado 2019.1 installation and separates four questions:

1. Which reduced installation Vivado itself supports for this batch flow.
2. Which files a batch run actually loads, as a technical observation.
3. Which local use the installed entitlement allows.
4. Which of those files, if any, may be redistributed.

The size of the installed tree is the reason for the study. It was not remeasured for this document. The study does not copy Vivado into an HDL-Maker package.

AMD publishes more than one Vivado entitlement. This document does not record which entitlement is installed here, and it does not treat a right to launch `vivado.bat` as a right to ship the binaries.

## Branch O — open-source FPGA tools

Audience: students and developers who do not have Vivado. The branch is experimental until a reference build passes.

Components to inspect, and not yet to install:

- GHDL and Yosys for VHDL synthesis.
- Yosys for logic synthesis.
- nextpnr-xilinx / openXC7 for Xilinx 7-series place and route.
- Project X-Ray and FASM for bitstream generation.
- openFPGALoader for programming.
- OSS CAD Suite and Apio as possible ways to obtain those tools.

Published Windows x64 packages have been described for nextpnr-xilinx, bitstream tools, and device data that mention the Zybo Z7-10. This repository has not downloaded those packages, has not read their licenses, and has not run them. nextpnr's Xilinx 7-series support is described by that project as experimental. VHDL synthesis through GHDL/Yosys, timing, and board behavior remain untested here. A device database is not a completed implementation flow.

| Item | Status |
| --- | --- |
| O1 feasibility on Windows 11 | Planned. License unresolved. |
| O2 reference build of `zybo_counter` | Planned. Hardware test stays open while no Zybo is attached. |
| O3 backend behind this boundary | Planned. Starts only after O1 and O2. |
| O4 portable student edition | Planned. License unresolved. |

O1 records, from the packages it actually inspects:

- Which Windows binaries exist.
- The license of every program and every device database.
- Install size and archive size.
- Whether VHDL-93 and VHDL-2008 are accepted, and which constructs are refused.
- Whether `xc7z010clg400-1` is a device the tools can implement, not only a name in a database.
- Which constraint form the tools read.
- What a Zynq PS/PL design can and cannot do. The current reference counter is PL-only.
- Which JTAG programmer the tools can drive.

O2 uses the same `examples/fpga/zybo-z7-10-counter` sources as M5a and does not call Vivado. It records build success, resources, timing, runtime, memory, warnings, and bitstream size, beside the Vivado 2019.1 numbers. Without a board, programming and the LED counter stay `not_tested_no_hardware`.

O3 adds the backend only after that evidence exists. Diagram JSON and VHDL generation stay unchanged.

O4 asks whether a Windows ZIP should contain HDL-Maker plus the free tools, or whether HDL-Maker should stay small and the toolchain should be a separate download. Both answers require the licenses and redistribution terms of every component. A single large ZIP is not assumed to be better.

A later studio view can place the Vivado report and the open-source report for this one counter side by side: resources, timing, and duration. That view waits until O2 has numbers. It is not implemented.

## Branch U — further devices

Planned, and later than V1 and O1. A backend may add Lattice iCE40, Lattice ECP5, Gowin, further AMD/Xilinx devices, or Intel/Altera through that vendor's own tools. Each family lists the operations it implements. A family that is absent from that list is unsupported. No sentence in the product says that every FPGA works with every toolchain.

## Branch R — remote build

Planned as an optional investigation for a university lab. HDL-Maker stays on the student machine. An authorized server runs synthesis and implementation and returns reports and bitstreams. The open questions are the server's toolchain license, authentication, isolation between student projects, the build queue, resource limits, and what is returned. This branch is not implemented, and this document does not choose a protocol.

## Decision order

M5b has programmed a Zybo Z7-20. The next investigations are the V1 study, then the O1 study, then a decision on whether to implement an open-source backend. Branch U and branch R wait. None of V, O, U, or R is a required next milestone after M5b. The core remains usable with GHDL alone.
