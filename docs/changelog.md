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
