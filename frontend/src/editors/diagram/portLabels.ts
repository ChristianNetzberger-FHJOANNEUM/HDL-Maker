import type { EditableInstance, EditablePort } from '../../models/editable'

export interface PortAnchor {
  side: 'left' | 'right'
  left: string
  top: string
  leftPx: number
  topPx: number
}

export type PortLabelStyle = 'short' | 'long'

export interface PortLabel {
  id: string
  text: string
  title: string
  side: 'left' | 'right'
  top: number
  fontSize: number
}

export function portAnchor(instance: EditableInstance, port: EditablePort, height: number, width: number): PortAnchor {
  if (port.x1 === null || port.y1 === null || port.x2 === null || port.y2 === null || instance.width === 0 || instance.height === 0) {
    const outgoing = port.direction === 'out' || port.direction === 'buffer'
    const group = instance.ports.filter((item) => (item.direction === 'out' || item.direction === 'buffer') === outgoing)
    const index = Math.max(group.indexOf(port), 0)
    const topPx = ((index + 1) / (group.length + 1)) * height
    return {
      side: outgoing ? 'right' : 'left',
      left: outgoing ? '100%' : '0%',
      top: `${(topPx / height) * 100}%`,
      leftPx: outgoing ? width : 0,
      topPx,
    }
  }
  const leftPx = (((port.x1 + port.x2) / 2 - instance.x) / instance.width) * width
  const topPx = ((instance.y - (port.y1 + port.y2) / 2) / instance.height) * height
  const side = leftPx < width / 2 ? 'left' : 'right'
  return {
    side,
    left: `${(leftPx / width) * 100}%`,
    top: `${(topPx / height) * 100}%`,
    leftPx,
    topPx,
  }
}

export function portCaption(
  port: { name: string; direction?: string | null; type_text?: string | null; range_text?: string | null },
  style: PortLabelStyle,
): string {
  if (style === 'short') {
    const compact = compactRange(port.range_text)
    return compact ? `${port.name}${compact}` : port.name
  }
  const parts: string[] = []
  if (port.direction) parts.push(port.direction)
  const typed = typeWithRange(port.type_text, port.range_text)
  if (typed) parts.push(typed)
  return parts.length ? `${port.name}: ${parts.join(' ')}` : port.name
}

function typeWithRange(typeText: string | null | undefined, rangeText: string | null | undefined): string {
  const typeName = typeText?.trim() ?? ''
  const range = rangeText?.trim() ?? ''
  if (!range) return typeName
  const wrapped = range.startsWith('(') ? range : `(${range})`
  return typeName ? `${typeName}${wrapped}` : wrapped
}

function compactRange(rangeText: string | null | undefined): string | null {
  if (!rangeText) return null
  let text = rangeText.trim()
  if (text.startsWith('(') && text.endsWith(')')) text = text.slice(1, -1).trim()
  const match = text.match(/^(.+)\s+(?:downto|to)\s+(.+)$/i)
  if (!match) return null
  const left = match[1].trim()
  const right = match[2].trim()
  if (!left || !right) return null
  return `(${left}:${right})`
}

export interface AnchoredPort {
  id: string
  name: string
  direction: string | null
  type_text: string | null
  range_text: string | null
  leftPx: number
  topPx: number
}

export function layoutPortLabels(instance: EditableInstance, width: number, height: number, style: PortLabelStyle = 'short'): PortLabel[] {
  return layoutAnchoredPorts(
    instance.ports.map((port) => {
      const anchor = portAnchor(instance, port, height, width)
      return {
        id: port.id,
        name: port.name,
        direction: port.direction,
        type_text: port.type_text,
        range_text: port.range_text,
        leftPx: anchor.leftPx,
        topPx: anchor.topPx,
      }
    }),
    width,
    style,
  )
}

export function layoutAnchoredPorts(ports: AnchoredPort[], width: number, style: PortLabelStyle = 'short'): PortLabel[] {
  const placed = ports.map((port) => ({
    port,
    side: (port.leftPx < width / 2 ? 'left' : 'right') as 'left' | 'right',
    topPx: port.topPx,
  }))
  const fontSize = fontForPitch(placed.map((item) => item.topPx))
  return placed.map((item) => ({
    id: item.port.id,
    text: portCaption(item.port, style),
    title: portCaption(item.port, 'long'),
    side: item.side,
    top: item.topPx,
    fontSize,
  }))
}

function fontForPitch(tops: number[]): number {
  const sorted = [...tops].sort((left, right) => left - right)
  let pitch = 13
  for (let index = 1; index < sorted.length; index += 1) {
    const gap = sorted[index] - sorted[index - 1]
    if (gap > 0.4) pitch = Math.min(pitch, gap)
  }
  return Math.max(1, Math.min(11, pitch * 0.8))
}

export interface SignalLabel {
  id: string
  text: string
  title: string
  x: number
  y: number
  fontSize: number
}

export function signalStroke(rangeText: string | null | undefined): number {
  return rangeText && rangeText.trim() ? 1.15 : 0.6
}

export function layoutSignalLabels(
  wires: {
    id: string
    net_object: number | null
    label?: { text: string; x1: number; y1: number; x2: number; y2: number; hidden: boolean } | null
  }[],
  nets: { name: string; hds_object: number | null; type_text?: string | null; range_text?: string | null }[],
  mapX: (value: number) => number,
  mapY: (value: number) => number,
  style: PortLabelStyle,
): SignalLabel[] {
  const byObject = new Map<number, (typeof nets)[number]>()
  for (const net of nets) {
    if (net.hds_object !== null) byObject.set(net.hds_object, net)
  }
  const labels: SignalLabel[] = []
  for (const wire of wires) {
    const box = wire.label
    if (!box || box.hidden || !box.text) continue
    const net = wire.net_object === null ? undefined : byObject.get(wire.net_object)
    const left = mapX(Math.min(box.x1, box.x2))
    const right = mapX(Math.max(box.x1, box.x2))
    const top = mapY(Math.max(box.y1, box.y2))
    const bottom = mapY(Math.min(box.y1, box.y2))
    if (right - left <= 0 || bottom - top <= 0) continue
    const source = net ?? { name: box.text, type_text: null, range_text: null }
    labels.push({
      id: wire.id,
      text: portCaption(source, style),
      title: portCaption(source, 'long'),
      x: (left + right) / 2,
      y: top,
      fontSize: Math.max(1, Math.min(11, (bottom - top) * 0.8)),
    })
  }
  return labels
}
