# D5a.3 — Interactive port authoring

D5a.3 places and moves ports on the sheet. A port can sit on the left, right, top, or bottom of a block. Dragging it changes that graphic position. It does not change the port id, the net, or the symbol definition.

D5a.1 and D5a.2 are accepted. The user closed D5a.2 on 25 Nov 2026 after their own session. The first D5a.3 check found a delete error and a port picture that did not match the intended drawing. D5a.3a corrects both. The next check found that a logical port and the Boundary did not stay the same interface. D5a.3b is that correction. The user accepted D5a.3b for bidirectional interface synchronization. D5a.3c corrects Boundary port labels and stops unbound symbol pins from returning on new component instances. The user accepted D5a.3c. D5a.3 is complete. D5a is complete. D5b is released; its specification starts at [d5b-transactional-undo-architecture.md](d5b-transactional-undo-architecture.md).

## Three positions

A port on an instance is not the same object as a symbol pin, and neither is the logical port of a component.

| Object | What it is | What a graphic move writes |
| --- | --- | --- |
| Instance port | One port on one block. Wires cite this id. | `side`, `t`, and `placed` on that port only. |
| Symbol pin | The shared picture of a symbol. `symbolPortId` cites it. | Nothing. |
| Logical port | The component interface. `interfacePortId` cites it. | Nothing. Adding, renaming, or removing one is still a D4c project command. |

`side` and `t` are fractions of the block edge. Left and right run from top to bottom. Top and bottom run from left to right. The document does not store a second absolute coordinate. Schema version stays 1.

`placed` is the instance override. The existing model did not have one. `portAnchor` preferred a bound symbol pin, and applying the symbol copied that pin's `side` and `t` onto every instance. An individual graphic position needed an explicit flag.

The anchor is chosen in this order:

1. `placed` is set. The instance `side` and `t` are the position, even when a symbol pin is bound.
2. A symbol pin is bound and the port is not placed. The pin supplies the position.
3. Otherwise the stored `side` and `t`, a free `x` and `y`, or an automatic slot on that side.

A later resize keeps the fraction, so the port stays on the same part of the edge. `applySymbol`, `attachPin`, and `restack` do not overwrite `side`, `t`, or the name of a placed port. A symbol-pin move still updates every instance that is not placed.

## Sheet commands

**Add port** is the existing toolbar button. It is a mode, not a new tool strip. The pointer must be near a block edge. The nearest legal side and `t` come from that point, on the grid when snap is on. A circle previews the position. A click confirms it. A click away from an edge does nothing. Escape leaves the mode, drops the preview, and adds no undo step.

On a block that is not a component, the new port is a sheet edit. The name is `p` plus the number of ports already on that block, plus one. The port is placed. It has no `symbolPortId` and no `interfacePortId`. The block does not grow. The older `addPort` helper, which adds a right-hand port and grows the block, remains for the earlier selfcheck. The canvas does not call it.

On a component instance, the same click is `addInterfacePort`. Every instance and the Boundary receive the logical port. Only the clicked instance records the chosen `t` and `placed`. The other instances are not placed. No symbol pin is created, and nothing is bound by name.

In the Select tool a port can be dragged along its edge or onto another edge. The preview moves the port, its label, and the attached wires. Pointer-up commits one sheet step. A gesture that does not change `side`, `t`, or `placed` commits nothing. Escape cancels the gesture and commits nothing. The drag does not move the block, start a wire, or open the hierarchy. Resize handles still change only the box. In the Wire tool a port still starts a wire.

The hit target is at least 12 screen pixels, the same idea as a resize handle. Selecting a port clears the block selection, so the handles are not sitting on the pin.

The properties of a selected port are the name, the side, the relative position, and delete. The side list and the position number call `placePort`, the same function as the drag. Deleting a generic port that has a wire does nothing and says so. Deleting a logical port is `removeInterfacePort`. A wired logical port stays, and the existing diagnosis stays.

A rename of a generic port, including one that already cites a symbol pin, changes that instance's name only. A rename of a logical port is `renameInterfacePort`.

## Wires

`placePort` calls `refreshAll`. An automatic route may be recomputed by the existing function. A manual route keeps its trunk and moves the terminal at the port. The port id, `interfacePortId`, the symbol-pin binding, the net id, junctions, and label anchors stay. Changing side does not change which net the wire belongs to. There is no new router.

## Open as

Open as copies `placed` onto the Boundary together with `side`, `t`, and the new `interfacePortId`. A port that has no symbol pin stays unbound. A second instance does not inherit `placed`. Its bound pins come from the symbol. Its other logical ports get a default side and `t`.

A graphic move after that conversion stays on the instance that was dragged. The Boundary keeps the position it was given at conversion. The symbol pin stays where it was.

## Undo

One completed drag or one property edit is one sheet step. Mouse moves inside the gesture are previews. Escape and a gesture with no change add no step. Undo and redo restore the port and the wire geometry together.

Adding, renaming, or removing a logical port is a project command. That command still discards sheet undo. The status line says so when a sheet history was pending. The two stacks stay. D5b is not built.

## Automated tests

`npx tsx src/core/selfcheck.ts` in `diagram-lab` prints `selfcheck ok`. `npx vue-tsc --noEmit` exits 0. The D5a.3 checks are:

- `borderPlacement` on all four sides, with snap.
- `nearestBlockBorder` hits an edge and misses the middle of the block.
- Ports added on the left, top, and bottom.
- A slide along one side keeps the port id and the manual trunk.
- A move onto another side keeps the net id, the port endpoint, and the label's segment id.
- A placed port keeps its side when the symbol pin moves. The other instance follows the pin. The pin itself stays.
- A later resize keeps the relative position.
- One gesture with two previews is one undo step. Redo restores it. An unchanged preview adds no step. Escape adds no step.
- A wired port is not removed. An unwired port is.
- Save and load keep `placed` and the side.
- Open as keeps the port ids, the positions, and `placed`, binds only the existing pin, and leaves the symbol pin.
- A second instance has the logical ports and not the first instance's positions.
- `addInterfacePort` places the exact `t` on the clicked instance only. The other instance receives the logical port and is not placed. The symbol still has one pin.

The D0 through D5a.2 checks in the same file still pass.

## Browser session

On `http://localhost:5174/`, **New project**, Snap on, zoom 2.5 unless a check says otherwise. This pass was run in the browser. It is separate from the selfcheck.

- A Generic block was placed at (80, 80), 88×64, and scaled from the southeast handle to 200×160. The origin stayed. The status was "Block resized."
- **Add port** refused a click in the middle of the block: "Choose a point on a block edge." No preview was drawn there.
- Six clicks on the edges previewed the circle on the edge and added p3 through p8. With the original `in` and `out`, the block had eight ports: three on the left, two on the right, two on the top, one on the bottom.
- p4 was dragged along the left edge from t 0.75 to t 0.875. The block stayed at (80, 80), 200×160. The port id stayed. Undo restored 0.75. Redo restored 0.875.
- A drag of p3 onto the bottom was cancelled with Escape. The preview had shown bottom 0.5. The port returned to left 0.25. The status was "Port move cancelled." The next undo still undid the p4 slide, so the cancelled drag and a click that did not move a port added no step.
- The side list moved p6 from the top to the right at the same t. The status was "Port moved." Undo put it back on the top.
- The position number moved p6 from t 0.8 to t 0.5 and left it on the top. Undo restored 0.8.
- A second generic block was placed and moved to x 460. Two wires were drawn. The status was "New net." for each. The routes were `280,160 460,160 460,112` and `280,200 548,200 548,112`.
- The wired `out` port was dragged to the bottom at t 0.6. During the drag the first wire was already `200,240 460,240 460,112`. The far end stayed. The second wire stayed. The block did not move. The resize handles were hidden while the port was selected.
- p5 was slid along the right edge from t 0.75 to t 0.25. Its wire became `280,120 548,120 548,112`. The other wire stayed.
- The block was then grown downward to 200×240 at (80, 80). The bottom wire followed to `200,320 460,320 460,112`. The right-hand wire followed to `280,140 548,140 548,112`. The second block stayed at (460, 80).
- `out` was renamed to `clk`. The label on the pin changed. Delete on that wired port said "This port has a wire. The port and the wire were kept." Both wires remained. Delete on the unwired p7 removed it. The status was "Port removed."
- Escape while **Add port** was showing a preview returned to Select, cleared the preview, added no port, and said "Port cancelled."
- Double-click, then **Block diagram**, opened the child. The status was "This block now opens a diagram. Sheet undo was cleared. Project undo reverses this change." The Boundary had seven ports: `in` left, `clk` bottom t 0.6, `p3` left, `p4` left t 0.875, `p5` right t 0.25, `p6` top t 0.3, `p8` bottom t 0.4. **Up** returned to the parent. The wires were unchanged.
- **Place on sheet** added a second instance of that component at (520, 80), 88×64. Its ports were not placed. `p6` was on the right, while the first instance still had `p6` on the top. The plain block still had only `in` and `out`.
- Dragging the first instance's `p6` along the top to t 0.8 left the second instance's `p6` on the right. The bound pin on the second instance stayed on the right, so the symbol pin had not moved.
- **Add port** on the first instance's right edge added logical port `p8` at t 0.75. The status was "Port p8 was added to every instance. This block keeps the position you chose. Sheet undo was cleared. Project undo reverses this change." The second instance also gained a `p8`, at t 0.8, not 0.75. The plain block did not. The Boundary gained that port on the right at t 0.5. Its older `p6` stayed at t 0.3, the position from the conversion, not the later t 0.8.
- The hit circle was 40 screen pixels across at zoom 2.5 and 33.3 at zoom 2.083. At zoom 1.447 and 1.206 the world radius grew and the circle stayed 24 screen pixels across.
- **Save** said "Saved project Design." **Reload** said "Reloaded project Design." The child Boundary still listed `in`, `clk`, `p3`, `p4`, `p5`, `p6`, and both ports named `p8`. **Up** restored the three blocks, the two wires, and the individual sides.

## Not done in the browser

- The cursor glyphs were not photographed.
- A logical rename, through the properties after the block was already a component, was not clicked. The rename in this pass happened while the block was still generic.
- Project undo and project redo of the new logical port were not clicked.
- A symbol was not opened in the symbol editor during this pass. The second instance's bound pin staying on the right is the evidence that the shared pin did not move.
- Zoom was changed with the toolbar buttons. A port was not dragged again at the lower zoom.

## Limits

- The first browser pass recorded two defects that D5a.3a has since corrected: a second `p8` after a deletion, and a later instance showing the symbol pin name `out` where the logical name was `clk`. The record of that pass is kept above. The corrected behaviour is in the next section.
- The Boundary receives a new logical port on the requested side at the default fraction. Only the clicked instance stores the chosen `t`.
- An automatic wire may be recomputed. A manual wire follows its ends. There is no new router and no obstacle avoidance.
- A project command still discards sheet undo.
- Before D5a.3c, a new component instance could show an unbound symbol pin that was no longer on the logical interface. D5a.3c drops those unbound pins on component instances. A plain generic block of the same symbol still shows the original pins. Wired or legacy orphans are not deleted silently.
- D5a.3a left a wired copy in place after removing its logical port. D5a.3b refuses that delete instead. The record of the D5a.3a pass is kept below. The user accepted D5a.3b for sync and D5a.3c for presentation. D5a.3 is complete. D5b is released.

## D5a.3a — corrections after the first check

The status **That logical port is not on the component** came from the canvas delete. Any port that merely carried an `interfacePortId` was sent to `removeInterfacePort`. After a logical delete keeps a wired port, that id is no longer on the component, so the next delete asked for a logical port that was already gone. The suspicion from the check is confirmed: the component operation was applied to a port whose interface reference was no longer valid.

Delete now classifies the port first.

- A generic port, including one that began as a symbol pin, is removed on that instance. The symbol definition and the other instances stay. The instance records the pin id in `suppressedPins`, so a later symbol refresh does not put that pin back on this instance.
- A logical port whose id is still on the component uses the D4c project command. Unwired copies leave every instance and the Boundary. A wired copy, on any instance or on the Boundary, stays with its wire and is diagnosed.
- A port whose `interfacePortId` is not on the component is not sent to that command. An unwired one is removed from this instance and the status says the reference was invalid. A wired one stays, with its wire, and the status says so.
- A Boundary port whose id is still on the component that implements this sheet is a logical delete, not a local one.

A new instance copies the logical name onto the bound port. The symbol pin keeps its own name. The binding stays the pair of ids. A graphic move does not change the name.

Automatic names take the first `pN` that is not already used on that interface, ignoring letter case. A manual rename that collides, including a difference of case only, is refused. There is no further VHDL name check.

The gap between the ports and the block was the symbol rectangle. It is drawn inset in the symbol and `fitSymbolShapes` scales that inset, while the pins sit on the instance box. For a functional block whose symbol is one rectangle and which has ports, the instance view draws that rectangle on the instance outline. The symbol definition is not changed, and `fitSymbolShapes` is unchanged. An ellipse, a polygon, a picture, and a rectangle without ports keep the existing mapping. In the browser the ellipse stayed at x 10, y 12, 68 by 40 inside an 88 by 64 box.

The large circles were the hit target. A fill rule painted that circle. The hit circle is now transparent. The visible mark is a constant 7 screen pixels across. The hit target stays about 40 screen pixels across at zoom 2.5, including the plain marks on the Boundary. Port names of a flush rectangle sit inside the outline.

`npx tsx src/core/selfcheck.ts` prints `selfcheck ok`. `npx vue-tsc --noEmit` exits 0.

The correction was checked in the lab at `http://localhost:5174/`, starting from **New project**:

- A generic block was grown to 200 by 64. Its rectangle filled that box. `in` and `out` sat on the outline, and the names sat inside.
- Four added ports were named `p1` through `p4`. Delete of the unwired `p4` said "Port removed." Undo restored it. Redo removed it again.
- `out` was moved to the bottom. The status was "Port moved." Delete of the unwired bound `in` said "Port removed." A second generic block placed afterwards still had `in` and `out`.
- `out` was renamed to `clk` before **Open as**. A wire from `clk` to the other block's `in` said "New net." Delete of that wired port said "This port has a wire. The port and the wire were kept."
- **Open as**, then **Block diagram**, put `clk`, `p1`, `p2`, and `p3` on the Boundary. The deleted `in` was not a logical port. The binding of `clk` still named the symbol pin `out`.
- **Place on sheet** added a second component instance. Its bound port was named `clk`, not `out`. It also showed the unbound symbol pin `in`, which the first instance had hidden.
- Delete of the unwired logical `p1` said "Logical port removed." Both component instances and the Boundary lost it. The plain block was unchanged.
- Delete of the wired logical `clk` said "Logical port removed. A wired port was kept and diagnosed." The first instance and the wire stayed. The second instance and the Boundary lost `clk`. The diagnosis was "Generic block.clk still has a wire, but its logical port was removed."
- A second delete of that same `clk` said "This port cites a logical port that is not on the component. The port and the wire were kept." It did not say "That logical port is not on the component."
- Renaming `p2` to `P3` said "That port name is already used on this component." Both instances still said `p2`.
- The next added port was named `p1`, the unused name, and it appeared on both component instances.
- At zoom 2.083 the visible mark was 7 screen pixels across on the 200-wide block and on the 88-wide block. At zoom 2.5 the Boundary hit target was 40 screen pixels across and its button was transparent. The visible mark stayed 7 screen pixels.
- An ellipse kept its inset. **Save** said "Saved project Design." **Reload** said "Reloaded project Design." The names, the wire, the diagnosis, and the ellipse were still there.

Not clicked in this pass: the cursor glyphs, project undo of a logical port, and a rename from the component panel after **Open as**. The refused `P3` rename was made from the port properties of the instance.

## D5a.3b — hierarchical interface synchronization

The component definition is the only logical interface. Adding, renaming, or deleting a logical port is one project command. It updates the definition, every instance, and the Boundary of the implementation diagram. The same command runs from an instance and from the Boundary. The link is `interfacePortId`. A graphic move still changes only the instance that was moved.

The user's sequence was reproduced on the D5a.3a build before this change. A generic block gained `p1` and `p2`, **Open as** put `in`, `out`, `p1`, and `p2` on the Boundary, and the child was left. Deleting unwired `p2` and the original pin `in` on the root said "Logical port removed." Reopening that child showed only the ports that remained. The child on screen was the document in the current project. `DocumentSessions` is discarded after a project command, and opening a level reads that project. An unwired delete was not showing a stale session.

`removeInterfacePort` did leave a Boundary connector behind in a different case. If any copy was wired, the command removed the logical port, dropped the unwired copies, and kept the wired copy and its wire. The parent could lose the port while the Boundary, or another instance, still showed it. That is the orphan the check described. A port added on the Boundary was a separate hole: the sheet treated the Boundary as an ordinary block, because it has no `componentId`, so the new port never reached the instances.

A logical delete now looks at every instance and at the Boundary first. If any of those ports has a wire, the command returns the same project, adds no undo step, and does not change the definition, the instances, the Boundary, or the wires. The status names the blocks, for example "renamed is wired on Generic block. The port was kept." An interface id that is already missing is still classified as dangling. A wired one is still diagnosed and is not deleted. No wire is deleted to make a port removal succeed.

Adding a port on the Boundary uses the same project command as adding one on an instance. Only the block that was clicked stores the chosen position.

`npx tsx src/core/selfcheck.ts` prints `selfcheck ok`. `npx vue-tsc --noEmit` exits 0. The selfcheck covers the opened child, both port kinds, two instances, add and rename in both directions, a wire on this instance, on another instance, and on the Boundary, project undo and redo, navigation, save and load, an unchanged symbol, and a graphic position that stays on one instance.

The lab check at `http://localhost:5174/` started from **New project** after the code was loaded:

- A generic block gained `p1` and `p2`. **Open as**, then **Block diagram**, showed `in`, `out`, `p1`, and `p2` on the Boundary.
- **Up**, then delete of unwired `p2` and of the original pin `in`, each said "Logical port removed." The tree opened the same child. The Boundary showed `out` and `p1`.
- A port added on the Boundary was named `p2` and the status said it was added to every instance. The root instance showed it.
- Renaming that port to `renamed` on the root said "Port renamed to renamed. Connections were kept." The Boundary showed `renamed`.
- Deleting `p1` on the Boundary said "Logical port removed." The root instance lost it. **Project undo** restored `p1`. **Project redo** removed it again.
- A second instance showed `out` and `renamed`, and also the unbound symbol pin `in`. Moving `renamed` to the top changed only that instance.
- A wire from the second instance's `renamed` to the first instance's `out` was kept. Delete of `renamed` on the first instance said "renamed is wired on Generic block. The port was kept." Both instances and the Boundary still had it, and both wires stayed.
- **Save** said "Saved project Design." **Reload** said "Reloaded project Design." The Boundary still showed `out` and `renamed`. Both instances still showed those ports, the second still showed `in`, and the moved pin was still on top.

The user functionally accepted D5a.3b for bidirectional interface synchronization. Boundary port names were still missing in that check. That presentation defect, and the unbound symbol-pin return on new instances, are D5a.3c.

## D5a.3c — hierarchical port presentation and interface consistency

The Boundary used a different drawing path from an ordinary functional block. A Boundary has no `symbolId`, so the view drew plain port buttons with `aria-label` only and no visible name. Functional blocks with a flush rectangle go through `SymbolFace`, which places the name inside the outline.

The Boundary now synthesizes a flush rectangle when it has ports and no symbol, and reuses `SymbolFace`. Port labels come from `logicalPortName`, which reads the component definition through `interfacePortId`. There is no separate text object for the name, and no name lookup through a symbol-pin name. Mark, hit target, and wire anchor stay as they were.

A block that cites a `componentId` takes its functional ports only from that component's logical interface. Symbol pins remain graphic templates for bound ports. `releaseUnboundSymbolPorts` drops instance ports that have a `symbolPortId` and no `interfacePortId`, unless the port is wired. Instantiation, extract, make unique, duplicate, and paste use that rule. `applySymbol` does not create new pins on a component instance. The symbol definition is unchanged. A plain generic block of the same symbol still receives the original pins. Existing wired or dangling orphans keep their diagnoses and are not deleted with their wires.

`npx tsx src/core/selfcheck.ts` prints `selfcheck ok`. `npx vue-tsc --noEmit` exits 0. The D5a.3c checks cover Boundary names on all four sides, rename in both hierarchy directions, add and delete, graphic move and resize, instantiation without deleted pins, an unchanged symbol, a plain generic that keeps its pins, several instances, duplicate and make unique, project undo and redo, save and load, and kept wires. The D0 through D5a.3b checks in the same file still pass.

The lab check at `http://localhost:5174/` started from **New project** after the code was loaded:

- A generic block gained named ports on several sides. **Open as**, then **Block diagram**, showed the Boundary with visible names inside the outline: `in`, `out`, `clk`, `data`, and `en`.
- The Boundary was scaled to 200×120. The status was "Block updated." Port marks and names stayed on the edges.
- The selected Boundary port `data` was moved through right, bottom, and left, and its relative position was set to 0.3. Each change said "Port moved."
- Renaming `clk` to `clock` from the component panel said "Port renamed to clock. Connections were kept." The Boundary label changed. Renaming `out` to `output` on the root updated every component instance. The plain generic still said `out`.
- Deleting logical `in` said "Logical port removed." The Boundary and the root instance lost it.
- **Place on sheet** added further component instances. Each showed `out`/`output`, `clock`, `data`, and `en`/`enable` only. The deleted `in` did not return.
- A plain Generic block from the library still showed `in` and `out`.
- Renaming `en` to `enable`, then **Project undo** and **Project redo**, restored and reapplied the name on the instances and on the Boundary after navigation into the child.
- **Save** and **Reload** kept the names. Zoom in and zoom out kept label font size at 11px; labels stayed readable.
- After navigation into the child, the Boundary showed `output`, `clock`, `data`, and `enable` inside the contour.

Not clicked in this pass: a freehand drag of a Boundary port onto another side with the pointer (side and position were set from the properties), Duplicate instance and Make unique in the browser (covered by the selfcheck), and a wired-orphan repair path. Cursor glyphs were not photographed.

The user accepted D5a.3c after their own practical test of Boundary names and of new instances without deleted logical ports. D5a.3 is complete. D5a is complete. D5b is released.
