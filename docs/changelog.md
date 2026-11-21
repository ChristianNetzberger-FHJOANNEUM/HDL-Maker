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
