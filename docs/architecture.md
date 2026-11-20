# Architecture

HDL Design Studio is a local tool for bringing existing HDL Designer libraries into a graphical VHDL flow without an HDL Designer license. Semantic HDL data and graphical layout are different documents. Vue Flow nodes are a view, not the design model.

## Subsystems

### Library Manager

Imports a directory tree and builds a reusable component inventory.

- Original files are referenced by absolute path and content hash. Nothing is rewritten.
- VHDL entities, architectures, packages, package bodies, configurations, and contexts are recognized.
- Entity ports and generics are extracted into the language-neutral model.
- SystemVerilog and Verilog files are inventoried only. Their interfaces are not extracted yet.
- Files whose extensions resemble HDL Designer or diagram metadata are classified as candidates. Their bytes are not interpreted.
- A repeated scan of the same directory updates the existing library instead of inserting a second copy.
- The same code runs as `python -m app.importers` and as `POST /api/libraries/scan`.

### Graphical Designer

M1 draws a read-only entity symbol from the extracted interface. The block-diagram editor and the FSM editor are separate Vue Flow surfaces and are not implemented yet. An FSM will later become an entity that the block editor can instantiate.

### HDL generation and validation

Generators will read the intermediate representation, not the canvas. VHDL-2008 is the first generator. SystemVerilog is a later generator behind the same model. Schema version 1 has no diagram section on purpose; diagrams will be their own versioned document that references design-unit ids.

### Simulation Manager

External simulators only. The first adapter will be GHDL, with waveforms opened in GTKWave rather than an embedded viewer. Vivado XSim, Verilator, and mixed-language simulation stay behind the same adapter boundary and are not part of the first releases. There is no plan to write an HDL simulation kernel.

## Schema version 1

`schemas/design.schema.json` and `backend/app/models/design.py` describe the inventory:

- libraries and their last import report
- design units with stable ids
- ports, generics, dependencies, source span, parse status, diagnostics

A port width is recorded only in these cases:

- both bounds of a single range are integer literals (`literal`)
- the type is a known single-bit type: `std_logic`, `std_ulogic`, or `bit` (`scalar`)
- the type is a known non-vector type such as `integer` or `boolean` (`not_applicable`)

Any other width stays `unresolved`. The importer does not infer a generic width and does not guess a missing port mode. An interface item that cannot be parsed is omitted from the structured port list and reported with its raw text.

## Identity

Library id is a hash of the resolved directory path. Design-unit, port, and generic ids are hashes of the library id plus kind, name, and library-relative path. Scanning the same tree again therefore yields the same ids.

Moving or renaming the library changes those ids. Diagrams do not exist yet, so nothing references them. Before milestone M2 stores connections, choose one of these policies:

1. Keep path-derived ids and add an explicit remap when a library root moves.
2. Assign random ids on first import and rematch by relative path, kind, and name on the next scan.

Option 2 survives a moved root as long as the project file is kept. Option 1 is reproducible even when the project file is deleted. M1 uses option 1 because the inventory must be reproducible from the sources alone. Do not switch after diagrams store ids without a migration.

## Process boundaries

- The API listens on `127.0.0.1` only.
- External programs, when they are added, are started with argument lists, fixed working directories, and timeouts. Paths from the project are not concatenated into a shell command.
- Imported sources are untrusted. The parser extracts declarations; it does not execute them.
- Directory scans do not follow symlinks. `.git`, `__pycache__`, `node_modules`, and `.venv` are skipped.
- Files larger than 2 MB are listed and not parsed.

## What is intentionally absent

Monaco Editor and ELK.js are not dependencies yet. M1 shows source as read-only text and does not auto-layout a multi-instance diagram. pyGHDL.dom is not used. GHDL is not installed on this machine, and adopting pyGHDL before a compatibility check would couple the inventory to an optional analyzer. The dedicated VHDL interface extractor covers the M1 demonstration and reports what it did not understand.

## Technical risks

| Risk | Effect | Current handling |
| --- | --- | --- |
| The VHDL extractor is not a full analyzer | Configurations, generate statements, component graphs, and complex types are incomplete | Those units stay in the report with diagnostics. Hierarchy reconstruction is a later stage. |
| HDL Designer metadata format is unknown | Block and state diagrams cannot be rebuilt from HDS files yet | Candidate files are classified and left untouched until a real library is inspected. |
| GHDL is not on PATH | M3 and M5 cannot be verified here yet | Health reports `ghdl: null`. No simulated success is reported. |
| Python 3.10 instead of 3.11+ | A future package might require 3.11 | FastAPI and Pydantic 2 run on 3.10.9. Stay on the existing `.venv` unless a dependency forces a change. |
| Path-derived ids | Moving a library changes ids | Decision deferred until just before M2, recorded above. |
| SystemVerilog deferred | Mixed libraries look only partly imported | `.sv` files are counted and marked `systemverilog_deferred`. |
