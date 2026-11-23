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

M1 draws a read-only entity symbol from the extracted interface. M1.5 shows an imported block diagram at its HDL Designer coordinates. M2a copies that diagram into a separate editable document and lets the user move instances, add library components, connect and disconnect ports, rename nets and labels, and edit the HDL text inside an embedded block. M2b adds a design that has no HDL Designer source: its top-level ports and generics are the interface, library entities and other workspace designs can be instantiated, and a child design opens from its instance.

Vue Flow is the view. The saved document is JSON under `workspace/diagrams/`. A net can have many endpoints. A wire is one orthogonal polyline and may share its net with other wires. Moving an instance updates the attached end of a wire; it does not create a new signal. Connecting two ports that already belong to different nets asks which net survives. The imported diagram stays in the project file and is not overwritten.

The FSM editor stores the machine. Generating VHDL for that machine, and instantiating it from a block, is M3b.

### HDL generation and validation

M3a reads an editable block diagram, checks the hierarchy, and builds one language-neutral structural netlist. It does not read Vue Flow nodes, wire points, zoom, or font size. A VHDL-93 backend and a VHDL-2008 backend render that netlist. The project file stores `vhdl_standard` as `"93"` or `"2008"`, defaulting to `"93"` when an older project has no field. Studio font size and the selected board stay in `ui.json`.

The backends share the netlist. VHDL-93 refuses `process(all)`, interface type generics, the condition operator `??`, and conditional expressions in generic or port actuals, and it reports that instead of rewriting the text. VHDL-2008 emits `process(all)` only as a preserved concurrent block and emits an interface `type` generic. Other VHDL-2008 forms stay unimplemented. Selecting VHDL-2008 does not mean Vivado accepts the file.

Three claims stay separate:

1. Language-standard compatibility is the syntax the selected backend emits.
2. GHDL compatibility is `ghdl -a --std=93` or `--std=08`, then `ghdl -e` with the same flag and a separate `--workdir` for each standard, and only when `ghdl` is already on `PATH`. The default library profile does not add a relaxed mode to hide a violation. An optional Synopsys legacy profile passes `-fsynopsys` and `-fexplicit` without rewriting the VHDL; see `docs/m3c-validation.md`. GHDL 6.0.0 mcode analyzed and elaborated the reference hierarchy. Analysis and elaboration are reported as separate results.
3. Vivado synthesis of the generated library was not measured in M3a. Vivado 2019.1 accepts `read_vhdl -vhdl2008` for a file that is marked VHDL-2008. That flag is not the whole standard, and selecting VHDL-2008 does not rewrite a VHDL-93 project. M5a runs that install on a separate VHDL-93 counter. See `docs/m5a-vivado.md`.

Generated files are `workspace/generated/vhdl-93/*.vhd` or `workspace/generated/vhdl-2008/*.vhd`. A failed design is not written. State machines use the same two backends. The FSM netlist is separate from the structural netlist and is described in `docs/m3b-limitations.md`. SystemVerilog stays behind the same model and is not part of M3a or M3b. Schema version 1 has no diagram section on purpose. Imported diagrams are schema 2. Editable diagrams are their own schema, version 1, in `schemas/editable-diagram.schema.json`. The project schema stays version 2; `vhdl_standard` and `library_profile` are optional there so an older file still loads.

### Simulation Manager

External simulators only. M4a runs GHDL and opens the waveform in GTKWave. M4a.1 adds a local executable path and an optional `.gtkw` save file. A browser waveform view is M4b. Vivado XSim, Verilator, and mixed-language simulation stay behind the same adapter boundary and are not part of M4. There is no plan to write an HDL simulation kernel.

FPGA implementation is a separate adapter. M5a runs Vivado 2019.1 in non-project mode. The part comes from the selected board file. Pin assignments stay in the user's XDC file and are not stored here. M5b programs one confirmed JTAG device through the Hardware Manager. A download without a connected board stays untested. See [m5a-vivado.md](m5a-vivado.md) and [m5b-jtag.md](m5b-jtag.md).

## Schema version 2

`schemas/design.schema.json` and `backend/app/models/design.py` describe the inventory. Version 1 project files still load. Saving writes version 2.

- libraries and their last import report
- design units with persistent ids
- ports, generics, dependencies, source span, parse status, diagnostics
- read-only diagram documents imported from HDL Designer `.bd`, `.sb`, and `.sm` files
- embedded HDL text, wire slices such as `(31 downto 22)`, and junction points on those imports

Editable diagrams are not stored inside the project file. Each one is `workspace/diagrams/edg_<uuid>.json`, schema version 1. M2b keeps that version: a created design, diagram generics, a child-diagram id, and a port default are optional fields with defaults, so an M2a file still loads. Raise the version only together with a migration that rewrites existing files. A repeated "edit a copy" of the same import reopens that file.

A port width is recorded only in these cases:

- both bounds of a single range are integer literals (`literal`)
- the type is a known single-bit type: `std_logic`, `std_ulogic`, or `bit` (`scalar`)
- the type is a known non-vector type such as `integer` or `boolean` (`not_applicable`)

Any other width stays `unresolved`. The importer does not infer a generic width and does not guess a missing port mode. An interface item that cannot be parsed is omitted from the structured port list and reported with its raw text.

## Identity

The first import of a library assigns random ids (`lib_`, `du_`, `port_`, `gen_`, and diagram object prefixes plus a UUID). A later import keeps those ids when the logical identity matches:

- a library matches its previous root path, or, if the directory moved, the single stored library of the same name
- a design unit matches kind, name, and library-relative path
- a port or generic matches its name inside that unit
- a diagram matches its library-relative path
- a diagram object matches the HDL Designer `uid` recorded on that object

Two stored libraries with the same name are not merged. The import reports `library_identity_ambiguous` and keeps a new id. Semantic connections are the wire's start, end, and net references, not the coordinates.

## Process boundaries

- The API listens on `127.0.0.1` only. The portable student executable uses that same address for the built page and the API. It does not listen on a network interface.
- Development keeps the Vite server. The executable is a separate build and stores projects under the user's Documents folder.
- External programs, when they are added, are started with argument lists, fixed working directories, and timeouts. Paths from the project are not concatenated into a shell command.
- Imported sources are untrusted. The parser extracts declarations; it does not execute them.
- Directory scans do not follow symlinks. `.git`, `__pycache__`, `node_modules`, and `.venv` are skipped.
- Files larger than 2 MB are listed and not parsed.

## What is intentionally absent

Monaco Editor and ELK.js are not dependencies yet. M1 shows source as read-only text and does not auto-layout a multi-instance diagram. pyGHDL.dom is not used. GHDL is not installed on this machine, and adopting pyGHDL before a compatibility check would couple the inventory to an optional analyzer. The dedicated VHDL interface extractor covers the M1 demonstration and reports what it did not understand.

## Technical risks

| Risk | Effect | Current handling |
| --- | --- | --- |
| The VHDL extractor is not a full analyzer | Configurations, generate statements, and complex types are incomplete | An architecture records the component and entity names it instantiates. Binding is by name in this library, which is Vivado's default before elaboration. A configuration that binds a component to a different entity is not applied. |
| HDL Designer state actions are stored as text | M2d draws each visible action and condition in the rectangle the file states | The words and the rectangle are separate. VHDL for the machine is M3. |
| A bus slice is easy to mistake for a wrong net | `ramp` and `ramp(31 downto 22)` look like a conflict | The wire field `sl` is kept and compared with the VHDL actual. |
| GHDL is not on PATH | M3 and M4 cannot be verified here yet | Health reports `ghdl: null`. No simulated success is reported. |
| Python 3.10 instead of 3.11+ | A future package might require 3.11 | FastAPI and Pydantic 2 run on 3.10.9. Stay on the existing `.venv` unless a dependency forces a change. |
| Library identity | Moving a library must not mint new ids | A later import rematches the root path, or the unique library name, and then the relative path. |
| SystemVerilog deferred | Mixed libraries look only partly imported | `.sv` files are counted and marked `systemverilog_deferred`. |
