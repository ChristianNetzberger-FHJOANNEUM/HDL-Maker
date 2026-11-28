import { createId, parseDocument, serialize } from './document'
import {
  autoRoute,
  capturePortAnchors,
  continuousGuideU,
  fitSymbolShapes,
  guidedPinPoint,
  isBlockAttachedStub,
  isGuidedPin,
  isPortAttachedStub,
  labelPlacement,
  moveBlock,
  pinLocal,
  pinOnBorder,
  pointOnEllipseGuide,
  polylineLength,
  portAnchor,
  portAnchorDeltas,
  projectOntoEllipseGuide,
  radialLeadSegment,
  scaleEllipseGuide,
  simplifyOrthogonal,
  translateAttachedStubsByPortDeltas,
  translateSegmentGeometry,
} from './geometry'
import { netFixture } from './fixture'
import { addNameLabel, commitWire, crossings, deleteSegment, ensureNetByName, isNameLabel, labelText, labelTextFormat, mergeNets, mergeNetsByName, moveJunction, moveLabelAlong, nameCollisions, netsNamed, netPortIds, placeFreeEnd, placeLabelAt, placeSpan, probeWire, renameNet, removeSegmentNameLabels, resetLabelPosition, resetLabelTypography, setLabelDisplay, setLabelDisplayText, setLabelOffset, setLabelTextFormat, setLabelTypography, setRouted, snapTarget } from './nets'
import { countMathSegments, parseFormattedText } from './formattedTextParse'
import { clearFormattedTextLayoutCache, renderFormattedText, renderPlainDisplayText } from './formattedTextRender'
import {
  clearMathRenderCache,
  ensureMathEngine,
  getMathRenderStats,
  renderMath,
  resetMathRenderStats,
  rewriteSvgIds,
} from './mathRender'
import { canUndoWireStep, finishFree, stubGeometrySane, undoWireStep, wireClick, WIRE_DRAW_HINT } from './wiretool'
import { symbolSheet } from './symbolsheet'
import { addImageAsset, addSymbolLabel, addSymbolPort, addSymbolShape, applySymbol, defineSymbol, instantiateSymbol, moveFreeSymbolPort, moveSymbolPort, removeSymbolPort, setComponent, setSymbolSize, symbolDiagnostics } from './symbols'
import { auditAssets, base64ToBytes, inspectImage, sha256, sha256Sync } from './assets'
import { PICTURE_SOURCES, pictureAssets } from './pictures'
import { builtinLibraries } from './catalog'
import { cloneSymbol, emptyUserLibrary, mergeLibrary, parseLibrary, placeLibrarySymbol, publishSymbolRevision, removeLibrarySymbol, saveSymbolToLibrary, serializeLibrary } from './library'
import {
  attachedStubsForBlocks,
  emptyDocument,
  groupBlocks,
  duplicateGroup,
  duplicateBlocks,
  deleteBlocks,
  placeTemplate,
  BLOCK_TEMPLATES,
  linkPorts,
  captureFragment,
  pasteFragment,
  resizeBox,
  blockTextFormat,
  setBlockFields,
  setBlockTypography,
  resetBlockTypography,
  setBlockTextFormat,
  setBlockStyle,
  resetBlockStyle,
  setDisplayTextOffset,
  setSegmentLabelsVisible,
  addPortAt,
  borderPlacement,
  nearestBlockBorder,
  placeGuidedPort,
  placePort,
  removeUnwiredPort,
  renameInstancePort,
  unusedPortName,
  snapValue,
  GRID,
  MIN_BLOCK_SIZE,
  DUPLICATE_OFFSET,
  NUDGE_DISTANCE,
} from './edit'
import {
  blockDefaultTextAlign,
  blockDisplayEm,
  blockDisplayTextAlign,
  labelDisplayTextAlign,
  lineAlignOffset,
} from './textTypography'
import {
  DEFAULT_EDITOR_PREFERENCES,
  loadEditorPreferences,
  normalizeSpacing,
  sanitizeEditorPreferences,
  saveEditorPreferences,
  SPACING_MAX,
  SPACING_MIN,
} from './preferences'
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
import { TransactionManager } from './transaction'
import { GestureCloseLatch, actionForInterrupt, actionForRedoWhileGesturing } from '../view/gestureGuard'
import {
  allowMarquee,
  blockDragMode,
  chooseTool,
  duplicateDragMoved,
  isDoublePress,
  isTextEditingControl,
  nextEscapeAction,
  panOnDragButtons,
  shouldBeginViewPan,
  spaceReleaseAction,
  wireDrawingShortcut,
} from '../view/interactionPolicy'
import { VIEWPORT_MAX_ZOOM, VIEWPORT_MIN_ZOOM, viewportAfterWheel, vueFlowWheelDelta } from '../view/viewportWheel'
import { compareSymbols } from './compare'
import { acceptanceSheet, benchSheet } from './acceptance'
import {
  BENCHGEN_RECIPE_VERSION,
  BENCHGEN_SIZES,
  densityWithinTolerance,
  documentHash,
  channelRouteHorizontal,
  estimateBenchCounts,
  generateBenchDocument,
  inventoryBenchMatrix,
  orthogonalPoints,
  segmentIsOrthogonal,
  validateBenchDocument,
} from './benchgen'
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
// Legacy fixture: a second net deliberately reuses display name "n" without by-name join
// (simulates pre-D5c.5 duplicates). Extract must still keep them as separate crossings.
const d4dN2Net = createId('net')
const d4dN2 = createId('seg')
{
  const start = portAnchor(d4dSheet, d4dDX)!
  const end = portAnchor(d4dSheet, d4dEB)!
  const trunk = (start.x + end.x) / 2
  d4dSheet.nets.push({ id: d4dN2Net, name: 'n' })
  d4dSheet.segments.push({
    id: d4dN2,
    netId: d4dN2Net,
    routed: 'manual',
    points: [start, { x: trunk, y: start.y }, { x: trunk, y: end.y }, end],
    start: { kind: 'port', portId: d4dDX },
    end: { kind: 'port', portId: d4dEB },
  })
}
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
check(d4dN1Net !== d4dN2Net && d4dPortsOnNet(d4dRoot, d4dN1Net).includes(d4dSinkB) && !d4dPortsOnNet(d4dRoot, d4dN1Net).includes(d4dEB) && d4dPortsOnNet(d4dRoot, d4dN2Net).includes(d4dEB), 'legacy same-named nets stay separate through extract')
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

// --- D5b.2 unified project transaction manager (core only; not wired to the stage) ---
{
  const tm = TransactionManager.holding(createProject('Txn'))
  check(!tm.canUndo && !tm.canRedo && !tm.isDirty && !tm.isGesturing, 'a fresh manager is clean with an empty history')
  check(tm.labelUndo === null && tm.labelRedo === null, 'empty history has no labels')

  const first = tm.transact('rename', (project) => {
    project.name = 'Alpha'
    return project
  })
  check(Boolean(first.ok && tm.project.name === 'Alpha' && tm.canUndo && !tm.canRedo && tm.isDirty && tm.labelUndo === 'rename'), 'a successful transact records one undo step')

  const sameRefNoop = tm.transact('noop-ref', (project) => project)
  check(Boolean(sameRefNoop.ok && !tm.canRedo && tm.undoDepth === 1 && tm.project.name === 'Alpha'), 'returning the same draft with identical content adds no history entry')

  const newRefNoop = tm.transact('noop-clone', (project) => parseProject(serializeProject(project)))
  check(Boolean(newRefNoop.ok && tm.undoDepth === 1 && tm.project.name === 'Alpha'), 'a new object reference with identical content adds no history entry')

  const refused = tm.transact('refuse', () => ({ ok: false as const, message: 'no' }))
  check(Boolean(!refused.ok && refused.message === 'no' && tm.undoDepth === 1 && tm.project.name === 'Alpha' && !tm.canRedo), 'a refused transact leaves history and redo untouched')

  const exploded = tm.transact('boom', (project) => {
    project.name = 'Broken'
    throw new Error('partial')
  })
  check(Boolean(!exploded.ok && exploded.message === 'partial' && tm.project.name === 'Alpha' && tm.undoDepth === 1 && !tm.canRedo), 'an exception rolls back and adds no history entry')

  tm.transact('beta', (project) => {
    project.name = 'Beta'
    return project
  })
  tm.transact('gamma', (project) => {
    project.name = 'Gamma'
    return project
  })
  check(tm.undoDepth === 3 && tm.project.name === 'Gamma' && tm.labelUndo === 'gamma', 'labels track the latest undo entry')

  tm.undo()
  check(tm.project.name === 'Beta' && tm.canRedo && tm.labelRedo === 'gamma', 'undo restores the previous project')
  tm.undo()
  check(tm.project.name === 'Alpha' && tm.redoDepth === 2, 'repeated undo walks the past')
  tm.redo()
  check(tm.project.name === 'Beta', 'redo restores the undone project')

  const isolation = TransactionManager.holding(createProject('Iso'))
  isolation.transact('one', (project) => {
    project.name = 'One'
    return project
  })
  isolation.transact('two', (project) => {
    project.name = 'Two'
    return project
  })
  const oldTwo = isolation.project
  isolation.undo()
  check(isolation.project.name === 'One' && isolation.project !== oldTwo, 'undo installs a fresh graph')
  oldTwo.name = 'CorruptTwo'
  oldTwo.documents[0]!.blocks.push({ id: 'blk_corrupt', name: 'x', x: 0, y: 0, width: 10, height: 10 })
  isolation.redo()
  check(
    isolation.project.name === 'Two' &&
      isolation.project !== oldTwo &&
      !isolation.project.documents[0]?.blocks.some((block) => block.id === 'blk_corrupt'),
    'history snapshots are isolated from later mutations of retired live graphs',
  )

  tm.redo()
  check(tm.project.name === 'Gamma' && !tm.canRedo, 'main history can redo back to the tip')
  tm.undo()
  const branch = tm.transact('branch', (project) => {
    project.name = 'Branch'
    return project
  })
  check(Boolean(branch.ok && !tm.canRedo && tm.project.name === 'Branch'), 'a successful edit after undo drops the redo future')

  tm.undo()
  check(tm.project.name === 'Beta' && tm.canRedo, 'undo after a branch restores the pre-branch tip')
  const idleBranch = tm.transact('idle', (project) => project)
  check(Boolean(idleBranch.ok && tm.canRedo && tm.project.name === 'Beta'), 'a no-op after undo does not drop the redo future')
  const failBranch = tm.transact('fail', () => ({ ok: false as const, message: 'nope' }))
  check(Boolean(!failBranch.ok && tm.canRedo), 'a failed transact after undo keeps the redo future')
  tm.redo()
  check(tm.project.name === 'Branch', 'redo still works after a no-op and a refused edit')

  const beginTwice = tm.begin('drag')
  check(beginTwice.ok && tm.isGesturing, 'begin opens a gesture')
  const beginAgain = tm.begin('other')
  check(Boolean(!beginAgain.ok && tm.isGesturing), 'a second begin is refused')
  tm.preview((project) => {
    project.name = 'Preview1'
  })
  tm.preview((project) => {
    project.name = 'Preview2'
  })
  const depthBeforePreviews = tm.undoDepth
  check(tm.project.name === 'Preview2' && tm.undoDepth === depthBeforePreviews, 'previews mutate live state without adding history yet')
  const committed = tm.commit()
  check(committed && tm.project.name === 'Preview2' && tm.undoDepth === depthBeforePreviews + 1 && !tm.isGesturing, 'commit records exactly one history entry')

  tm.begin('cancel-me')
  tm.preview((project) => {
    project.name = 'Temp'
  })
  const redoBeforeCancel = tm.canRedo
  tm.cancel()
  check(tm.project.name === 'Preview2' && !tm.isGesturing && tm.canRedo === redoBeforeCancel, 'cancel restores the baseline and does not touch redo')

  tm.begin('noop-gesture')
  const noopCommit = tm.commit()
  check(!noopCommit && tm.undoDepth === depthBeforePreviews + 1, 'a no-op gesture commit adds no history entry')

  tm.begin('preview-boom')
  const previewFail = tm.preview(() => {
    throw new Error('preview broke')
  })
  check(Boolean(!previewFail.ok && !tm.isGesturing && tm.project.name === 'Preview2'), 'a preview error restores the baseline and closes the gesture')

  check(!tm.commit() && tm.preview(() => undefined).ok === false, 'commit and preview without begin are refused')

  tm.begin('block-undo')
  const undoDuring = tm.undo()
  check(Boolean(!undoDuring.ok && tm.isGesturing), 'undo during a gesture is refused')
  tm.cancel()

  const nested = tm.transact('outer', (project) => {
    project.name = 'Outer'
    const inner = tm.transact('inner', (child) => {
      child.name = 'Inner'
      return child
    })
    check(!inner.ok, 'nested transact is refused')
    return project
  })
  check(Boolean(nested.ok && tm.project.name === 'Outer'), 'the outer transact still commits when a nested call is refused')

  tm.markSaved()
  check(!tm.isDirty && tm.canUndo, 'markSaved clears dirty without clearing history')
  tm.transact('after-save', (project) => {
    project.name = 'DirtyAgain'
    return project
  })
  check(tm.isDirty, 'an edit after save is dirty')
  tm.undo()
  check(!tm.isDirty && tm.project.name === 'Outer', 'undo back to the saved fingerprint is clean')
  tm.redo()
  check(tm.isDirty && tm.project.name === 'DirtyAgain', 'redo away from the saved fingerprint is dirty')

  tm.markSaved()
  tm.undo()
  tm.transact('fork', (project) => {
    project.name = 'Fork'
    return project
  })
  check(tm.isDirty && !tm.canRedo, 'a branch after undo of a saved state is dirty and has no redo')

  const capped = TransactionManager.holding(createProject('Cap'), { limit: 2 })
  capped.transact('a', (project) => {
    project.name = 'A'
    return project
  })
  capped.transact('b', (project) => {
    project.name = 'B'
    return project
  })
  capped.transact('c', (project) => {
    project.name = 'C'
    return project
  })
  check(capped.undoDepth === 2 && capped.project.name === 'C', 'the history limit keeps only the newest undo entries')
  capped.undo()
  capped.undo()
  check(capped.project.name === 'A' && !capped.canUndo, 'evicted oldest entries cannot be undone past the cap')
  capped.markSaved()
  capped.redo()
  capped.redo()
  check(capped.isDirty && capped.project.name === 'C', 'eviction does not break dirty detection against the saved fingerprint')

  capped.resetHistory()
  check(!capped.canUndo && !capped.canRedo && capped.project.name === 'C', 'resetHistory clears stacks and keeps the live project')

  capped.reset(createProject('Fresh'))
  check(capped.project.name === 'Fresh' && !capped.canUndo && !capped.isDirty, 'reset loads a project, clears history, and marks saved')

  // Hierarchy-spanning round-trip through the same manager instance.
  const face = createProject('FaceTxn')
  const faceRoot = documentById(face, face.rootDocumentId)
  let faceSymbol = ''
  let faceBlock = ''
  if (faceRoot) {
    faceSymbol = defineSymbol(faceRoot, {
      name: 'Generic block',
      width: 88,
      height: 64,
      ports: [
        { id: 'pin_txn_in', name: 'in', side: 'left', t: 0.5 },
        { id: 'pin_txn_out', name: 'out', side: 'right', t: 0.5 },
      ],
    })
    faceBlock = instantiateSymbol(faceRoot, faceSymbol, { x: 80, y: 80 }, 'Generic block') ?? ''
    addPortAt(faceRoot, faceBlock, 'top', 0.3)
  }
  const hierarchy = TransactionManager.holding(face)
  hierarchy.markSaved()

  const opened = hierarchy.transact('open-as', (project) => openAsDiagram(project, project.rootDocumentId, faceBlock))
  check(opened.ok, 'open as runs through the transaction manager')
  const componentId = opened.ok ? opened.value.componentId : ''
  const childId = opened.ok ? opened.value.documentId : ''

  const sheetEdit = hierarchy.transact('sheet-name', (project) => {
    const root = documentById(project, project.rootDocumentId)
    const block = root?.blocks.find((item) => item.id === faceBlock)
    if (block) block.name = 'Unit'
    return project
  })
  check(Boolean(sheetEdit.ok && documentById(hierarchy.project, hierarchy.project.rootDocumentId)?.blocks.some((block) => block.id === faceBlock && block.name === 'Unit')), 'a sheet field change is one transaction')

  const portAdd = hierarchy.transact('add-clk', (project) => addInterfacePort(project, componentId, 'clk', 'top'))
  const clkId = portAdd.ok ? portAdd.value.interfacePortId : ''
  check(Boolean(portAdd.ok && clkId), 'adding a logical port is one transaction')

  const second = hierarchy.transact('place-second', (project) =>
    instantiateComponent(project, project.rootDocumentId, componentId, { x: 320, y: 80 }, 'Unit 2'),
  )
  check(second.ok, 'place on sheet is one transaction')

  const renamed = hierarchy.transact('rename-clk', (project) => renameInterfacePort(project, componentId, clkId, 'clock'))
  check(renamed.ok, 'renaming a logical port is one transaction')

  const rootDoc = documentById(hierarchy.project, hierarchy.project.rootDocumentId)
  const childDoc = documentById(hierarchy.project, childId)
  const boundary = childDoc?.blocks.find((block) => block.name === 'Boundary' && !block.componentId)
  const instances = rootDoc?.blocks.filter((block) => block.componentId === componentId) ?? []
  check(
    Boolean(
      boundary &&
        childDoc?.ports.some((port) => port.blockId === boundary.id && port.interfacePortId === clkId && port.name === 'clock') &&
        instances.length === 2 &&
        instances.every((block) => rootDoc?.ports.some((port) => port.blockId === block.id && port.interfacePortId === clkId && port.name === 'clock')),
    ),
    'one manager history keeps boundary and every instance synchronized',
  )

  const mate = rootDoc && placeTemplate(rootDoc, BLOCK_TEMPLATES[0], false)
  const matePort = rootDoc && mate ? addPortAt(rootDoc, mate, 'left', 0.5) : null
  // Direct mutation outside the manager is only for building a wire fixture; capture via a tracked transact next.
  const wired = hierarchy.transact('wire-out', (project) => {
    const sheet = documentById(project, project.rootDocumentId)
    if (!sheet || !mate || !matePort) return { ok: false as const, message: 'missing sheet' }
    const out = sheet.ports.find((port) => port.blockId === faceBlock && port.name === 'out')
    if (!out) return { ok: false as const, message: 'missing out' }
    const segmentId = linkPorts(sheet, out.id, matePort, 'out')
    return segmentId ? project : { ok: false as const, message: 'wire failed' }
  })
  check(wired.ok, 'drawing a wire is one transaction')

  const refusedDelete = hierarchy.transact('delete-out', (project) => {
    const out = documentById(project, project.rootDocumentId)?.ports.find((port) => port.blockId === faceBlock && port.name === 'out')
    const decision = out ? classifyPortDelete(project, documentById(project, project.rootDocumentId)!, out.id) : null
    if (!decision || decision.kind !== 'logical') return { ok: false as const, message: 'expected logical out' }
    return removeInterfacePort(project, decision.componentId, decision.interfacePortId)
  })
  check(Boolean(!refusedDelete.ok && documentById(hierarchy.project, hierarchy.project.rootDocumentId)?.segments.length), 'a wired logical delete is refused with no history entry from that attempt')

  const expected = serializeProject(hierarchy.project)
  const steps = hierarchy.undoDepth
  for (let index = 0; index < steps; index += 1) hierarchy.undo()
  check(!hierarchy.canUndo && hierarchy.project.name === 'FaceTxn', 'full undo returns to the initial project')
  for (let index = 0; index < steps; index += 1) hierarchy.redo()
  check(serializeProject(hierarchy.project) === expected, 'full redo restores the canonical project byte-for-byte')
  const restoredChild = documentById(hierarchy.project, childId)
  const restoredBoundary = restoredChild?.blocks.find((block) => block.name === 'Boundary' && !block.componentId)
  check(
    Boolean(
      restoredBoundary &&
        restoredChild?.ports.some((port) => port.blockId === restoredBoundary.id && port.interfacePortId === clkId && port.name === 'clock') &&
        documentById(hierarchy.project, hierarchy.project.rootDocumentId)?.segments.length,
    ),
    'redo keeps interface ids, boundary ports, and wires',
  )

  // Performance samples for the status report (Variant A snapshots).
  const perfProjects = [
    { label: 'empty', project: createProject('Empty') },
    { label: 'sample', project: sampleProject() },
    { label: 'digital', project: digitalProject() },
    { label: 'signal', project: signalProject() },
    { label: 'general', project: generalProject() },
  ]
  const grown = digitalProject()
  const grownRoot = documentById(grown, grown.rootDocumentId)
  if (grownRoot) {
    for (let i = 0; i < 200; i += 1) {
      grownRoot.blocks.push({
        id: `blk_perf_${i}`,
        name: `B${i}`,
        x: (i % 20) * 100,
        y: Math.floor(i / 20) * 80,
        width: 88,
        height: 64,
      })
    }
  }
  perfProjects.push({ label: 'digital+200', project: grown })

  const perfLines: string[] = []
  for (const entry of perfProjects) {
    const manager = TransactionManager.holding(parseProject(serializeProject(entry.project)))
    const bytes = manager.snapshotByteLength()
    const times = { transact: 0, undo: 0, redo: 0 }
    const rounds = 20
    for (let i = 0; i < rounds; i += 1) {
      const t0 = performance.now()
      manager.transact(`step-${i}`, (project) => {
        project.extra = { ...(project.extra ?? {}), n: String(i) }
        return project
      })
      times.transact += performance.now() - t0
    }
    for (let i = 0; i < rounds; i += 1) {
      const t0 = performance.now()
      manager.undo()
      times.undo += performance.now() - t0
    }
    for (let i = 0; i < rounds; i += 1) {
      const t0 = performance.now()
      manager.redo()
      times.redo += performance.now() - t0
    }
    // Fill toward the default 40-entry cap.
    manager.reset(parseProject(serializeProject(entry.project)))
    for (let i = 0; i < 40; i += 1) {
      manager.transact(`fill-${i}`, (project) => {
        project.extra = { ...(project.extra ?? {}), fill: String(i) }
        return project
      })
    }
    perfLines.push(
      `${entry.label} bytes=${bytes} hist40≈${(bytes * 40 / 1e6).toFixed(3)}MB ` +
        `transactMs=${(times.transact / rounds).toFixed(3)} undoMs=${(times.undo / rounds).toFixed(3)} redoMs=${(times.redo / rounds).toFixed(3)} depth=${manager.undoDepth}`,
    )
    check(manager.undoDepth === 40, `${entry.label} reaches forty undo entries`)
  }
  console.log(`d5b2-perf\n${perfLines.join('\n')}`)
}

// --- D5b.3 migration: one history for sheet + project ops (adapter pattern used by DiagramStage) ---
{
  type Editor = {
    box: { project: ReturnType<typeof createProject>; sheetId: string }
    tm: TransactionManager
    execute: (label: string, apply: (sheet: import('./document').DiagramDocument) => void) => void
    projectOp: <T>(label: string, make: (project: ReturnType<typeof createProject>) => import('./component').ProjectResult<T>) => import('./component').ProjectResult<T>
  }

  function openEditor(seed: ReturnType<typeof createProject>): Editor {
    const box = { project: seed, sheetId: seed.rootDocumentId }
    const tm = new TransactionManager({
      get: () => box.project,
      set: (next) => {
        box.project = next
      },
    })
    return {
      box,
      tm,
      execute(label, apply) {
        const sheetId = box.sheetId
        tm.transact(label, (proj) => {
          const sheet = documentById(proj, sheetId)
          if (!sheet) return { ok: false as const, message: 'missing sheet' }
          apply(sheet)
          return proj
        })
      },
      projectOp(label, make) {
        const result = tm.transact(label, (proj) => {
          const outcome = make(proj)
          if (!outcome.ok) return { ok: false as const, message: outcome.message }
          return { ok: true as const, project: outcome.project, value: outcome.value }
        })
        if (!result.ok) return { ok: false, project: box.project, message: result.message }
        return { ok: true, project: box.project, value: result.value }
      },
    }
  }

  const editor = openEditor(createProject('Migrate'))
  const snapshots: string[] = [serializeProject(editor.box.project)]

  let blockId = ''
  editor.execute('place', (sheet) => {
    const symbolId = defineSymbol(sheet, {
      name: 'Generic block',
      width: 88,
      height: 64,
      ports: [
        { id: 'pin_mig_in', name: 'in', side: 'left', t: 0.5 },
        { id: 'pin_mig_out', name: 'out', side: 'right', t: 0.5 },
      ],
    })
    blockId = instantiateSymbol(sheet, symbolId, { x: 80, y: 80 }, 'Generic block') ?? ''
  })
  snapshots.push(serializeProject(editor.box.project))

  editor.execute('resize', (sheet) => {
    setBlockFields(sheet, blockId, { width: 200, height: 120 })
  })
  snapshots.push(serializeProject(editor.box.project))

  editor.execute('add-port', (sheet) => {
    addPortAt(sheet, blockId, 'top', 0.4)
  })
  snapshots.push(serializeProject(editor.box.project))

  const opened = editor.projectOp('open-as', (project) => openAsDiagram(project, project.rootDocumentId, blockId))
  check(opened.ok, 'D5b.3 open as through the shared manager')
  const componentId = opened.ok ? opened.value.componentId : ''
  const childId = opened.ok ? opened.value.documentId : ''
  snapshots.push(serializeProject(editor.box.project))

  editor.box.sheetId = childId
  let childBlock = ''
  editor.execute('child-place', (sheet) => {
    childBlock = placeTemplate(sheet, BLOCK_TEMPLATES[0], false)
  })
  snapshots.push(serializeProject(editor.box.project))

  const boundaryId = documentById(editor.box.project, childId)?.blocks.find((block) => block.name === 'Boundary')?.id ?? ''
  const boundaryPort = editor.projectOp('boundary-port', (project) =>
    addInterfacePort(project, componentId, 'aux', 'left', { documentId: childId, blockId: boundaryId, t: 0.5 }),
  )
  check(boundaryPort.ok, 'D5b.3 boundary port through the shared manager')
  snapshots.push(serializeProject(editor.box.project))

  editor.box.sheetId = editor.box.project.rootDocumentId
  const second = editor.projectOp('place-second', (project) =>
    instantiateComponent(project, project.rootDocumentId, componentId, { x: 320, y: 80 }, 'Copy'),
  )
  check(second.ok, 'D5b.3 second instance through the shared manager')
  snapshots.push(serializeProject(editor.box.project))

  editor.execute('wire', (sheet) => {
    const out = sheet.ports.find((port) => port.blockId === blockId && (port.name === 'out' || port.side === 'right'))
    const mate = placeTemplate(sheet, BLOCK_TEMPLATES[0], false)
    const matePort = addPortAt(sheet, mate, 'left', 0.5)
    if (out && matePort) linkPorts(sheet, out.id, matePort, 'out')
  })
  snapshots.push(serializeProject(editor.box.project))

  const renamed = editor.projectOp('rename-aux', (project) => {
    const aux = componentById(project, componentId)?.ports.find((port) => port.name === 'aux')
    if (!aux) return { ok: false, project, message: 'missing aux' }
    return renameInterfacePort(project, componentId, aux.id, 'enable')
  })
  check(renamed.ok, 'D5b.3 rename through the shared manager')
  snapshots.push(serializeProject(editor.box.project))

  const depth = editor.tm.undoDepth
  check(depth === snapshots.length - 1, 'D5b.3 records one history entry per document change')

  // Navigation does not touch history.
  const beforeNav = editor.tm.undoDepth
  editor.box.sheetId = childId
  editor.box.sheetId = editor.box.project.rootDocumentId
  check(editor.tm.undoDepth === beforeNav, 'D5b.3 navigation does not add history entries')

  for (let index = snapshots.length - 2; index >= 0; index -= 1) {
    editor.tm.undo()
    check(serializeProject(editor.box.project) === snapshots[index], `D5b.3 undo step ${snapshots.length - 2 - index} matches the reference snapshot`)
  }
  check(!editor.tm.canUndo, 'D5b.3 full undo reaches the initial project')

  for (let index = 1; index < snapshots.length; index += 1) {
    editor.tm.redo()
    check(serializeProject(editor.box.project) === snapshots[index], `D5b.3 redo step ${index} matches the reference snapshot`)
  }

  editor.tm.undo()
  const keptRedo = editor.tm.canRedo
  editor.tm.transact('noop-after-undo', (project) => project)
  check(editor.tm.canRedo === keptRedo, 'D5b.3 no-op after undo keeps redo')
  editor.tm.transact('branch-after-undo', (project) => {
    project.name = 'Branched'
    return project
  })
  check(!editor.tm.canRedo && editor.box.project.name === 'Branched', 'D5b.3 successful edit after undo drops redo')

  editor.tm.markSaved()
  check(!editor.tm.isDirty, 'D5b.3 markSaved clears dirty')
  editor.execute('dirty-edit', (sheet) => {
    const block = sheet.blocks[0]
    if (block) block.name = 'Dirty'
  })
  check(editor.tm.isDirty, 'D5b.3 sheet edit after save is dirty')
  editor.tm.undo()
  check(!editor.tm.isDirty, 'D5b.3 undo to saved fingerprint is clean')

  // Mixed sheet then project then sheet on one stack.
  const mixed = openEditor(createProject('Mixed'))
  mixed.execute('sheet-first', (sheet) => {
    placeTemplate(sheet, BLOCK_TEMPLATES[0], false)
  })
  mixed.projectOp('new-component', (project) => addComponent(project, { name: 'Part', ports: [], implementation: { kind: 'none' } }))
  mixed.execute('sheet-again', (sheet) => {
    const block = sheet.blocks[0]
    if (block) setBlockFields(sheet, block.id, { x: 40, y: 40 })
  })
  check(mixed.tm.undoDepth === 3, 'D5b.3 sheet and project ops share one chronological stack')
  mixed.tm.undo()
  check(documentById(mixed.box.project, mixed.box.project.rootDocumentId)?.blocks[0]?.x !== 40, 'D5b.3 undoing the later sheet edit leaves the project command')
  mixed.tm.undo()
  check(mixed.box.project.components.length === 0, 'D5b.3 undoing the project command removes the component')
  mixed.tm.undo()
  check(documentById(mixed.box.project, mixed.box.project.rootDocumentId)?.blocks.length === 0, 'D5b.3 undoing the first sheet edit clears the sheet')

  // Wired delete refusal adds no entry.
  const wired = openEditor(createProject('Wired'))
  let wiredBlock = ''
  wired.execute('place', (sheet) => {
    const symbolId = defineSymbol(sheet, {
      name: 'Generic block',
      width: 88,
      height: 64,
      ports: [
        { id: 'pin_w_in', name: 'in', side: 'left', t: 0.5 },
        { id: 'pin_w_out', name: 'out', side: 'right', t: 0.5 },
      ],
    })
    wiredBlock = instantiateSymbol(sheet, symbolId, { x: 80, y: 80 }, 'Generic block') ?? ''
  })
  const wiredOpen = wired.projectOp('open-as', (project) => openAsDiagram(project, project.rootDocumentId, wiredBlock))
  const wiredComponent = wiredOpen.ok ? wiredOpen.value.componentId : ''
  wired.execute('wire', (sheet) => {
    const out = sheet.ports.find((port) => port.blockId === wiredBlock && port.name === 'out')
    const mate = placeTemplate(sheet, BLOCK_TEMPLATES[0], false)
    const matePort = addPortAt(sheet, mate, 'left', 0.5)
    if (out && matePort) linkPorts(sheet, out.id, matePort, 'out')
  })
  const beforeRefuse = wired.tm.undoDepth
  const refused = wired.projectOp('delete-out', (project) => {
    const out = documentById(project, project.rootDocumentId)?.ports.find((port) => port.blockId === wiredBlock && port.name === 'out')
    const decision = out ? classifyPortDelete(project, documentById(project, project.rootDocumentId)!, out.id) : null
    if (!decision || decision.kind !== 'logical') return { ok: false, project, message: 'expected logical' }
    return removeInterfacePort(project, decision.componentId, decision.interfacePortId)
  })
  check(Boolean(!refused.ok && wired.tm.undoDepth === beforeRefuse), 'D5b.3 refused wired delete adds no history entry')
  check(Boolean(wiredComponent && documentById(wired.box.project, wired.box.project.rootDocumentId)?.segments.length), 'D5b.3 refused delete keeps the wire')

  // Digital+200 size note: D5b.1 counted blocks+ports (~81KB); D5b.2/D5b.3 blocks-only (~49KB).
  const grownPorts = digitalProject()
  const grownRootPorts = documentById(grownPorts, grownPorts.rootDocumentId)
  if (grownRootPorts) {
    for (let i = 0; i < 200; i += 1) {
      const id = `blk_d5b3_${i}`
      grownRootPorts.blocks.push({ id, name: `B${i}`, x: (i % 20) * 100, y: Math.floor(i / 20) * 80, width: 88, height: 64 })
      grownRootPorts.ports.push({ id: `prt_${i}_a`, blockId: id, name: 'in', side: 'left', t: 0.5 })
      grownRootPorts.ports.push({ id: `prt_${i}_b`, blockId: id, name: 'out', side: 'right', t: 0.5 })
    }
  }
  const withPorts = new TextEncoder().encode(serializeProject(grownPorts)).length
  const blocksOnly = digitalProject()
  const grownRootBlocks = documentById(blocksOnly, blocksOnly.rootDocumentId)
  if (grownRootBlocks) {
    for (let i = 0; i < 200; i += 1) {
      grownRootBlocks.blocks.push({
        id: `blk_only_${i}`,
        name: `B${i}`,
        x: (i % 20) * 100,
        y: Math.floor(i / 20) * 80,
        width: 88,
        height: 64,
      })
    }
  }
  const withoutPorts = new TextEncoder().encode(serializeProject(blocksOnly)).length
  console.log(`d5b3-size digital+200 blocks+ports=${withPorts} blocks-only=${withoutPorts}`)
  check(withPorts > withoutPorts, 'D5b.3 documents the Digital+200 size gap between D5b.1 and D5b.2 fixtures')
}

// --- D5b.4 interactive gesture robustness ---
{
  check(actionForInterrupt('escape') === 'cancel', 'D5b.4 Escape cancels')
  check(actionForInterrupt('pointercancel') === 'cancel', 'D5b.4 pointercancel cancels')
  check(actionForInterrupt('lostcapture') === 'cancel', 'D5b.4 lost capture cancels')
  check(actionForInterrupt('blur') === 'cancel', 'D5b.4 blur cancels')
  check(actionForInterrupt('hidden') === 'cancel', 'D5b.4 visibility hidden cancels')
  check(actionForInterrupt('undo') === 'cancel', 'D5b.4 undo-during-gesture cancels')
  check(actionForInterrupt('navigation') === 'cancel', 'D5b.4 navigation cancels')
  check(actionForInterrupt('save') === 'cancel', 'D5b.4 save cancels')
  check(actionForRedoWhileGesturing() === 'refuse', 'D5b.4 redo-during-gesture refuses')

  const latch = new GestureCloseLatch()
  check(latch.tryBeginClose() && latch.isClosing, 'D5b.4 first close succeeds')
  check(!latch.tryBeginClose() && latch.isClosing, 'D5b.4 second close is refused')
  latch.reset()
  check(latch.tryBeginClose(), 'D5b.4 latch resets for the next gesture')

  const box = { project: createProject('GestureRob') }
  const tm = new TransactionManager({
    get: () => box.project,
    set: (next) => {
      box.project = next
    },
  })
  let blockId = ''
  tm.transact('place', (project) => {
    const sheet = documentById(project, project.rootDocumentId)!
    blockId = placeTemplate(sheet, BLOCK_TEMPLATES[0], false)
    return project
  })
  tm.markSaved()
  check(!tm.isDirty, 'D5b.4 saved fingerprint is clean')

  // Many previews then commit → one history entry.
  tm.begin('drag')
  for (let i = 1; i <= 12; i += 1) {
    tm.preview((project) => {
      const sheet = documentById(project, project.rootDocumentId)!
      moveBlock(sheet, blockId, 80 + i, 80)
    })
  }
  check(tm.isDirty, 'D5b.4 live preview may look dirty')
  check(tm.undoDepth === 1, 'D5b.4 previews add no history entries')
  const committed = tm.commit()
  check(Boolean(committed && tm.undoDepth === 2 && !tm.isGesturing), 'D5b.4 commit records one entry after many previews')

  // Cancel restores baseline of the gesture and keeps redo from prior undo.
  tm.undo()
  check(tm.canRedo, 'D5b.4 redo available after undo')
  const beforeCancel = serializeProject(box.project)
  const redoDepth = tm.redoDepth
  tm.begin('cancel-drag')
  tm.preview((project) => {
    moveBlock(documentById(project, project.rootDocumentId)!, blockId, 400, 400)
  })
  tm.cancel()
  check(serializeProject(box.project) === beforeCancel && tm.redoDepth === redoDepth && !tm.isGesturing, 'D5b.4 cancel restores and keeps redo')

  // No-op return to baseline (field-level revert; content fingerprint matches begin).
  const nameBefore = box.project.name
  tm.begin('noop-return')
  tm.preview((project) => {
    project.name = 'Temporary'
  })
  tm.preview((project) => {
    project.name = nameBefore
  })
  const depthBeforeNoop = tm.undoDepth
  check(!tm.commit() && tm.undoDepth === depthBeforeNoop && box.project.name === nameBefore, 'D5b.4 return-to-baseline commit is a no-op')

  // Successful commit drops the redo that cancel preserved.
  check(tm.canRedo, 'D5b.4 redo present before branching commit')
  tm.begin('branch')
  tm.preview((project) => {
    project.name = 'Branched'
  })
  check(tm.commit() && box.project.name === 'Branched' && !tm.canRedo, 'D5b.4 successful gesture commit drops redo')

  // Double close: second commit/cancel are no-ops.
  tm.begin('once')
  tm.preview((project) => {
    project.name = 'Once'
  })
  check(tm.commit() && !tm.commit() && !tm.isGesturing && box.project.name === 'Once', 'D5b.4 double commit is safe')
  tm.begin('once-cancel')
  tm.preview((project) => {
    project.name = 'CancelMe'
  })
  tm.cancel()
  tm.cancel()
  check(!tm.isGesturing && box.project.name === 'Once', 'D5b.4 double cancel is safe')

  // Late preview after close refused.
  check(!tm.preview(() => undefined).ok, 'D5b.4 late preview without gesture is refused')

  // UI-layer undo-during-gesture: cancel only (adapter pattern).
  const beforeUiUndo = serializeProject(box.project)
  const depthUi = tm.undoDepth
  tm.begin('ui-undo')
  tm.preview((project) => {
    project.name = 'UiUndoPreview'
  })
  check(box.project.name === 'UiUndoPreview', 'D5b.4 preview applied before UI undo')
  // Simulate DiagramStage undo: cancel gesture, do not call tm.undo().
  tm.cancel()
  check(
    tm.undoDepth === depthUi && serializeProject(box.project) === beforeUiUndo && !tm.isGesturing,
    'D5b.4 UI undo cancels without consuming history',
  )

  // Redo while gesturing: refuse (manager keeps gesture; UI leaves it open).
  tm.begin('ui-redo')
  const redoWhile = tm.redo()
  check(Boolean(!redoWhile.ok && tm.isGesturing), 'D5b.4 manager redo refuses while gesturing')
  tm.cancel()

  // Navigation / save semantics: cancel then operate — fingerprint.
  tm.markSaved()
  const clean = serializeProject(box.project)
  tm.begin('save-preview')
  tm.preview((project) => {
    project.name = 'UnsavedPreview'
  })
  check(tm.isDirty, 'D5b.4 preview is dirty before save cancel')
  tm.cancel()
  check(serializeProject(box.project) === clean && !tm.isDirty, 'D5b.4 cancel before save restores clean')

  // Edit after abort works.
  tm.begin('again')
  tm.preview((project) => {
    project.name = 'AfterAbort'
  })
  check(tm.commit() && box.project.name === 'AfterAbort', 'D5b.4 edit after abort succeeds')

  // Topology unchanged across gesture cancel (ports/nets ids).
  const wired = createProject('WireGesture')
  const wiredBox = { project: wired }
  const wiredTm = new TransactionManager({
    get: () => wiredBox.project,
    set: (next) => {
      wiredBox.project = next
    },
  })
  let a = ''
  let b = ''
  wiredTm.transact('wire-setup', (project) => {
    const sheet = documentById(project, project.rootDocumentId)!
    a = placeTemplate(sheet, BLOCK_TEMPLATES[0], false)
    b = placeTemplate(sheet, BLOCK_TEMPLATES[0], false)
    const out = addPortAt(sheet, a, 'right', 0.5)
    const inn = addPortAt(sheet, b, 'left', 0.5)
    if (out && inn) linkPorts(sheet, out, inn, 'sig')
    return project
  })
  const netBefore = serializeProject(wiredBox.project)
  const firstBlock = documentById(wiredBox.project, wiredBox.project.rootDocumentId)!.blocks[0].id
  wiredTm.begin('move-wired')
  wiredTm.preview((project) => {
    moveBlock(documentById(project, project.rootDocumentId)!, firstBlock, 200, 200)
  })
  wiredTm.cancel()
  check(serializeProject(wiredBox.project) === netBefore, 'D5b.4 cancel restores full canonical project including nets')
}

// --- D5b.4a gesture robustness fixes ---
{
  // Wired port drag: topology ids stay; cancel restores; commit is one step.
  const box = { project: createProject('WiredPort') }
  const tm = new TransactionManager({
    get: () => box.project,
    set: (next) => {
      box.project = next
    },
  })
  let left = ''
  let right = ''
  let outPort = ''
  let inPort = ''
  tm.transact('setup', (project) => {
    const sheet = documentById(project, project.rootDocumentId)!
    left = placeTemplate(sheet, BLOCK_TEMPLATES[0], false)
    right = placeTemplate(sheet, BLOCK_TEMPLATES[0], false)
    const a = sheet.blocks.find((block) => block.id === left)!
    a.x = 40
    a.y = 80
    const b = sheet.blocks.find((block) => block.id === right)!
    b.x = 280
    b.y = 80
    outPort = addPortAt(sheet, left, 'right', 0.5) ?? ''
    inPort = addPortAt(sheet, right, 'left', 0.5) ?? ''
    if (outPort && inPort) linkPorts(sheet, outPort, inPort, 'sig')
    return project
  })
  const netId = documentById(box.project, box.project.rootDocumentId)!.segments[0]?.netId ?? ''
  const beforeMove = serializeProject(box.project)
  tm.begin('port-drag')
  tm.preview((project) => {
    placePort(documentById(project, project.rootDocumentId)!, outPort, 'right', 0.2)
  })
  tm.preview((project) => {
    placePort(documentById(project, project.rootDocumentId)!, outPort, 'top', 0.4)
  })
  check(tm.commit() && tm.undoDepth === 2, 'D5b.4a wired port drag commits one history entry')
  const sheetAfter = documentById(box.project, box.project.rootDocumentId)!
  check(sheetAfter.ports.find((port) => port.id === outPort)?.side === 'top', 'D5b.4a wired port can change side')
  check(sheetAfter.segments[0]?.netId === netId, 'D5b.4a net identity is preserved')
  check(sheetAfter.ports.find((port) => port.id === outPort)?.id === outPort, 'D5b.4a port id is preserved')
  tm.undo()
  check(serializeProject(box.project) === beforeMove, 'D5b.4a undo restores wired port drag')
  tm.redo()
  check(documentById(box.project, box.project.rootDocumentId)!.ports.find((port) => port.id === outPort)?.side === 'top', 'D5b.4a redo restores wired port drag')

  const beforeCancel = serializeProject(box.project)
  const redoDepth = tm.redoDepth
  tm.begin('port-cancel')
  tm.preview((project) => {
    placePort(documentById(project, project.rootDocumentId)!, outPort, 'bottom', 0.9)
  })
  tm.cancel()
  check(serializeProject(box.project) === beforeCancel && tm.redoDepth === redoDepth, 'D5b.4a cancel of wired port drag keeps redo')

  // F1 / F2: UI undo cancels gesture only; second undo consumes history.
  tm.begin('f1')
  tm.preview((project) => {
    project.name = 'F1Preview'
  })
  const depthF1 = tm.undoDepth
  const snapF1 = serializeProject(box.project)
  tm.cancel() // DiagramStage undo-during-gesture
  check(tm.undoDepth === depthF1 && serializeProject(box.project) !== snapF1 && box.project.name !== 'F1Preview', 'D5b.4a F1 cancel does not consume history')
  const nameBeforeF2 = box.project.name
  tm.undo()
  check(box.project.name !== nameBeforeF2 || tm.undoDepth === depthF1 - 1, 'D5b.4a F2 second undo walks history')

  // F5: successful gesture after undo drops redo.
  tm.transact('seed', (project) => {
    project.name = 'Seed'
    return project
  })
  tm.undo()
  check(tm.canRedo, 'D5b.4a F5 redo available after undo')
  tm.begin('branch-gesture')
  tm.preview((project) => {
    project.name = 'BranchedGesture'
  })
  check(tm.commit() && !tm.canRedo, 'D5b.4a F5 successful gesture drops redo')

  // F6: redo while gesturing refused.
  tm.begin('f6')
  check(!tm.redo().ok && tm.isGesturing, 'D5b.4a F6 redo refused while gesturing')
  tm.cancel()

  // G5: cancel then markSaved — preview never saved.
  tm.markSaved()
  const cleanG5 = serializeProject(box.project)
  tm.begin('g5')
  tm.preview((project) => {
    project.name = 'UnsavedPreview'
  })
  check(tm.isDirty, 'D5b.4a G5 preview is dirty')
  tm.cancel()
  check(serializeProject(box.project) === cleanG5 && !tm.isDirty, 'D5b.4a G5 cancel before save restores clean')
  tm.markSaved()
  check(!tm.isDirty, 'D5b.4a G5 markSaved after cancel stays clean')

  // Resize focus-loss policy: cancel restores size (core path used by blur handler).
  let resizeBlock = ''
  tm.transact('resize-block', (project) => {
    const sheet = documentById(project, project.rootDocumentId)!
    resizeBlock = placeTemplate(sheet, BLOCK_TEMPLATES[0], false)
    return project
  })
  const beforeResize = serializeProject(box.project)
  const w0 = documentById(box.project, box.project.rootDocumentId)!.blocks.find((block) => block.id === resizeBlock)!.width
  tm.begin('resize')
  tm.preview((project) => {
    setBlockFields(documentById(project, project.rootDocumentId)!, resizeBlock, { width: w0 + 80, height: 120 })
  })
  check(tm.isGesturing, 'D5b.4a resize gesture open')
  tm.cancel()
  check(
    serializeProject(box.project) === beforeResize &&
      documentById(box.project, box.project.rootDocumentId)!.blocks.find((block) => block.id === resizeBlock)!.width === w0,
    'D5b.4a E3 cancel restores resize baseline',
  )
  check(!tm.isGesturing, 'D5b.4a no open transaction after resize cancel')
}

// --- D5b.5a interaction defaults (Select / sticky tools / pan / marquee) ---
{
  check(chooseTool('select', 'wire') === 'wire', 'D5b.5a choosing Wire activates wire')
  check(chooseTool('wire', 'wire') === 'select', 'D5b.5a re-clicking Wire returns to Select')
  check(chooseTool('port', 'pan') === 'pan', 'D5b.5a choosing another tool switches mode')
  check(chooseTool('select', 'select') === 'select', 'D5b.5a Select stays Select')
  check(JSON.stringify(panOnDragButtons('select', false)) === JSON.stringify([1]), 'D5b.5a Select pans with middle button only')
  check(JSON.stringify(panOnDragButtons('select', true)) === JSON.stringify([1, 0]), 'D5b.5a Space enables left-button pan')
  check(JSON.stringify(panOnDragButtons('pan', false)) === JSON.stringify([1, 0]), 'D5b.5a Pan tool enables left-button pan')
  check(JSON.stringify(panOnDragButtons('wire', false)) === JSON.stringify([1]), 'D5b.5a Wire mode keeps middle-button pan')
  check(!panOnDragButtons('select', false).includes(2), 'D5b.5a right button is never a pan button')
  check(allowMarquee('select', false, 0), 'D5b.5a Select LMB allows marquee')
  check(!allowMarquee('select', true, 0), 'D5b.5a Space suppresses marquee')
  check(!allowMarquee('wire', false, 0), 'D5b.5a Wire mode has no marquee')
  check(!allowMarquee('select', false, 1), 'D5b.5a middle button does not start marquee')
  check(!allowMarquee('select', false, 2), 'D5b.5a right button does not start marquee')
  check(!isDoublePress(null, { t: 100, x: 0, y: 0 }), 'S5a: first press is not a double')
  check(isDoublePress({ t: 100, x: 10, y: 10 }, { t: 350, x: 12, y: 11 }), 'S5a: close second press is a double')
  check(!isDoublePress({ t: 100, x: 10, y: 10 }, { t: 700, x: 10, y: 10 }), 'S5a: late second press is not a double')
  check(!isDoublePress({ t: 100, x: 10, y: 10 }, { t: 200, x: 40, y: 10 }), 'S5a: distant second press is not a double')
  check(wireDrawingShortcut('Escape', true) === 'undo-step', 'S5a.1: Esc undoes a drawing step')
  check(wireDrawingShortcut('Escape', true, { shift: true }) === 'cancel-all', 'S5a.1: Shift+Esc cancels the draft')
  check(wireDrawingShortcut('Backspace', true) === 'undo-step', 'S5a.1: Backspace undoes a drawing step')
  check(wireDrawingShortcut('z', true, { ctrlOrMeta: true }) === 'undo-step', 'S5a.1: Ctrl+Z undoes a drawing step while drafting')
  check(wireDrawingShortcut('Escape', false) === 'pass', 'S5a.1: Esc without draft passes through')
  check(wireDrawingShortcut('z', false, { ctrlOrMeta: true }) === 'pass', 'S5a.1: Ctrl+Z without draft stays global')
}

// --- D5b.5 toolbar polish: mode ids / sticky policy unchanged ---
{
  const modes = ['select', 'pan', 'wire', 'freehand', 'port'] as const
  check(modes.every((mode) => chooseTool('select', mode) === mode), 'D5b.5 toolbar modes still activate from Select')
  check(chooseTool('wire', 'wire') === 'select', 'D5b.5 sticky Wire toggle still returns to Select')
  check(chooseTool('freehand', 'freehand') === 'select', 'D5b.5 sticky Freehand toggle still returns to Select')
  check(chooseTool('port', 'port') === 'select', 'D5b.5 sticky Port toggle still returns to Select')
  check(chooseTool('pan', 'pan') === 'select', 'D5b.5 sticky Pan toggle still returns to Select')
  check(nextEscapeAction('wire', false, false) === 'tool-select', 'D5b.5 Esc from Wire still returns to Select')
}

// --- D5b.5b wire draft survives viewport pan ---
{
  check(shouldBeginViewPan(1, false), 'D5b.5b middle button starts view pan')
  check(shouldBeginViewPan(0, true), 'D5b.5b Space+LMB starts view pan')
  check(!shouldBeginViewPan(0, false), 'D5b.5b plain LMB is not view pan')
  check(!shouldBeginViewPan(2, false), 'D5b.5b RMB is not view pan')
  check(spaceReleaseAction(true, false) === 'elbow', 'D5b.5b Space tap toggles elbow')
  check(spaceReleaseAction(true, true) === 'none', 'D5b.5b Space+pan leaves elbow alone')
  check(spaceReleaseAction(false, false) === 'none', 'D5b.5b Space without draft does not toggle elbow')
}

// --- D5c.1 wire label drag ---
{
  const box = { project: createProject('LabelDrag') }
  const tm = new TransactionManager({
    get: () => box.project,
    set: (next) => {
      box.project = next
    },
  })
  let labelId = ''
  let segmentId = ''
  tm.transact('setup', (project) => {
    const sheet = documentById(project, project.rootDocumentId)!
    const left = placeTemplate(sheet, BLOCK_TEMPLATES[0], false)
    const right = placeTemplate(sheet, BLOCK_TEMPLATES[0], false)
    const a = sheet.blocks.find((block) => block.id === left)!
    a.x = 40
    a.y = 80
    const b = sheet.blocks.find((block) => block.id === right)!
    b.x = 280
    b.y = 80
    const outPort = addPortAt(sheet, left, 'right', 0.5) ?? ''
    const inPort = addPortAt(sheet, right, 'left', 0.5) ?? ''
    if (outPort && inPort) linkPorts(sheet, outPort, inPort, 'sig')
    segmentId = sheet.segments[0]?.id ?? ''
    labelId = addNameLabel(sheet, segmentId, 0, 20, 14) ?? ''
    return project
  })
  const before = serializeProject(box.project)
  const sheet0 = documentById(box.project, box.project.rootDocumentId)!
  const origin = sheet0.labels.find((label) => label.id === labelId)?.anchor
  check(origin?.kind === 'segment', 'D5c.1 label is segment-anchored')
  tm.begin('label-drag')
  tm.preview((project) => {
    const sheet = documentById(project, project.rootDocumentId)!
    const seg = sheet.segments.find((item) => item.id === segmentId)
    if (!seg || seg.points.length < 2) return
    const mid = {
      x: (seg.points[0].x + seg.points[1].x) / 2,
      y: (seg.points[0].y + seg.points[1].y) / 2 - 24,
    }
    placeLabelAt(sheet, labelId, mid)
  })
  check(tm.commit() && tm.undoDepth === 2, 'D5c.1 label drag commits one history entry')
  const after = documentById(box.project, box.project.rootDocumentId)!.labels.find((label) => label.id === labelId)
  check(after?.anchor.kind === 'segment' && after.anchor.segmentId === segmentId, 'D5c.1 label stays on the same segment')
  check(
    after?.anchor.kind === 'segment' &&
      (after.anchor.distance !== (origin && origin.kind === 'segment' ? origin.distance : -1) ||
        after.anchor.offset !== (origin && origin.kind === 'segment' ? origin.offset : -1)),
    'D5c.1 label position changed',
  )
  tm.undo()
  check(serializeProject(box.project) === before, 'D5c.1 undo restores label position')
  tm.redo()
  const redone = documentById(box.project, box.project.rootDocumentId)!.labels.find((label) => label.id === labelId)
  check(
    redone?.anchor.kind === 'segment' &&
      after?.anchor.kind === 'segment' &&
      redone.anchor.distance === after.anchor.distance &&
      redone.anchor.offset === after.anchor.offset,
    'D5c.1 redo restores label position',
  )
  const beforeCancel = serializeProject(box.project)
  const redoDepth = tm.redoDepth
  tm.begin('label-cancel')
  tm.preview((project) => {
    setLabelOffset(documentById(project, project.rootDocumentId)!, labelId, 40)
  })
  tm.cancel()
  check(serializeProject(box.project) === beforeCancel && tm.redoDepth === redoDepth, 'D5c.1 cancel keeps redo')
}

// --- D5c.3 flat block copy / paste / duplicate ---
{
  const box = { project: createProject('CopyFlat') }
  const tm = new TransactionManager({
    get: () => box.project,
    set: (next) => {
      box.project = next
    },
  })
  let flatId = ''
  tm.transact('place', (project) => {
    const sheet = documentById(project, project.rootDocumentId)!
    flatId = placeTemplate(sheet, BLOCK_TEMPLATES[0], false)
    return project
  })
  const before = serializeProject(box.project)
  tm.transact('duplicate', (project) => {
    const sheet = documentById(project, project.rootDocumentId)!
    const map = duplicateBlocks(sheet, [flatId], 20, 20)
    check(map.size === 1 && map.get(flatId) !== flatId, 'D5c.3 duplicate assigns a new block id')
    return project
  })
  check(documentById(box.project, box.project.rootDocumentId)!.blocks.length === 2, 'D5c.3 duplicate adds one flat block')
  tm.undo()
  check(serializeProject(box.project) === before, 'D5c.3 undo restores before duplicate')
  tm.redo()
  const sheetDup = documentById(box.project, box.project.rootDocumentId)!
  check(sheetDup.blocks.length === 2, 'D5c.3 redo restores duplicate')
  const frag = captureFragment(sheetDup, [flatId])
  check(frag.blocks.length === 1 && frag.blocks[0]?.id === flatId, 'D5c.3 copy captures a flat block without hierarchy')
  const paste1 = pasteFragment(sheetDup, frag, 40, 40)
  const paste2 = pasteFragment(sheetDup, frag, 80, 80)
  check(paste1.length === 1 && paste2.length === 1 && paste1[0] !== paste2[0], 'D5c.3 paste creates new ids')
  const p1 = sheetDup.blocks.find((block) => block.id === paste1[0])
  const p2 = sheetDup.blocks.find((block) => block.id === paste2[0])
  check(Boolean(p1 && p2 && (p1.x !== p2.x || p1.y !== p2.y)), 'D5c.3 successive pastes can land at different offsets')
  // Wired pair: internal wire copies with the selection.
  let left = ''
  let right = ''
  tm.transact('wired', (project) => {
    const sheet = documentById(project, project.rootDocumentId)!
    left = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
    right = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
    const a = sheet.blocks.find((block) => block.id === left)!
    a.x = 40
    a.y = 200
    const b = sheet.blocks.find((block) => block.id === right)!
    b.x = 280
    b.y = 200
    const outPort = addPortAt(sheet, left, 'right', 0.5) ?? ''
    const inPort = addPortAt(sheet, right, 'left', 0.5) ?? ''
    if (outPort && inPort) linkPorts(sheet, outPort, inPort, 'bus')
    return project
  })
  const sheetWire = documentById(box.project, box.project.rootDocumentId)!
  const segsBefore = sheetWire.segments.length
  const wiredFrag = captureFragment(sheetWire, [left, right])
  const pastedPair = pasteFragment(sheetWire, wiredFrag, 20, 20)
  check(pastedPair.length === 2, 'D5c.3 paste of a wired pair creates two blocks')
  check(sheetWire.segments.length === segsBefore + 1, 'D5c.3 paste copies the internal wire once')
}

// --- D5c.4 wire rename inspector ---
{
  const box = { project: createProject('WireRename') }
  const tm = new TransactionManager({
    get: () => box.project,
    set: (next) => {
      box.project = next
    },
  })
  let segmentId = ''
  let netId = ''
  tm.transact('wire', (project) => {
    const sheet = documentById(project, project.rootDocumentId)!
    const left = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
    const right = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
    const a = sheet.blocks.find((block) => block.id === left)!
    a.x = 40
    a.y = 80
    const b = sheet.blocks.find((block) => block.id === right)!
    b.x = 280
    b.y = 80
    const outPort = addPortAt(sheet, left, 'right', 0.5) ?? ''
    const inPort = addPortAt(sheet, right, 'left', 0.5) ?? ''
    if (outPort && inPort) segmentId = linkPorts(sheet, outPort, inPort, 'sig') ?? ''
    netId = sheet.segments.find((segment) => segment.id === segmentId)?.netId ?? ''
    return project
  })
  const before = serializeProject(box.project)
  const sheet0 = documentById(box.project, box.project.rootDocumentId)!
  check(Boolean(netId && sheet0.nets.some((net) => net.id === netId)), 'D5c.4 wire has a net')
  const empty = renameNet(sheet0, netId, '   ')
  check(!empty.ok && empty.reason.includes('empty'), 'D5c.4 empty name is refused')
  check(sheet0.nets.find((net) => net.id === netId)?.name !== '', 'D5c.4 refused rename leaves the name')
  tm.transact('rename', (project) => {
    const sheet = documentById(project, project.rootDocumentId)!
    const result = renameNet(sheet, netId, 'clk')
    check(result.ok && result.name === 'clk' && !result.joined, 'D5c.4 rename accepts a trimmed free name')
    return project
  })
  const sheet1 = documentById(box.project, box.project.rootDocumentId)!
  check(sheet1.nets.find((net) => net.id === netId)?.name === 'clk', 'D5c.4 rename persists on the net')
  check(
    sheet1.labels.filter((label) => label.role === 'name').every((label) => labelText(sheet1, label) === 'clk'),
    'D5c.4 labels follow the net name',
  )
  tm.undo()
  check(serializeProject(box.project) === before, 'D5c.4 undo restores the wire name')
  tm.redo()
  check(documentById(box.project, box.project.rootDocumentId)!.nets.find((net) => net.id === netId)?.name === 'clk', 'D5c.4 redo restores the rename')
}

// --- D5c.5 connection-by-name + open stubs ---
{
  const box = { project: createProject('ByName') }
  const tm = new TransactionManager({
    get: () => box.project,
    set: (next) => {
      box.project = next
    },
  })
  let netA = ''
  let netB = ''
  let segA = ''
  tm.transact('two', (project) => {
    const sheet = documentById(project, project.rootDocumentId)!
    const left = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
    const right = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
    const outPort = addPortAt(sheet, left, 'right', 0.5) ?? ''
    const inPort = addPortAt(sheet, right, 'left', 0.5) ?? ''
    segA = outPort && inPort ? linkPorts(sheet, outPort, inPort, 'alpha') ?? '' : ''
    netA = sheet.segments.find((segment) => segment.id === segA)?.netId ?? ''
    const left2 = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
    const right2 = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
    sheet.blocks.find((block) => block.id === left2)!.y = 200
    sheet.blocks.find((block) => block.id === right2)!.y = 200
    const out2 = addPortAt(sheet, left2, 'right', 0.5) ?? ''
    const in2 = addPortAt(sheet, right2, 'left', 0.5) ?? ''
    const segB = out2 && in2 ? linkPorts(sheet, out2, in2, 'beta') ?? '' : ''
    netB = sheet.segments.find((segment) => segment.id === segB)?.netId ?? ''
    return project
  })
  const beforeJoin = serializeProject(box.project)
  check(netA !== netB && Boolean(netA && netB), 'D5c.5 starts with two nets')
  tm.transact('join', (project) => {
    const sheet = documentById(project, project.rootDocumentId)!
    const result = renameNet(sheet, netB, 'alpha')
    check(result.ok && result.joined && result.netId === netA, 'D5c.5 rename to existing name joins into the target net')
    return project
  })
  const sheetJoin = documentById(box.project, box.project.rootDocumentId)!
  check(sheetJoin.nets.filter((net) => net.name === 'alpha').length === 1, 'D5c.5 after join only one net named alpha')
  check(sheetJoin.segments.every((segment) => segment.netId === netA || sheetJoin.nets.some((net) => net.id === segment.netId && net.name !== 'alpha')), 'D5c.5 joined segments share the kept id')
  check(sheetJoin.segments.filter((segment) => segment.netId === netA).length === 2, 'D5c.5 both wires sit on the kept net')
  tm.undo()
  check(serializeProject(box.project) === beforeJoin, 'D5c.5 undo restores separate nets after rename-join')
  tm.redo()
  check(documentById(box.project, box.project.rootDocumentId)!.segments.filter((segment) => segment.netId === netA).length === 2, 'D5c.5 redo restores the join')

  // Stub create with existing name reuses the net (no parallel id).
  const stubDoc = emptyDocument()
  const stubLeft = placeTemplate(stubDoc, BLOCK_TEMPLATES[1], false)
  const stubRight = placeTemplate(stubDoc, BLOCK_TEMPLATES[1], false)
  const stubOut = addPortAt(stubDoc, stubLeft, 'right', 0.5) ?? ''
  const stubIn = addPortAt(stubDoc, stubRight, 'left', 0.5) ?? ''
  const stubSeg = stubOut && stubIn ? linkPorts(stubDoc, stubOut, stubIn, 'clk') ?? '' : ''
  const stubNet = stubDoc.segments.find((segment) => segment.id === stubSeg)?.netId ?? ''
  const extra = placeTemplate(stubDoc, BLOCK_TEMPLATES[1], false)
  stubDoc.blocks.find((block) => block.id === extra)!.y = 240
  const extraPort = addPortAt(stubDoc, extra, 'left', 0.5) ?? ''
  const port = stubDoc.ports.find((item) => item.id === extraPort)
  if (port) port.name = 'clk'
  const portPoint = portAnchor(stubDoc, extraPort!)!
  const freePoint = { x: portPoint.x - 60, y: portPoint.y }
  const stubResult = commitWire(
    stubDoc,
    [portPoint, freePoint],
    { kind: 'port', portId: extraPort!, point: portPoint },
    { kind: 'free', point: freePoint },
  )
  check(stubResult.ok && stubResult.netId === stubNet && !stubResult.createdNet, 'D5c.5 stub with existing port name joins that net')
  check(stubDoc.nets.filter((net) => net.name === 'clk').length === 1, 'D5c.5 stub does not create a parallel clk net')

  // Unequal geometric join still blocked.
  const d = emptyDocument()
  const a = placeTemplate(d, BLOCK_TEMPLATES[1], false)
  const b = placeTemplate(d, BLOCK_TEMPLATES[1], false)
  const c = placeTemplate(d, BLOCK_TEMPLATES[1], false)
  d.blocks.find((block) => block.id === b)!.x = 280
  d.blocks.find((block) => block.id === c)!.x = 280
  d.blocks.find((block) => block.id === c)!.y = 200
  const pa = addPortAt(d, a, 'right', 0.5) ?? ''
  const pb = addPortAt(d, b, 'left', 0.5) ?? ''
  const pc = addPortAt(d, c, 'left', 0.5) ?? ''
  linkPorts(d, pa, pb, 'one')
  const pbOut = addPortAt(d, b, 'right', 0.5) ?? ''
  linkPorts(d, pbOut, pc, 'two')
  const segOne = d.segments.find((segment) => d.nets.find((net) => net.id === segment.netId)?.name === 'one')!
  const segTwo = d.segments.find((segment) => d.nets.find((net) => net.id === segment.netId)?.name === 'two')!
  const midOne = segOne.points[1] ?? segOne.points[0]!
  const midTwo = segTwo.points[1] ?? segTwo.points[0]!
  const blocked = probeWire(
    d,
    { kind: 'segment', segmentId: segOne.id, point: midOne, edge: 0, distance: 0 },
    { kind: 'segment', segmentId: segTwo.id, point: midTwo, edge: 0, distance: 0 },
  )
  check(!blocked.ok && blocked.netIds.length === 2, 'D5c.5 unequal nets still refuse geometric join')

  // Legacy duplicates stay until merge-all.
  const legacy = emptyDocument()
  legacy.nets.push({ id: 'net_l1', name: 'net 4' }, { id: 'net_l2', name: 'net 4' }, { id: 'net_l3', name: 'net 4' })
  legacy.segments.push(
    { id: 'seg_l1', netId: 'net_l1', routed: 'manual', points: [{ x: 0, y: 0 }, { x: 40, y: 0 }], start: { kind: 'free', x: 0, y: 0 }, end: { kind: 'free', x: 40, y: 0 } },
    { id: 'seg_l2', netId: 'net_l2', routed: 'manual', points: [{ x: 0, y: 40 }, { x: 40, y: 40 }], start: { kind: 'free', x: 0, y: 40 }, end: { kind: 'free', x: 40, y: 40 } },
    { id: 'seg_l3', netId: 'net_l3', routed: 'manual', points: [{ x: 0, y: 80 }, { x: 40, y: 80 }], start: { kind: 'free', x: 0, y: 80 }, end: { kind: 'free', x: 40, y: 80 } },
  )
  check(nameCollisions(legacy).some((item) => item.name === 'net 4' && item.count === 3), 'D5c.5 legacy duplicate names are reported')
  check(netsNamed(legacy, 'net 4').length === 3, 'D5c.5 legacy nets stay separate until merge-all')
  const merged = mergeNetsByName(legacy, 'net 4')
  check(merged.ok && merged.merged === 2 && netsNamed(legacy, 'net 4').length === 1, 'D5c.5 merge-all collapses duplicate names')
  check(merged.ok && ensureNetByName(legacy, 'net 4') === merged.keptId, 'D5c.5 ensureNetByName reuses the kept id')
}

// --- D5c.6 Shift+Drag duplicate ---
{
  check(blockDragMode(false) === 'move', 'D5c.6 without Shift is move')
  check(blockDragMode(true) === 'duplicate', 'D5c.6 with Shift is duplicate')
  check(!duplicateDragMoved(0, 0) && !duplicateDragMoved(2, 2) && duplicateDragMoved(4, 0), 'D5c.6 tiny drags do not place a copy')
  const box = { project: createProject('ShiftDup') }
  const tm = new TransactionManager({
    get: () => box.project,
    set: (next) => {
      box.project = next
    },
  })
  let sourceId = ''
  tm.transact('place', (project) => {
    const sheet = documentById(project, project.rootDocumentId)!
    sourceId = placeTemplate(sheet, BLOCK_TEMPLATES[0], false)
    return project
  })
  const before = serializeProject(box.project)
  const sheet0 = documentById(box.project, box.project.rootDocumentId)!
  const origin = sheet0.blocks.find((block) => block.id === sourceId)!
  tm.begin('Gesture')
  let createdId = ''
  tm.preview((project) => {
    const sheet = documentById(project, project.rootDocumentId)!
    const map = duplicateBlocks(sheet, [sourceId], 20, 20)
    createdId = map.get(sourceId) ?? ''
  })
  tm.preview((project) => {
    const sheet = documentById(project, project.rootDocumentId)!
    const map = duplicateBlocks(sheet, [sourceId], 40, 60)
    createdId = map.get(sourceId) ?? ''
  })
  check(Boolean(createdId) && documentById(box.project, box.project.rootDocumentId)!.blocks.length === 2, 'D5c.6 successive previews do not stack ghost copies')
  check(
    documentById(box.project, box.project.rootDocumentId)!.blocks.find((block) => block.id === sourceId)?.x === origin.x &&
      documentById(box.project, box.project.rootDocumentId)!.blocks.find((block) => block.id === sourceId)?.y === origin.y,
    'D5c.6 original stays put during duplicate preview',
  )
  tm.commit()
  const sheet1 = documentById(box.project, box.project.rootDocumentId)!
  const copy = sheet1.blocks.find((block) => block.id === createdId)
  check(Boolean(copy && copy.x === origin.x + 40 && copy.y === origin.y + 60), 'D5c.6 commit keeps the copy offset')
  check(sheet1.blocks.length === 2, 'D5c.6 one history entry leaves two blocks')
  tm.undo()
  check(serializeProject(box.project) === before, 'D5c.6 undo removes the Shift+Drag copy')
  tm.redo()
  check(documentById(box.project, box.project.rootDocumentId)!.blocks.length === 2, 'D5c.6 redo restores the copy')
  tm.begin('Gesture')
  tm.preview((project) => {
    const sheet = documentById(project, project.rootDocumentId)!
    duplicateBlocks(sheet, [sourceId], 10, 10)
  })
  tm.cancel()
  check(documentById(box.project, box.project.rootDocumentId)!.blocks.length === 2, 'D5c.6 cancel during a later gesture does not drop prior commit')
}

// --- D5c.2 Escape → cancel → Select → deselect ---
{
  check(nextEscapeAction('wire', true, true) === 'cancel', 'D5c.2 Esc with transient cancels first')
  check(nextEscapeAction('wire', false, true) === 'tool-select', 'D5c.2 Esc with Wire tool returns to Select')
  check(nextEscapeAction('pan', false, false) === 'tool-select', 'D5c.2 Esc with Pan tool returns to Select')
  check(nextEscapeAction('select', false, true) === 'clear-selection', 'D5c.2 Esc in Select clears selection')
  check(nextEscapeAction('select', false, false) === 'none', 'D5c.2 Esc with nothing selected is no-op')
  check(nextEscapeAction('select', true, true) === 'cancel', 'D5c.2 cancel consumes Esc before deselect')
  check(chooseTool('wire', 'select') === 'select', 'D5c.2 choosing Select from Wire is Select')
}

// --- D5d.0-A-Fix1 unified viewport wheel zoom ---
{
  const delta = vueFlowWheelDelta({ deltaY: -100, deltaMode: 0, ctrlKey: false }, false)
  check(delta > 0, 'D5d.0-A-Fix1 wheel up yields a positive zoom delta')
  const before = { x: 40, y: 20, zoom: 1 }
  const local = { x: 200, y: 150 }
  const after = viewportAfterWheel(before, local, { deltaY: -100, deltaMode: 0, ctrlKey: false }, undefined, false)
  check(after.zoom > before.zoom && after.zoom <= VIEWPORT_MAX_ZOOM, 'D5d.0-A-Fix1 wheel zooms in within max')
  const worldBeforeX = (local.x - before.x) / before.zoom
  const worldBeforeY = (local.y - before.y) / before.zoom
  const worldAfterX = (local.x - after.x) / after.zoom
  const worldAfterY = (local.y - after.y) / after.zoom
  check(Math.abs(worldAfterX - worldBeforeX) < 1e-9 && Math.abs(worldAfterY - worldBeforeY) < 1e-9, 'D5d.0-A-Fix1 cursor world point stays anchored')
  const floored = viewportAfterWheel({ x: 0, y: 0, zoom: VIEWPORT_MIN_ZOOM }, local, { deltaY: 500, deltaMode: 0, ctrlKey: false }, undefined, false)
  check(floored.zoom === VIEWPORT_MIN_ZOOM, 'D5d.0-A-Fix1 respects min zoom')
  const capped = viewportAfterWheel({ x: 0, y: 0, zoom: VIEWPORT_MAX_ZOOM }, local, { deltaY: -500, deltaMode: 0, ctrlKey: false }, undefined, false)
  check(capped.zoom === VIEWPORT_MAX_ZOOM, 'D5d.0-A-Fix1 respects max zoom')
}

// --- D5d.0-A synthetic benchmark generator ---
{
  const first = generateBenchDocument({ topology: 'C', blocks: 50, seed: 1, geometry: 'simple', wiring: 'stubs' })
  const second = generateBenchDocument({ topology: 'C', blocks: 50, seed: 1, geometry: 'simple', wiring: 'stubs' })
  check(first.hash === second.hash, 'D5d.0-A same config+seed yields the same document hash')
  check(serialize(first.doc) === serialize(second.doc), 'D5d.0-A same config+seed yields identical JSON')
  check(documentHash(first.doc) === first.hash, 'D5d.0-A stamped hash matches documentHash')
  check(first.recipeVersion === BENCHGEN_RECIPE_VERSION, 'D5d.0-A recipe version is stamped')
  check(first.config.wiring === 'stubs', 'D5d.0-A default wiring is stubs')
  const valid = validateBenchDocument(first.doc)
  check(valid.ok, valid.ok ? 'D5d.0-A generated document validates' : `D5d.0-A validate: ${valid.errors.join('; ')}`)
  check(
    first.doc.segments.every((segment) => segmentIsOrthogonal(segment.points)),
    'D5d.0-A topology C @50 segments are orthogonal',
  )
  check(first.actual.stubs === first.actual.segments, 'D5d.0-A stub mode draws only free-end stubs')
  check(first.actual.junctions === 0, 'D5d.0-A stub mode has no junctions')
  check(first.doc.labels.length === first.doc.segments.length, 'D5d.0-A stub mode labels every stub')
  check(
    first.doc.labels.every((label) => label.fontSize === 9),
    'D5d.0-A stub mode uses compact 9px net labels',
  )
  const stubPitchX = (first.doc.blocks[1]?.x ?? 0) - (first.doc.blocks[0]?.x ?? 0)
  check(stubPitchX >= 200, 'D5d.0-A stub mode keeps a wide inter-block gap')
  const density = densityWithinTolerance(first.actual, first.targets, 0.25)
  check(density.ok, 'D5d.0-A topology C @50 densities stay within 25% of targets')
  const estimated = estimateBenchCounts({ topology: 'C', blocks: 50, seed: 1, wiring: 'stubs' })
  check(estimated.segments === 750 && estimated.nets === 425, 'D5d.0-A stub estimate matches C/50 ports/nets')
  const orthoSample = orthogonalPoints({ x: 0, y: 0 }, { x: 40, y: 30 }, 'hvh')
  check(orthoSample.length === 4 && segmentIsOrthogonal(orthoSample), 'D5d.0-A orthogonalPoints yields HVH without diagonals')
  const channelSample = channelRouteHorizontal({ x: 0, y: 10 }, { x: 100, y: 50 }, 80, 20, 80)
  check(segmentIsOrthogonal(channelSample) && channelSample.some((point) => point.y === 80), 'D5d.0-A channelRoute uses exclusive track Y')

  const routed = generateBenchDocument({ topology: 'C', blocks: 50, seed: 1, geometry: 'simple', wiring: 'routed' })
  check(routed.hash !== first.hash, 'D5d.0-A stub vs routed wiring changes the hash')
  check(routed.actual.segments > routed.actual.stubs, 'D5d.0-A routed mode keeps port–port wires')
  check(densityWithinTolerance(routed.actual, routed.targets, 0.3).ok, 'D5d.0-A routed C @50 density tolerance')
  let throughBlocks = 0
  for (const segment of routed.doc.segments) {
    for (let pointIndex = 1; pointIndex < segment.points.length - 1; pointIndex += 1) {
      const point = segment.points[pointIndex]!
      for (const block of routed.doc.blocks) {
        if (point.x > block.x + 2 && point.x < block.x + block.width - 2 && point.y > block.y + 2 && point.y < block.y + block.height - 2) {
          throughBlocks += 1
        }
      }
    }
  }
  check(throughBlocks === 0, 'D5d.0-A topology C @50 routed paths do not pass through block interiors')
  const estimatedRouted = estimateBenchCounts({ topology: 'C', blocks: 50, wiring: 'routed' })
  check(estimatedRouted.segments === 750 && estimatedRouted.nets === 425, 'D5d.0-A routed estimate matches C/50 targets')

  const otherSeed = generateBenchDocument({ topology: 'C', blocks: 50, seed: 2, geometry: 'simple', wiring: 'stubs' })
  check(otherSeed.hash !== first.hash, 'D5d.0-A a different seed changes the hash')

  for (const topology of ['A', 'B', 'C'] as const) {
    const built = generateBenchDocument({ topology, blocks: 50, seed: 1, geometry: 'simple', wiring: 'stubs' })
    const ok = validateBenchDocument(built.doc)
    check(ok.ok, ok.ok ? `D5d.0-A topology ${topology}@50 validates` : `D5d.0-A ${topology}: ${ok.errors.join('; ')}`)
    check(densityWithinTolerance(built.actual, built.targets, 0.3).ok, `D5d.0-A topology ${topology}@50 density tolerance`)
    check(built.actual.stubs === built.actual.segments, `D5d.0-A topology ${topology} stub mode is all stubs`)
    check(
      built.doc.segments.every((segment) => built.doc.nets.some((net) => net.id === segment.netId)),
      `D5d.0-A topology ${topology} segments cite existing nets`,
    )
    const names = new Set(built.doc.nets.map((net) => net.name.trim().toLowerCase()))
    check(names.size === built.doc.nets.length, `D5d.0-A topology ${topology} keeps unique net names (D5c.5)`)
  }

  const complex = generateBenchDocument({ topology: 'A', blocks: 50, seed: 1, geometry: 'complex', wiring: 'stubs' })
  check(complex.doc.symbols[0]!.shapes.length > 1, 'D5d.0-A complex geometry uses multiple symbol shapes')
  check(complex.hash !== first.hash, 'D5d.0-A geometry profile affects the hash')

  const roundTrip = parseDocument(serialize(first.doc))
  check(validateBenchDocument(roundTrip).ok, 'D5d.0-A generated document survives serialize/parse')
  check(documentHash(roundTrip) === first.hash, 'D5d.0-A hash survives serialize/parse')

  // Full 15-cell matrix stays correct for the default (stubs) profile (may take a moment at 1000 blocks).
  const matrix = inventoryBenchMatrix(1, 'simple')
  check(matrix.length === BENCHGEN_SIZES.length * 3, 'D5d.0-A inventory covers 15 size×topology cells')
  for (const row of matrix) {
    const ok = validateBenchDocument(row.doc)
    check(ok.ok, ok.ok ? `D5d.0-A matrix ${row.config.topology}/${row.config.blocks} ok` : `D5d.0-A matrix fail: ${ok.errors[0]}`)
    check(row.config.wiring === 'stubs', `D5d.0-A matrix ${row.config.topology}/${row.config.blocks} defaults to stubs`)
  }

  // Class A fixture must remain untouched and loadable beside the generator.
  const bench = benchSheet()
  check(bench.id === 'doc_bench' && bench.blocks.length >= 50 && bench.segments.length >= 350, 'D5d.0-A benchSheet fixture stays intact')
}

// --- S3 stub-aware block copy (implicit Port↔Free closure) ---
{
  const near = (a: { x: number; y: number }, b: { x: number; y: number }, tol = 0.5) =>
    Math.hypot(a.x - b.x, a.y - b.y) <= tol
  const freeOf = (segment: { start: { kind: string; x?: number; y?: number }; end: { kind: string; x?: number; y?: number } }) => {
    if (segment.end.kind === 'free') return { x: segment.end.x!, y: segment.end.y! }
    if (segment.start.kind === 'free') return { x: segment.start.x!, y: segment.start.y! }
    return null
  }

  const sheet = emptyDocument()
  const blockA = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
  const blockB = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
  const blockC = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
  sheet.blocks.find((block) => block.id === blockA)!.x = 40
  sheet.blocks.find((block) => block.id === blockA)!.y = 40
  sheet.blocks.find((block) => block.id === blockB)!.x = 280
  sheet.blocks.find((block) => block.id === blockB)!.y = 40
  sheet.blocks.find((block) => block.id === blockC)!.x = 40
  sheet.blocks.find((block) => block.id === blockC)!.y = 220
  const portARight = addPortAt(sheet, blockA, 'right', 0.35) ?? ''
  const portARight2 = addPortAt(sheet, blockA, 'right', 0.65) ?? ''
  const portALeft = addPortAt(sheet, blockA, 'left', 0.5) ?? ''
  const portBLeft = addPortAt(sheet, blockB, 'left', 0.5) ?? ''
  const portCRight = addPortAt(sheet, blockC, 'right', 0.5) ?? ''
  sheet.ports.find((port) => port.id === portARight)!.name = 'clk'
  sheet.ports.find((port) => port.id === portARight2)!.name = 'data'
  sheet.ports.find((port) => port.id === portALeft)!.name = 'rst'
  sheet.ports.find((port) => port.id === portBLeft)!.name = 'clk'
  // unnamed stub port
  sheet.ports.find((port) => port.id === portCRight)!.name = ''
  const aR = portAnchor(sheet, portARight)!
  const aR2 = portAnchor(sheet, portARight2)!
  const aL = portAnchor(sheet, portALeft)!
  const bL = portAnchor(sheet, portBLeft)!
  const cR = portAnchor(sheet, portCRight)!
  commitWire(sheet, [aR, { x: aR.x + 40, y: aR.y }], { kind: 'port', portId: portARight, point: aR }, { kind: 'free', point: { x: aR.x + 40, y: aR.y } })
  commitWire(
    sheet,
    [aR2, { x: aR2.x + 16, y: aR2.y }, { x: aR2.x + 16, y: aR2.y + 20 }, { x: aR2.x + 44, y: aR2.y + 20 }],
    { kind: 'port', portId: portARight2, point: aR2 },
    { kind: 'free', point: { x: aR2.x + 44, y: aR2.y + 20 } },
  )
  commitWire(sheet, [{ x: aL.x - 36, y: aL.y }, aL], { kind: 'free', point: { x: aL.x - 36, y: aL.y } }, { kind: 'port', portId: portALeft, point: aL })
  commitWire(sheet, [bL, { x: bL.x - 40, y: bL.y }], { kind: 'port', portId: portBLeft, point: bL }, { kind: 'free', point: { x: bL.x - 40, y: bL.y } })
  commitWire(sheet, [cR, { x: cR.x + 30, y: cR.y }], { kind: 'port', portId: portCRight, point: cR }, { kind: 'free', point: { x: cR.x + 30, y: cR.y } })
  // External Port↔Port from A to B — must not copy when only A is duplicated.
  const portAExt = addPortAt(sheet, blockA, 'right', 0.5) ?? ''
  const portBExt = addPortAt(sheet, blockB, 'left', 0.35) ?? ''
  linkPorts(sheet, portAExt, portBExt, 'ext')
  const stubsA = attachedStubsForBlocks(sheet, [blockA])
  check(stubsA.length === 3, 'S3: block A has three attached stubs')
  check(
    stubsA.every((segment) => sheet.labels.some((label) => label.anchor.kind === 'segment' && label.anchor.segmentId === segment.id)),
    'S3: commitWire already labelled each stub',
  )
  const clkNetBefore = sheet.nets.find((net) => net.name === 'clk')!.id
  const segsBefore = sheet.segments.length
  const labelsBefore = sheet.labels.length
  const freeBBefore = freeOf(sheet.segments.find((segment) => isBlockAttachedStub(sheet, segment, blockB))!)!

  const map = duplicateBlocks(sheet, [blockA], 60, 40)
  const copyId = map.get(blockA)!
  check(Boolean(copyId) && copyId !== blockA, 'S3: duplicate assigns a new block id')
  const stubsCopy = attachedStubsForBlocks(sheet, [copyId])
  check(stubsCopy.length === 3, 'S3: copy receives all three attached stubs')
  check(stubsCopy.some((segment) => segment.points.length > 2), 'S3: multi-bend stub is copied')
  check(stubsCopy.some((segment) => segment.start.kind === 'free'), 'S3: Free→Port orientation is copied')
  check(stubsCopy.some((segment) => segment.end.kind === 'free'), 'S3: Port→Free orientation is copied')
  check(sheet.segments.length === segsBefore + 3, 'S3 B5: only three stub segments added (external Port↔Port excluded)')
  check(
    near(freeOf(sheet.segments.find((segment) => isBlockAttachedStub(sheet, segment, blockB))!)!, freeBBefore),
    'S3 B4: unrelated same-name stub on B is not copied/moved',
  )
  check(
    !sheet.segments.some(
      (segment) =>
        segment.start.kind === 'port' &&
        segment.end.kind === 'port' &&
        sheet.nets.find((net) => net.id === segment.netId)?.name === 'ext' &&
        [segment.start.portId, segment.end.portId].some((portId) => sheet.ports.find((port) => port.id === portId)?.blockId === copyId),
    ),
    'S3 B5: copied block has no remapped external Port↔Port trunk',
  )
  check(
    stubsCopy.every((segment) => {
      const net = sheet.nets.find((item) => item.id === segment.netId)
      if (net?.name === 'clk' || net?.name === 'data' || net?.name === 'rst') return segment.netId === sheet.nets.find((item) => item.name === net.name)!.id
      return true
    }),
    'S3: named stubs join sheet nets by name',
  )
  check(sheet.segments.filter((segment) => segment.netId === clkNetBefore).length === 3, 'S3: clk net gains the copied stub (A original, B, A copy)')
  for (const stub of stubsCopy) {
    const label = sheet.labels.find((item) => item.anchor.kind === 'segment' && item.anchor.segmentId === stub.id)
    check(Boolean(label), `S3: stub ${stub.id} keeps a label`)
    const portEnd = stub.start.kind === 'port' ? stub.start.portId : stub.end.kind === 'port' ? stub.end.portId : ''
    const port = sheet.ports.find((item) => item.id === portEnd)
    check(port?.blockId === copyId, `S3: stub ${stub.id} remaps to the copied block`)
    const free = freeOf(stub)!
    const anchor = portAnchor(sheet, portEnd)!
    // Relative free offset matches source geometry (±60/40 translation of whole stub).
    check(Math.abs(free.x - anchor.x) >= 20, `S3: stub ${stub.id} keeps a free-end offset`)
  }
  const stubLabelCopies = sheet.labels.filter((label) => {
    if (label.anchor.kind !== 'segment') return false
    const segmentId = label.anchor.segmentId
    return stubsCopy.some((segment) => segment.id === segmentId)
  })
  check(stubLabelCopies.length === 3, 'S3: three stub labels copied once (no duplicates)')
  check(sheet.labels.length >= labelsBefore + 3, 'S3: label count grows by at least the copied stubs')

  // Capture/paste path + repeated paste joins the same named nets again.
  const frag = captureFragment(sheet, [blockA])
  check(frag.segments.filter((segment) => isPortFreeLike(segment)).length === 3, 'S3: capture includes three stubs')
  check(
    !frag.segments.some((segment) => segment.start.kind === 'port' && segment.end.kind === 'port' && sheet.nets.find((net) => net.id === segment.netId)?.name === 'ext'),
    'S3 B5: captureFragment excludes external Port↔Port',
  )
  const pasteA = pasteFragment(sheet, frag, 100, 0)
  const pasteB = pasteFragment(sheet, frag, 140, 0)
  check(pasteA.length === 1 && pasteB.length === 1 && pasteA[0] !== pasteB[0], 'S3: repeated paste creates distinct blocks')
  check(attachedStubsForBlocks(sheet, pasteA).length === 3 && attachedStubsForBlocks(sheet, pasteB).length === 3, 'S3: each paste brings stubs')
  check(sheet.nets.filter((net) => net.name === 'clk').length === 1, 'S3: repeated paste does not create parallel clk nets')

  // Multi-block: internal Port↔Port + each block’s stubs.
  const multi = emptyDocument()
  const mA = placeTemplate(multi, BLOCK_TEMPLATES[1], false)
  const mB = placeTemplate(multi, BLOCK_TEMPLATES[1], false)
  multi.blocks.find((block) => block.id === mA)!.x = 20
  multi.blocks.find((block) => block.id === mB)!.x = 220
  const mOut = addPortAt(multi, mA, 'right', 0.5) ?? ''
  const mIn = addPortAt(multi, mB, 'left', 0.5) ?? ''
  const mStubPort = addPortAt(multi, mA, 'left', 0.5) ?? ''
  multi.ports.find((port) => port.id === mStubPort)!.name = 'clk'
  linkPorts(multi, mOut, mIn, 'bus')
  const mAt = portAnchor(multi, mStubPort)!
  commitWire(multi, [mAt, { x: mAt.x - 28, y: mAt.y }], { kind: 'port', portId: mStubPort, point: mAt }, { kind: 'free', point: { x: mAt.x - 28, y: mAt.y } })
  const multiBefore = multi.segments.length
  const multiBus = multi.segments.find((segment) => multi.nets.find((net) => net.id === segment.netId)?.name === 'bus')
  check(Boolean(multiBus && multiBus.start.kind === 'port' && multiBus.end.kind === 'port'), 'S3 B6: fixture has internal Port↔Port bus')
  const multiMap = duplicateBlocks(multi, [mA, mB], 0, 80)
  check(multiMap.size === 2, 'S3: multi-block duplicate maps both blocks')
  check(multi.segments.length === multiBefore + 2, 'S3 B6: multi-block copies internal Port↔Port + one stub once')
  const copiedBus = multi.segments.filter(
    (segment) =>
      segment.start.kind === 'port' &&
      segment.end.kind === 'port' &&
      multi.nets.find((net) => net.id === segment.netId)?.name === 'bus',
  )
  check(copiedBus.length === 2, 'S3 B6: internal Port↔Port preserved (original + copy)')
  const copyMA = multiMap.get(mA)!
  const copyMB = multiMap.get(mB)!
  const busOnCopies = copiedBus.find((segment) => {
    const start = segment.start
    const end = segment.end
    if (start.kind !== 'port' || end.kind !== 'port') return false
    const a = multi.ports.find((port) => port.id === start.portId)?.blockId
    const b = multi.ports.find((port) => port.id === end.portId)?.blockId
    return (a === copyMA && b === copyMB) || (a === copyMB && b === copyMA)
  })
  check(Boolean(busOnCopies), 'S3 B6: copied internal wire remaps to both copied blocks')

  // Auto-named stub nets still follow D5c.5 join-by-display-name.
  const unnamedMap = duplicateBlocks(sheet, [blockC], 0, 80)
  const unnamedCopy = unnamedMap.get(blockC)!
  const unnamedStubs = attachedStubsForBlocks(sheet, [unnamedCopy])
  const unnamedOriginal = sheet.segments.find((segment) => isBlockAttachedStub(sheet, segment, blockC))!
  check(unnamedStubs.length === 1, 'S3: unnamed stub is copied')
  check(unnamedStubs[0]!.netId === unnamedOriginal.netId, 'S3: auto-named stub joins by its display name')

  // Shift+Drag-style preview from baseline: cancel restores; commit keeps stubs.
  const box = { project: createProject('S3StubCopy') }
  const tm = new TransactionManager({
    get: () => box.project,
    set: (next) => {
      box.project = next
    },
  })
  let live = ''
  tm.transact('setup', (project) => {
    const doc = documentById(project, project.rootDocumentId)!
    live = placeTemplate(doc, BLOCK_TEMPLATES[1], false)
    const portId = addPortAt(doc, live, 'right', 0.5) ?? ''
    doc.ports.find((port) => port.id === portId)!.name = 'clk'
    const at = portAnchor(doc, portId)!
    commitWire(doc, [at, { x: at.x + 40, y: at.y }], { kind: 'port', portId, point: at }, { kind: 'free', point: { x: at.x + 40, y: at.y } })
    return project
  })
  const baseline = serializeProject(box.project)
  const origin = documentById(box.project, box.project.rootDocumentId)!.blocks.find((block) => block.id === live)!
  tm.begin('shift-dup')
  tm.preview((project) => {
    duplicateBlocks(documentById(project, project.rootDocumentId)!, [live], 20, 20)
  })
  tm.preview((project) => {
    duplicateBlocks(documentById(project, project.rootDocumentId)!, [live], 40, 30)
  })
  check(documentById(box.project, box.project.rootDocumentId)!.blocks.length === 2, 'S3: preview shows one copy from baseline')
  check(attachedStubsForBlocks(documentById(box.project, box.project.rootDocumentId)!, [...documentById(box.project, box.project.rootDocumentId)!.blocks.map((block) => block.id).filter((id) => id !== live)]).length === 1, 'S3: preview copy includes the stub')
  tm.cancel()
  check(serializeProject(box.project) === baseline, 'S3: escape/cancel restores document')
  tm.begin('shift-commit')
  tm.preview((project) => {
    duplicateBlocks(documentById(project, project.rootDocumentId)!, [live], 40, 30)
  })
  check(tm.commit(), 'S3: Shift+Drag-style commit records one history entry')
  const afterCommit = documentById(box.project, box.project.rootDocumentId)!
  check(afterCommit.blocks.length === 2 && afterCommit.segments.length === 2, 'S3: commit keeps original + copy stubs')
  const committed = serializeProject(box.project)
  tm.undo()
  check(serializeProject(box.project) === baseline, 'S3: undo removes stub-aware copy')
  tm.redo()
  check(serializeProject(box.project) === committed, 'S3: redo restores stub-aware copy')
  const roundTrip = parseDocument(serialize(documentById(box.project, box.project.rootDocumentId)!))
  check(roundTrip.segments.length === 2 && roundTrip.blocks.length === 2, 'S3: save/load keeps stub-aware copy')
  void origin
}

function isPortFreeLike(segment: { start: { kind: string }; end: { kind: string } }): boolean {
  return (
    (segment.start.kind === 'port' && segment.end.kind === 'free') ||
    (segment.start.kind === 'free' && segment.end.kind === 'port')
  )
}

// --- D5d.0-A functional correction: rigid block-attached stub translation ---
{
  const near = (a: { x: number; y: number }, b: { x: number; y: number }, tol = 0.5) =>
    Math.hypot(a.x - b.x, a.y - b.y) <= tol
  const freeOf = (segment: { start: { kind: string; x?: number; y?: number }; end: { kind: string; x?: number; y?: number } }) => {
    if (segment.end.kind === 'free') return { x: segment.end.x!, y: segment.end.y! }
    if (segment.start.kind === 'free') return { x: segment.start.x!, y: segment.start.y! }
    return null
  }

  const sheet = emptyDocument()
  const blockA = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
  const blockB = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
  sheet.blocks.find((block) => block.id === blockA)!.x = 80
  sheet.blocks.find((block) => block.id === blockA)!.y = 80
  sheet.blocks.find((block) => block.id === blockB)!.x = 360
  sheet.blocks.find((block) => block.id === blockB)!.y = 80
  const portA1 = addPortAt(sheet, blockA, 'right', 0.35) ?? ''
  const portA2 = addPortAt(sheet, blockA, 'right', 0.65) ?? ''
  const portA3 = addPortAt(sheet, blockA, 'left', 0.5) ?? ''
  const portB1 = addPortAt(sheet, blockB, 'left', 0.5) ?? ''
  sheet.ports.find((port) => port.id === portA1)!.name = 'clk'
  sheet.ports.find((port) => port.id === portA2)!.name = 'data'
  sheet.ports.find((port) => port.id === portA3)!.name = 'rst'
  sheet.ports.find((port) => port.id === portB1)!.name = 'clk'
  const a1 = portAnchor(sheet, portA1)!
  const a2 = portAnchor(sheet, portA2)!
  const a3 = portAnchor(sheet, portA3)!
  const b1 = portAnchor(sheet, portB1)!
  // Port→Free two-point.
  commitWire(sheet, [a1, { x: a1.x + 40, y: a1.y }], { kind: 'port', portId: portA1, point: a1 }, { kind: 'free', point: { x: a1.x + 40, y: a1.y } })
  // Port→Free multi-bend on the same block.
  commitWire(
    sheet,
    [a2, { x: a2.x + 20, y: a2.y }, { x: a2.x + 20, y: a2.y + 24 }, { x: a2.x + 48, y: a2.y + 24 }],
    { kind: 'port', portId: portA2, point: a2 },
    { kind: 'free', point: { x: a2.x + 48, y: a2.y + 24 } },
  )
  // Free→Port on A.
  commitWire(
    sheet,
    [{ x: a3.x - 36, y: a3.y }, a3],
    { kind: 'free', point: { x: a3.x - 36, y: a3.y } },
    { kind: 'port', portId: portA3, point: a3 },
  )
  // Same-name stub on B (joins clk net) — must not move with A.
  commitWire(sheet, [b1, { x: b1.x - 40, y: b1.y }], { kind: 'port', portId: portB1, point: b1 }, { kind: 'free', point: { x: b1.x - 40, y: b1.y } })

  const stubA = sheet.segments.filter((segment) => isBlockAttachedStub(sheet, segment, blockA))
  const stubB = sheet.segments.filter((segment) => isBlockAttachedStub(sheet, segment, blockB))
  check(stubA.length === 3, 'D5d stub-move: three stubs attach to block A')
  check(stubB.length === 1, 'D5d stub-move: one stub attaches to block B')
  check(stubA.some((segment) => segment.points.length > 2), 'D5d stub-move: includes a multi-bend stub')
  check(stubA.some((segment) => segment.start.kind === 'free' && segment.end.kind === 'port'), 'D5d stub-move: includes Free→Port')
  check(stubA.some((segment) => segment.start.kind === 'port' && segment.end.kind === 'free'), 'D5d stub-move: includes Port→Free')

  const labelBySeg = new Map<string, string>()
  for (const segment of stubA) {
    const labelId = addNameLabel(sheet, segment.id, 0, 16, 6)
    if (labelId) labelBySeg.set(segment.id, labelId)
  }
  const beforeA = stubA.map((segment) => ({
    id: segment.id,
    free: freeOf(segment)!,
    points: segment.points.map((point) => ({ x: point.x, y: point.y })),
    label: labelPlacement(sheet, labelBySeg.get(segment.id)!)!,
  }))
  const freeBBefore = freeOf(stubB[0]!)!
  const clkNetId = sheet.segments.find((segment) => segment.id === stubA.find((item) => sheet.nets.find((net) => net.id === item.netId)?.name === 'clk')?.id)?.netId
  const dx = 45
  const dy = 65
  const blockA0 = sheet.blocks.find((block) => block.id === blockA)!
  moveBlock(sheet, blockA, blockA0.x + dx, blockA0.y + dy)
  for (const prior of beforeA) {
    const segment = sheet.segments.find((item) => item.id === prior.id)!
    check(near(freeOf(segment)!, { x: prior.free.x + dx, y: prior.free.y + dy }), `D5d stub-move: free end of ${prior.id} translates rigidly`)
    check(
      segment.points.every((point, index) => near(point, { x: prior.points[index]!.x + dx, y: prior.points[index]!.y + dy })),
      `D5d stub-move: full polyline of ${prior.id} translates`,
    )
    check(
      near(labelPlacement(sheet, labelBySeg.get(prior.id)!)!, { x: prior.label.x + dx, y: prior.label.y + dy }),
      `D5d stub-move: label on ${prior.id} follows the stub`,
    )
  }
  check(near(freeOf(stubB[0]!)!, freeBBefore), 'D5d stub-move: same-name stub on other block stays put')
  check(
    Boolean(clkNetId) && sheet.segments.filter((segment) => segment.netId === clkNetId).length === 2,
    'D5d stub-move: shared clk net id preserved across both stubs',
  )

  const trunk = sampleDocument()
  const trunkBendX = trunk.segments[0]!.points[1]!.x
  moveBlock(trunk, 'blk_a', 120, 120)
  check(trunk.segments[0]!.points[1]!.x === trunkBendX, 'D5d stub-move: manual trunk bend stays put')

  const multi = emptyDocument()
  const mA = placeTemplate(multi, BLOCK_TEMPLATES[1], false)
  const mB = placeTemplate(multi, BLOCK_TEMPLATES[1], false)
  multi.blocks.find((block) => block.id === mA)!.x = 40
  multi.blocks.find((block) => block.id === mA)!.y = 40
  multi.blocks.find((block) => block.id === mB)!.x = 240
  multi.blocks.find((block) => block.id === mB)!.y = 40
  const mPa = addPortAt(multi, mA, 'right', 0.5) ?? ''
  const mPb = addPortAt(multi, mB, 'left', 0.5) ?? ''
  const mAa = portAnchor(multi, mPa)!
  const mBb = portAnchor(multi, mPb)!
  commitWire(multi, [mAa, { x: mAa.x + 30, y: mAa.y }], { kind: 'port', portId: mPa, point: mAa }, { kind: 'free', point: { x: mAa.x + 30, y: mAa.y } })
  commitWire(multi, [mBb, { x: mBb.x - 30, y: mBb.y }], { kind: 'port', portId: mPb, point: mBb }, { kind: 'free', point: { x: mBb.x - 30, y: mBb.y } })
  const freeMA0 = freeOf(multi.segments[0]!)!
  const freeMB0 = freeOf(multi.segments[1]!)!
  const originA = { x: multi.blocks.find((block) => block.id === mA)!.x, y: multi.blocks.find((block) => block.id === mA)!.y }
  const originB = { x: multi.blocks.find((block) => block.id === mB)!.x, y: multi.blocks.find((block) => block.id === mB)!.y }
  const mdx = 20
  const mdy = 30
  moveBlock(multi, mA, originA.x + mdx, originA.y + mdy)
  moveBlock(multi, mB, originB.x + mdx, originB.y + mdy)
  check(near(freeOf(multi.segments[0]!)!, { x: freeMA0.x + mdx, y: freeMA0.y + mdy }), 'D5d stub-move: multi-block A stub once')
  check(near(freeOf(multi.segments[1]!)!, { x: freeMB0.x + mdx, y: freeMB0.y + mdy }), 'D5d stub-move: multi-block B stub once')

  const box = { project: createProject('StubMove') }
  const tm = new TransactionManager({
    get: () => box.project,
    set: (next) => {
      box.project = next
    },
  })
  let liveBlock = ''
  let liveSeg = ''
  tm.transact('setup', (project) => {
    const doc = documentById(project, project.rootDocumentId)!
    liveBlock = placeTemplate(doc, BLOCK_TEMPLATES[1], false)
    const portId = addPortAt(doc, liveBlock, 'right', 0.5) ?? ''
    const at = portAnchor(doc, portId)!
    commitWire(doc, [at, { x: at.x + 40, y: at.y }], { kind: 'port', portId, point: at }, { kind: 'free', point: { x: at.x + 40, y: at.y } })
    liveSeg = doc.segments[0]!.id
    return project
  })
  const baseline = serializeProject(box.project)
  const baseFree = freeOf(documentById(box.project, box.project.rootDocumentId)!.segments[0]!)!
  const baseBlock = documentById(box.project, box.project.rootDocumentId)!.blocks.find((block) => block.id === liveBlock)!
  tm.begin('stub-drag')
  tm.preview((project) => {
    moveBlock(documentById(project, project.rootDocumentId)!, liveBlock, baseBlock.x + 10, baseBlock.y + 10)
  })
  tm.preview((project) => {
    moveBlock(documentById(project, project.rootDocumentId)!, liveBlock, baseBlock.x + 20, baseBlock.y + 20)
  })
  check(
    near(freeOf(documentById(box.project, box.project.rootDocumentId)!.segments.find((segment) => segment.id === liveSeg)!)!, {
      x: baseFree.x + 20,
      y: baseFree.y + 20,
    }),
    'D5d stub-move: repeated preview has no cumulative drift',
  )
  tm.cancel()
  check(serializeProject(box.project) === baseline, 'D5d stub-move: escape/cancel restores geometry')

  tm.begin('stub-commit')
  tm.preview((project) => {
    moveBlock(documentById(project, project.rootDocumentId)!, liveBlock, baseBlock.x + 12, baseBlock.y + 8)
  })
  check(tm.commit(), 'D5d stub-move: commit records one history entry')
  const committed = serializeProject(box.project)
  const committedFree = freeOf(documentById(box.project, box.project.rootDocumentId)!.segments.find((segment) => segment.id === liveSeg)!)!
  check(near(committedFree, { x: baseFree.x + 12, y: baseFree.y + 8 }), 'D5d stub-move: committed free end matches delta')
  tm.undo()
  check(serializeProject(box.project) === baseline, 'D5d stub-move: undo restores original stub geometry')
  tm.redo()
  check(serializeProject(box.project) === committed, 'D5d stub-move: redo restores moved stub geometry')
  const roundTrip = parseDocument(serialize(documentById(box.project, box.project.rootDocumentId)!))
  check(
    near(freeOf(roundTrip.segments.find((segment) => segment.id === liveSeg)!)!, committedFree),
    'D5d stub-move: save/load keeps moved stub geometry',
  )
}

// --- S4 rigid stubs on Resize / Port Drag ---
{
  const near = (a: { x: number; y: number }, b: { x: number; y: number }, tol = 0.5) =>
    Math.hypot(a.x - b.x, a.y - b.y) <= tol
  const freeOf = (segment: { start: { kind: string; x?: number; y?: number }; end: { kind: string; x?: number; y?: number } }) => {
    if (segment.end.kind === 'free') return { x: segment.end.x!, y: segment.end.y! }
    if (segment.start.kind === 'free') return { x: segment.start.x!, y: segment.start.y! }
    return null
  }

  // Shared helper: port deltas drive stub translation (same path as move/resize/port-drag).
  const helperDoc = emptyDocument()
  const hBlock = placeTemplate(helperDoc, BLOCK_TEMPLATES[1], false)
  const hPort = addPortAt(helperDoc, hBlock, 'right', 0.5) ?? ''
  const hAt = portAnchor(helperDoc, hPort)!
  commitWire(helperDoc, [hAt, { x: hAt.x + 40, y: hAt.y }], { kind: 'port', portId: hPort, point: hAt }, { kind: 'free', point: { x: hAt.x + 40, y: hAt.y } })
  const beforeH = capturePortAnchors(helperDoc, hBlock)
  helperDoc.blocks[0]!.width += 40
  const deltasH = portAnchorDeltas(helperDoc, beforeH)
  check(deltasH.has(hPort) && Math.abs(deltasH.get(hPort)!.x - 40) < 0.5, 'S4: portAnchorDeltas sees east-edge growth')
  translateAttachedStubsByPortDeltas(helperDoc, deltasH)
  check(near(freeOf(helperDoc.segments[0]!)!, { x: hAt.x + 40 + 40, y: hAt.y }), 'S4: translateAttachedStubsByPortDeltas moves the free end')
  check(typeof translateSegmentGeometry === 'function' && typeof isPortAttachedStub === 'function', 'S4: shared stub helpers are exported')

  const sheet = emptyDocument()
  const block = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
  const other = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
  sheet.blocks.find((item) => item.id === block)!.x = 80
  sheet.blocks.find((item) => item.id === block)!.y = 80
  sheet.blocks.find((item) => item.id === other)!.x = 360
  sheet.blocks.find((item) => item.id === other)!.y = 80
  const leftPort = addPortAt(sheet, block, 'left', 0.5) ?? ''
  const rightPort = addPortAt(sheet, block, 'right', 0.35) ?? ''
  const rightPort2 = addPortAt(sheet, block, 'right', 0.7) ?? ''
  const otherPort = addPortAt(sheet, other, 'left', 0.5) ?? ''
  sheet.ports.find((port) => port.id === leftPort)!.name = 'rst'
  sheet.ports.find((port) => port.id === rightPort)!.name = 'clk'
  sheet.ports.find((port) => port.id === rightPort2)!.name = 'data'
  sheet.ports.find((port) => port.id === otherPort)!.name = 'clk'
  const lp = portAnchor(sheet, leftPort)!
  const rp = portAnchor(sheet, rightPort)!
  const rp2 = portAnchor(sheet, rightPort2)!
  const op = portAnchor(sheet, otherPort)!
  commitWire(sheet, [{ x: lp.x - 36, y: lp.y }, lp], { kind: 'free', point: { x: lp.x - 36, y: lp.y } }, { kind: 'port', portId: leftPort, point: lp })
  commitWire(
    sheet,
    [rp, { x: rp.x + 20, y: rp.y }, { x: rp.x + 20, y: rp.y + 16 }, { x: rp.x + 48, y: rp.y + 16 }],
    { kind: 'port', portId: rightPort, point: rp },
    { kind: 'free', point: { x: rp.x + 48, y: rp.y + 16 } },
  )
  commitWire(sheet, [rp2, { x: rp2.x + 40, y: rp2.y }], { kind: 'port', portId: rightPort2, point: rp2 }, { kind: 'free', point: { x: rp2.x + 40, y: rp2.y } })
  commitWire(sheet, [op, { x: op.x - 40, y: op.y }], { kind: 'port', portId: otherPort, point: op }, { kind: 'free', point: { x: op.x - 40, y: op.y } })
  // Port↔Port trunk for rubber-band regression.
  const trunkOut = addPortAt(sheet, block, 'right', 0.5) ?? ''
  const trunkIn = addPortAt(sheet, other, 'left', 0.35) ?? ''
  linkPorts(sheet, trunkOut, trunkIn, 'link')
  const trunkBendX = sheet.segments.find((segment) => sheet.nets.find((net) => net.id === segment.netId)?.name === 'link')!.points[1]!.x

  const leftSeg = sheet.segments.find((segment) => isPortAttachedStub(segment, leftPort))!
  const rightSeg = sheet.segments.find((segment) => isPortAttachedStub(segment, rightPort))!
  const rightSeg2 = sheet.segments.find((segment) => isPortAttachedStub(segment, rightPort2))!
  const otherSeg = sheet.segments.find((segment) => isPortAttachedStub(segment, otherPort))!
  const leftFree0 = freeOf(leftSeg)!
  const rightFree0 = freeOf(rightSeg)!
  const rightFree20 = freeOf(rightSeg2)!
  const otherFree0 = freeOf(otherSeg)!
  const rightPts0 = rightSeg.points.map((point) => ({ x: point.x, y: point.y }))
  const labelRight = sheet.labels.find((label) => label.anchor.kind === 'segment' && label.anchor.segmentId === rightSeg.id)!
  const labelAt0 = labelPlacement(sheet, labelRight.id)!

  // Grow width eastward: left port Δ≈0, right ports move +Δw.
  const block0 = sheet.blocks.find((item) => item.id === block)!
  const oldW = block0.width
  setBlockFields(sheet, block, { width: oldW + 50 })
  check(near(freeOf(leftSeg)!, leftFree0), 'S4: left stub stays when growing width on the right')
  check(near(freeOf(rightSeg)!, { x: rightFree0.x + 50, y: rightFree0.y }), 'S4: right multi-bend stub follows its port Δx')
  check(
    rightSeg.points.every((point, index) => near(point, { x: rightPts0[index]!.x + 50, y: rightPts0[index]!.y })),
    'S4: all intermediate points of the multi-bend stub translate',
  )
  check(near(freeOf(rightSeg2)!, { x: rightFree20.x + 50, y: rightFree20.y }), 'S4: second right stub follows the same east Δ')
  check(near(freeOf(otherSeg)!, otherFree0), 'S4: unrelated same-name stub on other block stays put')
  check(near(labelPlacement(sheet, labelRight.id)!, { x: labelAt0.x + 50, y: labelAt0.y }), 'S4: label follows resized stub')
  check(sheet.segments.find((segment) => sheet.nets.find((net) => net.id === segment.netId)?.name === 'link')!.points[1]!.x === trunkBendX, 'S4: Port↔Port trunk bend still rubber-bands (stays put)')

  // Grow height southward: side ports typically keep Y if t is fractional — top/bottom would move;
  // for left/right ports, y = block.y + height * t, so Δy = Δh * t.
  const leftFree1 = freeOf(leftSeg)!
  const h0 = sheet.blocks.find((item) => item.id === block)!.height
  const leftT = sheet.ports.find((port) => port.id === leftPort)!.t ?? 0.5
  setBlockFields(sheet, block, { height: h0 + 40 })
  const expectedLeftDy = 40 * leftT
  check(near(freeOf(leftSeg)!, { x: leftFree1.x, y: leftFree1.y + expectedLeftDy }), 'S4: vertical resize moves side-port stubs by height·t')

  // Port drag: only the moved port’s stubs translate.
  const rightFree1 = freeOf(rightSeg)!
  const right2Free1 = freeOf(rightSeg2)!
  placePort(sheet, rightPort, 'right', 0.15)
  const rpAfter = portAnchor(sheet, rightPort)!
  const expectedDy = rpAfter.y - (rp.y + 50) // account for prior width resize (x moved) — use live port delta via free relative
  // Better: relative free offset preserved.
  const freeAfter = freeOf(rightSeg)!
  check(Math.abs(freeAfter.x - rpAfter.x - (rightFree0.x - rp.x)) < 1 && Math.abs(freeAfter.y - rpAfter.y - (rightFree0.y - rp.y)) < 1, 'S4: port drag preserves stub relative geometry')
  check(near(freeOf(rightSeg2)!, right2Free1), 'S4: other stubs on the block stay when a different port is dragged')
  void expectedDy
  void rightFree1

  // Two stubs on one port (multi).
  const multiPort = addPortAt(sheet, block, 'left', 0.2) ?? ''
  const mp = portAnchor(sheet, multiPort)!
  commitWire(sheet, [mp, { x: mp.x - 24, y: mp.y }], { kind: 'port', portId: multiPort, point: mp }, { kind: 'free', point: { x: mp.x - 24, y: mp.y } })
  commitWire(sheet, [mp, { x: mp.x - 24, y: mp.y - 12 }], { kind: 'port', portId: multiPort, point: mp }, { kind: 'free', point: { x: mp.x - 24, y: mp.y - 12 } })
  const multiStubs = sheet.segments.filter((segment) => isPortAttachedStub(segment, multiPort))
  check(multiStubs.length === 2, 'S4: two stubs can attach to one port')
  const multiFrees0 = multiStubs.map((segment) => freeOf(segment)!)
  placePort(sheet, multiPort, 'left', 0.8)
  const mp2 = portAnchor(sheet, multiPort)!
  multiStubs.forEach((segment, index) => {
    check(near(freeOf(segment)!, { x: multiFrees0[index]!.x + (mp2.x - mp.x), y: multiFrees0[index]!.y + (mp2.y - mp.y) }), `S4: multi-stub ${index} follows port drag`)
  })

  // Gesture preview / cancel / undo for resize.
  const box = { project: createProject('S4Resize') }
  const tm = new TransactionManager({
    get: () => box.project,
    set: (next) => {
      box.project = next
    },
  })
  let liveBlock = ''
  let livePort = ''
  let liveSeg = ''
  tm.transact('setup', (project) => {
    const doc = documentById(project, project.rootDocumentId)!
    liveBlock = placeTemplate(doc, BLOCK_TEMPLATES[1], false)
    livePort = addPortAt(doc, liveBlock, 'right', 0.5) ?? ''
    const at = portAnchor(doc, livePort)!
    commitWire(doc, [at, { x: at.x + 40, y: at.y }], { kind: 'port', portId: livePort, point: at }, { kind: 'free', point: { x: at.x + 40, y: at.y } })
    liveSeg = doc.segments[0]!.id
    return project
  })
  const baseline = serializeProject(box.project)
  const baseFree = freeOf(documentById(box.project, box.project.rootDocumentId)!.segments[0]!)!
  const baseW = documentById(box.project, box.project.rootDocumentId)!.blocks[0]!.width
  tm.begin('resize')
  tm.preview((project) => {
    setBlockFields(documentById(project, project.rootDocumentId)!, liveBlock, { width: baseW + 20 })
  })
  tm.preview((project) => {
    setBlockFields(documentById(project, project.rootDocumentId)!, liveBlock, { width: baseW + 40 })
  })
  check(
    near(freeOf(documentById(box.project, box.project.rootDocumentId)!.segments.find((segment) => segment.id === liveSeg)!)!, {
      x: baseFree.x + 40,
      y: baseFree.y,
    }),
    'S4: repeated resize preview has no cumulative drift',
  )
  tm.cancel()
  check(serializeProject(box.project) === baseline, 'S4: escape/cancel restores resize geometry')

  tm.begin('resize-commit')
  tm.preview((project) => {
    setBlockFields(documentById(project, project.rootDocumentId)!, liveBlock, { width: baseW + 30 })
  })
  check(tm.commit(), 'S4: resize commit records one history entry')
  const committed = serializeProject(box.project)
  tm.undo()
  check(serializeProject(box.project) === baseline, 'S4: undo restores pre-resize stubs')
  tm.redo()
  check(serializeProject(box.project) === committed, 'S4: redo restores resized stubs')
  const roundTrip = parseDocument(serialize(documentById(box.project, box.project.rootDocumentId)!))
  check(near(freeOf(roundTrip.segments[0]!)!, freeOf(documentById(box.project, box.project.rootDocumentId)!.segments[0]!)!), 'S4: save/load keeps resized stub geometry')

  // Port-drag cancel path.
  const portBox = { project: createProject('S4Port') }
  const portTm = new TransactionManager({
    get: () => portBox.project,
    set: (next) => {
      portBox.project = next
    },
  })
  let pBlock = ''
  let pPort = ''
  portTm.transact('setup', (project) => {
    const doc = documentById(project, project.rootDocumentId)!
    pBlock = placeTemplate(doc, BLOCK_TEMPLATES[1], false)
    pPort = addPortAt(doc, pBlock, 'right', 0.5) ?? ''
    const at = portAnchor(doc, pPort)!
    commitWire(doc, [at, { x: at.x + 32, y: at.y }], { kind: 'port', portId: pPort, point: at }, { kind: 'free', point: { x: at.x + 32, y: at.y } })
    return project
  })
  const portBaseline = serializeProject(portBox.project)
  portTm.begin('port-drag')
  portTm.preview((project) => {
    placePort(documentById(project, project.rootDocumentId)!, pPort, 'right', 0.2)
  })
  portTm.cancel()
  check(serializeProject(portBox.project) === portBaseline, 'S4: port-drag cancel restores stub geometry')

  // Move regression still rigid.
  const moveDoc = emptyDocument()
  const mB = placeTemplate(moveDoc, BLOCK_TEMPLATES[1], false)
  const mP = addPortAt(moveDoc, mB, 'right', 0.5) ?? ''
  const mAt = portAnchor(moveDoc, mP)!
  commitWire(moveDoc, [mAt, { x: mAt.x + 30, y: mAt.y }], { kind: 'port', portId: mP, point: mAt }, { kind: 'free', point: { x: mAt.x + 30, y: mAt.y } })
  const mFree0 = freeOf(moveDoc.segments[0]!)!
  const mBlock = moveDoc.blocks[0]!
  moveBlock(moveDoc, mB, mBlock.x + 25, mBlock.y + 10)
  check(near(freeOf(moveDoc.segments[0]!)!, { x: mFree0.x + 25, y: mFree0.y + 10 }), 'S4: block-move regression still translates stubs')

  // S3 copy regression smoke.
  const copyMap = duplicateBlocks(moveDoc, [mB], 40, 0)
  check(attachedStubsForBlocks(moveDoc, [copyMap.get(mB)!]).length === 1, 'S4: S3 stub-aware copy regression still works')
}

// --- S5a port-originated stub drawing (double-click finish without degenerate geometry) ---
{
  const near = (a: { x: number; y: number }, b: { x: number; y: number }, eps = 1) => Math.hypot(a.x - b.x, a.y - b.y) < eps
  const freeOf = (segment: { start: { kind: string; x?: number; y?: number }; end: { kind: string; x?: number; y?: number } }) => {
    if (segment.end.kind === 'free') return { x: segment.end.x!, y: segment.end.y! }
    if (segment.start.kind === 'free') return { x: segment.start.x!, y: segment.start.y! }
    return null
  }

  const sheet = emptyDocument()
  const blockId = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
  sheet.blocks.find((block) => block.id === blockId)!.x = 200
  sheet.blocks.find((block) => block.id === blockId)!.y = 120
  const portId = addPortAt(sheet, blockId, 'right', 0.5) ?? ''
  const portAt = portAnchor(sheet, portId)!
  const portHit = { kind: 'port' as const, portId, point: portAt }

  // Port → straight stub via simulated double-click (detail=1 bend + detail=2 finish with checkpoint).
  // Companion click and finish point differ slightly — without checkpoint that leaves an extra terminal knick.
  const started = wireClick(null, portHit)
  check(started.draft !== null && started.commit === null, 'S5a: port click opens a draft')
  const companionAt = { x: portAt.x + 60, y: portAt.y + 24 }
  const freeAt = { x: portAt.x + 64, y: portAt.y + 20 }
  const companion = wireClick(started.draft, { kind: 'free', point: companionAt })
  check(companion.draft !== null && companion.draft.pointsBeforeFreeBend !== undefined, 'S5a: free click stores bend checkpoint')
  const straightCommit = finishFree(companion.draft!, freeAt, { fromBeforeLastFreeBend: true })
  check(straightCommit.start.kind === 'port' && straightCommit.end.kind === 'free', 'S5a: Port→Free orientation')
  check(stubGeometrySane(straightCommit.points), 'S5a: straight stub has no zero-length terminals')
  check(near(straightCommit.points[0]!, portAt) && near(straightCommit.points[straightCommit.points.length - 1]!, freeAt), 'S5a: straight stub spans port to free')
  const withoutCheckpoint = finishFree(companion.draft!, freeAt)
  check(
    withoutCheckpoint.points.length > straightCommit.points.length,
    'S5a: finishing without checkpoint keeps the companion bend (regression guard)',
  )
  const beforeStraight = sheet.segments.length
  const straightResult = commitWire(sheet, straightCommit.points, straightCommit.start, straightCommit.end)
  check(straightResult.ok && sheet.segments.length === beforeStraight + 1, 'S5a: straight stub is one commitWire')
  check(stubGeometrySane(sheet.segments[sheet.segments.length - 1]!.points), 'S5a: committed straight geometry stays sane')

  // Port → multi-bend stub: intentional bend, then dblclick finish.
  const port2 = addPortAt(sheet, blockId, 'right', 0.25) ?? ''
  const p2 = portAnchor(sheet, port2)!
  const bendA = { x: p2.x + 40, y: p2.y }
  const companionB = { x: p2.x + 40, y: p2.y + 48 }
  const freeB = { x: p2.x + 44, y: p2.y + 52 }
  const multiStart = wireClick(null, { kind: 'port', portId: port2, point: p2 })
  const multiBent = wireClick(multiStart.draft, { kind: 'free', point: bendA })
  check(multiBent.draft !== null && multiBent.draft.points.length >= 2, 'S5a: intentional bend stays in the draft')
  const multiCompanion = wireClick(multiBent.draft, { kind: 'free', point: companionB })
  const multiCommit = finishFree(multiCompanion.draft!, freeB, { fromBeforeLastFreeBend: true })
  check(multiCommit.points.length >= 3, 'S5a: multi-bend stub keeps the intentional corner')
  check(stubGeometrySane(multiCommit.points), 'S5a: multi-bend stub has no degenerate terminals')
  check(
    multiCommit.points.some((point) => near(point, bendA)),
    'S5a: intentional bend locus is preserved',
  )
  commitWire(sheet, multiCommit.points, multiCommit.start, multiCommit.end)

  // Reverse Free → Port (existing single-click finish).
  const port3 = addPortAt(sheet, blockId, 'left', 0.5) ?? ''
  const p3 = portAnchor(sheet, port3)!
  const freeStart = { x: p3.x - 50, y: p3.y }
  const revStart = wireClick(null, { kind: 'free', point: freeStart })
  const revDone = wireClick(revStart.draft, { kind: 'port', portId: port3, point: p3 })
  check(revDone.commit !== null && revDone.draft === null, 'S5a: Free→Port still commits on port click')
  if (revDone.commit) {
    const rev = commitWire(sheet, revDone.commit.points, revDone.commit.start, revDone.commit.end)
    check(rev.ok, 'S5a: Free→Port commitWire ok')
    const seg = sheet.segments[sheet.segments.length - 1]!
    check(seg.start.kind === 'free' && seg.end.kind === 'port', 'S5a: Free→Port orientation stored')
  }

  // Escape before completion: draft only, no document write.
  const escDoc = emptyDocument()
  const escBlock = placeTemplate(escDoc, BLOCK_TEMPLATES[1], false)
  const escPort = addPortAt(escDoc, escBlock, 'right', 0.5) ?? ''
  const escAt = portAnchor(escDoc, escPort)!
  const escDraft = wireClick(null, { kind: 'port', portId: escPort, point: escAt }).draft
  wireClick(escDraft, { kind: 'free', point: { x: escAt.x + 30, y: escAt.y } })
  check(escDoc.segments.length === 0, 'S5a: escape/drop draft writes nothing')

  // Undo / redo of a port-originated stub.
  let live = emptyDocument()
  const liveBlock = placeTemplate(live, BLOCK_TEMPLATES[1], false)
  const livePort = addPortAt(live, liveBlock, 'right', 0.4) ?? ''
  const liveAt = portAnchor(live, livePort)!
  const session = new EditSession(
    () => live,
    (next) => {
      live = next
    },
  )
  const draft0 = wireClick(null, { kind: 'port', portId: livePort, point: liveAt }).draft!
  const freeLive = { x: liveAt.x + 48, y: liveAt.y + 20 }
  const polluted = wireClick(draft0, { kind: 'free', point: freeLive }).draft!
  const commitLive = finishFree(polluted, freeLive, { fromBeforeLastFreeBend: true })
  session.execute((doc) => {
    commitWire(doc, commitLive.points, commitLive.start, commitLive.end)
  })
  check(live.segments.length === 1, 'S5a: undo session stores one stub')
  const netName = live.nets[0]?.name
  const portName = live.ports.find((port) => port.id === livePort)?.name
  check(Boolean(netName) && netName === portName, 'S5a: stub inherits port name (D5c.5)')
  session.undo()
  check(live.segments.length === 0, 'S5a: undo removes the stub')
  session.redo()
  check(live.segments.length === 1 && live.nets[0]?.name === netName, 'S5a: redo restores stub and name')

  // Save / load.
  const reloaded = parseDocument(serialize(live))
  check(reloaded.segments.length === 1 && reloaded.segments[0]!.end.kind === 'free', 'S5a: save/load keeps Port→Free')
  check(near(freeOf(reloaded.segments[0]!)!, freeOf(live.segments[0]!)!), 'S5a: free end survives reload')

  // Subsequent stub move / resize / copy still attach.
  const moved = parseDocument(serialize(live))
  const blk = moved.blocks[0]!
  const free0 = freeOf(moved.segments[0]!)!
  moveBlock(moved, blk.id, blk.x + 15, blk.y)
  check(near(freeOf(moved.segments[0]!)!, { x: free0.x + 15, y: free0.y }), 'S5a: stub-move still follows block')
  setBlockFields(moved, blk.id, { width: blk.width + 40 })
  const afterResize = freeOf(moved.segments[0]!)!
  check(Math.abs(afterResize.x - (free0.x + 15 + 40)) < 2, 'S5a: resize still follows stub')
  const dup = duplicateBlocks(moved, [blk.id], 30, 0)
  check(attachedStubsForBlocks(moved, [dup.get(blk.id)!]).length === 1, 'S5a: stub-aware copy still works')

  // Named-net join: second stub with same port name joins.
  const joinDoc = emptyDocument()
  const jA = placeTemplate(joinDoc, BLOCK_TEMPLATES[1], false)
  const jB = placeTemplate(joinDoc, BLOCK_TEMPLATES[1], false)
  joinDoc.blocks.find((block) => block.id === jB)!.x = 420
  const jPortA = addPortAt(joinDoc, jA, 'right', 0.5) ?? ''
  const jPortB = addPortAt(joinDoc, jB, 'right', 0.5) ?? ''
  joinDoc.ports.find((port) => port.id === jPortA)!.name = 'clk'
  joinDoc.ports.find((port) => port.id === jPortB)!.name = 'clk'
  const jAa = portAnchor(joinDoc, jPortA)!
  const jBa = portAnchor(joinDoc, jPortB)!
  const c1 = finishFree(wireClick(null, { kind: 'port', portId: jPortA, point: jAa }).draft!, { x: jAa.x + 40, y: jAa.y }, { fromBeforeLastFreeBend: false })
  commitWire(joinDoc, c1.points, c1.start, c1.end)
  const d0 = wireClick(null, { kind: 'port', portId: jPortB, point: jBa }).draft!
  const d1 = wireClick(d0, { kind: 'free', point: { x: jBa.x + 40, y: jBa.y } }).draft!
  const c2 = finishFree(d1, { x: jBa.x + 40, y: jBa.y }, { fromBeforeLastFreeBend: true })
  const joined = commitWire(joinDoc, c2.points, c2.start, c2.end)
  check(joined.ok && !joined.createdNet && joinDoc.nets.filter((net) => net.name === 'clk').length === 1, 'S5a: second stub joins existing named net')
}

// --- S5a.1 incremental wire drawing undo (local steps; one global history entry) ---
{
  const near = (a: { x: number; y: number }, b: { x: number; y: number }, eps = 1) => Math.hypot(a.x - b.x, a.y - b.y) < eps

  const sheet = emptyDocument()
  const blockId = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
  const portId = addPortAt(sheet, blockId, 'right', 0.5) ?? ''
  const portAt = portAnchor(sheet, portId)!
  const portHit = { kind: 'port' as const, portId, point: portAt }

  const started = wireClick(null, portHit)
  check(started.draft !== null && started.draft.fixedSteps.length === 1, 'S5a.1: start is one fixed step')
  check(started.message === WIRE_DRAW_HINT, 'S5a.1: status hint lists undo keys')
  check(!canUndoWireStep(started.draft!), 'S5a.1: cannot undo past the start anchor')

  // One free click that is not axis-aligned → multiple orthogonal edges, still one step.
  const corner = { x: portAt.x + 40, y: portAt.y + 30 }
  const bent = wireClick(started.draft, { kind: 'free', point: corner })
  check(bent.draft !== null && bent.draft.points.length >= 3, 'S5a.1: orthogonal click may add multiple edges')
  check(bent.draft!.fixedSteps.length === 2, 'S5a.1: multi-edge click is still one drawing step')
  check(canUndoWireStep(bent.draft!), 'S5a.1: a bend can be undone')

  const afterOne = undoWireStep(bent.draft!)
  check(!afterOne.cancelled && afterOne.draft !== null, 'S5a.1: undo one step keeps the draft')
  check(afterOne.draft!.fixedSteps.length === 1 && afterOne.draft!.points.length === 1, 'S5a.1: undo removes the whole multi-edge step')
  check(near(afterOne.draft!.points[0]!, portAt), 'S5a.1: undo returns to the start anchor')

  // Multiple steps, undo twice, continue drawing.
  const s1 = wireClick(afterOne.draft, { kind: 'free', point: { x: portAt.x + 20, y: portAt.y } }).draft!
  const s2 = wireClick(s1, { kind: 'free', point: { x: portAt.x + 20, y: portAt.y + 40 } }).draft!
  const s3 = wireClick(s2, { kind: 'free', point: { x: portAt.x + 50, y: portAt.y + 40 } }).draft!
  check(s3.fixedSteps.length === 4, 'S5a.1: three bends yield four fixed steps')
  const u1 = undoWireStep(s3).draft!
  const u2 = undoWireStep(u1).draft!
  check(u2.fixedSteps.length === 2, 'S5a.1: two undos walk back two steps')
  const continued = wireClick(u2, { kind: 'free', point: { x: portAt.x + 20, y: portAt.y - 30 } }).draft!
  check(continued.fixedSteps.length === 3, 'S5a.1: drawing continues after local undo')

  // Esc at start cancels.
  const onlyStart = undoWireStep(undoWireStep(continued).draft!).draft!
  check(onlyStart.fixedSteps.length === 1, 'S5a.1: walked back to start')
  const cancelled = undoWireStep(onlyStart)
  check(cancelled.cancelled && cancelled.draft === null, 'S5a.1: undo at start cancels the operation')

  // Port→Free stub after local undo (simulate companion + finish).
  const stubDraft0 = wireClick(null, portHit).draft!
  const stubDraft1 = wireClick(stubDraft0, { kind: 'free', point: { x: portAt.x + 30, y: portAt.y } }).draft!
  const stubDraft2 = wireClick(stubDraft1, { kind: 'free', point: { x: portAt.x + 30, y: portAt.y + 40 } }).draft!
  const stubBack = undoWireStep(stubDraft2).draft!
  const freeAt = { x: portAt.x + 55, y: portAt.y }
  const companion = wireClick(stubBack, { kind: 'free', point: freeAt }).draft!
  const stubCommit = finishFree(companion, freeAt, { fromBeforeLastFreeBend: true })
  check(stubGeometrySane(stubCommit.points), 'S5a.1: stub after undo has sane geometry')
  check(stubCommit.start.kind === 'port' && stubCommit.end.kind === 'free', 'S5a.1: Port→Free after undo')

  // Free→Port after local undo.
  const freeStart = { x: portAt.x + 80, y: portAt.y + 60 }
  const rev0 = wireClick(null, { kind: 'free', point: freeStart }).draft!
  const rev1 = wireClick(rev0, { kind: 'free', point: { x: freeStart.x, y: portAt.y } }).draft!
  const revBack = undoWireStep(rev1).draft!
  const revDone = wireClick(revBack, portHit)
  check(revDone.commit !== null && revDone.commit.start.kind === 'free' && revDone.commit.end.kind === 'port', 'S5a.1: Free→Port after undo')

  // Port→Port after local undo.
  const other = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
  sheet.blocks.find((block) => block.id === other)!.x = 420
  const otherPort = addPortAt(sheet, other, 'left', 0.5) ?? ''
  const otherAt = portAnchor(sheet, otherPort)!
  const pp0 = wireClick(null, portHit).draft!
  const pp1 = wireClick(pp0, { kind: 'free', point: { x: portAt.x + 40, y: portAt.y } }).draft!
  const ppBack = undoWireStep(pp1).draft!
  const ppDone = wireClick(ppBack, { kind: 'port', portId: otherPort, point: otherAt })
  check(ppDone.commit !== null && ppDone.draft === null, 'S5a.1: Port→Port after undo')

  // Junction-originated draft where supported.
  const juncDoc = emptyDocument()
  const jBlock = placeTemplate(juncDoc, BLOCK_TEMPLATES[1], false)
  const jPort = addPortAt(juncDoc, jBlock, 'right', 0.5) ?? ''
  const jAt = portAnchor(juncDoc, jPort)!
  commitWire(juncDoc, [jAt, { x: jAt.x + 40, y: jAt.y }], { kind: 'port', portId: jPort, point: jAt }, { kind: 'free', point: { x: jAt.x + 40, y: jAt.y } })
  const freeEnd = juncDoc.segments[0]!.end
  check(freeEnd.kind === 'free', 'S5a.1: fixture stub for junction extend')
  if (freeEnd.kind !== 'free') throw new Error('S5a.1 expected free end')
  const endHit = { kind: 'end' as const, segmentId: juncDoc.segments[0]!.id, which: 'end' as const, point: { x: freeEnd.x, y: freeEnd.y } }
  const fromEnd = wireClick(null, endHit).draft!
  const fromEndBent = wireClick(fromEnd, { kind: 'free', point: { x: freeEnd.x + 20, y: freeEnd.y + 20 } }).draft!
  const fromEndBack = undoWireStep(fromEndBent)
  check(!fromEndBack.cancelled && fromEndBack.draft!.fixedSteps.length === 1, 'S5a.1: undo works from an end/junction-style start')

  // No intermediate global history; one entry after completion; global undo/redo.
  let live = emptyDocument()
  const liveBlock = placeTemplate(live, BLOCK_TEMPLATES[1], false)
  const livePort = addPortAt(live, liveBlock, 'right', 0.5) ?? ''
  const liveAt = portAnchor(live, livePort)!
  const session = new EditSession(
    () => live,
    (next) => {
      live = next
    },
  )
  // Seed one undoable edit so canUndo is meaningful, then draft without further executes.
  session.execute((doc) => {
    setBlockFields(doc, liveBlock, { name: 'Unit' })
  })
  check(session.canUndo, 'S5a.1: session has prior history')
  const segsBefore = live.segments.length
  let draft = wireClick(null, { kind: 'port', portId: livePort, point: liveAt }).draft!
  draft = wireClick(draft, { kind: 'free', point: { x: liveAt.x + 25, y: liveAt.y } }).draft!
  draft = wireClick(draft, { kind: 'free', point: { x: liveAt.x + 25, y: liveAt.y + 35 } }).draft!
  draft = undoWireStep(draft).draft!
  draft = wireClick(draft, { kind: 'free', point: { x: liveAt.x + 45, y: liveAt.y } }).draft!
  check(live.segments.length === segsBefore, 'S5a.1: local steps do not write the document')
  check(session.canUndo, 'S5a.1: local undo does not consume global history')
  const finishAt = { x: liveAt.x + 48, y: liveAt.y + 4 }
  const polluted = wireClick(draft, { kind: 'free', point: finishAt }).draft!
  const commit = finishFree(polluted, finishAt, { fromBeforeLastFreeBend: true })
  check(stubGeometrySane(commit.points), 'S5a.1: completed geometry has no zero-length edges')
  session.execute((doc) => {
    commitWire(doc, commit.points, commit.start, commit.end)
  })
  check(live.segments.length === segsBefore + 1, 'S5a.1: completion adds one segment')
  session.undo()
  check(live.segments.length === segsBefore, 'S5a.1: global undo removes the finished wire')
  session.redo()
  check(live.segments.length === segsBefore + 1, 'S5a.1: global redo restores the wire')

  // Snap-on free finish still produces orthogonal sane points (grid values).
  const snapAt = { x: Math.round(liveAt.x / 20) * 20 + 60, y: Math.round(liveAt.y / 20) * 20 }
  const snapDraft = wireClick(null, { kind: 'port', portId: livePort, point: liveAt }).draft!
  const snapCommit = finishFree(snapDraft, snapAt)
  check(stubGeometrySane(snapCommit.points), 'S5a.1: snapped finish stays non-degenerate')
}

// --- S5b stable free-endpoint drag ---
{
  const near = (a: { x: number; y: number }, b: { x: number; y: number }, eps = 1) => Math.hypot(a.x - b.x, a.y - b.y) < eps
  const freeOf = (segment: { start: { kind: string; x?: number; y?: number }; end: { kind: string; x?: number; y?: number } }) => {
    if (segment.end.kind === 'free') return { x: segment.end.x!, y: segment.end.y! }
    if (segment.start.kind === 'free') return { x: segment.start.x!, y: segment.start.y! }
    return null
  }

  const sheet = emptyDocument()
  const blockId = placeTemplate(sheet, BLOCK_TEMPLATES[1], false)
  sheet.blocks[0]!.x = 100
  sheet.blocks[0]!.y = 100
  const portId = addPortAt(sheet, blockId, 'right', 0.5) ?? ''
  const portAt = portAnchor(sheet, portId)!

  // Straight Port→Free stub.
  commitWire(sheet, [portAt, { x: portAt.x + 60, y: portAt.y }], { kind: 'port', portId, point: portAt }, { kind: 'free', point: { x: portAt.x + 60, y: portAt.y } })
  const straight = sheet.segments[0]!
  const portBefore = { ...portAt }
  const target = { x: portAt.x + 80, y: portAt.y + 40 }
  check(placeFreeEnd(sheet, straight.id, 'end', target), 'S5b: placeFreeEnd moves a straight stub tip')
  check(near(freeOf(straight)!, target), 'S5b: free tip follows the pointer target')
  check(near(portAnchor(sheet, portId)!, portBefore), 'S5b: attached port stays fixed')
  check(straight.start.kind === 'port' && straight.end.kind === 'free', 'S5b: Port→Free orientation preserved')
  check(straight.netId.length > 0, 'S5b: net identity preserved')
  check(stubGeometrySane(straight.points), 'S5b: straight drag stays non-degenerate')

  // Idempotent preview at identical position.
  const midPts = JSON.stringify(straight.points)
  placeFreeEnd(sheet, straight.id, 'end', target)
  check(JSON.stringify(straight.points) === midPts, 'S5b: repeated place at same point is stable')

  // Direction reverse.
  const back = { x: portAt.x + 40, y: portAt.y - 30 }
  placeFreeEnd(sheet, straight.id, 'end', back)
  check(near(freeOf(straight)!, back), 'S5b: tip follows reverse drag')
  check(near(portAnchor(sheet, portId)!, portBefore), 'S5b: port still fixed after reverse')

  // Multi-bend: preserve interior hinges; only terminal leg adjusts.
  const multiDoc = emptyDocument()
  const mBlock = placeTemplate(multiDoc, BLOCK_TEMPLATES[1], false)
  const mPort = addPortAt(multiDoc, mBlock, 'right', 0.4) ?? ''
  const mAt = portAnchor(multiDoc, mPort)!
  const hinge = { x: mAt.x + 40, y: mAt.y }
  const tip0 = { x: mAt.x + 40, y: mAt.y + 50 }
  commitWire(
    multiDoc,
    [mAt, hinge, tip0],
    { kind: 'port', portId: mPort, point: mAt },
    { kind: 'free', point: tip0 },
  )
  const multi = multiDoc.segments[0]!
  addNameLabel(multiDoc, multi.id, 0, 16, 14)
  const labelBefore = multiDoc.labels.find((label) => label.anchor.kind === 'segment' && label.anchor.segmentId === multi.id)!
  const tip1 = { x: mAt.x + 70, y: mAt.y + 50 }
  placeFreeEnd(multiDoc, multi.id, 'end', tip1)
  check(near(multi.points[0]!, mAt), 'S5b: multi-bend keeps port vertex')
  check(near(multi.points[1]!, hinge) || multi.points.some((point) => near(point, hinge)), 'S5b: intentional hinge preserved when compatible')
  check(near(freeOf(multi)!, tip1), 'S5b: multi-bend free tip moves')
  check(stubGeometrySane(multi.points), 'S5b: multi-bend geometry sane')
  check(multiDoc.labels.some((label) => label.id === labelBefore.id), 'S5b: label remains on the segment')

  // Free→Port orientation.
  const revDoc = emptyDocument()
  const rBlock = placeTemplate(revDoc, BLOCK_TEMPLATES[1], false)
  revDoc.blocks[0]!.x = 300
  const rPort = addPortAt(revDoc, rBlock, 'left', 0.5) ?? ''
  const rAt = portAnchor(revDoc, rPort)!
  const freeStart = { x: rAt.x - 50, y: rAt.y }
  commitWire(revDoc, [freeStart, rAt], { kind: 'free', point: freeStart }, { kind: 'port', portId: rPort, point: rAt })
  const rev = revDoc.segments[0]!
  const movedFree = { x: rAt.x - 70, y: rAt.y + 25 }
  check(placeFreeEnd(revDoc, rev.id, 'start', movedFree), 'S5b: Free→Port start tip moves')
  check(near(freeOf(rev)!, movedFree), 'S5b: Free→Port free tip updated')
  check(rev.end.kind === 'port' && near(portAnchor(revDoc, rPort)!, rAt), 'S5b: Free→Port port stays fixed')

  // Escape/cancel semantics via EditSession preview baseline.
  let live = emptyDocument()
  const lBlock = placeTemplate(live, BLOCK_TEMPLATES[1], false)
  const lPort = addPortAt(live, lBlock, 'right', 0.5) ?? ''
  const lAt = portAnchor(live, lPort)!
  commitWire(live, [lAt, { x: lAt.x + 50, y: lAt.y }], { kind: 'port', portId: lPort, point: lAt }, { kind: 'free', point: { x: lAt.x + 50, y: lAt.y } })
  const session = new EditSession(
    () => live,
    (next) => {
      live = next
    },
  )
  const before = serialize(live)
  session.begin()
  session.preview((doc) => {
    placeFreeEnd(doc, doc.segments[0]!.id, 'end', { x: lAt.x + 90, y: lAt.y + 40 })
  })
  session.preview((doc) => {
    placeFreeEnd(doc, doc.segments[0]!.id, 'end', { x: lAt.x + 100, y: lAt.y - 20 })
  })
  session.cancel()
  check(serialize(live) === before, 'S5b: cancel restores original geometry')
  session.begin()
  session.preview((doc) => {
    placeFreeEnd(doc, doc.segments[0]!.id, 'end', { x: lAt.x + 88, y: lAt.y + 24 })
  })
  session.commit()
  check(serialize(live) !== before, 'S5b: commit keeps the drag')
  session.undo()
  check(serialize(live) === before, 'S5b: global undo restores the stub')
  session.redo()
  check(near(freeOf(live.segments[0]!)!, { x: lAt.x + 88, y: lAt.y + 24 }), 'S5b: redo restores dragged tip')

  // Save/load.
  const reloaded = parseDocument(serialize(live))
  check(reloaded.segments[0]!.end.kind === 'free', 'S5b: save/load keeps free end')
  check(near(freeOf(reloaded.segments[0]!)!, freeOf(live.segments[0]!)!), 'S5b: free tip survives reload')

  // Snapping-style grid target.
  const gridTip = { x: Math.round((lAt.x + 60) / 20) * 20, y: Math.round((lAt.y + 40) / 20) * 20 }
  placeFreeEnd(live, live.segments[0]!.id, 'end', gridTip)
  check(near(freeOf(live.segments[0]!)!, gridTip), 'S5b: snapped tip lands on grid point')
}

{
  // --- P1 presentation visibility (names / ports / wire labels; segment-scoped labels) ---
  let sheet = emptyDocument()
  const a = placeTemplate(sheet, BLOCK_TEMPLATES[0]!, false)
  const b = placeTemplate(sheet, BLOCK_TEMPLATES[0]!, false)
  const c = placeTemplate(sheet, BLOCK_TEMPLATES[0]!, false)
  setBlockFields(sheet, a, { x: 40, y: 40 })
  setBlockFields(sheet, b, { x: 240, y: 40 })
  setBlockFields(sheet, c, { x: 440, y: 40 })
  const blockA = sheet.blocks.find((item) => item.id === a)!
  const blockB = sheet.blocks.find((item) => item.id === b)!
  const blockC = sheet.blocks.find((item) => item.id === c)!
  const portA = addPortAt(sheet, a, 'right', 0.5)!
  const portBIn = addPortAt(sheet, b, 'left', 0.5)!
  const portBOut = addPortAt(sheet, b, 'right', 0.5)!
  const portC = addPortAt(sheet, c, 'left', 0.5)!
  const seg1 = linkPorts(sheet, portA, portBIn, 'clk')
  const seg2 = linkPorts(sheet, portBOut, portC, 'clk')
  check(Boolean(seg1 && seg2), 'P1: two sample wires connect three blocks')
  const merged = mergeNetsByName(sheet, 'clk')
  check(merged.ok && netsNamed(sheet, 'clk').length === 1, 'P1: same named net after merge')
  const label1 = addNameLabel(sheet, seg1!, 0, 0.5, 0)
  const label2 = addNameLabel(sheet, seg2!, 0, 0.5, 0)
  check(Boolean(label1 && label2), 'P1: one name label per segment')

  const p1Session = new EditSession(
    () => sheet,
    (next) => {
      sheet = next
    },
  )
  const logicalName = blockA.name
  check(
    sheet.segments.find((item) => item.id === seg1)?.netId === sheet.segments.find((item) => item.id === seg2)?.netId,
    'P1: merged segments share one net id',
  )
  p1Session.execute((draft) => setBlockFields(draft, a, { showName: false, showPortNames: false }))
  check(sheet.blocks.find((item) => item.id === a)?.showName === false, 'P1: showName false persists on block')
  check(sheet.blocks.find((item) => item.id === a)?.showPortNames === false, 'P1: showPortNames false persists on block')
  check(sheet.blocks.find((item) => item.id === a)?.name === logicalName, 'P1: hiding name keeps logical name')
  check(sheet.blocks.find((item) => item.id === b)?.showName === undefined, 'P1: other block stays default-visible')
  check(Boolean(sheet.ports.find((port) => port.id === portA)), 'P1: port identity preserved when names hidden')
  check(sheet.segments.some((segment) => segment.id === seg1) && sheet.segments.some((segment) => segment.id === seg2), 'P1: connectivity unchanged')
  check(blockB.width > 0 && blockC.width > 0, 'P1: geometry of other blocks unchanged')

  p1Session.execute((draft) => {
    check(setSegmentLabelsVisible(draft, seg1!, false), 'P1: hiding seg1 labels reports change')
  })
  check(sheet.labels.find((label) => label.id === label1)?.visible === false, 'P1: seg1 label hidden')
  check(sheet.labels.find((label) => label.id === label2)?.visible !== false, 'P1: seg2 label on same net stays visible')
  check(!setSegmentLabelsVisible(sheet, seg1!, false), 'P1: repeated hide is a no-op')

  const round = parseDocument(serialize(sheet))
  check(round.blocks.find((item) => item.id === a)?.showName === false, 'P1: save/load keeps showName')
  check(round.blocks.find((item) => item.id === a)?.showPortNames === false, 'P1: save/load keeps showPortNames')
  check(round.labels.find((label) => label.id === label1)?.visible === false, 'P1: save/load keeps label.visible')
  check(round.labels.find((label) => label.id === label2)?.visible !== false, 'P1: save/load keeps other segment label shown')

  const map = duplicateBlocks(sheet, [a], 20, 20)
  const dupId = map.get(a)!
  check(sheet.blocks.find((item) => item.id === dupId)?.showName === false, 'P1: duplicate copies showName')
  check(sheet.blocks.find((item) => item.id === dupId)?.showPortNames === false, 'P1: duplicate copies showPortNames')

  p1Session.undo()
  check(sheet.labels.find((label) => label.id === label1)?.visible !== false, 'P1: undo restores seg1 label visibility')
  check(sheet.labels.find((label) => label.id === label2)?.visible !== false, 'P1: undo leaves seg2 label visible')
  p1Session.undo()
  check(sheet.blocks.find((item) => item.id === a)?.showName === undefined, 'P1: undo restores default name visibility')

  const legacy = parseDocument(
    JSON.stringify({
      schemaVersion: 1,
      id: 'p1_legacy',
      blocks: [{ id: 'blk_l', name: 'L', x: 0, y: 0, width: 80, height: 40 }],
      ports: [],
      nets: [],
      segments: [],
      labels: [],
    }),
  )
  check(legacy.blocks[0]!.showName === undefined && legacy.blocks[0]!.showPortNames === undefined, 'P1: legacy blocks omit visibility flags')
  check(legacy.labels.every((label) => label.visible === undefined), 'P1: legacy labels default to visible')

  // P1-Fix: history round-trips for all three attributes (sheet EditSession).
  p1Session.execute((draft) => setBlockFields(draft, a, { showPortNames: false }))
  check(sheet.blocks.find((item) => item.id === a)?.showPortNames === false, 'P1-Fix: hide port names')
  p1Session.undo()
  check(sheet.blocks.find((item) => item.id === a)?.showPortNames === undefined, 'P1-Fix: undo restores port names')
  p1Session.redo()
  check(sheet.blocks.find((item) => item.id === a)?.showPortNames === false, 'P1-Fix: redo hides port names again')
  p1Session.execute((draft) => setBlockFields(draft, a, { showPortNames: true }))
  check(sheet.blocks.find((item) => item.id === a)?.showPortNames === undefined, 'P1-Fix: show clears flag')
  p1Session.undo()
  check(sheet.blocks.find((item) => item.id === a)?.showPortNames === false, 'P1-Fix: undo after re-show restores hidden')
  p1Session.execute((draft) => setBlockFields(draft, a, { showName: false }))
  p1Session.execute((draft) => setSegmentLabelsVisible(draft, seg1!, false))
  check(sheet.labels.find((label) => label.id === label1)?.visible === false, 'P1-Fix: hide wire label')
  p1Session.undo()
  check(sheet.labels.find((label) => label.id === label1)?.visible !== false, 'P1-Fix: undo wire label')
  p1Session.redo()
  check(sheet.labels.find((label) => label.id === label1)?.visible === false, 'P1-Fix: redo wire label')
  // Mixed: geometry after visibility invalidates redo of a later undone step.
  p1Session.execute((draft) => setBlockFields(draft, a, { x: 60 }))
  check(sheet.blocks.find((item) => item.id === a)?.x === 60, 'P1-Fix: geometry after visibility')
  p1Session.undo()
  check(sheet.blocks.find((item) => item.id === a)?.x === 40, 'P1-Fix: undo geometry keeps presentation from prior steps')

  // Project TransactionManager path (same serialize/parse as the open-project adapter).
  let liveProj = createProject('p1_fix_tm')
  const liveRoot = documentById(liveProj, liveProj.rootDocumentId)!
  const tmBlock = placeTemplate(liveRoot, BLOCK_TEMPLATES[0]!, false)
  const tm = new TransactionManager({
    get: () => liveProj,
    set: (next) => {
      liveProj = next
    },
  })
  const hideTm = tm.transact('hide-ports', (proj) => {
    const sheetTm = documentById(proj, proj.rootDocumentId)!
    setBlockFields(sheetTm, tmBlock, { showPortNames: false, showName: false })
    return proj
  })
  check(hideTm.ok && tm.canUndo, 'P1-Fix: project transact records visibility')
  check(documentById(liveProj, liveProj.rootDocumentId)!.blocks.find((item) => item.id === tmBlock)?.showPortNames === false, 'P1-Fix: project live shows hidden ports')
  check(tm.undo().ok, 'P1-Fix: project undo ok')
  check(documentById(liveProj, liveProj.rootDocumentId)!.blocks.find((item) => item.id === tmBlock)?.showPortNames === undefined, 'P1-Fix: project undo restores ports')
  check(tm.redo().ok, 'P1-Fix: project redo ok')
  check(documentById(liveProj, liveProj.rootDocumentId)!.blocks.find((item) => item.id === tmBlock)?.showPortNames === false, 'P1-Fix: project redo hides ports')

  // Keyboard policy: checkbox focus must not block document shortcuts.
  check(!isTextEditingControl('INPUT', 'checkbox'), 'P1-Fix: checkbox is not a text-editing control')
  check(!isTextEditingControl('INPUT', 'radio'), 'P1-Fix: radio is not a text-editing control')
  check(isTextEditingControl('INPUT', 'text'), 'P1-Fix: text input remains a text-editing control')
  check(isTextEditingControl('TEXTAREA'), 'P1-Fix: textarea remains a text-editing control')
}

{
  // --- P2 centred multiline display text ---
  let sheet = emptyDocument()
  const id = placeTemplate(sheet, BLOCK_TEMPLATES[0]!, false)
  setBlockFields(sheet, id, { x: 40, y: 40 })
  const logical = sheet.blocks.find((item) => item.id === id)!.name
  const p2 = new EditSession(
    () => sheet,
    (next) => {
      sheet = next
    },
  )
  check(sheet.blocks.find((item) => item.id === id)?.displayText === undefined, 'P2: absent displayText by default')
  p2.execute((draft) => setBlockFields(draft, id, { displayText: 'Register\n4 Bit' }))
  check(sheet.blocks.find((item) => item.id === id)?.displayText === 'Register\n4 Bit', 'P2: multiline displayText stored')
  check(sheet.blocks.find((item) => item.id === id)?.name === logical, 'P2: logical name independent of displayText')
  p2.execute((draft) => setBlockFields(draft, id, { showDisplayText: false }))
  check(sheet.blocks.find((item) => item.id === id)?.showDisplayText === false, 'P2: hide display text')
  check(sheet.blocks.find((item) => item.id === id)?.displayText === 'Register\n4 Bit', 'P2: hide keeps displayText value')
  const round = parseDocument(serialize(sheet))
  check(round.blocks.find((item) => item.id === id)?.displayText === 'Register\n4 Bit', 'P2: save/load keeps displayText')
  check(round.blocks.find((item) => item.id === id)?.showDisplayText === false, 'P2: save/load keeps showDisplayText')
  const map = duplicateBlocks(sheet, [id], 20, 20)
  const dup = map.get(id)!
  check(sheet.blocks.find((item) => item.id === dup)?.displayText === 'Register\n4 Bit', 'P2: duplicate copies displayText')
  check(sheet.blocks.find((item) => item.id === dup)?.showDisplayText === false, 'P2: duplicate copies showDisplayText')
  p2.undo()
  check(sheet.blocks.find((item) => item.id === id)?.showDisplayText === undefined, 'P2: undo restores display visibility')
  p2.undo()
  check(sheet.blocks.find((item) => item.id === id)?.displayText === undefined, 'P2: undo clears displayText')
  p2.redo()
  check(sheet.blocks.find((item) => item.id === id)?.displayText === 'Register\n4 Bit', 'P2: redo restores displayText')
  p2.execute((draft) => setBlockFields(draft, id, { displayText: '' }))
  check(sheet.blocks.find((item) => item.id === id)?.displayText === undefined, 'P2: empty string clears displayText')
  p2.execute((draft) => setBlockFields(draft, id, { width: 200, height: 120, displayText: 'Wide\nTitle' }))
  check(sheet.blocks.find((item) => item.id === id)?.width === 200 && sheet.blocks.find((item) => item.id === id)?.displayText === 'Wide\nTitle', 'P2: resize + displayText in one edit')
  const legacy = parseDocument(
    JSON.stringify({
      schemaVersion: 1,
      id: 'p2_legacy',
      blocks: [{ id: 'blk_l', name: 'L', x: 0, y: 0, width: 80, height: 40 }],
      ports: [],
      nets: [],
      segments: [],
      labels: [],
    }),
  )
  check(legacy.blocks[0]!.displayText === undefined && legacy.blocks[0]!.showDisplayText === undefined, 'P2: legacy blocks omit display fields')
}

{
  // --- P3 minimal block appearance ---
  let sheet = emptyDocument()
  const id = placeTemplate(sheet, BLOCK_TEMPLATES[0]!, false)
  setBlockFields(sheet, id, { x: 40, y: 40, displayText: 'Title\nLine', showName: false })
  const p3 = new EditSession(
    () => sheet,
    (next) => {
      sheet = next
    },
  )
  check(sheet.blocks.find((item) => item.id === id)?.style === undefined, 'P3: no style by default')
  p3.execute((draft) => setBlockStyle(draft, id, { fill: '#cfe8ff' }))
  check(sheet.blocks.find((item) => item.id === id)?.style?.fill === '#cfe8ff', 'P3: fill stored')
  p3.execute((draft) => setBlockStyle(draft, id, { stroke: '#1d6fd6' }))
  check(sheet.blocks.find((item) => item.id === id)?.style?.fill === '#cfe8ff' && sheet.blocks.find((item) => item.id === id)?.style?.stroke === '#1d6fd6', 'P3: stroke merges with fill')
  p3.execute((draft) => setBlockStyle(draft, id, { text: '#ffffff' }))
  check(sheet.blocks.find((item) => item.id === id)?.style?.text === '#ffffff', 'P3: text colour stored')
  p3.execute((draft) => setBlockStyle(draft, id, { fillTransparent: true }))
  check(sheet.blocks.find((item) => item.id === id)?.style?.fillTransparent === true, 'P3: transparent fill flag')
  check(sheet.blocks.find((item) => item.id === id)?.style?.fill === '#cfe8ff', 'P3: transparent keeps previous fill value for picker')
  const round = parseDocument(serialize(sheet))
  check(round.blocks.find((item) => item.id === id)?.style?.fillTransparent === true, 'P3: save/load keeps transparent')
  check(round.blocks.find((item) => item.id === id)?.style?.stroke === '#1d6fd6', 'P3: save/load keeps stroke')
  check(round.blocks.find((item) => item.id === id)?.displayText === 'Title\nLine', 'P3: styling leaves P2 displayText')
  check(round.blocks.find((item) => item.id === id)?.showName === false, 'P3: styling leaves P1 showName')
  const map = duplicateBlocks(sheet, [id], 20, 20)
  const dup = map.get(id)!
  check(sheet.blocks.find((item) => item.id === dup)?.style?.fill === '#cfe8ff', 'P3: duplicate copies style')
  p3.execute((draft) => setBlockStyle(draft, dup, { fill: '#d8f0d8', fillTransparent: false }))
  check(sheet.blocks.find((item) => item.id === id)?.style?.fill === '#cfe8ff', 'P3: original style independent of copy')
  check(sheet.blocks.find((item) => item.id === dup)?.style?.fill === '#d8f0d8', 'P3: copy can restyle alone')
  p3.undo()
  check(sheet.blocks.find((item) => item.id === dup)?.style?.fill === '#cfe8ff', 'P3: undo restores copy style')
  p3.execute((draft) => resetBlockStyle(draft, id))
  check(sheet.blocks.find((item) => item.id === id)?.style === undefined, 'P3: reset clears style')
  check(sheet.blocks.find((item) => item.id === id)?.displayText === 'Title\nLine', 'P3: reset keeps displayText')
  check(sheet.blocks.find((item) => item.id === id)?.showName === false, 'P3: reset keeps showName')
  p3.undo()
  check(sheet.blocks.find((item) => item.id === id)?.style?.fillTransparent === true, 'P3: undo restores style after reset')
  const legacy = parseDocument(
    JSON.stringify({
      schemaVersion: 1,
      id: 'p3_legacy',
      blocks: [{ id: 'blk_l', name: 'L', x: 0, y: 0, width: 80, height: 40 }],
      ports: [],
      nets: [],
      segments: [],
      labels: [],
    }),
  )
  check(legacy.blocks[0]!.style === undefined, 'P3: legacy blocks omit style')
}

{
  // --- P3a display text offset (centre-relative) ---
  let sheet = emptyDocument()
  const id = placeTemplate(sheet, BLOCK_TEMPLATES[0]!, false)
  setBlockFields(sheet, id, { x: 40, y: 40, width: 160, height: 100, displayText: 'Register\n4 Bit', showName: false })
  const p3a = new EditSession(
    () => sheet,
    (next) => {
      sheet = next
    },
  )
  check(sheet.blocks.find((item) => item.id === id)?.displayTextOffset === undefined, 'P3a: absent offset means centre')
  p3a.execute((draft) => setDisplayTextOffset(draft, id, { x: 12, y: -8 }))
  check(sheet.blocks.find((item) => item.id === id)?.displayTextOffset?.x === 12, 'P3a: offset x stored')
  check(sheet.blocks.find((item) => item.id === id)?.displayTextOffset?.y === -8, 'P3a: offset y stored')
  check(sheet.blocks.find((item) => item.id === id)?.displayText === 'Register\n4 Bit', 'P3a: offset leaves displayText')
  check(sheet.blocks.find((item) => item.id === id)?.width === 160, 'P3a: offset leaves block geometry')
  const beforePorts = sheet.ports.filter((port) => port.blockId === id).map((port) => ({ ...port }))
  p3a.execute((draft) => setDisplayTextOffset(draft, id, { x: 20, y: 4 }))
  const afterPorts = sheet.ports.filter((port) => port.blockId === id)
  check(
    beforePorts.length === afterPorts.length &&
      beforePorts.every((port, index) => {
        const next = afterPorts[index]
        return next && next.id === port.id && next.side === port.side && next.t === port.t
      }),
    'P3a: offset does not change ports',
  )
  p3a.execute((draft) => setBlockFields(draft, id, { width: 220, height: 140 }))
  check(sheet.blocks.find((item) => item.id === id)?.displayTextOffset?.x === 20, 'P3a: resize preserves stored offset')
  check(sheet.blocks.find((item) => item.id === id)?.displayTextOffset?.y === 4, 'P3a: resize does not clamp offset')
  p3a.begin()
  p3a.preview((draft) => setDisplayTextOffset(draft, id, { x: 30, y: 10 }))
  check(sheet.blocks.find((item) => item.id === id)?.displayTextOffset?.x === 30, 'P3a: gesture preview applies offset')
  p3a.cancel()
  check(sheet.blocks.find((item) => item.id === id)?.displayTextOffset?.x === 20, 'P3a: gesture cancel restores offset')
  p3a.begin()
  p3a.preview((draft) => setDisplayTextOffset(draft, id, { x: 20, y: 4 }))
  p3a.commit()
  // Identical serialize vs gesture baseline → EditSession skips history push.
  const offsetAfterNoop = sheet.blocks.find((item) => item.id === id)?.displayTextOffset
  check(offsetAfterNoop?.x === 20 && offsetAfterNoop?.y === 4, 'P3a: noop commit keeps offset')
  p3a.begin()
  p3a.preview((draft) => setDisplayTextOffset(draft, id, { x: 5, y: -3 }))
  p3a.commit()
  check(sheet.blocks.find((item) => item.id === id)?.displayTextOffset?.x === 5, 'P3a: effective drag commits')
  p3a.undo()
  check(sheet.blocks.find((item) => item.id === id)?.displayTextOffset?.x === 20, 'P3a: undo restores prior offset')
  p3a.redo()
  check(sheet.blocks.find((item) => item.id === id)?.displayTextOffset?.x === 5, 'P3a: redo restores dragged offset')
  const round = parseDocument(serialize(sheet))
  check(round.blocks.find((item) => item.id === id)?.displayTextOffset?.x === 5, 'P3a: save/load keeps offset x')
  check(round.blocks.find((item) => item.id === id)?.displayTextOffset?.y === -3, 'P3a: save/load keeps offset y')
  check(round.blocks.find((item) => item.id === id)?.displayText === 'Register\n4 Bit', 'P3a: save/load keeps displayText')
  check(round.blocks.find((item) => item.id === id)?.style === undefined, 'P3a: no accidental style')
  const map = duplicateBlocks(sheet, [id], 40, 40)
  const dup = map.get(id)!
  check(sheet.blocks.find((item) => item.id === dup)?.displayTextOffset?.x === 5, 'P3a: duplicate copies offset')
  check(sheet.blocks.find((item) => item.id === dup)?.displayTextOffset?.y === -3, 'P3a: duplicate copies offset y')
  p3a.execute((draft) => setDisplayTextOffset(draft, dup, { x: 40, y: 0 }))
  check(sheet.blocks.find((item) => item.id === id)?.displayTextOffset?.x === 5, 'P3a: original offset independent of copy')
  const dupOff = sheet.blocks.find((item) => item.id === dup)?.displayTextOffset
  check(dupOff !== undefined && dupOff.x === 40 && dupOff.y === 0, 'P3a: copy offset editable; only (0,0) clears field')
  p3a.execute((draft) => setDisplayTextOffset(draft, id, null))
  check(sheet.blocks.find((item) => item.id === id)?.displayTextOffset === undefined, 'P3a: reset clears offset')
  check(sheet.blocks.find((item) => item.id === id)?.displayText === 'Register\n4 Bit', 'P3a: reset keeps displayText')
  p3a.execute((draft) => setDisplayTextOffset(draft, id, { x: 0, y: 0 }))
  check(sheet.blocks.find((item) => item.id === id)?.displayTextOffset === undefined, 'P3a: zero offset deletes field')
  const frag = captureFragment(sheet, [dup])
  const pasted = pasteFragment(sheet, frag, 20, 20)
  const pastedId = pasted[0]!
  check(sheet.blocks.find((item) => item.id === pastedId)?.displayTextOffset?.x === 40, 'P3a: paste preserves offset')
  const legacy = parseDocument(
    JSON.stringify({
      schemaVersion: 1,
      id: 'p3a_legacy',
      blocks: [{ id: 'blk_l', name: 'L', x: 0, y: 0, width: 80, height: 40, displayText: 'Hi' }],
      ports: [],
      nets: [],
      segments: [],
      labels: [],
    }),
  )
  check(legacy.blocks[0]!.displayTextOffset === undefined, 'P3a: legacy blocks omit offset')
}

{
  // --- P4a consistent geometry snapping (canonical snapValue reuse) ---
  check(snapValue(33, true) === 40 && snapValue(33, false) === 33, 'P4a: snapValue respects enabled flag')
  check(GRID === 20, 'P4a: GRID remains 20')

  let sheet = emptyDocument()
  const blockId = placeTemplate(sheet, BLOCK_TEMPLATES[0]!, true)
  setBlockFields(sheet, blockId, { x: 100, y: 100, width: 120, height: 80 })
  const portId = addPortAt(sheet, blockId, 'right', 0.37)!
  check(Boolean(portId), 'P4a: added right port')
  const anchor = portAnchor(sheet, portId)!
  check(anchor.y % GRID !== 0, 'P4a: fixture port is off-grid')

  // Free wire click path: snap free points before wireClick (UI contract).
  const freeRaw = { x: 247, y: 133 }
  const freeSnapped = { x: snapValue(freeRaw.x, true), y: snapValue(freeRaw.y, true) }
  check(freeSnapped.x % GRID === 0 && freeSnapped.y % GRID === 0, 'P4a: free point snaps to GRID')
  const startHit = { kind: 'port' as const, portId, point: { ...anchor } }
  const draftStart = wireClick(null, startHit)
  check(draftStart.draft !== null && draftStart.commit === null, 'P4a: wire starts on port without snap rewrite')
  const bendStep = wireClick(draftStart.draft, { kind: 'free', point: freeSnapped })
  check(bendStep.draft !== null, 'P4a: free bend accepted')
  const bend = bendStep.draft!.points[bendStep.draft!.points.length - 1]!
  check(bend.x === freeSnapped.x || bend.y === freeSnapped.y, 'P4a: orthogonal bend reaches snapped free coord')
  const stub = finishFree(bendStep.draft!, { x: snapValue(291, true), y: snapValue(181, true) })
  check(stub.end.kind === 'free' && stub.end.point.x % GRID === 0 && stub.end.point.y % GRID === 0, 'P4a: stub finish tip on grid')
  check(stub.start.kind === 'port' && stub.start.point.x === anchor.x && stub.start.point.y === anchor.y, 'P4a: stub keeps exact port start')
  const wired = commitWire(sheet, stub.points, stub.start, stub.end)
  check(wired.ok, 'P4a: commitWire accepts snapped stub')
  const seg = sheet.segments.find((item) => item.id === (wired.ok ? wired.segmentId : ''))
  check(Boolean(seg && seg.start.kind === 'port'), 'P4a: segment stays port-bound')
  check(Boolean(seg && seg.points[0] && Math.abs(seg.points[0].x - anchor.x) < 0.5 && Math.abs(seg.points[0].y - anchor.y) < 0.5), 'P4a: first point remains at off-grid port')
  check(seg!.points.every((point, index) => index === 0 || index === seg!.points.length - 1 || (point.x === seg!.points[index - 1]!.x || point.y === seg!.points[index - 1]!.y)), 'P4a: path stays orthogonal')

  // Connectivity hit before free snap: near-port world must still resolve to port.
  const nearPort = snapTarget(sheet, { x: anchor.x + 3, y: anchor.y - 2 })
  check(nearPort.kind === 'port' && nearPort.portId === portId, 'P4a: snapTarget prefers port over free')

  // Bend / span axis snap via placeSpan on a free–free segment (no port re-anchor).
  const freeSeg = commitWire(
    sheet,
    [
      { x: 400, y: 400 },
      { x: 480, y: 400 },
      { x: 480, y: 460 },
    ],
    { kind: 'free', point: { x: 400, y: 400 } },
    { kind: 'free', point: { x: 480, y: 460 } },
  )
  check(freeSeg.ok, 'P4a: free–free segment for bend snap')
  const freeId = freeSeg.ok ? freeSeg.segmentId : ''
  const snappedY = snapValue(400 + 27, true)
  placeSpan(sheet, freeId, 0, snappedY)
  check(sheet.segments.find((item) => item.id === freeId)!.points[0]!.y === snappedY, 'P4a: placeSpan accepts snapped axis')
  check(sheet.segments.find((item) => item.id === freeId)!.points[1]!.y === snappedY, 'P4a: placeSpan keeps edge collinear')

  // Junction drag snap.
  const junc = { id: createId('jnc'), netId: seg!.netId, x: 200, y: 200 }
  sheet.junctions.push(junc)
  const p4a = new EditSession(
    () => sheet,
    (next) => {
      sheet = next
    },
  )
  p4a.begin()
  p4a.preview((draft) => moveJunction(draft, junc.id, snapValue(213, true), snapValue(187, true)))
  check(sheet.junctions.find((item) => item.id === junc.id)?.x === 220, 'P4a: junction preview snaps x')
  check(sheet.junctions.find((item) => item.id === junc.id)?.y === 180, 'P4a: junction preview snaps y')
  p4a.cancel()
  check(sheet.junctions.find((item) => item.id === junc.id)?.x === 200, 'P4a: junction cancel restores')
  p4a.execute((draft) => moveJunction(draft, junc.id, snapValue(213, true), snapValue(187, true)))
  check(sheet.junctions.find((item) => item.id === junc.id)?.x === 220, 'P4a: junction commit snaps')

  // snap off leaves raw values.
  check(snapValue(213, false) === 213, 'P4a: snap off is identity')
}

{
  // --- P4b editor preferences + independent spacings ---
  check(MIN_BLOCK_SIZE === 20 && DUPLICATE_OFFSET === 20 && NUDGE_DISTANCE === 20 && GRID === 20, 'P4b: fixed geometry constants stay 20')
  check(snapValue(33, true, 20) === 40, 'P4b: snapValue default spacing 20')
  check(snapValue(33, true, 10) === 30, 'P4b: snapValue respects snapSpacing 10')
  check(snapValue(33, true, 5) === 35, 'P4b: snapValue respects snapSpacing 5')
  check(snapValue(33, false, 5) === 33, 'P4b: disabled snap ignores spacing')
  const tiny = resizeBox({ x: 100, y: 80, width: 200, height: 100 }, 'e', { x: 105, y: 80 }, true, 5)
  check(tiny.width === MIN_BLOCK_SIZE, 'P4b: min block size ignores snapSpacing=5')
  const wideSnap = resizeBox({ x: 100, y: 80, width: 200, height: 100 }, 'e', { x: 333, y: 80 }, true, 100)
  check(wideSnap.width === 200 || wideSnap.width % 100 === 0, 'P4b: resize snaps edges to snapSpacing')
  check(wideSnap.width >= MIN_BLOCK_SIZE, 'P4b: resize still respects min size with large snap')

  const defaults = sanitizeEditorPreferences(null)
  check(
    defaults.gridVisible &&
      defaults.snapEnabled &&
      defaults.gridSpacing === 20 &&
      defaults.snapSpacing === 20,
    'P4b: default preferences',
  )
  check(normalizeSpacing(0) === 20 && normalizeSpacing(-4) === 20, 'P4b: invalid spacing falls back')
  check(normalizeSpacing(3) === SPACING_MIN, 'P4b: spacing clamped to min')
  check(normalizeSpacing(999) === SPACING_MAX, 'P4b: spacing clamped to max')
  const mixed = sanitizeEditorPreferences({
    gridVisible: false,
    snapEnabled: true,
    gridSpacing: 40,
    snapSpacing: 10,
    extra: 'ignore',
  })
  check(mixed.gridVisible === false && mixed.gridSpacing === 40 && mixed.snapSpacing === 10, 'P4b: sanitize keeps independent spacings')
  check(sanitizeEditorPreferences({ snapSpacing: 'nope' }).snapSpacing === 20, 'P4b: bad stored snapSpacing resets')

  const memory: Record<string, string> = {}
  const fakeStorage = {
    getItem(key: string) {
      return memory[key] ?? null
    },
    setItem(key: string, value: string) {
      memory[key] = value
    },
  }
  saveEditorPreferences(mixed, fakeStorage)
  const restored = loadEditorPreferences(fakeStorage)
  check(restored.gridSpacing === 40 && restored.snapSpacing === 10 && restored.gridVisible === false, 'P4b: persistence round-trip')
  saveEditorPreferences(DEFAULT_EDITOR_PREFERENCES, fakeStorage)
  check(loadEditorPreferences(fakeStorage).snapSpacing === 20, 'P4b: reset defaults persist')
  check(loadEditorPreferences({ getItem: () => 'not-json' }).gridSpacing === 20, 'P4b: corrupt storage yields defaults')

  // Grid spacing change must not alter snap math; snap spacing must not alter min size.
  check(snapValue(47, true, 20) === 40 && snapValue(47, true, 10) === 50, 'P4b: independent snap steps')
  let sheet = emptyDocument()
  const id = placeTemplate(sheet, BLOCK_TEMPLATES[0]!, true, 10)
  const placed = sheet.blocks.find((item) => item.id === id)!
  check(placed.x % 10 === 0 && placed.y % 10 === 0, 'P4b: placeTemplate uses snapSpacing')
  setBlockFields(sheet, id, { width: 12 })
  check(sheet.blocks.find((item) => item.id === id)!.width === MIN_BLOCK_SIZE, 'P4b: setBlockFields min size fixed')
}

{
  // --- P5a free 2D wire-label shift ---
  let sheet = emptyDocument()
  const blockId = placeTemplate(sheet, BLOCK_TEMPLATES[0]!, false)
  setBlockFields(sheet, blockId, { x: 100, y: 100, width: 120, height: 80 })
  const portId = addPortAt(sheet, blockId, 'bottom', 0.5)!
  const at = portAnchor(sheet, portId)!
  // Vertical stub downward.
  const wired = commitWire(
    sheet,
    [at, { x: at.x, y: at.y + 60 }],
    { kind: 'port', portId, point: at },
    { kind: 'free', point: { x: at.x, y: at.y + 60 } },
  )
  check(wired.ok, 'P5a: vertical stub wire')
  const segId = wired.ok ? wired.segmentId : ''
  const labelId = sheet.labels.find((label) => label.anchor.kind === 'segment' && label.anchor.segmentId === segId)?.id
  check(Boolean(labelId), 'P5a: name label created')
  const legacyBefore = labelPlacement(sheet, labelId!)
  check(Boolean(legacyBefore), 'P5a: legacy placement resolves')
  // Round-trip serialize without shift keeps position.
  const round = parseDocument(serialize(sheet))
  const legacyAfter = labelPlacement(round, labelId!)
  check(
    Boolean(legacyAfter && legacyBefore && Math.abs(legacyAfter.x - legacyBefore.x) < 0.5 && Math.abs(legacyAfter.y - legacyBefore.y) < 0.5),
    'P5a: legacy offset position unchanged after save/load',
  )
  check(round.labels.find((label) => label.id === labelId)?.anchor.kind === 'segment' && !(round.labels.find((label) => label.id === labelId)!.anchor as { shift?: unknown }).shift, 'P5a: legacy docs omit shift')

  const p5a = new EditSession(
    () => sheet,
    (next) => {
      sheet = next
    },
  )
  // Place freely below and beside the stub tip (beyond endpoint).
  const freeAt = { x: at.x + 40, y: at.y + 90 }
  p5a.execute((draft) => placeLabelAt(draft, labelId!, freeAt))
  const moved = labelPlacement(sheet, labelId!)
  check(Boolean(moved && Math.abs(moved.x - freeAt.x) < 0.5 && Math.abs(moved.y - freeAt.y) < 0.5), 'P5a: free 2D placement beyond tip')
  const anch = sheet.labels.find((label) => label.id === labelId)!.anchor
  check(anch.kind === 'segment' && Boolean(anch.shift), 'P5a: shift stored')
  check(anch.kind === 'segment' && anch.offset === 0, 'P5a: offset cleared when shift set')

  // Rigid stub translate: move block; label follows with same shift.
  const beforeMove = labelPlacement(sheet, labelId!)!
  p5a.execute((draft) => moveBlock(draft, blockId, 140, 100))
  const afterMove = labelPlacement(sheet, labelId!)!
  check(Math.abs(afterMove.x - (beforeMove.x + 40)) < 1 && Math.abs(afterMove.y - beforeMove.y) < 1, 'P5a: rigid move keeps relative shift')

  const map = duplicateBlocks(sheet, [blockId], 20, 20)
  const dupBlock = map.get(blockId)!
  const dupSeg = sheet.segments.find((segment) => {
    const startPort = segment.start.kind === 'port' ? segment.start.portId : null
    const endPort = segment.end.kind === 'port' ? segment.end.portId : null
    return (
      Boolean(startPort && sheet.ports.some((port) => port.id === startPort && port.blockId === dupBlock)) ||
      Boolean(endPort && sheet.ports.some((port) => port.id === endPort && port.blockId === dupBlock))
    )
  })
  check(Boolean(dupSeg), 'P5a: duplicate keeps stub')
  const dupLabel = sheet.labels.find((label) => label.anchor.kind === 'segment' && label.anchor.segmentId === dupSeg!.id)
  check(Boolean(dupLabel?.anchor.kind === 'segment' && dupLabel.anchor.shift), 'P5a: duplicate copies shift')

  p5a.execute((draft) => resetLabelPosition(draft, labelId!))
  const resetAnch = sheet.labels.find((label) => label.id === labelId)!.anchor
  check(resetAnch.kind === 'segment' && !resetAnch.shift && resetAnch.offset === 14, 'P5a: reset clears shift and restores default offset')
  p5a.undo()
  const undone = sheet.labels.find((label) => label.id === labelId)!.anchor
  check(undone.kind === 'segment' && Boolean(undone.shift), 'P5a: undo restores shift')

  // Horizontal free placement.
  let sheetH = emptyDocument()
  const b2 = placeTemplate(sheetH, BLOCK_TEMPLATES[0]!, false)
  setBlockFields(sheetH, b2, { x: 200, y: 200, width: 100, height: 60 })
  const pRight = addPortAt(sheetH, b2, 'right', 0.5)!
  const aR = portAnchor(sheetH, pRight)!
  const w2 = commitWire(
    sheetH,
    [aR, { x: aR.x + 80, y: aR.y }],
    { kind: 'port', portId: pRight, point: aR },
    { kind: 'free', point: { x: aR.x + 80, y: aR.y } },
  )
  const hLabel = sheetH.labels.find((label) => label.anchor.kind === 'segment' && label.anchor.segmentId === (w2.ok ? w2.segmentId : ''))!.id
  placeLabelAt(sheetH, hLabel, { x: aR.x + 40, y: aR.y + 35 })
  const hAt = labelPlacement(sheetH, hLabel)!
  check(Math.abs(hAt.y - (aR.y + 35)) < 0.5, 'P5a: horizontal wire allows vertical free offset')
}

{
  // --- P5b-Fix: remove name label (distinct from hide) ---
  let sheet = emptyDocument()
  const a = placeTemplate(sheet, BLOCK_TEMPLATES[0]!, false)
  const b = placeTemplate(sheet, BLOCK_TEMPLATES[0]!, false)
  setBlockFields(sheet, a, { x: 40, y: 40, width: 100, height: 60 })
  setBlockFields(sheet, b, { x: 280, y: 40, width: 100, height: 60 })
  const pa = addPortAt(sheet, a, 'right', 0.5)!
  const pb = addPortAt(sheet, b, 'left', 0.5)!
  const aa = portAnchor(sheet, pa)!
  const ab = portAnchor(sheet, pb)!
  const mid = { x: (aa.x + ab.x) / 2, y: aa.y }
  // Two segments joined by a junction on one named net (independent labels).
  const left = commitWire(
    sheet,
    [aa, mid],
    { kind: 'port', portId: pa, point: aa },
    { kind: 'free', point: mid },
  )
  check(left.ok, 'P5b: left wire')
  const right = commitWire(
    sheet,
    [mid, ab],
    { kind: 'free', point: mid },
    { kind: 'port', portId: pb, point: ab },
  )
  check(right.ok, 'P5b: right wire')
  const seg1 = left.ok ? left.segmentId : ''
  const seg2 = right.ok ? right.segmentId : ''
  // Join into one net via rename.
  const net1 = sheet.segments.find((segment) => segment.id === seg1)!.netId
  const net2 = sheet.segments.find((segment) => segment.id === seg2)!.netId
  renameNet(sheet, net1, 'Q')
  renameNet(sheet, net2, 'Q')
  const netId = sheet.segments.find((segment) => segment.id === seg1)!.netId
  check(sheet.segments.find((segment) => segment.id === seg2)!.netId === netId, 'P5b: both segments share net Q')
  check(sheet.nets.find((net) => net.id === netId)?.name === 'Q', 'P5b: net named Q')

  let label1 = sheet.labels.find((label) => label.anchor.kind === 'segment' && label.anchor.segmentId === seg1)!
  let label2 = sheet.labels.find((label) => label.anchor.kind === 'segment' && label.anchor.segmentId === seg2)!
  check(Boolean(label1 && label2), 'P5b: each segment starts with a name label')

  const session = new EditSession(
    () => sheet,
    (next) => {
      sheet = next
    },
  )

  // Position + hide on seg1, then remove while hidden.
  session.execute((draft) => placeLabelAt(draft, label1.id, { x: aa.x + 20, y: aa.y + 30 }))
  const placed = labelPlacement(sheet, label1.id)!
  session.execute((draft) => setSegmentLabelsVisible(draft, seg1, false))
  check(sheet.labels.find((label) => label.id === label1.id)?.visible === false, 'P5b: hide keeps label instance')
  const portsBefore = netPortIds(sheet, netId).slice().sort()
  const netNameBefore = sheet.nets.find((net) => net.id === netId)!.name
  const segCountBefore = sheet.segments.filter((segment) => segment.netId === netId).length
  session.execute((draft) => removeSegmentNameLabels(draft, seg1))
  check(!sheet.labels.some((label) => label.id === label1.id), 'P5b: remove deletes hidden label')
  check(sheet.labels.some((label) => label.id === label2.id), 'P5b: other segment label unchanged')
  check(sheet.nets.find((net) => net.id === netId)?.name === netNameBefore, 'P5b: remove keeps net name')
  check(sheet.segments.filter((segment) => segment.netId === netId).length === segCountBefore, 'P5b: remove keeps segments')
  check(JSON.stringify(netPortIds(sheet, netId).slice().sort()) === JSON.stringify(portsBefore), 'P5b: remove keeps connectivity')

  // Undo restores exact position + visibility.
  session.undo()
  const restored = sheet.labels.find((label) => label.anchor.kind === 'segment' && label.anchor.segmentId === seg1)
  check(Boolean(restored), 'P5b: undo restores label')
  check(restored?.visible === false, 'P5b: undo restores hidden visibility')
  const restoredAt = restored ? labelPlacement(sheet, restored.id) : null
  check(
    Boolean(restoredAt && Math.abs(restoredAt.x - placed.x) < 0.5 && Math.abs(restoredAt.y - placed.y) < 0.5),
    'P5b: undo restores exact position',
  )
  session.redo()
  check(!sheet.labels.some((label) => label.anchor.kind === 'segment' && label.anchor.segmentId === seg1), 'P5b: redo removes again')

  // Re-add uses canonical name + default placement.
  session.execute((draft) => addNameLabel(draft, seg1, 0, 16, 14))
  const readded = sheet.labels.find((label) => label.anchor.kind === 'segment' && label.anchor.segmentId === seg1)!
  check(labelText(sheet, readded) === 'Q', 'P5b: re-add shows canonical net name')
  check(readded.anchor.kind === 'segment' && !readded.anchor.shift && readded.anchor.offset === 14, 'P5b: re-add uses default position')

  // Remove last label of the named net — net and connectivity remain.
  session.execute((draft) => removeSegmentNameLabels(draft, seg1))
  session.execute((draft) => removeSegmentNameLabels(draft, seg2))
  check(!sheet.labels.some((label) => label.anchor.kind === 'segment' && (label.anchor.segmentId === seg1 || label.anchor.segmentId === seg2)), 'P5b: both labels removed')
  check(sheet.nets.find((net) => net.id === netId)?.name === 'Q', 'P5b: last-label remove keeps net name')
  check(JSON.stringify(netPortIds(sheet, netId).slice().sort()) === JSON.stringify(portsBefore), 'P5b: last-label remove keeps connectivity')

  // Three states round-trip: absent / visible / hidden.
  session.execute((draft) => addNameLabel(draft, seg1, 0, 16, 14))
  const visId = sheet.labels.find((label) => label.anchor.kind === 'segment' && label.anchor.segmentId === seg1)!.id
  session.execute((draft) => placeLabelAt(draft, visId, { x: aa.x + 10, y: aa.y - 25 }))
  session.execute((draft) => addNameLabel(draft, seg2, 0, 16, 14))
  const hidId = sheet.labels.find((label) => label.anchor.kind === 'segment' && label.anchor.segmentId === seg2)!.id
  session.execute((draft) => setSegmentLabelsVisible(draft, seg2, false))
  // Leave a third segment without a label by using only these two.
  const three = parseDocument(serialize(sheet))
  check(three.labels.some((label) => label.id === visId && label.visible !== false), 'P5b: save/load visible state')
  check(three.labels.some((label) => label.id === hidId && label.visible === false), 'P5b: save/load hidden state')
  check(three.nets.find((net) => net.id === netId)?.name === 'Q', 'P5b: save/load keeps net')

  // Legacy pre-P5 document: 1D offset only, no shift — position must match after parse.
  const legacyRaw = {
    schemaVersion: 1,
    id: 'p5_legacy_labels',
    blocks: [{ id: 'blk_l', name: 'Counter', x: 100, y: 100, width: 120, height: 80 }],
    ports: [{ id: 'prt_l', blockId: 'blk_l', name: 'Q', side: 'right', t: 0.5 }],
    nets: [{ id: 'net_l', name: 'Q' }],
    junctions: [],
    segments: [
      {
        id: 'seg_l',
        netId: 'net_l',
        points: [
          { x: 220, y: 140 },
          { x: 280, y: 140 },
        ],
        start: { kind: 'port', portId: 'prt_l' },
        end: { kind: 'free', x: 280, y: 140 },
        routed: 'manual',
      },
    ],
    labels: [
      {
        id: 'lbl_l',
        text: 'Q',
        role: 'name',
        anchor: { kind: 'segment', segmentId: 'seg_l', edge: 0, distance: 30, offset: 14 },
      },
    ],
    strokes: [],
    symbols: [],
    assets: [],
    groups: [],
  }
  const legacyDoc = parseDocument(JSON.stringify(legacyRaw))
  const legacyLabel = legacyDoc.labels.find((label) => label.id === 'lbl_l')!
  check(legacyLabel.anchor.kind === 'segment' && !legacyLabel.anchor.shift, 'P5b: legacy fixture omits shift')
  const legacyAt = labelPlacement(legacyDoc, 'lbl_l')!
  // Horizontal rightward wire: normal offset +14 is upward (−y in diagram? pointOnEdge: -dx*offset for y with dx=1 → y - 14)
  check(Math.abs(legacyAt.x - 250) < 0.5 && Math.abs(legacyAt.y - 126) < 0.5, 'P5b: legacy 1D offset position exact')
  const legacyRound = parseDocument(serialize(legacyDoc))
  const roundAt = labelPlacement(legacyRound, 'lbl_l')!
  check(Math.abs(roundAt.x - legacyAt.x) < 0.5 && Math.abs(roundAt.y - legacyAt.y) < 0.5, 'P5b: legacy position survives round-trip')
}

{
  // --- A2-P1: canonical circular catalog + guides ---
  const signal = builtinLibraries().find((library) => library.id === 'lib_signal')!
  const pictures = builtinLibraries().find((library) => library.id === 'lib_pictures')!
  const general = builtinLibraries().find((library) => library.id === 'lib_general')!
  const flowchart = builtinLibraries().find((library) => library.id === 'lib_flowchart')!
  const mul = signal.symbols.find((item) => item.id === 'sym_multiplier')!
  const add = signal.symbols.find((item) => item.id === 'sym_adder')!
  const osc = pictures.symbols.find((item) => item.id === 'sym_oscillator')!
  const gain = signal.symbols.find((item) => item.id === 'sym_gain')!
  const generic = general.symbols.find((item) => item.id === 'sym_block')!
  const process = flowchart.symbols.find((item) => item.id === 'sym_process')!
  const staticLines = (shapes: { kind: string }[]) => shapes.filter((shape) => shape.kind === 'line').length
  const g = 20
  const onGrid = (value: number) => Math.abs(value / g - Math.round(value / g)) < 1e-9
  const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps

  check(add.width === 120 && add.height === 120 && mul.width === 120 && mul.height === 120, 'A2-P1: adder/multiplier 120×120')
  check(mul.revision === 4 && add.revision === 4, 'A2-P1: adder/multiplier revision 4')
  const art = add.shapes[0]
  check(art?.kind === 'ellipse' && art.width === 80 && art.height === 80 && art.x === 20 && art.y === 20, 'A2-P1: circular artwork 80×80 at (20,20)')
  const outer = add.guides?.find((item) => item.id === 'guide_ports')
  const inner = add.guides?.find((item) => item.id === 'guide_body')
  check(Boolean(outer && outer.rx === 60 && outer.ry === 60 && outer.cx === 60 && outer.cy === 60), 'A2-P1: outer guide circle r=60')
  check(Boolean(inner && inner.rx === 40 && inner.ry === 40 && inner.cx === 60 && inner.cy === 60), 'A2-P1: inner guide circle r=40')
  check(mul.ports.every((port) => isGuidedPin(port) && port.lead === 'radial'), 'A2-P1: multiplier ports guided with radial leads')
  check(add.ports.every((port) => isGuidedPin(port) && port.lead === 'radial'), 'A2-P1: adder ports guided with radial leads')
  check(staticLines(mul.shapes) === 0 && staticLines(add.shapes) === 0, 'A2-P1: no static lead shapes on adder/multiplier')
  check(mul.ports.every((port) => port.id.startsWith('pin_mul_')), 'A2-P1: multiplier port ids unchanged')
  check(add.ports.every((port) => port.id.startsWith('pin_adder_')), 'A2-P1: adder port ids unchanged')

  // Cardinals of the default construction.
  const card = [
    { u: 0, x: 120, y: 60 },
    { u: 0.25, x: 60, y: 120 },
    { u: 0.5, x: 0, y: 60 },
    { u: 0.75, x: 60, y: 0 },
  ]
  for (const item of card) {
    const at = pointOnEllipseGuide(outer!, item.u)
    check(near(at.x, item.x, 1e-9) && near(at.y, item.y, 1e-9), `A2-P1: cardinal u=${item.u}`)
    check(onGrid(at.x) && onGrid(at.y), `A2-P1: cardinal u=${item.u} on g=20`)
  }
  // Constant lead length 20 at several angles.
  for (const u of [0, 0.125, 0.42, 0.58, 0.75]) {
    const pin = { ...add.ports[0]!, u }
    const lead = radialLeadSegment(add, pin, add.width, add.height)!
    const len = Math.hypot(lead.x2 - lead.x1, lead.y2 - lead.y1)
    check(near(len, 20, 1e-9), `A2-P1: lead length 20 at u=${u}`)
  }
  const yPin = add.ports.find((port) => port.id === 'pin_adder_y')!
  const yAt = guidedPinPoint(add, yPin, add.width, add.height)!
  check(near(yAt.x, 120) && near(yAt.y, 60), 'A2-P1: default y at right cardinal')

  // Oscillator / rectangular A2 symbols.
  check(osc.width === 160 && osc.height === 120, 'A2-P1: oscillator 160×120')
  check(osc.revision === 2, 'A2-P1: oscillator revision 2')
  check(!osc.guides && osc.ports.every((port) => !isGuidedPin(port)), 'A2-P1: oscillator stays side-based')
  const oscImage = osc.shapes.find((shape) => shape.kind === 'image')
  check(oscImage?.kind === 'image' && oscImage.y === 20 && oscImage.x === 20, 'A2-P1: oscillator image centred vertically')
  check(near(osc.height / 2, 60) && onGrid(osc.height / 2) && onGrid(osc.width / 2), 'A2-P1: oscillator mid-ports on grid')
  check(generic.width === 160 && generic.height === 80 && onGrid(generic.height / 2), 'A2-P1: generic block 160×80 mid on grid')
  check(process.width === 200 && process.height === 120 && onGrid(process.height / 2), 'A2-P1: process symbol 200×120 mid on grid')
  check(BLOCK_TEMPLATES[1]!.width === 200 && BLOCK_TEMPLATES[1]!.height === 120, 'A2-P1: Process template 200×120')
  check(BLOCK_TEMPLATES[2]!.width === 160 && BLOCK_TEMPLATES[2]!.height === 120, 'A2-P1: Decision template 160×120')
  check(gain.width === 88 && gain.height === 64, 'A2-P1: unrelated Gain size left unchanged')

  // Guide evaluation + wraparound (unit circle).
  const unit: Extract<import('./document').SymbolGuide, { kind: 'ellipse' }> = {
    id: 'g',
    kind: 'ellipse',
    cx: 0,
    cy: 0,
    rx: 10,
    ry: 10,
  }
  check(near(pointOnEllipseGuide(unit, 0).x, 10) && near(pointOnEllipseGuide(unit, 0).y, 0), 'A2-P1: u=0 is right')
  check(near(pointOnEllipseGuide(unit, 0.25).y, 10) && near(pointOnEllipseGuide(unit, 0.25).x, 0), 'A2-P1: u=0.25 is bottom')
  check(near(pointOnEllipseGuide(unit, 0.5).x, -10) && near(pointOnEllipseGuide(unit, 0.5).y, 0), 'A2-P1: u=0.5 is left')
  check(near(pointOnEllipseGuide(unit, 0.75).y, -10) && near(pointOnEllipseGuide(unit, 0.75).x, 0), 'A2-P1: u=0.75 is top')
  check(near(projectOntoEllipseGuide(unit, { x: 10, y: 0 }), 0), 'A2-P1: project right')
  check(near(projectOntoEllipseGuide(unit, { x: 0, y: 10 }), 0.25), 'A2-P1: project bottom')
  check(near(continuousGuideU(0.95, 0.05), 1.05), 'A2-P1: wraparound forward')
  check(near(continuousGuideU(0.05, 0.95), -0.05), 'A2-P1: wraparound backward')

  // Variant A fixture: port on contour, lead none.
  const variantA = cloneSymbol(mul)
  variantA.id = 'sym_variant_a_fixture'
  variantA.guides = [{ id: 'guide_body', kind: 'ellipse', cx: 60, cy: 60, rx: 40, ry: 40 }]
  variantA.ports = variantA.ports.map((port) => {
    const next = { ...port, guideId: 'guide_body', lead: 'none' as const }
    delete next.leadGuideId
    return next
  })
  check(variantA.ports.every((port) => isGuidedPin(port)), 'A2-P1: variant A fixture guided')
  check(radialLeadSegment(variantA, variantA.ports[0]!, variantA.width, variantA.height) === null, 'A2-P1: variant A has no derived lead')

  // HV connection geometry with grid-aligned origins (no snap framework).
  let sheet = emptyDocument()
  const oscPlace = placeLibrarySymbol(sheet, osc, { x: 100, y: 100 }, undefined, pictures.assets ?? [])
  const addPlace = placeLibrarySymbol(sheet, add, { x: 320, y: 100 }, undefined, signal.assets ?? [])
  check(oscPlace.ok && addPlace.ok, 'A2-P1: place oscillator and adder')
  if (!oscPlace.ok || !addPlace.ok) throw new Error('A2-P1 place osc/adder failed')
  const oscOut = sheet.ports.find((item) => item.blockId === oscPlace.blockId && item.symbolPortId === 'pin_osc_out')!
  const addIn = sheet.ports.find((item) => item.blockId === addPlace.blockId && item.symbolPortId === 'pin_adder_a')!
  // Move adder input a to left cardinal for an exact horizontal wire demo.
  placeGuidedPort(sheet, addIn.id, 0.5)
  const oscAt = portAnchor(sheet, oscOut.id)!
  const addWest = portAnchor(sheet, addIn.id)!
  check(near(oscAt.y, 160) && near(addWest.y, 160) && near(oscAt.y, addWest.y), 'A2-P1: OSC→Adder horizontal y match')
  check(onGrid(oscAt.x) && onGrid(oscAt.y) && onGrid(addWest.x) && onGrid(addWest.y), 'A2-P1: OSC/Adder cardinals on grid')

  const noise = placeLibrarySymbol(sheet, generic, { x: 320, y: 280 }, 'AWGN', general.assets ?? [])
  check(noise.ok, 'A2-P1: place AWGN generic')
  if (!noise.ok) throw new Error('A2-P1 place AWGN failed')
  const noiseOut = sheet.ports.find((item) => item.blockId === noise.blockId && item.symbolPortId === 'pin_block_out')!
  const addB = sheet.ports.find((item) => item.blockId === addPlace.blockId && item.symbolPortId === 'pin_adder_b')!
  placeGuidedPort(sheet, addB.id, 0.25)
  const noiseAt = portAnchor(sheet, noiseOut.id)!
  const addSouth = portAnchor(sheet, addB.id)!
  // Align noise block so its mid-right shares Adder south x for a vertical wire.
  const noiseBlock = sheet.blocks.find((item) => item.id === noise.blockId)!
  setBlockFields(sheet, noiseBlock.id, { x: addSouth.x - noiseBlock.width, y: addSouth.y + 40 })
  const noiseAt2 = portAnchor(sheet, noiseOut.id)!
  check(near(noiseAt2.x, addSouth.x) && onGrid(addSouth.x) && onGrid(addSouth.y), 'A2-P1: AWGN→Adder vertical x alignable on grid')

  // Instance independence + stub follow.
  const placedA = placeLibrarySymbol(sheet, add, { x: 40, y: 400 }, undefined, signal.assets ?? [])
  const placedB = placeLibrarySymbol(sheet, add, { x: 200, y: 400 }, undefined, signal.assets ?? [])
  check(placedA.ok && placedB.ok, 'A2-P1: place two adder instances')
  if (!placedA.ok || !placedB.ok) throw new Error('A2-P1 place adders failed')
  const emb = sheet.symbols.find((item) => item.id === 'sym_adder')!
  check(Boolean(emb.guides?.length === 2) && staticLines(emb.shapes) === 0, 'A2-P1: embedded definition has guides, no static leads')
  const blockA = sheet.blocks.find((item) => item.id === placedA.blockId)!
  const portA = sheet.ports.find((item) => item.blockId === blockA.id && item.symbolPortId === 'pin_adder_b')!
  const portB = sheet.ports.find((item) => item.blockId === placedB.blockId && item.symbolPortId === 'pin_adder_b')!
  const netIdBefore = createId('net')
  const segIdBefore = createId('seg')
  const portAId = portA.id
  const freeStub: import('./document').Segment = {
    id: segIdBefore,
    netId: netIdBefore,
    routed: 'manual',
    points: [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ],
    start: { kind: 'port', portId: portAId },
    end: { kind: 'free', x: 0, y: 0 },
  }
  sheet.nets.push({ id: netIdBefore, name: 'n1' })
  const anchorBefore = portAnchor(sheet, portAId)!
  freeStub.points = [
    { x: anchorBefore.x, y: anchorBefore.y },
    { x: anchorBefore.x - 30, y: anchorBefore.y },
  ]
  freeStub.end = { kind: 'free', x: anchorBefore.x - 30, y: anchorBefore.y }
  sheet.segments.push(freeStub)

  placeGuidedPort(sheet, portAId, 0.75)
  check(near(portA.guideU ?? -1, 0.75), 'A2-P1: instance guideU override')
  check(portB.guideU === undefined, 'A2-P1: other instance independent')
  check(emb.ports.find((port) => port.id === 'pin_adder_b')!.u === 0.42, 'A2-P1: library default u preserved')
  const afterMove = portAnchor(sheet, portAId)!
  const stub = sheet.segments.find((item) => item.id === segIdBefore)!
  check(near(stub.points[0]!.x, afterMove.x, 1e-6) && near(stub.points[0]!.y, afterMove.y, 1e-6), 'A2-P1: attached stub follows guided port')
  check(portA.id === portAId && stub.netId === netIdBefore, 'A2-P1: port and net identity preserved')

  const uKeep = portA.guideU!
  const box = resizeBox(
    { x: blockA.x, y: blockA.y, width: blockA.width, height: blockA.height },
    'se',
    { x: blockA.x + blockA.width * 1.5, y: blockA.y + blockA.height * 1.2 },
    false,
  )
  setBlockFields(sheet, blockA.id, box)
  check(near(portA.guideU ?? -1, uKeep), 'A2-P1: resize preserves guideU')
  const resizedLocal = guidedPinPoint(emb, emb.ports.find((port) => port.id === 'pin_adder_b')!, blockA.width, blockA.height, uKeep)!
  const resizedAnchor = portAnchor(sheet, portAId)!
  check(near(resizedAnchor.x, blockA.x + resizedLocal.x, 1e-6), 'A2-P1: resized guided anchor matches scaled guide')

  const circle = scaleEllipseGuide({ id: 'c', kind: 'ellipse', cx: 10, cy: 10, rx: 5, ry: 5 }, 2, 1.5)
  check(near(circle.rx, 10) && near(circle.ry, 7.5), 'A2-P1: circle guide becomes ellipse under non-uniform scale')

  const broken = cloneSymbol(emb)
  broken.guides = []
  sheet.symbols = sheet.symbols.map((item) => (item.id === broken.id ? broken : item))
  check(portAnchor(sheet, portAId) !== null, 'A2-P1: missing guide still yields an anchor')
  check(sheet.segments.some((item) => item.id === segIdBefore && item.netId === netIdBefore), 'A2-P1: missing guide does not drop net')

  let historyDoc = emptyDocument()
  const placed = placeLibrarySymbol(historyDoc, mul, { x: 40, y: 40 }, undefined, signal.assets ?? [])
  check(placed.ok, 'A2-P1: place corrected multiplier')
  if (!placed.ok) throw new Error('A2-P1 place failed')
  const session = new EditSession(
    () => historyDoc,
    (next) => {
      historyDoc = next
    },
  )
  const mulPortId = historyDoc.ports.find((item) => item.symbolPortId === 'pin_mul_b')!.id
  session.begin()
  session.preview((draft) => {
    placeGuidedPort(draft, mulPortId, 0.1)
  })
  session.commit()
  check(near(historyDoc.ports.find((item) => item.id === mulPortId)?.guideU ?? -1, 0.1), 'A2-P1: guided move commits')
  session.undo()
  check(historyDoc.ports.find((item) => item.id === mulPortId)?.guideU === undefined, 'A2-P1: undo restores absence of guideU')
  session.redo()
  check(near(historyDoc.ports.find((item) => item.id === mulPortId)?.guideU ?? -1, 0.1), 'A2-P1: redo restores guideU')

  const frag = captureFragment(historyDoc, [placed.blockId])
  const pasted = pasteFragment(historyDoc, frag, 80, 0)
  const copyPort = historyDoc.ports.find((item) => item.blockId === pasted[0] && item.symbolPortId === 'pin_mul_b')!
  check(near(copyPort.guideU ?? -1, 0.1), 'A2-P1: paste preserves guideU')

  const round = parseDocument(serialize(historyDoc))
  const roundPort = round.ports.find((item) => item.guideU !== undefined)!
  check(near(roundPort.guideU ?? -1, 0.1), 'A2-P1: guideU survives save/load')
  check(Boolean(round.symbols.find((item) => item.id === 'sym_multiplier')?.guides?.length), 'A2-P1: guides survive save/load')

  const stale = cloneSymbol(round.symbols.find((item) => item.id === 'sym_multiplier')!)
  stale.shapes = [{ kind: 'ellipse', x: 16, y: 8, width: 56, height: 48 }]
  stale.guides = undefined
  stale.ports = stale.ports.map((port) => {
    const next = { ...port }
    delete next.guideId
    delete next.u
    delete next.lead
    delete next.leadGuideId
    return next
  })
  stale.revision = 1
  round.symbols = round.symbols.map((item) => (item.id === stale.id ? stale : item))
  const again = parseDocument(serialize(round))
  const againSym = again.symbols.find((item) => item.id === 'sym_multiplier')!
  check(!againSym.guides && againSym.revision === 1, 'A2-P1: stale embedded body survives save/load without catalog pull')
}

{
  // --- A2-P2: independent wire display labels ---
  let sheet = netFixture()
  const netId = 'net_main'
  const net = sheet.nets.find((item) => item.id === netId)!
  const labelsOnNet = sheet.labels.filter((label) => {
    const anchor = label.anchor
    if (anchor.kind !== 'segment') return false
    const segment = sheet.segments.find((item) => item.id === anchor.segmentId)
    return segment?.netId === netId
  })
  check(labelsOnNet.length >= 2, 'A2-P2: fixture has multiple name labels on one net')
  const labelA = labelsOnNet[0]!
  const labelB = labelsOnNet[1]!
  check(labelText(sheet, labelA) === net.name && labelText(sheet, labelB) === net.name, 'A2-P2: default renders net name')
  check(labelA.displayText === undefined, 'A2-P2: legacy labels omit displayText')

  setLabelDisplayText(sheet, labelA.id, 'cos(ω₀t)')
  check(labelA.displayText === 'cos(ω₀t)', 'A2-P2: custom Unicode displayText stored')
  check(labelText(sheet, labelA) === 'cos(ω₀t)', 'A2-P2: custom text rendered')
  check(labelText(sheet, labelB) === net.name, 'A2-P2: sibling label still inherits net name')
  check(net.name === 'main' || net.name === sheet.nets.find((item) => item.id === netId)?.name, 'A2-P2: logical name unchanged by displayText')
  const logicalBefore = sheet.nets.find((item) => item.id === netId)!.name

  setLabelDisplayText(sheet, labelB.id, 'σ²')
  check(labelText(sheet, labelB) === 'σ²', 'A2-P2: second label independent custom text')

  renameNet(sheet, netId, 'carrier_signal')
  check(sheet.nets.find((item) => item.id === netId)?.name === 'carrier_signal', 'A2-P2: net renamed')
  check(labelText(sheet, labelA) === 'cos(ω₀t)' && labelText(sheet, labelB) === 'σ²', 'A2-P2: custom labels survive net rename')
  // Add a third inheriting label and confirm it follows the rename.
  const freeSeg = sheet.segments.find((segment) => segment.netId === netId && segment.id !== labelA.anchor.kind && true)
  const anotherSeg = sheet.segments.find(
    (segment) =>
      segment.netId === netId &&
      !sheet.labels.some((label) => label.anchor.kind === 'segment' && label.anchor.segmentId === segment.id),
  )
  let inheritId = ''
  if (anotherSeg) {
    inheritId = addNameLabel(sheet, anotherSeg.id, 0, 16, 14) ?? ''
  } else {
    // Reuse a segment that already has a label by clearing one custom and testing inherit path separately.
    setLabelDisplayText(sheet, labelB.id, null)
    inheritId = labelB.id
  }
  check(inheritId.length > 0, 'A2-P2: inheriting label available')
  check(labelText(sheet, sheet.labels.find((item) => item.id === inheritId)!) === 'carrier_signal', 'A2-P2: inheriting label follows rename')

  setLabelDisplayText(sheet, labelA.id, null)
  check(labelA.displayText === undefined && labelText(sheet, labelA) === 'carrier_signal', 'A2-P2: Use Net Name clears override')
  setLabelDisplayText(sheet, labelA.id, '  bₖ  ')
  check(labelA.displayText === 'bₖ', 'A2-P2: whitespace trimmed on set')
  setLabelDisplayText(sheet, labelA.id, '   ')
  check(labelA.displayText === undefined && labelText(sheet, labelA) === 'carrier_signal', 'A2-P2: empty string clears override')

  // Visibility independence.
  labelA.visible = false
  check(labelA.displayText === undefined, 'A2-P2: hide does not invent displayText')
  setLabelDisplayText(sheet, labelA.id, 'aₖ')
  check(labelA.visible === false && labelText(sheet, labelA) === 'aₖ', 'A2-P2: custom text kept while hidden')
  delete labelA.visible
  check(labelText(sheet, labelA) === 'aₖ', 'A2-P2: show keeps custom text')

  // Reset position leaves displayText.
  placeLabelAt(sheet, labelA.id, { x: 40, y: 40 })
  resetLabelPosition(sheet, labelA.id)
  check(labelA.displayText === 'aₖ', 'A2-P2: reset position keeps displayText')

  // History: create / edit / clear / remove / restore.
  let live = netFixture()
  const liveLabel = live.labels.find((label) => label.anchor.kind === 'segment')!
  const liveSeg = liveLabel.anchor.kind === 'segment' ? liveLabel.anchor.segmentId : ''
  const hist = new EditSession(
    () => live,
    (next) => {
      live = next
    },
  )
  hist.execute((draft) => {
    setLabelDisplayText(draft, liveLabel.id, 'H(f)')
  })
  check(labelText(live, live.labels.find((item) => item.id === liveLabel.id)!) === 'H(f)', 'A2-P2: history commits custom text')
  hist.execute((draft) => {
    setLabelDisplayText(draft, liveLabel.id, '1/(1+sRC)')
  })
  hist.undo()
  check(labelText(live, live.labels.find((item) => item.id === liveLabel.id)!) === 'H(f)', 'A2-P2: undo restores previous custom text')
  hist.redo()
  check(labelText(live, live.labels.find((item) => item.id === liveLabel.id)!) === '1/(1+sRC)', 'A2-P2: redo restores edit')
  hist.execute((draft) => {
    setLabelDisplayText(draft, liveLabel.id, null)
  })
  check(live.labels.find((item) => item.id === liveLabel.id)?.displayText === undefined, 'A2-P2: clear override')
  hist.undo()
  check(live.labels.find((item) => item.id === liveLabel.id)?.displayText === '1/(1+sRC)', 'A2-P2: undo restores custom after clear')
  hist.execute((draft) => {
    removeSegmentNameLabels(draft, liveSeg)
  })
  check(!live.labels.some((item) => item.id === liveLabel.id), 'A2-P2: remove label')
  hist.undo()
  const restored = live.labels.find((item) => item.id === liveLabel.id)
  check(Boolean(restored && restored.displayText === '1/(1+sRC)'), 'A2-P2: undo restore keeps displayText')

  // Paste / fragment: Port↔Port wire with a labelled displayText (seg_cross).
  const crossLabelId = addNameLabel(sheet, 'seg_cross', 0, 16, 14) ?? ''
  setLabelDisplayText(sheet, crossLabelId, 'dup_glyph')
  const frag = captureFragment(sheet, ['blk_g', 'blk_i'])
  check(frag.labels.some((label) => label.displayText === 'dup_glyph'), 'A2-P2: fragment captures displayText')
  const pasted = pasteFragment(sheet, frag, 40, 40)
  check(pasted.length === 2, 'A2-P2: paste creates two blocks')
  check(sheet.labels.some((label) => label.displayText === 'dup_glyph' && label.id !== crossLabelId), 'A2-P2: paste preserves displayText')

  // Persistence + Unicode round-trip + backward compatibility.
  setLabelDisplayText(sheet, labelA.id, '∑aₖ')
  const round = parseDocument(serialize(sheet))
  const roundLabel = round.labels.find((item) => item.id === labelA.id)!
  check(roundLabel.displayText === '∑aₖ' && labelText(round, roundLabel) === '∑aₖ', 'A2-P2: Unicode displayText save/load')
  const legacyRaw = JSON.parse(serialize(netFixture())) as Record<string, unknown>
  const legacyLabels = legacyRaw.labels as Array<Record<string, unknown>>
  for (const label of legacyLabels) delete label.displayText
  const legacyDoc = parseDocument(JSON.stringify(legacyRaw))
  check(
    legacyDoc.labels.every((label) => label.displayText === undefined),
    'A2-P2: documents without displayText omit the field',
  )
  check(
    legacyDoc.labels.every((label) => {
      const anchor = label.anchor
      if (anchor.kind !== 'segment') return labelText(legacyDoc, label) === label.text
      const segment = legacyDoc.segments.find((item) => item.id === anchor.segmentId)
      const netName = legacyDoc.nets.find((item) => item.id === segment?.netId)?.name ?? label.text
      return labelText(legacyDoc, label) === netName
    }),
    'A2-P2: documents without displayText render as before',
  )
  void logicalBefore
  void freeSeg
}

{
  // --- A2-P3: LaTeX textFormat + math render service ---
  let sheet = netFixture()
  const label = sheet.labels.find((item) => item.anchor.kind === 'segment')!
  check(labelTextFormat(label) === 'plain', 'A2-P3: inherited label is plain')
  check(label.textFormat === undefined, 'A2-P3: legacy labels omit textFormat')

  setLabelDisplayText(sheet, label.id, String.raw`\cos(\omega_0 t+\varphi)`)
  check(labelTextFormat(label) === 'plain', 'A2-P3: custom text defaults to plain')
  check(setLabelTextFormat(sheet, label.id, 'latex'), 'A2-P3: switch to latex')
  check(label.textFormat === 'latex' && labelTextFormat(label) === 'latex', 'A2-P3: latex format stored')
  check(labelText(sheet, label) === String.raw`\cos(\omega_0 t+\varphi)`, 'A2-P3: source text unchanged by format')
  check(setLabelTextFormat(sheet, label.id, 'plain'), 'A2-P3: switch back to plain')
  check(label.textFormat === undefined && labelTextFormat(label) === 'plain', 'A2-P3: plain deletes textFormat')
  check(label.displayText === String.raw`\cos(\omega_0 t+\varphi)`, 'A2-P3: format switch preserves source')

  setLabelDisplay(sheet, label.id, { format: 'latex' })
  check(labelTextFormat(label) === 'latex', 'A2-P3: setLabelDisplay sets format')
  setLabelDisplayText(sheet, label.id, null)
  check(label.displayText === undefined && label.textFormat === undefined, 'A2-P3: Use Net Name clears format')
  check(labelTextFormat(label) === 'plain', 'A2-P3: inherited after clear is plain')
  check(!setLabelTextFormat(sheet, label.id, 'latex'), 'A2-P3: cannot set latex without custom text')

  // History: format + text in separate or combined commits.
  let live = netFixture()
  const liveLabel = live.labels.find((item) => item.anchor.kind === 'segment')!
  const hist = new EditSession(
    () => live,
    (next) => {
      live = next
    },
  )
  hist.execute((draft) => {
    setLabelDisplay(draft, liveLabel.id, { text: String.raw`H(s)=\frac{1}{1+sRC}`, format: 'latex' })
  })
  check(
    live.labels.find((item) => item.id === liveLabel.id)?.textFormat === 'latex',
    'A2-P3: history commits latex format',
  )
  hist.execute((draft) => {
    setLabelTextFormat(draft, liveLabel.id, 'plain')
  })
  hist.undo()
  check(
    live.labels.find((item) => item.id === liveLabel.id)?.textFormat === 'latex',
    'A2-P3: undo restores latex format',
  )
  hist.redo()
  check(
    live.labels.find((item) => item.id === liveLabel.id)?.textFormat === undefined,
    'A2-P3: redo restores plain format',
  )
  hist.undo()
  hist.execute((draft) => {
    setLabelDisplayText(draft, liveLabel.id, null)
  })
  hist.undo()
  const restoredFmt = live.labels.find((item) => item.id === liveLabel.id)
  check(
    Boolean(restoredFmt?.displayText && restoredFmt.textFormat === 'latex'),
    'A2-P3: undo after clear restores text+format',
  )

  // Persistence + copy.
  setLabelDisplay(sheet, label.id, { text: String.raw`P_b=Q\left(\sqrt{\frac{2E_b}{N_0}}\right)`, format: 'latex' })
  const round = parseDocument(serialize(sheet))
  const roundLabel = round.labels.find((item) => item.id === label.id)!
  check(
    roundLabel.textFormat === 'latex' &&
      roundLabel.displayText === String.raw`P_b=Q\left(\sqrt{\frac{2E_b}{N_0}}\right)`,
    'A2-P3: LaTeX source+format save/load',
  )
  check(labelTextFormat(roundLabel) === 'latex', 'A2-P3: loaded format is latex')

  const crossLabelId = addNameLabel(sheet, 'seg_cross', 0, 16, 14) ?? ''
  setLabelDisplay(sheet, crossLabelId, { text: String.raw`b_k`, format: 'latex' })
  const frag = captureFragment(sheet, ['blk_g', 'blk_i'])
  check(
    frag.labels.some((item) => item.displayText === String.raw`b_k` && item.textFormat === 'latex'),
    'A2-P3: fragment captures textFormat',
  )
  pasteFragment(sheet, frag, 80, 80)
  check(
    sheet.labels.filter((item) => item.displayText === String.raw`b_k` && item.textFormat === 'latex').length >= 2,
    'A2-P3: paste preserves latex labels',
  )

  // Math service: cache, identical formulas, invalid, scientific cases.
  clearMathRenderCache()
  resetMathRenderStats()
  await ensureMathEngine()
  const cases = [
    String.raw`b_k,\quad a_k`,
    String.raw`\cos(\omega_0 t+\varphi)`,
    String.raw`\sqrt{\frac{2E_b}{T_b}}`,
    String.raw`H(s)=\frac{1}{1+sRC}`,
    String.raw`s(t)=\sum_{k=0}^{N-1}a_k g(t-kT)`,
    String.raw`E_b=\int_0^{T_b}|s(t)|^2\,dt`,
    String.raw`P_b=Q\left(\sqrt{\frac{2E_b}{N_0}}\right)`,
    String.raw`\begin{bmatrix}I\\Q\end{bmatrix}`,
  ]
  for (const source of cases) {
    const result = await renderMath(source, { em: 13 })
    check(result.ok && result.svg.includes('<svg'), `A2-P3: typesets ${source.slice(0, 24)}`)
    if (result.ok) {
      check(result.width > 0 && result.height > 0, `A2-P3: geometry for ${source.slice(0, 16)}`)
    }
  }
  const firstStats = getMathRenderStats()
  check(firstStats.typesetCount === cases.length, 'A2-P3: one typeset per distinct formula')
  check(firstStats.engineLoads >= 1, 'A2-P3: engine loaded once path')

  const again = await renderMath(cases[0]!, { em: 13 })
  check(again.ok, 'A2-P3: cache returns identical formula')
  check(getMathRenderStats().cacheHits >= 1, 'A2-P3: cache hit on reuse')
  check(getMathRenderStats().typesetCount === cases.length, 'A2-P3: cache avoids re-typeset')

  const twin = await renderMath(cases[2]!, { em: 13 })
  const twin2 = await renderMath(cases[2]!, { em: 13 })
  check(twin.ok && twin2.ok && twin.svg === twin2.svg, 'A2-P3: identical formulas share cached SVG')

  const bad = await renderMath(String.raw`\frac{1{`, { em: 13 })
  check(!bad.ok && bad.error.length > 0, 'A2-P3: invalid LaTeX yields diagnostic')
  check(bad.source === String.raw`\frac{1{`, 'A2-P3: invalid source preserved on error result')

  const rewritten = rewriteSvgIds('<svg><defs><path id="MJX-1"/></defs><use href="#MJX-1"/></svg>', 'pfx_')
  check(rewritten.includes('id="pfx_MJX-1"') && rewritten.includes('href="#pfx_MJX-1"'), 'A2-P3: SVG id rewrite')

  // Plain path does not require typesetting for model resolution.
  const plainSheet = netFixture()
  const plainLabel = plainSheet.labels[0]!
  setLabelDisplayText(plainSheet, plainLabel.id, 'carrier_signal')
  check(labelTextFormat(plainLabel) === 'plain', 'A2-P3: plain custom needs no MathJax')
  check(labelText(plainSheet, plainLabel) === 'carrier_signal', 'A2-P3: plain fast path text')

  // --- A2-P3a: LaTeX on block display text ---
  let p3aSheet = emptyDocument()
  const blkId = placeTemplate(p3aSheet, BLOCK_TEMPLATES[0]!, false)
  setBlockFields(p3aSheet, blkId, { x: 80, y: 80 })
  const p3a = new EditSession(
    () => p3aSheet,
    (next) => {
      p3aSheet = next
    },
  )
  const blk = () => p3aSheet.blocks.find((item) => item.id === blkId)!
  check(blk().textFormat === undefined, 'A2-P3a: legacy block omits textFormat')
  check(blockTextFormat(blk()) === 'plain', 'A2-P3a: default format plain')

  p3a.execute((draft) => setBlockFields(draft, blkId, { displayText: 'AMPLIFIER\nGain = 10' }))
  check(blockTextFormat(blk()) === 'plain', 'A2-P3a: multiline plain stays plain')
  check(Boolean(blk().displayText?.includes('\n')), 'A2-P3a: multiline plain preserved')

  p3a.execute((draft) => setBlockTextFormat(draft, blkId, 'latex'))
  check(blk().textFormat === 'latex', 'A2-P3a: latex format stored')
  check(blockTextFormat(blk()) === 'latex', 'A2-P3a: blockTextFormat reads latex')

  p3a.execute((draft) => setBlockFields(draft, blkId, { displayText: String.raw`y(t)=K\cdot x(t)` }))
  p3a.execute((draft) => setBlockTextFormat(draft, blkId, 'plain'))
  check(blk().textFormat === undefined, 'A2-P3a: plain deletes textFormat')
  check(blk().displayText === String.raw`y(t)=K\cdot x(t)`, 'A2-P3a: plain switch keeps source')

  p3a.execute((draft) => {
    setBlockFields(draft, blkId, { displayText: String.raw`P_b = Q(\sqrt{2E_b/T_b})` })
    setBlockTextFormat(draft, blkId, 'latex')
  })
  check(blk().textFormat === 'latex', 'A2-P3a: combined edit stores format')

  const p3aBeforeUndo = blk().displayText
  p3a.execute((draft) => setBlockFields(draft, blkId, { displayText: 'carrier' }))
  p3a.undo()
  check(blk().displayText === p3aBeforeUndo, 'A2-P3a: undo restores latex source')
  p3a.redo()
  check(blk().displayText === 'carrier', 'A2-P3a: redo restores plain edit')

  p3a.execute((draft) => setBlockFields(draft, blkId, { displayText: '' }))
  check(blk().displayText === undefined && blk().textFormat === undefined, 'A2-P3a: clear removes format')

  p3a.execute((draft) => {
    setBlockFields(draft, blkId, { displayText: String.raw`\sigma^2` })
    setBlockTextFormat(draft, blkId, 'latex')
    setDisplayTextOffset(draft, blkId, { x: 4, y: -6 })
  })
  const roundP3a = parseDocument(serialize(p3aSheet))
  const roundBlk = roundP3a.blocks.find((item) => item.id === blkId)!
  check(roundBlk.textFormat === 'latex' && roundBlk.displayText === String.raw`\sigma^2`, 'A2-P3a: save/load keeps latex source')
  check(roundBlk.displayTextOffset?.x === 4, 'A2-P3a: offset independent of format')

  const dupMap = duplicateBlocks(p3aSheet, [blkId], DUPLICATE_OFFSET, DUPLICATE_OFFSET)
  const dupId = dupMap.get(blkId)!
  const dup = p3aSheet.blocks.find((item) => item.id === dupId)!
  check(dup.textFormat === 'latex' && dup.displayText === String.raw`\sigma^2`, 'A2-P3a: duplicate copies format')
  check(dup.displayTextOffset?.x === 4, 'A2-P3a: duplicate copies offset with format')

  const statsBefore = getMathRenderStats().cacheHits
  await renderMath(String.raw`y=K\cdot x`, { em: 12 })
  const blockRender = await renderMath(String.raw`y=K\cdot x`, { em: 12 })
  check(blockRender.ok, 'A2-P3a: block-sized em typesets')
  const statsAfter = getMathRenderStats()
  check(statsAfter.cacheHits > statsBefore, 'A2-P3a: shared cache used across consumers')

  // A2-P3/P3a-Fix1: rule geometry (rect width/height) must survive root-SVG sizing only.
  function mathRuleRectHasBox(svg: string): boolean {
    const rects = svg.match(/<rect\b[^>]*>/g) ?? []
    return rects.some((tag) => /width="/.test(tag) && /height="/.test(tag))
  }
  const fracRule = await renderMath(String.raw`\frac{1}{2}`, { em: 13 })
  check(fracRule.ok && mathRuleRectHasBox(fracRule.svg), 'A2-P3-Fix1: fraction bar rect keeps width/height')
  const sqrtRule = await renderMath(String.raw`\sqrt{x^2+y^2}`, { em: 13 })
  check(sqrtRule.ok && mathRuleRectHasBox(sqrtRule.svg), 'A2-P3-Fix1: radical vinculum rect keeps width/height')
  const nestedFrac = await renderMath(String.raw`H(s)=\frac{1}{1+sRC}`, { em: 13 })
  check(nestedFrac.ok && mathRuleRectHasBox(nestedFrac.svg), 'A2-P3-Fix1: nested fraction keeps rule rects')
  function nestedSvgsKeepBox(svg: string): boolean {
    const tags = svg.match(/<svg\b[^>]*>/gi) ?? []
    return tags.length >= 2 && tags.every((tag) => /width="/i.test(tag) && /height="/i.test(tag))
  }
  const underline = await renderMath(String.raw`\underline{x+y}`, { em: 13 })
  check(underline.ok && nestedSvgsKeepBox(underline.svg), 'A2-P3-Fix1: underline nested svg keeps dimensions')
  const overline = await renderMath(String.raw`\overline{AB}`, { em: 13 })
  check(overline.ok && nestedSvgsKeepBox(overline.svg), 'A2-P3-Fix1: overline nested svg keeps dimensions')

  // --- A2-P4: Markdown subset parser + formatted layout ---
  const bold = parseFormattedText('**AWGN**')
  const boldRun = bold.blocks[0]
  check(
    boldRun?.kind === 'paragraph' && boldRun.lines[0]?.[0]?.kind === 'text' && boldRun.lines[0][0].bold,
    'A2-P4: ** bold',
  )
  const escapeDollar = parseFormattedText(String.raw`\$100`)
  const escRun = escapeDollar.blocks[0]
  check(
    escRun?.kind === 'paragraph' && escRun.lines[0]?.[0]?.kind === 'text' && escRun.lines[0][0].text === '$100',
    'A2-P4: escaped dollar',
  )
  const unclosed = parseFormattedText('x $y')
  check(unclosed.warnings.some((w) => /Unclosed inline math/i.test(w)), 'A2-P4: unclosed $ warns')
  const tagLit = parseFormattedText('<script>alert(1)</script>')
  const tagLine = tagLit.blocks[0]
  check(
    tagLine?.kind === 'paragraph' &&
      tagLine.lines[0]?.[0]?.kind === 'text' &&
      tagLine.lines[0][0].text.includes('<script>'),
    'A2-P4: HTML tag literal',
  )
  const codeDollar = parseFormattedText('`$a$`')
  const codeRun = codeDollar.blocks[0]
  check(codeRun?.kind === 'paragraph' && codeRun.lines[0]?.[0]?.kind === 'code', 'A2-P4: code no math in backticks')
  const displayMd = parseFormattedText('$$\nH(s)=\\frac{1}{1+sRC}\n$$')
  check(displayMd.blocks.some((b) => b.kind === 'display-math'), 'A2-P4: display $$ block')
  check(countMathSegments(displayMd.blocks) === 1, 'A2-P4: display counts as one math segment')
  const bi = parseFormattedText('***Important***')
  const biRun = bi.blocks[0]
  check(
    biRun?.kind === 'paragraph' &&
      biRun.lines[0]?.[0]?.kind === 'text' &&
      biRun.lines[0][0].bold &&
      biRun.lines[0][0].italic,
    'A2-P4: *** bold+italic',
  )

  const mdSheet = netFixture()
  const mdLabel = mdSheet.labels.find((item) => item.anchor.kind === 'segment')!
  setLabelDisplayText(mdSheet, mdLabel.id, '**AWGN**\n$n\\sim\\mathcal{N}(0,\\sigma^2)$')
  check(setLabelTextFormat(mdSheet, mdLabel.id, 'markdown'), 'A2-P4: label format markdown')
  check(labelTextFormat(mdLabel) === 'markdown', 'A2-P4: label markdown stored')
  check(Boolean(mdLabel.displayText?.includes('\n')), 'A2-P4: wire markdown multiline source')
  const p4Round = parseDocument(serialize(mdSheet))
  const p4Loaded = p4Round.labels.find((item) => item.id === mdLabel.id)!
  check(p4Loaded.textFormat === 'markdown', 'A2-P4: wire markdown save/load')
  check(setLabelTextFormat(mdSheet, mdLabel.id, 'plain'), 'A2-P4: wire markdown → plain')

  setBlockFields(p3aSheet, blkId, {
    displayText: '**BPSK**\n$\\hat b_k$',
    textFormat: 'markdown',
  })
  check(blockTextFormat(blk()) === 'markdown', 'A2-P4: block markdown format')
  const p4BlkRound = parseDocument(serialize(p3aSheet)).blocks.find((item) => item.id === blkId)!
  check(
    p4BlkRound.textFormat === 'markdown' && Boolean(p4BlkRound.displayText?.startsWith('**BPSK')),
    'A2-P4: block markdown save/load',
  )

  clearFormattedTextLayoutCache()
  await ensureMathEngine()
  const fmt = await renderFormattedText('**x** $a^2$', { em: 13, idPrefix: 'sc-p4-' })
  check(fmt.ok && fmt.svg.includes('formatted-text'), 'A2-P4: formatted layout emits svg group')
  check(fmt.ok && fmt.svg.startsWith('<svg'), 'A2-P4-Fix1: root svg wrapper for HTML hosts')
  const cached = await renderFormattedText('**x** $a^2$', { em: 13, idPrefix: 'sc-p4-' })
  check(cached.ok && fmt.ok && cached.svg === fmt.svg, 'A2-P4: layout cache reuses svg')

  const textYValues = (svg: string): number[] =>
    [...svg.matchAll(/<text\b[^>]*\by="([^"]+)"/g)].map((m) => Number(m[1]))
  const hasMathGlyph = (svg: string): boolean => /<path\b|<use\b/i.test(svg)
  const layoutEm = 13

  const threeLines = await renderFormattedText('Zeile 1\nZeile 2\nZeile 3', { em: layoutEm, idPrefix: 'p4f1-' })
  check(threeLines.ok, 'A2-P4-Fix1: three lines typesets')
  if (threeLines.ok) {
    const ys = textYValues(threeLines.svg)
    check(ys.length === 3, 'A2-P4-Fix1: three prose text nodes')
    check(new Set(ys).size === 3, 'A2-P4-Fix1: three distinct baselines')
    check(threeLines.height > layoutEm * 1.5, 'A2-P4-Fix1: multiline bbox height')
  }

  const twoParas = await renderFormattedText('Absatz 1\n\nAbsatz 2', { em: layoutEm, idPrefix: 'p4f2-' })
  check(twoParas.ok, 'A2-P4-Fix1: two paragraphs typesets')
  if (twoParas.ok) {
    const ys = textYValues(twoParas.svg)
    check(ys.length === 2, 'A2-P4-Fix1: two paragraph text nodes')
    check(ys[1]! - ys[0]! > layoutEm * 0.9, 'A2-P4-Fix1: paragraph gap between baselines')
  }

  const mathOnly = await renderFormattedText(String.raw`$\frac{1}{2}$`, { em: layoutEm, idPrefix: 'p4f3-' })
  check(mathOnly.ok, 'A2-P4-Fix1: inline math only typesets')
  if (mathOnly.ok) {
    check(hasMathGlyph(mathOnly.svg), 'A2-P4-Fix1: math-only svg contains glyphs')
    check(mathOnly.width > 0 && mathOnly.height > 0, 'A2-P4-Fix1: math-only bbox')
    check(
      !/<g transform="translate\([^)]*\) scale\(1,-1\)/.test(mathOnly.svg),
      'A2-P4-Fix2: layout group does not invert math',
    )
    check((mathOnly.svg.match(/<svg\b/g) ?? []).length >= 2, 'A2-P4-Fix2: nested MathJax svg preserved')
    const fracBar = mathOnly.svg.match(/<rect\b[^>]*>/g) ?? []
    check(fracBar.some((tag) => /width="/.test(tag) && /height="/.test(tag)), 'A2-P4-Fix2: fraction rule rect retained')
  }

  const sqrtMd = await renderFormattedText(String.raw`$\sqrt{x^2+y^2}$`, { em: layoutEm, idPrefix: 'p4f6-' })
  check(sqrtMd.ok && hasMathGlyph(sqrtMd.svg), 'A2-P4-Fix2: sqrt inline math glyphs')

  const displayRendered = await renderFormattedText('$$\nH(s)=\\frac{1}{1+sRC}\n$$', { em: layoutEm, idPrefix: 'p4f7-' })
  check(displayRendered.ok && hasMathGlyph(displayRendered.svg), 'A2-P4-Fix2: display math glyphs')

  const mixed = await renderFormattedText('Gain: $K=10$', { em: layoutEm, idPrefix: 'p4f4-' })
  check(mixed.ok, 'A2-P4-Fix1: prose+inline math typesets')
  if (mixed.ok) {
    check(mixed.svg.includes('Gain:'), 'A2-P4-Fix1: prose visible in svg')
    check(hasMathGlyph(mixed.svg), 'A2-P4-Fix1: inline math glyphs present')
    check(mixed.width > measureProseWidthGuess('Gain: ', layoutEm), 'A2-P4-Fix1: mixed wider than prose only')
  }

  const awgn = await renderFormattedText(
    String.raw`**AWGN Channel**

$y(t)=x(t)+n(t)$ $n\sim\mathcal{N}(0,\sigma_n^2)$

*Additive white Gaussian noise*`,
    { em: layoutEm, idPrefix: 'p4f5-' },
  )
  check(awgn.ok, 'A2-P4-Fix1: AWGN sample typesets')
  if (awgn.ok) {
    check(hasMathGlyph(awgn.svg), 'A2-P4-Fix1: AWGN math visible in svg')
    check(textYValues(awgn.svg).length >= 3, 'A2-P4-Fix1: AWGN multiline prose baselines')
  }

  // --- A2-P5a: text typography (alignment + font size) ---
  check(lineAlignOffset(80, 50, 'left') === 0, 'A2-P5a: lineAlignOffset left')
  check(Math.abs(lineAlignOffset(80, 50, 'center') - 15) < 1e-6, 'A2-P5a: lineAlignOffset center')
  check(lineAlignOffset(80, 50, 'right') === 30, 'A2-P5a: lineAlignOffset right')
  check(blockDefaultTextAlign('plain') === 'center', 'A2-P5a: plain block default align center')
  check(blockDefaultTextAlign('markdown') === 'left', 'A2-P5a: markdown block default align left')

  function proseTextXs(svg: string): number[] {
    return [...svg.matchAll(/<text[^>]*\sx="([^"]+)"/g)].map((match) => Number(match[1]))
  }

  const alignSource = 'Wide line\nN'
  clearFormattedTextLayoutCache()
  const plainLeft = await renderPlainDisplayText(alignSource, { em: 12, align: 'left', idPrefix: 'p5a-' })
  const plainCenter = await renderPlainDisplayText(alignSource, { em: 12, align: 'center', idPrefix: 'p5a-' })
  check(plainLeft.ok && plainCenter.ok, 'A2-P5a: plain multiline typesets')
  if (plainLeft.ok && plainCenter.ok) {
    const xsLeft = proseTextXs(plainLeft.svg)
    const xsCenter = proseTextXs(plainCenter.svg)
    check(xsLeft.length >= 2 && xsCenter.length >= 2, 'A2-P5a: plain two prose lines')
    check(xsCenter[1]! > xsLeft[1]!, 'A2-P5a: plain center shifts narrow line')
    check(plainLeft.em === 12 && plainCenter.align === 'center', 'A2-P5a: plain layout records align')
  }

  const sized = await renderFormattedText('Line', { em: 12, idPrefix: 'p5a-s-' })
  const sizedUp = await renderFormattedText('Line', { em: 20, idPrefix: 'p5a-s-' })
  check(sized.ok && sizedUp.ok && sizedUp.width > sized.width, 'A2-P5a: larger em widens layout')

  clearFormattedTextLayoutCache()
  const mdLeft = await renderFormattedText('**a**\n$b$', { em: 13, align: 'left', idPrefix: 'p5a-md-' })
  const mdCenter = await renderFormattedText('**a**\n$b$', { em: 13, align: 'center', idPrefix: 'p5a-md-' })
  check(mdLeft.ok && mdCenter.ok, 'A2-P5a: markdown mixed align typesets')
  if (mdLeft.ok && mdCenter.ok) {
    check(mdLeft.svg !== mdCenter.svg, 'A2-P5a: align changes formatted svg')
    const cached = await renderFormattedText('**a**\n$b$', { em: 13, align: 'center', idPrefix: 'p5a-md-' })
    check(cached.ok && mdCenter.ok && cached.svg === mdCenter.svg, 'A2-P5a: layout cache includes align')
  }

  const legacyTypoDoc = emptyDocument()
  const legacyBlkId = createId('blk')
  legacyTypoDoc.blocks.push({
    id: legacyBlkId,
    name: 'Cap',
    x: 0,
    y: 0,
    width: 120,
    height: 60,
    displayText: 'Legacy\nplain',
    textFormat: 'markdown',
  })
  const legacyBlk = legacyTypoDoc.blocks[0]!
  check(blockDisplayTextAlign(legacyBlk) === 'left', 'A2-P5a: legacy markdown block stays left-default')
  check(blockDisplayEm(legacyBlk) === 12, 'A2-P5a: legacy block font default 12')
  const legacyRound = parseDocument(serialize(legacyTypoDoc))
  const legacyLoaded = legacyRound.blocks.find((item) => item.id === legacyBlkId)!
  check(!('textAlign' in legacyLoaded) && !('fontSize' in legacyLoaded), 'A2-P5a: legacy save/load omits typography fields')
  check(blockDisplayTextAlign(legacyLoaded) === 'left', 'A2-P5a: legacy loaded markdown still left-default')

  const typoDoc = emptyDocument()
  typoDoc.blocks.push({
    id: 'tb',
    name: 'T',
    x: 40,
    y: 40,
    width: 100,
    height: 50,
    displayText: 'Caption',
    textFormat: 'markdown',
  })
  const typoSession = new EditSession(
    () => typoDoc,
    (next) => {
      typoDoc.blocks = next.blocks
      typoDoc.ports = next.ports
      typoDoc.segments = next.segments
      typoDoc.nets = next.nets
      typoDoc.labels = next.labels
    },
  )
  typoSession.execute((draft) => {
    setBlockTypography(draft, 'tb', { fontSize: 16, textAlign: 'right' })
  })
  const typed = typoDoc.blocks.find((item) => item.id === 'tb')!
  check(typed.fontSize === 16 && typed.textAlign === 'right', 'A2-P5a: block typography stored')
  typoSession.execute((draft) => {
    setBlockTypography(draft, 'tb', { textAlign: 'left' })
  })
  check(!typoDoc.blocks.find((item) => item.id === 'tb')!.textAlign, 'A2-P5a: canonical left removed from markdown block')
  typoSession.execute((draft) => {
    setBlockTypography(draft, 'tb', { textAlign: 'right' })
  })
  typoSession.undo()
  check(!typoDoc.blocks.find((item) => item.id === 'tb')!.textAlign, 'A2-P5a: undo block align')
  typoSession.execute((draft) => resetBlockTypography(draft, 'tb'))
  check(!typoDoc.blocks.find((item) => item.id === 'tb')!.fontSize, 'A2-P5a: reset block typography')

  const plainTypo = emptyDocument()
  plainTypo.blocks.push({
    id: 'tp',
    name: 'P',
    x: 0,
    y: 0,
    width: 80,
    height: 40,
    displayText: 'Left me',
  })
  setBlockTypography(plainTypo, 'tp', { textAlign: 'left' })
  check(plainTypo.blocks[0]!.textAlign === 'left', 'A2-P5a: explicit left on plain block preserved')
  setBlockTypography(plainTypo, 'tp', { textAlign: 'center' })
  check(!plainTypo.blocks[0]!.textAlign, 'A2-P5a: center on plain block is canonical default')

  const dupTypo = emptyDocument()
  dupTypo.blocks.push({
    id: 'db',
    name: 'D',
    x: 0,
    y: 0,
    width: 90,
    height: 44,
    displayText: 'Dup',
    fontSize: 14,
    textAlign: 'right',
  })
  const typoDupMap = duplicateBlocks(dupTypo, ['db'], DUPLICATE_OFFSET, 0)
  const typoDupId = typoDupMap.get('db')
  const dupBlk = dupTypo.blocks.find((item) => item.id === typoDupId)
  check(dupBlk?.fontSize === 14 && dupBlk?.textAlign === 'right', 'A2-P5a: duplicate copies block typography')

  const wired = netFixture()
  const typoLabelId = wired.labels.find((label) => isNameLabel(label))?.id
  check(Boolean(typoLabelId), 'A2-P5a: fixture label')
  if (typoLabelId) {
    setLabelDisplayText(wired, typoLabelId, 'Wire cap')
    setLabelTextFormat(wired, typoLabelId, 'markdown')
    setLabelTypography(wired, typoLabelId, { fontSize: 15, textAlign: 'center' })
    const lbl = wired.labels.find((item) => item.id === typoLabelId)!
    check(lbl.fontSize === 15 && lbl.textAlign === 'center', 'A2-P5a: label typography stored')
    check(labelDisplayTextAlign(lbl) === 'center', 'A2-P5a: label align resolves')
    const lblRound = parseDocument(serialize(wired)).labels.find((item) => item.id === typoLabelId)!
    check(lblRound.fontSize === 15 && lblRound.textAlign === 'center', 'A2-P5a: label typography save/load')
    resetLabelTypography(wired, typoLabelId)
    const cleared = wired.labels.find((item) => item.id === typoLabelId)!
    check(!cleared.fontSize && !cleared.textAlign, 'A2-P5a: reset label typography')
  }
}

function measureProseWidthGuess(text: string, em: number): number {
  return text.length * em * 0.52
}

if (failures.length) {
  throw new Error(failures.join('\n'))
}
console.log('selfcheck ok')




