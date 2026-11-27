# P4a — Consistent geometry snapping

**Status:** **Function confirmed** by user (27 Nov 2026) — consistent block/wire snapping.  
**Depends on:** P4 **accepted**; investigation [p4a-geometry-snapping-investigation](diagram-lab-pilot-a1-p4a-geometry-snapping-investigation.md) accepted.  
**Related:** [p4-grid-snap](diagram-lab-pilot-a1-p4-grid-snap.md), [s5b stub endpoint](d5d0a-s5b-stub-endpoint-drag.md), [p4b preferences investigation](diagram-lab-pilot-a1-p4b-preferences-investigation.md).

---

## 1. Summary

Extended the existing `snapValue` / `GRID=20` policy to the remaining free wire geometry ops. No second algorithm, no schema change, no freehand quantization.

| Operation | Before | After |
| --- | --- | --- |
| Block / port / free-end / span | Already snapped (span on commit) | Unchanged |
| Wire free bends | No | Snap after hit-test |
| Stub finish | No | Snap free tip |
| Bend drag | No | **Preview** snap (axis) |
| Junction drag | No | **Preview** snap (x,y) |
| Wire labels / P3a text | Free | Unchanged |
| Freehand → Convert | No | Still deferred |

---

## 2. Constraint priority

1. Explicit port / junction / segment / end hit (`snapTarget`) — exact anchors.  
2. Orthogonal routing (`orthogonalTo` / existing span–bend rules).  
3. Grid snap of **free** coordinates only (`snapFreeHit` / `gridSnapPoint`).

Off-grid ports keep exact attachment; intermediate free points may sit on-grid. Enabling Snap does not rewrite existing geometry.

---

## 3. Preview vs commit

| Gesture | Preview | Commit |
| --- | --- | --- |
| Wire rubber-band / free click | Free hover snapped; connection hits exact | Same points committed |
| Stub finish | — | Snapped tip |
| Bend drag | Snapped axis each move | Commits preview (no release jump) |
| Junction drag | Snapped position each move | Commits preview |
| Free-end (S5b) | Already preview-snapped | Unchanged |
| Span | Live continuous; snap on commit only | Unchanged (explicit exclusion) |

---

## 4. Changed files

| File | Change |
| --- | --- |
| `diagram-lab/src/view/DiagramStage.vue` | `gridSnapPoint`, `snapFreeHit`, `wireHoverFromWorld`; wire / bend / junction paths |
| `diagram-lab/src/core/selfcheck.ts` | P4a cases |
| Docs | This file; investigation; pilots; handoff; P4 acceptance |

---

## 5. Automated

| Check | Result |
| --- | --- |
| `vue-tsc --noEmit` | **Pass** |
| `npm run selfcheck` | **Pass** (incl. P4a) |

---

## 6. Manual acceptance (A1)

1. Wire drawing with Snap on — free bends on grid.  
2. Snap off — free placement.  
3. Stub finish on / off.  
4. Bend drag on / off (preview matches release).  
5. Junction drag on / off.  
6. Snap on with **grid hidden**.  
7. Connect to off-grid port — stays attached; no unintended diagonals.  
8. Connect to existing junction — exact.  
9. Orthogonality preserved.  
10. Escape cancel.  
11. Undo / Redo.  
12. Labels + display text still freely movable.  
13. Multiple zoom levels.  
14. Toggle Snap — no retroactive geometry change.

---

## 7. Limitations

- Span drag still snaps only on commit (not preview).  
- Freehand → Convert not grid-quantized.  
- Property-panel numeric edits bypass snap.  
- S5b / D5d gates preserved. No commit/push.

---

## 8. Acceptance notes

| Area | Status |
| --- | --- |
| Consistent snapping blocks + wires (user) | **Confirmed** |
| Full 14-point checklist item-by-item | Not exhaustively re-signed; treat unverified rows as open if regressions appear |
| Automated selfcheck / vue-tsc at release | Pass (distinct from manual acceptance) |

P4/P4a no longer block P4b preparation.
