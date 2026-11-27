/**
 * Desktop interaction defaults (D5b.5a / D5b.5b).
 * Pure helpers — no DOM — so selfcheck can lock Select/toggle/pan/marquee policy.
 */

export type EditorTool = 'select' | 'pan' | 'freehand' | 'wire' | 'port'

/** Sticky toolbar: re-clicking the active non-select tool returns to select. */
export function chooseTool(current: EditorTool, next: EditorTool): EditorTool {
  if (current === next && next !== 'select') return 'select'
  return next
}

/**
 * Vue Flow `panOnDrag` button list.
 * 0 = left, 1 = middle. Right (2) is never included — RMB stays for context menus.
 * When the world SVG overlays the pane (wire/port/freehand), DiagramStage also
 * runs a local view-pan so MMB / Space+LMB still work over an open wire draft.
 */
export function panOnDragButtons(tool: EditorTool, spaceHeld: boolean): number[] {
  const buttons = [1]
  if (tool === 'pan' || spaceHeld) buttons.push(0)
  return buttons
}

/** Marquee only in select with LMB, and never while Space-pan is armed. */
export function allowMarquee(tool: EditorTool, spaceHeld: boolean, button: number): boolean {
  return tool === 'select' && !spaceHeld && button === 0
}

/**
 * Shift+LMB drag on a block duplicates (D5c.6). Shift on empty canvas remains marquee-add.
 * Wires are not duplicated by this gesture.
 */
export function blockDragMode(shiftKey: boolean): 'move' | 'duplicate' {
  return shiftKey ? 'duplicate' : 'move'
}

/** Ignore tiny Shift+drags so a Shift-click multi-select does not leave a stacked copy. */
export function duplicateDragMoved(dx: number, dy: number, threshold = 4): boolean {
  return Math.hypot(dx, dy) >= threshold
}

export type PressStamp = { t: number; x: number; y: number }

/**
 * Double-press detector for pointerdown.
 * `PointerEvent.detail` is always 0 on pointerdown in Chromium/Edge — do not use it for click count.
 * Client-pixel distance so zoom does not change the tolerance.
 */
export function isDoublePress(
  previous: PressStamp | null,
  next: PressStamp,
  windowMs = 500,
  maxDistPx = 8,
): boolean {
  if (!previous) return false
  if (next.t - previous.t > windowMs) return false
  return Math.hypot(next.x - previous.x, next.y - previous.y) <= maxDistPx
}

/**
 * Pure tag/type form of {@link isTextEditingTarget} for selfcheck without a DOM.
 * Checkboxes/radios/buttons are not text entry — document Ctrl+Z must still run (P1-Fix).
 */
export function isTextEditingControl(tagName: string, inputType?: string, contentEditable = false): boolean {
  if (contentEditable) return true
  const tag = tagName.toUpperCase()
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  const type = (inputType || 'text').toLowerCase()
  return type !== 'checkbox' && type !== 'radio' && type !== 'button' && type !== 'submit' && type !== 'reset' && type !== 'file' && type !== 'range' && type !== 'color'
}

/** True when document shortcuts must not steal keystrokes from a text field. */
export function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const type = target instanceof HTMLInputElement ? target.type : undefined
  return isTextEditingControl(target.tagName, type, target.isContentEditable)
}

/**
 * Keyboard while an unfinished wire draft owns the gesture (S5a.1).
 * Returns `pass` so callers keep the normal Select/history shortcuts.
 */
export type WireDrawingShortcut = 'undo-step' | 'cancel-all' | 'pass'

export function wireDrawingShortcut(
  key: string,
  drafting: boolean,
  mods: { shift?: boolean; ctrlOrMeta?: boolean } = {},
): WireDrawingShortcut {
  if (!drafting) return 'pass'
  if (key === 'Escape' && mods.shift) return 'cancel-all'
  if (key === 'Escape') return 'undo-step'
  if (key === 'Backspace') return 'undo-step'
  if (mods.ctrlOrMeta && key.toLowerCase() === 'z' && !mods.shift) return 'undo-step'
  return 'pass'
}

/** Middle-click, or Space+LMB, starts viewport pan without touching the wire draft. */
export function shouldBeginViewPan(button: number, spaceHeld: boolean): boolean {
  return button === 1 || (button === 0 && spaceHeld)
}

/**
 * Space keyup while a wire draft is open: tap (no pan) toggles elbow;
 * Space+drag pan leaves the draft and elbow unchanged.
 */
export function spaceReleaseAction(wireDraftOpen: boolean, panOccurred: boolean): 'elbow' | 'none' {
  if (wireDraftOpen && !panOccurred) return 'elbow'
  return 'none'
}

/**
 * Esc stack (D5c.2): Cancel transient → return to Select → clear selection.
 * Overlay / symbol-draft dismiss stays in the view before this helper.
 */
export type EscapeAction = 'cancel' | 'tool-select' | 'clear-selection' | 'none'

export function nextEscapeAction(
  tool: EditorTool,
  hasCancelableTransient: boolean,
  hasSelection: boolean,
): EscapeAction {
  if (hasCancelableTransient) return 'cancel'
  if (tool !== 'select') return 'tool-select'
  if (hasSelection) return 'clear-selection'
  return 'none'
}
