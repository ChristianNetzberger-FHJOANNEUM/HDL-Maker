import type { EditableDiagram, EditableNet, EditableWire } from '../../models/editable'
import { newDiagramId } from '../../models/editable'
import { elbow } from './geometry'

export interface PortEnd {
  kind: 'instance' | 'diagram_port'
  owner: string
  portId: string
  center: { x: number; y: number }
}

export function netContaining(doc: EditableDiagram, end: { kind: string; owner: string; portId: string }): EditableNet | undefined {
  return doc.nets.find((net) =>
    net.endpoints.some((item) => item.kind === end.kind && item.owner_id === end.owner && item.port_id === end.portId),
  )
}

export function mergeNets(doc: EditableDiagram, keepId: string, dropId: string): void {
  if (keepId === dropId) return
  const keep = doc.nets.find((net) => net.id === keepId)
  const drop = doc.nets.find((net) => net.id === dropId)
  if (!keep || !drop) return
  const present = new Set(keep.endpoints.map((item) => endpointKey(item)))
  for (const endpoint of drop.endpoints) {
    const key = endpointKey(endpoint)
    if (present.has(key)) continue
    keep.endpoints.push(endpoint)
    present.add(key)
  }
  for (const wire of doc.wires) {
    if (wire.net_id === dropId) wire.net_id = keepId
  }
  doc.nets = doc.nets.filter((net) => net.id !== dropId)
}

/** Returns an error message when the end cannot be split. The document is unchanged in that case. */
export function splitEndpoint(doc: EditableDiagram, wireId: string, which: 'start' | 'end'): string | null {
  const wire = doc.wires.find((item) => item.id === wireId)
  if (!wire) return 'Wire not found.'
  const end = which === 'start' ? wire.start : wire.end
  if (!end?.port_id || (end.kind !== 'instance' && end.kind !== 'diagram_port')) return 'This end is not an HDL port.'
  const endKind = end.kind
  const ownerId = end.owner_id
  const portId = end.port_id
  const net = doc.nets.find((item) => item.id === wire.net_id)
  if (!net || net.endpoints.length < 2) return 'This net has nothing to split.'
  const moved = net.endpoints.filter(
    (item) => item.kind === end.kind && item.owner_id === end.owner_id && item.port_id === end.port_id,
  )
  if (!moved.length) return "This end is not on the wire's net."
  net.endpoints = net.endpoints.filter(
    (item) => !(item.kind === end.kind && item.owner_id === end.owner_id && item.port_id === end.port_id),
  )
  const fresh: EditableNet = {
    id: newDiagramId('net'),
    name: nextNetName(doc),
    type_text: null,
    range_text: null,
    hds_object: null,
    endpoints: moved,
  }
  doc.nets.push(fresh)
  const remaining = new Set(net.endpoints.map((item) => endpointKey(item)))
  doc.wires = doc.wires.filter((item) => {
    if (item.net_id !== net.id) return true
    if (!wireTouches(item, endKind, ownerId, portId)) return true
    if (wireCrosses(item, endKind, ownerId, portId, remaining)) return false
    item.net_id = fresh.id
    return true
  })
  if (!net.endpoints.length && !doc.wires.some((item) => item.net_id === net.id)) {
    doc.nets = doc.nets.filter((item) => item.id !== net.id)
  }
  return null
}

export function ensureNet(doc: EditableDiagram, existing: EditableNet | undefined): EditableNet {
  if (existing) return existing
  const net: EditableNet = {
    id: newDiagramId('net'),
    name: nextNetName(doc),
    type_text: null,
    range_text: null,
    hds_object: null,
    endpoints: [],
  }
  doc.nets.push(net)
  return net
}

export function addEndpoint(net: EditableNet, end: PortEnd): void {
  if (net.endpoints.some((item) => item.kind === end.kind && item.owner_id === end.owner && item.port_id === end.portId)) return
  net.endpoints.push({
    id: newDiagramId('ep'),
    kind: end.kind,
    owner_id: end.owner,
    port_id: end.portId,
    slice_text: null,
  })
}

export function addWire(doc: EditableDiagram, net: EditableNet, from: PortEnd, to: PortEnd): void {
  doc.wires.push({
    id: newDiagramId('wire'),
    net_id: net.id,
    points: elbow(from.center, to.center),
    start: { kind: from.kind, owner_id: from.owner, port_id: from.portId },
    end: { kind: to.kind, owner_id: to.owner, port_id: to.portId },
    slice_text: null,
    hds_object: null,
  })
}

function nextNetName(doc: EditableDiagram): string {
  const used = new Set(doc.nets.map((net) => net.name))
  let number = doc.nets.length + 1
  while (used.has(`n_${number}`)) number += 1
  return `n_${number}`
}

function endpointKey(endpoint: { kind: string; owner_id: string; port_id: string }): string {
  return `${endpoint.kind}:${endpoint.owner_id}:${endpoint.port_id}`
}

function wireTouches(wire: EditableWire, kind: string, ownerId: string, portId: string): boolean {
  return [wire.start, wire.end].some((end) => end?.kind === kind && end.owner_id === ownerId && end.port_id === portId)
}

function wireCrosses(wire: EditableWire, kind: string, ownerId: string, portId: string, remaining: Set<string>): boolean {
  for (const end of [wire.start, wire.end]) {
    if (!end?.port_id || (end.kind !== 'instance' && end.kind !== 'diagram_port')) continue
    if (end.kind === kind && end.owner_id === ownerId && end.port_id === portId) continue
    if (remaining.has(`${end.kind}:${end.owner_id}:${end.port_id}`)) return true
  }
  return false
}
