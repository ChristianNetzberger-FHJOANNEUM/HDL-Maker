# D5a — Functional acceptance and usability review

D0 through D4d stay as they are. D5a does not add an editing feature. It puts three projects in the diagram lab, records how the editor behaves on those projects, and leaves the judgement to a session at the keyboard. The selfcheck only proves that the three projects are valid. It does not accept the editor.

D5a is complete. D5b is released; D5b.1 is the architecture specification in [d5b-transactional-undo-architecture.md](d5b-transactional-undo-architecture.md). D5c through D5f are not started. The prioritized gaps are [diagram-editor-usability-backlog.md](diagram-editor-usability-backlog.md).

## Open the references

The lab is `http://localhost:5174/`. The page opens on an empty sheet. These buttons load a project through the same path as **New project**: the sheet sessions are dropped, both undo stacks are cleared, and the root is fitted to the canvas.

| Button | Project | What it is for |
| --- | --- | --- |
| Digital | Digital System | A hierarchy: clock, reset, datapath, control, two switches, two LEDs. |
| Signal | Signal Processing | A signal chain with custom symbols, SVG meters, one bitmap, and pins on more than one side. |
| General | General Diagram | A flowchart with text, an SVG board, a bitmap, a group, wires, and one ink stroke. |

Clicking the button again rebuilds that project from code. Edits that were not saved are gone. **Save** downloads `{project id}.json` and keeps a copy for this browser tab. **Reload** reads that tab copy and clears both undo stacks. Refreshing the page drops the tab copy; use **Load file** on the download. The reference buttons do not write the download back into the source.

None of the three projects contains HDL.

### Digital System

The root shows SW1, SW2, Clock, Reset, Datapath, Control, LED0, and LED1. `clk` and `rst` are branched nets with a junction and a name label. Double-click **Datapath**, or use the tree. That sheet has U1 and U2, one shared Counter, plus Register, Mux, and Probe. Double-click **U1**. The status reads “Counter — shared definition — 2 instances”. That sheet has Boundary, Stage, and Bit. Double-click **Stage** for the third level. U2 opens the same Counter diagram through a different block id.

### Signal Processing

Source, ADC, Channel, Mixer, DDS, DAC, a word clock, a gain block, two SVG meters, and Scope. Scope is a PNG embedded in the project. The meters are the picture-library SVG. Mixer has a pin on the top, the word clock and DDS have a pin on the bottom, and ADC has a clock pin on the bottom. Double-click **Channel**. The child sheet is Filter, then Gain.

### General Diagram

Start, Read, Ready?, Keep, and Ask again are flowchart symbols. Note is a text box. Board is the FPGA SVG. Figure is the same PNG as Scope. Read and Keep are one group; the group is stored and is not drawn. A stroke sits under the flowchart. The sheet has no component hierarchy. **Up** stays disabled.

## What this session already saw

These notes are observations, not an acceptance. The checklist below is still open.

- **Digital**, **Signal**, and **General** open, fit the sheet, and show the tree and the breadcrumbs. Three levels of Digital open, and the shared-definition line appears on the Counter sheet.
- The root of Digital is readable at the fitted zoom: switches, LEDs, and the names `clk`, `rst`, `sw`, `sel`, `led0`, and `sw2` can be told apart.
- On the Datapath sheet the `clk` spine runs through U2, and the `rst` label sits on a junction. On the Signal sheet the word `analog` sits on the ADC body. Orthogonal routing does not walk around symbols, and a name can land on a block.
- A small sheet is fitted very large. The Counter sheet opened near the maximum zoom. There is no **Fit** button after that; **Zoom in** and **Zoom out** are the only zoom controls. **Pan** is a separate tool, so dragging empty space while **Select** is on starts a marquee instead of moving the view. The mouse wheel zooms because that is Vue Flow's default.
- The toolbar wraps onto a second row. **Undo** and **Project undo** are far apart. **Shift pin** and **Drop pin** are still fixture buttons from an earlier symbol test.
- The component field in the properties panel still says `Processing` after a reference project opens. That is the initial value of the field. It is not the name of a block on the sheet.
- Groups have no frame. On the general sheet, Read and Keep are grouped, and nothing on the canvas says so.
- The ink stroke on the general sheet is visible and is still ink. **Convert** and **Confirm wire** are the existing prototype; this review did not turn that stroke into a wire.

## Short guide

1. Open `http://localhost:5174/`.
2. Click **Digital**, **Signal**, or **General**. Read the status line. It names the next double-click.
3. Move around with the breadcrumbs, **Up**, **Back**, and **Forward**, and with the tree. A `+` expands a branch without opening it.
4. Double-click a component block to open its diagram. Double-click a block that is not a component, such as Bit or a switch, and stay on the same sheet.
5. Click **New project** when you want an empty root of your own. Place symbols from the library. **Select** moves blocks. **Wire** connects two pins. A click on an existing wire segment starts a branch.
6. **Undo** and Ctrl+Z undo the last sheet edit. **Project undo** undoes the last component command. They are not the same list. The difference is the subject of D5b, and it is not changed here.
7. **Save** before you refresh the page. After a refresh, **Load file** opens the download.

## Checklist

Mark each line after doing it. A failed line should say what you expected and what the sheet did. Automated tests do not close any line.

### From an empty sheet

- [ ] **New project** shows an empty root and an empty tree.
- [ ] Place two symbols. They can be selected, moved, and deleted.
- [ ] Shift-click selects more than one block. A drag on empty canvas selects the blocks inside the rectangle.
- [ ] Draw a wire with two bends. Move one bend. Move a straight span.
- [ ] Add a name, rename it, and move the block. The name stays on the wire.
- [ ] Move a block that has wires. The wire ends follow. A manual route is not replaced by a new path.
- [ ] **New symbol**, change it, and place it. Cancel or press Escape during a drag and during a wire. Nothing is left half-done, and undo does not gain an empty step.
- [ ] Zoom until the names are hard to read, then zoom back. Pan to a corner and find the blocks again.
- [ ] **Save**, refresh the page, and **Load file**. The sheet matches what you saved.

### On the reference projects

- [ ] **Digital**: open Datapath, then U1, then Stage, then come back with the breadcrumbs.
- [ ] Open U2 and confirm it is the same Counter diagram as U1.
- [ ] On the Datapath sheet, move U1. The wires follow. Undo that move with **Undo**.
- [ ] Select U1 and U2 and read the extract preview. **Cancel** leaves the sheet unchanged.
- [ ] Extract them only if you want to try the command. **Project undo** puts them back. Then try a sheet edit after a project command and see which undo removes it. Write down the result.
- [ ] **Make unique** on one of two counters, then open both paths.
- [ ] **Signal**: open Channel. Pins on the top and the bottom of the root symbols are visible. The meters are pictures. Scope is a picture of a different kind.
- [ ] **General**: the flowchart, the text, the board, the figure, and the stroke are all on one sheet. Select Read and Keep and **Ungroup**, then group them again.

### After the session

Write the three or four things that most got in the way. Those lines set the order of D5b, D5c, D5d, D5e, and D5f. The backlog is a starting list, not that order.

## Not in D5a

No HDL-Maker integration, no change under `libs/` or to an EditableDiagram file, no HDL generator, no FPGA programming, no Vue Flow upgrade, and no implementation of D5c through D5f in this note. The later Open-as finding is D5a.1 and is recorded in [d5a1-interactive-top-down-authoring.md](d5a1-interactive-top-down-authoring.md). The user accepted D5a.1 on 25 Nov 2026. The block-size defect from that acceptance is D5a.2, recorded in [d5a2-interactive-block-resizing.md](d5a2-interactive-block-resizing.md). The user accepted D5a.2 the same day. Port authoring is D5a.3, recorded in [d5a3-interactive-port-authoring.md](d5a3-interactive-port-authoring.md). D5a.3a–D5a.3c are accepted; D5a.3 and D5a are complete. D5b is released; the architecture specification is [d5b-transactional-undo-architecture.md](d5b-transactional-undo-architecture.md).
