# A1 evaluation + P5 investigation — Flexible wire labels

**Status:** Investigation only (27 Nov 2026) — **stop for review**. No implementation.  
**Depends on:** P0–P4b presentation track accepted.  
**Related:** [d5c1-wire-label-drag](d5c1-wire-label-drag.md), [d5c5-connection-by-name](d5c5-connection-by-name.md), [p3a-text-position](diagram-lab-pilot-a1-p3a-text-position.md), [application pilots](diagram-lab-application-pilots.md).

---

## 1. A1 visual pilot evaluation (user)

P4b preferences confirmed available. The synchronous 4-bit counter was reproduced with existing Diagram-Lab capabilities.

| Criterion | User rating |
| --- | --- |
| Block design / proportions | Very good |
| Colouring | Very good |
| Multiline block text | Very good |
| Port positioning | Good |
| Orthogonal routing | Very good |
| Feedback + junction | Good |
| Grid / snap | Function confirmed |
| Wire-label positioning | Needs improvement |
| Label on outgoing Q segment | Needs clarification |
| Bus-width mark | Feature missing |
| Teaching-material suitability | Good, with limitations |

**Provisional overall:** good for technical block diagrams, with smaller labelling constraints.

| Confirmed (user / drawing) | Not exhaustively re-proven here |
| --- | --- |
| Visual structure, colours, text, routing, junctions, stubs, prefs | Full Undo/Redo / persistence / net-connectivity regression suite |
| Label movement feels constrained on EN/CLK/RST | Every edge case of junction split label migration |

---

## 2. P4b confirmation

Recorded separately: [p4b-preferences](diagram-lab-pilot-a1-p4b-preferences.md) — **accepted**. Not a blocker for P5.

---

## 3. Current wire-label architecture

### Data model (`document.ts`)

```ts
LabelAnchor =
  | { kind: 'segment'; segmentId; edge; distance; offset }
  | { kind: 'free'; x; y }

Label = { id; text; role?: 'name' | 'note'; fontSize?; visible?; anchor }
```

- **Name labels** (`role: 'name'`): drawn text comes from the **net** via `labelText` (D5c.5 identity).
- **Ownership:** each label instance is anchored to **one segment** (`segmentId`), not to the net as a whole.
- **`offset`:** a **scalar signed distance along the edge normal** (see `pointOnEdge` in `geometry.ts`), not a free (Δx, Δy).

### Geometry

| Function | Role |
| --- | --- |
| `pointOnEdge(points, edge, distance, offset)` | Parametric point on edge + **1D** normal offset |
| `labelPlacement` | Resolves draw position from anchor |
| `placeLabelAt` | Drag: project pointer onto **same** segment polyline; rewrite `edge` / `distance` / **scalar** `offset` |
| `projectOnto` | Clamps projection to edge endpoints (`t ∈ [0,1]`) |

### Creation

| Path | Labels created |
| --- | --- |
| `commitWire` (new segment) | Exactly **one** `addNameLabel` on that segment |
| `extendSegment` (grow free end) | **None** (same segment keeps existing labels) |
| `splitSegmentAt` (T-junction mid-wire) | Existing labels **reassigned** to head or tail; **no** new label on the other piece |
| UI **Add label** | `addNameLabel` on the **selected** segment only |

### Drag / history

D5c.1 gesture: `begin` → `placeLabelAt` previews → commit; Escape / Undo OK. No grid snap. Visibility is P1 (`visible` / segment-scoped checkbox).

---

## 4. Root cause — restricted movement (EN / CLK / RST)

**Not a bug in hit-testing or selection.** The model cannot represent an arbitrary diagram position relative to a short vertical stub.

1. Drag stores only the **normal component** of the residual (`placeLabelAt` scalar `offset`).
2. For a **vertical** edge, the normal is **horizontal** → free motion is effectively **left/right** of the wire, plus sliding **along** the stub (`distance`).
3. When the pointer goes **past the tip** (e.g. “below” a downward stub), projection **clamps to the endpoint**. The residual’s component **along** the wire beyond the tip is **discarded** — it is not folded into `distance` (already at the end) and not stored as a second axis.

Hence labels feel “glued” to the stub orientation and cannot sit freely below/beside like P3a block display text.

**Contrast P3a:** `displayTextOffset: { x, y }` is a full 2D offset from the block centre — unrestricted in diagram coordinates (no grid snap).

---

## 5. Root cause — missing label on outgoing Q segment

Logical net **Q** is shared across junction-connected segments (D5c.5). **Visual name labels are per-segment instances.**

Typical A1 feedback construction:

1. Draw register **Q** → somewhere as one polyline → **one** name label on that segment.
2. Form a **T-junction** by connecting into the mid-span (`splitSegmentAt`).
3. Split yields **two** segments (head + tail). Existing label(s) migrate to the piece whose geometry is nearer; the **other piece gets no new `addNameLabel`**.
4. Result: Q visible on the register→junction piece; the **outgoing** piece beyond the junction often has **no label instance** — not a visibility flag, not a second logical net, and not net-name failure.

Connecting a **brand-new** wire from an existing junction *does* call `commitWire` → `addNameLabel` for that new segment. So the missing label depends on **how** the topology was built (split vs new commit). User observation matches the split path.

UI already has **Add label** for the selected segment — workable workaround, but not discoverable enough for teaching diagrams; P5b should make multi-segment labelling intentional and easy.

---

## 6. Proposed minimal P5a — free 2D label offset

### Intent

Keep the **wire association** (segment + parametric attachment) and add an unrestricted diagram-space offset:

\[
P_{\mathrm{Label}} = P_{\mathrm{Anchor}}(edge, distance) + \begin{pmatrix}\Delta x\\\Delta y\end{pmatrix}
\]

### Minimal model change (conceptual)

On segment anchors, introduce a 2D shift (names illustrative):

- Prefer: `shift?: { x: number; y: number }` with omit ≡ `(0,0)`, **or**
- Replace scalar `offset` with `{ x, y }` and migrate:  
  `shift = normal(edge) * offset` at load/upgrade.

Preserve `segmentId` / `edge` / `distance` so labels still follow stub/block/port/span motion via existing reanchor / live ends.

### Interaction

- Mouse drag updates **`shift`** (and optionally re-picks nearest `edge`/`distance` on the **same** segment — do **not** jump to another segment in P5a).
- No grid snap (like today / P3a).
- Reset offset → clear `shift` / restore default `(0,0)` (+ optional default normal offset for new labels).
- Reuse label-drag gesture infrastructure; analogous UX to P3a (group moves as one; no separate text engine).

### Compatibility

| Concern | Approach |
| --- | --- |
| Old documents | Migrate scalar `offset` → equivalent `shift`, or keep reading `offset` until rewritten |
| Geometry edits | Keep reanchor / split migration of edge+distance; **preserve** `shift` |
| Copy / save / Undo | Same history path; serialize new fields |
| Visibility / net rename | Unchanged (P1 / D5c.5) |

**Out of P5a:** jumping labels across segments; new annotation types; bus marks.

---

## 7. Proposed minimal P5b — labels on arbitrary net segments

### Intent

Multiple **visual** name-label instances may reference the same **canonical net** (same `netId` / name). Creating/removing a label must **not** rename, split, or merge nets.

### Minimal mechanism

1. **Add name label** on the selected segment if none (or always allow another instance — decide: one name-label per segment vs many). Recommendation: **at most one `role:'name'` per segment**; multiple segments of the same net may each have one.
2. Ensure **Add label** is obvious when a selected segment of a named net has no name label (including after split).
3. Optional small follow-on: when `splitSegmentAt` creates a piece with no name label while the net is named, **optionally** auto-`addNameLabel` on the unlabelled piece — only if product wants parity after T-junctions; otherwise explicit Add is enough for A1.

### Preserve

- D5c.5: name is join key; labels display net name via `labelText`.
- Segment-scoped P1 visibility.
- No automatic second net.

**Out of P5b:** renaming via label text editing; label-to-net ownership change; bus annotations.

---

## 8. Deferred — bus-width annotations

| Layer | Scope | Timing |
| --- | --- | --- |
| Graphical slash + free text on a wire | Generic annotation (HDL buses, channel counts, …) | Future wire-style / annotation track |
| Semantic bus width / type / port checks | HDL-Maker Studio | Later specialisation |

Compatible with existing layering: geometry ≠ persistent style ≠ application semantics ([style ADR](adr-diagram-geometry-routing-style.md)). **Not** an A1 acceptance blocker. **Do not implement** in P5.

---

## 9. Complexity estimate

| Slice | Complexity | Notes |
| --- | --- | --- |
| P5a free 2D offset | Low–medium | Model + `labelPlacement` / `placeLabelAt` + migrate `offset`; gesture mostly reuse |
| P5b add-on-segment / post-split clarity | Low–medium | UI + optional split policy; no net semantics change |
| Bus-width mark | Low–medium | Deferred |
| Semantic width checks | Higher | Studio |

---

## 10. Suggested acceptance tests (when implementing)

**P5a**

1. Vertical stub: drag label freely below and beside.  
2. Horizontal wire: free 2D placement.  
3. Block / stub / port / span / bend moves: label follows; shift preserved.  
4. No grid snap on label drag.  
5. Escape / Undo / Redo / save-load / duplicate.  
6. Legacy files with scalar `offset` look equivalent after migration.  
7. P1 visibility still works.

**P5b**

1. After T-junction split, unlabelled piece can receive a name label.  
2. Two segments of net Q can both show “Q”.  
3. Adding a label does not create a second net or rename.  
4. Deleting one label does not remove the other or the net.  
5. D5c.5 rename-join still updates displayed text on all name labels.

---

## 11. Recommended sequence

| Step | Status |
| --- | --- |
| P0–P4b | Accepted |
| **P5 investigation** | **This document — await freigabe** |
| P5a implementation | After release |
| P5b implementation | After release (can ship with P5a) |
| A1 final close-out | After P5 accept |
| A2 pilot | After A1 close-out |
| Bus-width annotation | Later (not A1 gate) |

---

## 12. Stop

Investigation and documentation only. **No code changes for P5.** Preserve S5b and D5d gates. No commit/push. Await explicit P5a/P5b implementation release.
