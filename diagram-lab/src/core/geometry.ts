import type {
  Block,
  DiagramDocument,
  Endpoint,
  LabelAnchor,
  Point,
  Port,
  PortSide,
  Segment,
  SymbolDefinition,
  SymbolGuide,
  SymbolLabel,
  SymbolPort,
  SymbolShape,
  Waypoint,
} from './document'

export function polylineLength(points: Point[]): number {
  let total = 0
  for (let i = 1; i < points.length; i += 1) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  return total
}

/** Place a label on one edge of a polyline. The normal points screen-up on a left-to-right edge. */
export function pointOnEdge(points: Point[], edge: number, distance: number, offset: number): Point | null {
  if (edge < 0 || edge >= points.length - 1) return null
  const a = points[edge]
  const b = points[edge + 1]
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  if (len < 1e-6) return { x: a.x, y: a.y - offset }
  const t = Math.min(1, Math.max(0, distance / len))
  const dx = (b.x - a.x) / len
  const dy = (b.y - a.y) / len
  return {
    x: a.x + (b.x - a.x) * t + dy * offset,
    y: a.y + (b.y - a.y) * t - dx * offset,
  }
}

export function isFreePin(pin: { x?: number; y?: number }): boolean {
  return typeof pin.x === 'number' && typeof pin.y === 'number'
}

/** True when the pin uses a symbol guide (A2-P1). */
export function isGuidedPin(pin: Pick<SymbolPort, 'guideId' | 'u'>): boolean {
  return typeof pin.guideId === 'string' && pin.guideId.length > 0 && typeof pin.u === 'number'
}

export function clampGuideU(u: number): number {
  if (!Number.isFinite(u)) return 0
  const wrapped = u % 1
  return wrapped < 0 ? wrapped + 1 : wrapped
}

/** Scale a symbol-local ellipse guide into instance coordinates. */
export function scaleEllipseGuide(guide: Extract<SymbolGuide, { kind: 'ellipse' }>, sx: number, sy: number): Extract<SymbolGuide, { kind: 'ellipse' }> {
  return {
    ...guide,
    cx: guide.cx * sx,
    cy: guide.cy * sy,
    rx: Math.abs(guide.rx * sx),
    ry: Math.abs(guide.ry * sy),
  }
}

/**
 * Point on an ellipse guide. φ = 2πu; screen y grows downward
 * (u=0 right, 0.25 bottom, 0.5 left, 0.75 top).
 */
export function pointOnEllipseGuide(guide: Extract<SymbolGuide, { kind: 'ellipse' }>, u: number): Point {
  const phi = 2 * Math.PI * clampGuideU(u)
  return {
    x: guide.cx + guide.rx * Math.cos(phi),
    y: guide.cy + guide.ry * Math.sin(phi),
  }
}

/**
 * Project a local point onto an ellipse guide; return u in [0,1).
 * Uses the ellipse-parameter angle atan2((y-cy)/ry, (x-cx)/rx).
 */
export function projectOntoEllipseGuide(guide: Extract<SymbolGuide, { kind: 'ellipse' }>, local: Point): number {
  const rx = guide.rx > 1e-9 ? guide.rx : 1e-9
  const ry = guide.ry > 1e-9 ? guide.ry : 1e-9
  let phi = Math.atan2((local.y - guide.cy) / ry, (local.x - guide.cx) / rx)
  if (phi < 0) phi += 2 * Math.PI
  return clampGuideU(phi / (2 * Math.PI))
}

/**
 * Choose the unwrap of `next` in [0,1) closest to `previous` so drag across u=0 does not jump.
 * Returns a value that may lie outside [0,1); callers store `clampGuideU` of the result.
 */
export function continuousGuideU(previous: number, next: number): number {
  const target = clampGuideU(next)
  let candidate = target
  while (candidate - previous > 0.5) candidate -= 1
  while (candidate - previous < -0.5) candidate += 1
  return candidate
}

export function findSymbolGuide(symbol: SymbolDefinition, guideId: string | undefined): SymbolGuide | undefined {
  if (!guideId || !symbol.guides) return undefined
  return symbol.guides.find((guide) => guide.id === guideId)
}

/** Resolve guided pin position in the instance box (definition guide scaled). */
export function guidedPinPoint(
  symbol: SymbolDefinition,
  pin: SymbolPort,
  instanceWidth: number,
  instanceHeight: number,
  uOverride?: number,
): Point | null {
  if (!isGuidedPin(pin) || !pin.guideId) return null
  const guide = findSymbolGuide(symbol, pin.guideId)
  if (!guide || guide.kind !== 'ellipse') return null
  const sx = symbol.width > 0 ? instanceWidth / symbol.width : 1
  const sy = symbol.height > 0 ? instanceHeight / symbol.height : 1
  const scaled = scaleEllipseGuide(guide, sx, sy)
  const u = typeof uOverride === 'number' ? uOverride : pin.u!
  return pointOnEllipseGuide(scaled, u)
}

/**
 * Derived radial lead in instance space (same u on concentric ellipses).
 * Returns null when guides are missing or not ellipses.
 */
export function radialLeadSegment(
  symbol: SymbolDefinition,
  pin: SymbolPort,
  instanceWidth: number,
  instanceHeight: number,
  uOverride?: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  if (pin.lead !== 'radial' || !pin.guideId || !pin.leadGuideId) return null
  const outerDef = findSymbolGuide(symbol, pin.guideId)
  const innerDef = findSymbolGuide(symbol, pin.leadGuideId)
  if (!outerDef || outerDef.kind !== 'ellipse' || !innerDef || innerDef.kind !== 'ellipse') return null
  const sx = symbol.width > 0 ? instanceWidth / symbol.width : 1
  const sy = symbol.height > 0 ? instanceHeight / symbol.height : 1
  const outer = scaleEllipseGuide(outerDef, sx, sy)
  const inner = scaleEllipseGuide(innerDef, sx, sy)
  const u = typeof uOverride === 'number' ? uOverride : (pin.u ?? 0)
  const a = pointOnEllipseGuide(outer, u)
  const b = pointOnEllipseGuide(inner, u)
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
}

/** A free pin uses fractions of the symbol box. A side pin uses `t` along that side. Guided pins need `guidedPinPoint`. */
export function pinPoint(width: number, height: number, pin: { side: PortSide; t: number; x?: number; y?: number }): Point {
  if (isFreePin(pin)) {
    return { x: width * clampUnit(pin.x ?? 0), y: height * clampUnit(pin.y ?? 0) }
  }
  return pinLocal(width, height, pin.side, pin.t)
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** A pin on the symbol's own axes. `t` runs along `side`, not always downward. */
export function pinLocal(width: number, height: number, side: PortSide, t: number): Point {
  const u = Math.min(1, Math.max(0, t))
  if (side === 'top') return { x: width * u, y: 0 }
  if (side === 'bottom') return { x: width * u, y: height }
  if (side === 'left') return { x: 0, y: height * u }
  return { x: width, y: height * u }
}

/** Snap a symbol-local point to the nearest side and the fraction along that side. */
export function pinOnBorder(width: number, height: number, x: number, y: number): { side: PortSide; t: number } {
  const distances: Array<{ side: PortSide; distance: number }> = [
    { side: 'left', distance: Math.abs(x) },
    { side: 'right', distance: Math.abs(width - x) },
    { side: 'top', distance: Math.abs(y) },
    { side: 'bottom', distance: Math.abs(height - y) },
  ]
  distances.sort((a, b) => a.distance - b.distance)
  const side = distances[0].side
  const span = side === 'top' || side === 'bottom' ? width : height
  const along = side === 'top' || side === 'bottom' ? x : y
  const t = span === 0 ? 0 : Math.min(1, Math.max(0, along / span))
  return { side, t }
}

export function portAnchor(
  doc: Pick<DiagramDocument, 'blocks' | 'ports'> & { symbols?: SymbolDefinition[] },
  portId: string,
  origins?: Map<string, Point>,
): Point | null {
  const port = doc.ports.find((item) => item.id === portId)
  if (!port) return null
  const block = doc.blocks.find((item) => item.id === port.blockId)
  if (!block) return null
  const origin = origins?.get(block.id) ?? { x: block.x, y: block.y }
  if (port.placed) {
    const local = pinLocal(block.width, block.height, port.side, port.t ?? 0.5)
    return { x: origin.x + local.x, y: origin.y + local.y }
  }
  const symbol =
    port.symbolPortId && block.symbolId ? doc.symbols?.find((item) => item.id === block.symbolId) : undefined
  const symbolPort = port.symbolPortId ? symbol?.ports.find((item) => item.id === port.symbolPortId) : undefined
  if (symbol && symbolPort && isGuidedPin(symbolPort)) {
    const local = guidedPinPoint(symbol, symbolPort, block.width, block.height, port.guideU ?? symbolPort.u)
    if (local) return { x: origin.x + local.x, y: origin.y + local.y }
  }
  if (symbolPort) {
    const local = pinPoint(block.width, block.height, symbolPort)
    return { x: origin.x + local.x, y: origin.y + local.y }
  }
  if (isFreePin(port)) {
    return { x: origin.x + block.width * clampUnit(port.x ?? 0), y: origin.y + block.height * clampUnit(port.y ?? 0) }
  }
  const side = port.side
  const recorded = port.t
  if (typeof recorded === 'number') {
    const local = pinLocal(block.width, block.height, side, recorded)
    return { x: origin.x + local.x, y: origin.y + local.y }
  }
  const mates = portsOnSide(doc.ports, block.id, side)
  const index = mates.findIndex((item) => item.id === port.id)
  const slot = (index + 1) / (mates.length + 1)
  if (side === 'top' || side === 'bottom') {
    return { x: origin.x + block.width * slot, y: side === 'top' ? origin.y : origin.y + block.height }
  }
  return {
    x: side === 'left' ? origin.x : origin.x + block.width,
    y: origin.y + block.height * slot,
  }
}

export function portsOnSide(ports: Port[], blockId: string, side: Port['side']): Port[] {
  return ports.filter((item) => item.blockId === blockId && item.side === side)
}

export function endpointPoint(doc: DiagramDocument, end: Endpoint, origins?: Map<string, Point>): Point | null {
  if (end.kind === 'free') return { x: end.x, y: end.y }
  if (end.kind === 'junction') {
    const junction = doc.junctions.find((item) => item.id === end.junctionId)
    return junction ? { x: junction.x, y: junction.y } : null
  }
  return portAnchor(doc, end.portId, origins)
}

function aligned(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= 0.5 || Math.abs(a.y - b.y) <= 0.5
}

/**
 * Move a terminal onto its port or junction.
 * Only the adjacent bend slides, and only along the axis that keeps the next span orthogonal.
 * Interior bends stay where the user put them.
 */
function pinTerminal(points: Waypoint[], index: number, target: Point): void {
  const inward = index === 0 ? 1 : -1
  const neighbor = index + inward
  points[index] = { ...points[index], x: target.x, y: target.y }
  if (neighbor < 0 || neighbor >= points.length) return
  if (aligned(points[index], points[neighbor])) return
  const beyond = neighbor + inward
  if (beyond >= 0 && beyond < points.length) {
    const nextVertical = Math.abs(points[neighbor].x - points[beyond].x) <= 0.5
    const nextHorizontal = Math.abs(points[neighbor].y - points[beyond].y) <= 0.5
    if (nextVertical) {
      points[neighbor] = { ...points[neighbor], y: target.y }
      return
    }
    if (nextHorizontal) {
      points[neighbor] = { ...points[neighbor], x: target.x }
      return
    }
  }
  const elbow =
    Math.abs(target.x - points[neighbor].x) >= Math.abs(target.y - points[neighbor].y)
      ? { x: points[neighbor].x, y: target.y }
      : { x: target.x, y: points[neighbor].y }
  if (index === 0) points.splice(1, 0, elbow)
  else points.splice(points.length - 1, 0, elbow)
}

function portSide(doc: DiagramDocument, end: Endpoint): Port['side'] | null {
  if (end.kind !== 'port') return null
  return doc.ports.find((port) => port.id === end.portId)?.side ?? null
}

/**
 * One orthogonal route. A right or left port is left horizontally.
 * Fixed waypoints stay in order. This never runs for a manual segment.
 */
function leavesVertically(side: Port['side'] | null): boolean {
  return side === 'top' || side === 'bottom'
}

function outwardPoint(point: Point, side: Port['side'], distance: number): Point {
  if (side === 'left') return { x: point.x - distance, y: point.y }
  if (side === 'top') return { x: point.x, y: point.y - distance }
  if (side === 'bottom') return { x: point.x, y: point.y + distance }
  return { x: point.x + distance, y: point.y }
}

export function autoRoute(start: Point, end: Point, startSide: Port['side'] | null, endSide: Port['side'] | null, fixed: Point[]): Point[] {
  if (fixed.length === 0 && startSide && endSide) {
    if (!leavesVertically(startSide) && !leavesVertically(endSide)) {
      const gap = end.x - start.x
      if (((startSide === 'right' && endSide === 'left' && gap > 8) || (startSide === 'left' && endSide === 'right' && gap < -8))) {
        const trunk = (start.x + end.x) / 2
        return [start, { x: trunk, y: start.y }, { x: trunk, y: end.y }, end]
      }
      const outward = startSide === 'left' ? -40 : 40
      const inward = endSide === 'left' ? -40 : 40
      return simplifyOrthogonal([
        start,
        { x: start.x + outward, y: start.y },
        { x: start.x + outward, y: end.y },
        { x: end.x + inward, y: end.y },
        end,
      ])
    }
    const gapY = end.y - start.y
    if ((startSide === 'bottom' && endSide === 'top' && gapY > 8) || (startSide === 'top' && endSide === 'bottom' && gapY < -8)) {
      const trunk = (start.y + end.y) / 2
      return [start, { x: start.x, y: trunk }, { x: end.x, y: trunk }, end]
    }
    const out = outwardPoint(start, startSide, 40)
    const inn = outwardPoint(end, endSide, 40)
    return simplifyOrthogonal([start, out, { x: out.x, y: inn.y }, inn, end])
  }
  let points: Point[] = [{ ...start }]
  const stops = [...fixed, end]
  stops.forEach((stop, index) => {
    const last = points[points.length - 1]
    const piece = orthogonalTo(last, stop, index === stops.length - 1 ? 'v' : 'h')
    points = [...points, ...piece.slice(1)]
  })
  return simplifyOrthogonal(points)
}

export function samePoint(a: Point, b: Point, epsilon = 0.5): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= epsilon
}

export function orthogonalTo(from: Point, to: Point, prefer: 'h' | 'v'): Point[] {
  if (samePoint(from, to)) return [{ ...from }]
  if (aligned(from, to)) return [{ ...from }, { x: to.x, y: to.y }]
  const mid = prefer === 'h' ? { x: to.x, y: from.y } : { x: from.x, y: to.y }
  return [{ ...from }, mid, { x: to.x, y: to.y }]
}

export function simplifyOrthogonal(points: Waypoint[]): Waypoint[] {
  const next: Waypoint[] = []
  for (const point of points) {
    const last = next[next.length - 1]
    if (last && samePoint(last, point)) continue
    next.push({ x: point.x, y: point.y, ...(point.fixed ? { fixed: true } : {}) })
  }
  let changed = true
  while (changed) {
    changed = false
    for (let index = 1; index < next.length - 1; index += 1) {
      if (next[index].fixed) continue
      const before = next[index - 1]
      const current = next[index]
      const after = next[index + 1]
      const horizontal = Math.abs(before.y - current.y) <= 0.5 && Math.abs(current.y - after.y) <= 0.5
      const vertical = Math.abs(before.x - current.x) <= 0.5 && Math.abs(current.x - after.x) <= 0.5
      if (horizontal || vertical) {
        next.splice(index, 1)
        changed = true
        break
      }
    }
  }
  return next
}

/** Keep ends on their ports and junctions. A manual route is not redrawn. */
export function refreshSegment(doc: DiagramDocument, segment: Segment, origins?: Map<string, Point>): void {
  if (segment.points.length < 2) return
  if (segment.routed === 'auto') {
    const start = endpointPoint(doc, segment.start, origins)
    const end = endpointPoint(doc, segment.end, origins)
    if (!start || !end) return
    const fixed = segment.points.filter((point) => point.fixed).map((point) => ({ x: point.x, y: point.y }))
    segment.points = autoRoute(start, end, portSide(doc, segment.start), portSide(doc, segment.end), fixed)
    return
  }
  const start = endpointPoint(doc, segment.start, origins)
  const end = endpointPoint(doc, segment.end, origins)
  const pts = segment.points.map((point) => ({ ...point }))
  if (start) pinTerminal(pts, 0, start)
  if (end) pinTerminal(pts, pts.length - 1, end)
  segment.points = pts
  if (segment.start.kind === 'free') segment.start = { kind: 'free', x: pts[0].x, y: pts[0].y }
  if (segment.end.kind === 'free') segment.end = { kind: 'free', x: pts[pts.length - 1].x, y: pts[pts.length - 1].y }
}

export function refreshAll(doc: DiagramDocument, origins?: Map<string, Point>): void {
  for (const segment of doc.segments) refreshSegment(doc, segment, origins)
}

export function setTrunkX(segment: Segment, x: number): void {
  if (segment.points.length !== 4) return
  const pts = segment.points.map((point) => ({ ...point }))
  pts[1] = { x, y: pts[0].y }
  pts[2] = { x, y: pts[3].y }
  segment.points = pts
}

/**
 * World position of a segment label (P5a).
 * Legacy: attachment + 1D normal `offset`.
 * With `shift`: attachment (offset ignored) + free (Δx, Δy).
 */
export function segmentLabelPoint(points: Point[], anchor: Extract<LabelAnchor, { kind: 'segment' }>): Point | null {
  const useShift = Boolean(anchor.shift)
  const base = pointOnEdge(points, anchor.edge, anchor.distance, useShift ? 0 : anchor.offset)
  if (!base) return null
  if (!anchor.shift) return base
  return { x: base.x + anchor.shift.x, y: base.y + anchor.shift.y }
}

export function labelPlacement(doc: DiagramDocument, labelId: string, origins?: Map<string, Point>): Point | null {
  const label = doc.labels.find((item) => item.id === labelId)
  if (!label) return null
  const anchor = label.anchor
  if (anchor.kind === 'free') return { x: anchor.x, y: anchor.y }
  const segment = doc.segments.find((item) => item.id === anchor.segmentId)
  if (!segment) return null
  const points = segmentWithLiveEnds(doc, segment, origins)
  return segmentLabelPoint(points, anchor)
}

export function segmentWithLiveEnds(doc: DiagramDocument, segment: Segment, origins?: Map<string, Point>): Point[] {
  const copy: Segment = { ...segment, points: segment.points.map((point) => ({ ...point })), start: segment.start, end: segment.end }
  refreshSegment(doc, copy, origins)
  return copy.points
}

/**
 * Draw a symbol inside one instance.
 * Shape coordinates scale from the symbol box to the instance box.
 * An image that locks its aspect stays unstretched inside its scaled slot.
 * Text keeps its string. The caller draws it at a fixed size in these coordinates.
 */
export function fitSymbolShapes(
  shapes: SymbolShape[],
  labels: SymbolLabel[],
  symbolWidth: number,
  symbolHeight: number,
  instanceWidth: number,
  instanceHeight: number,
): { shapes: SymbolShape[]; labels: SymbolLabel[] } {
  if (symbolWidth <= 0 || symbolHeight <= 0) return { shapes, labels }
  const sx = instanceWidth / symbolWidth
  const sy = instanceHeight / symbolHeight
  const mapX = (value: number) => value * sx
  const mapY = (value: number) => value * sy
  return {
    shapes: shapes.map((shape) => fitShape(shape, mapX, mapY, sx, sy)),
    labels: labels.map((label) => ({ ...label, x: mapX(label.x), y: mapY(label.y) })),
  }
}

function fitShape(shape: SymbolShape, mapX: (value: number) => number, mapY: (value: number) => number, sx: number, sy: number): SymbolShape {
  if (shape.kind === 'line') {
    return { ...shape, x1: mapX(shape.x1), y1: mapY(shape.y1), x2: mapX(shape.x2), y2: mapY(shape.y2) }
  }
  if (shape.kind === 'polygon') {
    return { ...shape, points: shape.points.map((point) => ({ x: mapX(point.x), y: mapY(point.y) })) }
  }
  if (shape.kind === 'text') return { ...shape, x: mapX(shape.x), y: mapY(shape.y) }
  if (shape.kind === 'image' && shape.lockAspect !== false && shape.width > 0 && shape.height > 0) {
    const slotX = mapX(shape.x)
    const slotY = mapY(shape.y)
    const slotWidth = shape.width * sx
    const slotHeight = shape.height * sy
    const aspect = shape.width / shape.height
    let width = slotWidth
    let height = width / aspect
    if (height > slotHeight) {
      height = slotHeight
      width = height * aspect
    }
    return {
      ...shape,
      x: slotX + (slotWidth - width) / 2,
      y: slotY + (slotHeight - height) / 2,
      width,
      height,
    }
  }
  if (shape.kind === 'rect' || shape.kind === 'ellipse' || shape.kind === 'image') {
    return { ...shape, x: mapX(shape.x), y: mapY(shape.y), width: shape.width * sx, height: shape.height * sy }
  }
  return shape
}

/**
 * Port↔Free stub attached to `blockId` (either orientation).
 * Other stubs that only share the net name are not included.
 */
export function isBlockAttachedStub(doc: DiagramDocument, segment: Segment, blockId: string): boolean {
  const startOnBlock = segment.start.kind === 'port' && portBelongsToBlock(doc, segment.start.portId, blockId)
  const endOnBlock = segment.end.kind === 'port' && portBelongsToBlock(doc, segment.end.portId, blockId)
  const startFree = segment.start.kind === 'free'
  const endFree = segment.end.kind === 'free'
  return (startOnBlock && endFree) || (endOnBlock && startFree)
}

function portBelongsToBlock(doc: DiagramDocument, portId: string, blockId: string): boolean {
  return doc.ports.some((port) => port.id === portId && port.blockId === blockId)
}

/** Rigid translation of stub geometry (all points + free endpoint). Labels follow via segment anchors. */
export function translateSegmentGeometry(segment: Segment, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return
  segment.points = segment.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy }))
  if (segment.start.kind === 'free') {
    segment.start = { kind: 'free', x: segment.start.x + dx, y: segment.start.y + dy }
  }
  if (segment.end.kind === 'free') {
    segment.end = { kind: 'free', x: segment.end.x + dx, y: segment.end.y + dy }
  }
}

/** Port↔Free stub attached to a specific port (either orientation). */
export function isPortAttachedStub(segment: Segment, portId: string): boolean {
  const startPort = segment.start.kind === 'port' && segment.start.portId === portId
  const endPort = segment.end.kind === 'port' && segment.end.portId === portId
  const startFree = segment.start.kind === 'free'
  const endFree = segment.end.kind === 'free'
  return (startPort && endFree) || (endPort && startFree)
}

/** Snapshot of current port anchors (optionally limited to one block). */
export function capturePortAnchors(doc: DiagramDocument, blockId?: string): Map<string, Point> {
  const map = new Map<string, Point>()
  for (const port of doc.ports) {
    if (blockId && port.blockId !== blockId) continue
    const at = portAnchor(doc, port.id)
    if (at) map.set(port.id, { x: at.x, y: at.y })
  }
  return map
}

/** Per-port Δ from a prior `capturePortAnchors` snapshot to current positions. */
export function portAnchorDeltas(doc: DiagramDocument, before: Map<string, Point>): Map<string, Point> {
  const deltas = new Map<string, Point>()
  for (const [portId, prev] of before) {
    const next = portAnchor(doc, portId)
    if (!next) continue
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    if (dx !== 0 || dy !== 0) deltas.set(portId, { x: dx, y: dy })
  }
  return deltas
}

/**
 * Translate each Port↔Free stub by its attached port’s Δ.
 * Shared by block move, resize, and port drag. Non-stub segments are untouched here
 * (callers still `refreshAll` for rubber-band ends).
 */
export function translateAttachedStubsByPortDeltas(doc: DiagramDocument, deltas: Map<string, Point>): void {
  if (deltas.size === 0) return
  const seen = new Set<string>()
  for (const [portId, delta] of deltas) {
    if (delta.x === 0 && delta.y === 0) continue
    for (const segment of doc.segments) {
      if (seen.has(segment.id)) continue
      if (!isPortAttachedStub(segment, portId)) continue
      seen.add(segment.id)
      translateSegmentGeometry(segment, delta.x, delta.y)
    }
  }
}

/**
 * Move a block. Attached Port↔Free stubs follow each port’s actual Δ
 * (HDL Designer–like). Port↔Port / junction / free↔free keep rubber-band refresh.
 */
export function moveBlock(doc: DiagramDocument, blockId: string, x: number, y: number): void {
  const block = doc.blocks.find((item) => item.id === blockId)
  if (!block) return
  const before = capturePortAnchors(doc, blockId)
  block.x = x
  block.y = y
  translateAttachedStubsByPortDeltas(doc, portAnchorDeltas(doc, before))
  refreshAll(doc)
}

export function growForPorts(block: Block, ports: Port[]): void {
  const count = Math.max(
    ports.filter((item) => item.blockId === block.id && item.side === 'left').length,
    ports.filter((item) => item.blockId === block.id && item.side === 'right').length,
  )
  block.height = Math.max(block.height, (count + 1) * 28)
}

export function nearestPort(doc: DiagramDocument, point: Point, radius: number): string | null {
  let best: { id: string; distance: number } | null = null
  for (const port of doc.ports) {
    const anchor = portAnchor(doc, port.id)
    if (!anchor) continue
    const distance = Math.hypot(anchor.x - point.x, anchor.y - point.y)
    if (distance <= radius && (best === null || distance < best.distance)) best = { id: port.id, distance }
  }
  return best?.id ?? null
}
