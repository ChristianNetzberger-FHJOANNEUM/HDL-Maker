# D4b — Hierarchical navigation

D4b opens the hierarchy that D4a stores. It does not create a child diagram, does not edit interface ports, and does not generate HDL. The lab stays free of a Python backend and of any HDL-Maker store.

## Navigation model

`navigate.ts` does not import Vue. A `HierarchyLocation` holds the project id, the root document id, the steps, the component id of the deepest step, and the document id that those steps open. The view stores one location. The project tree, the breadcrumbs, and a double-click all call the same functions: `descend`, `resolveLocation`, `parentLocation`, and `rootLocation`.

Back and Forward are a separate history of locations. They are not undo steps. Undo and redo stay on the document that is open.

The tree, the breadcrumb bar, and the Back and Forward buttons appear only while a project is open. New, Example, Net test, Symbols, Acceptance, and Bench still open one sheet and show none of that chrome.

## Instance paths

A step is `{ documentId, blockId, componentId }`. `documentId` is the sheet that contains the block. The open document is the implementation of that block's component, and it is the same object that already sits in `project.documents`. Descend does not copy the diagram, does not create a component, and does not change a document id or a port id.

The breadcrumb text is built from the current names, for example `Sample / U1 : Counter / Stage : Stage`. Renaming U1 changes the label. The step still cites the same block id, so the path stays valid.

U1 and U2 are two steps and two tree branches. Both resolve to the Counter document. The tree expands one level at a time. A child whose diagram is already an ancestor is marked `cycle` and is not expanded again. A missing block, a missing component, or a step whose diagram is gone stops at the last valid ancestor and says why.

## Shared definitions

When the open diagram is used by more than one instance, the bar shows a standing notice such as `Counter — shared definition — 2 instances`. It is not a warning on each edit. Nothing makes an independent copy. The instance path remains the one that was opened, which is the distinction a later waveform or probe will need.

## Viewport and editor state

Leaving a level stores the Vue Flow viewport and the selected block ids. The key is the project id plus the block ids of the path. Coming back calls `setViewport`. The first visit calls `fitBounds` on the bounds of the blocks and the wire points, so the SVG wires are inside the first frame. The SVG layer keeps the transform Vue Flow publishes. Restoring the viewport does not move a block or a point.

Zoom, pan, selection, and which tree branches are open are UI state. They are not written into the project. Navigation, zoom, and pan do not call `EditSession.execute` and do not mark a document dirty.

## Documents and edit sessions

`DocumentSessions` keeps one `EditSession` per document id. The session reads the document from the project and writes the snapshot back into `project.documents` by that id. U1 and U2 therefore share one undo stack. Undo while U2 is open restores an edit made while U1 was open.

A sheet opened without a project uses the single sheet session. Opening that sheet clears the project, the location, the navigation history, and the per-document sessions.

Save, while a project is open, writes the project. Reload reads that project, drops the edit sessions, and opens the same instance path when it still resolves. A single sheet still uses `DiagramStorage`.

A draw or a drag is released before the sheet changes. An unfinished wire is dropped. It is not passed to `acceptWire`, so it does not become a segment and does not become an undo step.

## What a double-click does

A double-click on a component whose implementation is `diagram` appends that block id and opens the shared document. A single click still selects. Zoom on double-click stays off.

`implementation.kind === 'none'` stays on the current sheet and reports that no implementation exists yet. Any other kind, including `fsm`, `vhdl`, and `systemverilog`, stays and reports that the editor is not available. A block that is not a component stays and says so. No empty diagram is created. That remains D4d.

## Tests

`npx tsx src/core/selfcheck.ts` passes, including the D0–D4a checks. The D4b checks cover two paths into one diagram, stable port ids, breadcrumb labels after a rename, parent and root, distinct tree branches, the shared-definition label, a component with no diagram, a broken path stopped at the root, one edit session visible from both paths, undo of that shared edit, framing that does not move blocks, and a repeated diagram that the tree does not expand again.

`npx vue-tsc --noEmit` passes.

In the browser at `http://localhost:5174/`, on the sample project:

1. Double-click on U1 opened Counter. The document id changed. Undo stayed disabled.
2. Double-click on Stage opened the next sheet. The breadcrumb was `Sample / U1 : Counter / Stage : Stage`, and the tree highlighted that same path.
3. Up returned to Counter. Root returned to the root sheet. The tree highlight followed.
4. U2 opened the same Counter document id through a different block id.
5. Renaming Stage to StageB on the U1 path was visible on the U2 path. Undo on the U2 path restored Stage. The root sheet's undo and redo stayed disabled.
6. After zooming the U2 sheet to scale 1.73611, Root kept the root viewport and Back restored `translate(518.667px, 218.278px) scale(1.73611)` on both the Vue Flow pane and, on the earlier pass, the SVG layer.
7. Root document id, Counter document id, and the shared component id were unchanged by the navigation.
8. A wire click that only started a draft was cleared by the next navigation. No segment was added and Undo stayed disabled.
9. Double-click on Buf stayed on the root and reported `Buffer has no implementation yet.`
10. Save wrote the project. After a rename to Kept, Reload still showed U1 and U2 sharing one component, and opening U1 showed Kept.
11. Net test loaded 10 blocks with an empty project id and no breadcrumb bar.

Signal names, wires, symbols, and pins inside a child sheet use the same editor as a single sheet. The rename above was committed with the existing name field and was one undo step on the shared document.

## Not in D4b

Interface editing is D4c and is recorded in [d4c-component-interface-authoring.md](d4c-component-interface-authoring.md). Extract and expand are D4d and are recorded in [d4d-hierarchical-authoring.md](d4d-hierarchical-authoring.md). D4f libraries, D4g acceptance, the FSM editor, HDL generation, and the HDL-Maker studio are not started.
