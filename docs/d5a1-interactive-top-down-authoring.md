# D5a.1 — Interactive top-down design authoring

D5a.1 adds a diagram-first path beside the existing component panel. A block that is already on the sheet can become a hierarchical component. The drawn block stays. A second block is not placed.

The library path stays: **New component**, **Create implementation**, and **Place on sheet** still work. There is no second component model, no second hierarchy, and no second editor. D5b is not part of this step and is not released.

The user closed the functional acceptance of this flow on 25 Nov 2026. The user's own session checked the return to the parent sheet and two hierarchy levels. The user accepted the remaining checks from the lab session. The record of those checks stays below. D5a.2, the block-size fix found during that acceptance, is [d5a2-interactive-block-resizing.md](d5a2-interactive-block-resizing.md).

## Four objects

The new flow uses the objects that D3 and D4 already store.

| Object | What it is | What Open as does with it |
| --- | --- | --- |
| Symbol | The graphic picture: shapes, size default, and pins with stable pin ids. | The block keeps its `symbolId`. A pin is bound only when that pin id exists on the symbol. A name is never used as a match. |
| Block instance | One box on one sheet: its own id, position, size, name, ports, and wires. | The same block remains. Its id, position, width, height, name, symbol, port ids, and wires stay. |
| Component definition | The shared logical part: a name, logical ports, optional symbol, and one implementation. | A generic block gains one definition. The definition appears in the Components panel and can be placed again. |
| Implementation | The child diagram of that definition. | One new diagram is created and opened. Further instances open that same diagram. |

A block with no `componentId` is still only an instance of a symbol. Open as is what adds the definition and the implementation. A later instance gets its own block id and its own port ids, and it cites the same definition.

## Gestures

A single click selects the block. It does not open a child. Selection, move, and resize stay possible.

| Gesture | Result |
| --- | --- |
| Single click | Select the block. |
| Double-click on a generic block | Open the Open as dialog. |
| Double-click on a component with no implementation | Open the Open as dialog for that existing component. |
| Double-click on a component that already has a diagram | Open that diagram. No second definition is created. |
| Right-click | A menu with **Open as…**, or **Open implementation** when a diagram already exists. |
| Breadcrumb, project tree, Back, Forward | The navigation from D4b. Unchanged. |

**Open as…** is a command on the selected block. The Components panel does not have to be focused first.

The dialog lists four kinds:

- **Block diagram** is the only choice that writes anything.
- **State machine (FSM)**, **VHDL text**, and **SystemVerilog text** are shown and disabled. They reserve the later multi-language path. They do not create an editor.

**Cancel** and Escape close the dialog. The project is unchanged and no undo step is added.

The sheet Boundary (the block named Boundary with no `componentId`) is refused. It stays the interface of the diagram it already belongs to.

## What Block diagram writes

Confirming **Block diagram** on a generic block is one project command:

1. Create one component definition. The name is the block name.
2. Set `componentId` on the existing block.
3. Create one implementation diagram.
4. Give each existing port of that block one new logical port id, written onto that same port.
5. Add Boundary connectors that cite those same logical ids. Each connector copies the port name, side, and `t`.
6. Open the child through the existing navigation.

A block with no ports gets a diagram whose interface is empty: a Boundary and no connectors. Ports can be added afterwards with the D4c commands.

An extra port that has no symbol pin, or whose pin id is already bound, stays a logical port and is not bound. The diagnosis says it was not matched by name. No direction, type, or width is invented.

Confirming **Block diagram** on a component whose implementation kind is `none` calls the existing create-implementation command. It does not create a second definition. The block size on the parent sheet is left as the user set it.

A second Open as on a block that already has a diagram returns the same project and adds no undo step.

## Undo

The conversion is one `ProjectSession` transaction. A refused command returns the same project and adds no step. **Project undo** restores the generic block, including its size, ports, and wires. **Project redo** restores the definition and the diagram.

A project command still discards the sheet undo history. The status line says so. That split stays until D5b is implemented. D5b is released; see [d5b-transactional-undo-architecture.md](d5b-transactional-undo-architecture.md).

## Automated tests

`npx tsx src/core/selfcheck.ts` in `diagram-lab` prints `selfcheck ok`. The D5a.1 checks in that run are:

- A library Generic block named Counter, moved to (140, 96) and sized 210×128, keeps that id, place, size, name, and `symbolId` after Open as, and gains one `componentId`.
- Its instance port ids, symbol pin ids, sides, and `t` values stay, and each port receives one `interfacePortId`.
- The wire to a second block, the segment JSON, and the label JSON stay.
- Bindings cite only `pin_block_in` and `pin_block_out`.
- The Boundary connectors cite the same logical ids.
- `validateProject` and `findCycles` are empty.
- A second Open as returns the same project and does not add a diagram.
- A second instance shares the component id, has its own block id, and the project still has one component.
- Project undo removes the component and restores the generic block at 210×128. Project redo restores the component and a project with two documents.
- A block named Plain with no ports gets a Boundary and zero child ports.
- An existing Latch with kind `none`, resized to 240×100, gains a diagram, keeps that size, and stays the only component. `createdDefinition` is false.
- Open as on a Boundary block returns the same project.

`npx vue-tsc --noEmit` in `diagram-lab` exits 0. The D0–D4d checks in the same selfcheck still pass. No file under `libs/` and no EditableDiagram file was changed.

## Browser check

The lab was `http://localhost:5174/`. This pass is separate from the selfcheck. It does not close the user's acceptance.

On a new empty project:

- A Generic block was placed, renamed Counter, moved to (140, 96), and sized 210×128. A port was added. A Process block was placed and given a port. One net connected the two blocks.
- Double-click opened **Open as**. State machine (FSM), VHDL text, and SystemVerilog text were disabled. **Cancel** left the sheet with no component and with Project undo still disabled. The status was `Open as cancelled.`
- **Block diagram** kept the same Counter at 210×128 and (140, 96), listed Counter (1), and opened the child. The status was `This block now opens a diagram. Sheet undo was cleared. Project undo reverses this change.`
- The child interface showed `in` and `out` bound to the symbol pins, and `p3` unbound, with the text that it was not matched by name.
- A Generic block drawn inside that child was opened from the right-click menu **Open as…**. The menu item opened the same dialog. Confirming **Block diagram** added Generic block (1) and opened its diagram. The breadcrumb returned to the root. Counter was still 210×128 at (140, 96).
- **Place on sheet** on Counter added a second instance. The panel read Counter (2). The tree listed both instances. Save and Reload kept Counter (2), Generic block (1), the nested tree, and the 210×128 size. After reload, a double-click on one Counter opened the child that still contained the nested Generic block, without showing the dialog.
- The second canvas instance was not double-clicked in this pass. The selfcheck is what asserts that a second instance shares the definition and does not add a document.

On a separate new project:

- A Rectangle with no ports was sized to 160×64. **Block diagram** opened a child that contained only Boundary and no interface ports.
- **Project undo** returned to the root Rectangle with no component. **Project redo** restored Rectangle (1). The node was still 160×64 at (80, 80).
- A Latch created with **New component** (kind none) was placed and double-clicked. The dialog opened. **Block diagram** reported `The implementation diagram is open.` The panel still showed one Latch. **Create implementation** was then disabled.

## User session

On 25 Nov 2026 the user verified, in their own session:

- Creating a hierarchy and navigating through two levels.
- Returning to the parent sheet after **Open as**. The control they used is the bar above the canvas (**Up**, the parent name, or **Root**). A Simulink-style up icon on the canvas is not part of the lab.

The same note is in [d5a-status-open-as.md](d5a-status-open-as.md).

## Acceptance

On 25 Nov 2026 the user closed D5a.1. The user had already verified the parent-sheet return and two hierarchy levels. The user then accepted the remaining lab checks: cancel, the drawn size and existing wires, a second instance, save and load, project undo and redo, a block with no ports, and a component that already exists with no implementation.

D5b is released for architecture work after D5a. The size defect found in the same acceptance is D5a.2 and is not part of this acceptance. The user accepted D5a.2 later the same day. Routing, signal-name placement, the toolbar, the FSM editor, text editors, HDL generation, FPGA tools, and the HDL-Maker studio are unchanged.
