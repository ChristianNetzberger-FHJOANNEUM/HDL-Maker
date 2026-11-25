import simplify from 'simplify-js'
import type { Point } from './document'

const MAX_CORNERS = 6

export type OrthoResult = { ok: true; points: Point[] } | { ok: false; reason: string }

/**
 * Reduce a freehand centerline to an orthogonal polyline.
 * This does not create a net. A crossing is not a connection.
 * Strokes with more than six corners are refused.
 */
export function orthogonalize(raw: Point[], tolerance = 12): OrthoResult {
  if (raw.length < 2) return { ok: false, reason: 'The stroke is too short to become a wire.' }
  const simplified = simplify(raw.map((point) => ({ x: point.x, y: point.y })), tolerance, true)
  if (simplified.length < 2 || polylineSpan(simplified) < 16) {
    return { ok: false, reason: 'The stroke is too short to become a wire.' }
  }
  const points = rectilinear(simplified)
  const corners = Math.max(0, points.length - 2)
  if (corners > MAX_CORNERS) {
    return { ok: false, reason: 'This stroke has too many turns to convert automatically.' }
  }
  if (points.length < 2) return { ok: false, reason: 'The stroke is too short to become a wire.' }
  return { ok: true, points }
}

function rectilinear(points: Point[]): Point[] {
  const out: Point[] = [{ x: points[0].x, y: points[0].y }]
  for (let i = 1; i < points.length; i += 1) {
    const prev = out[out.length - 1]
    const cur = points[i]
    const dx = cur.x - prev.x
    const dy = cur.y - prev.y
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
    if (Math.abs(dx) >= Math.abs(dy)) out.push({ x: cur.x, y: prev.y })
    else out.push({ x: prev.x, y: cur.y })
  }
  const end = points[points.length - 1]
  const last = out[out.length - 1]
  if (Math.abs(last.x - end.x) > 0.5 && Math.abs(last.y - end.y) > 0.5) {
    out.push({ x: end.x, y: last.y })
  }
  if (Math.hypot(out[out.length - 1].x - end.x, out[out.length - 1].y - end.y) > 0.5) out.push({ x: end.x, y: end.y })
  return dropRepeats(out)
}

function dropRepeats(points: Point[]): Point[] {
  const out: Point[] = []
  for (const point of points) {
    const prev = out[out.length - 1]
    if (prev && Math.hypot(prev.x - point.x, prev.y - point.y) < 0.5) continue
    out.push(point)
  }
  return out
}

function polylineSpan(points: Point[]): number {
  let total = 0
  for (let i = 1; i < points.length; i += 1) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  return total
}

export function isOrthogonal(points: Point[]): boolean {
  for (let i = 1; i < points.length; i += 1) {
    const dx = Math.abs(points[i].x - points[i - 1].x)
    const dy = Math.abs(points[i].y - points[i - 1].y)
    if (dx > 0.5 && dy > 0.5) return false
  }
  return true
}
