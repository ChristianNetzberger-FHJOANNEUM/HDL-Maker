# Development roadmap

This is the reference for HDL-Maker milestone order and scope. Later work follows this file. A change of order or scope is recorded here in the same change that introduces it.

The committed baseline is `d139873` (`first draft`). It contains the studio through P1, the board list, and the hierarchy scan. M2c through M4a.1 are implemented in the working tree and are not committed.

## Status

| Milestone | Name | Status |
| --- | --- | --- |
| M0 | Repository and architecture | Done, committed |
| M1 | Library inventory and component browser | Done, committed |
| M1.5 | Legacy graphical format investigation | Done, working tree |
| M2a | Edit an imported block diagram | Done, working tree |
| M2b | New block diagrams and hierarchy | Done, working tree |
| P1 | Portable student distribution | Done, working tree |
| M2c | State diagrams | Done, working tree |
| M2d | Readable state and transition text | Done, working tree |
| M3a | Structural VHDL-93 / VHDL-2008 | Done, working tree |
| M3b | FSM VHDL | Done, working tree |
| M3c | Legacy FSM validation | Done, working tree |
| M4a | GHDL simulation and GTKWave | Done, working tree |
| M4a.1 | GTKWave integration and verification | Done, working tree. Local GTKWave 3.3.100 only, not in the student ZIP. |
| M4b | Browser waveform view | Planned |
| M5a | Vivado batch synthesis and bitstream | Done, working tree |
| M5b | JTAG programming | Planned, not started |
| M5c | Timing, resources, and ILA | Planned, not started |
| M6 | Legacy diagram migration | Planned, does not block M5 |

## Active sequence

M5a is in the working tree. The next FPGA step is **M5b**, JTAG programming through the Vivado Hardware Manager. It is not started. **M5c** is the later timing, resource, and ILA view. **M4b**, a waveform view inside the browser, stays planned and is not required before M5b. **M6** does not block the FPGA steps.

P1, M2c, and M2d are already finished in the working tree. An earlier note suggested packaging only after M5. Packaging was done first so each later milestone can be shipped with `packaging/build_release.ps1`. That decision stands. A later milestone does not start a second packaging project. The existing student ZIP was built before M2c and before the MIT `LICENSE` file.

M4a.1 is in the working tree. GTKWave 3.3.100 opened the generated GHW and VCD files on this machine. That binary stays a local test tool.

M5a is in the working tree. Vivado 2019.1 synthesized the Zybo Z7-10 counter and wrote a bitstream. The board was not programmed. Do not start M5b, M5c, or M4b as part of that work.

## Standing rules

- Original libraries under `libs/` are never modified. HDL-Maker does not write proprietary HDL Designer files.
- Imported HDL, scripts, and constraints are untrusted. A scan records them. It does not execute them.
- Tcl from an imported project runs only after an explicit user action that authorizes that file.
- Missing ports, modes, widths, pin numbers, I/O standards, clock periods, and FPGA part numbers stay unresolved. They are not invented.
- The API and the packaged app bind to `127.0.0.1` only.
- External tools are started with an argument list, a fixed working directory, streamed output, cancellation, and a timeout. Project paths are not concatenated into a shell command.
- Proprietary tools such as Vivado and Vitis are optional installs. They are not bundled in the student ZIP.
- Generated build files stay outside the source project and outside `libs/`. Each FPGA build has its own directory under `workspace/builds/`. An earlier build is left in place.
- The toolchain adapter has a vendor-neutral boundary. Vivado is the first adapter, not the only one the boundary can hold.
- Do not commit or push without an explicit request.

## License

The project owner selected the MIT License. The text is `LICENSE`, copyright Christian Netzberger, 2026. Third-party files keep their own notices. See `docs/third-party-notices.md`.

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

The existing ZIP does not include the state-diagram editor, VHDL generation, simulation, or FPGA implementation. M2c is in the working tree and is not in that ZIP.

## M2c — State diagrams

Import the 14 `.sm` files into an editable machine: 126 placed states and 189 placed transitions, including their positions. Palette records without a `uid` are reported and are not placed. A link is bound to the one state whose name it repeats. Reset, recovery, and interrupt anchors stay anchors. The working copy is saved under `workspace/diagrams/`. The original `.sm` file is not written. Known limits are in `docs/m2c-limitations.md`.

An edited machine later becomes an entity the block editor can instantiate. That step is M3b. Before that, M2d makes the same texts readable on the canvas.

## M2d — Readable state and transition text

This step is essential for the user and comes before VHDL generation. M2c already keeps every placed state's entry, during, and exit text and every placed transition's condition, actions, and priority. On the canvas a condition is one line on the first spline segment, and a state shows only the first action line inside the circle. Long texts cover the wires and the neighbouring states. `morse_transmitter` is the reference picture for that problem.

HDL Designer stores those texts in their own rectangles: the state action block, and the transition block with its condition text and its action text. Each rectangle has the coordinates the file already states. M2d reads those rectangles, draws the full text inside them with wrapping, and lets the user move each box on the workspace copy. A text the file states and whose rectangle is missing is reported and is not given a guessed position. The strings M2c already stored stay the source for later VHDL. The original `.sm` file is not written.

Deliverable, done in the working tree: the imported `morse_transmitter` machine shows its state actions and its transition conditions and actions in those boxes, and a box can be moved so it no longer covers a neighbour. A hidden rectangle is reported and is not drawn. Limits are in `docs/m2d-limitations.md`.

## M3a — Structural VHDL-93 / VHDL-2008

Emit deterministic structural VHDL from an editable block diagram. The project stores `vhdl_standard` as `"93"` or `"2008"`. New projects start at VHDL-93. The Preferences tab edits that project setting and shows it in Generate HDL. Font size and the selected board stay in `ui.json`. Diagram coordinates stay on the diagram.

One analyzer builds a language-neutral netlist. The VHDL-93 and VHDL-2008 backends are output rules for that netlist. VHDL-93 omits constructs that need a VHDL-2008 parser and stops with a diagnostic instead of rewriting them. VHDL-2008 emits only constructs this milestone implements. Selecting VHDL-2008 does not mean a Vivado install accepts the file. A later M5 toolchain profile can add its own restrictions.

Output is `workspace/generated/vhdl-93/` or `workspace/generated/vhdl-2008/`, plus `manifest.json`. The manifest records the selected standard. Sources under `libs/` are not written. Limits and the three compatibility layers (language standard, GHDL, Vivado) are in `docs/m3a-limitations.md`.

GHDL 6.0.0 mcode analyzed and elaborated the reference hierarchy for VHDL-93 and VHDL-2008 in separate work directories. Vivado 2019.1 was not run, so this milestone does not claim that those generated files synthesize there.

## M3b — FSM VHDL

Generate VHDL-93 and VHDL-2008 from an editable state diagram. The generator reads the stored interface, states, and transitions. It does not read text-box positions or spline points. A block diagram can instantiate the resulting entity through the M3a hierarchy.

`morse_transmitter` is the reference machine. `audio_fifo_ctrl` and `speed_trap` cover a clock enable, an interrupt, and the split between clocked and combinational actions. GHDL 6.0.0 elaborates a self-contained machine in both standards. The three imported machines keep their Synopsys package clauses. The default GHDL command does not add `-fsynopsys`. The optional legacy profile and the `morse_transmitter` comparison are M3c. Limits: `docs/m3b-limitations.md`.

## M3c — Legacy FSM validation

Keep the generated VHDL text unchanged and add an optional GHDL library profile beside `vhdl_standard`. `ieee` is the default and passes only `--std=93` or `--std=08`. `synopsys` also passes `-fsynopsys` and `-fexplicit` on analysis, elaboration, and simulation. Package clauses are not rewritten, and `numeric_std` is not substituted.

`utilities` is analyzed before `morse_transmitter`, `audio_fifo_ctrl`, and `speed_trap`. A missing file is a diagnostic and GHDL is not started. With the legacy profile, GHDL 6.0.0 analyzes and elaborates the original and the generated file of each machine for both language standards. Elaboration is recorded separately from a functional comparison.

The first comparison is `morse_transmitter` only. The original and the generated architecture run in separate work directories on the same open-loop stimulus. The change log of `fifo_rd`, `morse_code`, and `morse_fcw` matched for 19,300,012 cycles, including reset, later ticks, an empty FIFO, and two mark lengths. `audio_fifo_ctrl` and `speed_trap` were not simulated. Details: `docs/m3c-validation.md`.

## M4a — GHDL simulation and GTKWave

Run a VHDL testbench from the studio. The testbench is chosen explicitly. The hierarchy root is not assumed to be a testbench. The language standard and the library profile are the project settings. Stop time, waveform format, and testbench generic overrides are stored on the project, not in `ui.json`.

The run resolves design-unit dependencies, then uses the same GHDL flags as M3c: `--std=93` or `--std=08`, and `-fsynopsys -fexplicit` only for the legacy profile. Each run keeps its own directory under `workspace/simulations/`. Analysis, elaboration, and simulation failures stay separate. GHW is the preferred waveform. VCD is the alternative. GTKWave opens the file when it is on `PATH`. It is not installed automatically. A signal map records stable object ids beside hierarchical VHDL names for a later viewer. Details: `docs/m4a-simulation.md`.

## M4a.1 — GTKWave integration and verification

GTKWave stays an external viewer. The executable path is `workspace/tools.json`. An empty path uses `PATH`. A path that is not a file is reported, and the waveform is kept. One optional `.gtkw` file belongs to the simulation configuration and is passed through when it exists. A missing save file is not replaced with a generated signal list.

VCD headers are compared with the prepared map. A stored path that is absent, and a VCD name that has no object id, are diagnostics. GHW names are not read back and are not guessed. The viewer process is detached from the API. Details, including the official Windows build that was not installed: `docs/m4a1-gtkwave.md`.

## M4b — Browser waveform view

Show the waveform inside the studio and let a click on a port or net select the matching signal. M4a prepared the object-id map and did not build that viewer. Stimulus editing and interactive forcing stay here as well.

Vivado XSim, Verilator, and mixed-language simulation can later use the same simulator boundary. They are not part of M4. M5 does not replace M4: synthesis is not a simulation.

## M5 — FPGA implementation and deployment

Integrate an external FPGA toolchain so a student can implement a design without creating the vendor project by hand. HDL-Maker does not contain a synthesizer or a place-and-route algorithm. The work is split:

| Step | What it does |
| --- | --- |
| M5a | Vivado non-project batch: synthesis, or implementation and bitstream |
| M5b | JTAG programming through the Vivado Hardware Manager |
| M5c | Timing and resource views in the studio, and later ILA |

The board catalog stays the `boardfiles/` folder. The studio's Target board list is one entry per `board.xml`. The saved choice is that file's relative path. The FPGA part is read from the selected file. A part that the file does not name stops the build. No other device is substituted. Pin numbers, I/O standards, and clock periods are not guessed. Details of the batch flow: `docs/m5a-vivado.md`.

### M5a — Vivado batch

Done in the working tree. The first flow is Vivado non-project mode, not project mode. Synthesis and bitstream are separate runs. A passed synthesis leaves the later stages at `not_run` and does not report a bitstream.

The project stores the FPGA top-level entity, the board, the part, the XDC paths, and the target. The VHDL standard and the library profile are the existing project fields. The top entity is not the simulation testbench and not the hierarchy root. Constraints are external XDC files. A missing pin, I/O standard, or clock on a port that the top architecture uses as a clock is a diagnostic, and the run does not start. HDL-Maker does not write an XDC from a port-to-resource mapping in this step.

`vivado.bat` is local tool configuration in `workspace/tools.json`. The global `PATH` is not changed. Vivado is not bundled. On Windows the argument list is `cmd.exe /d /c vivado.bat -mode batch -source <script>`, with `shell=False`. Each build is a new directory under `workspace/builds/`.

Vivado 2019.1 on this machine synthesized `examples/fpga/zybo-z7-10-counter` for `xc7z010clg400-1` and wrote a bitstream. The only DRC finding was warning ZPS7-1, because the design does not contain the Zynq PS7 cell. No PS, Vitis, or block design was added. The board was not programmed.

### M5b — JTAG programming

Not started. Detect connected hardware through the Vivado Hardware Manager, match it to the selected board, ask for confirmation that names the device, and download the bitstream over JTAG. The first mode is volatile configuration. Persistent boot images and flash programming stay outside M5b.

### M5c — Reports and ILA

Not started. M5a already writes utilization, timing, and DRC files into the build directory and can open those files. A studio summary of timing and resources, and a hardware debugger that reads ILA probes back onto diagram nets, belong here.

### Outside M5

- Vitis, XSA export, and Zynq Processing System software.
- Embedded Linux.
- AXI IP Integrator and a generated block design.
- Intel Quartus and Lattice toolchains. The adapter boundary can hold them later.
- Programming whatever device happens to be first in the JTAG chain.
- A new release ZIP. The existing student package is unchanged.

## M6 — Legacy diagram migration

M1.5 investigated the graphical sources. A later migration edits more of the imported diagrams and generates VHDL for the constructs that can be recovered reliably. Writing proprietary HDL Designer files is not a goal. SystemVerilog import beyond the current inventory, XSim, Verilator, and mixed-language simulation come after the teaching chain.

## Later, not scheduled

- A second, browser-only distribution. The portable Windows app remains the distribution for the Python backend.
- A hardware-debugger view of ILA probes on the block diagram.
- Additional FPGA vendors behind the M5 adapter boundary.

## First demonstration

`examples/` contains an 8-bit counter, a comparator, and a small controller FSM. M1 imports them. M2 edits and connects them. M2c edits the controller state diagram. M2d makes its actions and conditions readable. M3 generates VHDL. M4 simulates it. M5a implements a separate Zybo Z7-10 counter through Vivado and does not program the board.
