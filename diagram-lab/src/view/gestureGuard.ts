/**
 * UI-layer gesture policy for D5b.4.
 * Browser events are handled in the view; this module stays free of DOM APIs
 * so selfcheck can assert the interrupt table without Vue.
 */

export type GestureInterrupt =
  | 'escape'
  | 'pointercancel'
  | 'lostcapture'
  | 'blur'
  | 'hidden'
  | 'undo'
  | 'navigation'
  | 'save'
  | 'project-replace'
  | 'unmount'
  | 'command'

export type InterruptAction = 'cancel' | 'refuse'

/** Binding table from the D5b.4 work order. */
export function actionForInterrupt(kind: GestureInterrupt): InterruptAction {
  switch (kind) {
    case 'escape':
    case 'pointercancel':
    case 'lostcapture':
    case 'blur':
    case 'hidden':
    case 'undo':
    case 'navigation':
    case 'save':
    case 'project-replace':
    case 'unmount':
    case 'command':
      return 'cancel'
  }
}

/** Redo must not run and must not alter history while a gesture is open. */
export function actionForRedoWhileGesturing(): 'refuse' {
  return 'refuse'
}

/**
 * Latches the first commit/cancel so late pointerup / lostpointercapture
 * cannot run a second close for the same gesture.
 */
export class GestureCloseLatch {
  private closing = false

  get isClosing(): boolean {
    return this.closing
  }

  /** @returns true the first time; false for duplicate close attempts. */
  tryBeginClose(): boolean {
    if (this.closing) return false
    this.closing = true
    return true
  }

  reset(): void {
    this.closing = false
  }
}
