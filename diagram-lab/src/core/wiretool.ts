import type { Point } from './document'
import { orthogonalTo, samePoint } from './geometry'
import type { SnapHit } from './nets'

export const WIRE_DRAW_HINT =
  'LMB: Add point | Double-click: Finish | Esc/Backspace: Undo point | Shift+Esc: Cancel'

export type WireDraft = {
  points: Point[]
  start: SnapHit
  elbow: 'h' | 'v'
  /**
   * Point arrays after each user-confirmed drawing step.
   * Index 0 is the start anchor alone. One click that creates multiple
   * orthogonal edges is still one step (S5a.1).
   */
  fixedSteps: Point[][]
  /**
   * Snapshot of `points` before the most recent free-space bend click.
   * Double-click stub finish must resume from this checkpoint so the companion
   * detail=1 click does not leave an extra bend / zero-length terminal.
   */
  pointsBeforeFreeBend?: Point[]
}

export type WireCommit = { points: Point[]; start: SnapHit; end: SnapHit }

export type FinishFreeOptions = {
  /** When true, ignore the bend added by the first click of an LMB double-click. */
  fromBeforeLastFreeBend?: boolean
}

function copyPoints(points: Point[]): Point[] {
  return points.map((point) => ({ ...point }))
}

function startDraft(hit: SnapHit): WireDraft {
  const points = [{ ...hit.point }]
  return {
    points,
    start: hit,
    elbow: 'h',
    fixedSteps: [copyPoints(points)],
  }
}

/**
 * Clicks build a draft. A click on a port, junction, or wire asks for a commit.
 * Free single-clicks add bends; open stubs are finished via `finishFree` (Enter / double-click).
 */
export function wireClick(draft: WireDraft | null, hit: SnapHit): { draft: WireDraft | null; commit: WireCommit | null; message: string } {
  if (hit.kind === 'ambiguous') return { draft, commit: null, message: 'Two targets overlap. Choose one.' }
  if (!draft) {
    return {
      draft: startDraft(hit),
      commit: null,
      message: WIRE_DRAW_HINT,
    }
  }
  const last = draft.points[draft.points.length - 1]!
  const points = [...draft.points, ...orthogonalTo(last, hit.point, draft.elbow).slice(1)]
  if (hit.kind !== 'free' && !samePoint(hit.point, draft.start.point, 8)) {
    return { draft: null, commit: { points, start: draft.start, end: hit }, message: '' }
  }
  const fixedSteps = [...(draft.fixedSteps ?? [copyPoints(draft.points)]), copyPoints(points)]
  return {
    draft: {
      ...draft,
      points,
      fixedSteps,
      pointsBeforeFreeBend: copyPoints(draft.points),
    },
    commit: null,
    message: WIRE_DRAW_HINT,
  }
}

/**
 * Remove the most recent confirmed drawing step (S5a.1).
 * When only the start anchor remains, cancels the whole draft.
 */
export function undoWireStep(draft: WireDraft): { draft: WireDraft | null; cancelled: boolean; message: string } {
  const steps = draft.fixedSteps?.length ? draft.fixedSteps : [copyPoints(draft.points)]
  if (steps.length <= 1) {
    return { draft: null, cancelled: true, message: 'Wire cancelled.' }
  }
  const fixedSteps = steps.slice(0, -1).map(copyPoints)
  const points = copyPoints(fixedSteps[fixedSteps.length - 1]!)
  return {
    draft: {
      ...draft,
      points,
      fixedSteps,
      pointsBeforeFreeBend: fixedSteps.length >= 2 ? copyPoints(fixedSteps[fixedSteps.length - 2]!) : undefined,
    },
    cancelled: false,
    message: WIRE_DRAW_HINT,
  }
}

export function canUndoWireStep(draft: WireDraft): boolean {
  return (draft.fixedSteps?.length ?? 1) > 1
}

/**
 * Finish an open stub on free space.
 * Pass `fromBeforeLastFreeBend` for LMB double-click so the detail=1 free bend is discarded.
 */
export function finishFree(draft: WireDraft, at: Point, options?: FinishFreeOptions): WireCommit {
  const base =
    options?.fromBeforeLastFreeBend && draft.pointsBeforeFreeBend && draft.pointsBeforeFreeBend.length > 0
      ? draft.pointsBeforeFreeBend
      : draft.points
  const last = base[base.length - 1]!
  return {
    points: [...base, ...orthogonalTo(last, at, draft.elbow).slice(1)],
    start: draft.start,
    end: { kind: 'free', point: { ...at } },
  }
}

/** True when commit geometry has no duplicate consecutive points or zero-length terminal leg. */
export function stubGeometrySane(points: Point[], epsilon = 0.5): boolean {
  if (points.length < 2) return false
  for (let index = 1; index < points.length; index += 1) {
    if (samePoint(points[index - 1]!, points[index]!, epsilon)) return false
  }
  return true
}
