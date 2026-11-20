# HDL Designer migration

Migration is the long-term priority. The studio must be able to take an existing library without changing it and without an HDL Designer license.

The importer is a library, an API, and a command-line tool. Graphical editing is not required to produce an inventory.

## Stage 1 — Inventory (M1)

Scan the selected directory recursively and report:

- relative path, extension, size, and whether the file looks binary
- VHDL design units found in `.vhd` and `.vhdl` files
- which architecture belongs to which entity name
- `library` and `use` dependencies attached to the following design unit
- candidate metadata (extensions such as `.hds`, `.hdp`, `.hde`, `.bd`, `.bde`, `.fsm`, `.sde`)
- every other extension as unrecognized

Candidate extensions are hypotheses, not a claim that the file is HDL Designer data. The report says the format was not interpreted.

## Stage 2 — HDL extraction (M1)

VHDL entities become component symbols: name, generics, ports, direction, type text, and width when it is explicit. Architectures and packages are listed and can be opened as source. They do not become symbols.

Repeated imports of the same root update units in place. Two files that declare the same entity name are both kept, and the report includes `duplicate_unit_name`.

## Stage 3 — Hierarchy reconstruction (later)

Structural architectures will be read for instances, port maps, internal signals, and parent/child relationships, then drawn as a block diagram. M1 does not recover component instantiations. A component declaration inside an architecture is not treated as a library entity.

## Stage 4 — HDS investigation (later, needs a real library)

Do this only after a real HDL Designer library is available. Record, for each metadata file:

- whether it is text or binary
- which diagram facts can be rebuilt without guessing
- which facts cannot

Until that sample exists, the importer must not invent a parser for proprietary diagram files.

## Rules that stay in force

- Never modify the source library.
- Never drop an unsupported construct without a diagnostic.
- Never fill in a port, a mode, or a width that the source did not state.
- Treat every imported file as untrusted input.
