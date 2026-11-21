# Development roadmap

This is the reference for HDL-Maker milestone order and scope. Later work follows this file. A change of order or scope is recorded here in the same change that introduces it.

The committed baseline is `2a5fb34` (studio scaffold and VHDL library inventory). M1.5, M2a, M2b, and P1 are implemented in the working tree and are not committed.

## Status

| Milestone | Name | Status |
| --- | --- | --- |
| M0 | Repository and architecture | Done, committed |
| M1 | Library inventory and component browser | Done, committed |
| M1.5 | Legacy graphical format investigation | Done, working tree |
| M2a | Edit an imported block diagram | Done, working tree |
| M2b | New block diagrams and hierarchy | Done, working tree |
| P1 | Portable student distribution | Done, working tree |
| M2c | State diagrams | Next |
| M3 | VHDL generation | Planned |
| M4 | Simulation | Planned |
| M5 | FPGA implementation and deployment | Planned, specified below |
| M6 | Legacy diagram migration | Planned, does not block M5 |

## Active sequence

The next milestones run in this order:

1. **M2c** — import and edit state diagrams.
2. **M3** — generate VHDL-2008 from the editable documents.
3. **M4** — simulate with GHDL.
4. **M5** — implement and program a supported FPGA board through an external toolchain.
5. **M6** — migrate further legacy diagram constructs, after the teaching chain above.

P1 is already finished. An earlier note suggested packaging only after M5. Packaging was done first so each later milestone can be shipped with `packaging/build_release.ps1`. That decision stands. A later milestone does not start a second packaging project.

Do not start M2c, M3, M4, or M5 inside another milestone. Stop at the milestone boundary and report what was verified.

## Standing rules

- Original libraries under `libs/` are never modified. HDL-Maker does not write proprietary HDL Designer files.
- Imported HDL, scripts, and constraints are untrusted. A scan records them. It does not execute them.
- Tcl from an imported project runs only after an explicit user action that authorizes that file.
- Missing ports, modes, widths, pin numbers, I/O standards, clock periods, and FPGA part numbers stay unresolved. They are not invented.
- The API and the packaged app bind to `127.0.0.1` only.
- External tools are started with an argument list, a fixed working directory, streamed output, cancellation, and a timeout. Project paths are not concatenated into a shell command.
- Proprietary tools such as Vivado and Vitis are optional installs. They are not bundled in the student ZIP.
- Generated build files stay outside the source project and outside `libs/`. An existing build artifact is overwritten only after confirmation.
- The toolchain adapter has a vendor-neutral boundary. Vivado is the first adapter, not the only one the boundary can hold.
- Do not commit or push without an explicit request.

## Open decisions

These are unresolved. Implementation does not pick an answer silently.

| Decision | What it blocks |
| --- | --- |
| MIT or GPLv3 | A `LICENSE` file. None is added until this is chosen. |

## M0 — Repository and architecture

Frontend and backend start on Windows 11. Schema version 1, the health check, and these documents exist.

## M1 — Library inventory and component browser

Recursive scan, VHDL interface extraction, library tree, read-only entity symbols, source inspection, and an import report. The importer also runs without the UI.

Deliverable: the VHDL entities under `examples/` can be browsed and inspected.

## M1.5 — Legacy graphical format investigation

Read HDL Designer `.bd`, `.sb`, `.sm`, and `._epf` files without modifying them. Show one imported block diagram in Vue Flow at the original coordinates. Persistent ids are random and are rematched on the next import.

Deliverable: `docs/hds-format-investigation.md` and a read-only diagram view.

## M2a — Edit an imported block diagram

Copy one imported block diagram into the studio's own JSON file. Move instances, add library components, connect and disconnect ports, rename nets and labels, keep orthogonal wire geometry, and save under `workspace/diagrams/`. The HDL Designer file stays read-only.

## M2b — New block diagrams and hierarchy

Create a block diagram that did not come from an import. Give it top-level ports and generics, instantiate library entities and other workspace designs, and keep nets and wires separate. Known limits are in `docs/m2b-limitations.md`.

## P1 — Portable student distribution

A Windows ZIP starts HDL-Maker without Node.js, npm, or a separate Python install. Development still uses the Vite server on port 5173 and the API on port 8000. The packaged app serves the built page and the API on one localhost origin. Projects are stored under the user's Documents folder. Details and the test report: `docs/student-edition.md`, `docs/p1-test-report.md`.

This package does not include the state-diagram editor, VHDL generation, simulation, or FPGA implementation.

## M2c — State diagrams

Import the 14 `.sm` files into an editable machine: 126 states and 189 transitions, including their positions. Do this before the VHDL generator. An edited machine later becomes an entity the block editor can instantiate.

## M3 — VHDL generation

Emit deterministic VHDL-2008 from the editable block diagram and, after M2c, from the editable state machine. Read the studio documents, not the canvas and not the HDL Designer file. A design of at least three connected components must pass GHDL analysis and elaboration. This milestone requires GHDL on `PATH`. SystemVerilog generation stays behind the same model and is not part of M3.

## M4 — Simulation

Run GHDL from the studio: dependency order, elaboration, testbench, diagnostics, timeout, cancellation, and a VCD file. View waveforms in GTKWave. No embedded waveform viewer in this milestone.

Vivado XSim, Verilator, and mixed-language simulation can later use the same simulator-adapter boundary. They are not part of M4. M5 does not replace M4: synthesis is not a simulation.

## M5 — FPGA implementation and deployment

Integrate an external FPGA toolchain so a student can implement and program a design without creating the vendor project by hand. HDL-Maker does not contain a synthesizer or a place-and-route algorithm.

### Architecture

A Python toolchain adapter in the backend. The first adapter is AMD Vivado, used in batch mode through a generated Tcl script. The board catalog is the `boardfiles/` folder (the Vivado 2019.1 definitions kept in this checkout, including Zybo and Zybo Z7-20). The studio's Target board list is one entry per `board.xml`. Adding a folder that contains `board.xml` extends the list. The saved choice is that file's relative path. M5 reads the part number from the selected file and does not substitute another board. Pin and timing data still have to be taken from that file; they are not guessed.

The student actions, once the earlier milestones exist, are Generate HDL, Build FPGA, and Program Board. Vivado's graphical IDE stays closed.

### Toolchain detection

- Locate installed Vivado versions and remember a configurable install path.
- Report whether the selected part is supported by that install.
- Do not bundle AMD software.

### Board manager

A versioned board profile stores the board name, the FPGA part, clocks, LEDs, buttons, switches, I/O standards, and the constraint source. Pin and timing data are imported from the vendor or board-maker files for that exact board. A profile does not guess a pin.

The studio maps top-level HDL ports to board resources, for example `clk` to the board clock or `led(0)` to LED 0. HDL-Maker checks the mapping against the profile: every mapped port exists, the width matches the resource, the I/O standard is one the profile allows, and a clock has a period from the profile. From a valid mapping it writes an XDC file. An incomplete mapping is reported and is not filled in.

### Build

- Generate a reproducible Tcl script for Vivado project mode.
- Include the generated VHDL or SystemVerilog sources, the referenced libraries, the top-level design, and the XDC file.
- Keep the generated project and reports in a build directory, separate from the student source project and from `libs/`.
- Run synthesis, implementation, and bitstream generation.
- Stream the log, allow cancellation, and keep a build history.
- Collect timing, utilization, and DRC reports.
- A non-project Tcl flow may follow project mode. It is not the first flow.
- If the selected part and the profile part differ, the build stops. HDL-Maker does not substitute another device.

Invocation uses `Popen` with an argument list (`vivado.bat -mode batch -source <script>`), streamed stdout, cancellation, and a timeout. `shell=True` is not used.

### Programming

- Detect connected hardware through the Vivado Hardware Manager.
- Match the connected device to the selected board profile.
- Ask for an explicit confirmation that names the device about to be programmed.
- Download the bitstream over JTAG and report success or failure.
- The first programming mode is volatile JTAG configuration. The configuration is lost when the board powers off.
- Persistent boot images, flash programming, and boot-file generation are outside the first M5 delivery.

### Outside the first M5 delivery

- Vitis, XSA export, and Zynq Processing System software. A pure logic design needs Vivado only. Vitis starts when a student builds software for the ARM core.
- Embedded Linux.
- A hardware debugger that reads Vivado ILA probes back onto diagram nets.
- Intel Quartus and Lattice toolchains. The adapter boundary should allow them later. They are not implemented in M5.
- Programming whatever device happens to be first in the JTAG chain.

### Verification

When the board choice is recorded and Vivado is installed, verify one LED-counter demonstration on that board:

1. HDL generation from the studio document.
2. Constraint validation against the imported board profile.
3. Vivado synthesis.
4. Implementation and bitstream generation.
5. JTAG programming of the matched device after confirmation.
6. The LEDs behave as specified on the physical board.

If the board or Vivado is absent, report that the hardware steps were not run. Do not record a simulated hardware pass.

## M6 — Legacy diagram migration

M1.5 investigated the graphical sources. A later migration edits more of the imported diagrams and generates VHDL for the constructs that can be recovered reliably. Writing proprietary HDL Designer files is not a goal. SystemVerilog import beyond the current inventory, XSim, Verilator, and mixed-language simulation come after the teaching chain.

## Later, not scheduled

- A second, browser-only distribution. The portable Windows app remains the distribution for the Python backend.
- A hardware-debugger view of ILA probes on the block diagram.
- Additional FPGA vendors behind the M5 adapter boundary.

## First demonstration

`examples/` contains an 8-bit counter, a comparator, and a small controller FSM. M1 imports them. M2 edits and connects them. M2c edits the controller state diagram. M3 generates VHDL. M4 simulates it. M5, after the board decision, implements an LED counter on that board.
