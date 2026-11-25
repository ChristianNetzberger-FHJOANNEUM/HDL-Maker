import { createId, parseDocument, serialize } from './document'
import { autoRoute, fitSymbolShapes, labelPlacement, moveBlock, pinLocal, pinOnBorder, polylineLength, portAnchor, simplifyOrthogonal } from './geometry'
import { netFixture } from './fixture'
import { addNameLabel, commitWire, crossings, deleteSegment, labelText, mergeNets, moveLabelAlong, netPortIds, placeSpan, probeWire, renameNet, setRouted } from './nets'
import { wireClick } from './wiretool'
import { symbolSheet } from './symbolsheet'
import { addImageAsset, addSymbolLabel, addSymbolPort, addSymbolShape, applySymbol, defineSymbol, instantiateSymbol, moveFreeSymbolPort, moveSymbolPort, removeSymbolPort, setComponent, setSymbolSize, symbolDiagnostics } from './symbols'
import { auditAssets, base64ToBytes, inspectImage, sha256, sha256Sync } from './assets'
import { PICTURE_SOURCES, pictureAssets } from './pictures'
import { builtinLibraries } from './catalog'
import { cloneSymbol, emptyUserLibrary, mergeLibrary, parseLibrary, placeLibrarySymbol, publishSymbolRevision, removeLibrarySymbol, saveSymbolToLibrary, serializeLibrary } from './library'
import { emptyDocument, groupBlocks, duplicateGroup, duplicateBlocks, deleteBlocks, placeTemplate, BLOCK_TEMPLATES, linkPorts, captureFragment, pasteFragment, resizeBox, setBlockFields, addPortAt, borderPlacement, nearestBlockBorder, placePort, removeUnwiredPort, renameInstancePort, unusedPortName } from './edit'
import { addPort } from './commands'
import { EditSession } from './session'
import { JsonRecordStorage } from './storage'
import { isOrthogonal, orthogonalize } from './orthogonalize'
import { sampleDocument } from './sample'
import { addComponent, componentById, createProject, documentById, findCycles, hierarchicalNets, implementationDocument, instancePaths, instancesOf, instantiateComponent, removeComponent, setImplementation, validateProject } from './component'
import { duplicateComponent, expandComponent, extractComponent, makeUnique, previewExpand, previewExtract, renameComponent } from './hierarchy'
import { addBoundPin, addInterfacePort, bindInterfacePort, classifyPortDelete, createImplementation, interfaceDiagnostics, logicalPortName, openAsDiagram, removeInterfacePort, renameInterfacePort } from './interface'
import { breadcrumbs, contentBounds, descend, DocumentSessions, parentLocation, resolveLocation, rootLocation, sharedDefinitionLabel, treeNodes } from './navigate'
import { JsonProjectStorage, parseProject, ProjectSession, sampleProject, serializeProject } from './project'
import { compareSymbols } from './compare'
import { acceptanceSheet, benchSheet } from './acceptance'
import { commitSymbolUpdate, detachInstance, dropPortWires, prepareSymbolUpdate, rebindPort } from './migration'
import { digitalProject, generalProject, signalProject } from './references'

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

let d4c = createProject('Design')
const d4cSource = addComponent(d4c, { name: 'SignalSource', ports: [], implementation: { kind: 'none' } })
const d4cProc = d4cSource.ok ? addComponent(d4cSource.project, { name: 'Processing', ports: [], implementation: { kind: 'none' } }) : d4cSource
const d4cOut = d4cProc.ok ? addComponent(d4cProc.project, { name: 'Output', ports: [], implementation: { kind: 'none' } }) : d4cProc
check(d4cOut.ok && d4cOut.project.components.every((item) => item.implementation.kind === 'none'), 'a new component has no implementation')
if (d4cSource.ok && d4cProc.ok && d4cOut.ok) {
  d4c = d4cOut.project
  const d4cRoot = d4c.rootDocumentId
  const d4cProcId = d4cProc.value.componentId
  const d4cPlaceS = instantiateComponent(d4c, d4cRoot, d4cSource.value.componentId, { x: 80, y: 80 }, 'SignalSource')
  const d4cPlaceP = d4cPlaceS.ok ? instantiateComponent(d4cPlaceS.project, d4cRoot, d4cProcId, { x: 300, y: 80 }, 'Processing') : d4cPlaceS
  const d4cPlaceO = d4cPlaceP.ok ? instantiateComponent(d4cPlaceP.project, d4cRoot, d4cOut.value.componentId, { x: 520, y: 80 }, 'Output') : d4cPlaceP
  check(d4cPlaceO.ok === true, 'abstract components can be placed on the empty root')
  if (d4cPlaceO.ok) {
    d4c = d4cPlaceO.project
    const d4cIn1 = addInterfacePort(d4c, d4cProcId, 'in1', 'left')
    const d4cIn2 = d4cIn1.ok ? addInterfacePort(d4cIn1.project, d4cProcId, 'in2', 'left') : d4cIn1
    const d4cOutPort = d4cIn2.ok ? addInterfacePort(d4cIn2.project, d4cProcId, 'out', 'right') : d4cIn2
    check(d4cOutPort.ok === true, 'Processing gains two inputs and one output in one definition')
    if (d4cOutPort.ok && d4cIn1.ok) {
      d4c = d4cOutPort.project
      const d4cSheet = documentById(d4c, d4cRoot)
      const d4cBlock = d4cSheet?.blocks.find((block) => block.name === 'Processing')
      const d4cPorts = d4cSheet?.ports.filter((port) => port.blockId === d4cBlock?.id) ?? []
      const d4cBeforeIds = d4cPorts.map((port) => port.id).join('|')
      const d4cIn1Port = d4cPorts.find((port) => port.interfacePortId === d4cIn1.value.interfacePortId)
      const d4cSrc = d4cSheet?.blocks.find((block) => block.name === 'SignalSource')
      const d4cSrcPort = addInterfacePort(d4c, d4cSource.value.componentId, 'y', 'right')
      if (d4cSrcPort.ok && d4cSheet && d4cIn1Port && d4cSrc) {
        d4c = d4cSrcPort.project
        const d4cLive = documentById(d4c, d4cRoot)
        const d4cY = d4cLive?.ports.find((port) => port.interfacePortId === d4cSrcPort.value.interfacePortId)
        const d4cKept = d4cLive?.ports.find((port) => port.id === d4cIn1Port.id)
        if (d4cLive && d4cY && d4cKept) {
          d4cLive.nets.push({ id: 'net_d4c', name: 'link' })
          d4cLive.segments.push({
            id: 'seg_d4c',
            netId: 'net_d4c',
            points: [{ x: d4cY.t ?? 0, y: 0 }, { x: 10, y: 0 }],
            start: { kind: 'port', portId: d4cY.id },
            end: { kind: 'port', portId: d4cKept.id },
            routed: 'manual',
          })
          const d4cRenamed = renameInterfacePort(d4c, d4cProcId, d4cIn1.value.interfacePortId, 'data')
          const d4cRenamedDoc = d4cRenamed.ok ? documentById(d4cRenamed.project, d4cRoot) : null
          const d4cRenamedPort = d4cRenamedDoc?.ports.find((port) => port.id === d4cIn1Port.id)
          check(Boolean(d4cRenamed.ok && d4cRenamedPort?.name === 'data' && d4cRenamedPort.interfacePortId === d4cIn1.value.interfacePortId), 'renaming a logical port keeps the port id')
          check(Boolean(d4cRenamedDoc?.nets.some((net) => net.id === 'net_d4c') && d4cRenamedDoc?.segments.some((segment) => segment.id === 'seg_d4c' && segment.end.kind === 'port' && segment.end.portId === d4cIn1Port.id)), 'renaming does not retarget the wire')
          if (d4cRenamed.ok) {
            d4c = d4cRenamed.project
            const d4cRefused = removeInterfacePort(d4c, d4cProcId, d4cIn1.value.interfacePortId)
            const d4cRefusedDoc = documentById(d4c, d4cRoot)
            check(
              Boolean(
                !d4cRefused.ok &&
                  d4cRefused.project === d4c &&
                  d4cRefusedDoc?.ports.some((port) => port.id === d4cIn1Port.id) &&
                  d4cRefusedDoc?.segments.some((segment) => segment.id === 'seg_d4c') &&
                  componentById(d4c, d4cProcId)?.ports.some((port) => port.id === d4cIn1.value.interfacePortId),
              ),
              'a wired logical port is refused, and the project is unchanged',
            )
            check(!interfaceDiagnostics(d4c, d4cProcId).some((note) => note.kind === 'wired-removed'), 'refusing a wired port does not leave an orphan')
            const d4cMade = createImplementation(d4c, d4cProcId)
            check(d4cMade.ok === true, 'Create implementation adds one empty child diagram')
            if (d4cMade.ok) {
              const d4cChild = documentById(d4cMade.project, d4cMade.value.documentId)
              const d4cBoundary = d4cChild?.ports.filter((port) => port.interfacePortId) ?? []
              check(d4cBoundary.length === 3 && d4cBoundary.every((port) => port.id !== d4cIn1Port.id), 'the child sheet gets its own connectors')
              const d4cAgain = createImplementation(d4cMade.project, d4cProcId)
              check(!d4cAgain.ok && d4cAgain.project === d4cMade.project, 'a second implementation is refused and changes nothing')
              const d4cStay = descend(d4c, rootLocation(d4c), d4cBlock?.id ?? '')
              check(d4cStay.kind === 'stay', 'double-click still does not invent a diagram before Create implementation')
              const d4cOpen = descend(d4cMade.project, rootLocation(d4cMade.project), d4cBlock?.id ?? '')
              check(d4cOpen.kind === 'ok' && d4cOpen.location.documentId === d4cMade.value.documentId, 'after Create implementation the existing navigation opens that diagram')
              const d4cFilter = addComponent(d4cMade.project, { name: 'Filter', ports: [], implementation: { kind: 'none' } })
              const d4cGain = d4cFilter.ok ? addComponent(d4cFilter.project, { name: 'Gain', ports: [], implementation: { kind: 'none' } }) : d4cFilter
              const d4cReg = d4cGain.ok ? addComponent(d4cGain.project, { name: 'Register', ports: [], implementation: { kind: 'none' } }) : d4cGain
              const d4cInner = d4cReg.ok && d4cFilter.ok && d4cGain.ok
                ? instantiateComponent(d4cReg.project, d4cMade.value.documentId, d4cFilter.value.componentId, { x: 80, y: 40 }, 'Filter')
                : null
              const d4cInner2 = d4cInner?.ok && d4cGain.ok ? instantiateComponent(d4cInner.project, d4cMade.value.documentId, d4cGain.value.componentId, { x: 80, y: 140 }, 'Gain') : d4cInner
              const d4cInner3 = d4cInner2?.ok && d4cReg.ok ? instantiateComponent(d4cInner2.project, d4cMade.value.documentId, d4cReg.value.componentId, { x: 80, y: 240 }, 'Register') : d4cInner2
              const d4cInside = d4cInner3?.ok ? documentById(d4cInner3.project, d4cMade.value.documentId) : null
              check(Boolean(d4cInside && ['Filter', 'Gain', 'Register'].every((name) => d4cInside.blocks.some((block) => block.name === name))), 'the implementation contains Filter, Gain, and Register')
              if (d4cInner3?.ok) {
                const d4cSecond = instantiateComponent(d4cInner3.project, d4cRoot, d4cProcId, { x: 300, y: 240 }, 'Processing')
                if (d4cSecond.ok && d4cIn2.ok && d4cOutPort.ok) {
                  const d4cRootSheet = documentById(d4cSecond.project, d4cRoot)
                  const d4cBoth = d4cRootSheet?.blocks.filter((block) => block.componentId === d4cProcId) ?? []
                  const d4cLogical = new Set(componentById(d4cSecond.project, d4cProcId)?.ports.map((port) => port.id) ?? [])
                  const d4cIdsOf = (blockId: string) =>
                    (d4cRootSheet?.ports.filter((port) => port.blockId === blockId && port.interfacePortId && d4cLogical.has(port.interfacePortId)).map((port) => port.interfacePortId) ?? [])
                      .sort()
                      .join('|')
                  check(d4cBoth.length === 2 && d4cIdsOf(d4cBoth[0].id) === d4cIdsOf(d4cBoth[1].id), 'both Processing instances cite the same logical ports')
                  const d4cPortIds = (blockId: string) => d4cRootSheet?.ports.filter((port) => port.blockId === blockId).map((port) => port.id).join('|')
                  check(d4cPortIds(d4cBoth[0].id) !== d4cPortIds(d4cBoth[1].id), 'the two instances do not share port ids')
                  const d4cFlag = addInterfacePort(d4cSecond.project, d4cProcId, 'flag', 'right')
                  if (d4cFlag.ok) {
                    const d4cAfter = documentById(d4cFlag.project, d4cRoot)
                    const d4cFlags = d4cAfter?.ports.filter((port) => port.interfacePortId === d4cFlag.value.interfacePortId) ?? []
                    check(d4cFlags.length === 2 && d4cFlags[0].id !== d4cFlags[1].id, 'a new logical port appears on both instances with its own port ids')
                    check(d4cBeforeIds.split('|').every((id) => d4cAfter?.ports.some((port) => port.id === id) || id === d4cIn1Port.id), 'older unwired port ids are not rewritten')
                    const d4cSameName = defineSymbol(documentById(d4cFlag.project, d4cRoot)!, { name: 'Processing', width: 120, height: 80, ports: [{ id: 'pin_in2', name: 'in2', side: 'left', t: 0.5 }] })
                    const d4cDefined = componentById(d4cFlag.project, d4cProcId)
                    if (d4cDefined) d4cDefined.symbolId = d4cSameName
                    const d4cUnbound = documentById(d4cFlag.project, d4cRoot)?.ports.find((port) => port.interfacePortId === d4cIn2.value.interfacePortId)
                    check(d4cUnbound?.symbolPortId === undefined, 'a pin with the same name is not bound automatically')
                    const d4cBound = bindInterfacePort(d4cFlag.project, d4cProcId, d4cIn2.value.interfacePortId, 'pin_in2')
                    const d4cBoundPort = d4cBound.ok ? documentById(d4cBound.project, d4cRoot)?.ports.find((port) => port.id === d4cUnbound?.id) : null
                    check(Boolean(d4cBound.ok && d4cBoundPort?.symbolPortId === 'pin_in2' && d4cBoundPort.interfacePortId === d4cIn2.value.interfacePortId), 'binding uses the pin id and keeps the instance port')
                    const d4cBox = { project: d4cBound.ok ? d4cBound.project : d4cFlag.project }
                    const d4cSessions = new DocumentSessions(
                      (id) => documentById(d4cBox.project, id),
                      (next) => {
                        const index = d4cBox.project.documents.findIndex((item) => item.id === next.id)
                        if (index >= 0) d4cBox.project.documents[index] = next
                      },
                    )
                    const d4cSheetSession = d4cSessions.get(d4cRoot)
                    d4cSheetSession.execute((draft) => {
                      const block = draft.blocks.find((item) => item.id === d4cBoth[0].id)
                      if (block) block.name = 'Local'
                    })
                    const d4cProjectUndo = new ProjectSession(
                      () => d4cBox.project,
                      (next) => {
                        d4cBox.project = next
                      },
                    )
                    d4cProjectUndo.transact((current) => {
                      const result = addInterfacePort(current, d4cProcId, 'aux', 'left')
                      return result.ok ? result.project : current
                    })
                    d4cSessions.discard()
                    const d4cFresh = d4cSessions.get(d4cRoot)
                    check(Boolean(!d4cFresh.canUndo && documentById(d4cBox.project, d4cRoot)?.blocks.some((block) => block.name === 'Local')), 'a project command drops the sheet undo stack and keeps the earlier sheet edit')
                    check(Boolean(documentById(d4cBox.project, d4cRoot)?.ports.some((port) => port.name === 'aux')), 'the project command added the port')
                    d4cFresh.execute((draft) => {
                      const block = draft.blocks.find((item) => item.name === 'Local')
                      if (block) block.name = 'Later'
                    })
                    d4cProjectUndo.undo()
                    const d4cRestored = documentById(d4cBox.project, d4cRoot)
                    check(Boolean(d4cRestored?.blocks.some((block) => block.name === 'Local') && !d4cRestored?.ports.some((port) => port.name === 'aux')), 'project undo restores the snapshot and does not let a later sheet edit write back')
                    d4cProjectUndo.redo()
                    const d4cRedone = documentById(d4cBox.project, d4cRoot)
                    check(Boolean(d4cRedone?.blocks.some((block) => block.name === 'Later') && d4cRedone?.ports.some((port) => port.name === 'aux')), 'project redo returns every document to the state from just before the undo')
                    const d4cSaved = parseProject(serializeProject(d4cBox.project))
                    check(d4cSaved.components.some((item) => item.name === 'Processing' && item.implementation.kind === 'diagram') && d4cSaved.components.some((item) => item.name === 'Filter'), 'save and reload keep the hierarchy')
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

function d4dBlock(target: ReturnType<typeof emptyDocument>, name: string, x: number, y: number): string {
  const id = createId('blk')
  target.blocks.push({ id, name, x, y, width: 80, height: 40 })
  return id
}

function d4dPort(target: ReturnType<typeof emptyDocument>, blockId: string, name: string, side: 'left' | 'right' | 'top' | 'bottom'): string {
  const id = createId('prt')
  target.ports.push({ id, blockId, name, side, t: 0.5 })
  return id
}

function d4dPortsOnNet(target: ReturnType<typeof emptyDocument>, netId: string): string[] {
  const ids = new Set<string>()
  for (const segment of target.segments.filter((item) => item.netId === netId)) {
    if (segment.start.kind === 'port') ids.add(segment.start.portId)
    if (segment.end.kind === 'port') ids.add(segment.end.portId)
  }
  return [...ids].sort()
}

function d4dReachable(target: ReturnType<typeof emptyDocument>, portId: string): string[] {
  const ports = new Set<string>()
  const seenSegments = new Set<string>()
  const seenJunctions = new Set<string>()
  const pending: Array<{ kind: 'port'; id: string } | { kind: 'junction'; id: string }> = [{ kind: 'port', id: portId }]
  const seenPorts = new Set<string>([portId])
  while (pending.length > 0) {
    const item = pending.shift()
    if (!item) break
    if (item.kind === 'port') ports.add(item.id)
    for (const segment of target.segments) {
      if (seenSegments.has(segment.id)) continue
      const ends = [segment.start, segment.end]
      const hit = ends.some(
        (end) =>
          (item.kind === 'port' && end.kind === 'port' && end.portId === item.id) ||
          (item.kind === 'junction' && end.kind === 'junction' && end.junctionId === item.id),
      )
      if (!hit) continue
      seenSegments.add(segment.id)
      for (const end of ends) {
        if (end.kind === 'port' && !seenPorts.has(end.portId)) {
          seenPorts.add(end.portId)
          pending.push({ kind: 'port', id: end.portId })
        }
        if (end.kind === 'junction' && !seenJunctions.has(end.junctionId)) {
          seenJunctions.add(end.junctionId)
          pending.push({ kind: 'junction', id: end.junctionId })
        }
      }
    }
  }
  return [...ports].sort()
}

function d4dDangling(target: ReturnType<typeof emptyDocument>): boolean {
  const ports = new Set(target.ports.map((port) => port.id))
  const junctions = new Set(target.junctions.map((junction) => junction.id))
  return target.segments.some((segment) =>
    [segment.start, segment.end].some(
      (end) => (end.kind === 'port' && !ports.has(end.portId)) || (end.kind === 'junction' && !junctions.has(end.junctionId)),
    ),
  )
}

const d4dProject = createProject('Flat')
const d4dSheet = documentById(d4dProject, d4dProject.rootDocumentId)!
const d4dSrc = d4dBlock(d4dSheet, 'Src', 40, 80)
const d4dA = d4dBlock(d4dSheet, 'A', 240, 40)
const d4dB = d4dBlock(d4dSheet, 'B', 460, 40)
const d4dC = d4dBlock(d4dSheet, 'C', 240, 220)
const d4dD = d4dBlock(d4dSheet, 'D', 460, 220)
const d4dE = d4dBlock(d4dSheet, 'E', 240, 400)
const d4dSink = d4dBlock(d4dSheet, 'Sink', 680, 80)
const d4dSrcY = d4dPort(d4dSheet, d4dSrc, 'y', 'right')
const d4dSrcQ = d4dPort(d4dSheet, d4dSrc, 'q', 'right')
const d4dAIn = d4dPort(d4dSheet, d4dA, 'in', 'left')
const d4dAO = d4dPort(d4dSheet, d4dA, 'o', 'right')
const d4dAT = d4dPort(d4dSheet, d4dA, 't', 'bottom')
const d4dBI = d4dPort(d4dSheet, d4dB, 'i', 'left')
const d4dBO = d4dPort(d4dSheet, d4dB, 'o', 'right')
const d4dBX = d4dPort(d4dSheet, d4dB, 'x', 'bottom')
const d4dCI = d4dPort(d4dSheet, d4dC, 'i', 'left')
const d4dCO = d4dPort(d4dSheet, d4dC, 'o', 'right')
const d4dDI = d4dPort(d4dSheet, d4dD, 'i', 'left')
const d4dDO = d4dPort(d4dSheet, d4dD, 'o', 'right')
const d4dDX = d4dPort(d4dSheet, d4dD, 'x', 'bottom')
const d4dEP = d4dPort(d4dSheet, d4dE, 'p', 'left')
const d4dEB = d4dPort(d4dSheet, d4dE, 'b', 'right')
const d4dSinkI = d4dPort(d4dSheet, d4dSink, 'i', 'left')
const d4dSinkB = d4dPort(d4dSheet, d4dSink, 'b', 'left')
const d4dClk = linkPorts(d4dSheet, d4dSrcY, d4dAIn, 'clk')
const d4dClkNet = d4dSheet.segments.find((segment) => segment.id === d4dClk)?.netId ?? ''
const d4dBus = (() => {
  const netId = createId('net')
  const junctionId = createId('jnc')
  const anchors = [d4dAO, d4dBI, d4dCI].map((id) => portAnchor(d4dSheet, id)!)
  const x = anchors.reduce((sum, point) => sum + point.x, 0) / anchors.length
  const y = anchors.reduce((sum, point) => sum + point.y, 0) / anchors.length
  d4dSheet.nets.push({ id: netId, name: 'bus' })
  d4dSheet.junctions.push({ id: junctionId, netId, x, y })
  for (const portId of [d4dAO, d4dBI, d4dCI]) {
    const at = portAnchor(d4dSheet, portId)!
    d4dSheet.segments.push({ id: createId('seg'), netId, routed: 'manual', points: [{ x, y }, at], start: { kind: 'junction', junctionId }, end: { kind: 'port', portId } })
  }
  return { netId, junctionId }
})()
const d4dMid = linkPorts(d4dSheet, d4dBO, d4dDI, 'mid')
const d4dY = (() => {
  const netId = createId('net')
  const junctionId = createId('jnc')
  const anchors = [d4dDO, d4dCO, d4dSinkI].map((id) => portAnchor(d4dSheet, id)!)
  const x = anchors.reduce((sum, point) => sum + point.x, 0) / anchors.length
  const y = anchors.reduce((sum, point) => sum + point.y, 0) / anchors.length
  d4dSheet.nets.push({ id: netId, name: 'y' })
  d4dSheet.junctions.push({ id: junctionId, netId, x, y })
  for (const portId of [d4dDO, d4dCO, d4dSinkI]) {
    const at = portAnchor(d4dSheet, portId)!
    const segmentId = createId('seg')
    d4dSheet.segments.push({ id: segmentId, netId, routed: 'manual', points: [{ x, y }, at], start: { kind: 'junction', junctionId }, end: { kind: 'port', portId } })
  }
  return { netId, junctionId }
})()
const d4dTap = (() => {
  const netId = createId('net')
  const junctionId = createId('jnc')
  const anchors = [d4dAT, d4dSrcQ, d4dEP].map((id) => portAnchor(d4dSheet, id)!)
  const x = anchors.reduce((sum, point) => sum + point.x, 0) / anchors.length
  const y = anchors.reduce((sum, point) => sum + point.y, 0) / anchors.length
  d4dSheet.nets.push({ id: netId, name: 'tap' })
  d4dSheet.junctions.push({ id: junctionId, netId, x, y })
  for (const portId of [d4dAT, d4dSrcQ, d4dEP]) {
    const at = portAnchor(d4dSheet, portId)!
    d4dSheet.segments.push({ id: createId('seg'), netId, routed: 'manual', points: [{ x, y }, at], start: { kind: 'junction', junctionId }, end: { kind: 'port', portId } })
  }
  return { netId, junctionId }
})()
const d4dN1 = linkPorts(d4dSheet, d4dBX, d4dSinkB, 'n')
const d4dN1Net = d4dSheet.segments.find((segment) => segment.id === d4dN1)?.netId ?? ''
const d4dN2 = linkPorts(d4dSheet, d4dDX, d4dEB, 'n')
const d4dN2Net = d4dSheet.segments.find((segment) => segment.id === d4dN2)?.netId ?? ''
groupBlocks(d4dSheet, [d4dA, d4dB])
const d4dChosen = [d4dA, d4dB, d4dC, d4dD]
const d4dPreview = previewExtract(d4dProject, d4dSheet.id, d4dChosen)
check(d4dPreview.ok && d4dPreview.ports.some((port) => port.name === 'clk') && d4dPreview.internalNetIds.includes(d4dBus.netId), 'extract preview names the crossing port and the internal net')
check(d4dPreview.ok && d4dPreview.notes.some((note) => note.includes('stay separate')), 'extract preview keeps same-named nets apart')
const d4dOne = extractComponent(d4dProject, d4dSheet.id, [d4dA], 'Only')
check(!d4dOne.ok && d4dOne.project === d4dProject && d4dSheet.blocks.length === 7, 'extract of one block is refused and writes nothing')
const d4dAmbiguous = createProject('Ambiguous')
const d4dAmbiguousSheet = documentById(d4dAmbiguous, d4dAmbiguous.rootDocumentId)!
const d4dAmbiguousA = d4dBlock(d4dAmbiguousSheet, 'A', 40, 40)
const d4dAmbiguousC = d4dBlock(d4dAmbiguousSheet, 'C', 200, 40)
const d4dAmbiguousB = d4dBlock(d4dAmbiguousSheet, 'B', 400, 40)
const d4dAmbiguousPortA = d4dPort(d4dAmbiguousSheet, d4dAmbiguousA, 'p', 'right')
const d4dAmbiguousPortB = d4dPort(d4dAmbiguousSheet, d4dAmbiguousB, 'p', 'left')
const d4dAmbiguousNet = createId('net')
const d4dAmbiguousJunction = createId('jnc')
d4dAmbiguousSheet.nets.push({ id: d4dAmbiguousNet, name: 'stub' })
d4dAmbiguousSheet.junctions.push({ id: d4dAmbiguousJunction, netId: d4dAmbiguousNet, x: 180, y: 60 })
const d4dAmbiguousAnchorA = portAnchor(d4dAmbiguousSheet, d4dAmbiguousPortA)!
const d4dAmbiguousAnchorB = portAnchor(d4dAmbiguousSheet, d4dAmbiguousPortB)!
d4dAmbiguousSheet.segments.push(
  { id: createId('seg'), netId: d4dAmbiguousNet, routed: 'manual', points: [d4dAmbiguousAnchorA, { x: 180, y: 60 }], start: { kind: 'port', portId: d4dAmbiguousPortA }, end: { kind: 'junction', junctionId: d4dAmbiguousJunction } },
  { id: createId('seg'), netId: d4dAmbiguousNet, routed: 'manual', points: [{ x: 180, y: 60 }, d4dAmbiguousAnchorB], start: { kind: 'junction', junctionId: d4dAmbiguousJunction }, end: { kind: 'port', portId: d4dAmbiguousPortB } },
  { id: createId('seg'), netId: d4dAmbiguousNet, routed: 'manual', points: [{ x: 180, y: 60 }, { x: 180, y: 100 }], start: { kind: 'junction', junctionId: d4dAmbiguousJunction }, end: { kind: 'free', x: 180, y: 100 } },
)
const d4dAmbiguousPreview = previewExtract(d4dAmbiguous, d4dAmbiguousSheet.id, [d4dAmbiguousA, d4dAmbiguousC])
const d4dAmbiguousExtract = extractComponent(d4dAmbiguous, d4dAmbiguousSheet.id, [d4dAmbiguousA, d4dAmbiguousC], 'Stub')
check(!d4dAmbiguousPreview.ok && !d4dAmbiguousExtract.ok && d4dAmbiguousExtract.project === d4dAmbiguous && d4dAmbiguousSheet.segments.length === 3, 'a free end on the boundary is diagnosed and not extracted')
const d4dBox = { project: d4dProject }
const d4dSession = new ProjectSession(
  () => d4dBox.project,
  (next) => {
    d4dBox.project = next
  },
)
const d4dDidExtract = d4dSession.transact((current) => {
  const result = extractComponent(current, current.rootDocumentId, d4dChosen, 'Logic')
  return result.ok ? result.project : current
})
check(d4dDidExtract && d4dBox.project.components.some((item) => item.name === 'Logic'), 'extract is one project command')
const d4dRoot = documentById(d4dBox.project, d4dBox.project.rootDocumentId)!
const d4dLogic = d4dBox.project.components.find((item) => item.name === 'Logic')
const d4dInstance = d4dRoot.blocks.find((block) => block.componentId === d4dLogic?.id)
const d4dChild = d4dLogic ? implementationDocument(d4dBox.project, d4dLogic.id) : null
check(Boolean(d4dInstance && d4dChild && d4dChild.blocks.some((block) => block.id === d4dA) && !d4dRoot.blocks.some((block) => block.id === d4dA)), 'selected blocks move into the new diagram')
check(Boolean(d4dChild && !d4dDangling(d4dRoot) && !d4dDangling(d4dChild)), 'extract leaves no dangling endpoint')
check(d4dPortsOnNet(d4dRoot, d4dClkNet).includes(d4dSrcY) && !d4dPortsOnNet(d4dRoot, d4dClkNet).includes(d4dAIn), 'the outside clock port stays on its net and the inside port leaves it')
check(Boolean(d4dChild && d4dReachable(d4dChild, d4dAIn).some((id) => d4dChild?.ports.find((port) => port.id === id)?.name === 'clk')), 'the inside clock port reaches the new boundary')
check(Boolean(d4dChild && d4dReachable(d4dChild, d4dAO).includes(d4dBI) && d4dReachable(d4dChild, d4dAO).includes(d4dCI) && d4dChild.junctions.some((junction) => junction.id === d4dBus.junctionId)), 'the internal branch keeps its junction and its three ports')
check(d4dRoot.junctions.some((junction) => junction.id === d4dTap.junctionId) && d4dReachable(d4dRoot, d4dSrcQ).includes(d4dEP) && !d4dReachable(d4dRoot, d4dSrcQ).includes(d4dAT), 'the outside branch stays outside and still joins its two outside ports')
check(Boolean(d4dChild && d4dChild.junctions.some((junction) => junction.id === d4dY.junctionId) && d4dReachable(d4dChild, d4dDO).includes(d4dCO) && d4dPortsOnNet(d4dRoot, d4dY.netId).includes(d4dSinkI)), 'a junction between two inside ports moves inside and the outside port keeps the net')
check(d4dN1Net !== d4dN2Net && d4dPortsOnNet(d4dRoot, d4dN1Net).includes(d4dSinkB) && !d4dPortsOnNet(d4dRoot, d4dN1Net).includes(d4dEB) && d4dPortsOnNet(d4dRoot, d4dN2Net).includes(d4dEB), 'two nets with the same name stay separate')
check(d4dRoot.segments.find((segment) => segment.id === d4dClk)?.routed === 'manual' && Boolean(d4dChild && d4dChild.labels.some((label) => label.anchor.kind === 'segment' && label.anchor.segmentId === d4dMid)), 'a manual route stays manual and the internal label moves with its segment')
check(Boolean(d4dChild && d4dChild.groups.some((group) => group.blockIds.includes(d4dA) && group.blockIds.includes(d4dB))), 'a group whose blocks all move goes with them')
const d4dInterface = d4dRoot.ports.find((port) => port.blockId === d4dInstance?.id && d4dPortsOnNet(d4dRoot, d4dClkNet).includes(port.id))?.interfacePortId
check(Boolean(d4dInterface && d4dLogic?.bindings.some((binding) => binding.interfacePortId === d4dInterface) && d4dChild?.ports.some((port) => port.interfacePortId === d4dInterface && port.blockId !== d4dA)), 'the symbol pin, the instance port, and the boundary cite one logical id')
d4dSession.undo()
const d4dUndone = documentById(d4dBox.project, d4dBox.project.rootDocumentId)!
check(d4dBox.project.components.length === 0 && d4dReachable(d4dUndone, d4dSrcY).includes(d4dAIn) && d4dUndone.junctions.some((junction) => junction.id === d4dBus.junctionId), 'project undo restores the flat nets and the junctions')
d4dSession.redo()
const d4dRedone = documentById(d4dBox.project, d4dBox.project.rootDocumentId)!
const d4dLogicAgain = d4dBox.project.components.find((item) => item.name === 'Logic')
const d4dInstanceAgain = d4dRedone.blocks.find((block) => block.componentId === d4dLogicAgain?.id)
check(Boolean(d4dLogicAgain && d4dInstanceAgain && !d4dRedone.blocks.some((block) => block.id === d4dA)), 'project redo restores the extracted component')
const d4dSecond = d4dLogicAgain && d4dInstanceAgain ? instantiateComponent(d4dBox.project, d4dRedone.id, d4dLogicAgain.id, { x: 40, y: 280 }, 'Logic2') : null
check(Boolean(d4dSecond?.ok && d4dSecond.value.blockId !== d4dInstanceAgain?.id), 'a second instance uses the same definition')
if (d4dSecond?.ok && d4dLogicAgain && d4dInstanceAgain) {
  d4dBox.project = d4dSecond.project
  const d4dOpened = descend(d4dBox.project, rootLocation(d4dBox.project), d4dInstanceAgain.id)
  const d4dOpenedAgain = descend(d4dBox.project, rootLocation(d4dBox.project), d4dSecond.value.blockId)
  check(d4dOpened.kind === 'ok' && d4dOpenedAgain.kind === 'ok' && d4dOpened.location.documentId === d4dOpenedAgain.location.documentId && d4dOpened.location.steps[0]?.blockId !== d4dOpenedAgain.location.steps[0]?.blockId, 'both instances open one diagram through different paths')
  const d4dShared = d4dOpened.kind === 'ok' ? documentById(d4dBox.project, d4dOpened.location.documentId) : null
  const d4dInner = d4dShared?.blocks.find((block) => block.id === d4dA)
  if (d4dInner) d4dInner.name = 'A2'
  check(d4dShared?.blocks.find((block) => block.id === d4dA)?.name === 'A2', 'an edit of the shared diagram is the diagram both instances open')
  if (d4dInner) d4dInner.name = 'A'
  const d4dUnique = makeUnique(d4dBox.project, d4dRedone.id, d4dSecond.value.blockId)
  check(Boolean(d4dUnique.ok && d4dUnique.value.componentId !== d4dLogicAgain.id), 'make unique gives one instance its own definition')
  if (d4dUnique.ok) {
    d4dBox.project = d4dUnique.project
    const d4dUniqueComponent = componentById(d4dBox.project, d4dUnique.value.componentId)
    const d4dStillShared = componentById(d4dBox.project, d4dLogicAgain.id)
    const d4dAdded = d4dUniqueComponent ? addInterfacePort(d4dBox.project, d4dUniqueComponent.id, 'flag', 'right') : null
    check(Boolean(d4dAdded?.ok && d4dStillShared && !d4dStillShared.ports.some((port) => port.name === 'flag') && componentById(d4dAdded.project, d4dUnique.value.componentId)?.ports.some((port) => port.name === 'flag')), 'a port on the unique definition does not appear on the shared one')
    if (d4dAdded?.ok) d4dBox.project = d4dAdded.project
    const d4dLive = documentById(d4dBox.project, d4dBox.project.rootDocumentId)!
    const d4dBeforeDuplicate = d4dBox.project.components.length
    const d4dCopiedBlocks = duplicateBlocks(d4dLive, [d4dInstanceAgain.id], 40, 40)
    const d4dCopyId = d4dCopiedBlocks.get(d4dInstanceAgain.id)
    check(Boolean(d4dCopyId && d4dLive.blocks.find((block) => block.id === d4dCopyId)?.componentId === d4dLogicAgain.id && d4dBox.project.components.length === d4dBeforeDuplicate), 'duplicating an instance keeps the shared definition')
    const d4dExpanded = d4dSession.transact((current) => {
      const result = expandComponent(current, current.rootDocumentId, d4dInstanceAgain.id)
      return result.ok ? result.project : current
    })
    const d4dFlat = documentById(d4dBox.project, d4dBox.project.rootDocumentId)!
    const d4dRestoredA = d4dFlat.blocks.find((block) => block.name === 'A' && block.id !== d4dA)
    const d4dRestoredIn = d4dRestoredA ? d4dFlat.ports.find((port) => port.blockId === d4dRestoredA.id && port.name === 'in') : undefined
    check(Boolean(d4dExpanded && d4dRestoredIn && d4dReachable(d4dFlat, d4dSrcY).includes(d4dRestoredIn.id) && !d4dFlat.blocks.some((block) => block.id === d4dInstanceAgain.id)), 'expand puts the diagram back and keeps the outside connection')
    check(Boolean(d4dRestoredA && d4dReachable(d4dFlat, d4dFlat.ports.find((port) => port.blockId === d4dRestoredA.id && port.name === 'o')?.id ?? '').length >= 3), 'the expanded branch still joins the inside ports')
    check(Boolean(d4dUniqueComponent && implementationDocument(d4dBox.project, d4dUnique.value.componentId)?.blocks.some((block) => block.name === 'A') && !d4dDangling(d4dFlat)), 'the other instance keeps its own diagram and expand leaves no dangling wire')
    d4dSession.undo()
    const d4dCollapsed = documentById(d4dBox.project, d4dBox.project.rootDocumentId)!
    check(Boolean(d4dCollapsed.blocks.some((block) => block.id === d4dInstanceAgain.id) && d4dReachable(d4dCollapsed, d4dSrcY).some((id) => d4dCollapsed.ports.find((port) => port.id === id)?.blockId === d4dInstanceAgain.id)), 'project undo of expand restores the instance and its wires')
    const d4dSaved = parseProject(serializeProject(d4dBox.project))
    check(Boolean(d4dSaved.components.some((item) => item.id === d4dLogicAgain.id) && d4dSaved.components.some((item) => item.id === d4dUnique.value.componentId) && documentById(d4dSaved, d4dSaved.rootDocumentId)?.blocks.some((block) => block.id === d4dInstanceAgain.id)), 'save and reload keep both definitions and the hierarchy')
  }
}
const d4dRenamed = d4dLogicAgain ? renameComponent(d4dBox.project, d4dLogicAgain.id, 'Logic renamed') : null
check(Boolean(d4dRenamed?.ok && componentById(d4dRenamed.project, d4dLogicAgain?.id ?? '')?.name === 'Logic renamed' && documentById(d4dRenamed.project, d4dRenamed.project.rootDocumentId)?.blocks.find((block) => block.id === d4dInstanceAgain?.id)?.name === 'Logic'), 'renaming a component keeps the instance name and its port ids')
const d4dUsedDelete = d4dLogicAgain ? removeComponent(d4dBox.project, d4dLogicAgain.id) : null
check(Boolean(d4dUsedDelete && !d4dUsedDelete.ok && d4dUsedDelete.project === d4dBox.project), 'a used component is kept and named in the refusal')
const d4dDrop = addComponent(createProject('Drop'), { name: 'Box', ports: [], implementation: { kind: 'diagram', document: emptyDocument() } })
const d4dDropped = d4dDrop.ok ? removeComponent(d4dDrop.project, d4dDrop.value.componentId) : d4dDrop
check(Boolean(d4dDropped.ok && d4dDropped.project.components.length === 0 && d4dDropped.project.documents.length === 1), 'deleting an unused component also deletes its private diagram')
const d4dDuplicated = d4dLogicAgain ? duplicateComponent(d4dBox.project, d4dLogicAgain.id) : null
check(Boolean(d4dDuplicated?.ok && d4dDuplicated.value.componentId !== d4dLogicAgain?.id && implementationDocument(d4dDuplicated.project, d4dDuplicated.value.componentId)?.id !== implementationDocument(d4dDuplicated.project, d4dLogicAgain?.id ?? '')?.id), 'duplicating a component copies its diagram and keeps the original')
const d4dNone = addComponent(createProject('None'), { name: 'Plain', ports: [], implementation: { kind: 'none' } })
const d4dNonePlaced = d4dNone.ok ? instantiateComponent(d4dNone.project, d4dNone.project.rootDocumentId, d4dNone.value.componentId, { x: 0, y: 0 }, 'P') : null
const d4dNoExpand = d4dNonePlaced?.ok ? previewExpand(d4dNonePlaced.project, d4dNonePlaced.project.rootDocumentId, d4dNonePlaced.value.blockId) : null
check(Boolean(d4dNoExpand && !d4dNoExpand.ok), 'expand refuses a component that has no diagram')
const d4dHist = { project: createProject('Hist') }
const d4dHistSheet = documentById(d4dHist.project, d4dHist.project.rootDocumentId)!
const d4dHistA = d4dBlock(d4dHistSheet, 'A', 40, 40)
const d4dHistB = d4dBlock(d4dHistSheet, 'B', 200, 40)
const d4dHistSessions = new DocumentSessions(
  (id) => documentById(d4dHist.project, id),
  (next) => {
    const index = d4dHist.project.documents.findIndex((item) => item.id === next.id)
    if (index >= 0) d4dHist.project.documents[index] = next
  },
)
d4dHistSessions.get(d4dHistSheet.id).execute((draft) => {
  const block = draft.blocks.find((item) => item.id === d4dHistA)
  if (block) block.name = 'A local'
})
const d4dHistProject = new ProjectSession(
  () => d4dHist.project,
  (next) => {
    d4dHist.project = next
  },
)
check(d4dHistSessions.anyPending(), 'a sheet edit is pending before the project command')
d4dHistProject.transact((current) => {
  const result = extractComponent(current, current.rootDocumentId, [d4dHistA, d4dHistB], 'Pair')
  return result.ok ? result.project : current
})
check(d4dHistSessions.anyPending(), 'the sheet session still exists until the editor discards it')
d4dHistSessions.discard()
check(Boolean(!d4dHistSessions.get(d4dHist.project.rootDocumentId).canUndo && documentById(d4dHist.project, d4dHist.project.rootDocumentId)?.blocks.every((block) => block.name !== 'A local')), 'discarding sheet history cannot restore the pre-extract names onto the new diagram')
d4dHistProject.undo()
check(Boolean(documentById(d4dHist.project, d4dHist.project.rootDocumentId)?.blocks.some((block) => block.name === 'A local') && d4dHist.project.components.length === 0), 'project undo keeps the sheet edit from before the command and removes the extract')

const digital = digitalProject()
const signal = signalProject()
const general = generalProject()
const digitalRoot = documentById(digital, digital.rootDocumentId)
const datapath = digitalRoot?.blocks.find((block) => block.name === 'Datapath')
const openedPath = datapath ? descend(digital, rootLocation(digital), datapath.id) : null
const pathSheet = openedPath && openedPath.kind === 'ok' ? documentById(digital, openedPath.location.documentId) : null
const counterU1 = pathSheet?.blocks.find((block) => block.name === 'U1')
const counterU2 = pathSheet?.blocks.find((block) => block.name === 'U2')
const openedCounter = openedPath && openedPath.kind === 'ok' && counterU1 ? descend(digital, openedPath.location, counterU1.id) : null
const counterSheet = openedCounter && openedCounter.kind === 'ok' ? documentById(digital, openedCounter.location.documentId) : null
const stageBlock = counterSheet?.blocks.find((block) => block.name === 'Stage')
const openedStage = openedCounter && openedCounter.kind === 'ok' && stageBlock ? descend(digital, openedCounter.location, stageBlock.id) : null
check(validateProject(digital).length === 0 && findCycles(digital).length === 0, 'the digital reference validates and has no cycle')
check(Boolean(digitalRoot?.nets.some((net) => net.name === 'clk') && digitalRoot.junctions.length > 0 && digitalRoot.labels.length > 0), 'the digital root has a named branched clock')
check(Boolean(counterU1 && counterU2 && counterU1.componentId === counterU2.componentId && counterU1.id !== counterU2.id), 'two counters share one definition')
check(Boolean(openedStage && openedStage.kind === 'ok' && openedStage.location.steps.length === 3), 'the digital reference opens three levels')
check(Boolean(pathSheet?.blocks.some((block) => block.name === 'Register') && pathSheet.blocks.some((block) => block.name === 'Mux')), 'the datapath contains a register and a multiplexer')
const signalRoot = documentById(signal, signal.rootDocumentId)
const signalMimes = new Set((signalRoot?.assets ?? []).map((asset) => asset.mime))
const mixer = signalRoot?.symbols.find((symbol) => symbol.name === 'Mixer')
check(validateProject(signal).length === 0 && signalMimes.has('image/svg+xml') && signalMimes.has('image/png'), 'the signal reference validates and keeps an SVG and a bitmap')
check(Boolean(mixer?.ports.some((pin) => pin.side === 'top') && mixer.ports.some((pin) => pin.side === 'left') && signal.components.some((item) => item.name === 'Channel')), 'the signal reference uses several pin sides and a nested channel')
const generalRoot = documentById(general, general.rootDocumentId)
check(Boolean(generalRoot && generalRoot.strokes.length === 1 && generalRoot.groups.length === 1 && generalRoot.symbols.some((symbol) => symbol.id === 'sym_decision') && generalRoot.assets.some((asset) => asset.mime === 'image/png') && generalRoot.assets.some((asset) => asset.mime === 'image/svg+xml')), 'the general reference has a flowchart, pictures, a group, and ink')
const referenceReloaded = parseProject(serializeProject(digital))
check(Boolean(referenceReloaded && referenceReloaded.components.length === digital.components.length && validateProject(referenceReloaded).length === 0), 'a reference project reloads')

const openAsLibraries = builtinLibraries()
const genericSymbol = openAsLibraries.find((library) => library.id === 'lib_general')?.symbols.find((symbol) => symbol.id === 'sym_block')
const openAsHeld = { project: createProject('Open as') }
const openAsRoot = documentById(openAsHeld.project, openAsHeld.project.rootDocumentId)
const openAsPlaced = genericSymbol && openAsRoot ? placeLibrarySymbol(openAsRoot, genericSymbol, { x: 80, y: 60 }, 'Counter') : null
const openAsBlock = openAsPlaced && openAsPlaced.ok ? openAsRoot?.blocks.find((block) => block.id === openAsPlaced.blockId) : null
const openAsMate = openAsRoot ? createId('blk') : ''
if (openAsRoot && openAsMate) {
  openAsRoot.blocks.push({ id: openAsMate, name: 'Sink', x: 420, y: 60, width: 120, height: 72 })
  openAsRoot.ports.push({ id: 'prt_open_sink', blockId: openAsMate, name: 'in', side: 'left', t: 0.5 })
}
if (openAsBlock) {
  openAsBlock.x = 140
  openAsBlock.y = 96
  openAsBlock.width = 210
  openAsBlock.height = 128
}
const openAsPort = openAsRoot?.ports.find((port) => port.blockId === openAsBlock?.id && port.symbolPortId === 'pin_block_out')
const openAsWire = openAsPort ? linkPorts(openAsRoot!, openAsPort.id, 'prt_open_sink', 'count') : null
const openAsPortsBefore = openAsRoot?.ports.filter((port) => port.blockId === openAsBlock?.id).map((port) => ({ ...port })) ?? []
const openAsSegmentsBefore = JSON.stringify(openAsRoot?.segments ?? [])
const openAsLabelsBefore = JSON.stringify(openAsRoot?.labels ?? [])
const openAsSession = new ProjectSession(
  () => openAsHeld.project,
  (next) => {
    openAsHeld.project = next
  },
)
openAsSession.transact((current) => {
  const result = openAsDiagram(current, current.rootDocumentId, openAsBlock?.id ?? '')
  return result.ok ? result.project : current
})
const openAsSheet = documentById(openAsHeld.project, openAsHeld.project.rootDocumentId)
const openAsAfter = openAsSheet?.blocks.find((block) => block.id === openAsBlock?.id)
const openAsComponent = openAsHeld.project.components[0]
const openAsChildId = openAsComponent?.implementation.kind === 'diagram' ? openAsComponent.implementation.documentId : undefined
const openAsChild = openAsChildId ? documentById(openAsHeld.project, openAsChildId) : null
const openAsBoundary = openAsChild?.blocks.find((block) => block.name === 'Boundary' && !block.componentId)
check(Boolean(openAsAfter && openAsAfter.x === 140 && openAsAfter.y === 96 && openAsAfter.width === 210 && openAsAfter.height === 128 && openAsAfter.name === 'Counter' && openAsAfter.symbolId === 'sym_block' && openAsAfter.componentId === openAsComponent?.id && openAsHeld.project.components.length === 1), 'open as keeps the drawn block and its size')
check(Boolean(openAsPortsBefore.length > 0 && openAsPortsBefore.every((port) => openAsSheet?.ports.some((item) => item.id === port.id && item.symbolPortId === port.symbolPortId && item.side === port.side && item.t === port.t && item.interfacePortId))), 'open as keeps instance port ids and adds one interface id')
check(openAsSegmentsBefore === JSON.stringify(openAsSheet?.segments ?? []) && openAsLabelsBefore === JSON.stringify(openAsSheet?.labels ?? []) && Boolean(openAsWire), 'open as keeps the wires and their labels')
check(Boolean(openAsComponent && openAsComponent.implementation.kind === 'diagram' && openAsComponent.bindings.every((binding) => binding.symbolPortId === 'pin_block_in' || binding.symbolPortId === 'pin_block_out')), 'open as binds symbol pins by id')
check(Boolean(openAsBoundary && openAsComponent?.ports.every((port) => openAsChild?.ports.some((item) => item.blockId === openAsBoundary?.id && item.interfacePortId === port.id))), 'the new boundary cites the same interface ids')
check(validateProject(openAsHeld.project).length === 0 && findCycles(openAsHeld.project).length === 0, 'open as validates')
const openAsAgain = openAsDiagram(openAsHeld.project, openAsHeld.project.rootDocumentId, openAsBlock?.id ?? '')
check(!openAsAgain.ok && openAsAgain.project === openAsHeld.project, 'open as again does not create a second diagram')
const openAsSecond = instantiateComponent(openAsHeld.project, openAsHeld.project.rootDocumentId, openAsComponent?.id ?? '', { x: 140, y: 280 }, 'Counter 2')
const openAsSecondSheet = openAsSecond.ok ? documentById(openAsSecond.project, openAsSecond.project.rootDocumentId) : null
const openAsCopy = openAsSecondSheet?.blocks.find((block) => block.id === (openAsSecond.ok ? openAsSecond.value.blockId : ''))
check(Boolean(openAsSecond.ok && openAsCopy && openAsCopy.id !== openAsAfter?.id && openAsCopy.componentId === openAsAfter?.componentId && openAsSecond.project.components.length === 1), 'a second instance shares the definition and keeps its own block id')
openAsSession.undo()
const openAsUndone = documentById(openAsHeld.project, openAsHeld.project.rootDocumentId)?.blocks.find((block) => block.id === openAsBlock?.id)
check(Boolean(openAsUndone && !openAsUndone.componentId && openAsUndone.width === 210 && openAsUndone.height === 128 && openAsHeld.project.components.length === 0), 'project undo restores the generic block')
openAsSession.redo()
check(Boolean(documentById(openAsHeld.project, openAsHeld.project.rootDocumentId)?.blocks.find((block) => block.id === openAsBlock?.id)?.componentId && openAsHeld.project.components.length === 1 && openAsHeld.project.documents.length === 2), 'project redo restores the component and its diagram')
const bareHeld = { project: createProject('Bare') }
const bareRoot = documentById(bareHeld.project, bareHeld.project.rootDocumentId)
if (bareRoot) bareRoot.blocks.push({ id: 'blk_bare', name: 'Plain', x: 40, y: 40, width: 180, height: 90 })
const bareOpened = openAsDiagram(bareHeld.project, bareHeld.project.rootDocumentId, 'blk_bare')
const bareChild = bareOpened.ok ? documentById(bareOpened.project, bareOpened.value.documentId) : null
check(Boolean(bareOpened.ok && bareChild && bareChild.ports.length === 0 && bareChild.blocks.some((block) => block.name === 'Boundary')), 'a block without ports gets an empty interface')
const abstract = addComponent(createProject('Abstract'), { name: 'Latch', ports: [{ id: 'ifp_latch', name: 'q' }], implementation: { kind: 'none' } })
const abstractPlaced = abstract.ok ? instantiateComponent(abstract.project, abstract.project.rootDocumentId, abstract.value.componentId, { x: 30, y: 30 }, 'Latch') : null
const abstractSheet = abstractPlaced && abstractPlaced.ok ? documentById(abstractPlaced.project, abstractPlaced.project.rootDocumentId) : null
const abstractBlock = abstractSheet?.blocks.find((block) => block.id === (abstractPlaced && abstractPlaced.ok ? abstractPlaced.value.blockId : ''))
if (abstractBlock) {
  abstractBlock.width = 240
  abstractBlock.height = 100
}
const abstractOpened = abstractPlaced && abstractPlaced.ok && abstractBlock ? openAsDiagram(abstractPlaced.project, abstractPlaced.project.rootDocumentId, abstractBlock.id) : null
const abstractAfter = abstractOpened && abstractOpened.ok ? documentById(abstractOpened.project, abstractOpened.project.rootDocumentId)?.blocks.find((block) => block.id === abstractBlock?.id) : null
check(Boolean(abstractOpened && abstractOpened.ok && !abstractOpened.value.createdDefinition && abstractOpened.project.components.length === 1 && abstractAfter?.width === 240 && abstractAfter.height === 100), 'open as on an abstract component adds a diagram and keeps the block')
const boundaryProject = createProject('Boundary')
const boundaryRoot = documentById(boundaryProject, boundaryProject.rootDocumentId)
if (boundaryRoot) boundaryRoot.blocks.push({ id: 'blk_boundary_only', name: 'Boundary', x: 10, y: 10, width: 80, height: 40 })
const boundaryRefused = openAsDiagram(boundaryProject, boundaryProject.rootDocumentId, 'blk_boundary_only')
check(!boundaryRefused.ok && boundaryRefused.project === boundaryProject, 'open as refuses the boundary block')

const fitted = fitSymbolShapes(
  [{ kind: 'rect', x: 10, y: 10, width: 68, height: 44 }],
  [{ id: 'lbl_fit', text: 'Text', x: 28, y: 36 }],
  88,
  64,
  176,
  64,
)
const fittedRect = fitted.shapes[0]
check(
  fittedRect?.kind === 'rect' && fittedRect.x === 20 && fittedRect.y === 10 && fittedRect.width === 136 && fittedRect.height === 44 && fitted.labels[0]?.x === 56 && fitted.labels[0]?.y === 36 && fitted.labels[0]?.text === 'Text',
  'a symbol rect scales to the instance and the label keeps its text',
)
const fittedPicture = fitSymbolShapes(
  [{ kind: 'image', assetId: 'ast_fit', x: 20, y: 4, width: 120, height: 80, lockAspect: true }],
  [],
  160,
  108,
  320,
  108,
)
const fittedImage = fittedPicture.shapes[0]
check(
  fittedImage?.kind === 'image' && fittedImage.width === 120 && fittedImage.height === 80 && fittedImage.x === 100 && fittedImage.y === 4,
  'a locked picture keeps its aspect inside the scaled slot',
)
const east = resizeBox({ x: 100, y: 80, width: 200, height: 100 }, 'e', { x: 340, y: 80 }, false)
const west = resizeBox({ x: 100, y: 80, width: 200, height: 100 }, 'w', { x: 40, y: 80 }, false)
const corner = resizeBox({ x: 100, y: 80, width: 200, height: 100 }, 'nw', { x: 60, y: 40 }, false)
const tooSmall = resizeBox({ x: 100, y: 80, width: 200, height: 100 }, 'e', { x: 110, y: 80 }, false)
const snapped = resizeBox({ x: 100, y: 80, width: 200, height: 100 }, 'e', { x: 333, y: 80 }, true)
check(east.x === 100 && east.y === 80 && east.width === 240 && east.height === 100, 'the east handle keeps the left side')
check(west.x === 40 && west.width === 260 && west.x + west.width === 300 && west.height === 100, 'the west handle keeps the right side')
check(corner.x === 60 && corner.y === 40 && corner.x + corner.width === 300 && corner.y + corner.height === 180, 'a corner handle keeps the opposite corner')
check(tooSmall.width === 20 && tooSmall.x === 100 && snapped.width === 240 && snapped.x === 100, 'resize keeps a minimum size and snaps the moving edge')

const resizeDoc = emptyDocument()
const resizeSymbol = defineSymbol(resizeDoc, { name: 'Counter', width: 88, height: 64, ports: [{ id: 'pin_resize_out', name: 'out', side: 'right', t: 0.5 }] })
const resizeA = instantiateSymbol(resizeDoc, resizeSymbol, { x: 40, y: 40 }, 'A')
const resizeB = instantiateSymbol(resizeDoc, resizeSymbol, { x: 280, y: 40 }, 'B')
const resizePortA = resizeDoc.ports.find((port) => port.blockId === resizeA)
const resizePortB = resizeDoc.ports.find((port) => port.blockId === resizeB)
const resizeWire = resizePortA && resizePortB ? linkPorts(resizeDoc, resizePortA.id, resizePortB.id, 'count') : null
const resizeSegment = resizeDoc.segments.find((segment) => segment.id === resizeWire)
const resizeTrunk = resizeSegment?.points[1]?.x
const resizeNet = resizeSegment?.netId
const resizeLabel = resizeDoc.labels[0]?.anchor
const resizeSession = new EditSession(
  () => resizeDoc,
  (next) => {
    resizeDoc.blocks = next.blocks
    resizeDoc.ports = next.ports
    resizeDoc.segments = next.segments
    resizeDoc.labels = next.labels
    resizeDoc.nets = next.nets
    resizeDoc.symbols = next.symbols
  },
)
resizeSession.begin()
resizeSession.preview((draft) => {
  const box = resizeBox({ x: 40, y: 40, width: 88, height: 64 }, 'e', { x: 200, y: 40 }, false)
  setBlockFields(draft, resizeA ?? '', box)
})
resizeSession.preview((draft) => {
  const box = resizeBox({ x: 40, y: 40, width: 88, height: 64 }, 'e', { x: 240, y: 40 }, false)
  setBlockFields(draft, resizeA ?? '', box)
})
resizeSession.commit()
const resizeAfterA = resizeDoc.blocks.find((block) => block.id === resizeA)
const resizeAfterB = resizeDoc.blocks.find((block) => block.id === resizeB)
const resizeAfterSymbol = resizeDoc.symbols.find((symbol) => symbol.id === resizeSymbol)
const resizeAfterSegment = resizeDoc.segments.find((segment) => segment.id === resizeWire)
const resizeStart = resizeAfterSegment?.start
check(
  Boolean(
    resizeAfterA &&
      resizeAfterA.width === 200 &&
      resizeAfterA.x === 40 &&
      resizeAfterA.height === 64 &&
      resizeAfterB?.width === 88 &&
      resizeAfterSymbol?.width === 88 &&
      resizePortA &&
      resizeDoc.ports.some((port) => port.id === resizePortA.id && port.symbolPortId === 'pin_resize_out') &&
      resizeAfterSegment?.netId === resizeNet &&
      resizeAfterSegment?.points[1]?.x === resizeTrunk &&
      resizeStart?.kind === 'port' &&
      resizeStart.portId === resizePortA.id &&
      resizeLabel?.kind === 'segment' &&
      resizeDoc.labels[0]?.anchor.kind === 'segment' &&
      resizeDoc.labels[0].anchor.segmentId === resizeWire,
  ),
  'resize changes one instance and keeps the symbol, the other instance, and the net',
)
resizeSession.undo()
check(resizeDoc.blocks.find((block) => block.id === resizeA)?.width === 88, 'one resize gesture undoes to the original size')
resizeSession.redo()
check(resizeDoc.blocks.find((block) => block.id === resizeA)?.width === 200, 'redo restores the resized instance')
const unchanged = new EditSession(
  () => resizeDoc,
  () => undefined,
)
unchanged.begin()
unchanged.preview((draft) => setBlockFields(draft, resizeA ?? '', { width: resizeDoc.blocks.find((block) => block.id === resizeA)?.width }))
unchanged.commit()
check(!unchanged.canUndo, 'a resize that does not change the box adds no undo step')
const resizeCancelled = new EditSession(
  () => resizeDoc,
  (next) => {
    resizeDoc.blocks = next.blocks
    resizeDoc.segments = next.segments
  },
)
resizeCancelled.begin()
resizeCancelled.preview((draft) => setBlockFields(draft, resizeA ?? '', { width: 320 }))
resizeCancelled.cancel()
check(resizeDoc.blocks.find((block) => block.id === resizeA)?.width === 200 && !resizeCancelled.canUndo, 'a cancelled resize restores the box and adds no undo step')

const edgeBlock = { x: 100, y: 80, width: 200, height: 100 }
const edgeRight = borderPlacement(edgeBlock, { x: 300, y: 133 }, true)
const edgeLeft = borderPlacement(edgeBlock, { x: 100, y: 130 }, false)
const edgeTop = borderPlacement(edgeBlock, { x: 150, y: 80 }, false)
const edgeBottom = borderPlacement(edgeBlock, { x: 200, y: 180 }, false)
check(edgeRight.side === 'right' && edgeRight.t === 0.6, 'a snapped pointer on the right edge stores side and t')
check(edgeLeft.side === 'left' && edgeLeft.t === 0.5 && edgeTop.side === 'top' && edgeTop.t === 0.25 && edgeBottom.side === 'bottom' && edgeBottom.t === 0.5, 'each block side can receive a port')
const edgeNear = nearestBlockBorder([{ id: 'blk_edge', ...edgeBlock }], { x: 104, y: 130 }, false, 12)
check(edgeNear?.blockId === 'blk_edge' && edgeNear.side === 'left', 'a pointer near an edge chooses that block')
check(nearestBlockBorder([{ id: 'blk_edge', ...edgeBlock }], { x: 200, y: 130 }, false, 12) === null, 'a pointer in the middle of a block is not an edge')

const portDoc = emptyDocument()
const portSymbol = defineSymbol(portDoc, {
  name: 'Gate',
  width: 88,
  height: 64,
  ports: [{ id: 'pin_port_out', name: 'out', side: 'right', t: 0.5 }],
})
const portA = instantiateSymbol(portDoc, portSymbol, { x: 40, y: 40 }, 'A') ?? ''
const portB = instantiateSymbol(portDoc, portSymbol, { x: 280, y: 40 }, 'B') ?? ''
const portOutA = portDoc.ports.find((port) => port.blockId === portA && port.symbolPortId === 'pin_port_out')
const portOutB = portDoc.ports.find((port) => port.blockId === portB && port.symbolPortId === 'pin_port_out')
const addedLeft = addPortAt(portDoc, portA, 'left', 0.25)
const addedTop = addPortAt(portDoc, portA, 'top', 0.4)
const addedBottom = addPortAt(portDoc, portA, 'bottom', 0.7)
check(
  Boolean(addedLeft && addedTop && addedBottom && portDoc.ports.filter((port) => port.blockId === portA).length === 4),
  'ports can be added on the left, the top, and the bottom',
)
const mate = addPortAt(portDoc, portB, 'left', 0.5) ?? ''
const portWire = linkPorts(portDoc, addedLeft ?? '', mate, 'carry')
const portSegment = portDoc.segments.find((segment) => segment.id === portWire)
const portTrunk = portSegment?.points[1]?.x
const portNet = portSegment?.netId
const portLabel = portDoc.labels[0]?.anchor
placePort(portDoc, addedLeft ?? '', 'left', 0.8)
const slid = portDoc.ports.find((port) => port.id === addedLeft)
check(slid?.side === 'left' && slid.t === 0.8 && slid.placed === true && slid.id === addedLeft, 'a port slides along its side and keeps its id')
check(portDoc.segments.find((segment) => segment.id === portWire)?.points[1]?.x === portTrunk, 'sliding a port keeps the manual trunk')
placePort(portDoc, addedLeft ?? '', 'bottom', 0.2)
const switched = portDoc.ports.find((port) => port.id === addedLeft)
const switchedAnchor = portAnchor(portDoc, addedLeft ?? '')
const switchedLabel = portDoc.labels[0]?.anchor
check(
  Boolean(
    switched?.side === 'bottom' &&
      switched.id === addedLeft &&
      switched.t === 0.2 &&
      switchedAnchor &&
      Math.abs(switchedAnchor.y - (40 + 64)) < 0.5 &&
      portDoc.segments.find((segment) => segment.id === portWire)?.netId === portNet &&
      portDoc.segments.find((segment) => segment.id === portWire)?.start.kind === 'port' &&
      switchedLabel?.kind === 'segment' &&
      switchedLabel.segmentId === portWire &&
      portLabel?.kind === 'segment',
  ),
  'changing side keeps the net, the port id, and the label',
)
placePort(portDoc, portOutA?.id ?? '', 'top', 0.3)
const placedOut = portDoc.ports.find((port) => port.id === portOutA?.id)
const otherOut = portDoc.ports.find((port) => port.id === portOutB?.id)
const symbolOut = portDoc.symbols.find((symbol) => symbol.id === portSymbol)?.ports.find((pin) => pin.id === 'pin_port_out')
check(
  Boolean(placedOut?.placed && placedOut.side === 'top' && placedOut.symbolPortId === 'pin_port_out' && otherOut?.side === 'right' && !otherOut.placed && symbolOut?.side === 'right' && symbolOut.t === 0.5),
  'a graphic move changes one instance and leaves the symbol and the other instance',
)
moveSymbolPort(portDoc, portSymbol, 'pin_port_out', 'right', 0.2)
check(portDoc.ports.find((port) => port.id === portOutA?.id)?.side === 'top' && portDoc.ports.find((port) => port.id === portOutB?.id)?.t === 0.2, 'a symbol pin move follows only instances without their own position')
setBlockFields(portDoc, portA, { width: 176, height: 128 })
const portGrown = portAnchor(portDoc, addedLeft ?? '')
check(Boolean(portGrown && Math.abs(portGrown.x - (40 + 176 * 0.2)) < 0.5 && Math.abs(portGrown.y - (40 + 128)) < 0.5), 'a later resize keeps the relative port position')
const portSession = new EditSession(
  () => portDoc,
  (next) => {
    portDoc.blocks = next.blocks
    portDoc.ports = next.ports
    portDoc.segments = next.segments
    portDoc.labels = next.labels
    portDoc.symbols = next.symbols
  },
)
portSession.begin()
portSession.preview((draft) => placePort(draft, addedTop ?? '', 'top', 0.55))
portSession.preview((draft) => placePort(draft, addedTop ?? '', 'top', 0.75))
portSession.commit()
check(portDoc.ports.find((port) => port.id === addedTop)?.t === 0.75, 'one port gesture stores the last position')
portSession.undo()
check(portDoc.ports.find((port) => port.id === addedTop)?.t === 0.4, 'undo restores the port and its wires together')
portSession.redo()
check(portDoc.ports.find((port) => port.id === addedTop)?.t === 0.75, 'redo restores the moved port')
const portSame = new EditSession(
  () => portDoc,
  () => undefined,
)
portSame.begin()
portSame.preview((draft) => placePort(draft, addedTop ?? '', 'top', 0.75))
portSame.commit()
check(!portSame.canUndo, 'a port move that does not change the position adds no undo step')
const portCancel = new EditSession(
  () => portDoc,
  (next) => {
    portDoc.ports = next.ports
    portDoc.segments = next.segments
  },
)
portCancel.begin()
portCancel.preview((draft) => placePort(draft, addedTop ?? '', 'right', 0.1))
portCancel.cancel()
check(portDoc.ports.find((port) => port.id === addedTop)?.side === 'top' && portDoc.ports.find((port) => port.id === addedTop)?.t === 0.75 && !portCancel.canUndo, 'a cancelled port move restores the position and adds no undo step')
check(removeUnwiredPort(portDoc, addedLeft ?? '') === false && portDoc.segments.some((segment) => segment.id === portWire), 'a wired port stays, and its wire is not deleted')
check(removeUnwiredPort(portDoc, addedBottom ?? '') && !portDoc.ports.some((port) => port.id === addedBottom), 'an unwired port can be removed')
const portStored = parseDocument(serialize(portDoc))
check(portStored.ports.find((port) => port.id === portOutA?.id)?.placed === true && portStored.ports.find((port) => port.id === portOutA?.id)?.side === 'top', 'save and load keep the instance position')

const portProject = createProject('Ports')
const portRoot = documentById(portProject, portProject.rootDocumentId)
const portRootSymbol = portRoot ? defineSymbol(portRoot, { name: 'Box', width: 88, height: 64, ports: [{ id: 'pin_box_q', name: 'q', side: 'right', t: 0.5 }] }) : ''
const portFirst = portRoot ? instantiateSymbol(portRoot, portRootSymbol, { x: 40, y: 40 }, 'Box') : ''
if (portRoot && portFirst) {
  addPortAt(portRoot, portFirst, 'left', 0.2)
  addPortAt(portRoot, portFirst, 'top', 0.3)
  addPortAt(portRoot, portFirst, 'bottom', 0.8)
  placePort(portRoot, portRoot.ports.find((port) => port.blockId === portFirst && port.symbolPortId === 'pin_box_q')?.id ?? '', 'right', 0.15)
}
const portBefore = portRoot?.ports.filter((port) => port.blockId === portFirst).map((port) => ({ id: port.id, side: port.side, t: port.t, placed: port.placed, symbolPortId: port.symbolPortId })) ?? []
const portOpened = openAsDiagram(portProject, portProject.rootDocumentId, portFirst ?? '')
const portOpenedRoot = portOpened.ok ? documentById(portOpened.project, portProject.rootDocumentId) : null
const portOpenedChild = portOpened.ok ? documentById(portOpened.project, portOpened.value.documentId) : null
const portOpenedBlock = portOpenedRoot?.blocks.find((block) => block.id === portFirst)
const portOpenedComponent = portOpened.ok ? componentById(portOpened.project, portOpened.value.componentId) : null
check(
  Boolean(
    portOpened.ok &&
      portBefore.every((port) => portOpenedRoot?.ports.some((item) => item.id === port.id && item.side === port.side && item.t === port.t && item.placed === true && item.symbolPortId === port.symbolPortId && item.interfacePortId)) &&
      portOpenedChild?.ports.filter((port) => port.placed).length === 4 &&
      portOpenedComponent?.bindings.length === 1 &&
      portOpenedComponent.bindings[0]?.symbolPortId === 'pin_box_q' &&
      portOpenedRoot?.symbols.find((symbol) => symbol.id === portRootSymbol)?.ports.find((pin) => pin.id === 'pin_box_q')?.t === 0.5,
  ),
  'open as keeps placed ports, binds only the existing pin, and leaves the symbol',
)
const portOpenedComponentId = portOpened.ok ? portOpened.value.componentId : ''
const portSecond = portOpened.ok ? instantiateComponent(portOpened.project, portProject.rootDocumentId, portOpened.value.componentId, { x: 240, y: 40 }, 'Box') : null
const portSecondId = portSecond?.ok ? portSecond.value.blockId : ''
const portSecondRoot = portSecond?.ok ? documentById(portSecond.project, portProject.rootDocumentId) : null
const portSecondBlock = portSecondRoot?.blocks.find((block) => block.id === portSecondId)
check(
  Boolean(
    portSecond?.ok &&
      portSecondBlock &&
      !portSecondRoot?.ports.some((port) => port.blockId === portSecondBlock.id && port.placed) &&
      portSecondRoot?.ports.filter((port) => port.blockId === portSecondBlock.id && port.interfacePortId).length === 4 &&
      portOpenedRoot?.ports.find((port) => port.blockId === portFirst && port.placed && port.side === 'top'),
  ),
  'a second instance has the logical ports and not the first instance positions',
)
const portLogical = portSecond?.ok
  ? addInterfacePort(portSecond.project, portOpenedComponentId, 'extra', 'bottom', {
      documentId: portProject.rootDocumentId,
      blockId: portFirst ?? '',
      t: 0.9,
    })
  : null
const portLogicalId = portLogical?.ok ? portLogical.value.interfacePortId : ''
const portLogicalRoot = portLogical?.ok ? documentById(portLogical.project, portProject.rootDocumentId) : null
const portLogicalFirst = portLogicalRoot?.ports.find((port) => port.blockId === portFirst && port.interfacePortId === portLogicalId)
const portLogicalSecond = portLogicalRoot?.ports.find((port) => port.blockId === portSecondId && port.interfacePortId === portLogicalId)
const portLogicalSymbol = portLogicalRoot?.symbols.find((symbol) => symbol.id === portRootSymbol)
check(
  Boolean(
    portLogical?.ok &&
      portLogicalFirst?.placed === true &&
      portLogicalFirst.t === 0.9 &&
      portLogicalFirst.side === 'bottom' &&
      portLogicalSecond &&
      !portLogicalSecond.placed &&
      portLogicalSymbol?.ports.length === 1,
  ),
  'a new logical port reaches every instance, and only the chosen instance stores the graphic position',
)

let hideDoc = emptyDocument()
const hideSymbol = defineSymbol(hideDoc, {
  name: 'Hide',
  width: 88,
  height: 64,
  ports: [
    { id: 'pin_hide_in', name: 'in', side: 'left', t: 0.5 },
    { id: 'pin_hide_out', name: 'out', side: 'right', t: 0.5 },
  ],
})
const hideA = instantiateSymbol(hideDoc, hideSymbol ?? '', { x: 20, y: 20 }, 'A') ?? ''
const hideB = instantiateSymbol(hideDoc, hideSymbol ?? '', { x: 180, y: 20 }, 'B') ?? ''
const hideOut = hideDoc.ports.find((port) => port.blockId === hideA && port.symbolPortId === 'pin_hide_out')
placePort(hideDoc, hideOut?.id ?? '', 'bottom', 0.25)
const hideAdded = addPortAt(hideDoc, hideA, 'top', 0.3)
const hideAddedAgain = addPortAt(hideDoc, hideA, 'left', 0.7)
check(
  Boolean(hideAdded && hideAddedAgain && hideDoc.ports.find((port) => port.id === hideAdded)?.name !== hideDoc.ports.find((port) => port.id === hideAddedAgain)?.name),
  'automatic names skip a name that is already used',
)
check(unusedPortName(['p1', 'P2']) === 'p3', 'automatic names ignore letter case')
check(renameInstancePort(hideDoc, hideAdded ?? '', 'IN') === false && hideDoc.ports.find((port) => port.id === hideAdded)?.name !== 'IN', 'a generic rename refuses a name that differs only by case')
check(removeUnwiredPort(hideDoc, hideOut?.id ?? '') && !hideDoc.ports.some((port) => port.id === hideOut?.id), 'a placed bound pin can be removed from one instance')
check(
  Boolean(
    hideDoc.symbols.find((symbol) => symbol.id === hideSymbol)?.ports.some((pin) => pin.id === 'pin_hide_out') &&
      hideDoc.ports.some((port) => port.blockId === hideB && port.symbolPortId === 'pin_hide_out'),
  ),
  'removing an instance pin leaves the symbol and the other instance',
)
applySymbol(hideDoc, hideSymbol ?? '')
check(
  Boolean(!hideDoc.ports.some((port) => port.blockId === hideA && port.symbolPortId === 'pin_hide_out') && hideDoc.blocks.find((block) => block.id === hideA)?.suppressedPins?.includes('pin_hide_out')),
  'a symbol refresh does not restore a pin hidden on one instance',
)
check(removeUnwiredPort(hideDoc, hideAdded ?? '') && !hideDoc.ports.some((port) => port.id === hideAdded), 'an added unwired port can be removed')
const hideFreed = addPortAt(hideDoc, hideA, 'right', 0.4)
const hideNames = hideDoc.ports.filter((port) => port.blockId === hideA).map((port) => port.name.toLowerCase())
check(Boolean(hideFreed) && new Set(hideNames).size === hideNames.length, 'after a deletion the next automatic name is still unique')
const hideIn = hideDoc.ports.find((port) => port.blockId === hideA && port.symbolPortId === 'pin_hide_in')
const hideOther = hideDoc.ports.find((port) => port.blockId === hideB && port.symbolPortId === 'pin_hide_out')
const hideWire = hideIn && hideOther ? linkPorts(hideDoc, hideIn.id, hideOther.id, 'kept') : null
check(Boolean(hideWire) && removeUnwiredPort(hideDoc, hideIn?.id ?? '') === false && hideDoc.segments.some((segment) => segment.id === hideWire), 'a wired port and its wire are kept')
check(classifyPortDelete(null, hideDoc, hideIn?.id ?? '')?.kind === 'wired' && classifyPortDelete(null, hideDoc, hideFreed ?? '')?.kind === 'local', 'a generic port is deleted locally, and a wired one is refused')
const hideSession = new EditSession(
  () => hideDoc,
  (next) => {
    hideDoc = next
  },
)
const hidePlain = hideDoc.ports.find((port) => port.blockId === hideA && !port.symbolPortId)?.id ?? ''
hideSession.execute((draft) => {
  removeUnwiredPort(draft, hidePlain)
})
check(!hideDoc.ports.some((port) => port.id === hidePlain) && hideSession.canUndo, 'a local port deletion is one undo step')
hideSession.undo()
check(hideDoc.ports.some((port) => port.id === hidePlain), 'undo restores the deleted port')
hideSession.redo()
check(!hideDoc.ports.some((port) => port.id === hidePlain), 'redo removes the port again')
const hideSaved = parseDocument(serialize(hideDoc))
check(Boolean(hideSaved.blocks.find((block) => block.id === hideA)?.suppressedPins?.includes('pin_hide_out')), 'save and load keep a hidden symbol pin')

const nameProject = createProject('Names')
const nameRoot = documentById(nameProject, nameProject.rootDocumentId)
let nameSymbol = ''
let nameFirst = ''
if (nameRoot) {
  nameSymbol = defineSymbol(nameRoot, { name: 'Box', width: 88, height: 64, ports: [{ id: 'pin_name_out', name: 'out', side: 'right', t: 0.5 }] }) ?? ''
  nameFirst = instantiateSymbol(nameRoot, nameSymbol, { x: 40, y: 40 }, 'A') ?? ''
  renameInstancePort(nameRoot, nameRoot.ports.find((port) => port.blockId === nameFirst && port.symbolPortId === 'pin_name_out')?.id ?? '', 'clk')
}
const nameOpened = openAsDiagram(nameProject, nameProject.rootDocumentId, nameFirst)
const nameSecond = nameOpened.ok ? instantiateComponent(nameOpened.project, nameProject.rootDocumentId, nameOpened.value.componentId, { x: 240, y: 40 }, 'B') : null
const nameSecondId = nameSecond?.ok ? nameSecond.value.blockId : ''
const nameKeptPort = nameSecond?.ok && nameOpened.ok ? addInterfacePort(nameSecond.project, nameOpened.value.componentId, 'keep', 'left') : null
const nameSheet = nameKeptPort?.ok ? documentById(nameKeptPort.project, nameProject.rootDocumentId) : null
const nameMate = nameSheet ? addPortAt(nameSheet, nameSecondId, 'left', 0.2) : null
const nameClk = nameSheet?.ports.find((port) => port.blockId === nameSecondId && port.symbolPortId === 'pin_name_out')
const nameWire = nameClk && nameMate ? linkPorts(nameSheet!, nameClk.id, nameMate, 'clk') : null
const nameLogicalId = nameClk?.interfacePortId ?? ''
const nameRemoved = nameKeptPort?.ok && nameLogicalId ? removeInterfacePort(nameKeptPort.project, nameOpened.ok ? nameOpened.value.componentId : '', nameLogicalId) : null
const nameAfter = nameKeptPort?.ok ? documentById(nameKeptPort.project, nameProject.rootDocumentId) : null
const nameChild = nameKeptPort?.ok && nameOpened.ok ? documentById(nameKeptPort.project, nameOpened.value.documentId) : null
const nameBoundary = nameChild?.blocks.find((block) => block.name === 'Boundary' && !block.componentId)
const nameKept = nameAfter?.ports.find((port) => port.id === nameClk?.id)
const nameFirstPort = nameAfter?.ports.find((port) => port.blockId === nameFirst && port.symbolPortId === 'pin_name_out')
const nameClass = nameAfter && nameKept && nameKeptPort?.ok ? classifyPortDelete(nameKeptPort.project, nameAfter, nameKept.id) : null
const nameExtra = nameKeptPort?.ok && nameOpened.ok ? addInterfacePort(nameKeptPort.project, nameOpened.value.componentId, 'extra', 'top') : null
const nameClash = nameExtra?.ok && nameOpened.ok ? addInterfacePort(nameExtra.project, nameOpened.value.componentId, 'EXTRA', 'bottom') : null
const nameRename = nameExtra?.ok && nameOpened.ok ? renameInterfacePort(nameExtra.project, nameOpened.value.componentId, nameExtra.value.interfacePortId, 'KEEP') : null
check(nameSheet?.ports.find((port) => port.blockId === nameSecondId && port.symbolPortId === 'pin_name_out')?.name === 'clk', 'a second instance shows the logical name')
check(nameSheet?.symbols.find((symbol) => symbol.id === nameSymbol)?.ports.find((pin) => pin.id === 'pin_name_out')?.name === 'out', 'the symbol pin keeps its own name')
check(
  Boolean(
    nameRemoved &&
      !nameRemoved.ok &&
      nameRemoved.project === nameKeptPort?.project &&
      nameFirstPort?.interfacePortId === nameLogicalId &&
      nameKept?.interfacePortId === nameLogicalId &&
      nameWire &&
      nameAfter?.segments.some((segment) => segment.id === nameWire) &&
      nameChild?.ports.some((port) => port.blockId === nameBoundary?.id && port.interfacePortId === nameLogicalId) &&
      nameAfter?.symbols.find((symbol) => symbol.id === nameSymbol)?.ports.some((pin) => pin.id === 'pin_name_out') &&
      !nameAfter?.blocks.find((block) => block.id === nameFirst)?.suppressedPins?.includes('pin_name_out') &&
      nameClass?.kind === 'logical',
  ),
  'a logical port wired on one instance is refused on every instance and on the boundary',
)
check(Boolean(nameExtra?.ok && !nameClash?.ok && !nameRename?.ok && nameClash?.project === nameExtra?.project), 'a logical name cannot be reused in another case')
const nameExtraId = nameExtra?.ok ? nameExtra.value.interfacePortId : ''
const nameExtraChild = nameExtra?.ok && nameOpened.ok ? documentById(nameExtra.project, nameOpened.value.documentId) : null
const nameExtraBoundary = nameExtraChild?.blocks.find((block) => block.name === 'Boundary' && !block.componentId)
const nameBoundaryPort = nameExtraChild?.ports.find((port) => port.blockId === nameExtraBoundary?.id && port.interfacePortId === nameExtraId)
const nameBoundaryClass = nameExtra?.ok && nameExtraChild && nameBoundaryPort ? classifyPortDelete(nameExtra.project, nameExtraChild, nameBoundaryPort.id) : null
check(nameBoundaryClass?.kind === 'logical', 'a boundary port deletes the logical port, not only the connector')

const syncProject = createProject('Sync')
const syncSheet = documentById(syncProject, syncProject.rootDocumentId)
let syncSymbol = ''
let syncA = ''
if (syncSheet) {
  syncSymbol = defineSymbol(syncSheet, {
    name: 'Generic block',
    width: 88,
    height: 64,
    ports: [
      { id: 'pin_sync_in', name: 'in', side: 'left', t: 0.5 },
      { id: 'pin_sync_out', name: 'out', side: 'right', t: 0.5 },
    ],
  }) ?? ''
  syncA = instantiateSymbol(syncSheet, syncSymbol, { x: 80, y: 80 }, 'Generic block') ?? ''
}
const syncAddedTop = syncSheet ? addPortAt(syncSheet, syncA, 'top', 0.3) : null
const syncAddedRight = syncSheet ? addPortAt(syncSheet, syncA, 'right', 0.4) : null
const syncOpened = openAsDiagram(syncProject, syncProject.rootDocumentId, syncA)
const syncBox = { project: syncOpened.ok ? syncOpened.project : syncProject }
const syncComponentId = syncOpened.ok ? syncOpened.value.componentId : ''
const syncChildId = syncOpened.ok ? syncOpened.value.documentId : ''
const syncLogical = (name: string) => componentById(syncBox.project, syncComponentId)?.ports.find((port) => port.name === name)?.id ?? ''
const syncOn = (documentId: string, blockId: string, interfacePortId: string) =>
  documentById(syncBox.project, documentId)?.ports.find((port) => port.blockId === blockId && port.interfacePortId === interfacePortId)
const syncBoundaryOf = () => {
  const child = documentById(syncBox.project, syncChildId)
  return child?.blocks.find((block) => block.name === 'Boundary' && !block.componentId) ?? null
}
if (syncOpened.ok && syncSheet && syncAddedTop && syncAddedRight) {
  const syncInId = syncLogical('in')
  const syncOutId = syncLogical('out')
  const syncP1Id = syncLogical('p1')
  const syncP2Id = syncLogical('p2')
  const syncSessions = new DocumentSessions(
    (id) => documentById(syncBox.project, id),
    (next) => {
      const index = syncBox.project.documents.findIndex((item) => item.id === next.id)
      if (index >= 0) syncBox.project.documents[index] = next
    },
  )
  syncSessions.get(syncChildId)
  syncSessions.get(syncBox.project.rootDocumentId)
  const syncSecond = instantiateComponent(syncBox.project, syncBox.project.rootDocumentId, syncComponentId, { x: 280, y: 80 }, 'Generic block')
  if (syncSecond.ok) syncBox.project = syncSecond.project
  const syncB = syncSecond.ok ? syncSecond.value.blockId : ''
  const syncOpenedNames = documentById(syncBox.project, syncChildId)?.ports.map((port) => port.name) ?? []
  check(['in', 'out', 'p1', 'p2'].every((name) => syncOpenedNames.includes(name)), 'open as puts the original pins and the added ports on the boundary')
  const syncHere = addInterfacePort(syncBox.project, syncComponentId, 'here', 'left')
  if (syncHere.ok) syncBox.project = syncHere.project
  const syncOther = syncHere.ok ? addInterfacePort(syncBox.project, syncComponentId, 'other', 'right') : null
  if (syncOther?.ok) syncBox.project = syncOther.project
  const syncEdge = syncOther?.ok ? addInterfacePort(syncBox.project, syncComponentId, 'edge', 'top') : null
  if (syncEdge?.ok) syncBox.project = syncEdge.project
  const syncHereId = syncHere.ok ? syncHere.value.interfacePortId : ''
  const syncOtherId = syncOther?.ok ? syncOther.value.interfacePortId : ''
  const syncEdgeId = syncEdge?.ok ? syncEdge.value.interfacePortId : ''
  const syncRoot = documentById(syncBox.project, syncBox.project.rootDocumentId)
  const syncMoved = syncRoot?.ports.find((port) => port.id === syncAddedRight)
  if (syncRoot && syncMoved) placePort(syncRoot, syncMoved.id, 'bottom', 0.8)
  const syncSymbolPorts = JSON.stringify(syncRoot?.symbols.find((symbol) => symbol.id === syncSymbol)?.ports ?? [])
  const syncMateBlock = syncRoot ? placeTemplate(syncRoot, BLOCK_TEMPLATES[0], false) : ''
  const syncMate = syncRoot && syncMateBlock ? addPortAt(syncRoot, syncMateBlock, 'left', 0.5) : null
  const syncHerePort = syncOn(syncBox.project.rootDocumentId, syncA, syncHereId)
  const syncHereWire = syncRoot && syncHerePort && syncMate ? linkPorts(syncRoot, syncHerePort.id, syncMate, 'here') : null
  const syncHistory = new ProjectSession(
    () => syncBox.project,
    (next) => {
      syncBox.project = next
    },
  )
  const syncRefusedHere = syncHistory.transact((current) => {
    const result = removeInterfacePort(current, syncComponentId, syncHereId)
    return result.ok ? result.project : current
  })
  const syncHereDirect = removeInterfacePort(syncBox.project, syncComponentId, syncHereId)
  check(Boolean(syncHereWire) && !syncRefusedHere && !syncHistory.canUndo && !syncHereDirect.ok && syncHereDirect.project === syncBox.project, 'a wire on this instance refuses the logical delete and adds no undo step')
  check(!syncHereDirect.ok && syncHereDirect.message.includes('Generic block') && syncHereDirect.message.includes('kept'), 'the refusal names the wired instance')
  const syncOtherMate = syncRoot && syncMateBlock ? addPortAt(syncRoot, syncMateBlock, 'left', 0.2) : null
  const syncOtherPort = syncOn(syncBox.project.rootDocumentId, syncB, syncOtherId)
  const syncOtherWire = syncRoot && syncOtherPort && syncOtherMate ? linkPorts(syncRoot, syncOtherPort.id, syncOtherMate, 'other') : null
  const syncOtherDirect = removeInterfacePort(syncBox.project, syncComponentId, syncOtherId)
  check(Boolean(syncOtherWire && !syncOtherDirect.ok && syncOtherDirect.project === syncBox.project && syncOn(syncBox.project.rootDocumentId, syncA, syncOtherId)), 'a wire on another instance refuses the delete on this one')
  const syncChild = documentById(syncBox.project, syncChildId)
  const syncInner = syncChild ? placeTemplate(syncChild, BLOCK_TEMPLATES[0], false) : ''
  const syncInnerPort = syncChild && syncInner ? addPortAt(syncChild, syncInner, 'left', 0.5) : null
  const syncEdgePort = syncOn(syncChildId, syncBoundaryOf()?.id ?? '', syncEdgeId)
  const syncEdgeWire = syncChild && syncEdgePort && syncInnerPort ? linkPorts(syncChild, syncEdgePort.id, syncInnerPort, 'edge') : null
  const syncEdgeDirect = removeInterfacePort(syncBox.project, syncComponentId, syncEdgeId)
  check(Boolean(syncEdgeWire && !syncEdgeDirect.ok && syncEdgeDirect.message.includes('Boundary') && syncOn(syncBox.project.rootDocumentId, syncA, syncEdgeId)), 'a wire on the boundary refuses the delete on the parent')
  const syncStale = parseProject(serializeProject(syncBox.project))
  const syncStaleRoot = documentById(syncStale, syncStale.rootDocumentId)
  const syncStalePort = syncStaleRoot?.ports.find((port) => port.interfacePortId === syncP1Id)
  if (syncStalePort) syncStalePort.interfacePortId = 'ifp_missing'
  const syncStaleMate = syncStaleRoot ? addPortAt(syncStaleRoot, syncStaleRoot.blocks[0]?.id ?? '', 'left', 0.1) : null
  const syncStaleWire = syncStaleRoot && syncStalePort && syncStaleMate ? linkPorts(syncStaleRoot, syncStalePort.id, syncStaleMate, 'stale') : null
  const syncStaleClass = syncStaleRoot && syncStalePort ? classifyPortDelete(syncStale, syncStaleRoot, syncStalePort.id) : null
  check(
    Boolean(syncStaleWire && syncStaleClass?.kind === 'dangling' && syncStaleClass.wired && interfaceDiagnostics(syncStale, syncComponentId).some((note) => note.kind === 'wired-removed' && note.portId === syncStalePort?.id)),
    'an already invalid wired interface reference is still diagnosed',
  )
  const syncInRemoved = removeInterfacePort(syncBox.project, syncComponentId, syncInId)
  if (syncInRemoved.ok) syncBox.project = syncInRemoved.project
  check(syncInRemoved.ok && !syncOn(syncChildId, syncBoundaryOf()?.id ?? '', syncInId) && !syncOn(syncBox.project.rootDocumentId, syncA, syncInId), 'deleting an original symbol pin removes that logical port from the boundary')
  check(documentById(syncBox.project, syncBox.project.rootDocumentId)?.symbols.some((symbol) => symbol.ports.some((pin) => pin.id === 'pin_sync_in')) === true, 'the symbol pin itself stays in the symbol')
  const syncOutPort = syncOn(syncChildId, syncBoundaryOf()?.id ?? '', syncOutId)
  const syncOutSheet = documentById(syncBox.project, syncChildId)
  const syncOutDecision = syncOutSheet && syncOutPort ? classifyPortDelete(syncBox.project, syncOutSheet, syncOutPort.id) : null
  const syncOutRemoved = syncOutDecision?.kind === 'logical' ? removeInterfacePort(syncBox.project, syncOutDecision.componentId, syncOutDecision.interfacePortId) : null
  if (syncOutRemoved?.ok) syncBox.project = syncOutRemoved.project
  check(Boolean(syncOutRemoved?.ok && !syncOn(syncBox.project.rootDocumentId, syncA, syncOutId) && !syncOn(syncBox.project.rootDocumentId, syncB, syncOutId) && !syncOn(syncChildId, syncBoundaryOf()?.id ?? '', syncOutId)), 'deleting the same port from the boundary removes it from every instance')
  const syncKept = syncOn(syncBox.project.rootDocumentId, syncA, syncP2Id)
  const syncOtherKept = syncOn(syncBox.project.rootDocumentId, syncB, syncP2Id)
  const syncBoundaryKept = syncOn(syncChildId, syncBoundaryOf()?.id ?? '', syncP2Id)
  check(Boolean(syncKept?.placed && syncKept.side === 'bottom' && syncKept.t === 0.8 && !syncOtherKept?.placed && syncBoundaryKept?.placed && syncBoundaryKept.side !== 'bottom'), 'a graphic move stays on the instance that was moved')
  check(JSON.stringify(documentById(syncBox.project, syncBox.project.rootDocumentId)?.symbols.find((symbol) => symbol.id === syncSymbol)?.ports ?? []) === syncSymbolPorts, 'logical deletes do not change the symbol definition')
  const syncFromBoundary = addInterfacePort(syncBox.project, syncComponentId, 'added', 'left', {
    documentId: syncChildId,
    blockId: syncBoundaryOf()?.id ?? '',
    t: 0.2,
  })
  if (syncFromBoundary.ok) syncBox.project = syncFromBoundary.project
  const syncAddedId = syncFromBoundary.ok ? syncFromBoundary.value.interfacePortId : ''
  const syncBoundaryAdded = syncOn(syncChildId, syncBoundaryOf()?.id ?? '', syncAddedId)
  check(Boolean(syncFromBoundary.ok && syncBoundaryAdded?.placed && syncBoundaryAdded.t === 0.2 && syncOn(syncBox.project.rootDocumentId, syncA, syncAddedId) && syncOn(syncBox.project.rootDocumentId, syncB, syncAddedId) && !syncOn(syncBox.project.rootDocumentId, syncA, syncAddedId)?.placed), 'a port added on the boundary appears on every instance, and only the boundary keeps that position')
  const syncRenamed = syncFromBoundary.ok ? renameInterfacePort(syncBox.project, syncComponentId, syncAddedId, 'renamed') : null
  if (syncRenamed?.ok) syncBox.project = syncRenamed.project
  check(Boolean(syncRenamed?.ok && syncOn(syncChildId, syncBoundaryOf()?.id ?? '', syncAddedId)?.name === 'renamed' && syncOn(syncBox.project.rootDocumentId, syncB, syncAddedId)?.name === 'renamed'), 'renaming a logical port changes the boundary and every instance')
  const syncThird = instantiateComponent(syncBox.project, syncBox.project.rootDocumentId, syncComponentId, { x: 480, y: 80 }, 'Later')
  const syncThirdDoc = syncThird.ok ? documentById(syncThird.project, syncBox.project.rootDocumentId) : null
  const syncThirdPorts = syncThird.ok ? syncThirdDoc?.ports.filter((port) => port.blockId === syncThird.value.blockId) ?? [] : []
  check(Boolean(syncThird.ok && syncThirdPorts.some((port) => port.interfacePortId === syncP2Id) && syncThirdPorts.every((port) => port.interfacePortId) && !syncThirdPorts.some((port) => port.symbolPortId === 'pin_sync_in' || port.symbolPortId === 'pin_sync_out')), 'a later component instance shows only the logical ports')
  const syncBeforeChild = documentById(syncBox.project, syncChildId)
  const syncRemoved = syncHistory.transact((current) => {
    const result = removeInterfacePort(current, syncComponentId, syncP1Id)
    return result.ok ? result.project : current
  })
  syncSessions.discard()
  const syncReopened = documentById(syncBox.project, syncChildId)
  check(syncRemoved && !syncReopened?.ports.some((port) => port.interfacePortId === syncP1Id), 'deleting an added port on the parent removes it from the child that was already open')
  check(syncBeforeChild !== syncReopened, 'reopening reads the updated child document, not the document from before the delete')
  check(!syncSessions.get(syncChildId).canUndo && !syncOn(syncBox.project.rootDocumentId, syncA, syncP1Id) && !syncOn(syncBox.project.rootDocumentId, syncB, syncP1Id), 'both instances lose the deleted port, and the old child session is not reused')
  const syncDown = descend(syncBox.project, rootLocation(syncBox.project), syncA)
  const syncUp = syncDown.kind === 'ok' ? parentLocation(syncBox.project, syncDown.location) : null
  const syncBack = syncUp ? descend(syncBox.project, syncUp, syncA) : null
  const syncSeen = syncBack?.kind === 'ok' ? documentById(syncBox.project, syncBack.location.documentId) : null
  check(Boolean(syncUp?.documentId === syncBox.project.rootDocumentId && syncSeen && !syncSeen.ports.some((port) => port.interfacePortId === syncP1Id) && syncSeen.ports.some((port) => port.name === 'renamed')), 'navigation between open levels shows the current interface')
  const syncLoaded = parseProject(serializeProject(syncBox.project))
  const syncLoadedChild = documentById(syncLoaded, syncChildId)
  const syncLoadedRoot = documentById(syncLoaded, syncLoaded.rootDocumentId)
  const syncLoadedA = syncLoadedRoot?.ports.find((port) => port.blockId === syncA && port.interfacePortId === syncP2Id)
  const syncLoadedBoundary = syncLoadedChild?.blocks.find((block) => block.name === 'Boundary' && !block.componentId)
  const syncLoadedBoundaryPorts = syncLoadedChild?.ports.filter((port) => port.blockId === syncLoadedBoundary?.id) ?? []
  check(Boolean(syncLoadedBoundary && !syncLoadedBoundaryPorts.some((port) => port.interfacePortId === syncP1Id || port.interfacePortId === syncInId) && syncLoadedBoundaryPorts.some((port) => port.name === 'renamed') && syncLoadedA?.placed && syncLoadedA.t === 0.8), 'save and load keep the synchronized interface and the graphic position')
  syncHistory.undo()
  check(Boolean(documentById(syncBox.project, syncChildId)?.ports.some((port) => port.interfacePortId === syncP1Id) && syncOn(syncBox.project.rootDocumentId, syncB, syncP1Id)), 'project undo restores the deleted port on the boundary and the other instance')
  syncHistory.redo()
  check(!documentById(syncBox.project, syncChildId)?.ports.some((port) => port.interfacePortId === syncP1Id), 'project redo removes that port again')
  const syncRefusedAfter = syncHistory.transact((current) => {
    const result = removeInterfacePort(current, syncComponentId, syncHereId)
    return result.ok ? result.project : current
  })
  syncHistory.undo()
  check(Boolean(!syncRefusedAfter && documentById(syncBox.project, syncChildId)?.ports.some((port) => port.interfacePortId === syncP1Id)), 'a refused delete does not become the undo step')
}

const faceProject = createProject('Face')
const faceRoot = documentById(faceProject, faceProject.rootDocumentId)
let faceSymbol = ''
let faceBlock = ''
if (faceRoot) {
  faceSymbol = defineSymbol(faceRoot, {
    name: 'Generic block',
    width: 88,
    height: 64,
    ports: [
      { id: 'pin_face_in', name: 'in', side: 'left', t: 0.5 },
      { id: 'pin_face_out', name: 'out', side: 'right', t: 0.5 },
    ],
  }) ?? ''
  faceBlock = instantiateSymbol(faceRoot, faceSymbol, { x: 80, y: 80 }, 'Generic block') ?? ''
  addPortAt(faceRoot, faceBlock, 'top', 0.3)
  addPortAt(faceRoot, faceBlock, 'bottom', 0.4)
  addPortAt(faceRoot, faceBlock, 'left', 0.2)
  renameInstancePort(faceRoot, faceRoot.ports.find((port) => port.blockId === faceBlock && !port.symbolPortId && port.side === 'top')?.id ?? '', 'clk')
  renameInstancePort(faceRoot, faceRoot.ports.find((port) => port.blockId === faceBlock && !port.symbolPortId && port.side === 'bottom')?.id ?? '', 'data')
  renameInstancePort(faceRoot, faceRoot.ports.find((port) => port.blockId === faceBlock && !port.symbolPortId && port.side === 'left')?.id ?? '', 'en')
}
const faceOpened = openAsDiagram(faceProject, faceProject.rootDocumentId, faceBlock)
const faceBox = { project: faceOpened.ok ? faceOpened.project : faceProject }
const faceComponentId = faceOpened.ok ? faceOpened.value.componentId : ''
const faceChildId = faceOpened.ok ? faceOpened.value.documentId : ''
const faceBoundary = () => {
  const child = documentById(faceBox.project, faceChildId)
  return child?.blocks.find((block) => block.name === 'Boundary' && !block.componentId) ?? null
}
const facePortsOn = (documentId: string, blockId: string) =>
  documentById(faceBox.project, documentId)?.ports.filter((port) => port.blockId === blockId) ?? []
if (faceOpened.ok) {
  const faceChild = documentById(faceBox.project, faceChildId)
  const faceBoundaryPorts = facePortsOn(faceChildId, faceBoundary()?.id ?? '')
  const faceSides = new Set(faceBoundaryPorts.map((port) => port.side))
  check(
    Boolean(
      faceBoundary() &&
        ['in', 'out', 'clk', 'data', 'en'].every((name) => faceBoundaryPorts.some((port) => port.name === name && port.interfacePortId)) &&
        ['left', 'right', 'top', 'bottom'].every((side) => faceSides.has(side as 'left' | 'right' | 'top' | 'bottom')),
    ),
    'open as puts named ports on every side of the boundary',
  )
  check(
    faceBoundaryPorts.every((port) => logicalPortName(faceBox.project, port) === port.name),
    'boundary labels take the logical interface names',
  )
  const faceMoved = faceBoundaryPorts.find((port) => port.name === 'clk')
  if (faceChild && faceMoved) placePort(faceChild, faceMoved.id, 'right', 0.15)
  check(Boolean(facePortsOn(faceChildId, faceBoundary()?.id ?? '').find((port) => port.id === faceMoved?.id)?.placed && facePortsOn(faceChildId, faceBoundary()?.id ?? '').find((port) => port.id === faceMoved?.id)?.side === 'right'), 'a boundary port can move without changing the parent instance')
  setBlockFields(faceChild!, faceBoundary()!.id, { width: 200, height: 120 })
  const faceAfterResize = facePortsOn(faceChildId, faceBoundary()?.id ?? '')
  check(
    Boolean(
      faceAfterResize.find((port) => port.id === faceMoved?.id)?.side === 'right' &&
        faceAfterResize.find((port) => port.id === faceMoved?.id)?.t === 0.15 &&
        documentById(faceBox.project, faceChildId)?.blocks.find((block) => block.id === faceBoundary()?.id)?.width === 200,
    ),
    'resizing the boundary keeps each port side and fraction',
  )
  const faceRenameFromParent = renameInterfacePort(faceBox.project, faceComponentId, faceBoundaryPorts.find((port) => port.name === 'data')?.interfacePortId ?? '', 'payload')
  if (faceRenameFromParent.ok) faceBox.project = faceRenameFromParent.project
  check(
    Boolean(
      faceRenameFromParent.ok &&
        facePortsOn(faceChildId, faceBoundary()?.id ?? '').some((port) => port.name === 'payload') &&
        facePortsOn(faceBox.project.rootDocumentId, faceBlock).some((port) => port.name === 'payload') &&
        logicalPortName(faceBox.project, facePortsOn(faceChildId, faceBoundary()?.id ?? '').find((port) => port.name === 'payload')!) === 'payload',
    ),
    'renaming on the parent updates the boundary label',
  )
  const faceBoundaryEn = facePortsOn(faceChildId, faceBoundary()?.id ?? '').find((port) => port.name === 'en')
  const faceRenameFromBoundary = faceBoundaryEn
    ? renameInterfacePort(faceBox.project, faceComponentId, faceBoundaryEn.interfacePortId ?? '', 'enable')
    : null
  if (faceRenameFromBoundary?.ok) faceBox.project = faceRenameFromBoundary.project
  check(
    Boolean(
      faceRenameFromBoundary?.ok &&
        facePortsOn(faceBox.project.rootDocumentId, faceBlock).some((port) => port.name === 'enable') &&
        facePortsOn(faceChildId, faceBoundary()?.id ?? '').some((port) => port.name === 'enable'),
    ),
    'renaming on the boundary updates every instance',
  )
  const faceAdded = addInterfacePort(faceBox.project, faceComponentId, 'flag', 'top', {
    documentId: faceChildId,
    blockId: faceBoundary()?.id ?? '',
    t: 0.7,
  })
  if (faceAdded.ok) faceBox.project = faceAdded.project
  check(
    Boolean(
      faceAdded.ok &&
        facePortsOn(faceChildId, faceBoundary()?.id ?? '').some((port) => port.interfacePortId === faceAdded.value.interfacePortId && port.name === 'flag') &&
        facePortsOn(faceBox.project.rootDocumentId, faceBlock).some((port) => port.interfacePortId === faceAdded.value.interfacePortId && port.name === 'flag'),
    ),
    'adding a logical port creates the label on the boundary and the instance',
  )
  const faceInId = componentById(faceBox.project, faceComponentId)?.ports.find((port) => port.name === 'in')?.id ?? ''
  const faceRemovedIn = removeInterfacePort(faceBox.project, faceComponentId, faceInId)
  if (faceRemovedIn.ok) faceBox.project = faceRemovedIn.project
  check(
    Boolean(
      faceRemovedIn.ok &&
        !facePortsOn(faceChildId, faceBoundary()?.id ?? '').some((port) => port.interfacePortId === faceInId) &&
        !facePortsOn(faceBox.project.rootDocumentId, faceBlock).some((port) => port.interfacePortId === faceInId),
    ),
    'deleting a logical port removes its boundary label',
  )
  const faceSecond = instantiateComponent(faceBox.project, faceBox.project.rootDocumentId, faceComponentId, { x: 280, y: 80 }, 'Second')
  const faceSecondId = faceSecond.ok ? faceSecond.value.blockId : ''
  const faceSecondPorts = faceSecond.ok
    ? documentById(faceSecond.project, faceBox.project.rootDocumentId)?.ports.filter((port) => port.blockId === faceSecondId) ?? []
    : []
  check(
    Boolean(
      faceSecond.ok &&
        faceSecondPorts.every((port) => port.interfacePortId) &&
        !faceSecondPorts.some((port) => port.symbolPortId === 'pin_face_in') &&
        faceSecondPorts.some((port) => port.name === 'out' && port.symbolPortId === 'pin_face_out') &&
        faceSecondPorts.some((port) => port.name === 'flag'),
    ),
    'a new component instance shows only the remaining logical ports',
  )
  if (faceSecond.ok) faceBox.project = faceSecond.project
  const faceGeneric = documentById(faceBox.project, faceBox.project.rootDocumentId)
  const facePlain = faceGeneric ? instantiateSymbol(faceGeneric, faceSymbol, { x: 480, y: 80 }, 'Plain') : null
  const facePlainPorts = facePlain ? faceGeneric?.ports.filter((port) => port.blockId === facePlain) ?? [] : []
  check(
    Boolean(facePlain && facePlainPorts.some((port) => port.symbolPortId === 'pin_face_in') && facePlainPorts.some((port) => port.symbolPortId === 'pin_face_out') && !faceGeneric?.blocks.find((block) => block.id === facePlain)?.componentId),
    'a plain generic block of the same symbol still has the original symbol pins',
  )
  check(
    documentById(faceBox.project, faceBox.project.rootDocumentId)?.symbols.find((symbol) => symbol.id === faceSymbol)?.ports.some((pin) => pin.id === 'pin_face_in') === true,
    'deleting a logical port does not change the symbol definition',
  )
  const faceDupMap = duplicateBlocks(documentById(faceBox.project, faceBox.project.rootDocumentId)!, [faceSecondId], 40, 40)
  const faceDupId = faceDupMap.get(faceSecondId) ?? ''
  const faceDupPorts = documentById(faceBox.project, faceBox.project.rootDocumentId)?.ports.filter((port) => port.blockId === faceDupId) ?? []
  check(
    Boolean(faceDupId && faceDupPorts.every((port) => port.interfacePortId) && !faceDupPorts.some((port) => port.symbolPortId === 'pin_face_in')),
    'duplicating a component instance does not restore a deleted logical pin',
  )
  const faceUnique = makeUnique(faceBox.project, faceBox.project.rootDocumentId, faceSecondId)
  const faceUniquePorts = faceUnique.ok
    ? documentById(faceUnique.project, faceBox.project.rootDocumentId)?.ports.filter((port) => port.blockId === faceSecondId) ?? []
    : []
  check(
    Boolean(faceUnique.ok && faceUniquePorts.every((port) => port.interfacePortId) && !faceUniquePorts.some((port) => port.symbolPortId === 'pin_face_in')),
    'make unique keeps only the logical ports of that instance',
  )
  if (faceUnique.ok) faceBox.project = faceUnique.project
  const faceHistory = new ProjectSession(
    () => faceBox.project,
    (next) => {
      faceBox.project = next
    },
  )
  const faceFlagId = componentById(faceBox.project, faceComponentId)?.ports.find((port) => port.name === 'flag')?.id ?? ''
  faceHistory.transact((current) => {
    const result = removeInterfacePort(current, faceComponentId, faceFlagId)
    return result.ok ? result.project : current
  })
  check(!facePortsOn(faceChildId, faceBoundary()?.id ?? '').some((port) => port.interfacePortId === faceFlagId), 'project undo target lost the flag port')
  faceHistory.undo()
  check(facePortsOn(faceChildId, faceBoundary()?.id ?? '').some((port) => port.interfacePortId === faceFlagId && port.name === 'flag'), 'project undo restores the boundary label')
  faceHistory.redo()
  check(!facePortsOn(faceChildId, faceBoundary()?.id ?? '').some((port) => port.interfacePortId === faceFlagId), 'project redo removes the boundary label again')
  const faceWireMate = documentById(faceBox.project, faceBox.project.rootDocumentId)
  const faceWireBlock = faceWireMate ? placeTemplate(faceWireMate, BLOCK_TEMPLATES[0], false) : ''
  const faceWirePort = faceWireMate && faceWireBlock ? addPortAt(faceWireMate, faceWireBlock, 'left', 0.5) : null
  const faceOutPort = facePortsOn(faceBox.project.rootDocumentId, faceBlock).find((port) => port.name === 'out')
  const faceWire = faceWireMate && faceOutPort && faceWirePort ? linkPorts(faceWireMate, faceOutPort.id, faceWirePort, 'out') : null
  const faceLoaded = parseProject(serializeProject(faceBox.project))
  const faceLoadedChild = documentById(faceLoaded, faceChildId)
  const faceLoadedBoundary = faceLoadedChild?.blocks.find((block) => block.name === 'Boundary' && !block.componentId)
  const faceLoadedRoot = documentById(faceLoaded, faceLoaded.rootDocumentId)
  check(
    Boolean(
      faceWire &&
        faceLoadedRoot?.segments.some((segment) => segment.id === faceWire) &&
        faceLoadedBoundary &&
        faceLoadedChild?.ports.some((port) => port.blockId === faceLoadedBoundary.id && port.name === 'payload') &&
        !faceLoadedChild?.ports.some((port) => port.blockId === faceLoadedBoundary.id && port.name === 'in') &&
        faceLoadedRoot?.ports.filter((port) => port.blockId === faceSecondId).every((port) => port.interfacePortId),
    ),
    'save and load keep boundary labels, omit deleted ports, and keep existing wires',
  )
}

if (failures.length) {
  throw new Error(failures.join('\n'))
}
console.log('selfcheck ok')
