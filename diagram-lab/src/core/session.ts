import type { DiagramDocument } from './document'
import { parseDocument, serialize } from './document'

const LIMIT = 40

/**
 * One user action is one history entry.
 * A drag calls begin, then preview on each move, then commit or cancel.
 * Preview writes the document itself. There is no second geometry store.
 */
export class EditSession {
  private past: string[] = []
  private future: string[] = []
  private gesture: string | null = null

  constructor(
    private current: () => DiagramDocument,
    private replace: (doc: DiagramDocument) => void,
  ) {}

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  get isGesturing(): boolean {
    return this.gesture !== null
  }

  execute(apply: (doc: DiagramDocument) => void): void {
    if (this.gesture !== null) this.commit()
    this.past.push(serialize(this.current()))
    this.future = []
    this.trim()
    apply(this.current())
  }

  begin(): void {
    if (this.gesture !== null) return
    this.gesture = serialize(this.current())
  }

  preview(apply: (doc: DiagramDocument) => void): void {
    if (this.gesture === null) this.begin()
    apply(this.current())
  }

  commit(finalize?: (doc: DiagramDocument) => void): void {
    if (this.gesture === null) return
    if (finalize) finalize(this.current())
    if (this.gesture !== serialize(this.current())) {
      this.past.push(this.gesture)
      this.future = []
      this.trim()
    }
    this.gesture = null
  }

  cancel(): void {
    if (this.gesture === null) return
    this.replace(parseDocument(this.gesture))
    this.gesture = null
  }

  undo(): void {
    if (this.gesture !== null) {
      this.cancel()
      return
    }
    const previous = this.past.pop()
    if (!previous) return
    this.future.push(serialize(this.current()))
    this.replace(parseDocument(previous))
  }

  redo(): void {
    if (this.gesture !== null) this.commit()
    const next = this.future.pop()
    if (!next) return
    this.past.push(serialize(this.current()))
    this.replace(parseDocument(next))
  }

  /** Replace the open document and drop the history. Used for open and new. */
  load(doc: DiagramDocument): void {
    this.past = []
    this.future = []
    this.gesture = null
    this.replace(doc)
  }

  private trim(): void {
    if (this.past.length > LIMIT) this.past.shift()
  }
}
