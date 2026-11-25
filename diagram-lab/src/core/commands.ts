import { createId, type DiagramDocument, type Point, type Stroke } from './document'
import { nearestPort, refreshAll, setTrunkX } from './geometry'

export function addPort(doc: DiagramDocument, blockId: string): void {
  const block = doc.blocks.find((item) => item.id === blockId)
  if (!block) return
  const count = doc.ports.filter((item) => item.blockId === blockId).length + 1
  doc.ports.push({ id: createId('prt'), blockId, name: `p${count}`, side: 'right' })
  const onSide = doc.ports.filter((item) => item.blockId === blockId && item.side === 'right').length
  block.height = Math.max(block.height, (onSide + 1) * 28)
  refreshAll(doc)
}

export function moveTrunk(doc: DiagramDocument, segmentId: string, x: number): void {
  const segment = doc.segments.find((item) => item.id === segmentId)
  if (!segment) return
  setTrunkX(segment, x)
}

export function addStroke(doc: DiagramDocument, points: Stroke['points']): Stroke | null {
  if (points.length < 2) return null
  const stroke: Stroke = { id: createId('stk'), points, color: '#2c3a4a', size: 8 }
  doc.strokes.push(stroke)
  return stroke
}

/** Adopt a preview polyline as a manual segment. Geometry alone does not attach a port. */
export function adoptWire(doc: DiagramDocument, points: Point[], strokeId: string | null): string | null {
  if (points.length < 2) return null
  const netId = createId('net')
  const segmentId = createId('seg')
  const startPort = nearestPort(doc, points[0], 20)
  const endPort = nearestPort(doc, points[points.length - 1], 20)
  doc.nets.push({ id: netId, name: 'sketch' })
  doc.segments.push({
    id: segmentId,
    netId,
    points: points.map((point) => ({ ...point })),
    start: startPort ? { kind: 'port', portId: startPort } : { kind: 'free', x: points[0].x, y: points[0].y },
    end: startPort && startPort === endPort
      ? { kind: 'free', x: points[points.length - 1].x, y: points[points.length - 1].y }
      : endPort
        ? { kind: 'port', portId: endPort }
        : { kind: 'free', x: points[points.length - 1].x, y: points[points.length - 1].y },
    routed: 'manual',
  })
  doc.labels.push({
    id: createId('lbl'),
    text: 'sketch',
    anchor: { kind: 'segment', segmentId, edge: 0, distance: 24, offset: 14 },
  })
  if (strokeId) doc.strokes = doc.strokes.filter((item) => item.id !== strokeId)
  refreshAll(doc)
  return segmentId
}

export function removeStroke(doc: DiagramDocument, strokeId: string): void {
  doc.strokes = doc.strokes.filter((item) => item.id !== strokeId)
}
