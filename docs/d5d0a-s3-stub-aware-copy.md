# S3 — Stub-aware block copy

**Status:** **Accepted** (26 Nov 2026) with documented verification proviso for B4–B6 (covered by selfcheck).  
**Depends on:** D5d.0-A stub-move; D5c.3 / D5c.5 / D5c.6.  
**Follow-on:** S4 Resize / Port Drag — [d5d0a-s4-stub-resize-port-drag.md](d5d0a-s4-stub-resize-port-drag.md).

## User acceptance

| Metric | Result |
| --- | --- |
| Manually verifiable | **15/15 passed** |
| Failed | **0** |
| Not manually verifiable | **3** (B4, B5, B6) |
| Open | **0** |

| Group | Result |
| --- | --- |
| A — Copy operations | 5/5 |
| B — Geometry / net semantics | 3/6 manual + 3 selfcheck |
| C — Gestures / history | 5/5 |
| D — Persistence | 2/2 |

### Automated coverage for B4–B6 (confirmed)

| Case | Selfcheck assertion(s) |
| --- | --- |
| **B4** Unrelated same-name stubs not copied | `S3 B4: unrelated same-name stub on B is not copied/moved` |
| **B5** External Port↔Port excluded | `S3 B5: only three stub segments…`, `S3 B5: copied block has no remapped external…`, `S3 B5: captureFragment excludes external…` |
| **B6** Internal Port↔Port preserved | `S3 B6: multi-block copies internal Port↔Port + one stub once`, `S3 B6: internal Port↔Port preserved (original + copy)`, `S3 B6: copied internal wire remaps to both copied blocks` |

`npx tsx src/core/selfcheck.ts` → `selfcheck ok` (includes the above).

## Behaviour

Selecting a **block** is enough. Attached Port↔Free / Free↔Port stubs (any bend count) and their segment labels are included in the **implicit copy closure** for Copy/Paste, Duplicate, and Shift+Drag.

Named stubs **join** sheet nets by name (D5c.5). External trunks and unrelated same-name stubs are excluded. No ownership model.

**HDL note:** name-join can create multiple drivers; Lab does not add HDL DRC.

## Architecture

`duplicateBlocks` / `captureFragment` / `pasteFragment` in `edit.ts`; `attachedStubsForBlocks` + `ensureNetByName`.
