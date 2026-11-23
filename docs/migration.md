# HDL Designer migration

Migration is the long-term priority. The studio must be able to take an existing library without changing it and without an HDL Designer license.

The importer is a library, an API, and a command-line tool. Graphical editing is not required to produce an inventory.

## Stage 1 — Inventory (M1)

Scan the selected directory recursively and report:

- relative path, extension, size, and whether the file looks binary
- VHDL design units found in `.vhd` and `.vhdl` files
- which architecture belongs to which entity name
- `library` and `use` dependencies attached to the following design unit
- candidate metadata (extensions such as `.hds`, `.hdp`, `.hde`, `.bde`, `.fsm`, `.sde`)
- graphical views: `.bd`, `.sb`, `.sm`, `.ibd`, `.fc`, `.tt`, and `._epf`
- every other extension as unrecognized

`.bd`, `.sb`, and `.sm` are parsed. A state diagram contributes its placed states and transitions. The other graphical extensions are counted. Hidden directories such as `.hdlsidedata` stay skipped unless the scan is asked to list them.

## Stage 2 — HDL extraction (M1)

VHDL entities become component symbols: name, generics, ports, direction, type text, and width when it is explicit. Architectures and packages are listed and can be opened as source. They do not become symbols.

Repeated imports of the same root update units in place. Two files that declare the same entity name are both kept, and the report includes `duplicate_unit_name`.

## Stage 3 — Hierarchy reconstruction (later)

Structural architectures will be read for instances, port maps, internal signals, and parent/child relationships, then drawn as a block diagram. M1 does not recover component instantiations. A component declaration inside an architecture is not treated as a library entity.

## Stage 4 — HDS investigation (M1.5)

`libs/sbus_rtc_lib` was read locally and not modified. The findings are in `docs/hds-format-investigation.md`. The importer reads the observed text grammar and does not write HDL Designer files. What it does not recover is listed in `docs/hds-migration-limitations.md`.

## Rules that stay in force

- Never modify the source library.
- Never drop an unsupported construct without a diagnostic.
- Never fill in a port, a mode, or a width that the source did not state.
- Treat every imported file as untrusted input.
