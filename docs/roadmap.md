# Development roadmap

This is the reference for HDL-Maker milestone order and scope. Later work follows this file. A change of order or scope is recorded here in the same change that introduces it.

The teaching milestones M0–M6 are one development line. An FPGA toolchain is an optional backend of that same HDL-Maker, under the same MIT license. Branch D is the reusable diagram engine. HDL-Maker and a later course site are adapters on that engine. The engine does not include VHDL generation or an FPGA backend. Details are in [diagram-engine-architecture.md](diagram-engine-architecture.md). Branch V is Vivado. Branch O is an open-source flow. Branch U is other vendors and families. Branch R is a remote build server. The branches are parallel, and any of them may stay unused. The FPGA boundary is specified in [fpga-toolchain-architecture.md](fpga-toolchain-architecture.md). Branches D and E do not depend on a toolchain. Branch O has a local Windows feasibility run, recorded in [o1-open-source-toolchain.md](o1-open-source-toolchain.md). That run is not a product backend. **O5** is a long-term distribution study in [international-open-source-distribution.md](international-open-source-distribution.md). It does not block O2, O3, or O4, and it does not block branches D or E. Branches U and R are not installed and have no implementation. Learning Mode and SystemVerilog stay later studies on the design model and are not part of D.

Status words:

| Label | Meaning |
| --- | --- |
| Implemented | The function is in a commit or in the working tree. |
| Tested in software | A test or a tool run checked the function without the FPGA board. |
| Tested on hardware | The bitstream was downloaded and the board behavior was checked. |
| Planned | Recorded as future work. No code and no tool run for that item. |
| Experimental | An external project describes the flow as incomplete or unofficial. HDL-Maker has not accepted it as a supported backend. |
| License unresolved | The right to run a tool and the right to redistribute its files have not both been read and recorded. |

The committed baseline is `bd5defa` (`vivado integration step1`). It contains the studio through M5a. M5b is implemented in the working tree and is not committed. `d139873` (`first draft`) remains the earlier studio baseline.

## Status

| Milestone | Name | Status |
| --- | --- | --- |
| M0 | Repository and architecture | Done, committed |
| M1 | Library inventory and component browser | Done, committed |
| M1.5 | Legacy graphical format investigation | Done, committed in `d139873` |
| M2a | Edit an imported block diagram | Done, committed in `d139873` |
| M2b | New block diagrams and hierarchy | Done, committed in `d139873` |
| P1 | Portable student distribution | Done, committed in `d139873` |
| M2c | State diagrams | Done, committed in `bd5defa` |
| M2d | Readable state and transition text | Done, committed in `bd5defa` |
| M3a | Structural VHDL-93 / VHDL-2008 | Done, committed in `bd5defa` |
| M3b | FSM VHDL | Done, committed in `bd5defa` |
| M3c | Legacy FSM validation | Done, committed in `bd5defa` |
| M4a | GHDL simulation and GTKWave | Done, committed in `bd5defa` |
| M4a.1 | GTKWave integration and verification | Done, committed in `bd5defa`. Local GTKWave 3.3.100 only, not in the student ZIP. |
| M4b | Browser waveform view | Planned |
| M5a | Vivado batch synthesis and bitstream | Implemented, committed in `bd5defa`. Bitstream written. Board not programmed. |
| M5b | JTAG programming | Tested on hardware. Working tree, not committed. |
| M5c | Timing, resources, and ILA | Planned. Branch V. |
| M6 | Legacy diagram migration | Planned, does not block the FPGA branches |
| V1 | Vivado minimal-install study | Planned. License unresolved for redistribution. |
| O1 | Open-source feasibility on Windows | Investigated. Bitstream written, not programmed, not in the UI. |
| O2a | Open-source build pipeline | In the backend. Not in the UI. Not programmed. |
| O2b | Open-source hardware check | Tested on hardware. SRAM load, green DONE LED, LED0 about 1 s. |
| O3–O4 | Studio backend and student package | O3a is in the FPGA Build tab. O3b keeps each build directory and separates hardware status. Not programmed again. O4 planned. |
| O5 | International open-source distribution | Planned. License unresolved. Does not block O2, O3, O4, or branch E. |
| E0 | One diagram editor | Implemented. Tested in software. Opening a block or state diagram edits the workspace model. The HDL Designer file is not written. |
| E1 | Readable block diagrams | Implemented. Tested in software on `hds/top_rtc_app/struct.bd`. Port names and signal names use recorded fields only. |
| D0 | Diagram engine prototype | Built in `diagram-lab`. No HDL-Maker migration. [d0-feasibility.md](d0-feasibility.md). |
| D1 | General block editor | Built in `diagram-lab`. Commands, selection, JSON storage, palette. No HDL integration. Scale, z-order, and SVG export remain open. |
| D2 | Nets and wires | Built in `diagram-lab`. Branches, junctions, labels, manual routes. No HDL integration. |
| D3a | Symbol definition and instance | Built in `diagram-lab`. Stable port ids. No symbol editor and no HDL integration. |
| D3b | Graphical symbol editor | Built in `diagram-lab`. Shapes, text, and four-sided pins. No SVG import and no HDL fields. |
| D3c | Symbol library and palette | Built in `diagram-lab`. Built-in catalogs, a user library, and copy-on-place. No HDL and no SVG import. |
| D3d | SVG and bitmap assets | Built in `diagram-lab`. Embedded pictures, free pins, and one copy per checksum. No HDL. |
| D3e | Symbol migration UI | Built in `diagram-lab`. Explicit update, pin-id compare, no automatic refresh. No HDL. |
| D4a | Component and project model | Built in `diagram-lab`. Shared definitions, interface ids, no HDL. |
| D4b | Hierarchical navigation | Built in `diagram-lab`. Double-click, tree, breadcrumbs, shared undo. No HDL. |
| D4c | Component interface authoring | Built in `diagram-lab`. Logical ports, explicit pin bindings, project undo. No HDL. |
| D4d | Hierarchical design operations | Built in `diagram-lab`. Extract, expand, make unique. No HDL. |
| D5a | Functional acceptance of the diagram lab | Prepared in `diagram-lab`. Three reference projects and a checklist. The user's session is the acceptance. No HDL. |
| D5a.1 | Interactive top-down authoring | Built in `diagram-lab`. Accepted by the user on 25 Nov 2026. No HDL. |
| D5a.2 | Interactive block resizing | Built in `diagram-lab`. Accepted by the user on 25 Nov 2026. No HDL. |
| D5a.3 | Interactive port authoring | Accepted. D5a.3a–D5a.3c closed. D5a complete. No HDL. |
| D5b | One undo history | Released. Through **D5b.5b** accepted. Full D5b.5 / D5b.6 locked. [d5b5b-wire-draft-pan.md](d5b5b-wire-draft-pan.md). |
| D5c | Drawing tools and interaction | Through **D5c.6** accepted; **D5c.7** wire-copy **spec only** (deferred implement). [d5c7-wire-copy-spec.md](d5c7-wire-copy-spec.md). |
| D5d | Large diagrams | Planned. Not started. |
| D5e | Diagram export and documentation | Planned. Not started. |
| D5f | Vue 3 component library | Planned. Not started. |
| CL0–CL7 | Component Library System | Strategic extension **accepted**. Planned; not started; not released for implementation. [component-library-system-architecture.md](component-library-system-architecture.md). |
| EDU0–EDU6 | Educational Web Applications | Strategic extension **accepted**. Planned; not started; not released for implementation. [educational-web-editor-architecture.md](educational-web-editor-architecture.md). |
| E2 | Hierarchy navigation | Planned. Covered by D4. Not a separate implementation. |
| E3 | FSM property model | Planned. A later HDL step after D5. No second property schema. M3b stays until a comparison. |
| E4 | Graphical FSM editing | Planned. A later use of the diagram engine, after D5. |
| E5 | Full block-diagram editing | Planned. Covered by D1 and D2. |
| E6 | Editor comfort functions | Planned. After D5. elkjs is not approved. |
| U | Further FPGA families | Planned. |
| R | Remote FPGA build | Planned. Optional. Not implemented. |

## Active sequence

**D0** is a standalone diagram lab, recorded in [d0-feasibility.md](d0-feasibility.md). **D1** is the general block editor in that same lab. **D2** is the net editor. **D3a** is the symbol definition and the instance. **D3b** draws that symbol and updates every instance. **D3c** copies a library symbol into the document and places it from a palette. **D3d** embeds SVG and bitmap pictures in that symbol. **D3e** compares a library symbol with the document copy and updates every instance only after confirmation. **D4a** adds a component definition and a project container. **D4b** opens a child sheet from a double-click, the project tree, or a breadcrumb. **D4c** edits logical ports and creates an implementation only by an explicit command. **D4d** extracts a selection into a component and can expand one instance. **D5a** prepares three reference projects and a checklist; the acceptance is a session in the lab. **D5a.1** lets a drawn block become a component from the sheet. The user accepted that flow on 25 Nov 2026. **D5a.2** scales one instance from eight handles and draws the symbol in that box. The user accepted that step on 25 Nov 2026. **D5a.3** adds and moves ports on any side of one instance. D5a.3a–D5a.3c are accepted; D5a.3 and D5a are complete. **D5b** is released. Through **D5b.5b** accepted; full D5b.5 and D5b.6 stay locked until released. D4f, D4g, and D5c through D5f have not started. M5b is **Tested on hardware**. The record is below and in [m5b-jtag.md](m5b-jtag.md). **O1** is investigated in [o1-open-source-toolchain.md](o1-open-source-toolchain.md). **O2a** is in the backend, recorded in [o2a-open-source-build.md](o2a-open-source-build.md), and does not program the FPGA. **O2b** is **Tested on hardware**. The open-source bitstream was loaded into SRAM, the DONE LED was green, and LED0 blinked about once per second. The record is [o2b-open-source-hardware.md](o2b-open-source-hardware.md). **O5** is planned and does not move ahead of O2b. **V1** is prepared and is not started. The `Labtoolstcl 44-560` Tcl warning is a later cleanup. **M5c** stays a later Vivado report view. **M4b** stays planned. **U** and **R** are later optional branches. **M6** does not block them.

P1, M2c, and M2d are finished and committed. An earlier note suggested packaging only after M5. Packaging was done first so each later milestone can be shipped with `packaging/build_release.ps1`. That decision stands. A later milestone does not start a second packaging project. The existing student ZIP was built before M2c and before the MIT `LICENSE` file.

M4a.1 is committed in `bd5defa`. GTKWave 3.3.100 opened the generated GHW and VCD files on this machine. That binary stays a local test tool.

M5a is committed in `bd5defa`. Vivado 2019.1 synthesized the Zybo Z7-10 counter and wrote a bitstream.

M5b is **Tested on hardware** and is still in the working tree. It scans JTAG devices and programs only a device the user names. M5c and M4b stay unstarted. O2a can repeat the open-source bitstream build. It is not in the window and it does not program the FPGA.

## Standing rules

- Original libraries under `libs/` are never modified. HDL-Maker does not write proprietary HDL Designer files.
- Imported HDL, scripts, and constraints are untrusted. A scan records them. It does not execute them.
- Tcl from an imported project runs only after an explicit user action that authorizes that file.
- Missing ports, modes, widths, pin numbers, I/O standards, clock periods, and FPGA part numbers stay unresolved. They are not invented.
- The API and the packaged app bind to `127.0.0.1` only.
- External tools are started with an argument list, a fixed working directory, streamed output, cancellation, and a timeout. Project paths are not concatenated into a shell command.
- Proprietary tools such as Vivado and Vitis are optional installs. They are not bundled in the student ZIP. A local copy that runs is not permission to redistribute those files.
- Publishing HDL-Maker as open source is not treated as permission to export it, or its dependencies, to every recipient. That question is O5 and is not a clearance.
- Generated build files stay outside the source project and outside `libs/`. Each FPGA build has its own directory under `workspace/builds/`. An earlier build is left in place.
- The toolchain adapter has a vendor-neutral boundary. Vivado is the first adapter. Further adapters are specified in [fpga-toolchain-architecture.md](fpga-toolchain-architecture.md) and stay unbuilt until their studies exist.
- A published device database or binary package is not treated as a working backend until this repository has run the build.
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

This section is branch V, the Vivado backend. HDL-Maker does not contain a synthesizer or a place-and-route algorithm. The Vivado work is split:

| Step | What it does |
| --- | --- |
| M5a | Vivado non-project batch: synthesis, or implementation and bitstream |
| M5b | JTAG programming through the Vivado Hardware Manager |
| M5c | Timing and resource views in the studio, and later ILA |

The board catalog stays the `boardfiles/` folder. The studio's Target board list is one entry per `board.xml`. The saved choice is that file's relative path. The FPGA part is read from the selected file. A part that the file does not name stops the build. No other device is substituted. Pin numbers, I/O standards, and clock periods are not guessed. Details of the batch flow: `docs/m5a-vivado.md`.

### M5a — Vivado batch

Implemented and committed in `bd5defa`. The first flow is Vivado non-project mode, not project mode. Synthesis and bitstream are separate runs. A passed synthesis leaves the later stages at `not_run` and does not report a bitstream.

The project stores the FPGA top-level entity, the board, the part, the XDC paths, and the target. The VHDL standard and the library profile are the existing project fields. The top entity is not the simulation testbench and not the hierarchy root. Constraints are external XDC files. A missing pin, I/O standard, or clock on a port that the top architecture uses as a clock is a diagnostic, and the run does not start. HDL-Maker does not write an XDC from a port-to-resource mapping in this step.

`vivado.bat` is local tool configuration in `workspace/tools.json`. The global `PATH` is not changed. Vivado is not bundled. On Windows the argument list is `cmd.exe /d /c vivado.bat -mode batch -source <script>`, with `shell=False`. Each build is a new directory under `workspace/builds/`.

Vivado 2019.1 on this machine synthesized `examples/fpga/zybo-z7-10-counter` for `xc7z010clg400-1` and wrote a bitstream. The only DRC finding was warning ZPS7-1, because the design does not contain the Zynq PS7 cell. No PS, Vitis, or block design was added. The board was not programmed.

### M5b — JTAG programming

**Tested on hardware.** The flow is in the working tree and is not committed. It uses the Vivado 2019.1 commands `open_hw`, `connect_hw_server`, `get_hw_targets`, `get_hw_devices`, and `program_hw_devices`. The user scans, chooses one device, and confirms that device by name. The first device is not used when several are present. A mock program is labeled as a mock and does not count as a programmed FPGA.

The Zybo Z7-20 is the hardware board for later toolchain comparisons. The Z7-10 example under `examples/fpga/zybo-z7-10-counter` is unchanged and was not the programmed bitstream.

| Item | Value |
| --- | --- |
| Board | Zybo Z7-20, jumper JP5 on JTAG |
| Bitstream part | `xc7z020clg400-1`, from `boardfiles/zybo-z7-20/A.0/board.xml` |
| JTAG device | `xc7z020_1`, part property `xc7z020`, IDCODE `23727093` |
| Vivado | v2019.1 (64-bit), SW Build 2552052 |
| Build | `bld_34d0198b02b84f73b25a8aa305579d5a` |
| Program | `prg_c96275d4116948768d5c9c8079532cc8` |
| Bitstream size | 4,045,672 bytes |
| DONE | Startup HIGH. `BIT14_DONE_PIN` 1. DONE LED green. |
| LED0 | M14 blinked with about a 1.07 s period |

| Step | Result |
| --- | --- |
| VHDL source `zybo_counter.vhd` | Used. The running configuration came from this file. |
| Vivado synthesis | Passed |
| Place, route, and timing | Passed. WNS 5.520 ns, WHS 0.040 ns |
| Bitstream | Passed |
| JTAG detection | Passed. One Digilent target, DAP plus `xc7z020` |
| FPGA programming | Passed. `jtag_download` `completed`, `mock` false |
| DONE = HIGH | Passed |
| LED0 about 1.07 s | Passed |

`WARNING: [DRC ZPS7-1]` and `WARNING: [Labtoolstcl 44-560]` are warnings. They are not test failures. ZPS7-1 says the PL-only counter has no PS7 cell. The bitstream was still written, and the LED ran. `44-560` says `-type bit` is ignored unless `HWX.FILE` is set. The file came from `PROGRAM.FILE`, and DONE went high. Cleaning the Tcl flag is later work.

An earlier scan with no cable reported `Labtoolstcl 44-199` and is kept in `workspace/hardware/m5b-no-board`. Details: `docs/m5b-jtag.md`.

### M5c — Reports and ILA

Not started. M5a already writes utilization, timing, and DRC files into the build directory and can open those files. A studio summary of timing and resources, and a hardware debugger that reads ILA probes back onto diagram nets, belong here.

### Outside M5

- Vitis, XSA export, and Zynq Processing System software.
- Embedded Linux.
- AXI IP Integrator and a generated block design.
- Intel, Lattice, Gowin, and further AMD devices. Those families are branch U. Each family lists its own capabilities when a backend exists.
- Programming whatever device happens to be first in the JTAG chain.
- A new release ZIP. The existing student package is unchanged.
- Copying Vivado, or any other toolchain, into the repository or a student package. V1 and O4 have to settle redistribution first. That question is license unresolved.

## M6 — Legacy diagram migration

M1.5 investigated the graphical sources. A later migration edits more of the imported diagrams and generates VHDL for the constructs that can be recovered reliably. Writing proprietary HDL Designer files is not a goal. SystemVerilog import beyond the current inventory, XSim, Verilator, and mixed-language simulation come after the teaching chain.

## Toolchain branches

V, O, U, and R are optional and parallel. Finishing one is not a prerequisite for using the core, and none of them replaces M0–M4. Detail, the proposed backend operations, and the license split between local use and redistribution are in [fpga-toolchain-architecture.md](fpga-toolchain-architecture.md).

The product stays one MIT-licensed HDL-Maker. The tiers are which external tools are present:

| Variant | Tools | Status |
| --- | --- | --- |
| HDL-Maker Core | HDL-Maker, GHDL, optional GTKWave | Implemented through M4a.1 |
| HDL-Maker + Vivado | The user's own Vivado install | Branch V. M5a implemented. M5b tested on hardware: JTAG download, DONE, and LED0. |
| HDL-Maker + Open Source | GHDL, Yosys, nextpnr, bitstream tools | Branch O. O1 investigated locally. Not a product backend. |
| HDL-Maker Remote Build | Local studio, toolchain on a server | Branch R. Planned. Not implemented. |

### V — Vivado

M5a and M5b are this branch. M5c is the planned timing, resource, and ILA view.

**V1 — Minimal Vivado installation study.** Planned. Read the installed Vivado 2019.1 tree and separate an officially reduced install, the files a batch run loads, the local-use entitlement, and any right to redistribute. The installed tree at `C:\Xilinx\Vivado\2019.1` measures 19,808,638,819 bytes. No Vivado file is added to a public HDL-Maker package as part of the study.

### O — Open-source FPGA tools

Experimental. The Windows tools were downloaded into the gitignored `workspace/toolchains/o1/` and used for one counter. They are not part of HDL-Maker, and the bitstream was not programmed. The record is [o1-open-source-toolchain.md](o1-open-source-toolchain.md).

- **O1 — Feasibility on Windows 11.** Investigated. The comparison board is the Zybo Z7-20, part `xc7z020clg400-1`. The Windows openXC7 package places and routes that part and writes a bitstream. It does not synthesize VHDL. VHDL-93 for this counter went through the existing GHDL 6.0.0 as Verilog, then Yosys from OSS CAD Suite. VHDL-2008 was not run. The resulting bitstream is 4,045,674 bytes and was not programmed. Licenses of the tools that ran are recorded in the O1 report. Redistribution of the whole suite remains O4.
- **O2a — Repeatable build.** In the backend. The five O1 stages run for VHDL-93, write `workspace/builds/osb_<id>/`, and do not call Vivado. The Z7-20 counter build `osb_574eb1ad8c3b4ac8a36b359745d3534d` matches the O1 nextpnr counts and writes a 4,045,674-byte bitstream. That file was not programmed. The record is [o2a-open-source-build.md](o2a-open-source-build.md).
- **O2b — Hardware check.** **Tested on hardware.** On 23 November 2026 the open-source bitstream was loaded into SRAM through the D2XX transport, at 1 MHz, on `210351B4009EA`. The load exited 0 and the JTAG DONE bit was 1. The raw IDCODEs remain `0x23727093` and `0x4BA00477`. The DONE LED was green and LED0 blinked about once per second, the same observation as M5b. The record is [o2b-open-source-hardware.md](o2b-open-source-hardware.md).
- **O2b.1 — Programmer choice.** Studied. The chosen path is a D2XX transport under openFPGALoader's existing MPSSE class. UrJTAG is not the programmer, and WinUSB stays unapproved. The record is [o2b1-d2xx-programming.md](o2b1-d2xx-programming.md).
- **O2b.2 — D2XX transport.** A separate Windows build of openFPGALoader opens interface A by the serial `210351B4009EA`. The OSS CAD Suite binary is unchanged and still cannot open `FTDIBUS`. The record is [o2b2-d2xx-transport.md](o2b2-d2xx-transport.md).
- **O2b.3 — SRAM load.** The checked bitstream was loaded with `-m` and without `-f`. Exit code 0. JTAG `done 1`. DONE LED green. LED0 blinked about once per second. O3a is in the FPGA Build tab and did not program the board again.
- **O3 — Integration.** O3a is in the FPGA Build tab. The project stores `vivado` or `opensource`. The open-source side reuses the O2a builder and can call the local D2XX loader for SRAM only, after a named device and a confirmation. The window was not used to program the board again. The record is [o3a-fpga-build.md](o3a-fpga-build.md).
- **O3b — Build records.** Each build keeps its own directory. The manifest stores the build id, toolchain, part, VHDL standard, and bitstream SHA-256. Build success, JTAG detection, SRAM programming, and an observed board function are separate. The earlier programmed open-source file is referenced by `osb_574eb1ad8c3b4ac8a36b359745d3534d` and its hash; that file is no longer in the workspace. The record is [o3b-build-records.md](o3b-build-records.md).
- **L0 — Learning Mode.** Planned. Not implemented. A local offline application, versioned course packages, and one HDL-Maker core. The note is [learning-mode.md](learning-mode.md).
- **SV0 — VHDL and SystemVerilog.** Planned. Not implemented. A language-neutral architecture. No importer and no generator were added.
- **O4 — Portable student edition.** Planned. Compare one ZIP that includes the free tools with a small HDL-Maker package and a separate toolchain download. The Windows Yosys bundle does not include the GHDL plugin.

The FPGA Build tab places the latest passed Vivado bitstream and the latest passed open-source bitstream side by side and labels the timing methods. That view is not a new hardware test.

**O5 — International open-source distribution.** Planned. License unresolved. Optional, and later than the Z7-20 work. It does not block O2, O3, or O4. The study is whether a MIT-licensed HDL-Maker plus free tools can be offered to universities and developers who cannot obtain a proprietary FPGA toolchain, without treating open source as an export clearance. Sub-items, the licence notes already read, and the sources retrieved on 23 November 2026 are in [international-open-source-distribution.md](international-open-source-distribution.md).

- **O5a — Licence inventory.** Planned. License unresolved. Separate published source, redistributable binaries, self-built components, and proprietary files that are not shipped. HDL-Maker stays MIT.
- **O5b — Export-control index.** Planned. A factual reading of Regulation (EU) 2021/821, the General Software Note, Austrian BMWET pages, and EAR publication and encryption rules. Not a classification and not a licence.
- **O5c — Education edition.** Planned. A core studio pack and separate free FPGA packs. Windows 11 first. No npm server for the end user, no Vivado install, and offline use after installation.
- **O5d — University cooperation.** Planned. A possible course shared by FH Joanneum and PAF-IAST in Haripur. No country is cleared or excluded by this roadmap.
- **O5e — Technical independence.** Planned. The studio documents stay backend-independent. One VHDL generator. Further backends are capability profiles, not a second HDL emitter.

### U — Further families

Planned. Lattice iCE40, Lattice ECP5, Gowin, further AMD/Xilinx devices, and Intel/Altera through a vendor toolchain are candidates. A backend names the operations it implements. Unsupported families are absent from that list.

### R — Remote build

Planned, optional, and not implemented. The student runs HDL-Maker locally. An authorized server runs synthesis and implementation. Still open: the server license, authentication, isolation of student projects, the queue, resource limits, and which reports and bitstreams come back.

## CL / EDU — library and education streams (strategic acceptance)

Strategic roadmap extension accepted. Implementation of CL0–CL7 and EDU0–EDU6 remains **locked** until explicit release. See [component-library-system-architecture.md](component-library-system-architecture.md) and [educational-web-editor-architecture.md](educational-web-editor-architecture.md).

| Stream | IDs | Intent |
| --- | --- | --- |
| Component libraries | CL0–CL7 | Domain-neutral libraries, manager, parameters, assets |
| Educational web apps | EDU0–EDU6 | Assignment packs, browser editor, student JSON, viewer/checker |

These do **not** replace Learning Mode **L0** or Studio **E0–E6**. Active priority remains finishing **D5b**, then D5c–D5f as released. Recommendation: schedule **CL0 before D5f** when CL is unlocked.

Dependency sketch (proposal): `D5b → CL0 → CL1/CL2 → EDU1–EDU3` for an MVP course exercise; `D5f` packages the UI; `D5d` before large bitmap libraries; `CL7` / `EDU5` / `EDU6` after MVP.

## D — Diagram engine

D0 is a standalone Vue 3 lab in `diagram-lab`. Vue Flow draws blocks. An SVG layer draws wires, labels, and freehand ink in the same viewport. The document model is not a Vue Flow graph and not `EditableDiagram`. Nets have no coordinates. A label is anchored to one edge of a segment. The lab does not open the Python API and does not rewrite `edg_*.json`.

D1 adds commands, selection, a block palette, grid snap, and `DiagramStorage` with JSON as the first store. A drag is one undo step. Escape restores the gesture. D2 adds orthogonal wires, junctions, net merge and split, and name labels. A net still has no coordinates. D3a adds a symbol definition and instances that cite it. A wire keeps the instance port id when the symbol pin moves. A removed pin stays visible as a diagnosis. D3b draws the symbol with shapes, text, and pins on all four sides, and the instances use that same picture. D3c adds built-in and user libraries. A placement copies the definition into the document, so the sheet still opens when the library is absent. A conflicting id is reported and is not overwritten. D3d adds image assets and free pins. The same picture is stored once. An SVG is drawn as a picture and is refused when it contains a script, a handler, or an external link. D3e adds an explicit library update. Pins are compared by id, a removed pin keeps its wire, and a matching name does not retarget that wire. The same asset checks run when a document or a library is loaded. D4a adds components, a project file, and a cycle check. The block stays the instance. D4b opens that hierarchy without copying the child diagram. D4c edits the logical interface of a component in one project command. D4d extracts a selection and expands one instance as one project command. D5a adds three reference projects and a checklist; the acceptance is a session at the keyboard. D4f, D4g, and D5b through D5f are specified in [diagram-editor-roadmap.md](diagram-editor-roadmap.md) and are not started. A synthetic sheet of 50 blocks and 350 segments was timed in Node; the HDL file `top_rtc_app` was not opened. The HDL-Maker editor remains the studio. The architecture is [diagram-engine-architecture.md](diagram-engine-architecture.md). The file format is [diagram-document-model.md](diagram-document-model.md). The D0 test record is [d0-feasibility.md](d0-feasibility.md). Drawing a sheet the size of `top_rtc_app` was not measured. Scale, z-order, and SVG export remain open from D1.

E0 and E1 stay implemented and tested in software. `top_rtc_app` remains `edg_b8c5a1b43a0640589c9fc9362e96566f`. `morse_transmitter` remains `edg_e78a939e14fb42599794f2c73c3afe55`.

## E — Studio editor

Branch E is the studio surface. It does not depend on Vivado, the open-source toolchain, or a later Learning Mode. E0 and E1 are in the editor. E2–E6 are not a second editor beside D.

| Step | Content | Status |
| --- | --- | --- |
| E0 | One diagram to open, edit, save, and reopen. The workspace model is created or reused. The `.bd` and `.sm` files stay untouched. | Implemented. Tested in software. |
| E1 | Readable block diagrams: port names on the pin, recorded direction, type, and width, full instance names, signal names above the wire, scalar and bus strokes, zoom | Implemented. Tested in software. [e1-block-diagrams.md](e1-block-diagrams.md) |
| E2 | Hierarchy: double-click, breadcrumbs, back. This is D4. A VHDL-only entity does not gain a diagram. | Planned. Not a separate implementation. |
| E3 | FSM properties: clock, reset, enable, interrupt, combinational or clocked signals, statements, state actions, transitions, encoding, recovery, and defaults. M3b changes only after a comparison. | Planned. After D5. |
| E4 | Draw states, transitions, interrupts, enable, and reset. | Planned. After D5, on the diagram engine. |
| E5 | Edit block diagrams: ports, generics, instances, wires, and undo. | Planned. Covered by D1 and D2. |
| E6 | Search, auto-layout, navigation, and diagnostic overlays. | Planned. After D5. elkjs is not approved. |

Port names are drawn on the component. Their font follows the pin pitch. A missing direction, type, or width stays blank. Signal names sit above the wire. A scalar net is thinner than a bus. The picture does not move a wire or change an object id. Opening the diagram edits the workspace file. The HDL Designer file is not written.

## Priority

1. E0 and E1 are implemented and tested in software. D0 through D4d are in the diagram lab. D5a is complete. D5b is released; through D5b.5b accepted; full D5b.5 / D5b.6 locked. D4f, D4g, and D5c through D5f are specified and are not started.
2. E2 is D4. The FSM work in E3 and E4 stays after D5. M3b changes only after a comparison against the machines it already generates. E5 is D1 and D2.
3. L0 and SV0 stay architecture studies and do not interrupt branch D. L0 is [learning-mode.md](learning-mode.md). SV0 has no importer and no generator. Proposed streams **CL** (component libraries) and **EDU** (educational web editor) are documented and likewise do not interrupt D5b; they are not released for implementation.
4. O4, O5, and E6 wait until a design can be drawn in the engine. M5b remains **Tested on hardware**. O3b did not program the FPGA again.

## Later, not scheduled

- A second, browser-only distribution. The portable Windows app remains the distribution for the Python backend.
- A hardware-debugger view of ILA probes on the block diagram. That view is M5c once branch V reaches it.

## First demonstration

`examples/` contains an 8-bit counter, a comparator, and a small controller FSM. M1 imports them. M2 edits and connects them. M2c edits the controller state diagram. M2d makes its actions and conditions readable. M3 generates VHDL. M4 simulates it. M5a implements a separate Zybo Z7-10 counter through Vivado and does not program that board. M5b programs the same VHDL, with Z7-20 constraints, on a Zybo Z7-20. O1 built that counter again without Vivado and did not program the open-source bitstream. `examples/fpga/zybo-z7-10-counter` is unchanged.
