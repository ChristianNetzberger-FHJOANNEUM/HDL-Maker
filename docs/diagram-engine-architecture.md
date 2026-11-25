# Diagram engine architecture

D0 decides the shape of a reusable diagram engine. The proof is `diagram-lab/`. It does not replace the HDL-Maker editor, and it does not read or write `workspace/diagrams/`.

The engine is a general diagram editor first. HDL-Maker and a Nuxt course site are adapters. VHDL generation, GHDL, Vivado, and the FPGA flows stay outside the package.

## Decision

One document, one world coordinate system, one undo history, two drawings of that document:

| Layer | Draws | Does not own |
| --- | --- | --- |
| Vue Flow | Blocks, ports, later states. Selection, drag, zoom, and pan. | Nets, wire geometry, freehand strokes |
| SVG world layer | Wires, bend handles, labels, freehand ink, later shapes | A second camera or a second document |

Vue Flow nodes and edges are a view. The document in `diagram-lab/src/core/` is the model. The demonstrator passes an empty edge list. A wire is not a Vue Flow edge. A net is not a pair of handles.

Canvas is not used. The SVG layer was enough for the prototype, including freehand outlines from `perfect-freehand`. A canvas layer can be added later for very large stroke buffers. It would use the same world coordinates and the same viewport. It would not be a second editor.

`tldraw` was not installed. Its registry license is `SEE LICENSE IN LICENSE.md`, not an SPDX MIT license. It does not replace Vue Flow.

## Coordinates

World coordinates match Vue Flow: x to the right, y downward, in CSS pixels before zoom. The viewport is `{ x, y, zoom }`. Vue Flow reports it. The SVG layer applies the same `translate` and `scale`, with the origin at the top left. A point in the document is the same point on both layers. The stage clips the SVG so the scaled layer does not cover the toolbar.

HDL-Maker's imported sheets use a y-up source system and a separate fit transform. An adapter converts those numbers when a file is opened. The engine does not adopt the HDL Designer axis.

## Packages

D0 keeps the split inside one Vite app so the boundary is real without a second publish step.

| Future package | D0 location | Depends on |
| --- | --- | --- |
| `diagram-core` | `diagram-lab/src/core/` | TypeScript only. No Vue, no DOM, no HDL-Maker store. |
| `diagram-vue` | `diagram-lab/src/view/` | Vue 3 and Vue Flow. Reads and writes the core document. |
| `diagram-tools` | `orthogonalize.ts` is the first piece | Core geometry. Routing and snapping grow here. |
| `diagram-hdl` | Not started | HDL-Maker models and the existing generators. Not imported by the lab. |
| `diagram-learning` | Not started | Task checks against nets, not against pixel positions. |

Names can still change. A second copy of the document types cannot.

Nuxt 3 mounts `diagram-vue` on the client. The core module does not touch `window`. The lab is a Vite page, which is enough to show that no Python backend is required. A Nuxt page was not built in D0.

## Undo

`EditSession` is the edit API. `execute` stores the serialized document, applies one change, and clears the redo stack. A drag calls `begin`, then `preview` on each move, then `commit` or `cancel`. Preview writes the document. There is no second position map. `commit` stores one snapshot for the whole gesture. `cancel`, bound to Escape, restores that snapshot and stores nothing. The stack holds 40 steps. Undo replaces the document. It does not replay Vue Flow's internal state.

## Storage

`DiagramStorage` is `save`, `load`, and `list`. `JsonRecordStorage` keeps the canonical JSON text and is the first implementation. A download uses that same text. A later HDL-Maker workspace folder or a Nuxt course server can implement the same three methods. The lab does not write `workspace/diagrams/`.

`LibraryStorage` is the same kind of seam for a symbol library. It is not part of the diagram document. The first implementation keeps JSON in memory and can export or import that text. Built-in libraries stay in code. Placing a symbol copies the definition into the open document, and copies each cited picture once. The document does not read the library again when it is reopened. The picture bytes live in the document's `assets` array. A later ZIP package can read and write those same records as files. The editor does not store a path.

## Nets

A wire gesture is view state until the click that finishes it. That click is one command. Escape throws the draft away. Joining two different nets is refused. Merge and detach are separate commands. The local router in `autoRoute` draws one orthogonal path and runs only for segments marked `auto`. elkjs stays uninstalled: its license is EPL-2.0 or GPL-3.0-or-later, and this router does not need it.

## Symbols

A symbol definition and its instances live in the same document. The definition has no sheet position. The instance is a block with `symbolId`, its own id, and its own port ids. A wire keeps citing those port ids when the definition moves a pin. `componentId` on the instance is stored for a later component and is not a navigation link. Opening a child diagram is D4.

The symbol picture is drawn from the definition by one SVG component. The editor and the Vue Flow instance both use it. A pin position is `t` along its side. Vue Flow is not asked to store that geometry.

## What happens when a block moves

`moveBlock` writes the new block position and refreshes port endpoints. A port-to-port wire with four points keeps the trunk x the user chose. The label stores a segment id, an edge index, a distance along that edge, and a normal offset. The page position is computed. It is not stored, and it is not the block's delta.

In the seed document the label sits on the vertical edge. Moving Block A sideways leaves the label where it was. Moving Block A downward moves that edge, and the label moves with the edge.

## HDL-Maker adapter

The current studio keeps `EditableDiagram` schema 1. `find_by_source` still reopens `edg_b8c5a1b43a0640589c9fc9362e96566f` and `edg_e78a939e14fb42599794f2c73c3afe55`. D0 does not convert those files.

A later adapter reads an `EditableDiagram` into an engine document, or the reverse, in memory. It keeps ids. It does not write `.bd` or `.sm` files. It does not call a second VHDL generator. The structural and FSM generators stay the HDL-Maker backends. Incomplete sketch objects can be stored in the engine document. They are not reported as valid VHDL.

The HDL-Maker editor stays in place through D1–D3. Replacement is a later integration with the regression counts already recorded for those two work files.

## Risks

| Risk | Handling |
| --- | --- |
| Vue Flow drag and the SVG overlay fight for the pointer | The overlay ignores pointers except bend handles, ink, and the freehand tool. The stage clips the overlay. |
| 347 wires as 347 Vue Flow edges | Wires stay in one SVG. `top_rtc_app` is the later performance reference. D0 did not load it. |
| Label distance along the whole polyline slides when another edge changes length | The anchor names one edge. |
| elkjs auto-layout | Not installed. The license is EPL-2.0 or GPL-3.0-or-later. GPL is not acceptable inside this MIT project. EPL needs a distribution reading before the library is added. |
| y-up HDL coordinates | Conversion belongs to the adapter, once, at the boundary. |

## Open questions

- Whether bend editing for a port-to-port route should grow beyond one trunk position before D2.
- Whether undo snapshots should become command objects once net edits touch many segments. D1 still stores one document snapshot per command.
- A symbol library is a source of copies. Placing a symbol copies the definition into the document. A later library edit does not follow. D3e compares the two definitions by pin id and picture content, then replaces the document copy only after Update all instances. Cancel writes nothing.
- D4a stores a component definition beside the sheet. `componentId` on a block cites it. `interfacePortId` is the logical port. `symbolPortId` stays the graphic pin. The outer port and the inner port are different objects. A project embeds its documents. Cycles are refused on change and reported on load. D4b navigates that model: one location, resolved from block ids, shared by the tree, the breadcrumbs, and a double-click. Zoom, pan, selection, and open tree branches are UI state. D4c changes a logical port in one project command, updates every instance and the implementation boundary, and binds a symbol pin only by id. Sheet undo does not rewrite a document across that command. D4d extracts a selection into one component and can expand one instance again. Same-named nets are not merged. A free end on the cut is refused. Sheet undo is still discarded after the project command. D5a adds three reference projects and records the cases where that discard loses a later sheet edit. D5a.1 turns a drawn block into a component from the sheet and still uses that project command. The user accepted D5a.1. D5a.2 stores the size on the instance and maps symbol coordinates into that box when drawing. Text is not stretched. A locked picture keeps its aspect. The user accepted D5a.2. D5a.3 stores an instance graphic position as `side` and `t` when `placed` is set. That position wins over a bound symbol pin. The symbol definition and the other instances stay where they are. A logical port is still one project command. D5a.3b updates the definition, every instance, and the Boundary together, and refuses the delete when any of those copies is wired. D5a.3c draws Boundary port names from that logical interface through the same face as a flush functional block, and a component instance does not recreate unbound symbol pins after a logical delete. D5a.3 and D5a are accepted. D5b is released; D5b.1 specifies one project-level transaction history in [d5b-transactional-undo-architecture.md](d5b-transactional-undo-architecture.md). The manager is not built yet.
- The exact Nuxt component props. D0 only fixes the constraint: no server, client mount, JSON in, events out.
