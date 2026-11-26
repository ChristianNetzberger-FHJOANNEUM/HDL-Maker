# D5c.1 — Wire label drag

D5b.5b is accepted. This slice adds a UI drag gesture for segment-anchored wire name labels. Full D5b.5 toolbar polish and D5b.6 stay locked. CL/EDU remain planning-only.

## 1. Status

| Item | Status |
| --- | --- |
| D5b through D5b.5b | Accepted |
| D5c.1 | Implemented; waiting for user acceptance |
| D5b.5 / D5b.6 | Locked |

## 2. Behaviour

- In **Select**, grab a wire label hit circle and drag.
- Along the polyline → `edge` / `distance` (nearest edge on the **same** segment).
- Perpendicular to the edge → `offset` (signed; matches `pointOnEdge`).
- One history entry on commit; Escape / blur / undo-during-drag cancel and restore baseline.
- Staying on the same segment only — no free 2D placement, no jump to another segment.

### Hit priority (local)

1. Label hit (`.label-hit` / `.label-group`, drawn above wire strokes)
2. Port (incl. C3 handoff near port)
3. Wire `.hit` / span
4. Block / marquee

## 3. Implementation

| Piece | Role |
| --- | --- |
| `placeLabelAt` in `nets.ts` | Pointer → anchor update |
| `onLabelDown/Move/End/Cancel` in `DiagramStage.vue` | Document gesture + deferred commit |
| `.label-hit` in `style.css` | Grab target with `pointer-events: auto` under `.world` |

Core APIs kept: `moveLabelAlong`, `setLabelOffset`, `labelPlacement`. No schema change.

**Regression fix:** Label drag does not use `setPointerCapture` on the world SVG label group. Capture release after `pointerup` was cancelling the deferred commit via `lostpointercapture` (labels snapped back). Window listeners drive the gesture; `onLostPointerCapture` only cancels while a UI drag handle is still active.

## 4. Tests

| Command | Result |
| --- | --- |
| `npx tsx src/core/selfcheck.ts` | `selfcheck ok` |
| `npx vue-tsc --noEmit` | Exit 0 |

Selfcheck covers commit / undo / redo / cancel of `placeLabelAt` and segment identity.

## 5. Out of scope / follow-up

- Jumping the label to a **different** segment.
- Free `{ kind: 'free' }` placement.
- Renaming via double-click on the label (properties panel remains).

## 6. Re-acceptance checklist

0/7

1. Grab label and move along the wire; position sticks after release.
2. Move away from / toward the wire (`offset`).
3. Undo / Redo.
4. Escape during drag → original position.
5. Mid-span wire select and Wire-tool drawing still work.
6. Wired port drag (C3) and marquee unchanged.
7. Selfcheck + vue-tsc green.

## 7. Boundaries

No D5b.5 / D5b.6. No CL/EDU. No commit / push / ZIP from this phase.
