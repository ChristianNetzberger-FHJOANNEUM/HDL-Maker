# Roadmap

M0 and M1 are implemented. Later milestones stay listed so the architecture does not grow a one-off importer.

## M0 — Repository and architecture

Frontend and backend start on Windows 11. Schema version 1, health check, and these documents exist.

## M1 — Library inventory and component browser

Recursive scan, VHDL interface extraction, library tree, read-only entity symbols, source inspection, and an import report. The importer also runs without the UI.

Deliverable: the VHDL entities under `examples/` can be browsed and inspected.

## M2 — Block diagram editor

Instantiate entities, connect ports, validate nets, and save a diagram document that references schema-1 unit ids. Layout is stored separately from the interface model.

## M3 — VHDL generation

Emit deterministic VHDL-2008 for a structural architecture. A design of at least three connected components must pass GHDL analysis and elaboration. This milestone requires GHDL on `PATH`.

## M4 — FSM editor

Edit states and transitions graphically and generate synthesizable VHDL. The FSM is also an entity the block editor can place.

## M5 — Simulation integration

Run GHDL from the studio: dependency order, elaboration, testbench, diagnostics, timeout, cancellation, and a VCD file. View waveforms in GTKWave. No embedded waveform viewer in this milestone.

## M6 — Legacy diagram migration

Investigate real HDL Designer diagram files and import only constructs that can be recovered reliably. Document the rest. SystemVerilog import, XSim, Verilator, and mixed-language simulation come after M6.

## First demonstration

`examples/` contains an 8-bit counter, a comparator, and a small controller FSM. M1 imports them. M2 through M5 connect them, generate VHDL, and simulate the result.
