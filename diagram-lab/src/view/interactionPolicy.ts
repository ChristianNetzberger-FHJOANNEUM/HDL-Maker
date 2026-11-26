/**
 * Desktop interaction defaults (D5b.5a).
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
