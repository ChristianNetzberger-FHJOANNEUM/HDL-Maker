import type { EditableDiagram, EditableWire } from '../../models/editable'

export function sourceDelta(scale: number, flowDx: number, flowDy: number): { dx: number; dy: number } {
  return {
    dx: Math.round(flowDx / scale),
    dy: Math.round(-flowDy / scale),
  }
}

export function mapX(originX: number, scale: number, x: number): number {
  return (x - originX) * scale
}

export function mapY(originY: number, scale: number, y: number): number {
  return (originY - y) * scale
}

export function translateOwner(diagram: EditableDiagram, ownerId: string, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return
  moveBox(diagram, ownerId, dx, dy)
  for (const wire of diagram.wires) {
    const attached = attachedEnds(wire, ownerId)
    if (attached.has('start') && attached.has('end')) {
      for (const point of wire.points) {
        point.x += dx
        point.y += dy
      }
    } else if (attached.has('start')) {
      stickEnd(wire.points, true, dx, dy)
    } else if (attached.has('end')) {
      stickEnd(wire.points, false, dx, dy)
    }
  }
}

function attachedEnds(wire: EditableWire, ownerId: string): Set<string> {
  const found = new Set<string>()
  if (wire.start?.owner_id === ownerId) found.add('start')
  if (wire.end?.owner_id === ownerId) found.add('end')
  return found
}

function stickEnd(points: { x: number; y: number }[], atStart: boolean, dx: number, dy: number): void {
  if (points.length === 0) return
  if (points.length === 1) {
    points[0].x += dx
    points[0].y += dy
    return
  }
  const index = atStart ? 0 : points.length - 1
  const neighbor = atStart ? 1 : points.length - 2
  const origin = points[index]
  const other = points[neighbor]
  const moved = { x: origin.x + dx, y: origin.y + dy }
  const horizontal = origin.y === other.y && origin.x !== other.x
  const vertical = origin.x === other.x && origin.y !== other.y
  const farEnd = points.length === 2
  if (horizontal && farEnd && moved.y !== other.y) {
    insertCorner(points, atStart, moved, { x: other.x, y: moved.y })
    return
  }
  if (vertical && farEnd && moved.x !== other.x) {
    insertCorner(points, atStart, moved, { x: moved.x, y: other.y })
    return
  }
  origin.x = moved.x
  origin.y = moved.y
  if (farEnd) return
  if (horizontal) other.y = moved.y
  else if (vertical) other.x = moved.x
}

function insertCorner(
  points: { x: number; y: number }[],
  atStart: boolean,
  endpoint: { x: number; y: number },
  corner: { x: number; y: number },
): void {
  if (atStart) {
    points[0] = endpoint
    points.splice(1, 0, corner)
    return
  }
  points[points.length - 1] = endpoint
  points.splice(points.length - 1, 0, corner)
}

function moveBox(diagram: EditableDiagram, ownerId: string, dx: number, dy: number): void {
  for (const instance of diagram.instances) {
    if (instance.id !== ownerId) continue
    instance.x += dx
    instance.y += dy
    for (const port of instance.ports) {
      if (port.x1 !== null) port.x1 += dx
      if (port.x2 !== null) port.x2 += dx
      if (port.y1 !== null) port.y1 += dy
      if (port.y2 !== null) port.y2 += dy
    }
    return
  }
  for (const port of diagram.diagram_ports) {
    if (port.id === ownerId) {
      port.x += dx
      port.y += dy
      return
    }
  }
  for (const block of diagram.embedded_blocks) {
    if (block.id === ownerId) {
      block.x += dx
      block.y += dy
      return
    }
  }
  for (const junction of diagram.junctions) {
    if (junction.id === ownerId) {
      junction.x += dx
      junction.y += dy
      return
    }
  }
  for (const label of diagram.labels) {
    if (label.id === ownerId) {
      label.x += dx
      label.y += dy
      return
    }
  }
}

export function elbow(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number }[] {
  if (from.x === to.x || from.y === to.y) return [from, to]
  return [from, { x: to.x, y: from.y }, to]
}
