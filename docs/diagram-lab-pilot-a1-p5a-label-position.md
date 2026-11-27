# P5a — Free two-dimensional wire-label positioning

**Status:** **Functionally accepted** (27 Nov 2026 user report). P5b-Fix separate — [p5b-remove-label](diagram-lab-pilot-a1-p5b-remove-label.md).  
**Depends on:** P5 investigation accepted; P0–P4b accepted.  
**Related:** [diagram-lab-pilot-a1-p5-wire-label-investigation.md](diagram-lab-pilot-a1-p5-wire-label-investigation.md), [diagram-lab-pilot-a1-p3a-text-position.md](diagram-lab-pilot-a1-p3a-text-position.md), [diagram-lab-pilot-a1-presentation-findings.md](diagram-lab-pilot-a1-presentation-findings.md), [diagram-lab-application-pilots.md](diagram-lab-application-pilots.md), [final evaluation](diagram-lab-pilot-a1-final-evaluation.md).

---

## 1. Release decision

P5 investigation accepted. Root causes understood:

- Labels used a one-dimensional normal `offset` only.
- T-junction split keeps the existing label on one resulting segment (no auto second label).
- Canonical net identity remains correct.

**P5a** released, implemented, and functionally accepted. **P5b-Fix** (Remove name label) released after acceptance — see [p5b-remove-label](diagram-lab-pilot-a1-p5b-remove-label.md).

---

## 2. Summary

Wire name labels keep their **on-wire attachment** (`edge`, `distance`) and may carry an optional free **two-dimensional** offset `shift: { x, y }` in diagram units.

| Field | Role |
| --- | --- |
| `edge` / `distance` | Attachment on the owning segment (unchanged) |
| `offset` | Legacy signed **normal** offset — used only when `shift` is absent |
| `shift?: Point` | Free Δx/Δy from the attachment (P5a). When present, drawing ignores `offset` |

Dragging projects the pointer onto the same segment, then stores the residual as `shift` (attachment + residual). Labels may sit beyond either endpoint and on either side of horizontal/vertical wires. **No grid snapping** for label placement (diagram coordinates; independent of zoom).

**Reset label position** clears `shift` and restores `offset = 14` (`DEFAULT_NAME_LABEL_OFFSET`) on the current attachment — analogous to P3a Reset text position.

No separate label editing engine; no annotation framework; no bus-width marks; no P5b multi-segment label management.

---

## 3. Compatibility strategy

**Chosen strategy: optional `shift` with dual-path drawing (no document-wide migration).**

| Situation | Behaviour |
| --- | --- |
| Legacy JSON (no `shift`) | `segmentLabelPoint` uses `pointOnEdge(..., offset)` exactly as before |
| After first free drag | `placeLabelAt` writes `shift` and sets `offset: 0`; drawing uses attachment + `shift` |
| `setLabelOffset` (legacy API) | Clears `shift` so 1D normal offset applies again |
| Save without ever dragging | Round-trip omits `shift`; visual position unchanged |
| Reset | Deletes `shift`; default normal offset |

Requirements satisfied:

- No unexpected movement on load.
- No loss of existing label information.
- No unnecessary document-wide migration.
- New and existing labels remain editable.
- Save/load round-trip preserved.

---

## 4. Geometry during updates

| Operation | Label behaviour |
| --- | --- |
| Rigid stub / block translation | Attachment follows wire; `shift` preserved → label translates with geometry |
| Resize / port drag / free-end / bend / span / junction | Existing remapping updates `edge`/`distance` via attachment projection; **`shift` preserved** via object spread |
| Segment split (`splitSegmentAt`) | Label reassigned to nearer piece; `shift` kept; **no** automatic second label |
| Copy / duplicate | Full anchor (including `shift`) cloned onto the new segment |

**Non-rigid remapping note:** `reanchor` and split re-project the **on-wire attachment** (offset 0). The free `shift` is an absolute diagram delta from that attachment, not recomputed for new normals. After large non-rigid edits the absolute world position of the text may need a manual nudge; relative free placement is intentionally preserved.

Routing / wire model unchanged.

---

## 5. Gesture and history

Reuses the existing label-drag path (P3a-style):

- Baseline-derived `preview` each move (no accumulated pointer-delta drift).
- Exact initial position at drag start (gesture baseline).
- One shared history entry per completed **effective** drag (`EditSession.commit` skips serialize-equal docs).
- Escape / cancel restores the original position.
- Undo/Redo restores exact anchors including `shift`.
- P1 visibility controls unchanged.

Properties (selected wire): **Reset label position** (`data-reset-label-position`), enabled when the segment’s labels have a `shift` or a non-default `offset`.

---

## 6. Changed files

| File | Change |
| --- | --- |
| `diagram-lab/src/core/document.ts` | Optional `LabelAnchor.shift?: Point` + comments |
| `diagram-lab/src/core/geometry.ts` | `segmentLabelPoint`; `labelPlacement` uses dual path |
| `diagram-lab/src/core/nets.ts` | `placeLabelAt` writes 2D `shift`; `resetLabelPosition`; `setLabelOffset` clears `shift`; `DEFAULT_NAME_LABEL_OFFSET` |
| `diagram-lab/src/view/DiagramStage.vue` | Drag origin/changed includes `shift`; Reset UI |
| `diagram-lab/src/core/selfcheck.ts` | P5a cases |
| Docs | This file; pilots; findings; handoff |

---

## 7. Automated verification

```bash
cd diagram-lab
npx tsx src/core/selfcheck.ts
npx vue-tsc --noEmit
```

Selfcheck coverage: legacy omit-`shift` round-trip; free 2D beyond tip; horizontal free offset; rigid move; duplicate copies `shift`; reset + undo.

---

## 8. Manual acceptance (A1 counter)

1. Position EN below its vertical stub.  
2. Position CLK below its vertical stub.  
3. Position RST below its vertical stub.  
4. Move Q freely in both dimensions.  
5. Position labels beyond wire endpoints.  
6. Move labels with grid snapping enabled (labels must **not** snap).  
7. Move labels at different zoom levels.  
8. Move a block with attached labelled stubs.  
9. Resize a block and reposition a port.  
10. Verify Undo/Redo and Escape.  
11. Verify save/load and duplication.  
12. Reset a label to its default position.  
13. Verify legacy document appearance (unchanged until a label is freely moved).

---

## 9. Known limitations

- Explicit Add / Remove of name labels per segment is covered by **P5b-Fix** (not this doc’s stop gate).
- T-junction split still does not auto-create a second label (by design; use explicit Add).
- Non-rigid geometry may leave free `shift` looking odd relative to a new wire direction until the user nudges or resets.
- No collision avoidance, auto-placement, or bus-width annotations.

---

## 10. Scope restrictions (honoured)

P5a only. No P5b. No general annotation framework, wire styling, bus-width, standalone text, automatic placement, collision avoidance, routing changes, unrelated refactoring, performance work, roadmap renumbering, commit, or push. S5b and D5d gates preserved.

---

## 11. Closure note

P5a accepted. P5b accepted. **A1 formally closed** — [final evaluation](diagram-lab-pilot-a1-final-evaluation.md).
