# D5c.6 — Shift+Drag duplicates a block

D5c.5 (connection-by-name + stubs) is accepted. This slice adds the standard **Shift + LMB-drag** gesture to duplicate blocks, using the same `duplicateBlocks` / history rules as D5c.3.

## 1. Status

| Item | Status |
| --- | --- |
| D5c.5 | Accepted (26 Nov 2026) |
| D5c.6 | Accepted by the user (26 Nov 2026) |
| D5c.7 | Spec-only (not this slice) |
| D5b.5 / D5b.6 | Locked |

## 2. Behaviour

| Gesture | Result |
| --- | --- |
| LMB-drag on block | Move (unchanged) |
| **Shift + LMB-drag** on block | Copy follows the pointer; originals stay; release = one history entry |
| Escape / cancel mid-gesture | No copy |
| Tiny Shift+drag (&lt; 4 px) | Cancel (avoids stacked copy on Shift-click) |
| Shift+drag on empty canvas | Still marquee-add (not duplicate) |
| Shift+drag on wire | Not supported |

Selection after commit moves to the new block ids. Internal wires whose both ends are in the selection are copied (D5c.3 rule).

## 3. Files

| File | Role |
| --- | --- |
| `interactionPolicy.ts` | `blockDragMode`, `duplicateDragMoved` |
| `DiagramStage.vue` | Duplicate mode on Vue Flow node-drag; rebind after preview |
| `transaction.ts` / `session.ts` | Each `preview` rebuilds from baseline (no stacked ghosts) |
| `selfcheck.ts` | Policy + multi-preview / commit / undo / cancel |

**Fix:** Shift+Drag briefly left permanent ghost blocks because `preview` mutated live state without restoring the baseline, so each pointer move called `duplicateBlocks` again. Preview now always re-applies from the gesture baseline.

## 4. Tests

| Command | Result |
| --- | --- |
| `npx tsx src/core/selfcheck.ts` | `selfcheck ok` |
| `npx vue-tsc --noEmit` | Exit 0 |

## 5. Acceptance checklist

5/5 — accepted 26 Nov 2026 (incl. ghost-preview fix)

1. Shift+Drag block → copy; original stays.  
2. Normal drag = move.  
3. Escape cancels (no copy).  
4. Undo / Redo.  
5. Selfcheck + vue-tsc green.

## 6. Boundaries

No wire Shift+Drag, no D5c.7 wire copy, no D5b.5/D5b.6, no commit/push/ZIP.
