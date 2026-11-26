# D5c.7 — Wire / segment copy (decision spec only)

**Status:** Spec only — **no implementation** in this slice.  
**Prerequisite:** D5c.3–D5c.6 accepted (block copy; wire rename; connection-by-name + stubs; Shift+Drag block duplicate).

This document decides whether and how the lab should copy **wires** (or wire **segments**) independently of block selection. It must stay consistent with **D5c.5** (same sheet name ⇒ one net) and with today’s block clipboard (`captureFragment` / `pasteFragment`).

## 1. What exists today

| Mechanism | Wire behaviour |
| --- | --- |
| Block Copy / Paste / Duplicate (D5c.3) | Copies a wire only if **both** port ends lie in the selected blocks. New segment + net ids. External / dangling / free-end wires are omitted. |
| Wire select + Delete | Removes segment(s); may split remaining geometry into uniquely named nets. |
| Connection-by-name (D5c.5) | Display name is the join key on the **current sheet**. Stubs may share one net id while geometrically disconnected. |
| Stub draw (D5c.5) | Port → free (double-click) creates an open end; name from port / by-name reuse. |
| Shift+Drag (D5c.6) | **Blocks only** — not wires. |

**Gap:** Selecting a wire and pressing Ctrl/Cmd+C does nothing useful for that wire alone. Users who want another stub of `clk` redraw it or rename-join.

## 2. Options

### A — Whole wire including port attachments

Copy the selected segment graph **and** remember the port endpoints; on paste, **reconnect** to the same port ids or to ports at the same relative offset.

| Pros | Cons |
| --- | --- |
| Feels like “clone this connection” | Pasting onto already-wired ports doubles attachments or fails silently |
| | Port ids are instance-local; paste after delete/move breaks |
| | Conflicts with “one wire per port” mental model |
| | Hard Undo story if reconnect mutates existing nets |

**Fit for this app:** Poor. HDL sheets rarely want two segments into the same pin from a clipboard stamp.

### B — Polyline / stub geometry only (orphan free ends)

Copy the selected segment’s points (and name). Paste as a **new segment** with **free** (or free+free) ends, offset like block paste. Name follows D5c.5: reuse net by name ⇒ electrically join without geometry touch.

| Pros | Cons |
| --- | --- |
| Matches stub workflow and connection-by-name | Paste does not auto-hit ports (user draws or drags ends later — if ever) |
| Safe: no silent port double-book | Open ends must stay allowed (`commitWire` / model already allow free) |
| Easy one history entry | Junctions / multi-branch nets need a clear subset rule |

**Fit for this app:** Good as a **stamp stub** tool for repeated named nets (`clk`, `rst`).

### C — Segment alone vs whole net

| Sub-option | Meaning |
| --- | --- |
| **C1 Segment** | Clipboard holds one segment polyline (+ name). Paste one stub. |
| **C2 Net** | Clipboard holds **all** segments/junctions of the selected net. Paste a disconnected island with the same name (by-name join) or a uniquely renamed copy. |

| | C1 | C2 |
| --- | --- | --- |
| Pros | Small, predictable | Preserves branched clocks / buses visually |
| Cons | Loses junctions / siblings | Heavy; paste of a whole net island may surprise; name join merges electrically with every existing `clk` |

**Fit:** Prefer **C1** for a first implementation. **C2** only if users hit a real wall after C1.

### D — Paste name / net-id policy (with D5c.5)

| Policy | Effect |
| --- | --- |
| **D1 Keep name → by-name join** | Pasted stub uses source **name**; `ensureNetByName` ⇒ same net id as existing `clk`. |
| **D2 Unique name** | Pasted stub gets `clk 2` (like geometric split). Electrically separate until rename-join. |
| **D3 New anonymous net** | Fresh default `net N`; user renames. |

**Fit:** **D1** for HDL-like “another stub of the same signal”. Offer **D2** only if paste must not join (e.g. modifier key later — out of v1).

### E — Port reconnect on paste

Snap free ends to nearest ports within SNAP, or remember port names and bind to ports of the same name on nearby blocks.

| Pros | Cons |
| --- | --- |
| Faster schematic cloning | Ambiguous snaps; wrong pin; accidental net join of unequal names |
| | Fights explicit Merge / probeWire rules |

**Fit:** **Out of scope for v1.** User finishes connections with Wire tool or by-name stubs.

### F — Gestures

| Gesture | Note |
| --- | --- |
| Ctrl/Cmd+C / V / D with wire selection | Natural extension of block shortcuts |
| Shift+Drag on wire | Easy to confuse with span-drag / bend; **not** in v1 (D5c.6 stays block-only) |

## 3. Recommendation

| Decision | Detail |
| --- | --- |
| **Verdict** | **Deferred** — worth doing later; **not** won't-do; **not** implement now |
| **Recommended scope (future slice)** | **B + C1 + D1**: copy **selected segment(s)** as **orphan stub polylines**; paste with offset; **keep display name** → connection-by-name join; one history entry; Ctrl/Cmd+C/V (and optionally D) when selection is wire-only |
| **Explicitly out of first wire-copy slice** | A (port reconnect), C2 (whole-net island), E (auto port snap), F Shift+Drag wire, system clipboard, marquee-of-wires |

### Why this shape (HDL-like lab)

1. **D5c.5 already makes name the electrical identity.** Stamping another stub of `clk` is the natural “copy wire” for top-down / by-name design — not cloning pin-to-pin attachments.  
2. **Block copy already covers** “duplicate this connected subgraph” when both ends are selected (D5c.3). Wire-only copy should not reinvent that.  
3. **Port reconnect (A/E)** is high risk and low clarity next to `probeWire` refusals and Merge.  
4. **Segment-alone (C1)** matches how users select today (one span / one segment id in the inspector). Whole-net copy can wait.  
5. Implementing now would compete with locked **D5b.5** polish and does not unblock HDL generation; defer keeps the roadmap honest.

### Won't-do (unless product revisits)

- Shift+Drag duplicate for wires (v1).  
- Copy of freehand strokes as wires in the same command.  
- Cross-sheet / project-global wire clipboard.  
- Silent merge of legacy duplicate names on paste beyond D5c.5 rules.

## 4. Risks (for a future implementation)

| Risk | Mitigation |
| --- | --- |
| Stacked ghost geometry (see D5c.6 preview bug) | Additive paste must go through `execute` / baseline-safe preview only if gestured |
| Name join surprises (“I pasted and joined every clk”) | Status: `Pasted stub on net "clk"`; Inspector already shows net id / collision |
| ID collisions | Always `createId` for segment / label; net via `ensureNetByName` or new id |
| Multi-segment selection | v1: copy each selected segment as its own stub, same name; or only the primary `selectedSegment` |
| Junctions mid-net | v1: omit junctions; paste simple polylines from segment.points only |
| Labels | Copy one name-label anchor on the new segment (or rely on `addNameLabel`) |
| Undo | Single history entry per paste; cancel N/A for non-gesture execute |
| Double free–free floating wires | Allowed; same as hand-drawn free wire — OK |

## 5. Acceptance sketch (future implement slice)

Provisional id: **D5c.7a** (only if released). Checklist:

1. Select one wire segment → Ctrl/Cmd+C → status shows wire copied (not “select a block”).  
2. Ctrl/Cmd+V → offset stub with **free** ends; **same name**; if name existed, **one** net id (by-name).  
3. Original segment unchanged.  
4. Undo / Redo removes / restores the paste.  
5. Block-only copy/paste (D5c.3) and Shift+Drag block (D5c.6) unchanged.  
6. Selecting a block still does not pull external wires.  
7. No Shift+Drag on wires.  
8. `selfcheck` covers stub paste + by-name join + undo; `vue-tsc` 0.  
9. Doc `d5c7a-…` references this decision.

## 6. Non-goals (this Spec slice)

- No code under `diagram-lab/src/`.  
- No `libs/` / EditableDiagram.  
- No D5b.5 / D5b.6 / CL / EDU / D5c.8+.  
- No commit/push/ZIP unless explicitly requested.

## 7. Spec-slice acceptance

| # | Criterion | Status |
| --- | --- | --- |
| 1 | This doc is readable alone | Done |
| 2 | Clear recommendation: **Deferred**, scope **B+C1+D1** | Done |
| 3 | Roadmap / Changelog mark Spec-only | Done |
| 4 | No product code diffs | Done |

## 8. Related

- [d5c3-block-copy-duplicate.md](d5c3-block-copy-duplicate.md)  
- [d5c5-connection-by-name.md](d5c5-connection-by-name.md)  
- [d5c6-shift-drag-duplicate.md](d5c6-shift-drag-duplicate.md)  
- [diagram-editor-usability-backlog.md](diagram-editor-usability-backlog.md) (copy/paste gap)
