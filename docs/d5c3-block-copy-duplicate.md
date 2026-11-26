# D5c.3 — Block copy / paste / duplicate (flat)

D5c.2 Esc→Select is in place. This slice makes **every selected block** reliably copyable and duplicatable without needing a sub-hierarchy or “Place on sheet”.

## 1. Status

| Item | Status |
| --- | --- |
| D5c.3 | Accepted by the user (26 Nov 2026) |
| D5c.4–D5c.6 | Not started |
| D5b.5 / D5b.6 | Locked |

## 2. Behaviour

| Action | Shortcut / UI | Result |
| --- | --- | --- |
| Copy | Ctrl/Cmd+C | Internal clipboard (`captureFragment`); paste counter reset |
| Paste | Ctrl/Cmd+V | New block ids; offset `GRID × pasteCount` so repeats do not stack |
| Duplicate | Ctrl/Cmd+D / Duplicate button | `duplicateBlocks` / `duplicateGroup` with `GRID` offset; one history entry |

- Works for **flat** Note/Process/Decision blocks and for symbol / component instances on the sheet.
- Copies only wires whose **both** ends lie in the selection (existing rule).
- Hierarchy **Place on sheet** is unchanged and separate.
- Undo/Redo via the shared project / sheet history.

## 3. Files

| File | Role |
| --- | --- |
| `diagram-lab/src/view/DiagramStage.vue` | Paste stacking; clearer status; clip cleared on load |
| `diagram-lab/src/core/edit.ts` | Paste preserves label `role` |
| `diagram-lab/src/core/selfcheck.ts` | D5c.3 flat + wired-pair + undo/redo |

Core APIs: `captureFragment`, `pasteFragment`, `duplicateBlocks` (unchanged semantics).

## 4. Tests

| Command | Result |
| --- | --- |
| `npx tsx src/core/selfcheck.ts` | `selfcheck ok` |
| `npx vue-tsc --noEmit` | Exit 0 |

## 5. Acceptance checklist

5/5 — accepted 26 Nov 2026

1. Flat block → Copy → Paste → second instance (visible offset).
2. Ctrl/Cmd+D → duplicate; select moves to the copy.
3. Undo / Redo.
4. Block with under-hierarchy / Place on sheet still works as before.
5. Selfcheck + vue-tsc green.

## 6. Boundaries

No wire copy, no Shift+Drag (D5c.6), no D5b.5/D5b.6, no CL/EDU, no commit/push/ZIP.
