# Diagram editor usability backlog

This list is the state of `diagram-lab` after D5a. A line is here only when the lab does not already do that thing, or when the thing exists and is still awkward in a real drawing. D5b through D5f are not scheduled by this list. The keyboard session in [d5a-editor-acceptance.md](d5a-editor-acceptance.md) sets the order.

## Already in the lab

These are not open work.

- Orthogonal wires, bends, span dragging, manual and automatic routes, junctions, and net merge.
- Name labels that follow a segment. The net name is edited in the properties panel. **Add label** adds another label for that name.
- A symbol editor: shapes, text, pins on four sides, free pins, and pasted images.
- Built-in libraries, a user library, copy-on-place, and an explicit library update by pin id.
- SVG and PNG, JPEG, and WebP assets, stored in the document, one copy per checksum.
- Hierarchical components, the tree, breadcrumbs, **Up**, **Back**, **Forward**, and the shared-definition line.
- Top-down **Create implementation**. Double-click does not create a diagram.
- Extract, expand, rename, duplicate definition, delete, and make unique, each as one project command.
- Sheet undo and project undo, as two stacks. See [diagram-transaction-architecture.md](diagram-transaction-architecture.md).
- Click, Shift-click, and a marquee that selects blocks. Ctrl+A selects every block.
- Copy, paste, and duplicate. The clipboard belongs to the lab, not to the operating system. A copied wire must have both port ends inside the selection. Junctions and free ends are not copied.
- Groups as a list of block ids. **Group** needs two blocks. **Ungroup** removes the list.
- Snap on a 20-unit grid, as a toolbar toggle. The grid is drawn while snap is on.
- **Zoom in**, **Zoom out**, and the mouse wheel. Opening a project or a child sheet fits the content. **Pan** is a tool.
- Freehand ink, a preview, and **Confirm wire**. A stroke with too many turns is refused. The stroke stays until the wire is confirmed.
- Arrow keys nudge a block while its name button has focus.
- Width and height of one selected block, as numbers in the properties panel.

## P1 — In the way of ordinary drawing

1. **Two undo stacks.** A project command clears sheet undo. A later sheet edit is dropped when that project command is undone. Ctrl+Z never calls project undo. This is D5b, and it should be settled before HDL-Maker or the script builds on the lab.
2. **Routes cross symbols, and names land on blocks.** Seen on the Digital datapath, where the `clk` spine runs through U2, and on the Signal sheet, where `analog` sits on the ADC. The router does not treat symbols as obstacles.
3. **The toolbar is a long strip.** It wraps. **Undo** and **Project undo** are easy to miss. **Shift pin** and **Drop pin** are leftover fixture actions and are not general tools.
4. **There is no Fit button** after the sheet has opened. A small sheet is fitted close to the maximum zoom. Getting back to the whole drawing means zooming out by hand, or leaving and reopening.
5. **Pan and marquee share the empty canvas.** With **Select** active, a drag on empty space selects. Panning requires switching to **Pan**. There is no space-to-pan.
6. **New blocks pile up.** A palette click places the next block on a 40-unit step. The blocks are wider than that step, so the second block covers the first.
7. **The component field keeps a stale name.** It opens as `Processing` and is not cleared when **Digital**, **Signal**, or **General** loads. **New component** would use that text.

## P2 — Missing or only partly there

| Topic | What the lab does now | Gap |
| --- | --- | --- |
| Resize | Numbers for width and height. The symbol editor has numbers too. | No drag handles on a block or on a symbol. |
| Rotate and mirror | Not implemented. | No command and no stored angle. |
| Z-order | Paint order follows the block list. | No bring-forward or send-back. |
| Align and distribute | Not implemented. | No command. |
| Copy and paste | Internal clipboard. Port-to-port wires inside the selection. Block Shift+Drag duplicate (D5c.6). | Not the system clipboard. Wire-only copy **deferred** (D5c.7 spec: stub paste + by-name). Junctions / leaving wires omitted from block copy. |
| Context menu | Not implemented. | Every action is a toolbar button or a shortcut. |
| Shortcuts | Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y for the sheet. Ctrl/Cmd+A, C, V, D. Delete, Escape, Enter, Space for the wire elbow. | No shortcut for project undo, fit, or the tools. Arrow keys work only while the block name button is focused. |
| Grid and snap | 20-unit snap, one toggle. | No second grid, no snap to pins while drawing, no visible snap while snap is off. |
| Marquee | Blocks whose boxes meet the rectangle. Shift adds. A box under 4 pixels clears the selection unless Shift is held. | Wires, junctions, labels, and strokes are not in the marquee. The drag must start on empty canvas. |
| Net by name | **D5c.5:** same sheet name ⇒ one net (rename-join, stub reuse). **Merge** still joins unequal names. Legacy duplicates warn until Merge-all. | Cross-sheet / project-global name join not done. |
| Label handles | The label follows its segment. The core can move a label along an edge. **D5c.1** adds sheet drag (`placeLabelAt`, along + offset). | Jumping to another segment / free 2D placement not in D5c.1. |
| Groups | The membership is stored. Duplicate and ungroup use it. | Nothing is drawn around the members. |
| Freehand | Draw, preview an orthogonal wire, confirm. Pressure is kept when the pointer reports it. | No eraser, no arrow tool, no pen mode. This is still a prototype. |
| SVG export | A symbol can contain an SVG picture. | There is no export of a whole sheet. |
| Touch | Pointer events, and `touch-action: none` on the canvas. | No pinch zoom and no pen-specific gesture. |
| Large sheets | A Node timing of 50 blocks and 350 segments exists. | Moving the mouse across a large sheet was not measured, and nothing was optimized. That measurement is D5d. `top_rtc_app` was not imported. |

## P3 — Later, and not a drawing gap

- D5e: export of a finished sheet, and documentation a reader can follow without the lab source.
- D5f: the lab surface as a Vue 3 library for HDL-Maker and for the Nuxt script. The lab is still an application.
- The earlier teaching task (instructions, allowed edits, and a check that reads nets) was specified before D5 was split. It is not built, and it is not part of D5a.
- Placement, routing around symbols, and a fit control are the concrete pieces of D5c that this review can already see. The rest of D5c stays open until the keyboard session.
