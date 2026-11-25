import { createId, type Block, type BlockGroup, type DiagramDocument, type Label, type Net, type Point, type Port, type Segment } from './document'
import { portAnchor, refreshAll } from './geometry'
import { reassignComponents } from './nets'

export const GRID = 20

export type BlockTemplate = { name: string; width: number; height: number }

/** Plain blocks. They are not HDL symbols. */
export const BLOCK_TEMPLATES: BlockTemplate[] = [
  { name: 'Note', width: 160, height: 80 },
  { name: 'Process', width: 180, height: 100 },
  { name: 'Decision', width: 140, height: 100 },
]

export function emptyDocument(): DiagramDocument {
  return {
    schemaVersion: 1,
    id: createId('doc'),
    blocks: [],
    symbols: [],
    assets: [],
    ports: [],
    nets: [],
    junctions: [],
    segments: [],
    labels: [],
    strokes: [],
    groups: [],
    extensions: {},
    extra: {},
  }
}

export function snapValue(value: number, enabled: boolean): number {
  if (!enabled) return value
  return Math.round(value / GRID) * GRID
}

export function addBlock(doc: DiagramDocument, template: BlockTemplate, at: Point, snap: boolean): string {
  const id = createId('blk')
  const count = doc.blocks.filter((item) => item.name === template.name || item.name.startsWith(`${template.name} `)).length
  doc.blocks.push({
    id,
    name: count === 0 ? template.name : `${template.name} ${count + 1}`,
    x: snapValue(at.x, snap),
    y: snapValue(at.y, snap),
    width: template.width,
    height: template.height,
  })
  return id
}

export function placeTemplate(doc: DiagramDocument, template: BlockTemplate, snap: boolean): string {
  const index = doc.blocks.length
  return addBlock(doc, template, { x: 80 + (index % 5) * 40, y: 80 + Math.floor(index / 5) * 40 }, snap)
}

export function snapBlocks(doc: DiagramDocument, blockIds: string[], enabled: boolean): void {
  if (!enabled) return
  for (const id of blockIds) {
    const block = doc.blocks.find((item) => item.id === id)
    if (!block) continue
    block.x = snapValue(block.x, true)
    block.y = snapValue(block.y, true)
  }
  refreshAll(doc)
}

export function setBlockFields(
  doc: DiagramDocument,
  blockId: string,
  fields: Partial<Pick<DiagramDocument['blocks'][number], 'name' | 'x' | 'y' | 'width' | 'height'>>,
): void {
  const block = doc.blocks.find((item) => item.id === blockId)
  if (!block) return
  if (fields.name !== undefined) block.name = fields.name
  if (fields.x !== undefined) block.x = fields.x
  if (fields.y !== undefined) block.y = fields.y
  if (fields.width !== undefined) block.width = Math.max(GRID, fields.width)
  if (fields.height !== undefined) block.height = Math.max(GRID, fields.height)
  refreshAll(doc)
}

export function deleteBlocks(doc: DiagramDocument, blockIds: string[]): void {
  const drop = new Set(blockIds)
  const portIds = new Set(doc.ports.filter((port) => drop.has(port.blockId)).map((port) => port.id))
  const removed = doc.segments.filter((segment) => usesPort(segment.start, portIds) || usesPort(segment.end, portIds))
  const segmentIds = new Set(removed.map((segment) => segment.id))
  const affected = [...new Set(removed.map((segment) => segment.netId))]
  doc.blocks = doc.blocks.filter((block) => !drop.has(block.id))
  doc.ports = doc.ports.filter((port) => !drop.has(port.blockId))
  doc.segments = doc.segments.filter((segment) => !segmentIds.has(segment.id))
  doc.labels = doc.labels.filter((label) => label.anchor.kind !== 'segment' || !segmentIds.has(label.anchor.segmentId))
  for (const netId of affected) reassignComponents(doc, netId)
  doc.groups = doc.groups.flatMap((group) => {
    const remaining = group.blockIds.filter((id) => !drop.has(id))
    return remaining.length > 0 ? [{ ...group, blockIds: remaining }] : []
  })
}

export function groupBlocks(doc: DiagramDocument, blockIds: string[]): string | null {
  const ids = blockIds.filter((id) => doc.blocks.some((block) => block.id === id))
  if (ids.length < 2) return null
  const id = createId('grp')
  doc.groups.push({ id, name: `Group ${doc.groups.length + 1}`, blockIds: [...ids] })
  return id
}

export function ungroup(doc: DiagramDocument, groupId: string): void {
  doc.groups = doc.groups.filter((group) => group.id !== groupId)
}

/** Copy blocks and the wires whose both ends lie on those blocks. External wires stay put. */
export function duplicateBlocks(doc: DiagramDocument, blockIds: string[], dx: number, dy: number): Map<string, string> {
  const blockMap = new Map<string, string>()
  const portMap = new Map<string, string>()
  const chosen = new Set(blockIds)
  for (const id of blockIds) {
    const block = doc.blocks.find((item) => item.id === id)
    if (!block) continue
    const nextId = createId('blk')
    blockMap.set(id, nextId)
    doc.blocks.push({ ...block, id: nextId, x: block.x + dx, y: block.y + dy })
    for (const port of doc.ports.filter((item) => item.blockId === id)) {
      const portId = createId('prt')
      portMap.set(port.id, portId)
      doc.ports.push({ ...port, id: portId, blockId: nextId })
    }
  }
  for (const segment of [...doc.segments]) {
    if (segment.start.kind !== 'port' || segment.end.kind !== 'port') continue
    const startBlock = blockOfPort(doc, segment.start.portId)
    const endBlock = blockOfPort(doc, segment.end.portId)
    if (!startBlock || !endBlock || !chosen.has(startBlock) || !chosen.has(endBlock)) continue
    const net = doc.nets.find((item) => item.id === segment.netId)
    const netId = createId('net')
    const segmentId = createId('seg')
    doc.nets.push({ id: netId, name: net?.name ?? 'net' })
    doc.segments.push({
      id: segmentId,
      netId,
      routed: 'manual',
      points: segment.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
      start: { kind: 'port', portId: portMap.get(segment.start.portId) ?? segment.start.portId },
      end: { kind: 'port', portId: portMap.get(segment.end.portId) ?? segment.end.portId },
    })
    for (const label of doc.labels) {
      if (label.anchor.kind !== 'segment' || label.anchor.segmentId !== segment.id) continue
      doc.labels.push({
        id: createId('lbl'),
        text: label.text,
        anchor: { ...label.anchor, segmentId },
      })
    }
  }
  refreshAll(doc)
  return blockMap
}

export function duplicateGroup(doc: DiagramDocument, groupId: string, dx: number, dy: number): string | null {
  const group = doc.groups.find((item) => item.id === groupId)
  if (!group) return null
  const blockMap = duplicateBlocks(doc, group.blockIds, dx, dy)
  const id = createId('grp')
  const copy: BlockGroup = {
    id,
    name: group.name,
    blockIds: group.blockIds.map((blockId) => blockMap.get(blockId)).filter((blockId): blockId is string => Boolean(blockId)),
  }
  doc.groups.push(copy)
  return id
}

export type Fragment = {
  blocks: Block[]
  ports: Port[]
  nets: Net[]
  segments: Segment[]
  labels: Label[]
  groupName: string | null
}

/** Copy the selected blocks and only the wires that stay inside that selection. */
export function captureFragment(doc: DiagramDocument, blockIds: string[]): Fragment {
  const chosen = new Set(blockIds)
  const blocks = doc.blocks.filter((block) => chosen.has(block.id)).map((block) => ({ ...block }))
  const ports = doc.ports.filter((port) => chosen.has(port.blockId)).map((port) => ({ ...port }))
  const portIds = new Set(ports.map((port) => port.id))
  const segments = doc.segments
    .filter(
      (segment) =>
        segment.start.kind === 'port' &&
        segment.end.kind === 'port' &&
        portIds.has(segment.start.portId) &&
        portIds.has(segment.end.portId),
    )
    .map((segment) => ({ ...segment, points: segment.points.map((point) => ({ ...point })), start: { ...segment.start }, end: { ...segment.end } }))
  const netIds = new Set(segments.map((segment) => segment.netId))
  const nets = doc.nets.filter((net) => netIds.has(net.id)).map((net) => ({ ...net }))
  const segmentIds = new Set(segments.map((segment) => segment.id))
  const labels = doc.labels
    .filter((label) => label.anchor.kind === 'segment' && segmentIds.has(label.anchor.segmentId))
    .map((label) => ({ ...label, anchor: { ...label.anchor } }))
  const group = doc.groups.find((item) => item.blockIds.length === chosen.size && item.blockIds.every((id) => chosen.has(id)))
  return { blocks, ports, nets, segments, labels, groupName: group?.name ?? null }
}

export function pasteFragment(doc: DiagramDocument, fragment: Fragment, dx: number, dy: number): string[] {
  const blockMap = new Map<string, string>()
  const portMap = new Map<string, string>()
  const created: string[] = []
  for (const block of fragment.blocks) {
    const id = createId('blk')
    blockMap.set(block.id, id)
    created.push(id)
    doc.blocks.push({ ...block, id, x: block.x + dx, y: block.y + dy })
  }
  for (const port of fragment.ports) {
    const blockId = blockMap.get(port.blockId)
    if (!blockId) continue
    const id = createId('prt')
    portMap.set(port.id, id)
    doc.ports.push({ ...port, id, blockId })
  }
  const segmentMap = new Map<string, string>()
  for (const segment of fragment.segments) {
    if (segment.start.kind !== 'port' || segment.end.kind !== 'port') continue
    const start = portMap.get(segment.start.portId)
    const end = portMap.get(segment.end.portId)
    if (!start || !end) continue
    const netId = createId('net')
    const segmentId = createId('seg')
    segmentMap.set(segment.id, segmentId)
    const net = fragment.nets.find((item) => item.id === segment.netId)
    doc.nets.push({ id: netId, name: net?.name ?? 'net' })
    doc.segments.push({
      id: segmentId,
      netId,
      routed: 'manual',
      points: segment.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
      start: { kind: 'port', portId: start },
      end: { kind: 'port', portId: end },
    })
  }
  for (const label of fragment.labels) {
    if (label.anchor.kind !== 'segment') continue
    const segmentId = segmentMap.get(label.anchor.segmentId)
    if (!segmentId) continue
    doc.labels.push({ id: createId('lbl'), text: label.text, anchor: { ...label.anchor, segmentId } })
  }
  if (fragment.groupName && created.length > 1) {
    doc.groups.push({ id: createId('grp'), name: fragment.groupName, blockIds: created })
  }
  refreshAll(doc)
  return created
}

export function linkPorts(doc: DiagramDocument, startPortId: string, endPortId: string, name: string): string | null {
  const start = portAnchor(doc, startPortId)
  const end = portAnchor(doc, endPortId)
  if (!start || !end) return null
  const trunk = (start.x + end.x) / 2
  const netId = createId('net')
  const segmentId = createId('seg')
  doc.nets.push({ id: netId, name })
  doc.segments.push({
    id: segmentId,
    netId,
    routed: 'manual',
    points: [start, { x: trunk, y: start.y }, { x: trunk, y: end.y }, end],
    start: { kind: 'port', portId: startPortId },
    end: { kind: 'port', portId: endPortId },
  })
  doc.labels.push({
    id: createId('lbl'),
    text: name,
    anchor: { kind: 'segment', segmentId, edge: 1, distance: 8, offset: 14 },
  })
  return segmentId
}

function usesPort(end: DiagramDocument['segments'][number]['start'], portIds: Set<string>): boolean {
  return end.kind === 'port' && portIds.has(end.portId)
}

function blockOfPort(doc: DiagramDocument, portId: string): string | null {
  return doc.ports.find((port) => port.id === portId)?.blockId ?? null
}
