# Diagram editor roadmap

D0 through D5 are one program. D0 through D4d are built in `diagram-lab`. D5a prepares the acceptance review and three reference projects. D5a.1, D5a.2, and D5a.3 are accepted by the user; D5a is complete. D5b is released. D5b.1–D5b.3 are accepted. D5b.4 hardens interactive gestures ([d5b4-interactive-gesture-transactions.md](d5b4-interactive-gesture-transactions.md)) and waits for acceptance. D5b.5–D5b.6 and D5c through D5f are not started. D4f and D4g are not started. The HDL-Maker editor, the VHDL generators, and the FPGA backends stay as they are while the lab proceeds.

The rule for the whole program: the library is a diagram editor first. HDL is an adapter.

| Step | Goal | Status |
| --- | --- | --- |
| D0 | Architecture, licenses, and a standalone prototype | Built in `diagram-lab`. Recorded here and in [d0-feasibility.md](d0-feasibility.md). |
| D1 | General block diagrams, no HDL meaning | Built in `diagram-lab`. No HDL integration. |
| D2 | Ports, nets, branches, anchored labels | Built in `diagram-lab`. No HDL integration. |
| D3a | Symbol definition, instance, stable port ids | Built in `diagram-lab`. No symbol editor. |
| D3b | Graphical symbol editor | Built in `diagram-lab`. No SVG import. |
| D3c | Symbol library and palette | Built in `diagram-lab`. Graphical catalogs only. No HDL and no asset import. |
| D3d | SVG and bitmap assets | Built in `diagram-lab`. Pictures are embedded assets. No path editor and no HDL. |
| D3e | Symbol-change migration and acceptance | Built in `diagram-lab`. An update is explicit. No HDL. |
| D4a | Component and project model | Built in `diagram-lab`. No HDL. |
| D4b | Hierarchical navigation | Built in `diagram-lab`. One path, one shared diagram, no HDL. |
| D4c | Component interface authoring | Built in `diagram-lab`. Logical ports, explicit bindings, one project undo. No HDL. |
| D4d | Extract, expand, and definition commands | Built in `diagram-lab`. One project undo. No HDL. |
| D4f–D4g | Libraries and adapter acceptance | Specified. Not started. |
| D5a | Functional acceptance and three reference projects | Prepared in `diagram-lab`. The user's own session is the acceptance. |
| D5a.1 | Interactive top-down authoring | Built in `diagram-lab`. Accepted by the user on 25 Nov 2026. [d5a1-interactive-top-down-authoring.md](d5a1-interactive-top-down-authoring.md). |
| D5a.2 | Interactive block resizing | Built in `diagram-lab`. Accepted by the user on 25 Nov 2026. [d5a2-interactive-block-resizing.md](d5a2-interactive-block-resizing.md). |
| D5a.3 | Interactive port authoring | Accepted. D5a.3a–D5a.3c closed. [d5a3-interactive-port-authoring.md](d5a3-interactive-port-authoring.md). |
| D5b | One chronological undo history | Released. D5b.1–D5b.3 accepted. D5b.4 gesture robustness waiting for acceptance. [d5b4-interactive-gesture-transactions.md](d5b4-interactive-gesture-transactions.md). |
| D5c | Drawing tools and interaction | Specified. Not started. Includes the earlier freehand work. |
| D5d | Large diagrams | Specified. Not started. |
| D5e | Export and documentation | Specified. Not started. |
| D5f | A Vue 3 component library | Specified. Not started. |
| CL0–CL7 | Component Library System (planning) | Proposed only. Not accepted. Not started. [component-library-system-architecture.md](component-library-system-architecture.md). |
| EDU0–EDU6 | Educational Web Applications (planning) | Proposed only. Not accepted. Not started. [educational-web-editor-architecture.md](educational-web-editor-architecture.md). |

Planning IDs **CL** / **EDU** avoid collisions with existing **L0** (Learning Mode) and **E0–E6** (Studio editor). They are not released for implementation.

## Long-term streams after D5 (planning)

D5b–D5f stay the active diagram-engine completion path. After that, two **proposed** streams share the same core:

| Stream | Purpose | Doc |
| --- | --- | --- |
| **CL** | Domain-neutral component libraries, manager, parameters, assets | [component-library-system-architecture.md](component-library-system-architecture.md) |
| **EDU** | Browser assignments, packs, student JSON, viewer/checker | [educational-web-editor-architecture.md](educational-web-editor-architecture.md) |

**Guidance for D5c–D5f (not a schema change):** avoid hard-coding domain palettes into the core; keep host-configurable library lists in mind for D5f; treat large embedded assets as a **D5d** concern relative to project-snapshot undo (D5b Variant A stays unless a later acceptance revises it).

**MVP sketch (proposal):** finish D5b → accept CL0 → load a small self-contained library → transactional place/wire/parameters → student JSON → lecturer reopen. Full Shape Editor (CL7), auto-grading (EDU5), and simulation (EDU6) are out of MVP.

## D1 — General block editor

A new diagram does not need an HDL Designer file. The document core is the only place an edit is written. Vue Flow and the SVG layer both read that document.

| Priority | Function | In the lab |
| --- | --- | --- |
| 1 | One command history | `EditSession`. A mouse move is one undo step. Escape restores the document before the gesture and adds no step. |
| 2 | Create and delete blocks | Palette, Delete, and the keyboard. |
| 3 | Selection | Click, Shift-click, and a marquee. The selection is not stored in the file. |
| 4 | Save and load | `DiagramStorage`. The first implementation is `JsonRecordStorage`. Save downloads `{id}.json`. Reload reads the stored text. Load file parses the same JSON. |
| 5 | Copy, paste, and duplicate | New ids. A wire is copied only when both of its port ends are in the copied set. |
| 6 | Grid and snap | 20 world units. Snapping is part of the same move, applied when the pointer is released. |
| 7 | Simple block palette | Note, Process, and Decision. This is not the symbol editor. |

A group is a list of block ids and has no geometry of its own. Duplicating a group copies its blocks and the wires that stay inside the group. Those copies get a new net. Wires that leave the group stay where they are.

A block may be only a name, a position, and a size. An incomplete object may be saved. Scale, z-order, and SVG export stay open as D1 additions. They are not a gate for later steps. A saved template library is not part of this step.

Done when ten blocks can be placed, several moved, a group duplicated, objects deleted, the edits undone and redone, and the file loaded again with the same ids, positions, and connections. The VHDL generators are unchanged.

## D2 — Nets

The wire tool draws an orthogonal preview. A click on empty space adds a bend. A click on a port, a junction, or a wire finishes the gesture as one undo step. Escape drops the draft and writes nothing. A free end can be extended. Snapping prefers a port, then a junction, then a free end, then a wire. Two equally close targets are refused.

A segment can be selected and dragged. A bend handle moves one adjacent span. Dragging a span whose end is a port or a junction inserts a jog, so the other branches stay put. Colinear bends are removed. A manual route is never replaced by the router. `routed: "auto"` is the only segment the local router may redraw. elkjs is not installed.

A junction is an explicit branch point with a position. A crossing is not a junction. Attaching a wire to a segment splits that segment and keeps its id on one piece. If the two ends already belong to different nets, the edit is refused until Merge. Merge keeps the net that was selected first. Detach removes the chosen segment and gives every remaining piece its own id. The piece whose smallest segment id comes first keeps the old id and name. The others get new ids and the same name.

A segment label with role `name`, or an older label with no role, shows the net name. Renaming the net updates every such label and does not move the wire. Moving a label changes only its anchor.

The sheet `doc_nets` has ten blocks, two ports on each, one net with four ports and three junctions, two labels, a six-bend wire, a crossing of two nets, and a free wire. Schema version stays 1. `junctions` defaults to an empty array, so a D0 or D1 file still loads.

## D3 — Symbols

D3 is split so the data model is settled before a drawing tool exists.

| Step | Content | Status |
| --- | --- | --- |
| D3a | Symbol definition, instance, stable port ids, and the rules for a symbol change | Built. |
| D3b | Draw shapes, text, and ports on a symbol | Built. |
| D3c | A library, a palette, and placing a saved symbol | Built. |
| D3d | SVG and bitmap symbols. Assets are resource ids, not file paths | Built. |
| D3e | Apply a changed symbol to existing instances, with the D3a rules, and the acceptance sheet for that editor | Built. |

A symbol definition holds the picture, the pins, and the symbol id. It has no position on the sheet. An instance is a block with its own id and position. It stores `symbolId`. Each of its ports stores `symbolPortId` and keeps its own port id. A wire cites that port id. Two instances of Counter do not share a port id.

`componentId` and `parameters` may sit on the instance. Nothing opens `componentId`. A child diagram is D4.

When a symbol pin moves or the symbol size changes, every instance copies the new size and pin side. Port ids and the wires that cite them stay. `refreshAll` moves the wire ends. Removing a pin from the definition does not delete a wire. The instance pin remains, and `symbolDiagnostics` names it. A `symbolId` that points nowhere is the same kind of visible diagnosis. The lab shows that list. It is computed, not stored.

`t` is the fraction along the pin's side. On the left and the right it runs from top to bottom. On the top and the bottom it runs from left to right. A port that has no `t` still uses the older even spacing, so a D0, D1, or D2 file keeps its pin positions.

D3b draws one symbol on its own canvas: rectangle, ellipse, line, polygon, text, and pins. A pin has a name, a side, and `t`. Selection and dragging are one undo step. Escape drops the gesture. The same SVG drawing is used in the editor and on each instance. It does not depend on a Vue Flow handle. Changing the symbol updates every instance and leaves the wire's port ids in place. Deleting a pin still keeps a connected wire and shows the D3a diagnosis.

Place instance puts a new block on the sheet from the symbol that is open. A pin still has no VHDL direction or type.

D3e adds `revision` and `bodyChecksum` on a definition. The revision is a label. The comparison in `compareSymbols` reads pins by id and the picture by content, and it does not write. Compare library shows both pictures, the revision, the changes, the instance count, the connection count, and any pin whose wire would be left behind. Cancel writes nothing and adds no undo step. Update all instances replaces that one document definition and refreshes every block that cites it. That confirmed write is one undo step. Undo restores the definition, the assets, the port ids, the wire geometry, the nets, and the label anchors.

A removed pin keeps its instance port and its wire. A new pin, even one that reuses the old name, stays unconnected. The diagnosis offers Leave, Assign, and Remove wire. Assign moves the segment endpoint onto the chosen port and, when that port already belongs to another net, merges with the D2 rule that keeps the wire's net id. Remove wire uses `deleteSegment`. Neither action runs unless the user asks for it.

Publish revision is the explicit way to replace a user-library symbol. Save to library still refuses a different body. Separate definition clones the symbol, keeps the pin ids, and points only the selected instance at the clone.

The acceptance sheet `doc_acceptance` has 22 blocks, five definitions, repeated instances, an SVG, a PNG, side pins, a free pin, a junction, name labels, and both manual and automatic segments. The bench sheet `doc_bench` is synthetic. It has 50 blocks, 350 segments, 478 ports, 350 labels, and one block with 86 ports. It does not read `top_rtc_app`.

One run of `npx tsx src/core/selfcheck.ts` on this machine (Windows, Node v24.11.1) measured the document operations, not the Vue paint: JSON 198,390 bytes, parse 0.8 ms, one block move 1.9 ms, symbol update 2.8 ms, undo 1.2 ms, redo 1.7 ms. In the browser the same sheet was built in 8 ms and drawn as 50 blocks and 700 wire paths. Zoom in set the shared transform to scale 2.5. Those times are a single sample, not a budget. The document operations are small beside drawing 350 wires and an 86-pin symbol. No optimization was started. Scale, z-order, and SVG export of the sheet stay open from D1.

D3d adds an image primitive and an asset list on the document. An asset has a stable id, a file name, a MIME type, the image bytes as base64, the original width and height when they can be read, a SHA-256 checksum, and optional origin and license. A symbol shape cites the asset id. The same checksum is stored once, even when several symbols or instances use it. A diagram without an `assets` array still loads. The file stores no path and no blob URL.

SVG, PNG, JPEG, and WebP are accepted. A bitmap is not traced. An SVG is kept as one picture and is not split into paths. It is drawn with an SVG `image` element, so the file's scripts do not run. The import also refuses a script, an event handler, `foreignObject`, a document type, or a link to anything other than a fragment or an embedded data URL. A file whose bytes do not match its type is refused, and so is a file over 1.5 MB or an edge over 4096 pixels. A refusal writes nothing.

A pin may stay on a side with `side` and `t`, or it may set `x` and `y` as fractions of the symbol box. Existing pins have no `x` or `y`, so their positions do not move. Changing the symbol size moves both kinds of pin with the box and does not allocate a new port id. The wire still cites the instance port. The picture itself stays at the coordinates stored on the shape, as a rectangle does.

The editor can import a file, drop one, or paste an image, then move it, change its box, keep or release the aspect ratio, replace it, and delete it. Text, shapes, and pins can share the symbol. Saving the symbol copies the needed assets into the user library. Placing it copies them into the document, again once per checksum. The Pictures catalog holds hand-drawn LED, switch, meter, FPGA-board, and oscillator graphics. They have no electrical function and no HDL. A later package could store the same asset records as separate files. D3d does not build that package.

D3c adds libraries beside the document. A library has a stable id, a name, a description, a version, categories, and symbol definitions. Origin and license are optional. The library code does not import Vue. Three kinds stay separate:

- A built-in library is shipped with the lab and cannot be edited. The first catalogs are General, Flowchart, Digital Logic, and Signal Processing. They are pictures and pins. They do not simulate and they do not write HDL. HDL Components, Electronics, and State Machines are later catalogs and are not included.
- A user library holds symbols the author saves. The lab stores it through `LibraryStorage`. The first implementation is JSON in memory, plus export and import. It is not a server and it is not the diagram file.
- A document symbol is the definition inside `symbols`. Placing a library symbol copies that definition into the document once. Further instances cite the same copy and receive their own port ids. A saved diagram still draws when the library is gone. The copy stores `libraryId`, `libraryVersion`, and `categoryId` when it has them. It stores no file path. A later library edit does not rewrite the document. Update from library is the explicit replacement and is built in D3e.

The palette lists one library, its categories, a search field, and a preview drawn by the same SVG component as the editor and the instances. A click places the symbol on the next free slot. A pointer drag places it where the pointer is released, including after zoom and pan. Either placement is one undo step and is refused, with no history entry, when the document already holds a different symbol with that id. The editor can rename a symbol, assign a category, duplicate it, save it into the user library, and export or import that library. Deleting a user symbol does not remove the copy already stored in a document. A built-in symbol can be copied into the user library and edited there. An import that repeats an id with different contents reports the conflict and keeps the stored symbol.

## D4 — Hierarchy and top-down design

D4 is split. D4a, D4b, D4c, and D4d are built. The records are [d4a-component-model.md](d4a-component-model.md), [d4b-hierarchy-navigation.md](d4b-hierarchy-navigation.md), [d4c-component-interface-authoring.md](d4c-component-interface-authoring.md), and [d4d-hierarchical-authoring.md](d4d-hierarchical-authoring.md).

| Step | Content | Status |
| --- | --- | --- |
| D4a | Component definition, project container, interface ids, instance paths, cycle check | Built. |
| D4b | Open a child, breadcrumbs, project tree, shared edit session, viewport memory | Built. |
| D4c | Edit logical ports, bind symbol pins by id, and create an implementation on purpose | Built. |
| D4d | Manage definitions, extract a selection, and expand one instance | Built. |
| D4f | Reusable component libraries and a portable project package | Not started. |
| D4g | Acceptance of the hierarchy, then the seam for an HDL or FSM adapter | Not started. |

A component has no position. A block remains the instance and keeps its own port ids. Several blocks may cite one component, and they share one implementation diagram. That diagram is not copied per instance. The logical port is `interfacePortId`. The symbol pin is `symbolPortId`. The wire still cites the instance port id. The inner sheet port is a different object that may cite the same interface id. Nothing matches these by name.

A project embeds its documents and component definitions. A sheet can still be opened alone, including from a page that has no project. `DiagramStorage` is unchanged. Cycles are rejected when a reference is added, and a load reports them without inventing a replacement. Creating a component together with its diagram is one project undo step. Document undo stays on `EditSession`.

D4b does not add a second hierarchy. The open level is a list of block ids. The tree, the breadcrumbs, and a double-click all resolve that list to the implementation document. U1 and U2 share that document and its undo history. The path, the zoom, and the pan are not part of the diagram. A missing implementation is reported and does not create a sheet.

D4c edits the logical ports of one component as a single project command. Every instance and the implementation boundary receive their own port objects and the same `interfacePortId`. A symbol pin is bound only by id. A rename keeps port ids and net ids. A wired port is not deleted when its logical port goes away; the wire stays and a diagnosis names it. Sheet undo cannot roll one document back across that command. The rule is in [d4c-component-interface-authoring.md](d4c-component-interface-authoring.md).

D4d uses that same project command for extract, expand, rename, duplicate, delete, and make unique. Extract moves the selected blocks and keeps each net's connectivity, including a junction that stays outside and a junction that moves inside. Same-named nets are not merged. Expand copies one implementation back onto the sheet and leaves every other instance on the shared definition. The sheet undo stack is still discarded after the command. A mixed undo history is not built. The record is [d4d-hierarchical-authoring.md](d4d-hierarchical-authoring.md).

The later HDL adapter still adds entity, architecture, generics, directions, and types outside the generic core. A sketch is not emitted as if it were complete. That work is D4g and is not started. Scale, z-order, and SVG export of the sheet stay open from D1.

## D5 — Consolidation before integration

D5 makes the lab a base that HDL-Maker and the Nuxt script can share. It does not start that integration. The order is D5a (complete), then D5b (D5b.1–D5b.3 accepted; D5b.4 gesture robustness awaiting acceptance), then the drawing, performance, export, and library steps. D5b.5 is locked until D5b.4 is accepted. The keyboard session can change the order of D5c through D5f. It does not skip the undo problem.

| Step | Content | Status |
| --- | --- | --- |
| D5a | Three reference projects, a usability review, and a checklist for a session at the keyboard | Prepared. The acceptance is the user's session, not the selfcheck. [d5a-editor-acceptance.md](d5a-editor-acceptance.md). |
| D5a.1 | A drawn block becomes a component from the sheet, through Open as | Accepted by the user on 25 Nov 2026. [d5a1-interactive-top-down-authoring.md](d5a1-interactive-top-down-authoring.md). |
| D5a.2 | One instance can be scaled, and the symbol is drawn in that box | Accepted by the user on 25 Nov 2026. [d5a2-interactive-block-resizing.md](d5a2-interactive-block-resizing.md). |
| D5a.3 | Ports can be added and moved on any side of one instance | Accepted. [d5a3-interactive-port-authoring.md](d5a3-interactive-port-authoring.md). |
| D5b | One chronological transaction history for sheet edits and project commands | D5b.1–D5b.3 accepted. D5b.4 waiting for acceptance. [d5b4-interactive-gesture-transactions.md](d5b4-interactive-gesture-transactions.md). |
| D5c | Drawing tools and interaction, including routes that stay readable, fit, and the rest of the backlog | Specified. Not started. [diagram-editor-usability-backlog.md](diagram-editor-usability-backlog.md). |
| D5d | Performance on a large sheet, including continuous mouse movement | Specified. Not started. |
| D5e | Export of a whole diagram, and documentation for a reader outside the lab | Specified. Not started. |
| D5f | The lab surface as a Vue 3 component library | Specified. Not started. Prefer APIs that can host dynamic libraries (CL2) without a second editor. |
| CL / EDU | Component libraries and educational web apps | Planning docs only. [component-library-system-architecture.md](component-library-system-architecture.md), [educational-web-editor-architecture.md](educational-web-editor-architecture.md). |

Freehand ink, a confirmed conversion to an orthogonal wire, and a stroke that stays ink until that confirmation are already in the lab as a prototype. Eraser, arrows, and a pen mode are D5c and are not started. A learning task that stores instructions, allowed edits, and a check against nets was specified before this split. It is not built, and it is not part of D5a. Browser assignment packs are the separate **EDU** proposal; local HDL Learning Mode remains **L0**.

## Studio steps that this program absorbs

| Existing step | Where it goes |
| --- | --- |
| E0, E1 | Stay. The HDL-Maker editor already opens one work file and draws the E1 picture. |
| E2 hierarchy | D4. No second navigation is built before that. |
| E3 FSM properties | A later HDL step. Not part of D0–D5. The M3b generator stays until a comparison is approved. |
| E4 drawing states | A later use of the same engine, after D5. |
| E5 full block editing | D1 and D2. |
| E6 search, auto-layout, overlays | After D5. elkjs is not approved. See [d0-feasibility.md](d0-feasibility.md). |

## Not in this program

No commit, no release package, no edits under `libs/`, no FPGA programming, no toolchain change, no second VHDL generator, and no rewrite of the existing `edg_*.json` files.
