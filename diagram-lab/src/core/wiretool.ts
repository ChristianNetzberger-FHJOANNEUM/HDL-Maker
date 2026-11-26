import type { Point } from './document'
import { orthogonalTo, samePoint } from './geometry'
import type { SnapHit } from './nets'

export type WireDraft = {
  points: Point[]
  start: SnapHit
  elbow: 'h' | 'v'
}

export type WireCommit = { points: Point[]; start: SnapHit; end: SnapHit }

/**
 * Clicks build a draft. A click on a port, junction, or wire asks for a commit.
 * Free single-clicks add bends; open stubs are finished via `finishFree` (Enter / double-click).
 */
export function wireClick(draft: WireDraft | null, hit: SnapHit): { draft: WireDraft | null; commit: WireCommit | null; message: string } {
  if (hit.kind === 'ambiguous') return { draft, commit: null, message: 'Two targets overlap. Choose one.' }
  if (!draft) {
    return {
      draft: { points: [{ ...hit.point }], start: hit, elbow: 'h' },
      commit: null,
      message:
        hit.kind === 'port'
          ? 'Click bends, then a port/wire, or double-click free space for a stub. Escape cancels.'
          : 'Click bends, then a port or a wire. Escape cancels.',
    }
  }
  const last = draft.points[draft.points.length - 1]
  const points = [...draft.points, ...orthogonalTo(last, hit.point, draft.elbow).slice(1)]
  if (hit.kind !== 'free' && !samePoint(hit.point, draft.start.point, 8)) {
    return { draft: null, commit: { points, start: draft.start, end: hit }, message: '' }
  }
  return { draft: { ...draft, points }, commit: null, message: 'Bend added. Double-click free space to finish a stub.' }
}

export function finishFree(draft: WireDraft, at: Point): WireCommit {
  const last = draft.points[draft.points.length - 1]
  return {
    points: [...draft.points, ...orthogonalTo(last, at, draft.elbow).slice(1)],
    start: draft.start,
    end: { kind: 'free', point: { ...at } },
  }
}
