# D5b.1 — Unified transactional undo/redo architecture

D5a.3 is accepted by the user. D5a is complete. D5b is released. This document is the D5b.1 inventory and specification. Variant A (project snapshots) is binding after architecture acceptance.

The D5b.2 core manager is recorded in [d5b2-project-transaction-manager.md](d5b2-project-transaction-manager.md). D5b.3 wires it into the editor; see [d5b3-transaction-migration.md](d5b3-transaction-migration.md).

The earlier note [diagram-transaction-architecture.md](diagram-transaction-architecture.md) records why two stacks exist and the loss cases. This file supersedes it as the binding plan for D5b.

## 1. Acceptance and scope

| Item | Status |
| --- | --- |
| D5a.3a / D5a.3b / D5a.3c | Accepted by the user |
| D5a | Complete |
| D5b | Released |
| D5b.1 | Architecture accepted; Variant A binding |
| D5b.2 | Accepted |
| D5b.3 | Accepted by the user ([d5b3-transaction-migration.md](d5b3-transaction-migration.md)) |
| D5b.4 | Gesture robustness implemented; waiting for acceptance ([d5b4-interactive-gesture-transactions.md](d5b4-interactive-gesture-transactions.md)) |
| D5b.5–D5b.6 | Locked |

D5b.1 does not change the document model, the schema, the editor behaviour, or the UI. It analyses the code that is in `diagram-lab` today and specifies the target.

## 2. Proven inventory of the current architecture

Statements below are taken from the source. Guesses are marked as such.

### 2.1 Sheet history — `EditSession`

File: `diagram-lab/src/core/session.ts`.

- `past` and `future` hold JSON strings from `serialize(document)`.
- Cap: `LIMIT = 40`. Oldest past entry is dropped with `shift()`.
- `execute(apply)`: if a gesture is open, commits it; pushes a before-snapshot; clears future; mutates the live document in place.
- Gesture: `begin` stores a before-snapshot string; `preview` mutates the live document; `commit` pushes that before-snapshot only when the document JSON changed; `cancel` restores with `parseDocument(gesture)`.
- `undo` / `redo` swap through serialize/parse. Undo during a gesture cancels instead.
- `load` clears both stacks and replaces the document.

There is no command object and no patch. The unit is a full document snapshot string.

### 2.2 Project history — `ProjectSession`

File: `diagram-lab/src/core/project.ts` (class from line 155).

- `past` and `future` hold JSON strings from `serializeProject(project)`.
- Cap: 40 entries.
- `transact(apply)`: reads the live project; calls `apply(before)`; if the returned object is `=== before`, returns `false` and adds no step; otherwise pushes the before-snapshot, clears future, replaces the project.
- Refusal is identity equality, not structural equality. Project commands clone first (`JSON.parse(JSON.stringify(project))` in `interface.ts`, `component.ts`, `hierarchy.ts`) and return the clone only on success, or the same input object on failure.
- History is not written to the project file. `clear()` empties both stacks when another project is opened.

### 2.3 Ownership and lifetime — `DocumentSessions` and the Vue stage

Files: `diagram-lab/src/core/navigate.ts` (`DocumentSessions`, from line 235); `diagram-lab/src/view/DiagramStage.vue`.

- There is **no Pinia**. Canonical state is Vue `ref`s in `DiagramStage.vue`: `project`, `doc`, navigation, selection, viewport.
- With a project open, `edits()` returns `documentSessions.get(doc.value.id)`.
- `DocumentSessions` keeps one `EditSession` per document id. Two navigation paths that open the same implementation share that session (proven in selfcheck D4b).
- The session's `replace` writes the document back into `project.documents[index]` in place, and updates `doc` when that sheet is on screen.
- After every successful project transaction, and after project undo/redo, `rebindAfterProject()` calls `documentSessions.discard()`. All sheet stacks are dropped. The status line says so when any sheet stack had pending steps.
- Without a project (`New` sheet / Example / Symbols), `sheetSession` is a lone `EditSession` on `doc`.

Navigation (`showLocation`, `descend`, tree, breadcrumbs, Back/Forward) does not push sheet or project history. It has its own `navPast` / `navFuture` for UI path history only.

### 2.4 Transaction boundaries today

| Kind | Boundary | Storage |
| --- | --- | --- |
| Instant sheet edit | One `EditSession.execute` | Document JSON before |
| Gesture | `begin` → many `preview` → one `commit` or `cancel` | Document JSON at begin |
| Project command | One `ProjectSession.transact` via `applyProject` | Project JSON before |
| Refused project command | Same object returned | No entry |
| Unchanged gesture commit | Serialize equal to begin | No entry |
| Preview/extract/expand plans | Pure functions | No entry until confirm |

`applyProject` in `DiagramStage.vue` (around line 920): cancels any open gesture, runs `projectSession.transact`, then `rebindAfterProject()`. A failed `ProjectResult` returns the same project and sets a status message.

### 2.5 Mutation style

- **Sheet helpers** (`edit.ts`, `nets.ts`, `commands.ts`, `geometry.ts`, `symbols.ts`): mutate `DiagramDocument` in place. IDs for new objects come from `createId` at mutation time.
- **Project helpers** (`interface.ts`, `component.ts`, `hierarchy.ts`): clone the project, mutate the clone, return `{ ok, project, value }` or `{ ok: false, project: original, message }`.
- Sheet edits therefore change the live project documents **before** the next project snapshot is taken. That is why a project undo can erase a later sheet edit that never had its own project history entry (proven loss case; also recorded in [diagram-transaction-architecture.md](diagram-transaction-architecture.md)).

### 2.6 Save, load, new project

- **Save**: `JsonProjectStorage.save` plus browser download. Does not clear history. There is no explicit dirty flag; history length is the only implicit “unsaved work” signal, and it is not shown as dirty UI.
- **Reload / Load file / New project / Digital / Signal / General / Project sample**: replace the project, `documentSessions.discard()`, `projectSession.clear()`, reset navigation memory.
- History is session-only. Reload after save clears both stacks (proven in UI: Project undo disabled after Reload).

### 2.7 Nested operations and failures

- Nested `EditSession.execute` during a gesture forces `commit` first.
- Project commands are not nested. `applyProject` is the only UI entry; core functions are pure relative to the session.
- Failed project ops leave the original project object. Failed sheet ops that throw would leave a partial in-place mutation; current UI paths avoid throwing after the snapshot push (assumption based on reviewed call sites; not exhaustively proven for every helper).

### 2.8 Performance measurements (D5b.1)

Measured with a one-off script against `serializeProject` / `parseProject` (not changing product mutation paths):

| Project | Bytes | Docs | Components | 40× snapshots | Round-trip ms |
| --- | --- | --- | --- | --- | --- |
| Empty | 319 | 1 | 0 | 0.013 MB | 0.019 |
| Sample | 3 341 | 3 | 3 | 0.134 MB | 0.066 |
| Digital System | 33 974 | 7 | 6 | 1.359 MB | 0.682 |
| Signal Processing | 25 320 | 5 | 4 | 1.013 MB | 0.421 |
| General Diagram | 8 988 | 1 | 0 | 0.360 MB | 0.184 |
| Digital + 200 extra blocks | 81 334 | 7 | 6 | 3.253 MB | 1.253 |

Existing selfcheck bench (large sheet, not a multi-document project): `perf bytes=198390 … undoMs≈1.4 redoMs≈1.1` with 50 blocks / 350 segments.

**Proven:** full project snapshots at current lab sizes are cheap (sub‑millisecond to ~1 ms) and fit in a few megabytes for 40 steps. **Not proven:** behaviour with multi‑megabyte embedded bitmaps or thousand-block industrial sheets; D5d may revisit representation.

## 3. Mutation inventory

Legend for “Current undo”: Sheet = `EditSession`; Project = `ProjectSession` via `applyProject`; None = no history entry; Preview = no mutation until confirm.

### 3.1 Sheet operations

| Operation | Entry (`DiagramStage.vue` / core) | Objects | Current undo | Current boundary | Risk | Future boundary |
| --- | --- | --- | --- | --- | --- | --- |
| Place symbol / palette block | `placeFromPalette`, `addBlock` / `instantiateSymbol` | blocks, ports, symbols, assets | Sheet | One execute | Shared symbol def mutated on that document | One project transaction |
| Delete blocks | `deleteBlocks` | blocks, ports, segments, nets | Sheet | One execute | Orphan nets pruned | One transaction |
| Move blocks | drag begin/preview/commit | block x/y, wire geometry | Sheet gesture | One commit | Mid-gesture navigate cancels | One transaction on commit |
| Resize block | resize begin/preview/commit | width/height, wire ends | Sheet gesture | One commit | Same | One transaction on commit |
| Duplicate / paste | `duplicateBlocks`, `pasteFragment` | blocks, ports | Sheet | One execute | Component instances: unbound pins skipped | One transaction |
| Group / ungroup | `groupBlocks`, `ungroup` | groups | Sheet | One execute | Groups not drawn | One transaction |
| Add port (generic) | `addPortAt` | port | Sheet | One execute | | One transaction |
| Add port (logical, instance or Boundary) | `addInterfacePort` via confirmPort | component + all instances + Boundary | **Project** | One transact | Sheet history cleared | One transaction (unchanged intent) |
| Move / place port | `placePort` drag or properties | port side/t/placed, wires | Sheet / gesture | One commit or execute | | One transaction |
| Rename instance port (generic) | `renameInstancePort` | port name | Sheet | One execute | | One transaction |
| Rename logical port | `renameInterfacePort` | definition + all copies | Project | One transact | | One transaction |
| Delete port (generic / dangling) | `removeUnwiredPort` | port | Sheet | One execute | Wired refused | One transaction |
| Delete logical port | `removeInterfacePort` | definition + copies | Project | One transact; refused if wired | Atomic refuse proven | One transaction |
| Draw wire | `commitWire` / wire tool | nets, segments, labels | Sheet | One execute | | One transaction |
| Delete segment | `deleteSegment` | segments, nets | Sheet | One execute | | One transaction |
| Bend / span / junction drag | nets helpers via gesture | segment points, junctions | Sheet gesture | One commit | | One transaction on commit |
| Rename net / add label / set routed | `renameNet`, `addNameLabel`, `setRouted` | nets, labels, segments | Sheet | One execute | | One transaction |
| Freehand stroke / adopt wire | `addStroke`, `adoptWire` | strokes, segments | Sheet | One execute | | One transaction |
| Symbol editor edits | `runSymbol` / previewSymbol | symbols, assets | Sheet (same document) | execute or gesture | Affects all instances of that symbol on that doc | One transaction |
| Library import into document | palette / update confirm | symbols, assets | Sheet or project path | Varies | Compare/update is explicit | One transaction |

### 3.2 Project operations

| Operation | Entry | Objects | Current undo | Boundary | Risk | Future |
| --- | --- | --- | --- | --- | --- | --- |
| Open as → Block diagram | `openAsDiagram` / `confirmOpenAs` | component, child document, Boundary, bindings | Project | One transact | Then navigates; navigation not in history | One transaction; navigate separately |
| New component | `addComponent` | components | Project | One | | One |
| Create implementation | `createImplementation` | document + component.impl | Project | One | | One |
| Place on sheet | `instantiateComponent` | block, ports | Project | One | Cover logical ports; release unbound | One |
| Duplicate definition | `duplicateComponent` | component + document copy | Project | One | New ids | One |
| Delete component | `removeComponent` | component, unused doc | Project | One | Instances may remain diagnosed | One |
| Rename component | `renameComponent` | component name | Project | One | Instance names stay | One |
| Make unique | `makeUnique` | new component, retarget block | Project | One | | One |
| Extract / expand | `extractComponent`, `expandComponent` | multi-doc | Project | One after preview | Preview is None | One |
| Interface add/rename/reorder/bind/pin | `interface.ts` | ports everywhere | Project | One | Wired delete refuse | One |
| Bidirectional sync | same commands | definition, instances, Boundary | Project | One | Must stay atomic | One |

### 3.3 Explicit non-mutations (must stay out of history)

Selection, hover, zoom, pan, tool mode, marquee without delete, navigation between existing diagrams, open/close Open-as menu without confirm, extract/expand preview without confirm, tree expand, panel focus, snap toggle (UI only until an edit uses it), library list without placing.

**Open as that only navigates** an existing diagram (`descend` / `openInstance`) is navigation. **Open as that creates** a definition (`openAsDiagram` with `createdDefinition`) is a project transaction, then a separate navigation.

## 4. Binding requirements (target)

### 4.1 Single history

One undo/redo history per open project session. Chronological. No independently operable sheet stacks for the same project data. A standalone sheet without a project may keep a document-only history, or be forced into a one-document project; recommendation: keep `EditSession` only for the no-project lab modes until those modes are retired.

### 4.2 Atomic transactions

One user action → one transaction. Multi-document changes restore together. Failure → original project identity (or deep-equal restore); no partial commit; no history entry. No-op → no entry.

### 4.3 Gestures

Pointer moves preview only. Commit once on pointer up if the project changed. Cancel/Escape restores and adds no entry. Same protocol as today’s `begin`/`preview`/`commit`/`cancel`, but the committed unit is a **project** history entry.

### 4.4 Document vs UI state

UI state listed in 3.3 never enters history. Navigation never clears or mutates the document history.

### 4.5 Cross-hierarchy undo

Undo/redo work regardless of the open sheet. Example sequence (place, resize, add ports, Open as, child place, boundary port, child wire, navigate to root, then Undo ×7) must reverse the seven document mutations in reverse order. Navigation creates no entry.

**If undo removes the document currently on screen:** resolve with `resolveLocation` (already repairs broken paths). UI strategy:

1. Cancel any open gesture first.
2. Apply the restored project.
3. Re-resolve the current step path; if empty or invalid, open the last valid ancestor (existing repair message).
4. Clear selection entries that no longer exist; restore viewport from `viewMemory` when the path key still matches, otherwise fit.

Do not invent a synthetic navigation history entry.

### 4.6 Identities

Stable block, port, interfacePort, net, component, and document ids across undo/redo. Redo must restore the same ids that undo removed, which full snapshots do automatically. Command/replay that calls `createId` again is forbidden for redo unless ids are recorded in the entry.

### 4.7 Redo branching

A new document transaction after undo drops the redo future. Pure UI ops do not.

### 4.8 Lifecycle

| Event | History | Dirty |
| --- | --- | --- |
| Save / Save As | Keep history | Clear dirty marker (mark saved fingerprint) |
| New / Load / reference open | New empty history | Clean |
| Undo to saved fingerprint | Dirty false | |
| Redo or edit past saved | Dirty true | |
| Cap | 40 entries initially (same as today) | Configurable later |

History is **not** persisted in the project file in the first delivery. Rationale: schema versioning, cross-machine redo of ephemeral ids, and file size. Dirty state is new UI metadata, not a schema field.

Deviation allowed later if a product requirement appears; it needs a schema decision and is out of D5b.1–D5b.6 unless accepted separately.

## 5. Strategy comparison

### Variant A — Full project snapshots

Store before (and optionally after) `serializeProject` strings per transaction. Matches `ProjectSession` today.

| Criterion | Assessment |
| --- | --- |
| Implement effort | Low: generalize `ProjectSession`, retire dual stacks |
| Migration | Medium: route every sheet `execute`/`commit` through project transactions |
| Correctness / atomicity | High: whole project replace |
| Memory | Acceptable at lab sizes (measurements §2.8); risk with huge assets |
| Runtime | ~0.02–1.3 ms serialize+parse on measured projects |
| Complexity / error rate | Lowest |
| Testability | High: deep equality of project JSON |
| Vue integration | Replace `project` ref; rebind `doc` |
| Hierarchy | Natural |
| HDL-Maker reuse | Clear single entry API |
| Extensions | Representation can change behind the API later |

### Variant B — Forward/inverse patches

Diff documents/components. Saves memory on large pictures if patches exclude unchanged assets.

| Criterion | Assessment |
| --- | --- |
| Effort / migration | High |
| Correctness | Harder; easy to miss nested fields |
| Memory | Better for large static assets |
| Testability | Need patch round-trip proofs |
| Fit now | Not required by measurements |

### Variant C — Reversible commands

Explicit `execute`/`undo`/`redo` per operation.

| Criterion | Assessment |
| --- | --- |
| Effort | Highest: every helper needs an inverse |
| Identity stability | Easy to get wrong on redo (`createId`) |
| Fit now | Conflicts with in-place mutators unless rewritten |

### Variant D — Hybrid (sheet doc snapshots + project snapshots)

As sketched in the older note: sheet entries replace one document; project entries replace all.

| Criterion | Assessment |
| --- | --- |
| Effort | Medium |
| Correctness | Better than today’s two stacks, but two entry kinds |
| Risk | Sheet entry that mutates a shared implementation is fine; still more code paths than A |
| When useful | If project snapshots become too large before D5d |

### Recommendation

**Adopt Variant A (project snapshots) for D5b.**

Reasons grounded in this codebase:

1. Project commands already use full snapshots and identity-based refusal.
2. Sheet edits already live inside the project’s documents; a project snapshot is the only representation that cannot forget a later sheet edit.
3. Measured sizes and times are compatible with a 40-entry cap for current and moderately grown projects.
4. Gestures already have begin/preview/commit; only the committed unit changes from document JSON to project JSON.
5. The public API can later swap the store for patches (B) without changing call sites—D5d territory.

Do **not** ship a lasting hybrid of old `EditSession` stacks and the new manager for the same project.

## 6. Proposed Transaction Manager API

No productive implementation in D5b.1. Target module: `diagram-lab/src/core/transaction.ts` (name indicative).

```typescript
export type TransactionLabel = string

export type TransactResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string }

export interface ProjectStore {
  get(): DiagramProject
  set(project: DiagramProject): void
}

export interface TransactionManager {
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly dirty: boolean
  readonly labelUndo: string | null
  readonly labelRedo: string | null

  /** Atomic project update. No-op / same reference → no history entry. */
  transact<T>(
    label: TransactionLabel,
    apply: (project: DiagramProject) => TransactResult<T> | DiagramProject,
  ): TransactResult<T> | { ok: true; value: undefined }

  /** Gesture support: preview mutates a working clone or the live project under a taken baseline. */
  begin(label: TransactionLabel): void
  preview(apply: (project: DiagramProject) => void): void
  commit(): boolean
  cancel(): void
  readonly isGesturing: boolean

  undo(): void
  redo(): void

  markSaved(): void
  resetHistory(): void
  setLimit(limit: number): void
}
```

Integration rules:

1. `DiagramStage` holds one `TransactionManager` while `project` is non-null.
2. All former `edits().execute` paths that run under a project call `manager.transact` (or begin/preview/commit) instead. Helpers may still mutate a clone passed by the manager.
3. All former `applyProject` paths call the same `manager.transact`.
4. `DocumentSessions` / dual buttons go away for project mode in D5b.5.
5. Core pure functions (`addInterfacePort`, `extractComponent`, …) stay free of the manager; the stage (or a thin facade) is the only history owner—long-term single mutation gateway for history-relevant changes.
6. Optional hardening (D5b.3+): freeze or proxy the live project outside `transact` in development builds to catch stray mutations. Not required for first acceptance if the inventory is migrated completely.

Gesture strategy under Variant A:

- `begin`: serializeProject baseline; set gesturing.
- `preview`: mutate live project documents in place (same UX as today) **or** mutate a working clone and `set` each move (safer, more serialize cost). Prefer **in-place preview + baseline restore on cancel**, matching today’s document gestures, then on `commit` push baseline if project JSON changed.
- Because preview mutates the live project, an interrupted navigation must `cancel()` first (`releaseGesture` already does this).

## 7. Migration plan

### D5b.2 — Central transaction manager and core tests

- **Files:** new `transaction.ts`; tests in `selfcheck.ts`; thin adapter tests without Vue.
- **Scope:** Implement manager with Variant A; no UI switch yet; dual stacks still present in the stage.
- **Invariants:** refusal adds no entry; cap 40; markSaved/dirty; gesture cancel.
- **Tests:** unit history on sample/digital projects; identity stability; failed transact.
- **Browser:** none required beyond smoke.
- **Acceptance:** selfcheck + vue-tsc; architecture still A.
- **Risk:** none to users if stage not wired.
- **Gate:** no lasting dual write of the same edit into old and new stacks.

### D5b.3 — Migrate sheet and project operations

- **Files:** `DiagramStage.vue` call sites; possibly small facades; leave pure core as-is.
- **Scope:** Every document-mutating UI path under a project goes through the manager. `ProjectSession` / per-document `EditSession` stop receiving new entries (may remain unused until D5b.5).
- **Invariants:** D5a.3 interface rules unchanged; wired delete refuse; Open as still one transaction.
- **Tests:** mixed sheet+project sequence; multi-instance; Open as undo; hierarchy navigation after undo.
- **Browser:** Digital reference mixed edits.
- **Risk:** missed call site → silent untracked mutation. Mitigate with inventory checklist and optional dev freeze.
- **No dual history:** once a path is migrated, it must not also push `EditSession`.
- **Done (awaiting acceptance):** Variant A cutover with ProjectStore adapter, shared Undo/Redo UI, minimal gesture binding; details in [d5b3-transaction-migration.md](d5b3-transaction-migration.md).

### D5b.4 — Interactive gestures

- **Files:** drag/resize/port/wire gesture handlers in `DiagramStage.vue`.
- **Scope:** Deepen begin/preview/commit/cancel robustness on the manager already used in D5b.3; Escape; navigate-away cancel; thorough browser acceptance.
- **Tests:** unchanged box adds no step; cancel restores; one commit per gesture.
- **Browser:** resize, port drag, wire bend.
- **Risk:** preview performance if clone-per-move chosen; prefer baseline+in-place.
- **Note:** Productive dual history is already forbidden after D5b.3; D5b.4 does not introduce a second stack. Implementation record: [d5b4-interactive-gesture-transactions.md](d5b4-interactive-gesture-transactions.md).

### D5b.5 — Unified UI

- **Files:** toolbar in `DiagramStage.vue`; shortcuts; panel hint text; docs.
- **Scope:** One Undo / one Redo; remove Project undo/redo buttons; Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z call the manager; status labels from transaction labels.
- **Tests:** shortcut targets; buttons disabled states.
- **Browser:** full mixed sequence from §4.5.
- **Risk:** user muscle memory; document in changelog.

### D5b.6 — Regression and user acceptance

- **Files:** selfcheck matrix expansion; acceptance notes.
- **Scope:** no new features; D0–D5a.3c + D5b matrix; user checklist.
- **Gate:** user acceptance before D5c.

If implementation shows project snapshots too heavy before D5b.6, switch the manager’s private store to Variant D or B **without** changing the API or reopening dual stacks—treat as a D5b.2 revision under the same acceptance, not a parallel history.

## 8. Future D5b test matrix

| Case | Intent |
| --- | --- |
| Mixed sheet then project then sheet | Chronological undo order |
| Several hierarchy levels | Undo from root after child edits |
| Several instances of one component | Interface undo updates all |
| Atomic interface change | Wired refuse; no partial |
| Undo/redo Open as | Definition and Boundary restored; navigation repaired |
| Wired ports | Refuse delete; undo of prior edits intact |
| Failed operations | No entry; project identical |
| Cancelled gestures | No entry; geometry restored |
| Redo branch | New edit drops future |
| Identity stability | Same ids after undo/redo round-trip |
| Save and dirty | Save keeps history; dirty clears; load resets |
| Full JSON round-trip | `serializeProject` equality after undo/redo chains |

## 9. Baseline regression (D5b.1)

Executed after this specification, without product mutation changes:

| Command | Result |
| --- | --- |
| `npx tsx src/core/selfcheck.ts` | `selfcheck ok` (includes perf line) |
| `npx vue-tsc --noEmit` | Exit code 0 |

## 10. Risks

1. **Missed mutation path** during D5b.3 leaves edits outside history—highest implementation risk.
2. **In-place preview** on the live project requires disciplined cancel on navigation (already present).
3. **Large embedded assets** could inflate snapshots; monitor in D5b.6; defer patch encoding to D5d unless blocked.
4. **Standalone sheet mode** (no project) must not break; keep document `EditSession` or wrap as single-document project.
5. **User expectation** after D5b.5: one Undo undoes Open as; document clearly in UI strings.

## 11. What D5b.1 deliberately does not do

No new transaction manager code in the product tree. No UI change. No schema change. No D5b.2 start. No commit, push, or release ZIP.
