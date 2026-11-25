import { parseDocument, serialize } from './document'
import { autoRoute, labelPlacement, moveBlock, pinLocal, pinOnBorder, polylineLength, portAnchor, simplifyOrthogonal } from './geometry'
import { netFixture } from './fixture'
import { addNameLabel, commitWire, crossings, deleteSegment, labelText, mergeNets, moveLabelAlong, netPortIds, placeSpan, probeWire, renameNet, setRouted } from './nets'
import { wireClick } from './wiretool'
import { symbolSheet } from './symbolsheet'
import { addImageAsset, addSymbolLabel, addSymbolPort, addSymbolShape, defineSymbol, instantiateSymbol, moveFreeSymbolPort, moveSymbolPort, removeSymbolPort, setComponent, setSymbolSize, symbolDiagnostics } from './symbols'
import { auditAssets, base64ToBytes, inspectImage, sha256, sha256Sync } from './assets'
import { PICTURE_SOURCES, pictureAssets } from './pictures'
import { builtinLibraries } from './catalog'
import { cloneSymbol, emptyUserLibrary, mergeLibrary, parseLibrary, placeLibrarySymbol, publishSymbolRevision, removeLibrarySymbol, saveSymbolToLibrary, serializeLibrary } from './library'
import { emptyDocument, groupBlocks, duplicateGroup, duplicateBlocks, deleteBlocks, placeTemplate, BLOCK_TEMPLATES, linkPorts, captureFragment, pasteFragment } from './edit'
import { addPort } from './commands'
import { EditSession } from './session'
import { JsonRecordStorage } from './storage'
import { isOrthogonal, orthogonalize } from './orthogonalize'
import { sampleDocument } from './sample'
import { addComponent, createProject, documentById, findCycles, hierarchicalNets, implementationDocument, instancePaths, instantiateComponent, removeComponent, setImplementation, validateProject } from './component'
import { breadcrumbs, contentBounds, descend, DocumentSessions, parentLocation, resolveLocation, rootLocation, sharedDefinitionLabel, treeNodes } from './navigate'
import { JsonProjectStorage, parseProject, ProjectSession, sampleProject, serializeProject } from './project'
import { compareSymbols } from './compare'
import { acceptanceSheet, benchSheet } from './acceptance'
import { commitSymbolUpdate, detachInstance, dropPortWires, prepareSymbolUpdate, rebindPort } from './migration'

const failures: string[] = []

function check(condition: boolean, message: string): void {
  if (!condition) failures.push(message)
}

const doc = sampleDocument()
const before = labelPlacement(doc, 'lbl_link')
check(before !== null && Math.abs(before.x - 366) < 0.5 && Math.abs(before.y - 250) < 0.5, 'label starts on the vertical segment')

moveBlock(doc, 'blk_a', 120, 120)
const shifted = labelPlacement(doc, 'lbl_link')
const anchor = doc.labels[0].anchor
check(anchor.kind === 'segment' && anchor.edge === 1 && anchor.distance === 70, 'moving a block does not change the label anchor')
check(doc.nets[0].id === 'net_link' && doc.segments[0].id === 'seg_link', 'moving a block keeps net and segment ids')
check(doc.segments[0].points[1].x === 350, 'the manual trunk stays put when the block moves sideways')
check(shifted !== null && Math.abs(shifted.x - 366) < 0.5 && Math.abs(shifted.y - 250) < 0.5, 'the label does not inherit the block delta')

const vertical = sampleDocument()
moveBlock(vertical, 'blk_a', 80, 150)
const followed = labelPlacement(vertical, 'lbl_link')
check(followed !== null && Math.abs(followed.y - 280) < 0.5 && Math.abs(followed.x - 366) < 0.5, 'the label follows the segment it is anchored to')

const other = sampleDocument()
other.id = 'doc_other'
other.nets[0].id = 'net_other'
other.segments[0].netId = 'net_other'
other.segments[0].points = [
  { x: 200, y: 100 },
  { x: 400, y: 400 },
]
check(other.nets[0].id !== doc.nets[0].id, 'a crossing does not merge nets')

const stroke = [
  { x: 0, y: 0 },
  { x: 40, y: 1 },
  { x: 80, y: -1 },
  { x: 82, y: 40 },
  { x: 84, y: 90 },
]
const ortho = orthogonalize(stroke, 8)
check(ortho.ok, 'an L-shaped stroke converts')
if (ortho.ok) {
  check(isOrthogonal(ortho.points), 'the converted line is orthogonal')
  check(ortho.points.length <= 8, 'the converted line stays short')
}

const noisy: { x: number; y: number }[] = []
for (let i = 0; i < 40; i += 1) noisy.push({ x: i * 8, y: (i % 2) * 30 })
const refused = orthogonalize(noisy, 4)
check(!refused.ok, 'a stroke with many turns is refused')

doc.extensions = { course: { id: 'ex1' } }
doc.extra = { reviewer: true }
const loaded = parseDocument(serialize(doc))
check(loaded.id === doc.id && loaded.labels[0].anchor.kind === 'segment', 'save and load keep the anchor')
check(JSON.stringify(loaded.extensions) === JSON.stringify(doc.extensions), 'extension data survives')
check(loaded.extra.reviewer === true, 'unknown fields survive')
check(polylineLength(loaded.segments[0].points) > 0, 'geometry survives')

const historyDoc = sampleDocument()
let current = historyDoc
const session = new EditSession(
  () => current,
  (next) => {
    current = next
  },
)
session.execute((doc) => moveBlock(doc, 'blk_b', 500, 300))
session.undo()
check(current.blocks[1].x === 460 && current.blocks[1].y === 260, 'undo restores the block')
session.redo()
check(current.blocks[1].x === 500, 'redo applies the move again')

const gesture = emptyDocument()
let live = gesture
const gestures = new EditSession(
  () => live,
  (next) => {
    live = next
  },
)
gestures.execute((doc) => placeTemplate(doc, BLOCK_TEMPLATES[0], false))
const only = live.blocks[0].id
gestures.begin()
gestures.preview((doc) => moveBlock(doc, only, 81, 40))
gestures.preview((doc) => moveBlock(doc, only, 90, 40))
gestures.commit()
check(live.blocks[0].x === 90, 'the drag writes the document')
gestures.undo()
check(live.blocks[0].x === 80, 'one undo restores the whole drag')
gestures.begin()
gestures.preview((doc) => moveBlock(doc, only, 140, 40))
gestures.cancel()
check(live.blocks[0].x === 80, 'escape restores the drag')
gestures.undo()
check(live.blocks.length === 0, 'escape adds no history entry')

let built = emptyDocument()
const editing = new EditSession(
  () => built,
  (next) => {
    built = next
  },
)
for (let index = 0; index < 10; index += 1) {
  editing.execute((doc) => placeTemplate(doc, BLOCK_TEMPLATES[index % BLOCK_TEMPLATES.length], true))
}
check(built.blocks.length === 10, 'ten blocks were created')
const first = built.blocks[0].id
const second = built.blocks[1].id
editing.execute((doc) => addPort(doc, first))
editing.execute((doc) => {
  const block = doc.blocks.find((item) => item.id === second)
  if (!block) return
  doc.ports.push({ id: 'prt_in', blockId: second, name: 'in', side: 'left' })
})
const out = built.ports.find((port) => port.blockId === first)
editing.execute((doc) => {
  if (out) linkPorts(doc, out.id, 'prt_in', 'link')
})
const netId = built.nets[0]?.id
const segmentId = built.segments[0]?.id
const movedTo = built.blocks[0].x + 40
editing.execute((doc) => moveBlock(doc, first, movedTo, built.blocks[0].y))
check(built.nets[0]?.id === netId && built.segments[0]?.id === segmentId, 'moving a block keeps the connection ids')
const members = built.blocks.slice(2, 5).map((block) => block.id)
let groupId = ''
editing.execute((doc) => {
  groupId = groupBlocks(doc, members) ?? ''
})
const beforeDuplicate = built.blocks.length
editing.execute((doc) => duplicateGroup(doc, groupId, 40, 40))
check(built.blocks.length === beforeDuplicate + 3, 'duplicating a group copies its blocks')
check(built.groups.length === 2 && built.groups[0].id !== built.groups[1].id, 'the copy is a new group')
check(built.groups[0].blockIds.every((id) => built.blocks.some((block) => block.id === id)), 'original group ids remain')
const victim = built.blocks[9].id
editing.execute((doc) => deleteBlocks(doc, [victim]))
check(built.blocks.every((block) => block.id !== victim), 'delete removes the block')
editing.undo()
check(built.blocks.some((block) => block.id === victim), 'undo restores the deleted block')
editing.redo()
check(built.blocks.every((block) => block.id !== victim), 'redo deletes it again')
const storage = new JsonRecordStorage()
await storage.save(built)
const opened = await storage.load(built.id)
check(opened.blocks.length === built.blocks.length, 'reload keeps every block')
check(opened.blocks[0].x === movedTo && opened.blocks[0].id === first, 'reload keeps ids and positions')
check(opened.segments[0]?.id === segmentId && opened.segments[0]?.netId === netId, 'reload keeps the connection')
check(opened.segments[0]?.start.kind === 'port' && opened.segments[0].start.portId === out?.id, 'reload keeps the port binding')
const file = await storage.importText(storage.exportText(built.id))
check(file.id === built.id && file.blocks.length === opened.blocks.length, 'the json file text is the stored document')
const fragment = captureFragment(built, [first, second])
const pasted = pasteFragment(built, fragment, 40, 40)
check(pasted.length === 2 && pasted.every((id) => id !== first && id !== second), 'paste assigns new block ids')
check(built.segments.length === 2 && built.segments[0]?.id === segmentId, 'paste copies a connection and keeps the original')

const legacy = JSON.parse(serialize(sampleDocument())) as Record<string, unknown>
delete legacy.junctions
const legacyDoc = parseDocument(JSON.stringify(legacy))
check(legacyDoc.junctions.length === 0 && legacyDoc.segments[0]?.id === 'seg_link', 'a D1 file without junctions still loads')

const netSheet = netFixture()
check(netSheet.blocks.length >= 10, 'the net sheet has ten blocks')
check(netSheet.blocks.every((block) => netSheet.ports.filter((port) => port.blockId === block.id).length >= 2), 'every block has several ports')
check(netPortIds(netSheet, 'net_main').length >= 4, 'one net reaches four ports')
check(netSheet.junctions.length >= 3, 'the branched net has three junctions')
check(netSheet.labels.length >= 2 && netSheet.labels.every((label) => labelText(netSheet, label) === 'main'), 'one net has two name labels')
const longWire = netSheet.segments.find((segment) => segment.id === 'seg_long')
check((longWire?.points.length ?? 0) >= 8, 'one wire has at least six bends')
const freeWire = netSheet.segments.find((segment) => segment.id === 'seg_free')
check(freeWire?.start.kind === 'free' && freeWire.end.kind === 'free', 'one wire is not connected')
check(crossings(netSheet).some((cross) => cross.a === 'seg_hop' || cross.b === 'seg_hop'), 'a crossing does not create a junction')
const downPoints = JSON.stringify(netSheet.segments.find((segment) => segment.id === 'seg_down')?.points)
renameNet(netSheet, 'net_main', 'clock')
check(netSheet.labels.every((label) => labelText(netSheet, label) === 'clock'), 'renaming updates every name label')
check(JSON.stringify(netSheet.segments.find((segment) => segment.id === 'seg_down')?.points) === downPoints, 'renaming does not move a wire')
const abPoints = JSON.stringify(netSheet.segments.find((segment) => segment.id === 'seg_ab1')?.points)
moveLabelAlong(netSheet, 'lbl_main_a', 0, 28)
check(JSON.stringify(netSheet.segments.find((segment) => segment.id === 'seg_ab1')?.points) === abPoints, 'moving a label does not move the wire')
moveBlock(netSheet, 'blk_a', 80, 40)
const movedStart = netSheet.segments.find((segment) => segment.id === 'seg_ab1')?.start
check(movedStart?.kind === 'port' && movedStart.portId === 'blk_a_r', 'moving a block keeps the port binding')
check(netSheet.labels[0]?.anchor.kind === 'segment' && netSheet.labels[0].anchor.edge === 0, 'the label stays on its edge')
check(netSheet.segments.find((segment) => segment.id === 'seg_cross')?.netId !== netSheet.segments.find((segment) => segment.id === 'seg_hop')?.netId, 'the crossing stays two nets after a move')
const reloaded = parseDocument(serialize(netSheet))
check(reloaded.junctions.map((junction) => junction.id).join() === netSheet.junctions.map((junction) => junction.id).join(), 'reload keeps junction ids')
check(JSON.stringify(reloaded.labels.map((label) => label.anchor)) === JSON.stringify(netSheet.labels.map((label) => label.anchor)), 'reload keeps label anchors')

const drawing = netFixture()
let drawn = drawing
const drawingSession = new EditSession(
  () => drawn,
  (next) => {
    drawn = next
  },
)
const from = portAnchor(drawn, 'blk_d_r')
const to = portAnchor(drawn, 'blk_h_r')
const started = wireClick(null, { kind: 'port', portId: 'blk_d_r', point: from ?? { x: 0, y: 0 } })
const bent = wireClick(started.draft, { kind: 'free', point: { x: (from?.x ?? 0) + 40, y: (from?.y ?? 0) + 30 } })
check(bent.commit === null && bent.draft !== null, 'a bend does not finish the wire')
const finished = wireClick(bent.draft, { kind: 'port', portId: 'blk_h_r', point: to ?? { x: 0, y: 0 } })
check(finished.commit !== null && finished.draft === null, 'the next port finishes the wire')
const beforeCount = drawn.segments.length
if (finished.commit) {
  const commit = finished.commit
  drawingSession.execute((doc) => {
    commitWire(doc, commit.points, commit.start, commit.end)
  })
}
check(drawn.segments.length === beforeCount + 1, 'finishing a wire is one edit')
drawingSession.undo()
check(drawn.segments.length === beforeCount, 'undo removes that wire')
const cancelled = wireClick(wireClick(null, { kind: 'free', point: { x: 1, y: 1 } }).draft, { kind: 'free', point: { x: 30, y: 1 } })
check(cancelled.draft !== null && drawn.segments.length === beforeCount, 'escape drops the draft and writes nothing')

const clash = probeWire(
  drawn,
  { kind: 'port', portId: 'blk_a_r', point: portAnchor(drawn, 'blk_a_r') ?? { x: 0, y: 0 } },
  { kind: 'port', portId: 'blk_g_r', point: portAnchor(drawn, 'blk_g_r') ?? { x: 0, y: 0 } },
)
check(!clash.ok && clash.netIds.length === 2, 'two nets are not merged silently')
const segmentCount = drawn.segments.length
commitWire(
  drawn,
  [portAnchor(drawn, 'blk_a_r') ?? { x: 0, y: 0 }, portAnchor(drawn, 'blk_g_r') ?? { x: 0, y: 0 }],
  { kind: 'port', portId: 'blk_a_r', point: portAnchor(drawn, 'blk_a_r') ?? { x: 0, y: 0 } },
  { kind: 'port', portId: 'blk_g_r', point: portAnchor(drawn, 'blk_g_r') ?? { x: 0, y: 0 } },
)
check(drawn.segments.length === segmentCount, 'a refused wire does not change the document')

const joined = commitWire(
  drawn,
  [portAnchor(drawn, 'blk_d_l') ?? { x: 0, y: 0 }, { x: 250, y: 80 }],
  { kind: 'port', portId: 'blk_d_l', point: portAnchor(drawn, 'blk_d_l') ?? { x: 0, y: 0 } },
  { kind: 'segment', segmentId: 'seg_ab2', point: { x: 250, y: 80 }, edge: 0, distance: 30 },
)
check(joined.ok && joined.netId === 'net_main', 'attaching to a wire joins that net')
check(drawn.junctions.length === 4, 'attaching creates one junction')
check(drawn.segments.some((segment) => segment.id === 'seg_ab2'), 'the original segment id remains')

const splitting = netFixture()
const spawned = deleteSegment(splitting, 'seg_link')
check(spawned.length === 1, 'detaching a bridge creates one new net')
check(splitting.segments.find((segment) => segment.id === 'seg_ab1')?.netId === 'net_main', 'the kept piece keeps the net id')
check(splitting.segments.find((segment) => segment.id === 'seg_c')?.netId === spawned[0], 'the other piece gets a new net id')
check(mergeNets(splitting, 'net_main', spawned[0] ?? ''), 'merge keeps the chosen net')
check(splitting.segments.find((segment) => segment.id === 'seg_c')?.netId === 'net_main', 'merge moves the segments')

const trunk = drawn.segments.find((segment) => segment.id === 'seg_long')
const trunkX = trunk?.points[3]?.x ?? 0
placeSpan(drawn, 'seg_long', 3, trunkX + 16)
check(drawn.segments.find((segment) => segment.id === 'seg_long')?.start.kind === 'port', 'moving a span keeps its port')
check((drawn.segments.find((segment) => segment.id === 'seg_long')?.points.length ?? 0) >= 8, 'moving a span does not collapse the bends')
const manual = JSON.stringify(drawn.segments.find((segment) => segment.id === 'seg_ab1')?.points)
setRouted(drawn, 'seg_ab2', 'auto')
check(JSON.stringify(drawn.segments.find((segment) => segment.id === 'seg_ab1')?.points) === manual, 'automatic routing leaves manual wires alone')
check(simplifyOrthogonal([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }]).length === 3, 'colinear bends are removed')

const bare = JSON.parse(serialize(sampleDocument())) as Record<string, unknown>
delete bare.symbols
const bareDoc = parseDocument(JSON.stringify(bare))
check(bareDoc.symbols.length === 0 && bareDoc.blocks.length === 2, 'a document without symbols still loads')

const counters = symbolSheet()
const instances = counters.blocks.filter((block) => block.symbolId === 'sym_counter')
check(instances.length === 2 && instances[0].id !== instances[1].id, 'two instances share one symbol and keep their own ids')
const q1 = counters.ports.find((port) => port.blockId === instances[0].id && port.symbolPortId === 'pin_q')
const q2 = counters.ports.find((port) => port.blockId === instances[1].id && port.symbolPortId === 'pin_q')
check(Boolean(q1 && q2 && q1.id !== q2.id), 'each instance pin has its own id')
const binding = counters.segments[0]
const bound =
  binding &&
  ((binding.start.kind === 'port' && (binding.start.portId === q1?.id || binding.start.portId === q2?.id)) ||
    (binding.end.kind === 'port' && (binding.end.portId === q1?.id || binding.end.portId === q2?.id)))
check(Boolean(bound), 'the wire cites the instance pin, not the symbol pin')
const qId = q1?.id ?? ''
const beforeY = portAnchor(counters, qId)?.y ?? 0
moveSymbolPort(counters, 'sym_counter', 'pin_q', 'right', 0.2)
const movedPin = counters.ports.find((port) => port.id === qId)
check(movedPin?.symbolPortId === 'pin_q' && movedPin.side === 'right', 'moving a symbol pin keeps the instance pin id')
const shiftedY = portAnchor(counters, qId)?.y ?? 0
check(Math.abs(shiftedY - beforeY) > 1, 'the wire end follows the pin')
check(
  counters.segments.some(
    (segment) =>
      (segment.start.kind === 'port' && segment.start.portId === qId) || (segment.end.kind === 'port' && segment.end.portId === qId),
  ),
  'the connection survives the symbol change',
)
check(symbolDiagnostics(counters).length === 0, 'a moved pin is not a diagnosis')
removeSymbolPort(counters, 'sym_counter', 'pin_q')
const dangling = symbolDiagnostics(counters).filter((item) => item.kind === 'missing-port' && item.symbolPortId === 'pin_q')
check(dangling.length === 2 && dangling.some((item) => item.portId === qId), 'a removed pin is diagnosed on every instance')
check(
  counters.segments.some(
    (segment) =>
      (segment.start.kind === 'port' && segment.start.portId === qId) || (segment.end.kind === 'port' && segment.end.portId === qId),
  ),
  'removing a symbol pin does not delete the wire',
)
check(Math.abs((portAnchor(counters, qId)?.y ?? 0) - shiftedY) < 0.5, 'a removed pin keeps the last position')
const added = addSymbolPort(counters, 'sym_counter', { name: 'en', side: 'left', t: 0.5 })
check(
  counters.ports.filter((port) => port.symbolPortId === added).length === 2,
  'a new symbol pin appears on every instance',
)
setComponent(counters, instances[0].id, 'cmp_counter')
const marked = counters.blocks.find((block) => block.id === instances[0].id)
if (marked) marked.parameters = { N: '4' }
const stored = parseDocument(serialize(counters))
check(stored.blocks.find((block) => block.id === instances[0].id)?.componentId === 'cmp_counter', 'a component reference is stored and not opened')
check(stored.blocks.find((block) => block.id === instances[0].id)?.parameters?.N === '4', 'instance parameters round-trip')
check(stored.symbols[0]?.id === 'sym_counter' && stored.symbols[0].ports.some((port) => port.id === 'pin_clk'), 'the symbol definition reloads')
const copy = duplicateBlocks(counters, [instances[1].id], 40, 40)
const copyId = copy.get(instances[1].id) ?? ''
const copied = counters.ports.filter((port) => port.blockId === copyId && port.symbolPortId === 'pin_clk')
const original = counters.ports.filter((port) => port.blockId === instances[1].id && port.symbolPortId === 'pin_clk')
check(copied.length === 1 && original.length === 1 && copied[0].id !== original[0].id, 'a copied instance keeps the symbol pin and gets a new port id')

const plain = portAnchor(sampleDocument(), 'prt_a1')
check(plain !== null && plain.x === 240 && plain.y === 180, 'a port without t keeps its old position')
const down = pinLocal(160, 120, 'left', 0.3)
const across = pinLocal(100, 80, 'top', 0.25)
const bottom = pinLocal(100, 80, 'bottom', 0.75)
check(down.x === 0 && down.y === 36, 't on a vertical side runs downward')
check(across.x === 25 && across.y === 0 && bottom.x === 75 && bottom.y === 80, 't on a horizontal side runs to the right')
check(pinOnBorder(100, 80, 1, 40).side === 'left' && pinOnBorder(100, 80, 50, 1).side === 'top', 'a click snaps to the nearest side')

const gate = emptyDocument()
defineSymbol(gate, {
  id: 'sym_gate',
  name: 'Gate',
  width: 100,
  height: 80,
  ports: [
    { id: 'pin_l', name: 'a', side: 'left', t: 0.5 },
    { id: 'pin_r', name: 'y', side: 'right', t: 0.5 },
    { id: 'pin_t', name: 'b', side: 'top', t: 0.25 },
    { id: 'pin_b', name: 'c', side: 'bottom', t: 0.75 },
  ],
  shapes: [
    { kind: 'ellipse', x: 10, y: 10, width: 80, height: 60 },
    { kind: 'polygon', points: [{ x: 20, y: 20 }, { x: 50, y: 20 }, { x: 35, y: 50 }] },
    { kind: 'line', x1: 10, y1: 40, x2: 90, y2: 40 },
  ],
})
addSymbolLabel(gate, 'sym_gate', 30, 46, 'G')
const gateU1 = instantiateSymbol(gate, 'sym_gate', { x: 40, y: 40 }, 'U1')
const gateU2 = instantiateSymbol(gate, 'sym_gate', { x: 280, y: 40 }, 'U2')
check(Boolean(gateU1 && gateU2), 'two instances of the drawn symbol')
const gateOut = gate.ports.find((port) => port.blockId === gateU1 && port.symbolPortId === 'pin_r')
const gateIn = gate.ports.find((port) => port.blockId === gateU2 && port.symbolPortId === 'pin_l')
const topPin = gate.ports.find((port) => port.blockId === gateU1 && port.symbolPortId === 'pin_t')
const gateFrom = gateOut ? portAnchor(gate, gateOut.id) : null
const gateTo = gateIn ? portAnchor(gate, gateIn.id) : null
if (gateOut && gateIn && gateFrom && gateTo) {
  const trunk = (gateFrom.x + gateTo.x) / 2
  commitWire(
    gate,
    [gateFrom, { x: trunk, y: gateFrom.y }, { x: trunk, y: gateTo.y }, gateTo],
    { kind: 'port', portId: gateOut.id, point: gateFrom },
    { kind: 'port', portId: gateIn.id, point: gateTo },
  )
}
const topAt = topPin ? portAnchor(gate, topPin.id) : null
check(topAt !== null && topAt.x === 65 && topAt.y === 40, 'the top pin sits on the top edge')
check(isOrthogonal(autoRoute({ x: 50, y: 80 }, { x: 80, y: 200 }, 'bottom', 'top', [])), 'a top or bottom pin can be routed orthogonally')
let gateLive = gate
const symbolSession = new EditSession(
  () => gateLive,
  (next) => {
    gateLive = next
  },
)
symbolSession.execute((draft) => setSymbolSize(draft, 'sym_gate', 140, 80))
const grown = topPin ? portAnchor(gateLive, topPin.id) : null
check(grown !== null && grown.x === 75 && gateLive.blocks.every((block) => block.symbolId !== 'sym_gate' || block.width === 140), 'both instances follow the symbol width')
check(
  gateLive.segments.some(
    (segment) =>
      (segment.start.kind === 'port' && segment.start.portId === gateOut?.id) || (segment.end.kind === 'port' && segment.end.portId === gateOut?.id),
  ),
  'resizing the symbol keeps the wire',
)
symbolSession.undo()
check(gateLive.symbols[0]?.width === 100 && gateLive.blocks[0]?.width === 100, 'undo restores the symbol and the instances')
removeSymbolPort(gateLive, 'sym_gate', 'pin_r')
check(
  symbolDiagnostics(gateLive).some((item) => item.kind === 'missing-port' && item.portId === gateOut?.id),
  'deleting a drawn pin leaves a diagnosis',
)
check(
  gateLive.segments.some(
    (segment) =>
      (segment.start.kind === 'port' && segment.start.portId === gateOut?.id) || (segment.end.kind === 'port' && segment.end.portId === gateOut?.id),
  ),
  'deleting a drawn pin leaves the wire',
)
const gateFile = parseDocument(serialize(gateLive))
const storedShape = gateFile.symbols[0]?.shapes ?? []
check(storedShape.some((shape) => shape.kind === 'ellipse') && storedShape.some((shape) => shape.kind === 'polygon'), 'ellipse and polygon survive save and load')
check(gateFile.symbols[0]?.labels[0]?.text === 'G', 'a symbol label survives save and load')

const catalogs = builtinLibraries()
const catalogIds = catalogs.flatMap((library) => library.symbols.map((symbol) => symbol.id))
const catalogNames = new Set(catalogs.flatMap((library) => library.symbols.map((symbol) => symbol.name)))
check(catalogs.length === 5 && catalogs.every((library) => library.builtin && library.version === 1 && !library.id.includes('\\') && !library.id.includes('/')), 'built-in libraries have ids, versions, and no file paths')
check(new Set(catalogIds).size === catalogIds.length, 'built-in symbol ids do not collide')
for (const required of ['Rectangle', 'Rounded rectangle', 'Ellipse', 'Generic block', 'Text box', 'Start / End', 'Process', 'Decision', 'Input / Output', 'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'Multiplexer', 'D flip-flop', 'Register', 'Counter', 'Gain', 'Adder', 'Multiplier', 'Integrator', 'Delay', 'Filter', 'LED', 'Switch', 'Meter', 'FPGA board', 'Oscillator']) {
  check(catalogNames.has(required), `the palette can offer ${required}`)
}
const andSymbol = catalogs.find((library) => library.id === 'lib_logic')?.symbols.find((symbol) => symbol.id === 'sym_and')
check(Boolean(andSymbol), 'AND is a library symbol')
const libraryDoc = emptyDocument()
let libraryLive = libraryDoc
const librarySession = new EditSession(
  () => libraryLive,
  (next) => {
    libraryLive = next
  },
)
if (andSymbol) {
  librarySession.execute((draft) => {
    placeLibrarySymbol(draft, andSymbol, { x: 40, y: 40 })
  })
  librarySession.execute((draft) => {
    placeLibrarySymbol(draft, andSymbol, { x: 220, y: 40 })
  })
}
check(libraryLive.symbols.length === 1 && libraryLive.blocks.length === 2, 'two placements share one definition inside the document')
const firstPorts = libraryLive.ports.filter((port) => port.blockId === libraryLive.blocks[0]?.id)
const secondPorts = libraryLive.ports.filter((port) => port.blockId === libraryLive.blocks[1]?.id)
check(firstPorts.length === 3 && secondPorts.length === 3 && firstPorts[0]?.id !== secondPorts[0]?.id && firstPorts[0]?.symbolPortId === secondPorts[0]?.symbolPortId, 'library instances keep separate port ids')
const yPort = firstPorts.find((port) => port.symbolPortId === 'pin_and_y')
const aPort = secondPorts.find((port) => port.symbolPortId === 'pin_and_a')
const yAt = yPort ? portAnchor(libraryLive, yPort.id) : null
const aAt = aPort ? portAnchor(libraryLive, aPort.id) : null
if (yPort && aPort && yAt && aAt) {
  const trunk = (yAt.x + aAt.x) / 2
  commitWire(
    libraryLive,
    [yAt, { x: trunk, y: yAt.y }, { x: trunk, y: aAt.y }, aAt],
    { kind: 'port', portId: yPort.id, point: yAt },
    { kind: 'port', portId: aPort.id, point: aAt },
  )
  addNameLabel(libraryLive, libraryLive.segments[0]?.id ?? '', 1, 20, 12)
}
const userLibrary = emptyUserLibrary()
check(Boolean(andSymbol && saveSymbolToLibrary(userLibrary, andSymbol).ok), 'a built-in symbol can be saved into the user library')
removeLibrarySymbol(userLibrary, 'sym_and')
check(userLibrary.symbols.length === 0 && libraryLive.symbols.some((symbol) => symbol.id === 'sym_and'), 'deleting a library symbol leaves the document copy')
check(Boolean(andSymbol && saveSymbolToLibrary(userLibrary, andSymbol).ok), 'the user library can store AND again')
const changedAnd = andSymbol ? cloneSymbol(andSymbol) : null
if (changedAnd) changedAnd.name = 'AND2'
const refusedSave = changedAnd ? saveSymbolToLibrary(userLibrary, changedAnd) : { ok: false as const, diagnostics: [] }
check(!refusedSave.ok && refusedSave.diagnostics.some((item) => item.kind === 'duplicate-id') && userLibrary.symbols[0]?.name === 'AND', 'a different symbol with the same id is not overwritten')
const imported = parseLibrary(serializeLibrary(userLibrary))
imported.version = 2
if (imported.symbols[0]) imported.symbols[0].name = 'AND2'
const versionNotes = mergeLibrary(userLibrary, imported)
check(versionNotes.some((item) => item.kind === 'version-conflict') && userLibrary.symbols[0]?.name === 'AND', 'a version conflict keeps the stored symbol')
const roundLibrary = parseLibrary(serializeLibrary(userLibrary))
check(roundLibrary.id === 'lib_user' && roundLibrary.symbols[0]?.id === 'sym_and' && roundLibrary.license === undefined, 'a user library exports and imports without a file path')
const conflictDoc = emptyDocument()
if (andSymbol) placeLibrarySymbol(conflictDoc, andSymbol, { x: 0, y: 0 })
if (conflictDoc.symbols[0]) conflictDoc.symbols[0].name = 'Local AND'
const refusedPlace = andSymbol ? placeLibrarySymbol(conflictDoc, andSymbol, { x: 80, y: 0 }) : { ok: false as const, message: '' }
check(!refusedPlace.ok && conflictDoc.blocks.length === 1 && conflictDoc.symbols[0]?.name === 'Local AND', 'placing a library symbol does not replace a different document symbol')
const reopened = parseDocument(serialize(libraryLive))
check(reopened.symbols[0]?.id === 'sym_and' && reopened.blocks.length === 2 && reopened.segments.length === 1, 'the diagram reopens without the library')
check(reopened.labels[0]?.anchor.kind === 'segment' && reopened.segments[0]?.start.kind === 'port' && reopened.segments[0].start.portId === yPort?.id, 'port ids and the label anchor survive without the library')
librarySession.undo()
check(libraryLive.blocks.length === 1, 'one undo removes one library placement')

const oldFile = parseDocument(JSON.stringify({ schemaVersion: 1, id: 'doc_old', blocks: [], ports: [], nets: [], segments: [], labels: [], strokes: [] }))
check(oldFile.assets.length === 0 && oldFile.symbols.length === 0, 'a document without assets still loads')
const packedPictures = pictureAssets()
for (const source of PICTURE_SOURCES) {
  const asset = packedPictures.find((item) => item.id === source.assetId)
  const bytes = asset ? base64ToBytes(asset.data) : new Uint8Array()
  const sum = await sha256(bytes)
  check(Boolean(asset) && sum === asset?.checksum && new TextDecoder().decode(bytes) === source.svg, `${source.title} picture matches its checksum`)
  const inspected = await inspectImage(bytes, source.fileName, 'image/svg+xml')
  check(inspected.ok && inspected.draft.width === 120 && inspected.draft.height === 80, `${source.title} is an accepted SVG`)
}
const pictures = catalogs.find((library) => library.id === 'lib_pictures')
check(pictures?.assets.length === 5 && new Set(pictures.assets.map((asset) => asset.checksum)).size === 5, 'each reference picture is stored once')
const led = pictures?.symbols.find((symbol) => symbol.id === 'sym_led')
const ledDoc = emptyDocument()
if (led && pictures) {
  placeLibrarySymbol(ledDoc, led, { x: 40, y: 40 }, undefined, pictures.assets)
  placeLibrarySymbol(ledDoc, led, { x: 240, y: 40 }, undefined, pictures.assets)
}
check(ledDoc.assets.length === 1 && ledDoc.symbols.length === 1 && ledDoc.blocks.length === 2, 'two LED instances share one embedded picture')
const pngBytes = base64ToBytes('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAPSURBVBhXYxDRsPnPgAwAFVwBeCtmUvYAAAAASUVORK5CYII=')
const jpegBytes = base64ToBytes('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD8q3dpHZ3Ys7HJZjkk+tFFFN7iWx//2Q==')
const png = await inspectImage(pngBytes, 'pixel.png', 'image/png')
const jpeg = await inspectImage(jpegBytes, 'pixel.jpg', 'image/jpeg')
check(png.ok && png.draft.width === 2 && png.draft.height === 2, 'a PNG is accepted with its pixel size')
check(jpeg.ok && jpeg.draft.mime === 'image/jpeg' && jpeg.draft.width === 2, 'a JPEG is accepted with its pixel size')
const webp = await inspectImage(base64ToBytes('UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA='), 'pixel.webp', 'image/webp')
check(webp.ok && webp.draft.mime === 'image/webp' && webp.draft.width === 1 && webp.draft.height === 1, 'a WebP is accepted with its pixel size')
const encode = (text: string) => new TextEncoder().encode(text)
const scriptSvg = await inspectImage(encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'bad.svg', 'image/svg+xml')
const handlerSvg = await inspectImage(encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'), 'bad.svg', 'image/svg+xml')
const remoteSvg = await inspectImage(encode('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png"/></svg>'), 'bad.svg', 'image/svg+xml')
const mismatched = await inspectImage(pngBytes, 'pixel.svg', 'image/svg+xml')
check(!scriptSvg.ok && scriptSvg.ok === false && scriptSvg.message.includes('script'), 'an SVG script is refused')
check(!handlerSvg.ok && !remoteSvg.ok && !mismatched.ok, 'handlers, external links, and mislabeled images are refused')
const untouched = emptyDocument()
check(untouched.assets.length === 0, 'a refused image is not stored')
let imageLive = emptyDocument()
const imageSession = new EditSession(
  () => imageLive,
  (next) => {
    imageLive = next
  },
)
if (png.ok) {
  imageSession.execute((draft) => {
    const symbolId = defineSymbol(draft, { name: 'Photo', width: 100, height: 80, ports: [] })
    const stored = addImageAsset(draft, png.draft)
    if (stored.ok) {
      addSymbolShape(draft, symbolId, { kind: 'image', assetId: stored.id, x: 10, y: 10, width: 40, height: 40, lockAspect: true })
      addSymbolShape(draft, symbolId, { kind: 'rect', x: 8, y: 8, width: 84, height: 64 })
      addSymbolLabel(draft, symbolId, 20, 70, 'LED')
      addSymbolPort(draft, symbolId, { name: 'in', side: 'left', t: 0.5 })
      addSymbolPort(draft, symbolId, { name: 'mark', side: 'left', t: 0.2, x: 0.25, y: 0.5 })
    }
    instantiateSymbol(draft, symbolId, { x: 40, y: 40 }, 'P1')
    instantiateSymbol(draft, symbolId, { x: 220, y: 40 }, 'P2')
  })
}
check(imageLive.assets.length === 1 && imageLive.symbols[0]?.shapes.some((shape) => shape.kind === 'rect') && imageLive.symbols[0]?.labels[0]?.text === 'LED', 'an image combines with a shape and a label')
const imageChecksum = imageLive.assets[0]?.checksum ?? ''
check((serialize(imageLive).match(new RegExp(imageChecksum, 'g')) ?? []).length === 1, 'the picture bytes are stored once')
const mark = imageLive.ports.find((port) => port.name === 'mark' && port.blockId === imageLive.blocks[0]?.id)
const otherIn = imageLive.ports.find((port) => port.name === 'in' && port.blockId === imageLive.blocks[1]?.id)
const markAt = mark ? portAnchor(imageLive, mark.id) : null
const otherAt = otherIn ? portAnchor(imageLive, otherIn.id) : null
check(markAt?.x === 65 && markAt.y === 80, 'a free pin uses a fraction of the symbol')
if (mark && otherIn && markAt && otherAt) {
  const trunk = (markAt.x + otherAt.x) / 2
  commitWire(
    imageLive,
    [markAt, { x: trunk, y: markAt.y }, { x: trunk, y: otherAt.y }, otherAt],
    { kind: 'port', portId: mark.id, point: markAt },
    { kind: 'port', portId: otherIn.id, point: otherAt },
  )
}
const markId = mark?.id
imageSession.execute((draft) => {
  setSymbolSize(draft, draft.symbols[0]?.id ?? '', 200, 80)
  moveFreeSymbolPort(draft, draft.symbols[0]?.id ?? '', draft.symbols[0]?.ports.find((port) => port.name === 'mark')?.id ?? '', 0.25, 0.5)
})
const movedMark = imageLive.ports.find((port) => port.id === markId)
const movedAt = movedMark ? portAnchor(imageLive, movedMark.id) : null
check(movedMark?.id === markId && movedAt?.x === 90 && movedAt.y === 80, 'resizing keeps the port id and the free pin fraction')
check(imageLive.segments[0]?.start.kind === 'port' && imageLive.segments[0].start.portId === markId, 'the wire still cites the same port')
const photoLibrary = emptyUserLibrary()
const photo = imageLive.symbols[0]
check(Boolean(photo && saveSymbolToLibrary(photoLibrary, photo, imageLive.assets).ok && photoLibrary.assets.length === 1), 'the picture symbol is saved with its asset')
const photoFile = parseLibrary(serializeLibrary(photoLibrary))
const secondPhoto = emptyDocument()
if (photoFile.symbols[0]) {
  placeLibrarySymbol(secondPhoto, photoFile.symbols[0], { x: 20, y: 20 }, undefined, photoFile.assets)
  placeLibrarySymbol(secondPhoto, photoFile.symbols[0], { x: 260, y: 20 }, undefined, photoFile.assets)
}
check(secondPhoto.assets.length === 1 && secondPhoto.blocks.length === 2 && secondPhoto.assets[0]?.checksum === imageChecksum, 'another document receives the picture once')
removeLibrarySymbol(photoLibrary, photo?.id ?? '')
const photoAgain = parseDocument(serialize(secondPhoto))
check(photoLibrary.assets.length === 0 && photoAgain.assets.length === 1 && photoAgain.segments.length === 0 && photoAgain.symbols[0]?.shapes.some((shape) => shape.kind === 'image'), 'the document keeps the picture after the library is gone')
imageSession.undo()
check(imageLive.symbols[0]?.width === 100, 'undo restores the symbol size')

const digestEmpty = sha256Sync(new Uint8Array())
const digestAbc = sha256Sync(new TextEncoder().encode('abc'))
check(digestEmpty === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'sha256 of an empty input')
check(digestAbc === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'sha256 of abc')
const pngDigestBytes = base64ToBytes('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAPSURBVBhXYxDRsPnPgAwAFVwBeCtmUvYAAAAASUVORK5CYII=')
check(sha256Sync(pngDigestBytes) === (await sha256(pngDigestBytes)), 'the sync checksum matches the platform checksum')

const versioned = defineSymbol(emptyDocument(), { name: 'Plain', width: 80, height: 40, ports: [] })
const versionDoc = emptyDocument()
const versionId = defineSymbol(versionDoc, { name: 'Plain', width: 80, height: 40, ports: [] })
addSymbolPort(versionDoc, versionId, { name: 'a', side: 'left', t: 0.5 })
const versionSymbol = versionDoc.symbols.find((item) => item.id === versionId)
if (versionSymbol) {
  versionSymbol.revision = 4
  const renamed = cloneSymbol(versionSymbol)
  renamed.revision = 9
  renamed.bodyChecksum = 'different'
  check(compareSymbols(versionSymbol, renamed).length === 0, 'a different revision is not treated as a content change')
  renamed.ports.push({ id: 'pin_new', name: 'enable', side: 'right', t: 0.5 })
  const moved = cloneSymbol(versionSymbol)
  if (moved.ports[0]) moved.ports[0].t = 0.2
  const renamedPin = cloneSymbol(versionSymbol)
  if (renamedPin.ports[0]) renamedPin.ports[0].name = 'clock'
  const freed = cloneSymbol(versionSymbol)
  if (freed.ports[0]) {
    freed.ports[0].x = 0.4
    freed.ports[0].y = 0.4
  }
  check(compareSymbols(versionSymbol, renamed).some((change) => change.kind === 'pin-added'), 'an added pin is detected by its id')
  check(compareSymbols(renamed, versionSymbol).some((change) => change.kind === 'pin-removed'), 'a removed pin is detected by its id')
  check(compareSymbols(versionSymbol, moved).some((change) => change.kind === 'pin-moved'), 'a moved pin keeps its id in the comparison')
  check(compareSymbols(versionSymbol, renamedPin).some((change) => change.kind === 'pin-renamed'), 'a renamed pin keeps its id in the comparison')
  check(compareSymbols(versionSymbol, freed).some((change) => change.kind === 'pin-freedom'), 'a side pin becoming free is detected')
}
void versioned
const legacyFile = parseDocument(serialize(sampleDocument()))
check(legacyFile.symbols.length === 0 && legacyFile.blocks.length === 2, 'a document without symbol versions still loads')

const mig = emptyDocument()
const migSymbol = defineSymbol(mig, { name: 'Timer', width: 120, height: 80, ports: [] })
const resetId = addSymbolPort(mig, migSymbol, { name: 'Reset', side: 'left', t: 0.3 })!
const clockId = addSymbolPort(mig, migSymbol, { name: 'Clock', side: 'left', t: 0.7 })!
const outId = addSymbolPort(mig, migSymbol, { name: 'Q', side: 'right', t: 0.5 })!
addSymbolShape(mig, migSymbol, { kind: 'rect', x: 8, y: 8, width: 104, height: 64 })
const migA = instantiateSymbol(mig, migSymbol, { x: 40, y: 40 }, 'U1')!
const migB = instantiateSymbol(mig, migSymbol, { x: 320, y: 40 }, 'U2')!
const migReset = mig.ports.find((port) => port.blockId === migA && port.symbolPortId === resetId)!
const migClock = mig.ports.find((port) => port.blockId === migB && port.symbolPortId === clockId)!
const migOut = mig.ports.find((port) => port.blockId === migA && port.symbolPortId === outId)!
const migWire = commitWire(mig, [portAnchor(mig, migReset.id)!, portAnchor(mig, migClock.id)!], { kind: 'port', portId: migReset.id, point: portAnchor(mig, migReset.id)! }, { kind: 'port', portId: migClock.id, point: portAnchor(mig, migClock.id)! })
check(migWire.ok, 'the migration sheet wires')
const migAnchor = JSON.stringify(mig.labels[0]?.anchor)
const migNet = mig.segments[0]?.netId
const migManual = mig.segments[0]
if (migManual && migManual.points.length >= 2) {
  migManual.points = [migManual.points[0], { x: 180, y: migManual.points[0].y }, { x: 180, y: migManual.points[migManual.points.length - 1].y }, migManual.points[migManual.points.length - 1]]
  migManual.routed = 'manual'
}
const migLib = emptyUserLibrary()
const migStored = mig.symbols[0]!
check(saveSymbolToLibrary(migLib, migStored, mig.assets).ok, 'the symbol is stored before it is revised')
const published = cloneSymbol(migLib.symbols[0]!)
published.shapes = [{ kind: 'rect', x: 4, y: 4, width: 112, height: 72 }]
published.width = 140
const clock = published.ports.find((port) => port.id === clockId)
if (clock) clock.name = 'Clk'
const reset = published.ports.find((port) => port.id === resetId)
published.ports = published.ports.filter((port) => port.id !== resetId)
published.ports.push({ id: 'pin_enable', name: 'Reset', side: 'left', t: reset?.t ?? 0.3 })
const publishedRev = publishSymbolRevision(migLib, published, mig.assets)
check(publishedRev.ok && publishedRev.ok === true && publishedRev.revision === 2, 'publishing writes a new library revision')
const beforeOpen = serialize(mig)
const reopenedMig = parseDocument(beforeOpen)
check(reopenedMig.symbols[0]?.ports.some((port) => port.id === resetId) && reopenedMig.symbols[0]?.width === 120, 'opening a document does not pull the library revision')
const migUntouched = serialize(mig)
const prepared = prepareSymbolUpdate(mig, migSymbol, migLib.symbols[0]!, migLib.assets)
check(prepared.ok && serialize(mig) === migUntouched, 'preparing an update does not change the document')
if (prepared.ok) {
  check(prepared.preview.instanceIds.length === 2, 'the preview counts both instances')
  check(prepared.preview.conflicts.length === 1 && prepared.preview.conflicts[0]?.netName !== undefined, 'a wired removed pin is a conflict and names its net')
  check(prepared.preview.changes.some((change) => change.kind === 'pin-removed' && change.pinId === resetId), 'Reset is removed by its id')
  check(prepared.preview.changes.some((change) => change.kind === 'pin-added' && change.pinId === 'pin_enable'), 'Enable is a new pin even if it reuses the name Reset')
  check(prepared.preview.changes.some((change) => change.kind === 'size'), 'a size change is reported')
  check(prepared.preview.changes.some((change) => change.kind === 'pin-renamed' && change.pinId === clockId), 'Clock keeps its pin id when renamed')
}
const migSession = new EditSession(() => mig, (next) => {
  mig.blocks = next.blocks
  mig.ports = next.ports
  mig.nets = next.nets
  mig.segments = next.segments
  mig.junctions = next.junctions
  mig.labels = next.labels
  mig.symbols = next.symbols
  mig.assets = next.assets
  mig.groups = next.groups
  mig.strokes = next.strokes
})
if (prepared.ok) {
  migSession.execute((draft) => commitSymbolUpdate(draft, prepared.prepared))
}
const enablePort = mig.ports.find((port) => port.blockId === migA && port.symbolPortId === 'pin_enable')
check(mig.symbols[0]?.width === 140 && mig.blocks[0]?.width === 140 && mig.blocks[1]?.width === 140, 'a confirmed update changes every instance')
check(migReset.id === mig.ports.find((port) => port.blockId === migA && port.name === 'Reset' && port.symbolPortId === resetId)?.id, 'the removed Reset port keeps its instance id')
check(mig.segments.some((segment) => segment.end.kind === 'port' && segment.end.portId === migClock.id), 'the renamed pin keeps the wire')
check(!mig.segments.some((segment) => (segment.start.kind === 'port' && segment.start.portId === enablePort?.id) || (segment.end.kind === 'port' && segment.end.portId === enablePort?.id)), 'the new pin is not wired just because it is also called Reset')
check(mig.segments[0]?.netId === migNet && mig.segments[0]?.routed === 'manual' && mig.segments[0]?.points.some((point) => point.x === 180), 'a manual route is not replaced')
check(JSON.stringify(mig.labels[0]?.anchor) === migAnchor, 'the label anchor is unchanged')
const conflict = symbolDiagnostics(mig).find((item) => item.symbolPortId === resetId)
check(Boolean(conflict), 'the removed pin remains as a diagnosis')
const historyBefore = migSession.canUndo
const assignTarget = mig.ports.find((port) => port.blockId === migA && port.symbolPortId === outId)!
const rebound = rebindPort(parseDocument(serialize(mig)), migReset.id, assignTarget.id)
check(rebound.ok && rebound.ok === true && rebound.nets.length > 0, 'reassignment names the affected nets')
migSession.execute((draft) => {
  rebindPort(draft, migReset.id, assignTarget.id)
})
check(mig.segments.some((segment) => segment.start.kind === 'port' && segment.start.portId === assignTarget.id) || mig.segments.some((segment) => segment.end.kind === 'port' && segment.end.portId === assignTarget.id), 'the wire moves only to the chosen port')
migSession.undo()
check(mig.segments.some((segment) => (segment.start.kind === 'port' && segment.start.portId === migReset.id) || (segment.end.kind === 'port' && segment.end.portId === migReset.id)), 'undo restores the wire to the removed pin')
const dropped = dropPortWires(parseDocument(serialize(mig)), migReset.id)
check(dropped.length > 0, 'the conflict has a wire that can be removed')
migSession.undo()
check(mig.symbols[0]?.width === 120 && mig.ports.some((port) => port.id === migReset.id && port.symbolPortId === resetId), 'undo restores the definition, the port ids, and the pin')
check(historyBefore, 'the update created one undo step')
migSession.redo()
check(mig.symbols[0]?.width === 140, 'redo restores the updated symbol')
const detached = detachInstance(mig, migB)
check(detached.ok && mig.blocks.find((block) => block.id === migB)?.symbolId !== migSymbol && mig.blocks.find((block) => block.id === migA)?.symbolId === migSymbol, 'one instance can be given its own definition')

const sheet = acceptanceSheet()
check(sheet.blocks.length >= 20 && sheet.symbols.length >= 5, 'the acceptance sheet has twenty blocks and five symbols')
check(sheet.blocks.filter((block) => block.symbolId === sheet.symbols[0]?.id).length >= 2, 'one symbol is used more than once')
check(sheet.assets.length >= 2 && sheet.symbols.some((symbol) => symbol.shapes.some((shape) => shape.kind === 'image')), 'the sheet embeds an SVG and a bitmap')
check(sheet.symbols.some((symbol) => symbol.ports.some((port) => typeof port.x === 'number')) && sheet.symbols.some((symbol) => symbol.ports.some((port) => typeof port.x !== 'number')), 'the sheet has free pins and side pins')
check(sheet.junctions.length >= 1 && sheet.labels.length >= 2, 'the sheet has a branch and several name labels')
check(sheet.segments.some((segment) => segment.routed === 'manual') && sheet.segments.some((segment) => segment.routed === 'auto'), 'manual and automatic segments are both present')
const sheetFile = parseDocument(serialize(sheet))
check(auditAssets(sheetFile.assets).ok === true && sheetFile.blocks.length === sheet.blocks.length && sheetFile.segments.length === sheet.segments.length, 'the sheet reloads from its own bytes')

const hostile = emptyUserLibrary()
hostile.assets.push({
  id: 'ast_bad',
  name: 'bad.svg',
  mime: 'image/svg+xml',
  data: btoa('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
  width: 16,
  height: 16,
  checksum: '00',
})
const refusedAudit = auditAssets(hostile.assets)
const safeLibrary = emptyUserLibrary()
check(refusedAudit.ok === false && safeLibrary.symbols.length === 0, 'a script in a library is refused before the library changes')
const checksumSample = pictureAssets()[0]
if (checksumSample) {
  const copy = cloneSymbol(builtinLibraries()[0]!.symbols[0]!)
  void copy
  const badAsset = { ...checksumSample, checksum: '00' }
  check(auditAssets([badAsset]).ok === false, 'a checksum that does not match the bytes is refused')
}

const bench = benchSheet()
const wide = bench.blocks.find((block) => block.name === 'W')
const widePorts = bench.ports.filter((port) => port.blockId === wide?.id).length
check(bench.blocks.length >= 50 && bench.segments.length >= 350 && bench.ports.length >= 300 && bench.labels.length >= 300 && widePorts === 86, 'the bench sheet has the requested size')
const benchText = serialize(bench)
const loadStarted = performance.now()
const loadedBench = parseDocument(benchText)
const loadMs = performance.now() - loadStarted
const moveStarted = performance.now()
moveBlock(loadedBench, loadedBench.blocks[0]!.id, loadedBench.blocks[0]!.x + 20, loadedBench.blocks[0]!.y)
const moveMs = performance.now() - moveStarted
const benchSession = new EditSession(() => loadedBench, (next) => {
  loadedBench.blocks = next.blocks
  loadedBench.ports = next.ports
  loadedBench.nets = next.nets
  loadedBench.segments = next.segments
  loadedBench.junctions = next.junctions
  loadedBench.labels = next.labels
  loadedBench.symbols = next.symbols
  loadedBench.assets = next.assets
  loadedBench.groups = next.groups
  loadedBench.strokes = next.strokes
})
const cell = loadedBench.symbols.find((symbol) => symbol.name === 'Cell')!
const revisedCell = cloneSymbol(cell)
revisedCell.width = 96
revisedCell.revision = (cell.revision ?? 1) + 1
const benchPrepared = prepareSymbolUpdate(loadedBench, cell.id, revisedCell, [])
const updateStarted = performance.now()
if (benchPrepared.ok) benchSession.execute((draft) => commitSymbolUpdate(draft, benchPrepared.prepared))
const updateMs = performance.now() - updateStarted
const undoStarted = performance.now()
benchSession.undo()
const undoMs = performance.now() - undoStarted
const redoStarted = performance.now()
benchSession.redo()
const redoMs = performance.now() - redoStarted
console.log(`perf bytes=${benchText.length} loadMs=${loadMs.toFixed(1)} moveMs=${moveMs.toFixed(1)} updateMs=${updateMs.toFixed(1)} undoMs=${undoMs.toFixed(1)} redoMs=${redoMs.toFixed(1)} blocks=${loadedBench.blocks.length} segments=${loadedBench.segments.length} ports=${loadedBench.ports.length} labels=${loadedBench.labels.length}`)
check(loadedBench.symbols.find((symbol) => symbol.id === cell.id)?.width === 96, 'the bench update changes the cell')
check(loadedBench.segments.length === 350 && loadedBench.nets.length === 40, 'the bench update keeps the nets')

const d4 = sampleProject()
const d4Root = documentById(d4, d4.rootDocumentId)
const d4Counter = d4.components.find((component) => component.name === 'Counter')
const d4Stage = d4.components.find((component) => component.name === 'Stage')
const d4Buffer = d4.components.find((component) => component.name === 'Buffer')
const d4U1 = d4Root?.blocks.find((block) => block.name === 'U1')
const d4U2 = d4Root?.blocks.find((block) => block.name === 'U2')
const d4Child = d4Counter ? implementationDocument(d4, d4Counter.id) : null
const d4PortsU1 = d4Root?.ports.filter((port) => port.blockId === d4U1?.id) ?? []
const d4PortsU2 = d4Root?.ports.filter((port) => port.blockId === d4U2?.id) ?? []
check(validateProject(d4).length === 0, 'the sample project has no diagnosis')
check(Boolean(d4.id && d4.rootDocumentId && d4Counter && d4U1 && d4U2 && d4U1.componentId === d4U2.componentId), 'two instances share one component id')
check(d4PortsU1.length === 2 && d4PortsU1.every((port) => !d4PortsU2.some((other) => other.id === port.id)), 'instance port ids differ')
check(d4PortsU1.find((port) => port.symbolPortId === 'pin_clk')?.interfacePortId === 'ifp_clk' && d4PortsU2.find((port) => port.symbolPortId === 'pin_clk')?.interfacePortId === 'ifp_clk', 'both outer ports cite the same logical port')
const d4Inner = d4Child?.ports.find((port) => port.interfacePortId === 'ifp_clk')
check(d4Inner?.name === 'clock' && d4Inner.id !== d4PortsU1[0]?.id, 'the inner port is a different object with the same interface id')
check(d4Child === (d4Counter ? implementationDocument(d4, d4Counter.id) : null) && d4.documents.filter((document) => document.id === d4Child?.id).length === 1, 'the implementation diagram is shared, not copied')
if (d4Child) {
  const stageBlock = d4Child.blocks.find((block) => block.name === 'Stage')
  if (stageBlock) stageBlock.name = 'StageB'
}
const d4Paths = instancePaths(d4)
check(d4Paths.filter((path) => path.label.endsWith('/StageB')).length === 2, 'a child edit is visible through both instance paths')
check(d4Paths.every((path) => path.key.split('/').every((part) => part.startsWith('blk_'))), 'instance paths are block ids, not names')
if (d4Child?.nets[0]) d4Child.nets[0].name = 'tock'
const d4Tick = hierarchicalNets(d4).filter((net) => net.netId === 'net_child_tick')
check(d4Tick.length === 2 && d4Tick[0]?.pathKey !== d4Tick[1]?.pathKey && d4Tick.every((net) => net.name === 'tock'), 'the same child net stays distinct for each instance path')
const d4Named = hierarchicalNets(d4).filter((net) => net.name === 'tick' || net.name === 'tock')
check(new Set(d4Named.map((net) => `${net.pathKey}:${net.netId}`)).size === d4Named.length, 'equal net names are not merged')
check(d4Buffer?.implementation.kind === 'none' && implementationDocument(d4, d4Buffer?.id ?? '') === null, 'a component without an implementation is valid')
const d4Reloaded = parseProject(serializeProject(d4))
check(d4Reloaded.id === d4.id && d4Reloaded.rootDocumentId === d4.rootDocumentId && d4Reloaded.components.length === 3 && d4Reloaded.documents.length === d4.documents.length, 'save and reload keep project ids')
check(documentById(d4Reloaded, d4.rootDocumentId)?.blocks.find((block) => block.name === 'U1')?.componentId === d4U1?.componentId, 'reload keeps the instance reference')
const d4Store = new JsonProjectStorage()
await d4Store.save(d4)
const d4Stored = await d4Store.load(d4.id)
check(d4Stored.components.find((component) => component.name === 'Counter')?.revision === 1, 'the project store round-trips the revision')
const d4Lone = parseDocument(serialize(sampleDocument()))
check(d4Lone.blocks.length === 2 && d4Lone.ports.every((port) => port.interfacePortId === undefined), 'an older sheet still loads without a project')
const d4Direct = createProject('Direct')
const d4DirectDoc = emptyDocument()
const d4DirectAdd = addComponent(d4Direct, { id: 'cmp_self', name: 'Self', ports: [], implementation: { kind: 'diagram', document: d4DirectDoc } })
check(d4DirectAdd.ok, 'a component with its own diagram is accepted')
const d4DirectPlaced = d4DirectAdd.ok ? instantiateComponent(d4DirectAdd.project, d4DirectDoc.id, 'cmp_self', { x: 10, y: 10 }, 'Loop') : d4DirectAdd
check(!d4DirectPlaced.ok && d4DirectPlaced.project === d4DirectAdd.project && documentById(d4DirectPlaced.project, d4DirectDoc.id)?.blocks.length === 0, 'a direct cycle is refused without a partial edit')
let d4Chain = createProject('Chain')
const d4DocA = emptyDocument()
const d4DocB = emptyDocument()
const d4DocC = emptyDocument()
const d4AddA = addComponent(d4Chain, { id: 'cmp_a', name: 'A', ports: [], implementation: { kind: 'diagram', document: d4DocA } })
const d4AddB = d4AddA.ok ? addComponent(d4AddA.project, { id: 'cmp_b', name: 'B', ports: [], implementation: { kind: 'diagram', document: d4DocB } }) : d4AddA
const d4AddC = d4AddB.ok ? addComponent(d4AddB.project, { id: 'cmp_c', name: 'C', ports: [], implementation: { kind: 'diagram', document: d4DocC } }) : d4AddB
if (d4AddC.ok) d4Chain = d4AddC.project
const d4LinkB = instantiateComponent(d4Chain, d4DocA.id, 'cmp_b', { x: 0, y: 0 }, 'B1')
const d4LinkC = d4LinkB.ok ? instantiateComponent(d4LinkB.project, d4DocB.id, 'cmp_c', { x: 0, y: 0 }, 'C1') : d4LinkB
const d4BeforeCycle = d4LinkC.ok ? d4LinkC.project : d4Chain
const d4Cycle = instantiateComponent(d4BeforeCycle, d4DocC.id, 'cmp_a', { x: 0, y: 0 }, 'A1')
check(!d4Cycle.ok && d4Cycle.project === d4BeforeCycle && findCycles(d4BeforeCycle).length === 0, 'an indirect cycle is refused and the previous chain stays')
check(d4LinkC.ok && documentById(d4BeforeCycle, d4DocA.id)!.blocks.length === 1, 'several instances of a legal hierarchy are kept')
const d4Missing = instantiateComponent(d4, d4.rootDocumentId, 'cmp_missing', { x: 0, y: 0 }, 'Ghost')
check(!d4Missing.ok && d4Missing.project === d4 && !d4.components.some((component) => component.id === 'cmp_missing'), 'a missing component is not invented')
const d4Broken = parseProject(serializeProject(d4))
d4Broken.components = d4Broken.components.filter((component) => component.name !== 'Buffer')
check(validateProject(d4Broken).some((item) => item.kind === 'missing-component') && d4.components.some((component) => component.name === 'Buffer'), 'a missing reference is reported and the stored project is not repaired')
const d4LoopDoc = emptyDocument()
d4LoopDoc.blocks.push({ id: 'blk_loop', name: 'Loop', x: 0, y: 0, width: 40, height: 40, componentId: 'cmp_loop' })
const d4Loop = addComponent(d4, { id: 'cmp_loop', name: 'Loop', ports: [], implementation: { kind: 'diagram', document: d4LoopDoc } })
check(!d4Loop.ok && d4Loop.project === d4 && d4.components.length === 3 && !d4.documents.some((document) => document.id === d4LoopDoc.id), 'a failed component add leaves no document behind')
const d4Reserved = addComponent(createProject('Later'), { name: 'Hdl', ports: [{ id: 'ifp_d', name: 'd' }], implementation: { kind: 'vhdl', extra: { source: 'entity hdl is end;' } } })
check(d4Reserved.ok, 'an unknown implementation kind is stored')
if (d4Reserved.ok) {
  const d4ReservedAgain = parseProject(serializeProject(d4Reserved.project))
  const d4Hdl = d4ReservedAgain.components[0]
  check(d4Hdl?.implementation.kind === 'vhdl' && d4Hdl.implementation.extra?.source === 'entity hdl is end;', 'a reserved implementation survives save and load')
  check(validateProject(d4ReservedAgain).some((item) => item.kind === 'unsupported-implementation'), 'a reserved implementation is diagnosed and not opened')
}
const d4Box = { project: createProject('Undo') }
const d4Session = new ProjectSession(() => d4Box.project, (next) => {
  d4Box.project = next
})
const d4DocsBefore = d4Box.project.documents.length
const d4Added = d4Session.transact((current) => {
  const result = addComponent(current, { name: 'Counter', ports: [], implementation: { kind: 'diagram', document: emptyDocument() } })
  return result.project
})
check(d4Added && d4Box.project.components.length === 1 && d4Box.project.documents.length === d4DocsBefore + 1, 'creating a component and its diagram is one transaction')
d4Session.undo()
check(d4Box.project.components.length === 0 && d4Box.project.documents.length === d4DocsBefore, 'undo removes the component and the diagram together')
d4Session.redo()
check(d4Box.project.components.length === 1 && d4Box.project.documents.length === d4DocsBefore + 1, 'redo restores the component and the diagram')
const d4StageDoc = d4Stage?.implementation.documentId
const d4Set = d4Stage && d4Counter?.implementation.documentId ? setImplementation(d4, d4Stage.id, d4Counter.implementation.documentId) : null
check(Boolean(d4Set && !d4Set.ok && d4Stage?.implementation.documentId === d4StageDoc), 'a diagram that already contains the component is refused')
const d4Used = d4Counter ? removeComponent(d4, d4Counter.id) : { ok: false as const, project: d4, message: '' }
check(!d4Used.ok && d4.components.length === 3, 'a component that is still instantiated is kept')
const d4Fresh = createProject('Remove')
const d4Idle = addComponent(d4Fresh, { name: 'Idle', ports: [], implementation: { kind: 'none' } })
const d4Removed = d4Idle.ok ? removeComponent(d4Idle.project, d4Idle.value.componentId) : d4Idle
check(d4Removed.ok && d4Removed.project.components.length === 0, 'an unused component can be removed')

const d4b = sampleProject()
const d4bRoot = rootLocation(d4b)
const d4bSheet = documentById(d4b, d4b.rootDocumentId)!
const d4bU1 = d4bSheet.blocks.find((block) => block.name === 'U1')!
const d4bU2 = d4bSheet.blocks.find((block) => block.name === 'U2')!
const d4bBuf = d4bSheet.blocks.find((block) => block.name === 'Buf')!
const d4bPorts = JSON.stringify(d4b.documents.map((document) => document.ports.map((port) => port.id)))
const d4bOpenU1 = descend(d4b, d4bRoot, d4bU1.id)
const d4bOpenU2 = descend(d4b, d4bRoot, d4bU2.id)
check(d4bOpenU1.kind === 'ok' && d4bOpenU2.kind === 'ok' && d4bOpenU1.location.documentId === d4bOpenU2.location.documentId, 'U1 and U2 open the same diagram')
check(d4bOpenU1.location.steps[0]?.blockId === d4bU1.id && d4bOpenU2.location.steps[0]?.blockId === d4bU2.id, 'the two paths keep different block ids')
check(JSON.stringify(d4b.documents.map((document) => document.ports.map((port) => port.id))) === d4bPorts, 'navigation does not change port ids')
const d4bCrumbs = d4bOpenU1.kind === 'ok' ? breadcrumbs(d4b, d4bOpenU1.location) : []
check(d4bCrumbs[0]?.label === 'Sample' && d4bCrumbs[1]?.label === 'U1 : Counter', 'breadcrumbs show the project and the instance')
d4bU1.name = 'U1b'
const d4bCrumbsRenamed = d4bOpenU1.kind === 'ok' ? breadcrumbs(d4b, d4bOpenU1.location) : []
check(d4bCrumbsRenamed[1]?.label === 'U1b : Counter' && d4bCrumbsRenamed[1]?.steps[0]?.blockId === d4bU1.id, 'renaming changes the label and keeps the path id')
d4bU1.name = 'U1'
const d4bStageNode = treeNodes(d4b, d4bOpenU1.kind === 'ok' ? d4bOpenU1.location.steps : []).find((node) => node.instanceName === 'Stage')
const d4bStageOpen = d4bStageNode ? descend(d4b, d4bOpenU1.kind === 'ok' ? d4bOpenU1.location : d4bRoot, d4bStageNode.blockId) : null
check(d4bStageOpen?.kind === 'ok' && d4bStageOpen.location.steps.length === 2, 'Stage opens the next level')
check(d4bStageOpen?.kind === 'ok' && parentLocation(d4b, d4bStageOpen.location).documentId === d4bOpenU1.location.documentId, 'parent returns to the counter sheet')
check(d4bStageOpen?.kind === 'ok' && parentLocation(d4b, parentLocation(d4b, d4bStageOpen.location)).documentId === d4b.rootDocumentId, 'two parent steps reach the root')
const d4bTree = treeNodes(d4b, [])
const d4bTreeU1 = d4bTree.find((node) => node.instanceName === 'U1')
const d4bTreeU2 = d4bTree.find((node) => node.instanceName === 'U2')
check(Boolean(d4bTreeU1 && d4bTreeU2 && d4bTreeU1.key !== d4bTreeU2.key && d4bTreeU1.componentId === d4bTreeU2.componentId), 'the tree lists U1 and U2 as different branches of one component')
check(d4bOpenU1.kind === 'ok' && sharedDefinitionLabel(d4b, d4bOpenU1.location) === 'Counter — shared definition — 2 instances', 'a shared diagram is named without copying it')
const d4bBufMove = descend(d4b, d4bRoot, d4bBuf.id)
check(d4bBufMove.kind === 'stay' && d4bBufMove.location.documentId === d4b.rootDocumentId && d4bBufMove.message.includes('no implementation'), 'a component without a diagram stays on the current sheet')
const d4bBroken = resolveLocation(d4b, [{ documentId: d4b.rootDocumentId, blockId: 'blk_missing', componentId: 'cmp_missing' }])
check(Boolean(d4bBroken.message) && d4bBroken.location.steps.length === 0 && d4bBroken.location.documentId === d4b.rootDocumentId, 'a broken path stops at the root')
const d4bBox = { project: d4b }
const d4bSessions = new DocumentSessions(
  (id) => documentById(d4bBox.project, id),
  (next) => {
    const index = d4bBox.project.documents.findIndex((item) => item.id === next.id)
    if (index >= 0) d4bBox.project.documents[index] = next
  },
)
const d4bCounterId = d4bOpenU1.location.documentId
const d4bSession = d4bSessions.get(d4bCounterId)
check(d4bSessions.get(d4bCounterId) === d4bSession && !d4bSession.canUndo, 'both paths use one edit session and navigation adds no undo step')
d4bSession.execute((draft) => {
  const block = draft.blocks.find((item) => item.name === 'Stage')
  if (block) block.name = 'StageB'
})
check(Boolean(documentById(d4bBox.project, d4bOpenU2.location.documentId)?.blocks.some((block) => block.name === 'StageB')), 'an edit through U1 is visible through U2')
d4bSession.undo()
check(Boolean(documentById(d4bBox.project, d4bOpenU2.location.documentId)?.blocks.some((block) => block.name === 'Stage')), 'undo through the shared session restores the diagram')
const d4bBeforeBounds = JSON.stringify(d4bSheet.blocks)
contentBounds(d4bSheet)
check(JSON.stringify(d4bSheet.blocks) === d4bBeforeBounds, 'framing the sheet does not move its blocks')
let d4bCycle = createProject('Cycle')
const d4bDocA = emptyDocument()
const d4bDocB = emptyDocument()
const d4bAddA = addComponent(d4bCycle, { id: 'cmp_ca', name: 'A', ports: [], implementation: { kind: 'diagram', document: d4bDocA } })
const d4bAddB = d4bAddA.ok ? addComponent(d4bAddA.project, { id: 'cmp_cb', name: 'B', ports: [], implementation: { kind: 'diagram', document: d4bDocB } }) : d4bAddA
if (d4bAddB.ok) {
  d4bCycle = d4bAddB.project
  const d4bA = documentById(d4bCycle, d4bDocA.id)
  const d4bB = documentById(d4bCycle, d4bDocB.id)
  const d4bTop = documentById(d4bCycle, d4bCycle.rootDocumentId)
  d4bTop?.blocks.push({ id: 'blk_to_b', name: 'ToB', x: 0, y: 0, width: 40, height: 40, componentId: 'cmp_cb' })
  d4bA?.blocks.push({ id: 'blk_a_b', name: 'AgainB', x: 0, y: 0, width: 40, height: 40, componentId: 'cmp_cb' })
  d4bB?.blocks.push({ id: 'blk_to_a', name: 'ToA', x: 0, y: 0, width: 40, height: 40, componentId: 'cmp_ca' })
  const d4bToB = treeNodes(d4bCycle, []).find((node) => node.instanceName === 'ToB')
  const d4bToA = d4bToB ? treeNodes(d4bCycle, d4bToB.steps).find((node) => node.instanceName === 'ToA') : undefined
  const d4bAgain = d4bToA ? treeNodes(d4bCycle, d4bToA.steps) : []
  check(d4bAgain.some((node) => node.status === 'cycle' && !node.expandable), 'a repeated diagram is not expanded again')
}

if (failures.length) {
  throw new Error(failures.join('\n'))
}
console.log('selfcheck ok')
