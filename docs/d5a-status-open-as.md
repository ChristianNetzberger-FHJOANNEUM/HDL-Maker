# D5a status — Open as on the selected block

Status for the external agent. D5a is in the user's own acceptance session. This file records one finding so the next work order can be written. It is not that work order.

D5a.1 implements this finding in the lab. The record is [d5a1-interactive-top-down-authoring.md](d5a1-interactive-top-down-authoring.md). On 25 Nov 2026 the user closed the functional acceptance of D5a.1. The block-size defect found in that acceptance is D5a.2 and is recorded in [d5a2-interactive-block-resizing.md](d5a2-interactive-block-resizing.md). The user accepted D5a.2 on 25 Nov 2026. Port authoring is D5a.3, recorded in [d5a3-interactive-port-authoring.md](d5a3-interactive-port-authoring.md). D5a.3a–D5a.3c are accepted; D5a.3 and D5a are complete. D5b is released; see [d5b-transactional-undo-architecture.md](d5b-transactional-undo-architecture.md).

## What the user already tried

On `http://localhost:5174/`, with **New project**:

- Drawing, undo, save, and load work.
- The user draws a block, resizes it, and selects it.
- **Create implementation** is in the right-hand **Components** list. It is not a command on the selected block.
- A double-click on the drawn block reports `Generic block is not a component` and stays on the same sheet.

The block on the sheet is the library symbol **Generic block** (`sym_block` in `lib_general`). It has no `componentId`. The component definition created from the right-hand list is a different object. **Place on sheet** drops a second block. That second block can be opened. The user rejected this split.

## The workflow the editor must follow

This is the normal path in HDL Designer, and the same idea as opening a subsystem in Simulink.

1. The user draws one block on the sheet and sets its size.
2. The user selects that block.
3. The user runs **Open as…**.
4. The choice is what the lower level shall be. For this step the only available choice is another diagram. An FSM and a VHDL text file are later choices. They are named so the command has a place for them. They do not open an editor now.
5. The same block becomes a component with a subdiagram. The size the user set stays on that block. No second block is created.
6. A click on that block descends into the lower level.

The user stated step 6 as a single click. In the lab today, a single click selects a block and a double-click descends into a block that already has `componentId`. The work order must choose the gesture explicitly. A single click that both selects and descends would change selection.

## What the lab does today

`descend` in `diagram-lab/src/core/navigate.ts` refuses a block without `componentId` and returns `Generic block is not a component`. A block whose component has `implementation.kind === 'none'` stays on the sheet with `has no implementation yet`. A double-click does not create a diagram.

`createImplementation` in `diagram-lab/src/core/interface.ts` takes a component id whose kind is `none`, creates an empty child document, and adds a **Boundary** block with one connector per logical port. It does not look at the selected sheet block. The button **Create implementation** is shown only after a component name in the right-hand list is focused, and it is disabled once the kind is no longer `none`.

**Place on sheet** calls `instantiateComponent` and creates a new instance. **Extract component** needs at least two selected blocks. Neither command turns the one selected block into the component.

A component of kind `diagram` is opened by double-click, the tree, or the breadcrumbs. U1 and U2 still share one implementation document. Kinds other than `none` and `diagram` are stored and reported as an editor that is not available. That rule stays.

## What the work order needs to accomplish

One command, **Open as…**, on the selected block of the open sheet.

- The target is that block. Its id, its position, and its width and height stay.
- The command creates one component and one implementation diagram, and sets `componentId` on that block.
- Ports already on the block become the logical interface. Their instance port ids stay, so wires that already end on those ports stay. The child **Boundary** cites the same `interfacePortId` values. No port, direction, width, or type is invented. A block with no ports gets a diagram with a Boundary and no connectors.
- The existing symbol, when the block has one, remains the symbol of the component. Bindings cite pin ids that already exist. Nothing is matched by name.
- The action is one project command. A refused command returns the same project and adds no undo step. After a successful command the sheet undo stack is still discarded, until D5b replaces that rule.
- Afterwards the user descends into that same block. The work order states whether that gesture is a double-click, as today, or another explicit control. It does not leave the gesture implied.
- The choice lists diagram, FSM, and VHDL text. Only diagram runs. FSM and VHDL text do not create a file, do not open an editor, and do not change the block.

## Invariants the order must keep

- The block remains the instance. There is no second instance type and no second net model.
- A net has no coordinates. This command does not route wires and does not move segments, except the Boundary connectors of the new diagram.
- A project command that would create a cycle returns the original project.
- Sheet undo and project undo stay two stacks. D5b is not part of this order.
- No HDL generation, no FSM editor, no VHDL text editor, no FPGA work, no change under `libs/` or to an EditableDiagram file, no Vue Flow upgrade, no commit and no release archive.

## What the user verified after D5a.1

On 25 Nov 2026 the user reported two checks from their own session in the lab. These are user checks. They are not the selfcheck and not the earlier browser pass.

- After **Open as**, the user returned to the parent sheet. The control is the bar above the canvas: **Up** goes one level up, a click on the parent name in that bar does the same, and **Root** opens the top sheet. There is no Simulink-style up icon on the canvas.
- The user created a hierarchy and navigated through two levels.

On 25 Nov 2026 the user closed the rest of the D5a.1 acceptance. The user accepted the lab checks for cancel, the drawn size and existing wires, a second instance, save and load, project undo and redo, a block with no ports, and a component that already exists with no implementation.

The same session showed that a numeric width and height change the node box without moving the symbol stroke, and that a selected block has no resize handles. That defect is D5a.2. It is not part of the closed D5a.1 acceptance.

D5b is released. Implementation waits for architecture acceptance of D5b.1. No further phase beyond that specification starts from this note.

## Separate findings, not this order

The user ranked these during the same session. They are not the Open-as order. D5c.1, D5c.2, and D5c.3 were a proposal and are not a roadmap change.

| Problem | Priority | Phase |
| --- | --- | --- |
| Project undo drops a later sheet edit | Critical | D5b, not released |
| Wires run through components | High | Later routing work |
| Signal-name placement | High | With the routing work |
| Toolbar wraps | High | Later |
| No Fit control after the sheet is open | High | Later |
| Pan and selection fight over the empty canvas | High | Later |
| Groups have no drawn frame | Medium | Later |
| Switching project drops unsaved edits | High | With undo or the file store |
| A project should persist locally without relying on one browser tab | High | D5f |
| Performance of large diagrams | Still to judge | D5d |

Routing, when it is ordered, keeps the split between the logical net and the graphic route. A router does not change electrical topology, keeps manually routed sections, and distinguishes a crossing from a junction.

## References

- Acceptance notes: [d5a-editor-acceptance.md](d5a-editor-acceptance.md)
- Backlog: [diagram-editor-usability-backlog.md](diagram-editor-usability-backlog.md)
- Undo rule and the D5b proposal: [diagram-transaction-architecture.md](diagram-transaction-architecture.md)
- Current hierarchy commands: [d4d-hierarchical-authoring.md](d4d-hierarchical-authoring.md)
- Interface commands: [d4c-component-interface-authoring.md](d4c-component-interface-authoring.md)
