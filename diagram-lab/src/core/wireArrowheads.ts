/**
 * A2-P5c — wire arrowhead presentation (manual + automatic).
 * Derived only; does not mutate nets, segments, or geometry.
 */

import type { DiagramDocument, DiagramPresentation, Endpoint, Segment } from './document'
import { resolvePortDirection } from './portDirection'

export type ArrowheadDiagramDefault = 'none' | 'automatic'
export type ArrowheadSegmentOverride = 'inherit' | 'none' | 'automatic' | 'start' | 'end' | 'both'
export type EffectiveArrowheadMode = 'none' | 'automatic' | 'start' | 'end' | 'both'

export type SegmentArrowMarkers = {
  markerStart: boolean
  markerEnd: boolean
  mode: EffectiveArrowheadMode
}

type EndpointWhich = 'start' | 'end'
type ReceiverKey = `${string}:${EndpointWhich}`

function receiverKey(segmentId: string, which: EndpointWhich): ReceiverKey {
  return `${segmentId}:${which}`
}

export function diagramArrowheadDefault(doc: DiagramDocument): ArrowheadDiagramDefault {
  const value = doc.presentation?.arrowheadDefault
  return value === 'automatic' ? 'automatic' : 'none'
}

export function effectiveArrowheadMode(doc: DiagramDocument, segment: Segment): EffectiveArrowheadMode {
  const override = segment.arrowheads
  if (override && override !== 'inherit') {
    if (override === 'automatic') return 'automatic'
    return override
  }
  return diagramArrowheadDefault(doc) === 'automatic' ? 'automatic' : 'none'
}

export type NetArrowAnalysis = {
  /** When false, automatic mode draws nothing on this net. */
  automatic: boolean
  receivers: Set<ReceiverKey>
}

function endpointNode(endpoint: Endpoint): string {
  if (endpoint.kind === 'port') return `p:${endpoint.portId}`
  if (endpoint.kind === 'junction') return `j:${endpoint.junctionId}`
  return `f:${endpoint.x}:${endpoint.y}`
}

/** Electrically connected segment sets within one net id (rename-merge can share an id across disjoint pieces). */
export function connectedSegmentGroups(segments: Segment[]): Segment[][] {
  if (segments.length === 0) return []
  const parent = new Map<string, string>()
  const makeSet = (id: string) => {
    if (!parent.has(id)) parent.set(id, id)
  }
  const find = (id: string): string => {
    makeSet(id)
    let root = id
    const stack: string[] = []
    while (parent.get(root) !== root) {
      stack.push(root)
      root = parent.get(root)!
    }
    for (const node of stack) parent.set(node, root)
    return root
  }
  const unite = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(rb, ra)
  }
  for (const segment of segments) {
    unite(endpointNode(segment.start), endpointNode(segment.end))
  }
  const groups = new Map<string, Segment[]>()
  for (const segment of segments) {
    const root = find(endpointNode(segment.start))
    const list = groups.get(root) ?? []
    list.push(segment)
    groups.set(root, list)
  }
  return [...groups.values()]
}

/**
 * Per-segment automatic arrow analyses — map key is **segment id**.
 * Logical rules use the full canonical `netId` (all segments); each segment shares one analysis.
 */
export function buildNetArrowAnalyses(doc: DiagramDocument): Map<string, NetArrowAnalysis> {
  const byNet = new Map<string, Segment[]>()
  for (const segment of doc.segments) {
    const list = byNet.get(segment.netId) ?? []
    list.push(segment)
    byNet.set(segment.netId, list)
  }
  const result = new Map<string, NetArrowAnalysis>()
  for (const segments of byNet.values()) {
    const analysis = analyzeNet(doc, segments)
    for (const segment of segments) result.set(segment.id, analysis)
  }
  return result
}

const EMPTY: NetArrowAnalysis = { automatic: false, receivers: new Set() }

function portIdAt(endpoint: Endpoint): string | null {
  return endpoint.kind === 'port' ? endpoint.portId : null
}

function portLabel(doc: DiagramDocument, portId: string): string {
  const port = doc.ports.find((item) => item.id === portId)
  if (!port) return portId
  const block = doc.blocks.find((item) => item.id === port.blockId)
  const blockName = block?.name?.trim() || block?.id || '?'
  return `“${port.name ?? portId}” (${blockName})`
}

function collectPortsOnNet(segments: Segment[]): Set<string> {
  const ids = new Set<string>()
  for (const segment of segments) {
    const a = portIdAt(segment.start)
    const b = portIdAt(segment.end)
    if (a) ids.add(a)
    if (b) ids.add(b)
  }
  return ids
}

function stubReceivers(doc: DiagramDocument, segment: Segment): ReceiverKey[] {
  const keys: ReceiverKey[] = []
  if (segment.start.kind === 'port' && segment.end.kind === 'free') {
    const dir = resolvePortDirection(doc, segment.start.portId)
    if (dir === 'out') keys.push(receiverKey(segment.id, 'end'))
    else if (dir === 'in') keys.push(receiverKey(segment.id, 'start'))
  }
  if (segment.start.kind === 'free' && segment.end.kind === 'port') {
    const dir = resolvePortDirection(doc, segment.end.portId)
    if (dir === 'out') keys.push(receiverKey(segment.id, 'start'))
    else if (dir === 'in') keys.push(receiverKey(segment.id, 'end'))
  }
  return keys
}

function analyzeNet(doc: DiagramDocument, segments: Segment[]): NetArrowAnalysis {
  const portIds = collectPortsOnNet(segments)
  const directions = new Map<string, ReturnType<typeof resolvePortDirection>>()
  for (const portId of portIds) {
    const dir = resolvePortDirection(doc, portId)
    if (dir === 'unspecified' || dir === 'inout') return EMPTY
    directions.set(portId, dir)
  }

  const outs = [...portIds].filter((id) => directions.get(id) === 'out')
  const ins = [...portIds].filter((id) => directions.get(id) === 'in')

  const receivers = new Set<ReceiverKey>()

  if (outs.length === 1 && ins.length >= 1) {
    for (const segment of segments) {
      for (const which of ['start', 'end'] as const) {
        const ep = segment[which]
        if (ep.kind === 'port' && directions.get(ep.portId) === 'in') {
          receivers.add(receiverKey(segment.id, which))
        }
      }
      for (const key of stubReceivers(doc, segment)) receivers.add(key)
    }
    return { automatic: true, receivers }
  }

  if (outs.length === 1 && ins.length === 0) {
    for (const segment of segments) {
      for (const key of stubReceivers(doc, segment)) receivers.add(key)
    }
    if (receivers.size > 0) return { automatic: true, receivers }
    return EMPTY
  }

  if (outs.length === 0 && ins.length === 1) {
    for (const segment of segments) {
      for (const key of stubReceivers(doc, segment)) receivers.add(key)
    }
    if (receivers.size > 0) return { automatic: true, receivers }
    return EMPTY
  }

  return EMPTY
}

/** Human-readable reason automatic arrows are off for one net (inspector / debugging). */
export function automaticNetStatus(
  doc: DiagramDocument,
  netId: string,
  segmentId?: string,
): { ok: boolean; detail: string } {
  if (diagramArrowheadDefault(doc) !== 'automatic') {
    return { ok: false, detail: 'Diagram default is None (set Automatic in sheet properties).' }
  }
  const segments = doc.segments.filter((segment) => segment.netId === netId)
  if (segments.length === 0) return { ok: false, detail: 'This net has no wire segments.' }
  const groups = connectedSegmentGroups(segments)
  const disjointHint =
    groups.length > 1
      ? ` ${groups.length} unconnected geometric groups share this net id (logical rules use all ${segments.length} segment${segments.length === 1 ? '' : 's'}).`
      : ''
  const localHint =
    segmentId && groups.length > 1
      ? (() => {
          const group = groups.find((g) => g.some((item) => item.id === segmentId))
          if (!group || group.length === segments.length) return ''
          return ` Selected wire: ${group.length} segment${group.length === 1 ? '' : 's'} in its geometric group.`
        })()
      : ''
  const portIds = collectPortsOnNet(segments)
  const mergeHint =
    portIds.size > 3
      ? ` This net has ${portIds.size} distinct ports.`
      : ''
  const directions = new Map<string, ReturnType<typeof resolvePortDirection>>()
  const unspecified: string[] = []
  const inouts: string[] = []
  for (const portId of portIds) {
    const dir = resolvePortDirection(doc, portId)
    directions.set(portId, dir)
    if (dir === 'unspecified') unspecified.push(portLabel(doc, portId))
    else if (dir === 'inout') inouts.push(portLabel(doc, portId))
  }
  if (unspecified.length > 0) {
    const more = unspecified.length > 1 ? ` (+${unspecified.length - 1} more on this net)` : ''
    return {
      ok: false,
      detail: `Port ${unspecified[0]} has no direction (set in/out in the port inspector).${more}${mergeHint}${disjointHint}${localHint}`,
    }
  }
  if (inouts.length > 0) {
    return {
      ok: false,
      detail: `Port ${inouts[0]} is inout; automatic needs only in or out on this net.${mergeHint}${disjointHint}${localHint}`,
    }
  }
  const outs = [...portIds].filter((id) => directions.get(id) === 'out')
  const ins = [...portIds].filter((id) => directions.get(id) === 'in')
  if (outs.length === 0 && ins.length === 0) {
    return { ok: false, detail: 'No port endpoints on this net (only junctions or free ends without a driver/receiver).' }
  }
  if (outs.length > 1) {
    return { ok: false, detail: `${outs.length} outputs on this net — automatic needs exactly one out.${mergeHint}${disjointHint}${localHint}` }
  }
  if (outs.length === 0 && ins.length > 1) {
    return { ok: false, detail: 'Multiple inputs and no output on this net.' }
  }
  if (outs.length === 1 && ins.length === 0) {
    const analysis = analyzeNet(doc, segments)
    if (!analysis.automatic) return { ok: false, detail: 'Output stub needs a free end or valid stub topology.' }
    return { ok: true, detail: 'Automatic: arrow on the stub away from the output.' }
  }
  if (outs.length === 0 && ins.length === 1) {
    const analysis = analyzeNet(doc, segments)
    if (!analysis.automatic) return { ok: false, detail: 'Input stub could not place an arrow.' }
    return { ok: true, detail: 'Automatic: arrow at the input port.' }
  }
  const analysis = analyzeNet(doc, segments)
  if (!analysis.automatic) {
    return {
      ok: false,
      detail: `This net does not match automatic rules on the canonical net id.${disjointHint}${localHint}`,
    }
  }
  return {
    ok: true,
    detail: `Automatic: ${analysis.receivers.size} arrow${analysis.receivers.size === 1 ? '' : 's'} toward input port(s).${disjointHint}${localHint}`,
  }
}

export function segmentArrowMarkers(
  doc: DiagramDocument,
  segment: Segment,
  analyses: Map<string, NetArrowAnalysis>,
): SegmentArrowMarkers {
  const mode = effectiveArrowheadMode(doc, segment)
  if (mode === 'none') return { markerStart: false, markerEnd: false, mode }
  if (mode === 'start') return { markerStart: true, markerEnd: false, mode }
  if (mode === 'end') return { markerStart: false, markerEnd: true, mode }
  if (mode === 'both') return { markerStart: true, markerEnd: true, mode }

  const analysis = analyses.get(segment.id) ?? EMPTY
  if (!analysis.automatic) return { markerStart: false, markerEnd: false, mode: 'automatic' }
  return {
    markerStart: analysis.receivers.has(receiverKey(segment.id, 'start')),
    markerEnd: analysis.receivers.has(receiverKey(segment.id, 'end')),
    mode: 'automatic',
  }
}

export function setDiagramArrowheadDefault(doc: DiagramDocument, value: ArrowheadDiagramDefault): boolean {
  if (value === 'none') {
    if (doc.presentation?.arrowheadDefault !== 'automatic') return false
    delete doc.presentation!.arrowheadDefault
    if (Object.keys(doc.presentation ?? {}).length === 0) delete doc.presentation
    return true
  }
  if (doc.presentation?.arrowheadDefault === 'automatic') return false
  doc.presentation = { ...(doc.presentation ?? {}), arrowheadDefault: 'automatic' }
  return true
}

export function setSegmentArrowheads(
  doc: DiagramDocument,
  segmentId: string,
  override: ArrowheadSegmentOverride | null,
): boolean {
  const segment = doc.segments.find((item) => item.id === segmentId)
  if (!segment) return false
  if (override === null || override === 'inherit') {
    if (segment.arrowheads === undefined) return false
    delete segment.arrowheads
    return true
  }
  if (segment.arrowheads === override) return false
  segment.arrowheads = override
  return true
}

export function resetSegmentArrowheads(doc: DiagramDocument, segmentId: string): boolean {
  return setSegmentArrowheads(doc, segmentId, null)
}