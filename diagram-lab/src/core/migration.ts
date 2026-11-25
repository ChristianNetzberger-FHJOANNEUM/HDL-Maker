import { auditAssets, imageAssetIds } from './assets'
import { compareSymbols, symbolFingerprint, type SymbolChange } from './compare'
import type { DiagramDocument, ImageAsset, SymbolDefinition } from './document'
import { createId } from './document'
import { refreshAll } from './geometry'
import { transferAssets } from './library'
import { deleteSegment, mergeNets } from './nets'
import { applySymbol, pruneAssets } from './symbols'

export type PinConflict = {
  blockId: string
  blockName: string
  portId: string
  symbolPortId: string
  portName: string
  netId: string | null
  netName: string | null
  segmentIds: string[]
}

export type UpdatePreview = {
  symbolId: string
  fromRevision: number | null
  toRevision: number | null
  fromChecksum: string
  toChecksum: string
  changes: SymbolChange[]
  instanceIds: string[]
  connectionCount: number
  addedPins: Array<{ id: string; name: string }>
  removedPins: Array<{ id: string; name: string }>
  conflicts: PinConflict[]
}

export type PreparedUpdate = {
  symbolId: string
  next: SymbolDefinition
  pending: ImageAsset[]
  revision: number
  checksum: string
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function remap(symbol: SymbolDefinition, map: Map<string, string>): SymbolDefinition {
  const copy = clone(symbol)
  copy.shapes = copy.shapes.map((shape) => (shape.kind === 'image' ? { ...shape, assetId: map.get(shape.assetId) ?? shape.assetId } : shape))
  return copy
}

function segmentsOn(doc: DiagramDocument, portId: string): string[] {
  return doc.segments
    .filter(
      (segment) =>
        (segment.start.kind === 'port' && segment.start.portId === portId) ||
        (segment.end.kind === 'port' && segment.end.portId === portId),
    )
    .map((segment) => segment.id)
}

function netOfPort(doc: DiagramDocument, portId: string): { id: string; name: string } | null {
  const segment = doc.segments.find(
    (item) =>
      (item.start.kind === 'port' && item.start.portId === portId) || (item.end.kind === 'port' && item.end.portId === portId),
  )
  if (!segment) return null
  const net = doc.nets.find((item) => item.id === segment.netId)
  return net ? { id: net.id, name: net.name } : { id: segment.netId, name: segment.netId }
}

/** Read-only description of what an update would do. */
export function previewSymbolUpdate(
  doc: DiagramDocument,
  symbolId: string,
  incoming: SymbolDefinition,
  incomingAssets: ImageAsset[] = [],
): { ok: true; preview: UpdatePreview } | { ok: false; message: string } {
  const current = doc.symbols.find((item) => item.id === symbolId)
  if (!current) return { ok: false, message: 'This document does not contain that symbol.' }
  const needed = incomingAssets.filter((asset) => imageAssetIds(incoming.shapes).includes(asset.id))
  const audited = auditAssets(needed)
  if (!audited.ok) return audited
  const moved = transferAssets(doc.assets ?? [], incomingAssets, imageAssetIds(incoming.shapes))
  if (!moved.ok) return moved
  const next = remap(incoming, moved.map)
  const changes = compareSymbols(current, next, doc.assets ?? [], [...(doc.assets ?? []), ...moved.pending])
  const removed = new Set(changes.filter((change) => change.kind === 'pin-removed').map((change) => change.pinId))
  const instanceIds = doc.blocks.filter((block) => block.symbolId === symbolId).map((block) => block.id)
  const conflicts: PinConflict[] = []
  for (const blockId of instanceIds) {
    const block = doc.blocks.find((item) => item.id === blockId)
    for (const port of doc.ports.filter((item) => item.blockId === blockId && item.symbolPortId && removed.has(item.symbolPortId))) {
      const segmentIds = segmentsOn(doc, port.id)
      if (segmentIds.length === 0) continue
      const net = netOfPort(doc, port.id)
      conflicts.push({
        blockId,
        blockName: block?.name ?? blockId,
        portId: port.id,
        symbolPortId: port.symbolPortId ?? '',
        portName: port.name,
        netId: net?.id ?? null,
        netName: net?.name ?? null,
        segmentIds,
      })
    }
  }
  const connectionIds = new Set(conflicts.flatMap((conflict) => conflict.segmentIds))
  for (const blockId of instanceIds) {
    for (const port of doc.ports.filter((item) => item.blockId === blockId)) {
      for (const segmentId of segmentsOn(doc, port.id)) connectionIds.add(segmentId)
    }
  }
  return {
    ok: true,
    preview: {
      symbolId,
      fromRevision: current.revision ?? null,
      toRevision: incoming.revision ?? null,
      fromChecksum: symbolFingerprint(current, doc.assets ?? []),
      toChecksum: symbolFingerprint(next, [...(doc.assets ?? []), ...moved.pending]),
      changes,
      instanceIds,
      connectionCount: connectionIds.size,
      addedPins: next.ports.filter((pin) => !current.ports.some((item) => item.id === pin.id)).map((pin) => ({ id: pin.id, name: pin.name })),
      removedPins: current.ports.filter((pin) => !next.ports.some((item) => item.id === pin.id)).map((pin) => ({ id: pin.id, name: pin.name })),
      conflicts,
    },
  }
}

/**
 * Check the incoming picture bytes, then describe a write that has not happened yet.
 * Calling this does not change the document.
 */
export function prepareSymbolUpdate(
  doc: DiagramDocument,
  symbolId: string,
  incoming: SymbolDefinition,
  incomingAssets: ImageAsset[] = [],
): { ok: true; prepared: PreparedUpdate; preview: UpdatePreview } | { ok: false; message: string } {
  const preview = previewSymbolUpdate(doc, symbolId, incoming, incomingAssets)
  if (!preview.ok) return preview
  const moved = transferAssets(doc.assets ?? [], incomingAssets, imageAssetIds(incoming.shapes))
  if (!moved.ok) return moved
  const next = remap(incoming, moved.map)
  next.id = symbolId
  const revision = typeof incoming.revision === 'number' ? incoming.revision : (doc.symbols.find((item) => item.id === symbolId)?.revision ?? 1) + 1
  next.revision = revision
  const checksum = symbolFingerprint(next, [...(doc.assets ?? []), ...moved.pending])
  next.bodyChecksum = checksum
  return { ok: true, prepared: { symbolId, next, pending: moved.pending, revision, checksum }, preview: preview.preview }
}

/** Write a prepared update. The caller makes this the only history entry. */
export function commitSymbolUpdate(doc: DiagramDocument, prepared: PreparedUpdate): void {
  const symbol = doc.symbols.find((item) => item.id === prepared.symbolId)
  if (!symbol) return
  if (!doc.assets) doc.assets = []
  doc.assets.push(...prepared.pending.map((asset) => clone(asset)))
  const next = prepared.next
  symbol.name = next.name
  symbol.width = next.width
  symbol.height = next.height
  symbol.ports = clone(next.ports)
  symbol.shapes = clone(next.shapes)
  symbol.labels = clone(next.labels)
  symbol.revision = prepared.revision
  symbol.bodyChecksum = prepared.checksum
  if (next.libraryId) symbol.libraryId = next.libraryId
  if (typeof next.libraryVersion === 'number') symbol.libraryVersion = next.libraryVersion
  if (next.categoryId) symbol.categoryId = next.categoryId
  applySymbol(doc, prepared.symbolId)
  pruneAssets(doc)
}

/**
 * Give one instance its own definition with the same pin ids.
 * Other instances of the original definition stay untouched.
 */
export function detachInstance(doc: DiagramDocument, blockId: string): { ok: true; symbolId: string } | { ok: false; message: string } {
  const block = doc.blocks.find((item) => item.id === blockId)
  const symbol = block?.symbolId ? doc.symbols.find((item) => item.id === block.symbolId) : undefined
  if (!block || !symbol) return { ok: false, message: 'Select one symbol instance.' }
  const copy = clone(symbol)
  copy.id = createId('sym')
  copy.name = `${symbol.name} instance`
  doc.symbols.push(copy)
  block.symbolId = copy.id
  return { ok: true, symbolId: copy.id }
}

/**
 * Move wires from one instance port to another.
 * A different net is merged with the existing D2 rule: the wire's net id is kept.
 */
export function rebindPort(
  doc: DiagramDocument,
  fromPortId: string,
  toPortId: string,
): { ok: true; nets: Array<{ id: string; name: string }> } | { ok: false; message: string } {
  if (fromPortId === toPortId) return { ok: false, message: 'That is the same port.' }
  const target = doc.ports.find((port) => port.id === toPortId)
  if (!target) return { ok: false, message: 'The target port is not in this document.' }
  const segments = doc.segments.filter(
    (segment) =>
      (segment.start.kind === 'port' && segment.start.portId === fromPortId) ||
      (segment.end.kind === 'port' && segment.end.portId === fromPortId),
  )
  if (segments.length === 0) return { ok: false, message: 'That port has no wire.' }
  const nets: Array<{ id: string; name: string }> = []
  const seen = new Set<string>()
  for (const segment of segments) {
    const own = doc.nets.find((net) => net.id === segment.netId)
    if (own && !seen.has(own.id)) {
      seen.add(own.id)
      nets.push({ id: own.id, name: own.name })
    }
    const other = netOfPort(doc, toPortId)
    if (other && other.id !== segment.netId) {
      if (!seen.has(other.id)) {
        seen.add(other.id)
        nets.push(other)
      }
      mergeNets(doc, segment.netId, other.id)
    }
    if (segment.start.kind === 'port' && segment.start.portId === fromPortId) segment.start = { kind: 'port', portId: toPortId }
    if (segment.end.kind === 'port' && segment.end.portId === fromPortId) segment.end = { kind: 'port', portId: toPortId }
  }
  refreshAll(doc)
  return { ok: true, nets }
}

export function dropPortWires(doc: DiagramDocument, portId: string): string[] {
  const ids = segmentsOn(doc, portId)
  for (const id of ids) deleteSegment(doc, id)
  return ids
}
