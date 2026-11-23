# Migration limitations after M1.5

The importer can show an original block diagram. It cannot yet replace HDL Designer, and it does not write `.bd` or `.sb` files.

## Recovered for `audio_gain`

Component instances, their library and component names, generics, pin declarations, diagram pins, nets, orthogonal wire points, and embedded HDL-text block names. Coordinates are the original integers. The viewer only flips Y so that the title, which has a higher Y than the box, appears above the box.

## Not recovered

- Palette prototypes and machine anchors. M2c places states and transitions that have a `uid`. A reset, recovery, or interrupt anchor stays an anchor. See `docs/m2c-limitations.md`.
- Flowcharts, truth tables, and interface-based diagrams. This library has none of those extensions. A file with one of those extensions would be counted and not parsed.
- The meaning of `FFT`, `Mux`, `CommentGraphic`, and `PageSetupInfo`. Their fields are preserved on the diagram and are not drawn.
- Pin mode from the symbol field `m`. It is stored as `marker_m`. Direction is taken only from `PortIoIn`, `PortIoOut`, `PortIoInOut`, and `PortIoBuffer`.
- Slice actuals. A diagram net `ramp` and a VHDL actual `ramp(31 downto 22)` stay a reported difference.
- Renames that change both the library name and the directory. The import then creates a new id. If two stored libraries already share a name, they are not merged.
- Editable diagrams, new connections, and VHDL generation. Those stay in later milestones.
- A round trip back to HDL Designer. Reading the files is the goal of this milestone. Writing the proprietary format is not a project goal.

## Identity

Ids are random and are stored in `workspace/project.json`. Repeating the import, or moving the library directory while keeping the library name and relative paths, reuses them. Deleting the project file assigns new ids. Connections inside a diagram point at HDL Designer object numbers (`start`, `end`, `on`) and at the net name. They do not depend on the x/y position.
