# D4c — Component interface authoring

D4c lets a project grow from an empty sheet. A component starts without an implementation. Its logical ports are edited as one project command. A diagram is created only by **Create implementation**. A double-click still does not invent one. There are no VHDL or SystemVerilog types, and no HDL is generated.

## Three objects, one logical id

A logical port is a `ComponentPort`. It has an id and a name. It has no position.

The same id is cited by two other objects, which stay distinct:

- The instance port on each block that cites the component. The wire cites this port id.
- The connector on the Boundary block inside the implementation diagram.

A symbol pin is a fourth object. It lives on the symbol and keeps its own position. A binding is the pair `{ interfacePortId, symbolPortId }`. Equal names do not create a binding. If the component has a symbol and a logical port has no binding, the editor says it was not matched by name.

Adding a logical port appends it to the definition and adds a new port object on every existing instance and on the boundary, when a diagram already exists. Those new ports get new ids and the same `interfacePortId`. Ports and wires that were already there keep their ids.

Renaming changes the visible name on the definition, the instances, the boundary, and a pin that is already bound to that id. Port ids, binding ids, and net ids stay.

Reordering changes `t` along the side. It does not change ids.

Removing a logical port removes the definition entry and its binding. An instance or boundary port that has no wire is removed. A port that has a wire stays, the wire stays, and `interfaceDiagnostics` reports `wired-removed`. That is the same rule D3e uses for a missing symbol pin: the connection is kept and named, not dropped.

## Create implementation

The command is available only when the implementation kind is `none`. It adds one empty document, sets `implementation` to `diagram`, and places a Boundary block with one connector per logical port. Calling it again returns the same project unchanged. A reserved kind such as `vhdl` is not replaced by a diagram.

The new document is the one D4b already opens. U1 and U2 still share it and still have different instance paths.

## Undo rule

Sheet undo and project undo are different stacks.

A sheet edit mutates the document that is already inside the project. Its history is the `EditSession` for that document id. U1 and U2 still share that session.

A port, binding, placement, new component, or **Create implementation** runs through `ProjectSession.transact`. The command clones the project, changes the definition and every affected document, and replaces the whole project only if the result is a new object. A refused command does not add a step.

Before the snapshot is taken, an open gesture is cancelled. An unfinished wire is dropped and is not committed.

After a project command, and again after project undo or redo, every `DocumentSession` is discarded and the open sheet is read back from the project. A sheet undo therefore cannot write an older document over the other instances, the symbol, or the definition. The earlier sheet edits are already inside the project snapshot, so project undo keeps them. A sheet edit made after the project command is part of the live project; project undo returns to the snapshot from before the command, so that later sheet edit is not kept. Project redo returns every document to the state from just before the undo.

Opening another project, reloading, or leaving the project clears the project stack.

## Tests

`npx tsx src/core/selfcheck.ts` passes, including D0 through D4b. The D4c checks cover three abstract components, ports added to an instance, a rename that keeps the port id and the wire, a removed wired port that stays and is diagnosed, one implementation diagram with its own connector ids, a refused second implementation, navigation that opens only after the explicit command, Filter, Gain, and Register inside that diagram, a second instance with the same logical ids and different port ids, a pin that is not bound by name, one shared edit session that cannot undo across the project command, project undo and redo, and save and reload of the hierarchy.

`npx vue-tsc --noEmit` passes.

In the browser at `http://localhost:5174/`, **New project** starts an empty root. SignalSource, Processing, and Output were created and placed from the component panel. Processing received `in1`, `in2`, and `out`. SignalSource received `y` and Output received `d`. The wire tool connected `y` to `in1` and `out` to `d`. Double-click on Output stayed on the root and reported that it has no implementation. **Create implementation** on Processing, then a double-click, opened one child sheet. Filter, Gain, and Register were placed there. A second Processing on the root opened the same document id through a different block id. Renaming `in1` to `data` changed both instances and left the port ids, the interface id, and both wires in place. Sheet undo stayed disabled. Removing `data` kept the wired port and the wire, removed the unwired copy on the other instance, and showed the diagnosis. Project undo restored `data`. **Add pin** bound both instances to the same new pin id and left `in2` and `out` unbound, with a note that they were not matched by name. Save and reload kept the project id, the root document, both Processing instances, and Filter, Gain, and Register.

## Not in D4c

Extract, expand, and definition commands are D4d and are recorded in [d4d-hierarchical-authoring.md](d4d-hierarchical-authoring.md). D4f, D4g, HDL generation, the FSM editor, simulation, FPGA programming, and the HDL-Maker studio are not started.
