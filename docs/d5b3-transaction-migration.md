# D5b.3 — Migration to unified project transactions

D5b.2 is accepted. This note records the D5b.3 migration of productive document-changing operations onto the framework-free `TransactionManager`. D5b.3 is accepted by the user. Gesture robustness continues in [d5b4-interactive-gesture-transactions.md](d5b4-interactive-gesture-transactions.md).

## 1. Acceptance and cutover choice

| Item | Status |
| --- | --- |
| D5b.2 | Accepted |
| D5b.3 | Accepted by the user (tests A–C) |
| D5b.4 | Implemented; waiting for acceptance |
| D5b.5–D5b.6 | Locked |

**Chosen approach: Variant A** — full productive cutover in D5b.3, including a minimal gesture binding through the same manager.

Reason: sheet edits, project commands, and pointer gestures that already used `edits().begin/preview/commit` all record into one chronological stack. A dual-history intermediate (sheet history + project manager) is forbidden. Variant B (prepare paths without cutover) would leave the editor on the old stacks until D5b.4 and would not allow practical verification of the shared history in this phase.

D5b.4 hardens gesture cancel/Escape/blur/capture. No toolbar redesign (D5b.5).

## 2. ProjectStore adapter and ownership

Canonical project ownership stays on the Vue `project` ref inside `DiagramStage.vue`. No Pinia. No second live project copy outside the manager’s snapshot strings.

```typescript
function bindTransactions(created: DiagramProject): void {
  project.value = created
  transactions = new TransactionManager({
    get: () => {
      const current = project.value
      if (!current) throw new Error('The project is not open.')
      return current
    },
    set: (next) => {
      project.value = next
    },
  })
}
```

Rules enforced:

- Exactly one `TransactionManager` per open project.
- No manager per sheet; hierarchy navigation does not recreate the manager.
- `bindTransactions` on New / Load / sample install starts a new history.
- Snapshots are `serializeProject` strings — never Vue proxies.
- After undo/redo/cancel/transact, `rebindAfterProject()` resolves the active sheet and selections by stable ids via `resolveLocation` / `documentById`.

`TransactionManager` itself stays free of Vue imports (`diagram-lab/src/core/transaction.ts`).

## 3. Sheet adapter (no dual write)

While a project is open, `edits()` returns a duck-typed adapter instead of `EditSession`:

| Adapter method | Manager call |
| --- | --- |
| `execute(apply)` | `transact('Edit', …)` on the active sheet by id |
| `begin` / `preview` / `commit` / `cancel` | gesture API on the same manager |
| `undo` / `redo` | manager undo/redo (or cancel if gesturing) |
| `canUndo` / `canRedo` / `isGesturing` | manager flags |

`applyProject` also calls `manager.transact` and never discards a separate sheet stack.

Standalone lab sheets (Example, Net test, …) still use `sheetSession: EditSession`. That history is never used while a project is open.

## 4. Migration table

| Operation | Former entry | New entry | Transaction boundary | Touched objects | Tests | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Place palette / template block | `edits().execute` → `EditSession` | adapter `execute` → `transact` | One user place | sheet blocks/ports/symbols | selfcheck place + browser | Migrated |
| Delete / duplicate / group | `edits().execute` | adapter `execute` | One execute | sheet | inherited paths + mixed stack | Migrated |
| Move / resize / port drag / wire bend | `edits().begin/preview/commit` | adapter → manager gesture | One commit if content changed | sheet geometry | selfcheck resize patterns; browser resize via properties | Migrated (minimal); D5b.4 deepens |
| Property number/name fields | `edits().execute` | adapter `execute` | One change | sheet | browser width/height | Migrated |
| Draw / delete wire, net rename, labels | `edits().execute` | adapter `execute` | One execute | nets/segments/labels | selfcheck wire + refuse | Migrated |
| Symbol editor sheet edits | `edits().execute` / gesture | adapter | One step | symbols on that doc | path wired | Migrated |
| Open as (create implementation) | `applyProject` + old `ProjectSession` | `applyProject` → `transact` | One transaction; navigate separate | component, child doc, Boundary | selfcheck + browser | Migrated |
| Logical port add/rename/delete/reorder/bind | `applyProject` | `transact` | One atomic interface change | definition + instances + Boundary | selfcheck rename/refuse | Migrated |
| Place on sheet / new component / make unique / extract / expand / duplicate def | `applyProject` | `transact` | One command | project-wide | selfcheck place-second / mixed | Migrated |
| Navigation / open existing impl | no history | unchanged | None | UI location only | selfcheck nav depth | Unchanged |
| Standalone sheet (no project) | `EditSession` | still `EditSession` | Sheet-only | one document | regression | Kept |

No dual-write. No `discard()` of the central history after a project command. Project Undo/Redo toolbar buttons removed.

## 5. Remaining session classes

| Class / module | Productive role after D5b.3 |
| --- | --- |
| `TransactionManager` | Sole history owner for open projects |
| `EditSession` (`session.ts`) | Standalone non-project documents only; also used as the TypeScript shape the adapter mimics |
| `ProjectSession` (`project.ts`) | No longer constructed by `DiagramStage`; class kept for tests / legacy callers |
| `DocumentSessions` | Not used by the stage for projects |
| `navigate.ts` | History-neutral; may still inspect session flags in helpers — project path does not push history |
| Core mutation helpers | Unchanged; still return `ProjectResult` / mutate a draft sheet |

## 6. Lifecycle

| Event | Behaviour |
| --- | --- |
| New project / Load / install sample | `bindTransactions` — new manager, empty history, saved fingerprint set by `reset`/`holding` semantics as wired |
| Successful Save | `markSaved()` on the manager; history kept |
| Failed / aborted Save | saved fingerprint unchanged |
| Undo to saved fingerprint | clean; redo away → dirty |
| History | not written into the project file |
| Async save | local live fingerprint checked so a later edit is not marked saved |

## 7. Temporary Undo/Redo UI

- Single **Undo** / **Redo** buttons drive the shared manager when a project is open.
- Hint: `One undo history for this project. Sheet and component edits share it.`
- Separate Project undo/redo controls removed.
- No full toolbar redesign (D5b.5).
- Shortcuts continue to call the same `undo` / `redo` functions.

## 8. Navigation after restore

`rebindAfterProject` + `resolveLocation` repair the path when undo removes the active child diagram. Selections and port/segment ids that no longer exist are cleared. No extra history entries. Undo does not force a sheet change when the current document still exists.

## 9. Automatic tests

`diagram-lab/src/core/selfcheck.ts` D5b.3 block (adapter pattern mirroring the stage):

- Reference scenario: place → resize → add port → Open as → child place → boundary port → second instance → wire → rename → chronological undo/redo with full `serializeProject` equality
- Navigation adds no history entries
- Mixed sheet → project → sheet on one stack
- Wired logical delete refused; depth unchanged
- No-op after undo keeps redo; successful edit drops redo
- Save / dirty / undo-to-clean
- Digital+200 size note: blocks+ports ≈ 80 KB vs blocks-only ≈ 49 KB

Regression:

| Command | Result |
| --- | --- |
| `npx tsx src/core/selfcheck.ts` | `selfcheck ok` |
| `npx vue-tsc --noEmit` | Exit code 0 |

## 10. Browser checks (productive cutover)

Against `http://localhost:5174/`:

| Check | Result |
| --- | --- |
| New project | Empty root; shared-history hint visible |
| Place Generic block | Undo enabled; status confirms place |
| Resize via Width/Height properties | Status “Block updated.” |
| Open as → Block diagram | Child sheet; “This block now opens a diagram.” |
| Unified Undo/Redo | Project undo buttons absent; chronological undo to empty; redo restores |
| Undo while child was entered | Returns to root/empty without stranded Project history |
| Save | “Saved project Design.”; history retained (Redo still available after undo+save in session) |
| Wire / second instance / boundary port via UI | Covered primarily by selfcheck; UI Place-on-sheet/wire not exhaustively exercised in every browser pass |

Automatic tests and browser checks are recorded separately above.

## 11. Performance note (Digital+200)

| Fixture | Approx. size |
| --- | --- |
| D5b.1 Digital+200 (blocks **and** ports) | ~81 KB / measured now `79934` bytes |
| D5b.2 Digital+200 (blocks **only**) | ~49 KB / `48774` bytes |

Different fixtures caused the earlier discrepancy. No inverse-patch optimisation. Integration uses the same serialize/parse path as D5b.2; no extra Vue rebuild beyond restoring `project` / rebinding the active sheet.

## 12. Open integration risks (for D5b.4+)

1. Gesture cancel / Escape / mid-gesture navigation need deeper browser acceptance (D5b.4).
2. A missed raw mutation outside `edits()` / `applyProject` would bypass history — inventory was rechecked; keep watching.
3. Toolbar labels and shortcuts polish remain D5b.5.
4. Optional live-project freeze outside `transact` still deferred.

## 13. Boundaries respected

No Pinia; no DiagramStage rewrite beyond D5b needs; no toolbar redesign; no router/schema/libs/EditableDiagram/Vue-Flow upgrade; no HDL/FSM editors; no commit, push, or release ZIP.

## Status

- D5b.2 accepted
- D5b.3 accepted by the user
- D5b.4 waiting for acceptance
- D5b.5–D5b.6 locked
