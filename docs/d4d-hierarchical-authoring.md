# D4d — Hierarchical design authoring

D4d adds the project commands that turn a flat drawing into a hierarchy, and the commands that manage the definitions afterwards. The core stays free of Vue, HDL, and FPGA tools. A refused command returns the same project object and adds no undo step.

## Component management

A definition can be created, renamed, placed, duplicated, or deleted from the component panel.

Rename changes the definition name. Instance names stay, and port ids stay. If the component symbol still has the old definition name, that symbol name follows.

Duplicate copies the definition, its logical ports, its symbol, and its implementation diagram. The copy gets new ids for the component, the logical ports, the symbol pins, and every object in the diagram. Bindings are rewritten to those new ids. Instances of other components inside the copy still cite those components. Instances of the original are not moved.

Delete removes a component only when nothing cites it. The message names the instances that still use it, and the project is unchanged. When the delete succeeds, a private implementation diagram is removed with the definition, unless that diagram is the project root or another component still cites it. A symbol that no block and no other component cites is removed as well.

Make unique is the same copy, applied to one selected instance. That instance's port ids stay, so its wires stay. Its `componentId`, `interfacePortId`, and symbol pin ids move to the copy. Every other instance keeps the original definition. An instance that is already the only one is refused.

Duplicating a block with the ordinary Duplicate command still copies `componentId`. It does not create a definition.

## Extract

Extract is a preview, then a confirmation. The preview lists the proposed ports and the notes. Cancel writes nothing.

The command needs at least two blocks on the current sheet. The sheet Boundary is refused. The operation then:

1. Creates one component and one implementation diagram.
2. Moves the selected blocks, the wires that stay inside the selection, their junctions, their labels, and a group whose members all move.
3. Finds each net that has a port inside the selection and a port outside it.
4. Adds one logical port per such net. The name comes from the net name. Two nets with the same name stay two nets and get distinct port names. No direction and no type is added.
5. Places a symbol pin and a Boundary connector for that port and binds them by id.
6. Replaces the selection with one instance. Outside wires are retargeted to the new instance ports. Inside wires are retargeted to the Boundary. Segment ids that stay on one side are kept, and a manual route stays manual.

A junction that only connects selected blocks moves inside. A junction that connects two or more outside endpoints stays outside, and the wire from the selection is the new port. A junction that is required on both sides is copied: the outside copy keeps the outside branch, the inside copy keeps the inside branch, and the port joins the two copies. A free end that sits on that boundary is refused before anything is written. A chain of two such junctions is also refused. Same-named nets are never merged.

Ink strokes stay on the sheet they were drawn on. They are not part of the net topology.

## Expand

Expand replaces one instance with a copy of its implementation diagram. Other instances and the shared definition stay.

It runs only when the diagram is unambiguous: one Boundary block, each boundary connector cites one logical port, no net joins two boundary connectors, and no instance port sits on two nets. Anything else is shown and refused.

Copied blocks, ports, nets, junctions, segments, labels, groups, and strokes receive new ids. A wire on the parent that cited the instance port and a wire in the diagram that cited the matching boundary port become one net, joined at a junction where the instance port was. The wires are not deleted. The copy is placed so the inner blocks return to the positions they had on this sheet when the component was extracted from it.

## Undo

Extract, expand, rename, duplicate, delete, and make unique each go through `ProjectSession.transact`. One step restores the definitions, documents, instances, ports, nets, junctions, labels, and assets together.

The D4c rule still holds. Before the snapshot, an open gesture is cancelled. After the command, and after project undo or redo, every `DocumentSession` is discarded and the open sheet is read back from the project. The sheet Undo button stays disabled until the next sheet edit. Its tooltip says that a project change clears that list. The component panel says the same: sheet undo is cleared, and Project undo restores every document. If a sheet history was pending, the status line repeats that it was cleared.

What that throws away is the undo stack of each document that had been edited in this session, including the shared stack of two instances of one diagram. The edits themselves are already in the project. A sheet edit made before the project command is inside the snapshot, so project undo keeps it. A sheet edit made after the command is not in that snapshot, so project undo drops it. Project redo returns the documents to the state from just before the undo.

A single transaction history that could undo a sheet edit and a project command as one mixed stack is not built. The two buttons stay separate so a sheet undo cannot write an old document over the other instances.

## Tests

`npx tsx src/core/selfcheck.ts` passes, including D0 through D4c. The D4d checks build seven blocks and branched nets. They cover a refused single-block extract, a refused free end on the boundary, an extract that keeps an internal junction, an outside junction, a split between two inside ports and one outside port, two nets of the same name, a manual segment, a moved label, a moved group, and one logical id on the pin, the instance, and the boundary. Project undo and redo restore that topology. A second instance opens the same diagram. Make unique isolates one instance. Expanding the other restores the outside connection and leaves the unique diagram in place. Save and reload keep both definitions. An ordinary duplicate keeps the shared component id. Deleting a used component is refused. Deleting an unused component removes its private diagram.

`npx vue-tsc --noEmit` passes.

In the browser at `http://localhost:5174/`, **New project** started an empty root. Six Process blocks were placed and given ports. Four wires were new nets, and a fifth wire landed on an existing segment, so one junction joined two inside ports to one outside port. Extract listed two ports and said that junction would move inside, then **Create component** ran. The child sheet contained the four blocks, the Boundary, the original port ids, and that junction. On the root, the outside ports still cited the new instance ports and the same logical ids. Duplicating the instance kept one component id. Make unique gave the copy its own ids. The two remaining instances of the original opened one diagram through different block paths, and the status read “Logic — shared definition — 2 instances”. Expand restored the four blocks and kept the outside port ids. Project undo put the instance and those same port ids back. Save and reload kept the project id and all three instances.

## Not in D4d

D4f reusable component libraries, D4g acceptance against an HDL adapter, D5b through D5f, HDL generation, the FSM editor, simulation, FPGA programming, and the HDL-Maker studio are not started. D5a is the acceptance review and is recorded in [d5a-editor-acceptance.md](d5a-editor-acceptance.md). The earlier plan's D4e extract is this extract.
