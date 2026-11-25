# Changelog

## 0.1.0 — 2026-11-20

### M0

- Added the Vue 3 frontend and FastAPI backend skeletons.
- Added schema version 1 for the library inventory, separate from future diagram files.
- Health check reports the Python version and whether GHDL is on `PATH`.
- Development uses the existing Python 3.10.9 virtual environment. GHDL is not installed yet.

### M1

- Added a standalone VHDL library importer (`python -m app.importers`) and `POST /api/libraries/scan`.
- Entity ports and generics are extracted into schema version 1. Widths are recorded only when the source states them.
- Repeated scans of the same directory keep design-unit ids and do not insert a second library.
- The studio shows a library tree, a read-only entity symbol, the source span, and the import diagnostics.
- SystemVerilog and candidate HDL Designer files are listed and not interpreted.

### M1.5

- HDL Designer `.bd`, `.sb`, `.sm`, `.ibd`, `.fc`, `.tt`, and `._epf` files are counted separately. `.bd` and `.sb` are parsed. `.sm` files keep their envelope and machine name; states are counted and not imported as an editable FSM.
- Unknown record types are stored with their fields. The original files are not written.
- One block diagram can be shown in Vue Flow at its original coordinates, with Y flipped for the screen. The view can zoom and pan and cannot edit.
- Imported objects use random ids. The same library, including after its directory moves, keeps those ids when the name and relative path still match.
- Schema version is 2. A version 1 project file still loads.

### M2a

- Embedded HDL text is copied from `HdlTextMgr`, and a wire slice such as `(31 downto 22)` is kept with the wire.
- An imported block diagram can be copied into `workspace/diagrams/` and edited. The original `.bd` file and the imported document stay unchanged.
- Nets and orthogonal wire geometry are separate. Saving uses a temporary file and keeps the diagram id.

### M2b

- A new block diagram can be created for an imported library and saved as schema version 1. The version was not raised: new fields are optional and an older editable file still loads.
- Top-level ports and generics are stored on the design. A port width is set only when the type or range states it.
- Library entities and other workspace designs can be instantiated. Instance names stay unique. A child design opens from its instance, and a reference that reaches itself is reported.
- Connecting ports that already belong to different nets asks which net to keep. Splitting moves one endpoint onto a new net and removes wires that would join the two nets.
- The dev server starts the API when port 8000 is closed. Its proxy keeps one connection on a reserved local port outside the Windows ephemeral range, so a full TIME_WAIT pool does not become HTTP 502. The Windows port range is unchanged.

### P1

- `packaging/build_release.ps1` builds the Vue app and a PyInstaller `onedir` folder, then writes `release/HDL-Maker-<version>-win64.zip`.
- The executable serves the built UI and the API on `127.0.0.1` only. A second launch opens the browser instead of starting another server.
- Student projects are stored under the Documents folder `HDL-Maker\Projects`, not in the install directory. `libs/` and `workspace/` are not in the package.
- `docs/roadmap.md` is the milestone reference. M5 is FPGA implementation through an external Vivado adapter, after M2c, M3, and M4.
- The Target board list is read from `boardfiles/**/board.xml`. The chosen file is stored in `ui.json` and is not replaced by another board.
- A library scan records component and direct entity instantiations. The entity list is ordered as that hierarchy. A star marks the manually chosen root design.

### M2c

- The 14 `.sm` files contribute 126 placed states and 189 placed transitions, with the positions, names, conditions, actions, and priorities that the file states.
- A record without a `uid` is reported as a palette prototype and is not drawn.
- Edit a copy moves states and edits the stored texts. The copy is `workspace/diagrams/edg_*.json` at schema version 1. The `.sm` file is unchanged.
- VHDL for a state machine remains M3. Limits: `docs/m2c-limitations.md`.

### M2d

- Visible HDL Designer text rectangles for state actions and transition conditions and actions are imported with their coordinates. `morse_transmitter` is the reference.
- The workspace copy can move and resize a rectangle and edit the text. Moving a rectangle leaves the transition condition and the spline unchanged.
- A drawn text box grows past a short imported rectangle so the full text stays readable when the sheet fits the window. The stored rectangle stays unchanged until the user resizes it.
- The diagram view has one Text slider, 8–16 px, stored as `state_text_px` in `workspace/ui.json`. It changes the fitted on-screen size of every FSM text box and does not write the diagram. The slider lives on the Preferences tab.
- A hidden rectangle is reported and is not drawn. A missing rectangle is not given a guessed position.
- HDL-Maker is MIT-licensed. Copyright (c) 2026 Christian Netzberger. Third-party board files and generated ModelSim output keep their own terms (`docs/third-party-notices.md`).

### M3a

- A project stores `vhdl_standard` as `93` or `2008`. The default for a project that has no field is VHDL-93. Preferences edits that setting; diagram geometry and `ui.json` do not.
- Structural VHDL is generated from one netlist into `workspace/generated/vhdl-93/` or `workspace/generated/vhdl-2008/`. The manifest records the standard. FSM VHDL, simulation, and Vivado integration are not part of this step.
- Interface lists use `;`. GHDL 6.0.0 mcode analyzes and elaborates the reference hierarchy for `--std=93` and `--std=08` in separate work directories. A width mismatch is left unchanged and fails analysis with a file and line. A library other than `work` is named in a `library` clause before the architecture. Vivado 2019.1 was not run. Limits: `docs/m3a-limitations.md`.

### M3b

- An editable state diagram stores the interface table, enumerated state order, reset and recovery arcs, and interrupt arcs. VHDL-93 and VHDL-2008 are rendered from that netlist. Text geometry is not read.
- `morse_transmitter`, `audio_fifo_ctrl`, and `speed_trap` keep their stored transitions, actions, reset values, and package clauses. A machine that uses only `std_logic_1164` is analyzed and elaborated by GHDL 6.0.0 for both standards. The imported package clauses are not rewritten, and the default GHDL command does not use `-fsynopsys`. Cycle-accurate equivalence was not simulated in M3b. Limits: `docs/m3b-limitations.md`.

### M3c

- A project stores `library_profile` as `ieee` or `synopsys`, independently of `vhdl_standard`. The default is `ieee`. Preferences edits it. `ui.json` does not.
- The Synopsys legacy profile adds `-fsynopsys` and `-fexplicit` to GHDL analysis, elaboration, and simulation. The generated VHDL text, including `std_logic_arith` and `std_logic_unsigned`, is unchanged.
- `morse_transmitter`, `audio_fifo_ctrl`, and `speed_trap` analyze and elaborate with that profile for VHDL-93 and VHDL-2008 after `utilities` is compiled. A missing file is reported and GHDL is not started.
- The combinational sensitivity list no longer includes an output that is only assigned. GHDL 6.0.0 `--std=93` rejected those `out` ports.
- The original and generated `morse_transmitter` matched on one open-loop stimulus for 19,300,012 cycles. The other two machines were not simulated. Limits: `docs/m3c-validation.md`.

### M4a

- The project stores a simulation configuration separately from `ui.json`: testbench entity, stop time, GHW or VCD, and optional testbench generic overrides. The language standard and the library profile are inherited.
- A run resolves VHDL dependencies, then analyzes, elaborates, and simulates with the existing GHDL flags. Each run has its own directory under `workspace/simulations/`. The request returns while the run continues.
- GTKWave opens a finished waveform when it is on `PATH`. It is not installed automatically. The run also records stable object ids next to hierarchical signal names for a later viewer. Limits: `docs/m4a-simulation.md`.

### M4a.1

- The GTKWave executable is `workspace/tools.json`. A configured path that is not a file is reported. `PATH` is used only when the setting is empty. The path is not stored on the diagram or in `ui.json`.
- An optional `.gtkw` file on the simulation configuration is passed to GTKWave. A missing save file does not start the viewer and is not replaced.
- VCD names are compared with the prepared object-id map. Missing names are diagnostics. GHW names are not inferred. The viewer process is detached from the API.
- GTKWave 3.3.100 was unpacked locally and opened a generated GHW and VCD file. It is not part of the student ZIP. Details: `docs/m4a1-gtkwave.md`.

### M5a

- The project stores an FPGA build configuration: top-level entity, board, part, external XDC files, and a target of synthesis or bitstream. The VHDL standard and the library profile stay the existing project fields. The top entity is independent of the testbench and the hierarchy root.
- Preferences stores `vivado_path` in `workspace/tools.json`. Check Vivado runs `vivado.bat -version`. The global `PATH` is not changed, and Vivado is not installed by HDL-Maker.
- A missing top, a part the selected board file does not name, a missing XDC file, a pin without an I/O standard, or a used clock without `create_clock` stops the run. No pin, period, or part is filled in.
- The generated Tcl script is a Vivado 2019.1 non-project flow. VHDL-93 is not passed as `-vhdl2008`. VHDL-2008 uses that flag only when this Vivado version accepts it. GHDL's `-fsynopsys` and `-fexplicit` are not passed to Vivado.
- Each build is a new directory under `workspace/builds/`. Synthesis and bitstream are separate. A passed synthesis does not report a bitstream.
- Vivado v2019.1 synthesized `examples/fpga/zybo-z7-10-counter` for part `xc7z010clg400-1` and wrote a bitstream. The log contains warning ZPS7-1 and no error. The board was not programmed. Details: `docs/m5a-vivado.md`.

### M5b

- The FPGA Build tab can scan the Vivado 2019.1 Hardware Manager and program one named device from a finished bitstream. The request must name the device and confirm it. The first device is not selected automatically.
- A JTAG part such as `xc7z010` matches the bitstream part `xc7z010clg400-1`. A different part, including an ARM DAP, is rejected.
- A mock program is stored as `mock_passed` with `programmed` false. It is not reported as a programmed FPGA.
- With no board connected, Vivado 2019.1 reports `Labtoolstcl 44-199`. That earlier result stays `not_tested_no_hardware`.
- M5b is **Tested on hardware**. Vivado v2019.1, part `xc7z020clg400-1`, build `bld_34d0198b02b84f73b25a8aa305579d5a`, program `prg_c96275d4116948768d5c9c8079532cc8`. DONE was HIGH and LED0 blinked at about 1.07 s. `ZPS7-1` and `Labtoolstcl 44-560` are warnings, not failures. The Zybo Z7-20 is the board for the toolchain comparison. The Z7-10 example is unchanged.
- DRC ZPS7-1 remains a warning on the PL-only counter. The reference design was not given a PS7 cell. Details: `docs/m5b-jtag.md`.

### O1

- The Windows openXC7 tag `2026-11-19` and OSS CAD Suite tag `2026-11-04` were extracted under `workspace/toolchains/o1/`. Vivado and the installed GHDL were not changed.
- `zybo_counter` VHDL-93 was synthesized with GHDL `--out=verilog` and Yosys `synth_xilinx`, then placed with nextpnr-xilinx for `xc7z020clg400-1`. The bitstream is 4,045,674 bytes. It was not programmed, and the flow is not in the interface.
- The Windows Yosys bundle has no GHDL plugin. Details and the Vivado comparison: `docs/o1-open-source-toolchain.md`.

### O2a

- The open-source chain is a backend build for VHDL-93: GHDL Verilog, Yosys, nextpnr-xilinx, fasm2frames, and xc7frames2bit. Tool paths are `workspace/opensource-tools.json`. The process `PATH` is unchanged, and Vivado is not called.
- Build `osb_574eb1ad8c3b4ac8a36b359745d3534d` repeats the Z7-20 counter. The nextpnr counts match the O1 log, and the bitstream is 4,045,674 bytes. It was not programmed. Details: `docs/o2a-open-source-build.md`.

### D4b lab

- The diagram lab can open a child sheet by double-click, from the project tree, or from a breadcrumb. All three use one path of block ids. U1 and U2 open the same diagram and the same undo history, and the path stays different. Zoom and pan return with that path. A component without a diagram stays on the current sheet. A sheet can still be opened without a project. Details: `docs/d4b-hierarchy-navigation.md`.

### D4a lab

- A project can hold several diagrams and component definitions. A block cites a component by id and keeps its own port ids. Two instances share one child diagram. The logical port id is separate from the symbol pin and from the wire. A cycle is refused and leaves the project unchanged. Opening a sheet still does not require a project. Navigation is not started.

### D3e lab

- A symbol definition can record a revision and a content fingerprint. Opening a diagram does not replace that definition from a library. Compare library shows both pictures and the pin changes, matched by pin id. Update all instances is one undo step. A removed pin keeps its wire, and a new pin with the same name is not connected to it. Assign and Remove wire are separate actions and use the existing net merge and split. A bad image, or a checksum that does not match its bytes, is refused before the document or the library changes. Hierarchy is not started.

### D3d lab

- The diagram lab can place an SVG, PNG, JPEG, or WebP picture inside a symbol, with text, shapes, and pins. The picture is stored once as an asset and travels with the document and the user library. A free pin uses fractions of the symbol box. An SVG with a script, a handler, or an external link is refused and does not change the document. Path editing and HDL are not started.

### D3c lab

- The diagram lab has a symbol library beside the document. Built-in catalogs cover general shapes, flowcharts, digital logic, and signal-processing blocks. They are pictures and pins. They do not simulate and they do not write HDL. Placing a symbol copies its definition into the document once. The sheet still opens when that library is gone. A repeated id with different contents is reported and is not overwritten. SVG import is not started.

### D3b lab

- The diagram lab draws a symbol with rectangles, ellipses, lines, polygons, text, and pins on all four sides. `t` runs along the side. The same picture is used in the editor and on each instance. Wires keep their port ids when the symbol changes. SVG import and a symbol library are not started.

### D3a lab

- A diagram can store a symbol definition and several instances of it. Each instance has its own port ids. A wire keeps those ids when the symbol pin moves. Removing a pin leaves the wire and shows a diagnosis. `componentId` is stored and not opened. The symbol editor, SVG import, and hierarchy are not started. HDL-Maker and `edg_*.json` are unchanged.

### D2 lab

- The diagram lab draws orthogonal wires, branches them at junctions, and keeps name labels on their segments. Two nets are merged only by an explicit command. A crossing is not a connection. HDL-Maker and `edg_*.json` are unchanged.

### D1 lab

- The diagram lab edits through one command session. A drag is one undo step, and Escape restores the document. Blocks can be added, selected, grouped, duplicated, deleted, and saved through `DiagramStorage` as JSON. HDL-Maker and `edg_*.json` are unchanged.

### D0 lab

- A standalone Vue 3 diagram lab draws blocks in Vue Flow and wires, labels, and ink in one SVG viewport. It does not open HDL-Maker or rewrite `edg_*.json`. elkjs and tldraw were not installed. Details: `docs/d0-feasibility.md`.

### D0

- The studio work file stays `EditableDiagram`. The reusable engine is a separate lab and is not written into `edg_*.json`. Details: `docs/design-authoring-architecture.md`, `docs/d0-feasibility.md`.

### E0

- Opening a block or state diagram edits one workspace model. An existing model is reused. The `.bd` and `.sm` files are not written. There is no separate read-only diagram step.

### E1 labels

- Block-diagram port labels can use the short HDL Designer form or the recorded long type. The choice is in Preferences and is stored in the workspace UI file.
- Signal names use the text box stored on each wire. A recorded range is drawn as a thicker bus, and a scalar net is thinner. In an editable copy the box can be moved, and editing the text renames the net. Wire points stay unchanged.

### E1

- Block-diagram instances show the recorded port name beside each connection, plus direction, type, and range when those fields exist. Dense ports can be grouped and hidden without moving the wires. Details: `docs/e1-block-diagrams.md`.

### O3b

- Build directories are created once and are not replaced. The manifest records the build id, toolchain, part, VHDL standard, and bitstream SHA-256. A passed build is not marked as a hardware test. Learning Mode is documented and not implemented. Details: `docs/o3b-build-records.md`, `docs/learning-mode.md`.

### O3a

- The FPGA Build tab can store Vivado or Open Source on the project and run the existing O2a builder. SRAM programming goes through a local openFPGALoader path, requires interface A and a confirmation, and was tested with a mock. The board was not programmed again. Details: `docs/o3a-fpga-build.md`.

### O2b.3

- The checked open-source bitstream was loaded into the Zybo Z7-20 SRAM through the D2XX transport. Exit code 0. JTAG DONE bit 1. No flash. The DONE LED was green and LED0 blinked about once per second. O2b is Tested on hardware. Details: `docs/o2b-open-source-hardware.md`.

### O2b.2

- Experimental Windows D2XX transport under openFPGALoader's MPSSE layer. Detect at 1 MHz printed raw IDCODEs `0x23727093` and `0x4BA00477`. Vivado 2019.1 still sees that chain, and COM20 is still interface B. The FPGA was not programmed. Details: `docs/o2b2-d2xx-transport.md`.

### O2b.1

- Study only. The recommended next build is a D2XX transport under openFPGALoader, leaving the Xilinx programmer unchanged. UrJTAG was not installed. No driver change and no FPGA load. Details: `docs/o2b1-d2xx-programming.md`.

### O2b

- The O2a bitstream was later loaded into SRAM. See O2b.3. The OSS CAD Suite `openFPGALoader.exe` still fails to open the Digilent cable while `FTDIBUS` is installed. A read-only D2XX scan saw IDCODEs `0x23727093` and `0x4BA00477`. No driver was changed. Details: `docs/o2b-open-source-hardware.md`.

### O5

- Roadmap and architecture only. O5 is a long-term international distribution study and does not block O2, O3, or O4. The MIT licence is unchanged. No export clearance is claimed. Details: `docs/international-open-source-distribution.md`.
