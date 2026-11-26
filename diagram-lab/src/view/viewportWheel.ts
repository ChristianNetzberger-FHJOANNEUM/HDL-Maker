/**
 * Cursor-centred viewport zoom matching Vue Flow's default wheelDelta scaling.
 * Used by the stage-level wheel handler so overlay hits and the pane share one path.
 */

export type ViewportZoom = { x: number; y: number; zoom: number }

export const VIEWPORT_MIN_ZOOM = 0.25
export const VIEWPORT_MAX_ZOOM = 2.5

/** Same formula as `@vue-flow/core` `wheelDelta`. */
export function vueFlowWheelDelta(event: { deltaY: number; deltaMode: number; ctrlKey: boolean }, macOs = isMacOs()): number {
  const factor = event.ctrlKey && macOs ? 10 : 1
  const modeScale = event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 2e-3
  return -event.deltaY * modeScale * factor
}

/**
 * Keep the world point under `local` (stage-relative CSS pixels) fixed on screen.
 * Returns the current viewport when the zoom would not change.
 */
export function viewportAfterWheel(
  view: ViewportZoom,
  local: { x: number; y: number },
  event: { deltaY: number; deltaMode: number; ctrlKey: boolean },
  limits: { min: number; max: number } = { min: VIEWPORT_MIN_ZOOM, max: VIEWPORT_MAX_ZOOM },
  macOs = isMacOs(),
): ViewportZoom {
  const zoom = view.zoom > 0 ? view.zoom : 1
  const nextZoom = clamp(zoom * 2 ** vueFlowWheelDelta(event, macOs), limits.min, limits.max)
  if (nextZoom === zoom) return { x: view.x, y: view.y, zoom }
  const worldX = (local.x - view.x) / zoom
  const worldY = (local.y - view.y) / zoom
  return {
    x: local.x - worldX * nextZoom,
    y: local.y - worldY * nextZoom,
    zoom: nextZoom,
  }
}

export function isMacOs(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/i.test(`${navigator.platform} ${navigator.userAgent}`)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
