import { sha256Sync } from './assets'
import { pictureAssets } from './pictures'
import { emptyDocument } from './edit'
import { portAnchor } from './geometry'
import { addNameLabel, commitWire, setRouted } from './nets'
import { addImageAsset, addSymbolPort, addSymbolShape, defineSymbol, instantiateSymbol } from './symbols'
import { createId, type DiagramDocument, type PortSide } from './document'

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAPSURBVBhXYxDRsPnPgAwAFVwBeCtmUvYAAAAASUVORK5CYII='

function hit(doc: DiagramDocument, portId: string) {
  const point = portAnchor(doc, portId)
  if (!point) throw new Error(`Missing port ${portId}`)
  return { kind: 'port' as const, portId, point }
}

function portOf(doc: DiagramDocument, blockId: string, symbolPortId: string): string {
  const port = doc.ports.find((item) => item.blockId === blockId && item.symbolPortId === symbolPortId)
  if (!port) throw new Error(`Missing pin ${symbolPortId} on ${blockId}`)
  return port.id
}

/** Reference sheet for the D0–D3e acceptance. It is not an HDL import. */
export function acceptanceSheet(): DiagramDocument {
  const doc = emptyDocument()
  doc.id = 'doc_acceptance'
  const gate = defineSymbol(doc, { name: 'Gate', width: 88, height: 64, ports: [] })
  const pinA = addSymbolPort(doc, gate, { name: 'a', side: 'left', t: 0.35 })!
  const pinB = addSymbolPort(doc, gate, { name: 'b', side: 'left', t: 0.7 })!
  const pinY = addSymbolPort(doc, gate, { name: 'y', side: 'right', t: 0.5 })!
  addSymbolShape(doc, gate, { kind: 'rect', x: 8, y: 8, width: 72, height: 48 })

  const ledAsset = pictureAssets()[0]
  if (!ledAsset) throw new Error('The LED picture is missing.')
  addImageAsset(doc, {
    id: ledAsset.id,
    name: ledAsset.name,
    mime: ledAsset.mime,
    data: ledAsset.data,
    width: ledAsset.width,
    height: ledAsset.height,
    checksum: ledAsset.checksum,
  })
  const lamp = defineSymbol(doc, { name: 'Lamp', width: 160, height: 108, ports: [] })
  addSymbolShape(doc, lamp, { kind: 'image', assetId: ledAsset.id, x: 20, y: 4, width: 120, height: 80, lockAspect: true })
  const pinAnode = addSymbolPort(doc, lamp, { name: 'a', side: 'left', t: 0.5 })!
  const pinCathode = addSymbolPort(doc, lamp, { name: 'k', side: 'right', t: 0.5 })!

  const pngBytes = Uint8Array.from(atob(PNG), (char) => char.charCodeAt(0))
  const photo = addImageAsset(doc, {
    name: 'photo.png',
    mime: 'image/png',
    data: PNG,
    width: 2,
    height: 2,
    checksum: sha256Sync(pngBytes),
  })
  if (!photo.ok) throw new Error(photo.message)
  const sensor = defineSymbol(doc, { name: 'Sensor', width: 120, height: 80, ports: [] })
  addSymbolShape(doc, sensor, { kind: 'image', assetId: photo.id, x: 16, y: 12, width: 48, height: 48, lockAspect: true })
  const pinSense = addSymbolPort(doc, sensor, { name: 's', side: 'bottom', t: 0.5, x: 0.4, y: 0.62 })!

  const note = defineSymbol(doc, { name: 'Note', width: 100, height: 48, ports: [] })
  addSymbolShape(doc, note, { kind: 'text', x: 12, y: 28, text: 'note' })
  const pinNote = addSymbolPort(doc, note, { name: 'n', side: 'left', t: 0.5 })!

  const box = defineSymbol(doc, { name: 'Box', width: 96, height: 64, ports: [] })
  addSymbolShape(doc, box, { kind: 'ellipse', x: 8, y: 8, width: 80, height: 48 })
  const pinIn = addSymbolPort(doc, box, { name: 'in', side: 'left', t: 0.5 })!
  const pinFree = addSymbolPort(doc, box, { name: 'tap', side: 'top', t: 0.5, x: 0.5, y: 0.3 })!

  const gates = [0, 1, 2, 3, 4, 5].map((index) => instantiateSymbol(doc, gate, { x: 80 + (index % 3) * 220, y: 80 + Math.floor(index / 3) * 160 }, `G${index + 1}`)!)
  const lamps = [0, 1, 2, 3].map((index) => instantiateSymbol(doc, lamp, { x: 760, y: 80 + index * 150 }, `L${index + 1}`)!)
  const sensors = [0, 1, 2, 3].map((index) => instantiateSymbol(doc, sensor, { x: 80 + index * 180, y: 420 }, `S${index + 1}`)!)
  const notes = [0, 1, 2, 3].map((index) => instantiateSymbol(doc, note, { x: 80 + index * 160, y: 560 }, `N${index + 1}`)!)
  const boxes = [0, 1, 2, 3].map((index) => instantiateSymbol(doc, box, { x: 760, y: 700 + index * 120 }, `B${index + 1}`)!)
  void notes
  void boxes

  const y0 = portOf(doc, gates[0]!, pinY)
  const a1 = portOf(doc, gates[1]!, pinA)
  const a2 = portOf(doc, gates[2]!, pinA)
  const first = commitWire(doc, [hit(doc, y0).point, hit(doc, a1).point], hit(doc, y0), hit(doc, a1))
  const second = commitWire(doc, [hit(doc, y0).point, hit(doc, a2).point], hit(doc, y0), hit(doc, a2))
  if (!first.ok || !second.ok) throw new Error('The branch could not be wired.')
  addNameLabel(doc, first.segmentId, 0, 24, 12)
  addNameLabel(doc, second.segmentId, 0, 24, -12)
  const junctionId = createId('jnc')
  doc.junctions.push({ id: junctionId, netId: first.netId, x: 280, y: 200 })
  const cathode = portOf(doc, lamps[0]!, pinCathode)
  doc.segments.push({
    id: createId('seg'),
    netId: first.netId,
    routed: 'manual',
    points: [
      { x: 280, y: 200 },
      { x: 700, y: 200 },
      { x: 700, y: hit(doc, cathode).point.y },
      hit(doc, cathode).point,
    ],
    start: { kind: 'junction', junctionId },
    end: { kind: 'port', portId: cathode },
  })
  const sense = portOf(doc, sensors[0]!, pinSense)
  const anode = portOf(doc, lamps[1]!, pinAnode)
  const linked = commitWire(doc, [hit(doc, sense).point, { x: 400, y: 520 }, hit(doc, anode).point], hit(doc, sense), hit(doc, anode))
  if (!linked.ok) throw new Error(linked.reason)
  setRouted(doc, linked.segmentId, 'auto')
  const boxIn = portOf(doc, boxes[0]!, pinIn)
  const noteOut = portOf(doc, notes[0]!, pinNote)
  const manual = commitWire(doc, [hit(doc, noteOut).point, { x: 40, y: 580 }, { x: 40, y: 760 }, hit(doc, boxIn).point], hit(doc, noteOut), hit(doc, boxIn))
  if (!manual.ok) throw new Error(manual.reason)
  void pinB
  void pinFree
  return doc
}

function sideCount(index: number): { side: PortSide; slot: number; count: number } {
  const side = (['left', 'right', 'top', 'bottom'] as const)[index % 4]
  const count = side === 'left' || side === 'right' ? 22 : 21
  const slot = Math.floor(index / 4)
  return { side, slot, count }
}

/** Synthetic sheet in the size class of a large HDL diagram. The HDL file itself is not read. */
export function benchSheet(): DiagramDocument {
  const doc = emptyDocument()
  doc.id = 'doc_bench'
  const cell = defineSymbol(doc, { name: 'Cell', width: 72, height: 48, ports: [] })
  const leftPins: string[] = []
  const rightPins: string[] = []
  for (let index = 0; index < 4; index += 1) {
    leftPins.push(addSymbolPort(doc, cell, { name: `l${index}`, side: 'left', t: (index + 1) / 5 })!)
    rightPins.push(addSymbolPort(doc, cell, { name: `r${index}`, side: 'right', t: (index + 1) / 5 })!)
  }
  const wide = defineSymbol(doc, { name: 'Wide', width: 160, height: 880, ports: [] })
  const widePins: string[] = []
  for (let index = 0; index < 86; index += 1) {
    const place = sideCount(index)
    widePins.push(addSymbolPort(doc, wide, { name: `p${index}`, side: place.side, t: (place.slot + 1) / (place.count + 1) })!)
  }
  const cells: string[] = []
  for (let index = 0; index < 49; index += 1) {
    const column = index % 7
    const row = Math.floor(index / 7)
    cells.push(instantiateSymbol(doc, cell, { x: 40 + column * 140, y: 40 + row * 100 }, `C${index + 1}`)!)
  }
  const wideId = instantiateSymbol(doc, wide, { x: 1100, y: 40 }, 'W')!
  for (let index = 0; index < 350; index += 1) {
    const fromBlock = cells[index % cells.length]!
    const toBlock = index % 11 === 0 ? wideId : cells[(index + 3) % cells.length]!
    const fromPin = leftPins[index % leftPins.length]!
    const toPin = toBlock === wideId ? widePins[index % widePins.length]! : rightPins[index % rightPins.length]!
    const netId = `net_${index % 40}`
    if (!doc.nets.some((net) => net.id === netId)) doc.nets.push({ id: netId, name: `n${index % 40}` })
    const start = hit(doc, portOf(doc, fromBlock, fromPin))
    const end = hit(doc, portOf(doc, toBlock, toPin))
    const segmentId = `seg_${index}`
    doc.segments.push({
      id: segmentId,
      netId,
      routed: index % 10 === 0 ? 'auto' : 'manual',
      points: [start.point, { x: (start.point.x + end.point.x) / 2, y: start.point.y }, end.point],
      start: { kind: 'port', portId: start.portId },
      end: { kind: 'port', portId: end.portId },
    })
    doc.labels.push({
      id: `lbl_${index}`,
      text: `n${index % 40}`,
      role: 'name',
      anchor: { kind: 'segment', segmentId, edge: 0, distance: 12, offset: 8 },
    })
  }
  for (let index = 0; index < 8; index += 1) {
    doc.junctions.push({ id: `jnc_${index}`, netId: `net_${index}`, x: 200 + index * 30, y: 30 })
  }
  return doc
}
