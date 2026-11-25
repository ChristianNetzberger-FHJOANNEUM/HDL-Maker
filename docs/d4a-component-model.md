# D4a — Component and project model

D4a is the data model for a hierarchy. It does not open a child sheet, does not draw breadcrumbs, and does not synchronize pins. Those are D4b and D4c. The lab stays free of Vue inside the core, and free of HDL, Python, and FPGA tools.

## Definition and instance

| Object | Role |
| --- | --- |
| ComponentDefinition | Identity, logical ports, optional symbol, optional implementation. No position. |
| SymbolDefinition | The picture. It stays in a diagram, as in D3. |
| DiagramDocument | One sheet: blocks, nets, segments, symbols, assets. |
| Block | The instance. `componentId` cites the component. The block keeps its own id and its own port ids. |

There is no second instance type and no second net model. A wire still cites an instance port id.

U1 and U2 can cite the same component. Their blocks and ports are different objects. The implementation diagram is stored once. Editing that diagram is visible through every instance path, because every path resolves to the same document. Making an independent copy of a component is a later, explicit action. D4a does not copy the diagram when it places an instance.

A component with implementation `none` is a valid design. `diagram` points at a document id inside the project. A later kind such as `vhdl` or `fsm` can be stored and is reported as unsupported. The core has no HDL fields.

## Interface identity

Four ids stay distinct:

| Id | What it names |
| --- | --- |
| interfacePortId | The logical port. It has no coordinates. |
| symbolPortId | The pin on the symbol picture. |
| port id | The port on one instance. Wires use this id. |
| a port in the child sheet | A different graphical object. It may cite the same interfacePortId. |

The link from a logical port to a symbol pin is a binding record with those two ids. Placement copies that binding onto the new instance port. It does not look at names or at coordinates. In the sample, the inner port is named `clock` and the logical port is named `clk`. They meet only because both carry `ifp_clk`.

D4c will edit these bindings and push changes onto the symbol and the sheets. D4a only stores them.

## Project and document

A project has an id, a name, a root document id, the documents, and the components. Documents are embedded. Assets stay inside the documents that use them. There is no path and no second asset list.

`DiagramStorage` is unchanged. `ProjectStorage` is a separate interface. The first implementation is `JsonProjectStorage`, an in-memory map of the project JSON, same idea as the diagram store.

A sheet still loads by itself. A page that has no project, including a later Nuxt page, can keep using `DiagramDocument` alone. `componentId` and `interfacePortId` are optional on that sheet.

Loading a project audits every embedded image the same way a document load does. A bad image refuses the whole project text.

## Instance paths

A path is a list of block ids, from the root sheet downward. `/Sample/U1/Stage` is only the display form, built from the project name and the block names. Identity is the block ids. Renaming a block does not create a new path and does not merge two paths.

A net does not leave its document. The hierarchical identity of a net is the instance path plus the net id. A net named `tick` on the root and a net named `tick` in the counter sheet are different. The counter net seen through U1 and the same net seen through U2 are also different records, because the paths differ. D4a does not connect them. Crossing a hierarchy boundary is later work.

## Cycles

The dependency graph has an edge from component A to component B when A's diagram contains a block that cites B. Several blocks citing B produce one edge. That is legal.

A cycle, including A inside A's own diagram, is rejected when the reference is added or when the implementation diagram is changed. The function returns the previous project object, so neither the new block nor a new document remains. Loading a project that already contains a cycle reports the cycle and does not invent a replacement component. A missing component, a missing document, a missing symbol, or an interface id that belongs to no related component is reported the same way.

## Transactions

`EditSession` is still the undo of one sheet. It is not replaced.

`ProjectSession` is the undo of a project command. It records a step only when the command returns a new project. A refusal returns the same object and adds no step. Creating a component and its diagram is one such command. Undo removes both. Redo restores both.

The lab button opens the sample root in the existing sheet session. It does not add a second undo button. Project undo is covered by the automated test.

## Tests

`npx tsx src/core/selfcheck.ts` passes, including the D0–D3e checks. The D4a checks cover shared definitions, distinct instance port ids, one shared child diagram, distinct paths for one child net, direct and indirect cycles, a legal repeated instance, a missing reference left unrepaired, an unimplemented component, save and reload, a reserved implementation kind that round-trips, a rejected image inside a project, and undo of a component-plus-diagram command.

The Project button in the lab opens the sample. U1 and U2 cite the same component id. Opening a level is D4b, recorded in [d4b-hierarchy-navigation.md](d4b-hierarchy-navigation.md).

## Before D4c

D4b walks the instance path and opens the document id of the selected step. The path is block ids, not block names.

D4c can edit `ComponentPort` and the binding list, then reuse the D3e rule that a symbol change keeps instance port ids. It should not start matching pins by name. The inner port and the outer port stay different objects that share `interfacePortId`.
