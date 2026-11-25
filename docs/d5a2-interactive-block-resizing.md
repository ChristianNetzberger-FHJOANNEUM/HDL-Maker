# D5a.2 — Interactive block resizing

D5a.2 makes the size of one block instance the geometry of its picture. A selected block can be scaled from eight handles. The same size is written when Width or Height changes in the properties. The symbol definition is not rewritten.

D5a.1 is accepted. On 25 Nov 2026 the user closed that acceptance. The user's own session had already checked the return to the parent sheet and two hierarchy levels. The user accepted the remaining checks from the lab session as well. On the same day the user accepted D5a.2 after their own practical test. D5a is later complete; D5b is released for architecture work.

## Cause

The document already stored `width` and `height` on the block. Vue Flow used those values for the node box. `portAnchor` used them for pin coordinates. `setBlockFields` called `refreshAll`, so a numeric edit moved the wires. The selection outline is the CSS outline of that node, so the box grew.

The stroke did not. `SymbolFace` drew the symbol in symbol coordinates. The instance SVG used `viewBox="0 0 width height"`, so one user unit was one pixel of the instance. A Generic block rect at (10, 10), 68×44, inside an 88×64 symbol, stayed that size while the node grew. The visible outline and the bounding box were two different sizes.

The fix maps the symbol into the instance at draw time. It does not add a second rectangle on top of the old stroke.

## One geometry

| Fact | Owner |
| --- | --- |
| Default width and height | Symbol definition |
| Width and height on the sheet | Block instance |
| Shapes and pins, in symbol coordinates | Symbol definition |
| Picture for one instance | `fitSymbolShapes`, only while drawing |
| Pin side and `t` | Port, or the symbol pin it cites |
| Connection point | `portAnchor`, from the instance box |
| Net, junction, label | Unchanged by a resize |

`resizeBox` computes the next box. `setBlockFields` is the only write. The properties panel and the handles both call it. A resize does not write the symbol, another instance, a component, or an implementation diagram.

The SVG `viewBox` stays `0 0 instanceWidth instanceHeight`. Text is positioned in those coordinates and drawn at a CSS font size. A non-uniform scale is not applied to the whole SVG, so a label is not stretched.

## Handles

`@vue-flow/core` 1.48.2 is installed. `@vue-flow/node-resizer` is not installed and was not added. Vue Flow was not upgraded.

A block shows eight buttons when it is the only selection and the tool is Select: `nw`, `n`, `ne`, `w`, `e`, `sw`, `s`, `se`. Corners change both dimensions. Side handles change one. `resizeBox` keeps the opposite side or corner fixed. The moving edge snaps when Snap is on. The stored size cannot fall below one grid step (20). A negative size is not produced.

The handle is `12 / zoom` world pixels, so it stays about 12 screen pixels. Each handle sets `nwse-resize`, `ns-resize`, `nesw-resize`, or `ew-resize`. The classes `nodrag` and `nopan` keep Vue Flow from dragging or panning. The node is not draggable while a resize gesture is open. A click on the handle does not select a different block, and a double-click on the handle does not open the block.

The gesture is one `EditSession`. `pointermove` and `pointerup` are listened on the window, so the drag continues outside the handle. Each move is `preview`. `commit` runs once on release. `EditSession.commit` pushes history only when the document changed, so a gesture that ends on the same box adds no step. Escape calls `cancel`, restores the box from the start of the gesture, and adds no step. The status says `Resize cancelled.` The status says `Block resized.` only when the box changed.

Sheet undo and project undo stay two stacks. A later project command still discards sheet undo. That is D5b and is not built.

## Symbol types

`fitSymbolShapes` uses independent scales, `sx = instanceWidth / symbolWidth` and `sy = instanceHeight / symbolHeight`.

| Kind | Resize rule |
| --- | --- |
| Rectangle, rounded rectangle, ellipse | Width and height scale independently, including the inset from the symbol box. |
| Line and polygon | Each point scales with `sx` and `sy`. A diamond becomes wider when only the width changes. |
| Text and symbol labels | The position scales. The string does not. The font stays a CSS size. |
| Pin names | The pin point uses the instance box. The name stays at 11px. |
| Block name | HTML, centered on the node, at the sheet font. It does not grow with the block. |
| Image with `lockAspect` not false | The slot scales with `sx` and `sy`. The image keeps its aspect inside that slot and stays centered. `preserveAspectRatio` remains `xMidYMid meet`. |
| Image with `lockAspect === false` | The image stretches with the slot. |

The block box itself does not lock its aspect, including for a picture. Two instances of one symbol may have different boxes. A symbol-size edit in the symbol editor still updates every instance, as in D3b. An instance resize does not.

The symbol editor does not pass `symbolWidth`. It draws the definition at its own size.

## Ports and wires

A port keeps its id, `symbolPortId`, `interfacePortId`, side, and `t`. `refreshAll` runs from `setBlockFields`, so anchors and orthogonal routes update on every move of the gesture. An automatic route may be recomputed by the existing `refreshSegment` path, the same path a move uses. A manual route moves its terminals. The selfcheck keeps the trunk x of a manual wire, the net id, the port id, and the label anchor. No new router was added.

`addPort` on the sheet still adds one port on the right. Top and bottom ports in the lab come from a symbol pin or from the component interface after Open as.

## Hierarchy

Open as is unchanged. The resized block keeps its id and its box and becomes the component. A second instance can have another box. Opening either instance opens the same implementation diagram. The Boundary on that diagram is not the resized parent block. Adding a logical port is still one project command and updates every instance. It clears sheet undo, as before.

## Tests

`npx tsx src/core/selfcheck.ts` in `diagram-lab` prints `selfcheck ok`. The D5a.2 checks are:

- A Generic rect at (10, 10), 68×44, in an 88×64 symbol, drawn in a 176×64 instance, becomes (20, 10), 136×44. The label moves from (28, 36) to (56, 36) and the text stays `Text`.
- A locked 120×80 image on a 160×108 symbol, drawn in a 320×108 instance, stays 120×80 and is centered at (100, 4).
- East keeps the left side. West keeps the right side. A northwest drag keeps the opposite corner. A pointer inside the box clamps the width to 20. Snap of an east pointer at 333 from x=100 stores width 240.
- Two instances share a Counter symbol. One east gesture, with two previews and one commit, sets the first instance to 200×64. The second stays 88 wide. The symbol stays 88. The port id, `symbolPortId`, net id, manual trunk x, and label anchor stay. Undo restores 88. Redo restores 200. A preview that writes the same width commits with `canUndo` false. Cancel after a preview to 320 restores 200 and adds no step.

`npx vue-tsc --noEmit` exits 0.

## Browser

The pass used `http://localhost:5174/`, a new project named Design, Snap on, and a starting zoom of 2.5. The user's own session has not repeated it.

- A Generic block was placed at (80, 80), 88×64, and showed eight handles.
- East changed it to 180×64. The origin stayed. The outline rect was x=20.45, y=10, width=139.09, height=44. Pin text stayed 11px. The handle measured 12×12 screen pixels.
- South changed it to 180×160. The outline height became 110 and its y became 25. The outline width stayed.
- Southeast, northwest, northeast, and southwest each moved both dimensions and kept the opposite corner. West changed only the width and kept the right edge. North changed only the height and kept the bottom edge. The last committed box was 420×400 at (−60, −60).
- Escape during a further east drag left that box and reported `Resize cancelled.` Undo then restored the previous box, 420×360 at (−60, −20), so the cancelled gesture was not a step. Redo restored 420×400.
- Width 200 in the properties reported `Block updated.` The box became 200×400. The outline width became 154.55 and the outline height stayed 275.
- A second Generic block was placed at (260, 80). A wire from the first output to the second input was `140,140 260,140 260,112`, status `New net.` Widening the source to 260 moved the wire start to (200, 140). The far end and the trunk x stayed.
- Open as, **Block diagram**, turned the resized block into a component and opened a child with Boundary. Up returned to the parent. **Place on sheet** added a second instance at 88×64. That instance was resized to 160×64. The first stayed 260×400. The plain Generic block stayed 88×64. Double-click on the first instance reported `Generic block — shared definition — 2 instances`.
- Logical ports `top` and `bottom` appeared on both component instances and not on the plain block. On the 260×400 instance the top name sat above the top edge, the bottom name sat on the bottom edge, and `in` and `out` sat at mid height. Growing the height to 440 moved the bottom name and the side names. The top name stayed. The wire start y moved from 140 to 160. The other instance stayed 160×64.
- An LED from the pictures library, widened to 240×108, kept its SVG image at 120×80, centered, with `preserveAspectRatio` `xMidYMid meet`.
- A Decision widened to 160×64 changed the diamond to `80,6 149.09,32 80,58 10.91,32`. The y coordinates stayed.
- After Zoom out the pane scale was about 2.083. The handle measured about 11.98 screen pixels.
- Save reported `Saved project Design.` Reload reported `Reloaded project Design.` The five blocks, their sizes, the LED image, the diamond, and the four pin names returned. Double-click on the 160×64 instance opened the same child. Boundary showed `in`, `out`, `top`, and `bottom`.
- In the Signal reference, Scope is a PNG. Widening it from 96×72 to 280×72 left the bitmap at 80×56, centered, with the same `meet` aspect. Meter in stayed 160×108.

## Limits

- Handles appear for one selected block, and only in the Select tool.
- The minimum size is one grid step. Snap is on by default.
- During this step the canvas **Add port** still added only a right-hand port. D5a.3 places a port on any side.
- An automatic wire may be recomputed. A manual wire only follows its ends. There is no new router.
- A project command still discards sheet undo.
- The symbol editor still draws the definition at its native size. An instance resize does not change that drawing.
- A symbol created with **New symbol** was not placed in this browser pass. A rectangle, a diamond, an SVG, and a PNG were.
- The cursor glyphs were not recorded. The handles set the resize cursors in the element style.
- The user accepted D5a.2 on 25 Nov 2026. D5b is released after D5a; see [d5b-transactional-undo-architecture.md](d5b-transactional-undo-architecture.md).
