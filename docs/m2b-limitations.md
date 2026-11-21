# M2b limitations

M2b creates workspace block diagrams and lets one design instantiate another. It does not generate VHDL, edit a state diagram, or simulate.

## Schema version

Editable diagrams stay at schema version 1. A created design, diagram generics, `child_diagram_id`, `default_text`, and `origin` are optional. An M2a file that lacks them still loads, and `origin` defaults to `import`. Saving that file writes the new keys with their defaults. The version should increase only when a migration rewrites existing documents.

## Interface and instances

Top-level ports are real interface objects: name, direction, type, range, width status, and an optional default. Their x and y are only the symbol position.

The pins and generic map of an instance are copied when the instance is inserted. A later edit of the library entity or of the child design does not update instances that already exist. The copy is taken from the saved child, so unsaved edits of the child are not part of the new instance.

A child is referenced by its editable-diagram id. It is not yet a VHDL library unit. M3 has to decide how to emit the entity and the component declaration from that document. A child may belong to a different imported library; `component_library` records the name, and there is no library mapping file.

## Nets

Joining two ports that already sit on different nets does nothing until the user picks the surviving net. That net keeps its own type and range. The other net's type is not copied and the two types are not combined. Differing known port types are reported as `type_mismatch`. A missing type is `type_unresolved` and is not filled in.

Splitting moves one HDL endpoint onto a new net. A wire that ran from that endpoint to an endpoint that stays behind is deleted, because one wire cannot belong to two nets. A wire that ends on a junction is not an HDL endpoint; it moves with the split port and may need to be redrawn.

A slice or other signal expression is stored as text on the wire and on the start endpoint. A width is taken from it only when the text contains `(N downto M)` or `(N to M)`. Anything else stays text and does not invent a width.

## Hierarchy

The editor refuses a reference that would reach the design already open, including through a saved child. Saving a document that already contains a cycle still writes the file and attaches `recursive_hierarchy`, so the instance can be removed. A missing child id is `child_missing`. No interface is invented for it.

Opening a child loads the saved document. Returning uses the hierarchy stack for this browser session. The stack is not stored in the JSON file. The child reference itself is the id and survives save and reload.

## What did not change

Embedded HDL text is still stored and not parsed. The 14 state diagrams are still not editable. Original files under `libs/` and `examples/` are not written. New wires still use one elbow. There is no global router.
