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
