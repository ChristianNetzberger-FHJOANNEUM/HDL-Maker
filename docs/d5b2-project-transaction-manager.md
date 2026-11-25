# D5b.2 — Project transaction manager

D5b.1 is accepted. Variant A (full project snapshots) is binding. This note records the D5b.2 core implementation. D5b.2 is accepted. D5b.3 wires the manager into `DiagramStage.vue` ([d5b3-transaction-migration.md](d5b3-transaction-migration.md)). D5b.4–D5b.6 stay locked.

## Module

`diagram-lab/src/core/transaction.ts`

No imports from Vue, Vue Flow, DOM, or view code. Depends only on `DiagramProject` and `serializeProject` / `parseProject`.

## Ownership

```typescript
export interface ProjectStore {
  get(): DiagramProject
  set(project: DiagramProject): void
}
```

`TransactionManager` does not own the Vue layer. A `ProjectStore` supplies the live project. Tests use `TransactionManager.holding(project)`, which keeps a plain box. D5b.3 passes a store that reads and writes the stage’s `project` ref.

The live object graph is whatever `store.get()` returns. History never retains those objects.

## Snapshot representation

| Item | Choice |
| --- | --- |
| Encoding | UTF-8 JSON from `serializeProject` |
| Restore | `parseProject` → new object graph |
| Stored fields | `schemaVersion`, `id`, `name`, `rootDocumentId`, `documents`, `components`, `extra` |
| Not stored | UI state, selection, viewport, navigation, gesture baselines as objects, the history itself |

Each history entry is `{ snapshot: string; label: string }`. Strings are immutable in practice; undo/redo always `parseProject` into a **new** graph before `store.set`, so retired live objects cannot alias into the next restore.

## API signatures

```typescript
export type TransactionLabel = string
export type TransactResult<T> = { ok: true; value: T } | { ok: false; message: string }
export type ApplyOutcome<T> =
  | DiagramProject
  | { ok: true; project: DiagramProject; value: T }
  | { ok: true; value: T }
  | { ok: false; message: string; project?: DiagramProject }

export class TransactionManager {
  constructor(store: ProjectStore, options?: { limit?: number })
  static holding(project: DiagramProject, options?: { limit?: number }): TransactionManager

  readonly project: DiagramProject
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly isDirty: boolean
  readonly isGesturing: boolean
  readonly labelUndo: string | null
  readonly labelRedo: string | null
  readonly historyLimit: number
  readonly undoDepth: number
  readonly redoDepth: number

  setLimit(limit: number): void
  transact<T = undefined>(label: TransactionLabel, apply: (project: DiagramProject) => ApplyOutcome<T>): TransactResult<T>
  begin(label: TransactionLabel): TransactResult<undefined>
  preview(apply: (project: DiagramProject) => void): TransactResult<undefined>
  commit(): boolean
  cancel(): void
  undo(): TransactResult<undefined>
  redo(): TransactResult<undefined>
  markSaved(): void
  resetHistory(): void
  reset(project: DiagramProject): void
  snapshotByteLength(): number
}
```

`apply` may return a bare project, a valued success (with optional `project`, defaulting to the draft), a `ProjectResult`-shaped success, or `{ ok: false, message }`. Existing core helpers that return `ProjectResult<T>` work unchanged.

## State machine

```
idle ──transact──► idle          (one entry if content changed)
idle ──begin────► gesturing
gesturing ──preview──► gesturing
gesturing ──commit───► idle      (one entry if content changed)
gesturing ──cancel───► idle      (restore baseline; redo kept)

Refused (ok: false, no side effect on history unless noted):
- begin while gesturing or inside transact
- preview / commit without begin (commit → false)
- cancel without begin (no-op)
- nested transact
- transact / undo / redo while gesturing
- undo / redo while inside transact
```

### `transact`

1. Refuse if gesturing or `depth > 0`.
2. `before = serializeProject(live)`.
3. `draft = parseProject(before)` (isolated).
4. Run `apply(draft)` under `depth = 1`.
5. On throw or `ok: false`: live unchanged, history unchanged, redo unchanged.
6. On success: if `serializeProject(result) === before`, treat as no-op (no entry, live object kept).
7. Else push `{ before, label }`, clear future, trim, `store.set(parseProject(after))`.

No-op detection is **content** equality of serialized projects, not reference equality.

### Gestures

- `begin` stores a baseline string and label.
- `preview` mutates the **live** project in place (same pattern the stage uses today).
- Preview exceptions restore the baseline, clear the gesture, and do **not** clear redo.
- `commit` compares live serialize to baseline; no-op restores a clean parse of the baseline and adds no entry; otherwise one past entry, future cleared.
- `cancel` restores baseline; **future is preserved**.

### Undo / redo

Push the opposite direction’s serialize of the current live project, then parse the entry. Always a new graph.

## Dirty / saved state

`savedFingerprint` is the `serializeProject` string from the last `markSaved()` or `reset(project)`.

`isDirty` ↔ `serializeProject(live) !== savedFingerprint`.

Consequences:

- Not a history index.
- Undo back to the saved content → clean.
- Redo or edit away → dirty.
- `markSaved` does not touch past/future.
- Evicting old undo entries does not change the fingerprint.
- A redo branch that diverges from the saved content stays dirty even if depths look similar.

## History limit

Default **40** undo entries (`past.length`). Configurable via constructor option or `setLimit`.

- The live project is not an entry.
- Pushing past the limit drops the **oldest** past entry (`shift`).
- Future is cleared on a new successful document change; it is not separately capped in D5b.2.
- Limit changes only trim `past`; they do not mutate the live project.

## Tests

Covered in `diagram-lab/src/core/selfcheck.ts` (D5b.2 block):

- Init, transact, undo/redo, labels, empty bounds
- No-op same draft / no-op new reference / refuse / exception
- Snapshot isolation (mutate retired live graph)
- Gesture preview/commit/cancel/no-op/error; invalid transitions
- Nested transact refused; outer still commits
- Redo branch; no-op and failed edit keep redo
- Dirty / markSaved / undo-to-saved / branch after save
- Limit eviction; resetHistory; reset
- Hierarchy chain on one manager: Open as, sheet rename, add/rename interface port, place second instance, wire, refused wired delete, full undo/redo byte equality

All prior D0–D5a.3c checks still run in the same file.

## Performance (manager path)

Measured inside selfcheck (`d5b2-perf` log). Times are mean over 20 manager transact/undo/redo calls that touch `project.extra`. Serialized bytes are one snapshot; “hist40” is 40× that size (not measured JS heap).

| Project | Snapshot bytes | 40 × bytes | transact ms | undo ms | redo ms |
| --- | --- | --- | --- | --- | --- |
| empty | 319 | 0.013 MB | ~0.013 | ~0.006 | ~0.006 |
| sample | 3 341 | 0.134 MB | ~0.10 | ~0.05 | ~0.05 |
| digital | 33 974 | 1.359 MB | ~1.5 | ~0.64 | ~0.56 |
| signal | 25 320 | 1.013 MB | ~0.82 | ~0.41 | ~0.40 |
| general | 8 988 | 0.360 MB | ~0.29 | ~0.14 | ~0.16 |
| digital+200 blocks | 48 774 | 1.951 MB | ~1.6 | ~0.80 | ~0.80 |

Heap consumption of 40 retained strings is not instrumented here; treat “hist40” as a lower bound on retained serialized data only.

## Open points (resolved in D5b.3 / deferred)

1. ~~Replace `applyProject` / project-mode `edits()` with this manager~~ — done in D5b.3.
2. `EditSession` kept for no-project lab sheets.
3. No productive dual write after D5b.3 cutover.
4. Minimal gesture binding on the manager in D5b.3; D5b.4 deepens robustness and acceptance.
5. Optional: relocate project ownership out of `DiagramStage.vue` — deferred; Vue ownership kept.
6. Toolbar unification stays D5b.5.

## Status

- D5b.1: accepted
- D5b.2: accepted
- D5b.3: accepted by the user
- D5b.4: implemented, waiting for acceptance
- D5b.5–D5b.6: locked
