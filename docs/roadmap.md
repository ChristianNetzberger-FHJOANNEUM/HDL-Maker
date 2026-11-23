# Development roadmap

This is the reference for HDL-Maker milestone order and scope. Later work follows this file. A change of order or scope is recorded here in the same change that introduces it.

The teaching milestones M0–M6 are one development line. An FPGA toolchain is an optional backend of that same HDL-Maker, under the same MIT license. Branch V is Vivado. Branch O is an open-source flow. Branch U is other vendors and families. Branch R is a remote build server. The branches are parallel, and any of them may stay unused. The boundary is specified in [fpga-toolchain-architecture.md](fpga-toolchain-architecture.md). Branches O, U, and R are not installed and have no implementation.

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
| M5b | JTAG programming | Implemented, working tree. JTAG download, DONE, and the LED0 counter are each tested on hardware. |
| M5c | Timing, resources, and ILA | Planned. Branch V. |
| M6 | Legacy diagram migration | Planned, does not block the FPGA branches |
| V1 | Vivado minimal-install study | Planned. License unresolved for redistribution. |
| O1–O4 | Open-source FPGA backend | Planned. Experimental. Not installed. |
| U | Further FPGA families | Planned. |
| R | Remote FPGA build | Planned. Optional. Not implemented. |

## Active sequence

M5b is in the working tree. On a Zybo Z7-20 the JTAG download, the DONE pin, and the LED0 counter are each tested on hardware. **V1** and **O1** stay planned and are not started. The `Labtoolstcl 44-560` Tcl warning is a later cleanup. **M5c** stays a later Vivado report view. **M4b** stays planned. **U** and **R** are later optional branches. **M6** does not block them.

P1, M2c, and M2d are finished and committed. An earlier note suggested packaging only after M5. Packaging was done first so each later milestone can be shipped with `packaging/build_release.ps1`. That decision stands. A later milestone does not start a second packaging project. The existing student ZIP was built before M2c and before the MIT `LICENSE` file.

M4a.1 is committed in `bd5defa`. GTKWave 3.3.100 opened the generated GHW and VCD files on this machine. That binary stays a local test tool.

M5a is committed in `bd5defa`. Vivado 2019.1 synthesized the Zybo Z7-10 counter and wrote a bitstream.

M5b is in the working tree. It scans JTAG devices and programs only a device the user names. The Zybo Z7-20 run separates three hardware results: the JTAG download, the DONE pin, and the LED0 counter. All three were tested. M5c, M4b, and the open-source backend stay unstarted.

## Standing rules

- Original libraries under `libs/` are never modified. HDL-Maker does not write proprietary HDL Designer files.
- Imported HDL, scripts, and constraints are untrusted. A scan records them. It does not execute them.
- Tcl from an imported project runs only after an explicit user action that authorizes that file.
- Missing ports, modes, widths, pin numbers, I/O standards, clock periods, and FPGA part numbers stay unresolved. They are not invented.
- The API and the packaged app bind to `127.0.0.1` only.
- External tools are started with an argument list, a fixed working directory, streamed output, cancellation, and a timeout. Project paths are not concatenated into a shell command.
- Proprietary tools such as Vivado and Vitis are optional installs. They are not bundled in the student ZIP. A local copy that runs is not permission to redistribute those files.
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

Implemented in the working tree. The Hardware Manager flow uses the Vivado 2019.1 commands `open_hw`, `connect_hw_server`, `get_hw_targets`, `get_hw_devices`, and `program_hw_devices`. The user scans, chooses one device, and confirms that device by name. The first device is not used when several are present. A mock program is labeled as a mock and does not count as a programmed FPGA.

The Zybo Z7-20 records in `docs/m5b-jtag.md` keep three results apart:

| Check | Status |
| --- | --- |
| JTAG programming of `xc7z020_1` | Tested on hardware |
| FPGA configuration, DONE pin and green DONE LED | Tested on hardware |
| LED0 counter, about 1.074 s period | Tested on hardware |

An earlier scan with no cable reported `Labtoolstcl 44-199` and is kept in `workspace/hardware/m5b-no-board`. ZPS7-1 remains a warning on the PL-only counter. `Labtoolstcl 44-560` is a later Tcl cleanup and did not block the download.

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
| HDL-Maker + Open Source | GHDL, Yosys, nextpnr, bitstream tools | Branch O. Planned. Experimental. Not run. |
| HDL-Maker Remote Build | Local studio, toolchain on a server | Branch R. Planned. Not implemented. |

### V — Vivado

M5a and M5b are this branch. M5c is the planned timing, resource, and ILA view.

**V1 — Minimal Vivado installation study.** Planned. Read the installed Vivado 2019.1 tree and separate an officially reduced install, the files a batch run loads, the local-use entitlement, and any right to redistribute. The installed tree is large; its size was not remeasured for this note. No Vivado file is added to a public HDL-Maker package as part of the study.

### O — Open-source FPGA tools

Planned and experimental. Nothing in this branch is installed. Published Windows packages for nextpnr-xilinx / openXC7 have been described, including device data that mentions the Zybo Z7-10, and the 7-series flow is described as experimental. This repository has not downloaded those packages and has not produced an open-source bitstream. A device database is not a working flow.

- **O1 — Feasibility on Windows 11.** Binaries, licenses, archive size, VHDL-93 and VHDL-2008, `xc7z010clg400-1`, constraints, Zynq PS/PL limits, and JTAG. License unresolved until the component licenses are recorded.
- **O2 — Reference build.** The same `zybo_counter` as M5a, with no Vivado process. Record resources, timing, runtime, memory, warnings, and bitstream size beside the Vivado 2019.1 result. Hardware programming stays open while no board is attached.
- **O3 — Integration.** After O1 and O2, one backend behind the shared boundary. Diagram JSON and VHDL generation stay as they are.
- **O4 — Portable student edition.** Planned. Compare one ZIP that includes the free tools with a small HDL-Maker package and a separate toolchain download. Record every redistribution term.

A later comparison view can show resources, timing, and duration for this one counter under both backends. It waits until O2 has measurements.

### U — Further families

Planned. Lattice iCE40, Lattice ECP5, Gowin, further AMD/Xilinx devices, and Intel/Altera through a vendor toolchain are candidates. A backend names the operations it implements. Unsupported families are absent from that list.

### R — Remote build

Planned, optional, and not implemented. The student runs HDL-Maker locally. An authorized server runs synthesis and implementation. Still open: the server license, authentication, isolation of student projects, the queue, resource limits, and which reports and bitstreams come back.

## Priority

1. M5b is closed on hardware: JTAG download, DONE, and the LED0 counter.
2. V1, the Vivado install study. Not started. `Labtoolstcl 44-560` can be cleaned when that Tcl is next touched.
3. O1, the openXC7 feasibility study for Windows and the Zybo Z7-10 part.
4. Keep the shared backend boundary specified. Implementing that interface waits for the studies.
5. Decide on an open-source implementation only after O1 and O2.
6. U and R come after that decision.

## Later, not scheduled

- A second, browser-only distribution. The portable Windows app remains the distribution for the Python backend.
- A hardware-debugger view of ILA probes on the block diagram. That view is M5c once branch V reaches it.

## First demonstration

`examples/` contains an 8-bit counter, a comparator, and a small controller FSM. M1 imports them. M2 edits and connects them. M2c edits the controller state diagram. M2d makes its actions and conditions readable. M3 generates VHDL. M4 simulates it. M5a implements a separate Zybo Z7-10 counter through Vivado and does not program the board. The same counter is the planned O2 comparison source. That open-source build has not been run.
