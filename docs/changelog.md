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
