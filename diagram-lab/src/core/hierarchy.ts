import {
  componentById,
  documentById,
  findCycles,
  instancesOf,
  type DiagramProject,
  type ProjectResult,
} from './component'
import {
  createId,
  type DiagramDocument,
  type Endpoint,
  type Point,
  type PortSide,
  type Segment,
  type SymbolDefinition,
} from './document'
import { emptyDocument } from './edit'
import { portAnchor, refreshAll } from './geometry'
import { adoptLibrarySymbol, cloneSymbol } from './library'
import { defineSymbol, instantiateSymbol, releaseUnboundSymbolPorts } from './symbols'

export type ExtractPortPlan = {
  name: string
  side: PortSide
  netId: string
  netName: string
}

export type ExtractPreview =
  | { ok: true; blockIds: string[]; ports: ExtractPortPlan[]; internalNetIds: string[]; notes: string[] }
  | { ok: false; message: string; notes: string[] }

export type ExpandPreview =
  | { ok: true; blockId: string; blockName: string; componentName: string; moving: string[]; notes: string[] }
  | { ok: false; message: string; notes: string[] }

type Role = 'in' | 'out' | 'split' | 'bridge'
type Home = 'in' | 'out' | 'split'

type AnalyzedNet = {
  netId: string
  netName: string
  kind: 'internal' | 'cross'
  portName: string | null
  side: PortSide | null
  roles: Map<string, Role>
}

type Inspect =
  | { ok: false; message: string; notes: string[] }
  | { ok: true; blockIds: string[]; nets: AnalyzedNet[]; notes: string[]; internalNetIds: string[]; ports: ExtractPortPlan[] }

const SIDES: PortSide[] = ['left', 'right', 'top', 'bottom']

function cloneProject(project: DiagramProject): DiagramProject {
  return JSON.parse(JSON.stringify(project)) as DiagramProject
}

function fail(project: DiagramProject, message: string): { ok: false; project: DiagramProject; message: string } {
  return { ok: false, project, message }
}

function endpointKey(segmentId: string, end: Endpoint, which: 'start' | 'end'): string {
  if (end.kind === 'port') return `port:${end.portId}`
  if (end.kind === 'junction') return `junction:${end.junctionId}`
  return `free:${segmentId}:${which}`
}

function blockOfPort(document: DiagramDocument, portId: string): string | null {
  return document.ports.find((port) => port.id === portId)?.blockId ?? null
}

function without(adj: Map<string, Set<string>>, drop: Set<string>): Map<string, Set<string>> {
  const next = new Map<string, Set<string>>()
  for (const [node, neighbors] of adj) {
    if (drop.has(node)) continue
    next.set(node, new Set([...neighbors].filter((item) => !drop.has(item))))
  }
  return next
}

function peel(adj: Map<string, Set<string>>, terminals: Set<string>): { core: Set<string>; attached: Set<string> } {
  const core = new Set<string>()
  const attached = new Set<string>()
  const seen = new Set<string>()
  for (const start of adj.keys()) {
    if (seen.has(start)) continue
    const stack = [start]
    const part: string[] = []
    seen.add(start)
    while (stack.length > 0) {
      const node = stack.pop()
      if (!node) continue
      part.push(node)
      for (const next of adj.get(node) ?? []) {
        if (!seen.has(next)) {
          seen.add(next)
          stack.push(next)
        }
      }
    }
    if (!part.some((node) => terminals.has(node))) continue
    const graph = new Map<string, Set<string>>()
    const keep = new Set(part)
    for (const node of part) graph.set(node, new Set([...(adj.get(node) ?? [])].filter((item) => keep.has(item))))
    let changed = true
    while (changed) {
      changed = false
      for (const [node, neighbors] of [...graph]) {
        if (terminals.has(node) || neighbors.size > 1) continue
        attached.add(node)
        for (const neighbor of neighbors) graph.get(neighbor)?.delete(node)
        graph.delete(node)
        changed = true
      }
    }
    for (const node of graph.keys()) core.add(node)
  }
  return { core, attached }
}

function pointOf(document: DiagramDocument, key: string, segmentLookup: Map<string, Segment>): Point | null {
  if (key.startsWith('port:')) return portAnchor(document, key.slice(5))
  if (key.startsWith('junction:')) {
    const junction = document.junctions.find((item) => item.id === key.slice(9))
    return junction ? { x: junction.x, y: junction.y } : null
  }
  const [, segmentId, which] = key.split(':')
  const segment = segmentId ? segmentLookup.get(segmentId) : undefined
  const end = which === 'start' ? segment?.start : segment?.end
  if (end?.kind === 'free') return { x: end.x, y: end.y }
  const index = which === 'start' ? 0 : (segment?.points.length ?? 1) - 1
  const point = segment?.points[index]
  return point ? { x: point.x, y: point.y } : null
}

function homeOf(key: string, roles: Map<string, Role>, selected: Set<string>): Home {
  if (key.startsWith('port:')) return selected.has(key.slice(5)) ? 'in' : 'out'
  const role = roles.get(key) ?? 'out'
  if (role === 'split') return 'split'
  if (role === 'out') return 'out'
  return 'in'
}

function inspectExtract(document: DiagramDocument, blockIds: string[]): Inspect {
  const selectedBlocks = [...new Set(blockIds)]
  if (selectedBlocks.length < 2) {
    return { ok: false, message: 'Select at least two blocks. The project was not changed.', notes: ['Select at least two blocks.'] }
  }
  if (selectedBlocks.some((id) => !document.blocks.some((block) => block.id === id))) {
    return { ok: false, message: 'Those blocks are not on this sheet. The project was not changed.', notes: ['Those blocks are not on this sheet.'] }
  }
  if (document.blocks.some((block) => selectedBlocks.includes(block.id) && !block.componentId && block.name === 'Boundary')) {
    return { ok: false, message: 'The sheet boundary stays on the sheet. The project was not changed.', notes: ['The sheet boundary stays on the sheet.'] }
  }
  const selected = new Set(selectedBlocks)
  const selectedPorts = new Set(document.ports.filter((port) => selected.has(port.blockId)).map((port) => port.id))
  const notes: string[] = []
  const blocking: string[] = []
  const nets: AnalyzedNet[] = []
  const segmentLookup = new Map(document.segments.map((segment) => [segment.id, segment]))
  const centers = document.blocks.filter((block) => selected.has(block.id))
  const center = {
    x: centers.reduce((sum, block) => sum + block.x + block.width / 2, 0) / centers.length,
    y: centers.reduce((sum, block) => sum + block.y + block.height / 2, 0) / centers.length,
  }

  for (const net of document.nets) {
    const segments = document.segments.filter((segment) => segment.netId === net.id)
    const touches = segments.some(
      (segment) =>
        (segment.start.kind === 'port' && selectedPorts.has(segment.start.portId)) ||
        (segment.end.kind === 'port' && selectedPorts.has(segment.end.portId)),
    )
    if (!touches) continue
    const adj = new Map<string, Set<string>>()
    const link = (left: string, right: string) => {
      const from = adj.get(left) ?? new Set<string>()
      from.add(right)
      adj.set(left, from)
      const back = adj.get(right) ?? new Set<string>()
      back.add(left)
      adj.set(right, back)
    }
    for (const segment of segments) link(endpointKey(segment.id, segment.start, 'start'), endpointKey(segment.id, segment.end, 'end'))
    const inPorts = new Set([...adj.keys()].filter((key) => key.startsWith('port:') && selectedPorts.has(key.slice(5))))
    const outPorts = new Set([...adj.keys()].filter((key) => key.startsWith('port:') && !selectedPorts.has(key.slice(5))))
    const inside = peel(without(adj, outPorts), inPorts)
    const outside = peel(without(adj, inPorts), outPorts)
    const roles = new Map<string, Role>()
    for (const key of adj.keys()) {
      if (key.startsWith('port:')) continue
      const inCore = inside.core.has(key)
      const outCore = outside.core.has(key)
      const inAttached = inside.attached.has(key)
      const outAttached = outside.attached.has(key)
      let role: Role = 'in'
      if (inCore && outCore) role = 'split'
      else if (inCore) role = 'in'
      else if (outCore) role = 'out'
      else if (inAttached && outAttached) role = 'bridge'
      else if (outAttached) role = 'out'
      roles.set(key, role)
      if ((role === 'bridge' || role === 'split') && key.startsWith('free:')) {
        blocking.push(`Net ${net.name || net.id} has a free end on the boundary. Connect it or remove it before extracting.`)
      }
    }
    let splitBridge = false
    let crosses = false
    for (const segment of segments) {
      const start = homeOf(endpointKey(segment.id, segment.start, 'start'), roles, selectedPorts)
      const end = homeOf(endpointKey(segment.id, segment.end, 'end'), roles, selectedPorts)
      if (start === 'split' && end === 'split') splitBridge = true
      if ((start === 'in' && end === 'out') || (start === 'out' && end === 'in')) crosses = true
      if ((start === 'split' && end === 'out') || (start === 'out' && end === 'split')) crosses = true
      if ((start === 'split' && end === 'in') || (start === 'in' && end === 'split')) crosses = true
    }
    if (splitBridge) blocking.push(`Net ${net.name || net.id} has two branch points that each join both sides. The extract was not changed.`)
    const outsideKeys = new Set<string>()
    for (const segment of segments) {
      const startKey = endpointKey(segment.id, segment.start, 'start')
      const endKey = endpointKey(segment.id, segment.end, 'end')
      const start = homeOf(startKey, roles, selectedPorts)
      const end = homeOf(endKey, roles, selectedPorts)
      if (start !== 'in' && end === 'in') outsideKeys.add(startKey)
      if (end !== 'in' && start === 'in') outsideKeys.add(endKey)
      if (start === 'split' || end === 'split') {
        if (start !== 'in') outsideKeys.add(startKey)
        if (end !== 'in') outsideKeys.add(endKey)
      }
    }
    const kind = crosses || outPorts.size > 0 ? 'cross' : 'internal'
    let side: PortSide | null = null
    if (kind === 'cross') {
      const anchors = [...outsideKeys].map((key) => pointOf(document, key, segmentLookup)).filter((point): point is Point => point !== null)
      const anchor = anchors.length
        ? { x: anchors.reduce((sum, point) => sum + point.x, 0) / anchors.length, y: anchors.reduce((sum, point) => sum + point.y, 0) / anchors.length }
        : center
      const dx = anchor.x - center.x
      const dy = anchor.y - center.y
      side = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'top' : 'bottom'
    }
    for (const [key, role] of roles) {
      if (!key.startsWith('junction:')) continue
      if (role === 'split') notes.push(`A junction on ${net.name || net.id} is copied onto both sides.`)
      else if (role === 'out' && kind === 'cross') notes.push(`A junction on ${net.name || net.id} stays outside the new component.`)
      else if (role === 'in' || role === 'bridge') notes.push(`A junction on ${net.name || net.id} moves inside.`)
    }
    nets.push({ netId: net.id, netName: net.name, kind: kind === 'cross' ? 'cross' : 'internal', portName: null, side, roles })
  }

  if (blocking.length > 0) {
    return { ok: false, message: `${blocking[0]} The project was not changed.`, notes: blocking }
  }

  const used = new Set<string>()
  const ports: ExtractPortPlan[] = []
  const crossing = nets.filter((net) => net.kind === 'cross' && net.side)
  crossing.sort((a, b) => SIDES.indexOf(a.side ?? 'left') - SIDES.indexOf(b.side ?? 'left') || a.netName.localeCompare(b.netName) || a.netId.localeCompare(b.netId))
  for (const net of crossing) {
    const base = net.netName.trim() || 'n'
    let name = base
    let index = 2
    while (used.has(name)) {
      name = `${base}_${index}`
      index += 1
    }
    if (name !== base) notes.push(`Nets named ${base} stay separate. The ports are not merged.`)
    used.add(name)
    net.portName = name
    ports.push({ name, side: net.side ?? 'left', netId: net.netId, netName: net.netName })
    notes.push(`Net ${net.netName || net.netId} crosses the selection. Port ${name} is on the ${net.side}.`)
  }
  const internalNetIds = nets.filter((net) => net.kind === 'internal').map((net) => net.netId)
  for (const net of nets.filter((item) => item.kind === 'internal')) notes.push(`Net ${net.netName || net.netId} stays inside the new diagram.`)
  if (document.segments.some((segment) => segment.routed === 'manual')) notes.push('Manual routes are kept.')
  if (document.labels.some((label) => label.anchor.kind === 'segment')) notes.push('Name labels move with their segments.')
  return { ok: true, blockIds: selectedBlocks, nets, notes, internalNetIds, ports }
}

export function previewExtract(project: DiagramProject, documentId: string, blockIds: string[]): ExtractPreview {
  const document = documentById(project, documentId)
  if (!document) return { ok: false, message: 'That diagram is not in the project. The project was not changed.', notes: ['That diagram is not in the project.'] }
  const inspected = inspectExtract(document, blockIds)
  if (!inspected.ok) return inspected
  return { ok: true, blockIds: inspected.blockIds, ports: inspected.ports, internalNetIds: inspected.internalNetIds, notes: inspected.notes }
}

function shiftEnd(end: Endpoint, dx: number, dy: number, splitMap: Map<string, string>): Endpoint {
  if (end.kind === 'free') return { kind: 'free', x: end.x + dx, y: end.y + dy }
  if (end.kind === 'junction' && splitMap.has(end.junctionId)) return { kind: 'junction', junctionId: splitMap.get(end.junctionId) ?? end.junctionId }
  return end.kind === 'junction' ? { kind: 'junction', junctionId: end.junctionId } : { kind: 'port', portId: end.portId }
}

export function extractComponent(
  project: DiagramProject,
  documentId: string,
  blockIds: string[],
  name: string,
): ProjectResult<{ componentId: string; blockId: string; documentId: string }> {
  const trimmed = name.trim()
  const document = documentById(project, documentId)
  if (!document) return fail(project, 'That diagram is not in the project. The project was not changed.')
  if (!trimmed) return fail(project, 'A component needs a name. The project was not changed.')
  const inspected = inspectExtract(document, blockIds)
  if (!inspected.ok) return fail(project, inspected.message)
  const next = cloneProject(project)
  const sheet = documentById(next, documentId)
  if (!sheet) return fail(project, 'That diagram is not in the project. The project was not changed.')
  const selected = new Set(inspected.blockIds)
  const chosen = sheet.blocks.filter((block) => selected.has(block.id))
  const minX = Math.min(...chosen.map((block) => block.x))
  const minY = Math.min(...chosen.map((block) => block.y))
  const dx = 220 - minX
  const dy = 80 - minY
  const child = emptyDocument()
  for (const block of chosen) {
    if (!block.symbolId || child.symbols.some((symbol) => symbol.id === block.symbolId)) continue
    const symbol = sheet.symbols.find((item) => item.id === block.symbolId)
    if (!symbol) continue
    const adopted = adoptLibrarySymbol(child, symbol, sheet.assets)
    if (!adopted.ok) return fail(project, `${adopted.message} The project was not changed.`)
  }
  const childNetOf = new Map<string, string>()
  for (const net of inspected.nets) {
    const source = sheet.nets.find((item) => item.id === net.netId)
    if (!source) continue
    if (net.kind === 'internal') {
      childNetOf.set(net.netId, net.netId)
      continue
    }
    const id = createId('net')
    childNetOf.set(net.netId, id)
    child.nets.push({ id, name: source.name, ...(source.signal ? { signal: JSON.parse(JSON.stringify(source.signal)) as Record<string, unknown> } : {}) })
  }
  const splitMap = new Map<string, string>()
  const movedJunctions = new Set<string>()
  for (const net of inspected.nets) {
    for (const [key, role] of net.roles) {
      if (!key.startsWith('junction:')) continue
      const junctionId = key.slice(9)
      const junction = sheet.junctions.find((item) => item.id === junctionId)
      if (!junction) continue
      if (role === 'split') {
        const copyId = createId('jnc')
        splitMap.set(junctionId, copyId)
        child.junctions.push({ id: copyId, netId: childNetOf.get(net.netId) ?? junction.netId, x: junction.x + dx, y: junction.y + dy })
      } else if (role === 'in' || role === 'bridge') {
        movedJunctions.add(junctionId)
      }
    }
  }
  for (const junction of sheet.junctions) {
    if (!movedJunctions.has(junction.id)) continue
    const owner = inspected.nets.find((net) => net.roles.has(`junction:${junction.id}`))
    junction.x += dx
    junction.y += dy
    junction.netId = childNetOf.get(owner?.netId ?? junction.netId) ?? junction.netId
    child.junctions.push(junction)
  }
  sheet.junctions = sheet.junctions.filter((junction) => !movedJunctions.has(junction.id))

  const movedSegmentIds = new Set<string>()
  const crossing: Array<{ segment: Segment; netId: string; whichIn: 'start' | 'end' }> = []
  const stubKeys = new Map<string, Set<string>>()
  for (const net of inspected.nets) {
    for (const segment of sheet.segments.filter((item) => item.netId === net.netId)) {
      const startKey = endpointKey(segment.id, segment.start, 'start')
      const endKey = endpointKey(segment.id, segment.end, 'end')
      const start = homeOf(startKey, net.roles, new Set(sheet.ports.filter((port) => selected.has(port.blockId)).map((port) => port.id)))
      const end = homeOf(endKey, net.roles, new Set(sheet.ports.filter((port) => selected.has(port.blockId)).map((port) => port.id)))
      if (start === 'split' && end === 'split') return fail(project, `Net ${net.netName || net.netId} has two branch points that each join both sides. The project was not changed.`)
      if (start === 'in' && end === 'in') {
        movedSegmentIds.add(segment.id)
        segment.netId = childNetOf.get(net.netId) ?? segment.netId
        segment.points = segment.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy }))
        segment.start = shiftEnd(segment.start, dx, dy, splitMap)
        segment.end = shiftEnd(segment.end, dx, dy, splitMap)
        child.segments.push(segment)
      } else if ((start === 'split' && end === 'in') || (start === 'in' && end === 'split')) {
        movedSegmentIds.add(segment.id)
        segment.netId = childNetOf.get(net.netId) ?? segment.netId
        segment.points = segment.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy }))
        segment.start = shiftEnd(segment.start, dx, dy, splitMap)
        segment.end = shiftEnd(segment.end, dx, dy, splitMap)
        child.segments.push(segment)
      } else if ((start === 'in' && end === 'out') || (start === 'out' && end === 'in')) {
        crossing.push({ segment, netId: net.netId, whichIn: start === 'in' ? 'start' : 'end' })
        const insideKey = start === 'in' ? startKey : endKey
        const keys = stubKeys.get(net.netId) ?? new Set<string>()
        keys.add(insideKey.startsWith('junction:') && splitMap.has(insideKey.slice(9)) ? `junction:${splitMap.get(insideKey.slice(9))}` : insideKey)
        stubKeys.set(net.netId, keys)
      }
    }
  }
  sheet.segments = sheet.segments.filter((segment) => !movedSegmentIds.has(segment.id))
  const movedLabels = sheet.labels.filter((label) => label.anchor.kind === 'segment' && movedSegmentIds.has(label.anchor.segmentId))
  child.labels.push(...movedLabels)
  sheet.labels = sheet.labels.filter((label) => label.anchor.kind !== 'segment' || !movedSegmentIds.has(label.anchor.segmentId))
  for (const net of inspected.nets.filter((item) => item.kind === 'internal')) {
    const source = sheet.nets.find((item) => item.id === net.netId)
    if (!source) continue
    child.nets.push(source)
    sheet.nets = sheet.nets.filter((item) => item.id !== net.netId)
  }

  for (const block of chosen) {
    block.x += dx
    block.y += dy
    child.blocks.push(block)
  }
  const movedPorts = sheet.ports.filter((port) => selected.has(port.blockId))
  child.ports.push(...movedPorts)
  sheet.blocks = sheet.blocks.filter((block) => !selected.has(block.id))
  sheet.ports = sheet.ports.filter((port) => !selected.has(port.blockId))
  const keptGroups = []
  for (const group of sheet.groups) {
    const moving = group.blockIds.filter((id) => selected.has(id))
    const staying = group.blockIds.filter((id) => !selected.has(id))
    if (moving.length === 0) {
      keptGroups.push(group)
      continue
    }
    if (staying.length === 0) {
      child.groups.push(group)
      continue
    }
    group.blockIds = staying
    keptGroups.push(group)
    if (moving.length >= 2) child.groups.push({ id: createId('grp'), name: group.name, blockIds: moving })
  }
  sheet.groups = keptGroups

  const bySide = new Map<PortSide, ExtractPortPlan[]>()
  for (const side of SIDES) bySide.set(side, [])
  for (const port of inspected.ports) bySide.get(port.side)?.push(port)
  const pins = inspected.ports.map((port) => {
    const mates = bySide.get(port.side) ?? []
    const index = mates.findIndex((item) => item.netId === port.netId)
    return { name: port.name, side: port.side, t: (index + 1) / (mates.length + 1) }
  })
  const height = Math.max(80, ...SIDES.map((side) => (bySide.get(side)?.length ?? 0) * 28))
  const width = Math.max(120, ...SIDES.filter((side) => side === 'top' || side === 'bottom').map((side) => (bySide.get(side)?.length ?? 0) * 28))
  const symbolId = defineSymbol(sheet, { name: trimmed, width, height, ports: pins })
  const symbol = sheet.symbols.find((item) => item.id === symbolId)
  const interfaceOf = new Map<string, string>()
  const pinOf = new Map<string, string>()
  const ports = (symbol?.ports ?? []).map((pin) => {
    const plan = inspected.ports.find((item) => item.name === pin.name && item.side === pin.side)
    const interfacePortId = createId('ifp')
    if (plan) {
      interfaceOf.set(plan.netId, interfacePortId)
      pinOf.set(plan.netId, pin.id)
    }
    return { id: interfacePortId, name: pin.name }
  })
  const componentId = createId('cmp')
  next.components.push({
    id: componentId,
    name: trimmed,
    ports,
    symbolId,
    bindings: ports.flatMap((port) => {
      const plan = inspected.ports.find((item) => item.name === port.name)
      const symbolPortId = plan ? pinOf.get(plan.netId) : undefined
      return symbolPortId ? [{ interfacePortId: port.id, symbolPortId }] : []
    }),
    implementation: { kind: 'diagram', documentId: child.id },
  })
  next.documents.push(child)
  const blockId = instantiateSymbol(sheet, symbolId, { x: minX, y: minY }, trimmed)
  if (!blockId) return fail(project, 'The symbol could not be placed. The project was not changed.')
  const instance = sheet.blocks.find((block) => block.id === blockId)
  if (instance) instance.componentId = componentId
  for (const port of sheet.ports.filter((item) => item.blockId === blockId)) {
    const plan = inspected.ports.find((item) => item.name === port.name && pinOf.get(item.netId) === port.symbolPortId)
    if (plan) port.interfacePortId = interfaceOf.get(plan.netId)
  }
  releaseUnboundSymbolPorts(sheet, blockId)
  const boundary = { id: createId('blk'), name: 'Boundary', x: 40, y: 80, width, height }
  child.blocks.push(boundary)
  const boundaryOf = new Map<string, string>()
  for (const port of ports) {
    const plan = inspected.ports.find((item) => item.name === port.name)
    if (!plan) continue
    const id = createId('prt')
    boundaryOf.set(plan.netId, id)
    child.ports.push({ id, blockId: boundary.id, name: port.name, side: plan.side, t: pins.find((pin) => pin.name === port.name && pin.side === plan.side)?.t ?? 0.5, interfacePortId: port.id })
  }
  for (const item of crossing) {
    const portId = [...sheet.ports.filter((port) => port.blockId === blockId)].find((port) => port.interfacePortId === interfaceOf.get(item.netId))?.id
    if (!portId) continue
    if (item.whichIn === 'start') item.segment.start = { kind: 'port', portId }
    if (item.whichIn === 'end') item.segment.end = { kind: 'port', portId }
  }
  for (const net of inspected.nets.filter((item) => item.kind === 'cross')) {
    const junctionId = [...net.roles.entries()].find(([key, role]) => key.startsWith('junction:') && role === 'split')?.[0]?.slice(9)
    const instancePort = sheet.ports.find((port) => port.blockId === blockId && port.interfacePortId === interfaceOf.get(net.netId))
    const boundaryPort = boundaryOf.get(net.netId)
    const childNet = childNetOf.get(net.netId)
    if (junctionId && instancePort) {
      const at = sheet.junctions.find((item) => item.id === junctionId)
      const anchor = portAnchor(sheet, instancePort.id)
      if (at && anchor) {
        sheet.segments.push({
          id: createId('seg'),
          netId: net.netId,
          routed: 'manual',
          points: [{ x: at.x, y: at.y }, anchor],
          start: { kind: 'junction', junctionId },
          end: { kind: 'port', portId: instancePort.id },
        })
      }
    }
    if (boundaryPort && childNet) {
      const keys = stubKeys.get(net.netId) ?? new Set<string>()
      if (junctionId && splitMap.has(junctionId)) keys.add(`junction:${splitMap.get(junctionId)}`)
      for (const key of keys) {
        const end = key.startsWith('port:')
          ? { kind: 'port' as const, portId: key.slice(5) }
          : key.startsWith('junction:')
            ? { kind: 'junction' as const, junctionId: key.slice(9) }
            : null
        if (!end) continue
        const from = end.kind === 'port' ? portAnchor(child, end.portId) : child.junctions.find((item) => item.id === end.junctionId)
        const to = portAnchor(child, boundaryPort)
        if (!from || !to) continue
        child.segments.push({
          id: createId('seg'),
          netId: childNet,
          routed: 'manual',
          points: [{ x: from.x, y: from.y }, { x: to.x, y: to.y }],
          start: end,
          end: { kind: 'port', portId: boundaryPort },
        })
      }
    }
  }
  refreshAll(sheet)
  refreshAll(child)
  const cycle = findCycles(next)[0]
  if (cycle) return fail(project, `Component cycle: ${cycle.join(' → ')}. The project was not changed.`)
  return { ok: true, project: next, value: { componentId, blockId, documentId: child.id } }
}

function boundaryBlock(document: DiagramDocument): { id: string } | null {
  const found = document.blocks.filter((block) => !block.componentId && block.name === 'Boundary')
  if (found.length !== 1) return null
  return found[0] ?? null
}

export function previewExpand(project: DiagramProject, documentId: string, blockId: string): ExpandPreview {
  const notes: string[] = []
  const document = documentById(project, documentId)
  const block = document?.blocks.find((item) => item.id === blockId)
  if (!document || !block) return { ok: false, message: 'That block is not on this sheet. The project was not changed.', notes: ['That block is not on this sheet.'] }
  if (!block.componentId) return { ok: false, message: `${block.name} is not a component. The project was not changed.`, notes: [`${block.name} is not a component.`] }
  const component = componentById(project, block.componentId)
  if (!component) return { ok: false, message: `${block.name} cites a component that is not in the project.`, notes: ['The component is missing.'] }
  if (component.implementation.kind !== 'diagram' || !component.implementation.documentId) {
    return { ok: false, message: `${component.name} has no diagram to expand. The project was not changed.`, notes: [`${component.name} has no diagram to expand.`] }
  }
  const child = documentById(project, component.implementation.documentId)
  if (!child || child.id === document.id) return { ok: false, message: `${component.name} has no diagram to expand. The project was not changed.`, notes: ['The implementation diagram is missing.'] }
  const boundary = boundaryBlock(child)
  if (!boundary) return { ok: false, message: `${component.name} has no single Boundary block. The project was not changed.`, notes: [`${component.name} has no single Boundary block.`] }
  const connectors = child.ports.filter((port) => port.blockId === boundary.id)
  const seen = new Set<string>()
  for (const port of connectors) {
    if (!port.interfacePortId || !component.ports.some((item) => item.id === port.interfacePortId)) {
      notes.push(`Boundary port ${port.name} has no logical port.`)
    } else if (seen.has(port.interfacePortId)) notes.push(`Two boundary ports cite ${port.name}.`)
    else seen.add(port.interfacePortId)
  }
  const instancePorts = document.ports.filter((port) => port.blockId === block.id)
  for (const port of instancePorts) {
    if (!port.interfacePortId) continue
    const nets = new Set<string>()
    for (const segment of document.segments) {
      if ((segment.start.kind === 'port' && segment.start.portId === port.id) || (segment.end.kind === 'port' && segment.end.portId === port.id)) nets.add(segment.netId)
    }
    if (nets.size > 1) notes.push(`Port ${port.name} is on more than one net.`)
    if (nets.size > 0 && !seen.has(port.interfacePortId)) notes.push(`Port ${port.name} is connected here but the diagram has no connector for it.`)
  }
  const connectorIds = new Set(connectors.map((port) => port.id))
  for (const net of child.nets) {
    const cited = new Set<string>()
    for (const segment of child.segments.filter((item) => item.netId === net.id)) {
      for (const end of [segment.start, segment.end]) {
        if (end.kind === 'port' && connectorIds.has(end.portId)) {
          const port = connectors.find((item) => item.id === end.portId)
          if (port?.interfacePortId) cited.add(port.interfacePortId)
        }
      }
    }
    if (cited.size > 1) notes.push(`Net ${net.name || net.id} joins two boundary ports.`)
  }
  if (notes.length > 0) return { ok: false, message: `${notes[0]} The project was not changed.`, notes }
  const moving = child.blocks.filter((item) => item.id !== boundary.id).map((item) => item.name)
  notes.push(`Other instances of ${component.name} keep the shared definition.`)
  return { ok: true, blockId, blockName: block.name, componentName: component.name, moving, notes }
}

function mapEnd(end: Endpoint, portMap: Map<string, string>, junctionMap: Map<string, string>, dx: number, dy: number): Endpoint {
  if (end.kind === 'port') return { kind: 'port', portId: portMap.get(end.portId) ?? end.portId }
  if (end.kind === 'junction') return { kind: 'junction', junctionId: junctionMap.get(end.junctionId) ?? end.junctionId }
  return { kind: 'free', x: end.x + dx, y: end.y + dy }
}

export function expandComponent(
  project: DiagramProject,
  documentId: string,
  blockId: string,
): ProjectResult<{ blockIds: string[] }> {
  const preview = previewExpand(project, documentId, blockId)
  if (!preview.ok) return fail(project, preview.message)
  const source = documentById(project, documentId)
  const block = source?.blocks.find((item) => item.id === blockId)
  const component = block?.componentId ? componentById(project, block.componentId) : null
  const child = component?.implementation.documentId ? documentById(project, component.implementation.documentId) : null
  const boundary = child ? boundaryBlock(child) : null
  if (!source || !block || !component || !child || !boundary) return fail(project, 'The project was not changed.')
  const next = cloneProject(project)
  const sheet = documentById(next, documentId)
  const diagram = documentById(next, child.id)
  const instance = sheet?.blocks.find((item) => item.id === blockId)
  if (!sheet || !diagram || !instance) return fail(project, 'The project was not changed.')
  const edge = boundaryBlock(diagram)
  if (!edge) return fail(project, 'The project was not changed.')
  const content = diagram.blocks.filter((item) => item.id !== edge.id)
  const minX = content.length ? Math.min(...content.map((item) => item.x)) : instance.x
  const minY = content.length ? Math.min(...content.map((item) => item.y)) : instance.y
  const dx = instance.x - minX
  const dy = instance.y - minY
  for (const item of content) {
    if (!item.symbolId || sheet.symbols.some((symbol) => symbol.id === item.symbolId)) continue
    const symbol = diagram.symbols.find((symbolItem) => symbolItem.id === item.symbolId)
    if (!symbol) continue
    const adopted = adoptLibrarySymbol(sheet, symbol, diagram.assets)
    if (!adopted.ok) return fail(project, `${adopted.message} The project was not changed.`)
  }
  const connectorIds = new Set(diagram.ports.filter((port) => port.blockId === edge.id).map((port) => port.id))
  const interfaceOfPort = new Map(diagram.ports.filter((port) => connectorIds.has(port.id) && port.interfacePortId).map((port) => [port.id, port.interfacePortId ?? '']))
  const portMap = new Map<string, string>()
  const blockMap = new Map<string, string>()
  const created: string[] = []
  for (const item of content) {
    const id = createId('blk')
    blockMap.set(item.id, id)
    created.push(id)
    sheet.blocks.push({ ...item, id, x: item.x + dx, y: item.y + dy })
  }
  for (const port of diagram.ports.filter((item) => blockMap.has(item.blockId))) {
    const id = createId('prt')
    portMap.set(port.id, id)
    sheet.ports.push({ ...port, id, blockId: blockMap.get(port.blockId) ?? port.blockId })
  }
  const junctionMap = new Map<string, string>()
  const usedJunctions = new Set<string>()
  for (const segment of diagram.segments) {
    for (const end of [segment.start, segment.end]) if (end.kind === 'junction') usedJunctions.add(end.junctionId)
  }
  for (const junction of diagram.junctions.filter((item) => usedJunctions.has(item.id))) {
    const id = createId('jnc')
    junctionMap.set(junction.id, id)
    sheet.junctions.push({ id, netId: junction.netId, x: junction.x + dx, y: junction.y + dy })
  }
  const segmentMap = new Map<string, string>()
  const copiedByChildNet = new Map<string, Array<{ copy: Segment; startBoundary: boolean; endBoundary: boolean }>>()
  for (const segment of diagram.segments) {
    const startBoundary = segment.start.kind === 'port' && connectorIds.has(segment.start.portId)
    const endBoundary = segment.end.kind === 'port' && connectorIds.has(segment.end.portId)
    if (startBoundary && endBoundary) return fail(project, 'A boundary segment joins two connectors. The project was not changed.')
    const id = createId('seg')
    segmentMap.set(segment.id, id)
    const copy: Segment = {
      id,
      netId: segment.netId,
      routed: segment.routed,
      points: segment.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy })),
      start: mapEnd(segment.start, portMap, junctionMap, dx, dy),
      end: mapEnd(segment.end, portMap, junctionMap, dx, dy),
    }
    const list = copiedByChildNet.get(segment.netId) ?? []
    list.push({ copy, startBoundary, endBoundary })
    copiedByChildNet.set(segment.netId, list)
    sheet.segments.push(copy)
  }
  for (const [childNetId, copies] of copiedByChildNet) {
    const cited = new Set<string>()
    for (const segment of diagram.segments.filter((item) => item.netId === childNetId)) {
      for (const end of [segment.start, segment.end]) {
        if (end.kind === 'port' && interfaceOfPort.has(end.portId)) cited.add(interfaceOfPort.get(end.portId) ?? '')
      }
    }
    const interfacePortId = [...cited][0]
    const instancePort = interfacePortId ? sheet.ports.find((port) => port.blockId === instance.id && port.interfacePortId === interfacePortId) : undefined
    const parentNetIds = new Set<string>()
    const parentEnds: Array<{ segment: Segment; which: 'start' | 'end' }> = []
    if (instancePort) {
      for (const segment of sheet.segments) {
        if (copies.some((item) => item.copy.id === segment.id)) continue
        if (segment.start.kind === 'port' && segment.start.portId === instancePort.id) {
          parentNetIds.add(segment.netId)
          parentEnds.push({ segment, which: 'start' })
        }
        if (segment.end.kind === 'port' && segment.end.portId === instancePort.id) {
          parentNetIds.add(segment.netId)
          parentEnds.push({ segment, which: 'end' })
        }
      }
    }
    const sourceNet = diagram.nets.find((item) => item.id === childNetId)
    const parentNetId = [...parentNetIds][0]
    const targetNet = parentNetId ?? createId('net')
    if (!parentNetId) sheet.nets.push({ id: targetNet, name: sourceNet?.name ?? 'net', ...(sourceNet?.signal ? { signal: JSON.parse(JSON.stringify(sourceNet.signal)) as Record<string, unknown> } : {}) })
    for (const item of copies) item.copy.netId = targetNet
    for (const junction of sheet.junctions) {
      if ([...junctionMap.entries()].some(([oldId, newId]) => newId === junction.id && diagram.junctions.find((item) => item.id === oldId)?.netId === childNetId)) junction.netId = targetNet
    }
    const boundarySegments = copies.filter((item) => item.startBoundary || item.endBoundary)
    const anchor = instancePort ? portAnchor(sheet, instancePort.id) : null
    if (boundarySegments.length + parentEnds.length >= 2 && anchor) {
      const junctionId = createId('jnc')
      sheet.junctions.push({ id: junctionId, netId: targetNet, x: anchor.x, y: anchor.y })
      for (const item of boundarySegments) {
        if (item.startBoundary) item.copy.start = { kind: 'junction', junctionId }
        if (item.endBoundary) item.copy.end = { kind: 'junction', junctionId }
      }
      for (const end of parentEnds) {
        if (end.which === 'start') end.segment.start = { kind: 'junction', junctionId }
        else end.segment.end = { kind: 'junction', junctionId }
      }
    } else if (boundarySegments.length === 1 && parentEnds.length === 0 && anchor) {
      const item = boundarySegments[0]
      if (item?.startBoundary) item.copy.start = { kind: 'free', x: anchor.x, y: anchor.y }
      if (item?.endBoundary) item.copy.end = { kind: 'free', x: anchor.x, y: anchor.y }
    } else if (parentEnds.length > 0 && boundarySegments.length === 0 && anchor) {
      for (const end of parentEnds) {
        if (end.which === 'start') end.segment.start = { kind: 'free', x: anchor.x, y: anchor.y }
        else end.segment.end = { kind: 'free', x: anchor.x, y: anchor.y }
      }
    }
  }
  for (const label of diagram.labels) {
    if (label.anchor.kind !== 'segment') continue
    const segmentId = segmentMap.get(label.anchor.segmentId)
    if (!segmentId) continue
    sheet.labels.push({ ...label, id: createId('lbl'), anchor: { ...label.anchor, segmentId } })
  }
  for (const group of diagram.groups) {
    const ids = group.blockIds.map((id) => blockMap.get(id)).filter((id): id is string => Boolean(id))
    if (ids.length === 0) continue
    sheet.groups.push({ id: createId('grp'), name: group.name, blockIds: ids })
  }
  for (const stroke of diagram.strokes) {
    sheet.strokes.push({ ...stroke, id: createId('stk'), points: stroke.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy })) })
  }
  sheet.blocks = sheet.blocks.filter((item) => item.id !== instance.id)
  sheet.ports = sheet.ports.filter((port) => port.blockId !== instance.id)
  sheet.groups = sheet.groups.flatMap((group) => {
    const ids = group.blockIds.filter((id) => id !== instance.id)
    return ids.length > 0 ? [{ ...group, blockIds: ids }] : []
  })
  refreshAll(sheet)
  const cycle = findCycles(next)[0]
  if (cycle) return fail(project, `Component cycle: ${cycle.join(' → ')}. The project was not changed.`)
  return { ok: true, project: next, value: { blockIds: created } }
}

function copySymbol(symbol: SymbolDefinition): { symbol: SymbolDefinition; pinMap: Map<string, string> } {
  const copy = cloneSymbol(symbol)
  copy.id = createId('sym')
  copy.name = `${symbol.name} copy`
  const pinMap = new Map<string, string>()
  copy.ports = copy.ports.map((port) => {
    const id = createId('pin')
    pinMap.set(port.id, id)
    return { ...port, id }
  })
  delete copy.libraryId
  delete copy.libraryVersion
  return { symbol: copy, pinMap }
}

function remapDocument(source: DiagramDocument, interfaceMap: Map<string, string>): DiagramDocument {
  const doc = JSON.parse(JSON.stringify(source)) as DiagramDocument
  doc.id = createId('doc')
  const idMap = new Map<string, string>()
  const take = (old: string, prefix: string): string => {
    const id = createId(prefix)
    idMap.set(old, id)
    return id
  }
  for (const symbol of doc.symbols) {
    symbol.id = take(symbol.id, 'sym')
    for (const pin of symbol.ports) pin.id = take(pin.id, 'pin')
    for (const label of symbol.labels) label.id = take(label.id, 'slb')
  }
  for (const asset of doc.assets) asset.id = take(asset.id, 'img')
  for (const symbol of doc.symbols) {
    symbol.shapes = symbol.shapes.map((shape) => (shape.kind === 'image' ? { ...shape, assetId: idMap.get(shape.assetId) ?? shape.assetId } : shape))
  }
  for (const block of doc.blocks) {
    block.id = take(block.id, 'blk')
    if (block.symbolId) block.symbolId = idMap.get(block.symbolId) ?? block.symbolId
  }
  for (const port of doc.ports) {
    port.id = take(port.id, 'prt')
    port.blockId = idMap.get(port.blockId) ?? port.blockId
    if (port.symbolPortId) port.symbolPortId = idMap.get(port.symbolPortId) ?? port.symbolPortId
    if (port.interfacePortId && interfaceMap.has(port.interfacePortId)) port.interfacePortId = interfaceMap.get(port.interfacePortId)
  }
  for (const net of doc.nets) net.id = take(net.id, 'net')
  for (const junction of doc.junctions) {
    junction.id = take(junction.id, 'jnc')
    junction.netId = idMap.get(junction.netId) ?? junction.netId
  }
  for (const segment of doc.segments) {
    segment.id = take(segment.id, 'seg')
    segment.netId = idMap.get(segment.netId) ?? segment.netId
    segment.start = remapEndpoint(segment.start, idMap)
    segment.end = remapEndpoint(segment.end, idMap)
  }
  for (const label of doc.labels) {
    label.id = take(label.id, 'lbl')
    if (label.anchor.kind === 'segment') label.anchor = { ...label.anchor, segmentId: idMap.get(label.anchor.segmentId) ?? label.anchor.segmentId }
  }
  for (const stroke of doc.strokes) stroke.id = take(stroke.id, 'stk')
  for (const group of doc.groups) {
    group.id = take(group.id, 'grp')
    group.blockIds = group.blockIds.map((id) => idMap.get(id) ?? id)
  }
  return doc
}

function remapEndpoint(end: Endpoint, idMap: Map<string, string>): Endpoint {
  if (end.kind === 'port') return { kind: 'port', portId: idMap.get(end.portId) ?? end.portId }
  if (end.kind === 'junction') return { kind: 'junction', junctionId: idMap.get(end.junctionId) ?? end.junctionId }
  return { kind: 'free', x: end.x, y: end.y }
}

export function renameComponent(project: DiagramProject, componentId: string, name: string): ProjectResult<{ componentId: string }> {
  const component = componentById(project, componentId)
  const trimmed = name.trim()
  if (!component) return fail(project, 'That component is not in the project. The project was not changed.')
  if (!trimmed) return fail(project, 'A component needs a name. The project was not changed.')
  const next = cloneProject(project)
  const target = componentById(next, componentId)
  if (!target) return fail(project, 'That component is not in the project. The project was not changed.')
  const previous = target.name
  target.name = trimmed
  if (target.symbolId) {
    for (const document of next.documents) {
      const symbol = document.symbols.find((item) => item.id === target.symbolId)
      if (symbol && symbol.name === previous) symbol.name = trimmed
    }
  }
  return { ok: true, project: next, value: { componentId } }
}

function duplicateInto(next: DiagramProject, componentId: string): { componentId: string; interfaceMap: Map<string, string> } | string {
  const component = componentById(next, componentId)
  if (!component) return 'That component is not in the project.'
  const interfaceMap = new Map<string, string>()
  const ports = component.ports.map((port) => {
    const id = createId('ifp')
    interfaceMap.set(port.id, id)
    return { id, name: port.name }
  })
  let symbolId: string | undefined
  const pinMap = new Map<string, string>()
  if (component.symbolId) {
    let host: DiagramDocument | null = null
    let symbol: SymbolDefinition | null = null
    for (const document of next.documents) {
      const found = document.symbols.find((item) => item.id === component.symbolId)
      if (found) {
        host = document
        symbol = found
        break
      }
    }
    if (!symbol || !host) return `${component.name} cites a symbol that is not in the project.`
    const copied = copySymbol(symbol)
    host.symbols.push(copied.symbol)
    symbolId = copied.symbol.id
    for (const [oldId, newId] of copied.pinMap) pinMap.set(oldId, newId)
  }
  let documentId: string | undefined
  if (component.implementation.kind === 'diagram' && component.implementation.documentId) {
    const diagram = documentById(next, component.implementation.documentId)
    if (!diagram) return `${component.name} cites a diagram that is not in the project.`
    const copy = remapDocument(diagram, interfaceMap)
    next.documents.push(copy)
    documentId = copy.id
  }
  const id = createId('cmp')
  next.components.push({
    id,
    name: `${component.name} copy`,
    ...(component.description ? { description: component.description } : {}),
    ports,
    ...(symbolId ? { symbolId } : {}),
    bindings: component.bindings.flatMap((binding) => {
      const interfacePortId = interfaceMap.get(binding.interfacePortId)
      const symbolPortId = pinMap.get(binding.symbolPortId)
      return interfacePortId && symbolPortId ? [{ interfacePortId, symbolPortId }] : []
    }),
    implementation: documentId
      ? { kind: 'diagram', documentId }
      : { kind: component.implementation.kind, ...(component.implementation.documentId ? { documentId: component.implementation.documentId } : {}), ...(component.implementation.extra ? { extra: JSON.parse(JSON.stringify(component.implementation.extra)) as Record<string, unknown> } : {}) },
    ...(typeof component.revision === 'number' ? { revision: component.revision } : {}),
  })
  return { componentId: id, interfaceMap }
}

export function duplicateComponent(project: DiagramProject, componentId: string): ProjectResult<{ componentId: string }> {
  if (!componentById(project, componentId)) return fail(project, 'That component is not in the project. The project was not changed.')
  const next = cloneProject(project)
  const copied = duplicateInto(next, componentId)
  if (typeof copied === 'string') return fail(project, `${copied} The project was not changed.`)
  const cycle = findCycles(next)[0]
  if (cycle) return fail(project, `Component cycle: ${cycle.join(' → ')}. The project was not changed.`)
  return { ok: true, project: next, value: { componentId: copied.componentId } }
}

/** One instance gets its own definition and implementation. Other instances keep the shared one. */
export function makeUnique(project: DiagramProject, documentId: string, blockId: string): ProjectResult<{ componentId: string }> {
  const document = documentById(project, documentId)
  const block = document?.blocks.find((item) => item.id === blockId)
  if (!document || !block) return fail(project, 'That block is not on this sheet. The project was not changed.')
  if (!block.componentId) return fail(project, `${block.name} is not a component. The project was not changed.`)
  if (instancesOf(project, block.componentId).length < 2) return fail(project, 'This instance is already the only one. The project was not changed.')
  const next = cloneProject(project)
  const copied = duplicateInto(next, block.componentId)
  if (typeof copied === 'string') return fail(project, `${copied} The project was not changed.`)
  const sheet = documentById(next, documentId)
  const instance = sheet?.blocks.find((item) => item.id === blockId)
  const definition = componentById(next, copied.componentId)
  if (!sheet || !instance || !definition) return fail(project, 'The project was not changed.')
  instance.componentId = copied.componentId
  if (definition.symbolId && instance.symbolId !== definition.symbolId) {
    const host = next.documents.find((item) => item.symbols.some((symbol) => symbol.id === definition.symbolId))
    const symbol = host?.symbols.find((item) => item.id === definition.symbolId)
    if (symbol && host && host.id !== sheet.id) {
      const adopted = adoptLibrarySymbol(sheet, symbol, host.assets)
      if (!adopted.ok) return fail(project, `${adopted.message} The project was not changed.`)
    }
    instance.symbolId = definition.symbolId
    instance.width = symbol?.width ?? instance.width
    instance.height = symbol?.height ?? instance.height
  }
  for (const port of sheet.ports.filter((item) => item.blockId === instance.id)) {
    if (port.interfacePortId && copied.interfaceMap.has(port.interfacePortId)) port.interfacePortId = copied.interfaceMap.get(port.interfacePortId)
    const binding = definition.bindings.find((item) => item.interfacePortId === port.interfacePortId)
    if (binding) port.symbolPortId = binding.symbolPortId
  }
  releaseUnboundSymbolPorts(sheet, instance.id)
  const cycle = findCycles(next)[0]
  if (cycle) return fail(project, `Component cycle: ${cycle.join(' → ')}. The project was not changed.`)
  return { ok: true, project: next, value: { componentId: copied.componentId } }
}
