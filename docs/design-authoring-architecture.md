# D0 — Design authoring architecture

D0 records the model for a graphical hardware design system. It does not add editor commands, change the VHDL generators, write `.bd` or `.sm` files, or migrate `workspace/diagrams/`.

HDL-Maker today imports HDL Designer diagrams, draws them, and edits one workspace document. Structural VHDL, FSM VHDL, GHDL, and the FPGA backends already read that document. Branch D extends this `EditableDiagram` so a component, its ports, its nets, its hierarchy, and the generated VHDL stay the same facts.

Branch E remains the studio surface. Branch D is the design function underneath it. M3, M4, M5, and O stay as they are. Learning Mode and SystemVerilog stay later studies on this same model.

## What the workspace stores today

Three documents already exist. They are not one design unit.

| Document | Role today | Identity |
| --- | --- | --- |
| Inventory `DesignUnit` | A VHDL entity, architecture, or package found by a library scan | `du_` in the project file. Ports and generics come from the source span. |
| Imported `DiagramDocument` | A read-only reading of one `.bd` or `.sm` file | `dg_` in the project file. The source file is not written. |
| `EditableDiagram` schema 1 | The sheet the editor saves | `edg_` under `workspace/diagrams/`. |

`analyze` in `backend/app/hdl/analyze.py` reads an `EditableDiagram` and builds the language-neutral netlist in `backend/app/hdl/ir.py`. Coordinates, wire points, and label boxes are not part of that netlist. `generate_structural` renders it. The FSM generator reads `kind`, `fsm`, states, and transitions, and it does not read text-box positions.

A created sheet is already an `EditableDiagram` with `provenance.origin` of `created`. Its `entity_name`, `generics`, and `diagram_ports` are the interface. An instance points at another sheet with `child_diagram_id`, or at a scanned entity with `design_unit_id`. The generator follows `child_diagram_id`. Two instances that share that id already share one implementation, and each keeps its own instance name and generic values.

The sheet is the design unit. A second design document is not required for that. The instance also keeps its own copy of the ports. A later edit of the child does not update that copy. Generation compares the two lists and stops on a mismatch. Nothing rewrites the parent.

### Nets and geometry are already split, and the split is incomplete

`EditableNet` is the electrical object: a name, a type, a range, and a list of port endpoints. An endpoint names an instance port or a diagram port and may carry `slice_text`. Several wires may share one `net_id`. `merge_nets` and `split_endpoint` edit that list. Connecting two ports that already sit on different nets does not merge them until the user chooses a survivor.

`EditableWire` is one polyline with at most two ends. A junction is a point, not a graph node that owns the segments meeting there. A bus is a net whose `range_text` is non-empty. The thicker stroke is only a view of that field. A slice is text on the wire and on the endpoint. The generator turns a net with a top-level port into a port actual, and any other net into one internal signal. It does not read the polyline.

### Why a label falls off its wire

The signal caption is `label_x`, `label_y`, `label_width`, and `label_height` on the wire. Those are absolute source coordinates, copied from the HDL Designer text box. `translate_owner` in `backend/app/editing/geometry.py` moves the instance, its port rectangles, and the attached polyline end. It does not read or write the label. After the move, the net id is unchanged and the caption is no longer on the segment.

That is a storage choice, not a drawing bug. A caption whose only record is an absolute box cannot follow a segment. D3 must not patch this by guessing a new absolute box after every drag. The stored binding has to be the net and the segment.

## Baseline

E0 is implemented and tested in software. Opening an imported block or state diagram edits one `EditableDiagram`. The separate read-only sheet is not part of the studio path. The following stays in place for every later D step.

- `selectDiagram` calls `find_by_source`. An existing work file is opened. A missing one is created once and saved.
- A second open, including a second request already in flight, does not create another work file.
- Save, undo, and redo operate on that document. Creating the file on first open does not mark it dirty. A failed save keeps the in-memory document and the undo stack.
- Port names sit on the pins. Signal names use the stored label box. Hidden labels stay hidden. A scalar stroke is 0.6 px and a bus stroke is 1.15 px.
- `.bd` and `.sm` files are not written. The VHDL generators are not changed by editor work.

These files are regression fixtures. Opening them again returns the same id and does not replace saved edits with a fresh import.

| Fixture | Work file | Holds |
| --- | --- | --- |
| `top_rtc_app` | `edg_b8c5a1b43a0640589c9fc9362e96566f` | 347 wires, 310 visible labels, 37 hidden labels |
| `morse_transmitter` | `edg_e78a939e14fb42599794f2c73c3afe55` | 7 states, 14 transitions, 20 text boxes |

A later test of these files also checks undo, redo, and save, and checks that the `.bd` and `.sm` bytes are unchanged. Design ids, instance ids, net ids, and stored label positions are not rewritten by opening, scanning, or saving an unrelated edit.

## Decision: extend EditableDiagram

`EditableDiagram` schema 1 is the design document. D0 does not add a parallel model.

| Concern | Already stored | What D adds |
| --- | --- | --- |
| Net topology | `EditableNet.endpoints` lists every connected port and an optional slice. Several `EditableWire` polylines share one `net_id`. | The wire is the segment. A branch is several wires of one net that meet at an `EditableJunction`. The endpoint list is the connection. Coordinates do not create a net. |
| Port binding | An instance keeps a copy of the ports it was connected with, plus `child_diagram_id` or `design_unit_id`. The generator compares that copy with the child. | The mismatch is reported as `interface_stale`. The copy is not a second declaration and is not refreshed by opening the parent. |
| Design unit | `entity_name`, `generics`, `diagram_ports`, and `kind` live on the sheet. | The sheet is the unit. A scanned VHDL entity stays an inventory `DesignUnit` and is referenced by `design_unit_id`. It does not gain an empty sheet. |
| Hierarchy | `child_diagram_id` and `hierarchy_checks`. The session stack is the back path and is not stored in the file. | D6 navigates that id. A VHDL-only entity does not receive a diagram. |

A parallel document would be justified only if one unit had to own more than one implementation at the same time, or if keeping the existing ids required a new file. A unit has one kind, `block` or `state`. Neither condition holds, so no second format is introduced.

## Schema version

Schema version stays 1. Optional fields with defaults are how the label box and the earlier editor fields were added. An older file still loads. This is valid only while the new field does not change the meaning of an old field.

`label_x`, `label_y`, `label_width`, and `label_height` stay an absolute source box. They are not reinterpreted as a distance along a wire. A binding, when D3 stores one, is a new optional field and defaults to absent. A file that has no binding behaves as it does today.

Rules:

- Opening, scanning, or saving does not add bindings and does not move label boxes.
- A wire keeps its id, its points, and its two ends. A branch adds wires and a junction. It does not replace the existing polyline with another object.
- `child_diagram_id` stays the hierarchy reference.
- The project file stays schema 2. A workspace library that is not a scanned tree needs one optional field, described under D1. That field defaults so an existing project still opens.

The project file change is not a diagram migration.

## Canonical model

Imported sheets and sheets drawn in HDL-Maker are the same `EditableDiagram`. The import source remains the `.bd` or `.sm` file. The working document remains one file per design, found by `find_by_source`. Reopening does not allocate a new id.

One design unit is one document:

| Part | Owns | Does not own |
| --- | --- | --- |
| Interface | Port and generic declarations of this unit | Pin graphics, wire points |
| Implementation | Either one structural sheet or one FSM | A second copy of the ports |
| Symbol | Nothing stored | It is a view of the interface |
| Instance, on a parent sheet | Instance name, generic values, the unit id, a binding snapshot, pin positions | The child implementation |

A unit has one implementation kind: `structural`, `fsm`, or `external`. `external` is a scanned VHDL entity with no sheet. It can be instantiated. It does not gain an empty diagram. A unit does not carry both a structural sheet and an FSM in this version. A second architecture is later work. `architecture_name` stays a name, and an empty one is still rendered as `rtl` by the generator without writing that name back into the file.

The binding snapshot is the port list already stored on the instance: name, direction, type, and range, taken at instantiation. It is the record of what the parent was connected to. It is not a place to invent a port the unit does not declare. Pin coordinates live with that snapshot because they are geometry of the parent sheet.

### Net

A net is the electrical connection.

- Stable id and name. Renaming the net renames every caption of that net.
- `type_text` and `range_text` when the user or the import stated them. A missing type stays missing.
- Attachments. Each attachment is one port on an instance or on this sheet, plus an optional slice. A net may have more than two attachments.
- No coordinates.

A bus is a net with a recorded range. A scalar is a net without one. The view draws 1.15 px and 0.6 px from that fact, as E1 does. The stroke is not stored on the net.

A slice belongs to the attachment. `data` and `data(3 downto 0)` are one net and two attachments when the user connected them that way. A slice is not a new net. Width is taken from the text only when it is an integer `downto` or `to` range, which is the rule M2b already uses. Any other expression stays text.

The generator keeps reading attachments, names, types, ranges, and slices. It does not start reading segments. A segment that was drawn without an attachment must not become a signal. A connection command writes the attachment and the segment together, or it writes neither.

### Segments, joints, and labels

The drawing of a net stays on the wires already stored.

- A **segment** is one `EditableWire`: its id, its `net_id`, and its polyline. A Vue Flow edge may display that wire. The net is not an edge. Vue Flow handle ids are the port ids. After a pin moves, the view calls `updateNodeInternals` for that node. The handle id does not change, and the call does not define the net.
- A **segment end** is the wire's existing start or end. It names a port or a junction. The port end uses the same owner and port id as the net endpoint.
- A **joint** is an `EditableJunction` where more than two wire ends of the same net meet. Moving a joint moves those ends and does not change the net id. A joint is not an HDL port and is not a signal.
- A **label binding**, added by D3 as optional fields, stores the wire id, a distance from the start of that polyline in source units, and a signed perpendicular offset in source units. The words on the canvas are the net name. The view flips Y as it does today. The offset is not a screen-space "above". Hidden stays hidden and is not drawn.

D3 does not follow a component by adding the same delta to `label_x` and `label_y`. That misses a wire that changes length, gains a corner, or is a new branch. When a binding is present, the move updates the polyline and then derives the absolute box from the distance and the offset. The binding itself stays. When a binding is absent, the absolute box stays where it was stored. The editor does not choose a nearby wire.

A newly drawn wire or branch receives its binding when it is created. An existing label is not given a binding by opening the file.

Moving an instance is one operation:

1. The instance box and its port rectangles.
2. Every wire end bound to those ports, including the orthogonal bend `stick_end` already maintains.
3. For a bound label, a new absolute box derived from that wire. For an unbound label, no change.
4. No endpoint, net id, slice, or port declaration.

If a move inserts a corner, the distance remains an arc length along that same wire. If the polyline becomes shorter than the distance, the distance clamps to the new length and the label stays on that wire.

Undo restores the document from before the operation, including the box and the binding. The current undo already restores a whole document.

## Design-unit lifecycle

1. **Create.** A name and a library. The document is an empty structural sheet. No ports are invented.
2. **Declare.** The user adds ports and generics. Direction, type, range, and default are stored only when the user states them. Width follows the existing `described_width` rules.
3. **Implement.** Instances, nets, and segments are edited on that sheet. An FSM unit is edited on the FSM view of the same document instead.
4. **Symbol.** The symbol is drawn from the interface order and the recorded directions. Inputs on the left and outputs on the right are a view default. A missing direction is not drawn as an input, an output, or a triangle. Port triangles, pentagons, and hexagons stay out of D1–D5.
5. **Instantiate.** The parent creates an instance with its own name and generic values, stores the unit id, and copies the binding snapshot. The implementation is not copied.
6. **Open.** A double-click, later, opens that same document. Every instance of the unit opens the same sheet. The session stack that M2b already keeps is the back path. It is not stored in the file.

### Reuse and incompatible interfaces

Instances of one unit share the implementation and do not share instance names or generic values.

Changing a port or a generic on the unit increments nothing in the parent files. The parent is not rewritten. A check compares each binding snapshot with the unit's current interface. A missing formal, an extra formal, or a changed direction, type, or range is `interface_stale`. Generation already refuses a child port list that does not match, and that refusal stays. The user updates an instance in an explicit command, which is D6. Until that command exists, a stale instance is reported and left in place.

Deleting a unit that is still instantiated does not delete the parents. The existing `child_missing` diagnostic covers a missing id. The instance remains so the user can retarget it or remove it.

A cycle remains `recursive_hierarchy`. Saving the file may still record the cycle so the user can remove the instance. Generation does not emit a cyclic hierarchy.

## FSM

An FSM is an implementation kind of a design unit, not a second database. The document already has `kind`, `states`, `transitions`, `text_boxes`, and `fsm`. D7 extends that record with the properties E3 listed: clock, reset, enable, interrupt, signal scheme, statements, state actions, transition conditions and priorities, encoding, and recovery. Those fields are added in the version that D7 specifies. D0 does not add them.

The M3b generator stays on the fields it reads now. A later generator change is allowed only after a comparison against the machines M3b and M3c already generate, including `morse_transmitter`. That comparison is not part of D0 and not part of the first D7 editor slice.

## Undo

The undo unit is one user operation: instantiate, connect, disconnect, delete, move, rename, or an interface edit. A drag is one operation at pointer down, which is what `beginChange` already does, not one snapshot per move event. The history is a document snapshot, capped at 40, held in the session. That is enough through D5.

An operation that would rewrite a second file is out of scope through D5. An interface edit marks no parent. Parents compute `interface_stale` when they are opened or generated. Undo of the interface edit is undo inside the unit file.

D6 is the first step that may edit more than one file, and only for an explicit command such as "update instance". That command is one transaction: every file is written, or none is. Its undo restores every file from the transaction. D0 does not design a general cross-file command log beyond that rule.

Creating the working file on first open is not an edit. E0 already leaves that document clean. A failed save does not drop the in-memory document or the undo stack.

## Migration

There is no new diagram schema and no conversion on open. `find_by_source` returns the existing file. A repeated open does not create a second `edg_` and does not replace user edits with another import. A failed import does not save an empty document over a good one.

An edit saves the same id. Design ids, instance ids, net ids, wire points, and label boxes change only when that edit changes them. Startup and scan do not rewrite `workspace/diagrams/`.

D3 may later store a binding beside an existing box. That write is a separate, tested edit. It keeps the wire id and the numeric box, computes the distance and offset from that box on that same wire, and leaves a hidden label hidden. It does not run as part of opening `top_rtc_app` or `morse_transmitter`. If the box cannot be placed on its own polyline, the binding stays absent and the box is unchanged.

The `.bd` and `.sm` hashes are not an input to any of this. Those files are not opened for writing.

## D1 through D9

Dependencies are ordered. A step does not start by inventing a shortcut around the step it depends on.

| Step | Depends on | Acceptance |
| --- | --- | --- |
| D1 | D0 | Create a workspace library, an empty design unit, and its ports and generics. Save, close, reopen the same id. Schema stays 1. No wire is created. No generator file changes. |
| D2 | D1 | Instantiate a library entity or a workspace unit. Move and scale the instance. The binding snapshot and the net ids stay. Labels are not claimed to follow until D3. |
| D3 | D0 net model, D2 | Draw, connect, disconnect, and delete on the existing wire and net. A branch is a junction. A bound label follows its wire by offset, not by the instance delta. An unbound label stays put. New wires receive a binding. Existing files are not rewritten on open. Undo and redo restore the document. |
| D4 | D3 | Edit ports, signals, generics, and slices on a sheet that has nets. A missing type stays missing. A name edit renames the net, not one caption. |
| D5 | D4 | Build the symbol from the interface. Instantiate that unit twice. Both instances open one implementation and keep their own names and generic values. |
| D6 | D5 | Hierarchy navigation, an explicit instance update, and library operations. A stale interface is reported and is not rewritten by opening the parent. |
| D7 | D1, and after D5 so the unit lifecycle exists | FSM properties and graphical FSM editing on the same document. M3b output is unchanged until a recorded comparison says otherwise. |
| D8 | D3, and the vertical test needs D5 | Design-rule checks and a generation run through the existing generators. A failed check does not emit a repaired netlist. |
| D9 | D3 | Auto-routing, auto-layout, copy and paste, and multi-select. These do not define connectivity. |

E0 and E1 stay the current editor. They are not redone.

| E step | After D0 |
| --- | --- |
| E2 Hierarchy | The surface of D5 and D6. The existing Open inside action stays. A second double-click path is not added before D6. |
| E3 FSM properties | D7. No parallel property schema. |
| E4 Draw states and transitions | D7. |
| E5 Full block editor | D2 through D5. E5 is not implemented as its own editor. |
| E6 Search, auto-layout, overlays | D9. |

## Vertical test

The test is the checkpoint after D5, using the generator and GHDL as they stand. D0 does not create the designs and does not run GHDL.

The units are `counter`, `comparator`, `pulse_generator`, and `system_top`, in one workspace library.

- `pulse_generator` declares `clk`, `reset`, `enable`, and `pulse`. The test states each direction and type in the file it creates. D0 does not choose those types.
- `counter` and `comparator` are created the same way. Their ports are whatever that test declares. Nothing is inferred from the names.
- `pulse_generator` instantiates both, connects them with nets the test names, and gets a symbol from its four ports.
- `system_top` instantiates `pulse_generator` twice, with two instance names and, where the test sets them, two generic values. Both instances refer to one document.
- VHDL-93 is generated with the current structural generator. GHDL analyzes and elaborates it. A failure is a D8 result, not a reason to rewrite the generator inside the test.
- The `.bd` and `.sm` trees under `libs/` are not part of this test and are not modified.

If the current generator cannot express a construct the test needs, the test stops with that diagnostic. The construct is a D8 finding. It is not patched in M3a as a side effect of drawing.

## Recommendation for D1

D1 stays on schema version 1 and on `EditableDiagram`. An empty sheet has no nets and no labels. Drawing wires in D1 would be D3.

D1 scope:

- A workspace library the user can create without scanning a directory. The project file gains an optional library role, defaulting to the current scanned library, so existing projects still open. The workspace library is not scanned and is not an HDL Designer root.
- A new design unit is `new_diagram`: one new `edg_` id, `origin` `created`, the name stored as `entity_name`, an empty instance list.
- Ports and generics use `add_interface_port` and `add_generic`. The user supplies every direction, type, and range. Unspecified fields stay empty. Width is computed only by the existing rules.
- Save and reopen return that id. Creating the file does not mark the document dirty beyond the edits the user made.
- No connect command, no symbol view, no hierarchy double-click, no second document type, no change under `backend/app/hdl/`.
- The two regression files keep their ids. D1 does not open them in order to migrate them.

D1 is done when `counter`, `comparator`, `pulse_generator`, and `system_top` can be created empty, `pulse_generator` can store the four port names, and reopening shows the same ids and the same port list.

D2, D3, D4, and D5 are the next phase after that, in that order. D3 adds the optional label binding on the existing wire. E2 waits for D6.

## Not in D0

No editor implementation, no generator change, no rewrite of `edg_*.json`, no `.bd` or `.sm` writer, no edits under `libs/`, no FPGA programming, and no commit.
