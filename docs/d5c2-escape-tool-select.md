# D5c.2 — Escape returns to Select

D5c.1 is implemented. This slice adjusts Esc so users leave sticky tools without the toolbar. Full D5b.5 / D5b.6 stay locked.

## 1. Status

| Item | Status |
| --- | --- |
| D5c.1 | Implemented (label drag) |
| D5c.2 | Implemented; waiting for user acceptance |
| D5b.5 / D5b.6 | Locked |

## 2. Esc stack

Outside inputs (`typingTarget`):

1. **Overlay / symbol polygon draft** → dismiss / cancel (unchanged).
2. **Cancelable transient** (wire draft, merge draft, document gesture) → **cancel only**; tool unchanged.
3. Else if **tool ≠ `select`** → set tool to **Select**; **keep selection**.
4. Else if something is selected → **clear selection**.
5. Else → no-op.

Policy helper: `nextEscapeAction` in `interactionPolicy.ts`.

## 3. Guarantees

- Sticky tools and toolbar toggle unchanged.
- Undo-during-gesture = cancel only (unchanged).
- MMB / Space pan and wire-draft-over-pan unchanged.
- Esc in inputs still ignored.

## 4. Tests

| Command | Result |
| --- | --- |
| `npx tsx src/core/selfcheck.ts` | `selfcheck ok` |
| `npx vue-tsc --noEmit` | Exit 0 |

## 5. Re-acceptance checklist

0/6

1. Wire tool, no draft → Esc → Select; drawing stops.
2. Wire draft open → Esc → draft gone, still Wire; second Esc → Select.
3. Select + selection → Esc → selection empty.
4. Select, nothing selected → Esc no-op.
5. During block/port/label drag → Esc only cancels; tool unchanged.
6. Selfcheck + vue-tsc green.

## 6. Boundaries

No D5b.5 toolbar redesign. No D5b.6. No CL/EDU. No commit / push / ZIP from this phase.
