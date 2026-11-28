import {
  createId,
  type Block,
  type BlockGroup,
  type BlockStyle,
  type DiagramDocument,
  type Endpoint,
  type Label,
  type Net,
  type Point,
  type Port,
  type Segment,
} from './document'
import {
  capturePortAnchors,
  isBlockAttachedStub,
  moveBlock,
  pinLocal,
  pinOnBorder,
  portAnchor,
  portAnchorDeltas,
  refreshAll,
  translateAttachedStubsByPortDeltas,
} from './geometry'
import { ensureNetByName, reassignComponents } from './nets'
import { DEFAULT_SNAP_SPACING, normalizeSpacing } from './preferences'
import { setInstancePortDirection, type PortDirection } from './portDirection'
import { blockDefaultTextAlign, type TextAlign } from './textTypography'

/** Fixed minimum block edge (P4b) — independent of snap/grid spacing. */
export const MIN_BLOCK_SIZE = 20
/** Fixed duplicate / paste step (P4b) — independent of snap spacing. */
export const DUPLICATE_OFFSET = 20
/** Fixed keyboard nudge step (P4b) — independent of snap spacing for now. */
export const NUDGE_DISTANCE = 20
/**
 * Legacy alias kept at 20 for callers that used GRID as a fixed geometry step
 * (duplicate offset, min size, tests). Prefer MIN_BLOCK_SIZE / DUPLICATE_OFFSET.
 */
export const GRID = MIN_BLOCK_SIZE

export type BlockTemplate = { name: string; width: number; height: number }

/** Plain blocks. They are not HDL symbols. */
export const BLOCK_TEMPLATES: BlockTemplate[] = [
  { name: 'Note', width: 160, height: 80 },
  // A2-P1: multiples of 40 so centred side ports sit on default snap g=20.
  { name: 'Process', width: 200, height: 120 },
  { name: 'Decision', width: 160, height: 120 },
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

/**
 * Round to the nearest multiple of `spacing` when enabled (P4b).
 * Spacing defaults to 20; callers pass editor `snapSpacing`.
 */
export function snapValue(value: number, enabled: boolean, spacing: number = DEFAULT_SNAP_SPACING): number {
  if (!enabled) return value
  const step = normalizeSpacing(spacing, DEFAULT_SNAP_SPACING)
  return Math.round(value / step) * step
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Side and fraction for a pointer near one block. The moving edge snaps. */
export function borderPlacement(
  block: { x: number; y: number; width: number; height: number },
  pointer: Point,
  snap: boolean,
  spacing: number = DEFAULT_SNAP_SPACING,
): { side: Port['side']; t: number } {
  const x = snapValue(pointer.x, snap, spacing)
  const y = snapValue(pointer.y, snap, spacing)
  return pinOnBorder(block.width, block.height, x - block.x, y - block.y)
}

function borderGap(width: number, height: number, x: number, y: number): number {
  const inside = x >= 0 && y >= 0 && x <= width && y <= height
  if (inside) return Math.min(Math.abs(x), Math.abs(width - x), Math.abs(y), Math.abs(height - y))
  const cx = Math.min(width, Math.max(0, x))
  const cy = Math.min(height, Math.max(0, y))
  return Math.hypot(x - cx, y - cy)
}

/** The block edge closest to the pointer, when the pointer is within `radius`. */
export function nearestBlockBorder(
  blocks: Array<Pick<Block, 'id' | 'x' | 'y' | 'width' | 'height'>>,
  pointer: Point,
  snap: boolean,
  radius: number,
  spacing: number = DEFAULT_SNAP_SPACING,
): { blockId: string; side: Port['side']; t: number; x: number; y: number } | null {
  let best: { blockId: string; side: Port['side']; t: number; x: number; y: number; gap: number } | null = null
  for (const block of blocks) {
    const gap = borderGap(block.width, block.height, pointer.x - block.x, pointer.y - block.y)
    if (gap > radius || (best !== null && gap >= best.gap)) continue
    const placed = borderPlacement(block, pointer, snap, spacing)
    const local = pinLocal(block.width, block.height, placed.side, placed.t)
    best = { blockId: block.id, side: placed.side, t: placed.t, x: block.x + local.x, y: block.y + local.y, gap }
  }
  if (!best) return null
  return { blockId: best.blockId, side: best.side, t: best.t, x: best.x, y: best.y }
}

/** Graphic position of one instance port. The symbol definition is not written. */
export function placePort(doc: DiagramDocument, portId: string, side: Port['side'], t: number): void {
  const port = doc.ports.find((item) => item.id === portId)
  if (!port) return
  const before = capturePortAnchors(doc, port.blockId)
  port.side = side
  port.t = clampUnit(t)
  port.placed = true
  delete port.x
  delete port.y
  delete port.guideU
  // Attached Port↔Free stubs follow this port’s actual Δ (S4); other stubs stay put.
  translateAttachedStubsByPortDeltas(doc, portAnchorDeltas(doc, before))
  refreshAll(doc)
}

/**
 * Move a guided symbol pin along its guide (A2-P1).
 * Stores an instance `guideU` override; does not rewrite the symbol definition.
 * Guide constraints win over grid snapping (caller passes already-projected u).
 */
export function placeGuidedPort(doc: DiagramDocument, portId: string, u: number): boolean {
  const port = doc.ports.find((item) => item.id === portId)
  if (!port) return false
  const before = capturePortAnchors(doc, port.blockId)
  const wrapped = ((u % 1) + 1) % 1
  port.guideU = wrapped
  delete port.placed
  delete port.x
  delete port.y
  translateAttachedStubsByPortDeltas(doc, portAnchorDeltas(doc, before))
  refreshAll(doc)
  return true
}

/** First `pN` that is not already used, ignoring letter case. */
export function unusedPortName(names: string[]): string {
  const taken = new Set(names.map((name) => name.toLowerCase()))
  for (let index = 1; index < 10000; index += 1) {
    const name = `p${index}`
    if (!taken.has(name)) return name
  }
  return `p${names.length + 1}`
}

export function portNameTaken(names: string[], name: string, except?: string): boolean {
  const key = name.trim().toLowerCase()
  return names.some((item) => item !== except && item.toLowerCase() === key)
}

/** A new instance port on the chosen edge. It has no symbol pin and no logical port. */
export function addPortAt(doc: DiagramDocument, blockId: string, side: Port['side'], t: number): string | null {
  const block = doc.blocks.find((item) => item.id === blockId)
  if (!block) return null
  const name = unusedPortName(doc.ports.filter((item) => item.blockId === blockId).map((item) => item.name))
  const id = createId('prt')
  doc.ports.push({ id, blockId, name, side, t: clampUnit(t), placed: true })
  refreshAll(doc)
  return id
}

export function portIsWired(doc: DiagramDocument, portId: string): boolean {
  return doc.segments.some(
    (segment) =>
      (segment.start.kind === 'port' && segment.start.portId === portId) ||
      (segment.end.kind === 'port' && segment.end.portId === portId),
  )
}

/** Remember a symbol pin this instance must not grow back. The symbol itself is not written. */
export function hideSymbolPin(block: { suppressedPins?: string[] }, symbolPortId: string | undefined): void {
  if (!symbolPortId) return
  const ids = new Set(block.suppressedPins ?? [])
  ids.add(symbolPortId)
  block.suppressedPins = [...ids]
}

/** Drop an unwired port. A wired port and its wire stay. Returns false when nothing changed. */
export function removeUnwiredPort(doc: DiagramDocument, portId: string): boolean {
  const port = doc.ports.find((item) => item.id === portId)
  if (!port || portIsWired(doc, portId)) return false
  const block = doc.blocks.find((item) => item.id === port.blockId)
  if (block) hideSymbolPin(block, port.symbolPortId)
  doc.ports = doc.ports.filter((item) => item.id !== portId)
  refreshAll(doc)
  return true
}

/** Rename one instance port. A name already used on that block, ignoring case, is refused. */
/** A2-P5b — instance port direction (geometry unchanged). */
export function setPortDirection(doc: DiagramDocument, portId: string, direction: PortDirection): boolean {
  const changed = setInstancePortDirection(doc, portId, direction)
  if (changed) refreshAll(doc)
  return changed
}

export function renameInstancePort(doc: DiagramDocument, portId: string, name: string): boolean {
  const port = doc.ports.find((item) => item.id === portId)
  const trimmed = name.trim()
  if (!port || !trimmed) return false
  const taken = doc.ports.some(
    (item) => item.blockId === port.blockId && item.id !== port.id && item.name.toLowerCase() === trimmed.toLowerCase(),
  )
  if (taken) return false
  port.name = trimmed
  return true
}

export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'] as const

export type ResizeHandle = (typeof RESIZE_HANDLES)[number]

/**
 * New box for one handle drag. The opposite side or corner stays fixed.
 * The moving edge snaps. The stored size cannot fall below one grid step.
 */
export function resizeBox(
  origin: { x: number; y: number; width: number; height: number },
  handle: ResizeHandle,
  pointer: Point,
  snap: boolean,
  spacing: number = DEFAULT_SNAP_SPACING,
): { x: number; y: number; width: number; height: number } {
  const right = origin.x + origin.width
  const bottom = origin.y + origin.height
  const east = handle === 'ne' || handle === 'e' || handle === 'se'
  const west = handle === 'nw' || handle === 'w' || handle === 'sw'
  const south = handle === 'sw' || handle === 's' || handle === 'se'
  const north = handle === 'nw' || handle === 'n' || handle === 'ne'
  let x = origin.x
  let y = origin.y
  let width = origin.width
  let height = origin.height
  // Min size uses MIN_BLOCK_SIZE — never snapSpacing (P4b).
  if (east) width = Math.max(MIN_BLOCK_SIZE, snapValue(pointer.x, snap, spacing) - origin.x)
  if (west) {
    const edge = Math.min(right - MIN_BLOCK_SIZE, snapValue(pointer.x, snap, spacing))
    x = edge
    width = right - edge
  }
  if (south) height = Math.max(MIN_BLOCK_SIZE, snapValue(pointer.y, snap, spacing) - origin.y)
  if (north) {
    const edge = Math.min(bottom - MIN_BLOCK_SIZE, snapValue(pointer.y, snap, spacing))
    y = edge
    height = bottom - edge
  }
  return { x, y, width, height }
}

export function addBlock(
  doc: DiagramDocument,
  template: BlockTemplate,
  at: Point,
  snap: boolean,
  spacing: number = DEFAULT_SNAP_SPACING,
): string {
  const id = createId('blk')
  const count = doc.blocks.filter((item) => item.name === template.name || item.name.startsWith(`${template.name} `)).length
  doc.blocks.push({
    id,
    name: count === 0 ? template.name : `${template.name} ${count + 1}`,
    x: snapValue(at.x, snap, spacing),
    y: snapValue(at.y, snap, spacing),
    width: template.width,
    height: template.height,
  })
  return id
}

export function placeTemplate(
  doc: DiagramDocument,
  template: BlockTemplate,
  snap: boolean,
  spacing: number = DEFAULT_SNAP_SPACING,
): string {
  const index = doc.blocks.length
  return addBlock(doc, template, { x: 80 + (index % 5) * 40, y: 80 + Math.floor(index / 5) * 40 }, snap, spacing)
}

export function snapBlocks(
  doc: DiagramDocument,
  blockIds: string[],
  enabled: boolean,
  spacing: number = DEFAULT_SNAP_SPACING,
): void {
  if (!enabled) return
  for (const id of blockIds) {
    const block = doc.blocks.find((item) => item.id === id)
    if (!block) continue
    // Route through moveBlock so attached Port↔Free stubs follow the snap delta.
    moveBlock(doc, id, snapValue(block.x, true, spacing), snapValue(block.y, true, spacing))
  }
}

export type BlockTextFormat = 'plain' | 'latex' | 'markdown'

/** Missing `textFormat` means plain. LaTeX applies only with non-empty `displayText` (A2-P3a). */
export function blockTextFormat(block: Pick<DiagramDocument['blocks'][number], 'displayText' | 'textFormat'>): BlockTextFormat {
  const text = typeof block.displayText === 'string' ? block.displayText.trim() : ''
  if (!text) return 'plain'
  if (block.textFormat === 'latex') return 'latex'
  if (block.textFormat === 'markdown') return 'markdown'
  return 'plain'
}

export function setBlockTypography(
  doc: DiagramDocument,
  blockId: string,
  fields: { fontSize?: number | null; textAlign?: TextAlign | null },
): boolean {
  const block = doc.blocks.find((item) => item.id === blockId)
  if (!block) return false
  const hasText = typeof block.displayText === 'string' && block.displayText.trim().length > 0
  if (!hasText) return false
  let changed = false
  if (fields.fontSize !== undefined) {
    const before = block.fontSize
    if (fields.fontSize === null || !Number.isFinite(fields.fontSize) || fields.fontSize <= 0) {
      if (before !== undefined) {
        delete block.fontSize
        changed = true
      }
    } else if (before !== fields.fontSize) {
      block.fontSize = fields.fontSize
      changed = true
    }
  }
  if (fields.textAlign !== undefined) {
    if (fields.textAlign === null) {
      if (block.textAlign !== undefined) {
        delete block.textAlign
        changed = true
      }
    } else {
      const defaultAlign = blockDefaultTextAlign(blockTextFormat(block))
      if (fields.textAlign === defaultAlign) {
        if (block.textAlign !== undefined) {
          delete block.textAlign
          changed = true
        }
      } else if (block.textAlign !== fields.textAlign) {
        block.textAlign = fields.textAlign
        changed = true
      }
    }
  }
  if (changed) refreshAll(doc)
  return changed
}

export function resetBlockTypography(doc: DiagramDocument, blockId: string): boolean {
  return setBlockTypography(doc, blockId, { fontSize: null, textAlign: null })
}

export function setBlockTextFormat(doc: DiagramDocument, blockId: string, format: BlockTextFormat): void {
  const block = doc.blocks.find((item) => item.id === blockId)
  if (!block) return
  if (format === 'plain') delete block.textFormat
  else block.textFormat = format
  refreshAll(doc)
}

export function setBlockFields(
  doc: DiagramDocument,
  blockId: string,
  fields: Partial<
    Pick<
      DiagramDocument['blocks'][number],
      | 'name'
      | 'x'
      | 'y'
      | 'width'
      | 'height'
      | 'showName'
      | 'showPortNames'
      | 'displayText'
      | 'showDisplayText'
      | 'textFormat'
      | 'fontSize'
      | 'textAlign'
    >
  >,
): void {
  const block = doc.blocks.find((item) => item.id === blockId)
  if (!block) return
  const geometry =
    fields.x !== undefined || fields.y !== undefined || fields.width !== undefined || fields.height !== undefined
  const before = geometry ? capturePortAnchors(doc, blockId) : null
  if (fields.name !== undefined) block.name = fields.name
  if (fields.x !== undefined) block.x = fields.x
  if (fields.y !== undefined) block.y = fields.y
  if (fields.width !== undefined) block.width = Math.max(MIN_BLOCK_SIZE, fields.width)
  if (fields.height !== undefined) block.height = Math.max(MIN_BLOCK_SIZE, fields.height)
  if (fields.showName !== undefined) {
    if (fields.showName) delete block.showName
    else block.showName = false
  }
  if (fields.showPortNames !== undefined) {
    if (fields.showPortNames) delete block.showPortNames
    else block.showPortNames = false
  }
  if (fields.displayText !== undefined) {
    // Preserve internal newlines; empty string clears the optional field.
    if (fields.displayText.length === 0) {
      delete block.displayText
      delete block.textFormat
      delete block.fontSize
      delete block.textAlign
    } else block.displayText = fields.displayText
  }
  if (fields.textFormat !== undefined) {
    if (fields.textFormat === 'plain') delete block.textFormat
    else block.textFormat = fields.textFormat
  }
  if (fields.fontSize !== undefined) {
    if (fields.fontSize === null || !Number.isFinite(fields.fontSize) || fields.fontSize <= 0) delete block.fontSize
    else block.fontSize = fields.fontSize
  }
  if (fields.textAlign !== undefined) {
    const defaultAlign = blockDefaultTextAlign(blockTextFormat(block))
    if (fields.textAlign === defaultAlign) delete block.textAlign
    else block.textAlign = fields.textAlign
  }
  if (fields.showDisplayText !== undefined) {
    if (fields.showDisplayText) delete block.showDisplayText
    else block.showDisplayText = false
  }
  // Per-port Δ so east/west (or north/south) stubs move independently on resize (S4).
  if (before) translateAttachedStubsByPortDeltas(doc, portAnchorDeltas(doc, before))
  refreshAll(doc)
}

function pruneBlockStyle(style: BlockStyle): BlockStyle | undefined {
  const next: BlockStyle = {}
  if (typeof style.fill === 'string' && style.fill.length > 0) next.fill = style.fill
  if (style.fillTransparent === true) next.fillTransparent = true
  if (typeof style.stroke === 'string' && style.stroke.length > 0) next.stroke = style.stroke
  if (typeof style.text === 'string' && style.text.length > 0) next.text = style.text
  return Object.keys(next).length > 0 ? next : undefined
}

/**
 * Merge instance appearance overrides (P3). Pass `null` to clear all P3 style fields only.
 * Does not touch P1 visibility or P2 display text.
 */
export function setBlockStyle(doc: DiagramDocument, blockId: string, patch: BlockStyle | null): void {
  const block = doc.blocks.find((item) => item.id === blockId)
  if (!block) return
  if (patch === null) {
    delete block.style
    refreshAll(doc)
    return
  }
  const merged: BlockStyle = { ...block.style }
  if (patch.fill !== undefined) {
    if (patch.fill.length === 0) delete merged.fill
    else merged.fill = patch.fill
  }
  if (patch.fillTransparent !== undefined) {
    if (patch.fillTransparent) merged.fillTransparent = true
    else delete merged.fillTransparent
  }
  if (patch.stroke !== undefined) {
    if (patch.stroke.length === 0) delete merged.stroke
    else merged.stroke = patch.stroke
  }
  if (patch.text !== undefined) {
    if (patch.text.length === 0) delete merged.text
    else merged.text = patch.text
  }
  const pruned = pruneBlockStyle(merged)
  if (pruned) block.style = pruned
  else delete block.style
  refreshAll(doc)
}

/** Clear P3 colour overrides only (atomic reset appearance). */
export function resetBlockStyle(doc: DiagramDocument, blockId: string): void {
  setBlockStyle(doc, blockId, null)
}

/**
 * Set P2 display-text offset from the block centre (P3a).
 * Pass `null` or `{ x: 0, y: 0 }` to restore automatic centring (deletes the field).
 */
export function setDisplayTextOffset(doc: DiagramDocument, blockId: string, offset: Point | null): void {
  const block = doc.blocks.find((item) => item.id === blockId)
  if (!block) return
  if (!offset || (offset.x === 0 && offset.y === 0)) {
    delete block.displayTextOffset
  } else {
    block.displayTextOffset = { x: offset.x, y: offset.y }
  }
}

/**
 * Show or hide labels anchored on one segment only (P1).
 * Other segments on the same named net are unchanged. Net name and connectivity stay put.
 * @returns true when at least one label visibility actually changed.
 */
export function setSegmentLabelsVisible(doc: DiagramDocument, segmentId: string, visible: boolean): boolean {
  let changed = false
  for (const label of doc.labels) {
    if (label.anchor.kind !== 'segment' || label.anchor.segmentId !== segmentId) continue
    const currently = label.visible !== false
    if (currently === visible) continue
    if (visible) delete label.visible
    else label.visible = false
    changed = true
  }
  return changed
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

/**
 * Copy blocks, internal Port↔Port wires (both ends in the selection), and attached Port↔Free stubs.
 * Named stubs join sheet nets by name (D5c.5). External trunks and unrelated same-name stubs stay put.
 */
export function duplicateBlocks(doc: DiagramDocument, blockIds: string[], dx: number, dy: number): Map<string, string> {
  const blockMap = new Map<string, string>()
  const portMap = new Map<string, string>()
  const chosen = new Set(blockIds)
  const stubs = attachedStubsForBlocks(doc, chosen)
  for (const id of blockIds) {
    const block = doc.blocks.find((item) => item.id === id)
    if (!block) continue
    const nextId = createId('blk')
    blockMap.set(id, nextId)
    doc.blocks.push({ ...block, id: nextId, x: block.x + dx, y: block.y + dy })
    for (const port of doc.ports.filter((item) => item.blockId === id)) {
      if (block.componentId && port.symbolPortId && !port.interfacePortId && !portIsWired(doc, port.id)) continue
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
      routed: segment.routed,
      points: segment.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
      start: { kind: 'port', portId: portMap.get(segment.start.portId) ?? segment.start.portId },
      end: { kind: 'port', portId: portMap.get(segment.end.portId) ?? segment.end.portId },
    })
    copySegmentLabels(doc, segment.id, segmentId)
  }
  for (const segment of stubs) {
    copyAttachedStub(doc, segment, portMap, dx, dy)
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

/**
 * Copy the selected blocks, internal Port↔Port wires, and attached Port↔Free stubs (implicit closure).
 * Attached stubs need not be explicitly selected.
 */
export function captureFragment(doc: DiagramDocument, blockIds: string[]): Fragment {
  const chosen = new Set(blockIds)
  const blocks = doc.blocks.filter((block) => chosen.has(block.id)).map((block) => ({ ...block }))
  const ports = doc.ports.filter((port) => chosen.has(port.blockId)).map((port) => ({ ...port }))
  const portIds = new Set(ports.map((port) => port.id))
  const internal = doc.segments.filter(
    (segment) =>
      segment.start.kind === 'port' &&
      segment.end.kind === 'port' &&
      portIds.has(segment.start.portId) &&
      portIds.has(segment.end.portId),
  )
  const stubs = attachedStubsForBlocks(doc, chosen)
  const seen = new Set<string>()
  const segments: Segment[] = []
  for (const segment of [...internal, ...stubs]) {
    if (seen.has(segment.id)) continue
    seen.add(segment.id)
    segments.push({
      ...segment,
      points: segment.points.map((point) => ({ ...point })),
      start: { ...segment.start },
      end: { ...segment.end },
    })
  }
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
    const source = fragment.blocks.find((block) => block.id === port.blockId)
    const wired = fragment.segments.some(
      (segment) =>
        (segment.start.kind === 'port' && segment.start.portId === port.id) ||
        (segment.end.kind === 'port' && segment.end.portId === port.id),
    )
    if (source?.componentId && port.symbolPortId && !port.interfacePortId && !wired) continue
    const id = createId('prt')
    portMap.set(port.id, id)
    doc.ports.push({ ...port, id, blockId })
  }
  const segmentMap = new Map<string, string>()
  for (const segment of fragment.segments) {
    const stub = isPortFreeSegment(segment)
    if (stub) {
      const remapped = remapStubGeometry(segment, portMap, dx, dy)
      if (!remapped) continue
      const net = fragment.nets.find((item) => item.id === segment.netId)
      const netId = ensureNetByName(doc, net?.name ?? '')
      const segmentId = createId('seg')
      segmentMap.set(segment.id, segmentId)
      doc.segments.push({
        id: segmentId,
        netId,
        routed: segment.routed,
        points: remapped.points,
        start: remapped.start,
        end: remapped.end,
      })
      continue
    }
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
      routed: segment.routed,
      points: segment.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
      start: { kind: 'port', portId: start },
      end: { kind: 'port', portId: end },
    })
  }
  for (const label of fragment.labels) {
    if (label.anchor.kind !== 'segment') continue
    const segmentId = segmentMap.get(label.anchor.segmentId)
    if (!segmentId) continue
    doc.labels.push({
      id: createId('lbl'),
      text: label.text,
      role: label.role,
      ...(typeof label.displayText === 'string' ? { displayText: label.displayText } : {}),
      ...(label.textFormat === 'latex'
        ? { textFormat: 'latex' as const }
        : label.textFormat === 'markdown'
          ? { textFormat: 'markdown' as const }
          : {}),
      fontSize: label.fontSize,
      ...(label.textAlign ? { textAlign: label.textAlign } : {}),
      visible: label.visible,
      anchor: { ...label.anchor, segmentId },
    })
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
  // Reuse sheet net by name when present (D5c.5); otherwise create.
  const netId = ensureNetByName(doc, name)
  const segmentId = createId('seg')
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
    role: 'name',
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

/** Port↔Free stubs attached to any of `chosen` blocks (deduped by segment id). */
export function attachedStubsForBlocks(doc: DiagramDocument, chosen: Set<string> | string[]): Segment[] {
  const blocks = chosen instanceof Set ? chosen : new Set(chosen)
  const out: Segment[] = []
  const seen = new Set<string>()
  for (const blockId of blocks) {
    for (const segment of doc.segments) {
      if (seen.has(segment.id)) continue
      if (!isBlockAttachedStub(doc, segment, blockId)) continue
      seen.add(segment.id)
      out.push(segment)
    }
  }
  return out
}

function isPortFreeSegment(segment: Segment): boolean {
  const portFree = segment.start.kind === 'port' && segment.end.kind === 'free'
  const freePort = segment.start.kind === 'free' && segment.end.kind === 'port'
  return portFree || freePort
}

function copyAttachedStub(
  doc: DiagramDocument,
  segment: Segment,
  portMap: Map<string, string>,
  dx: number,
  dy: number,
): void {
  const remapped = remapStubGeometry(segment, portMap, dx, dy)
  if (!remapped) return
  const net = doc.nets.find((item) => item.id === segment.netId)
  const netId = ensureNetByName(doc, net?.name ?? '')
  const segmentId = createId('seg')
  doc.segments.push({
    id: segmentId,
    netId,
    routed: segment.routed,
    points: remapped.points,
    start: remapped.start,
    end: remapped.end,
  })
  copySegmentLabels(doc, segment.id, segmentId)
}

function remapStubGeometry(
  segment: Segment,
  portMap: Map<string, string>,
  dx: number,
  dy: number,
): { points: Segment['points']; start: Endpoint; end: Endpoint } | null {
  const start = translateEndpoint(segment.start, portMap, dx, dy)
  const end = translateEndpoint(segment.end, portMap, dx, dy)
  if (!start || !end) return null
  return {
    points: segment.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy })),
    start,
    end,
  }
}

function translateEndpoint(end: Endpoint, portMap: Map<string, string>, dx: number, dy: number): Endpoint | null {
  if (end.kind === 'port') {
    const portId = portMap.get(end.portId)
    return portId ? { kind: 'port', portId } : null
  }
  if (end.kind === 'free') return { kind: 'free', x: end.x + dx, y: end.y + dy }
  return null
}

function copySegmentLabels(doc: DiagramDocument, sourceSegmentId: string, nextSegmentId: string): void {
  // Snapshot — do not iterate `doc.labels` live while pushing copies.
  for (const label of [...doc.labels]) {
    if (label.anchor.kind !== 'segment' || label.anchor.segmentId !== sourceSegmentId) continue
    doc.labels.push({
      id: createId('lbl'),
      text: label.text,
      role: label.role,
      ...(typeof label.displayText === 'string' ? { displayText: label.displayText } : {}),
      ...(label.textFormat === 'latex'
        ? { textFormat: 'latex' as const }
        : label.textFormat === 'markdown'
          ? { textFormat: 'markdown' as const }
          : {}),
      fontSize: label.fontSize,
      ...(label.textAlign ? { textAlign: label.textAlign } : {}),
      visible: label.visible,
      anchor: { ...label.anchor, segmentId: nextSegmentId },
    })
  }
}
