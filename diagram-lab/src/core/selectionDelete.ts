/** Pure delete priority for editor selection refs (P5c-DEL). */

export type EditorSelectionSnapshot = {
  blockCount: number
  strokeId: string | null
  segmentId: string | null
  portId: string | null
}

export type DeleteSelectionTarget = 'blocks' | 'stroke' | 'segment' | 'port' | 'none'

export function resolveDeleteSelectionTarget(sel: EditorSelectionSnapshot): DeleteSelectionTarget {
  if (sel.blockCount > 0) return 'blocks'
  if (sel.strokeId) return 'stroke'
  if (sel.segmentId) return 'segment'
  if (sel.portId) return 'port'
  return 'none'
}