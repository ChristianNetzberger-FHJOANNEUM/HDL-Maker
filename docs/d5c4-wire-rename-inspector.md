# D5c.4 — Wire rename inspector

D5c.3 (block copy/paste/duplicate) is accepted. This slice makes a **selected wire** editable in the right-hand properties column, analogous to block **Name**.

## 1. Status

| Item | Status |
| --- | --- |
| D5c.3 | Accepted (26 Nov 2026) |
| D5c.4 | Accepted by the user (26 Nov 2026) |
| D5c.5–D5c.7 | Not started / spec-only |
| D5b.5 / D5b.6 | Locked |

## 2. Behaviour

| Action | Result |
| --- | --- |
| Select a wire (span / bend / name-label) | Right column shows **Wire** with editable **Name**, read-only net id, and a short net summary |
| Change Name (blur/change) | One history entry via `renameNet`; sheet labels update through `labelText` |
| Empty / whitespace-only | **Refused**; input restored; status explains |
| Same name as another net | **Superseded by D5c.5:** rename now **joins** into the existing net. |

D5c.4 shipped clash-without-join. **D5c.5** makes same sheet name mean one net (rename-join + stub reuse). See [d5c5-connection-by-name.md](d5c5-connection-by-name.md).

Block / port inspector layout and fields are unchanged when a block or port is selected.

## 3. Name rule

1. Trim leading/trailing whitespace.
2. After trim, empty → reject (keep previous name).
3. Unchanged after trim → no transaction.
4. Otherwise write `net.name`; name-role labels read it via `labelText`.

## 4. Files

| File | Role |
| --- | --- |
| `diagram-lab/src/core/nets.ts` | `renameNet` returns `RenameNetResult`; empty refuse (join semantics → D5c.5) |
| `diagram-lab/src/view/DiagramStage.vue` | Wire inspector at top of properties; `commitNetName` validation |
| `diagram-lab/src/core/selfcheck.ts` | D5c.4 rename / empty / clash / undo / redo |

## 5. Tests

| Command | Result |
| --- | --- |
| `npx tsx src/core/selfcheck.ts` | `selfcheck ok` |
| `npx vue-tsc --noEmit` | Exit 0 |

## 6. Acceptance checklist

5/5 — accepted 26 Nov 2026

1. Wire select → Name visible in the right column.
2. Change → sheet labels + persistence.
3. Undo / Redo.
4. Block inspector unchanged when a block is selected.
5. Selfcheck + vue-tsc green.

## 7. Boundaries

No open stub gesture (D5c.5), no Shift+Drag (D5c.6), no wire-copy (D5c.7), no D5b.5/D5b.6, no CL/EDU, no commit/push/ZIP.
