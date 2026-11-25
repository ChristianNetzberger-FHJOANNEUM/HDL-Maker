/**
 * Unified project transaction history (D5b.2).
 * Framework-free: no Vue, DOM, or UI. Snapshots are serializeProject strings.
 * Not wired into DiagramStage yet — that is D5b.3.
 */

import type { DiagramProject } from './component'
import { parseProject, serializeProject } from './project'

export type TransactionLabel = string

export type TransactOk<T> = { ok: true; value: T }
export type TransactFail = { ok: false; message: string }
export type TransactResult<T> = TransactOk<T> | TransactFail

/** Outcome of apply(): a project, a valued success, or a refusal. */
export type ApplyOutcome<T> =
  | DiagramProject
  | { ok: true; project: DiagramProject; value: T }
  | { ok: true; value: T }
  | { ok: false; message: string; project?: DiagramProject }

export interface ProjectStore {
  get(): DiagramProject
  set(project: DiagramProject): void
}

export type TransactionManagerOptions = {
  /** Maximum undo entries (past). Default 40. */
  limit?: number
}

type HistoryEntry = {
  /** Isolated project JSON. Never shared with the live object graph. */
  snapshot: string
  label: TransactionLabel
}

/**
 * Owns history around a ProjectStore.
 * Live project identity is whatever the store holds; history holds opaque strings only.
 */
export class TransactionManager {
  private past: HistoryEntry[] = []
  private future: HistoryEntry[] = []
  private limit: number
  /** Canonical serializeProject of the last markSaved / reset state. */
  private savedFingerprint: string
  private gesture: { baseline: string; label: TransactionLabel } | null = null
  /** Depth of an in-flight atomic transact (not a gesture). */
  private depth = 0

  constructor(
    private readonly store: ProjectStore,
    options?: TransactionManagerOptions,
  ) {
    this.limit = Math.max(1, options?.limit ?? 40)
    this.savedFingerprint = serializeProject(store.get())
  }

  static holding(project: DiagramProject, options?: TransactionManagerOptions): TransactionManager {
    const box = { project }
    return new TransactionManager(
      {
        get: () => box.project,
        set: (next) => {
          box.project = next
        },
      },
      options,
    )
  }

  get project(): DiagramProject {
    return this.store.get()
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  get isDirty(): boolean {
    return serializeProject(this.store.get()) !== this.savedFingerprint
  }

  get isGesturing(): boolean {
    return this.gesture !== null
  }

  get labelUndo(): string | null {
    return this.past.length > 0 ? this.past[this.past.length - 1].label : null
  }

  get labelRedo(): string | null {
    return this.future.length > 0 ? this.future[this.future.length - 1].label : null
  }

  get historyLimit(): number {
    return this.limit
  }

  get undoDepth(): number {
    return this.past.length
  }

  get redoDepth(): number {
    return this.future.length
  }

  setLimit(limit: number): void {
    this.limit = Math.max(1, Math.floor(limit))
    this.trimPast()
  }

  /**
   * Atomic update. Works on an isolated clone. Live store changes only on success with a real diff.
   * Nested transact is refused. Open gesture is refused.
   */
  transact<T = undefined>(label: TransactionLabel, apply: (project: DiagramProject) => ApplyOutcome<T>): TransactResult<T> {
    if (this.gesture) return { ok: false, message: 'A gesture is open. Commit or cancel it first.' }
    if (this.depth > 0) return { ok: false, message: 'Nested transact is not supported. Fold the work into the outer transaction.' }

    const before = serializeProject(this.store.get())
    const draft = parseProject(before)
    this.depth += 1
    try {
      const outcome = apply(draft)
      const parsed = readOutcome(outcome, draft)
      if (!parsed.ok) return { ok: false, message: parsed.message }

      const after = serializeProject(parsed.project)
      if (after === before) {
        // Content-identical: no history, keep the existing live object (no spurious replace).
        return { ok: true, value: parsed.value }
      }

      this.past.push({ snapshot: before, label })
      this.future = []
      this.trimPast()
      // Fresh parse so the live graph never aliases the caller's draft or a history string.
      this.store.set(parseProject(after))
      return { ok: true, value: parsed.value }
    } catch (error) {
      // Draft was never published; live store is unchanged.
      const message = error instanceof Error ? error.message : 'The transaction failed.'
      return { ok: false, message }
    } finally {
      this.depth -= 1
    }
  }

  /**
   * Start an interactive gesture. Preview mutates the live project in place.
   * Cancel restores the baseline snapshot. Commit records at most one history entry.
   */
  begin(label: TransactionLabel): TransactResult<undefined> {
    if (this.depth > 0) return { ok: false, message: 'Cannot begin a gesture inside a transact.' }
    if (this.gesture) return { ok: false, message: 'A gesture is already open.' }
    this.gesture = { baseline: serializeProject(this.store.get()), label }
    return { ok: true, value: undefined }
  }

  preview(apply: (project: DiagramProject) => void): TransactResult<undefined> {
    if (!this.gesture) return { ok: false, message: 'No gesture is open.' }
    try {
      apply(this.store.get())
      return { ok: true, value: undefined }
    } catch (error) {
      this.store.set(parseProject(this.gesture.baseline))
      this.gesture = null
      const message = error instanceof Error ? error.message : 'Preview failed.'
      return { ok: false, message }
    }
  }

  /** @returns true when a history entry was recorded. */
  commit(): boolean {
    if (!this.gesture) return false
    const { baseline, label } = this.gesture
    this.gesture = null
    const after = serializeProject(this.store.get())
    if (after === baseline) {
      // Restore from baseline parse to drop any accidental shared mutation of the baseline era —
      // live object may have been touched then reverted field-by-field; keep one clean graph.
      this.store.set(parseProject(baseline))
      return false
    }
    this.past.push({ snapshot: baseline, label })
    this.future = []
    this.trimPast()
    // Re-parse live so it does not share structure with anything that preview mutated oddly.
    this.store.set(parseProject(after))
    return true
  }

  cancel(): void {
    if (!this.gesture) return
    const { baseline } = this.gesture
    this.gesture = null
    this.store.set(parseProject(baseline))
    // Future is untouched — cancelled gestures must not discard redo.
  }

  undo(): TransactResult<undefined> {
    if (this.gesture) return { ok: false, message: 'A gesture is open. Commit or cancel it first.' }
    if (this.depth > 0) return { ok: false, message: 'Cannot undo inside a transact.' }
    const entry = this.past.pop()
    if (!entry) return { ok: false, message: 'Nothing to undo.' }
    const current = serializeProject(this.store.get())
    this.future.push({ snapshot: current, label: entry.label })
    this.store.set(parseProject(entry.snapshot))
    return { ok: true, value: undefined }
  }

  redo(): TransactResult<undefined> {
    if (this.gesture) return { ok: false, message: 'A gesture is open. Commit or cancel it first.' }
    if (this.depth > 0) return { ok: false, message: 'Cannot redo inside a transact.' }
    const entry = this.future.pop()
    if (!entry) return { ok: false, message: 'Nothing to redo.' }
    const current = serializeProject(this.store.get())
    this.past.push({ snapshot: current, label: entry.label })
    this.trimPast()
    this.store.set(parseProject(entry.snapshot))
    return { ok: true, value: undefined }
  }

  /** Record the current project as the saved fingerprint. Does not change history. */
  markSaved(): void {
    this.savedFingerprint = serializeProject(this.store.get())
  }

  /** Clear undo/redo. Leaves the live project and the saved fingerprint as they are. */
  resetHistory(): void {
    if (this.gesture) {
      this.store.set(parseProject(this.gesture.baseline))
      this.gesture = null
    }
    this.past = []
    this.future = []
  }

  /**
   * Replace the live project, clear history, and mark saved.
   * Used for New / Load in later phases.
   */
  reset(project: DiagramProject): void {
    this.gesture = null
    this.depth = 0
    this.past = []
    this.future = []
    const text = serializeProject(project)
    this.store.set(parseProject(text))
    this.savedFingerprint = text
  }

  /** Serialized size of one snapshot of the current project (bytes, UTF-8). */
  snapshotByteLength(): number {
    return byteLength(serializeProject(this.store.get()))
  }

  private trimPast(): void {
    while (this.past.length > this.limit) this.past.shift()
  }
}

function readOutcome<T>(
  outcome: ApplyOutcome<T>,
  draft: DiagramProject,
): { ok: true; project: DiagramProject; value: T } | { ok: false; message: string } {
  if (isProject(outcome)) {
    return { ok: true, project: outcome, value: undefined as T }
  }
  if (typeof outcome === 'object' && outcome !== null && 'ok' in outcome) {
    if (outcome.ok === false) {
      return { ok: false, message: outcome.message }
    }
    const project = 'project' in outcome && isProject(outcome.project) ? outcome.project : draft
    return { ok: true, project, value: outcome.value }
  }
  return { ok: false, message: 'The transaction returned an invalid result.' }
}

function isProject(value: unknown): value is DiagramProject {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as DiagramProject).schemaVersion === 1 &&
    typeof (value as DiagramProject).id === 'string' &&
    Array.isArray((value as DiagramProject).documents)
  )
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}
