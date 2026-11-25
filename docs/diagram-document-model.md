# Diagram document model

This is the engine document, schema version 1. It is not HDL-Maker's `EditableDiagram` and it is not a Vue Flow graph. The TypeScript types live in `diagram-lab/src/core/document.ts`. D0 does not write this schema into `workspace/diagrams/`.

## Identity and geometry

A net has an id, a name, and an optional `signal` bag. It has no coordinates. Several segments may share one net. Two segments that cross are not joined. Joining them is a command, and that command is not implied by proximity.

A segment has an id, a `netId`, a polyline, a start, and an end. An end is a port id, a free point, or a junction id. `routed` is `manual` or `auto`. Only `auto` may be replaced by the local router. A point may carry `fixed: true`; the router must keep that point. A missing `routed` value is read as `manual`.

A label is either free (`x`, `y`) or anchored:

| Field | Meaning |
| --- | --- |
| `segmentId` | The polyline, not the net. Renaming the net changes the text. It does not move the anchor. |
| `edge` | Which span of that polyline, starting at 0. |
| `distance` | Source units along that span, clamped to the span length. |
| `offset` | Distance along the normal. On a left-to-right span the normal points up on the screen. |

Ports belong to a block and a side. A side is `left`, `right`, `top`, or `bottom`. A port without `t` takes its page position from the block and the order of ports on that side. A symbol pin uses `t` along that side: top to bottom on the left and the right, left to right on the top and the bottom. Adding a port recomputes those positions and the segments that cite them. It does not create a net.

## Other records

A junction is `{ id, netId, x, y }`. It is the geometry of a branch. The net still has no coordinates. A missing `junctions` array is read as empty, so schema version stays 1 and a D0 or D1 file still loads.

A label may set `role` to `name` or `note`. A name label, and an older segment label with no role, is drawn with the current net name. A note or a free label keeps its own text.

Blocks store name, position, and size. An instance also stores optional `symbolId`, `componentId`, and `parameters`. `componentId` is a reference for a later component definition. The core does not open it. Strokes store the freehand centerline, pressure, color, and width. The outline is derived with `perfect-freehand` and is not saved. A group is `{ id, name, blockIds }`. It has no coordinates. A missing `groups` array is read as empty. Layers and images are still absent. Adding an array with a default keeps version 1 only while old keys keep their meaning. A change to the meaning of `edge` or of a net requires a new schema version and an explicit migration.

## Symbol and instance

`symbols` is an array of definitions. `assets` is an array of embedded pictures. A missing array is read as empty, so a D0, D1, or D2 file still loads and schema version stays 1.

A definition has an id, a name, a width, a height, pins, shapes, and labels. A pin is `{ id, name, side, t }`. `t` is the fraction along that side. The pin id is never reused for a different pin. Shapes are a rectangle, an ellipse, a line, a polygon, a text item, or an image. A rectangle may set `rx` for rounded corners. An image stores `assetId`, a box, and an optional `lockAspect`. It does not store a path or a URL. Labels are separate text items with their own position. The editor and the instances draw these fields. An SVG or bitmap file is stored as an image asset. It is not split into editable paths.

`libraryId`, `libraryVersion`, and `categoryId` are optional. They record which library copy this definition came from. They are not a live link. The document does not store a file path. If those fields are absent, the definition is still valid, so an older file still loads.

`revision` and `bodyChecksum` are also optional. `revision` is the revision of this stored definition. `bodyChecksum` is a SHA-256 fingerprint of the name, size, pins, labels, and shapes, recorded when the definition is saved or explicitly updated. Neither field is used to decide whether two definitions differ. That decision compares the pins by id and the picture by content. A document that has neither field still loads. Opening or reloading a document does not replace its symbols from a library.

A pin with `x` and `y` is free inside the symbol. Both values are fractions of the symbol width and height. A pin without them stays on `side` at `t`. Changing the symbol size moves a free pin with those fractions and does not change its id. The instance port stores the same fractions so a removed definition pin keeps its last place.

An asset has `id`, `name`, `mime`, `data`, `width`, `height`, and `checksum`. `data` is base64. `mime` is `image/svg+xml`, `image/png`, `image/jpeg`, or `image/webp`. `origin` and `license` are optional. The checksum is SHA-256 of the file bytes. Two shapes with the same checksum share one asset. A library file carries the assets its symbols cite. Copying a symbol copies those assets and does not duplicate a checksum that is already present. Loading a document, importing a library, and preparing a symbol update recompute that checksum from the stored bytes and repeat the SVG checks. A script, a handler, an external link, a wrong type, or a checksum that does not match the bytes refuses the whole file. The open document and the user library stay as they were.

An instance is an ordinary block whose `symbolId` names a definition. Its ports are its own records. `symbolPortId` names the definition pin. `interfacePortId` optionally names a logical component port. That logical port has no coordinates. The instance port also stores `t`, the last fraction it was given. A segment endpoint stores the instance port id, not the definition pin id and not the interface id. Copying an instance copies `symbolId`, `symbolPortId`, and `interfacePortId`, and allocates new block and port ids. A sheet that has none of these fields still loads.

Changing the definition updates the size and the pin side of every instance that cites it. It does not allocate new port ids, and it does not rewrite segment endpoints. A definition pin that no longer exists leaves the instance port and any wire in place. The pin stays at the last stored fraction. `symbolDiagnostics` reports `missing-port`. A block whose `symbolId` is not in `symbols` is `missing-symbol`. Those messages are computed when the document is read. They are not a second stored copy.

A symbol library is a separate JSON object, schema version 1. It has `id`, `name`, `description`, `version`, `categories`, and `symbols`. `origin`, `license`, and `builtin` are optional. The lab keeps built-in libraries in code and the user library behind `LibraryStorage`. Neither library is required to open a diagram. Placing a symbol copies its definition into `symbols` once. A second instance does not add a second definition. A library file whose schema is not 1 is refused. An import that finds the same symbol id with different contents reports `duplicate-id`, or `version-conflict` when the library id matches and the versions differ, and leaves the stored symbol in place.

`extensions` is a JSON object for a course task or an HDL adapter. The core does not read it. Unknown top-level keys are kept in `extra` and written back beside the known keys. A save followed by a load does not drop them. A file whose `schemaVersion` is not 1 is refused and does not replace the open document.

## Project

A project is a separate JSON object, schema version 1. It is not required to open a sheet. It holds `id`, `name`, `rootDocumentId`, `documents`, and `components`. Each document is a normal diagram, including its own symbols and assets. The project stores no file path and no second asset list. `DiagramStorage` is unchanged. `ProjectStorage` saves the project text.

A component has an id, a name, optional description and revision, logical ports, an optional `symbolId`, explicit bindings from `interfacePortId` to `symbolPortId`, and an implementation. The implementation is `none` or `diagram` plus a document id. Any other kind is stored and reported, and is not opened. A component has no position. Several blocks may cite the same component id. The record is [d4a-component-model.md](d4a-component-model.md).

## What the HDL adapter may add

The generic core has no entity, architecture, generic, direction, or VHDL type field. Those stay in `extensions` or in HDL-Maker's own model until `diagram-hdl` exists. The adapter may read a net name as a signal name. It may not invent a direction or a width. Name resolution and conflicts belong to that adapter, not to the renderer.

## Example

The lab opens `doc_demo`: blocks `blk_a` and `blk_b`, ports `prt_a1` and `prt_b1`, net `net_link`, segment `seg_link`, label `lbl_link` on edge 1. Moving a block changes coordinates on the segment and leaves the ids and the anchor numbers alone.
