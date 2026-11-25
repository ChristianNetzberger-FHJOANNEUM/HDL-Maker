<script setup lang="ts">
import { VueFlow, type NodeDragEvent, type ViewportTransform } from '@vue-flow/core'
import { getStroke } from 'perfect-freehand'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { adoptWire, addPort, addStroke, removeStroke } from '../core/commands'
import { parseDocument, serialize, type DiagramDocument, type Point, type SymbolDefinition } from '../core/document'
import {
  BLOCK_TEMPLATES,
  GRID,
  type BlockTemplate,
  type Fragment,
  captureFragment,
  deleteBlocks,
  duplicateBlocks,
  duplicateGroup,
  emptyDocument,
  groupBlocks,
  pasteFragment,
  placeTemplate,
  setBlockFields,
  snapBlocks,
  snapValue,
  ungroup,
} from '../core/edit'
import { labelPlacement, moveBlock, orthogonalTo, pinPoint, portAnchor } from '../core/geometry'
import { netFixture } from '../core/fixture'
import {
  addNameLabel,
  commitWire,
  deleteSegment,
  labelText,
  mergeNets,
  moveJunction,
  placeSpan,
  probeWire,
  renameNet,
  setRouted,
  snapTarget,
} from '../core/nets'
import { finishFree, wireClick, type WireDraft } from '../core/wiretool'
import { orthogonalize } from '../core/orthogonalize'
import { sampleDocument } from '../core/sample'
import { symbolSheet } from '../core/symbolsheet'
import { defineSymbol, instantiateSymbol, moveSymbolPort, removeSymbolPort, symbolDiagnostics } from '../core/symbols'
import { auditAssets } from '../core/assets'
import { acceptanceSheet, benchSheet } from '../core/acceptance'
import { documentById, validateProject, type DiagramProject, type InstanceStep } from '../core/component'
import { JsonProjectStorage, parseProject, sampleProject, serializeProject } from '../core/project'
import { commitSymbolUpdate, detachInstance, dropPortWires, prepareSymbolUpdate, rebindPort, type UpdatePreview } from '../core/migration'
import { builtinLibraries } from '../core/catalog'
import {
  adoptLibrarySymbol,
  duplicateDefinition,
  emptyUserLibrary,
  JsonLibraryStorage,
  mergeLibrary,
  parseLibrary,
  placeLibrarySymbol,
  removeLibrarySymbol,
  publishSymbolRevision,
  saveSymbolToLibrary,
  serializeLibrary,
  sameSymbolBody,
  type LibraryDiagnostic,
  type SymbolLibrary,
} from '../core/library'
import { EditSession } from '../core/session'
import {
  breadcrumbs,
  contentBounds,
  descend,
  DocumentSessions,
  parentLocation,
  resolveLocation,
  rootLocation,
  sharedDefinitionLabel,
  type HierarchyLocation,
} from '../core/navigate'
import HierarchyTree from './HierarchyTree.vue'
import { JsonRecordStorage, jsonFileName } from '../core/storage'
import BlockNode from './BlockNode.vue'
import FlowBridge from './FlowBridge.vue'
import SymbolEditor from './SymbolEditor.vue'
import SymbolFace, { type FacePin } from './SymbolFace.vue'
import SymbolPalette from './SymbolPalette.vue'

type Tool = 'select' | 'pan' | 'freehand' | 'wire'
type BendDrag = { segmentId: string; xEdge: number; yEdge: number; originX: number; originY: number; axis: 'x' | 'y' | null }
type SpanDrag = { segmentId: string; edge: number; horizontal: boolean; origin: number; pointer: Point }
type Drag = { origin: Map<string, Point>; baseX: number; baseY: number; cancelled: boolean }
type Marquee = { x: number; y: number; width: number; height: number; shift: boolean }

const doc = ref<DiagramDocument>(emptyDocument())
const tool = ref<Tool>('select')
const viewport = ref<ViewportTransform>({ x: 0, y: 0, zoom: 1 })
const status = ref('New diagram.')
const selected = ref<Set<string>>(new Set())
const selectedStroke = ref<string | null>(null)
const preview = ref<Point[] | null>(null)
const drawing = ref<Array<Point & { pressure: number }> | null>(null)
const marquee = ref<Marquee | null>(null)
const snapOn = ref(true)
const stageEl = ref<HTMLElement | null>(null)
const fileEl = ref<HTMLInputElement | null>(null)
const canUndo = ref(false)
const canRedo = ref(false)
const fitToken = ref(0)
const wireDraft = ref<WireDraft | null>(null)
const wireHover = ref<Point>({ x: 0, y: 0 })
const selectedSegment = ref<string | null>(null)
const selectedEdge = ref(0)
const mergeFrom = ref<string | null>(null)
const editingSymbol = ref<string | null>(null)
const symbolEditor = ref<{
  removeSelected: () => boolean
  finishPolygon: () => boolean
  cancelDraft: () => boolean
  abandonGesture: () => void
} | null>(null)
const storage = new JsonRecordStorage()
const projectStorage = new JsonProjectStorage()
const libraryStorage = new JsonLibraryStorage()
const builtins = builtinLibraries()
const userLibrary = ref<SymbolLibrary>(emptyUserLibrary())
const libraryDiagnostics = ref<LibraryDiagnostic[]>([])
const libraryFile = ref<HTMLInputElement | null>(null)
const zoomToken = ref(0)
let clip: Fragment | null = null
let drag: Drag | null = null
let bendDrag: BendDrag | null = null
let spanDrag: SpanDrag | null = null
let junctionDrag: { id: string; originX: number; originY: number; pointer: Point } | null = null

const sheetSession = new EditSession(
  () => doc.value,
  (next) => {
    doc.value = next
  },
)

const documentSessions = new DocumentSessions(
  (id) => (project.value ? documentById(project.value, id) : null),
  (next) => {
    const current = project.value
    if (!current) {
      doc.value = next
      return
    }
    const index = current.documents.findIndex((item) => item.id === next.id)
    if (index >= 0) current.documents[index] = next
    if (doc.value.id === next.id) doc.value = next
  },
)

function edits(): EditSession {
  if (project.value) return documentSessions.get(doc.value.id)
  return sheetSession
}

const flowNodes = computed(() =>
  doc.value.blocks.map((block) => ({
    id: block.id,
    type: 'block',
    position: { x: block.x, y: block.y },
    data: {
      name: block.name,
      width: block.width,
      height: block.height,
      ports: doc.value.ports
        .filter((port) => port.blockId === block.id)
        .map((port) => {
          const at = portAnchor(doc.value, port.id)
          const symbol = block.symbolId ? doc.value.symbols.find((item) => item.id === block.symbolId) : undefined
          return {
            ...port,
            top: (at?.y ?? block.y) - block.y,
            left: (at?.x ?? block.x) - block.x,
            missing: Boolean(port.symbolPortId && symbol && !symbol.ports.some((pin) => pin.id === port.symbolPortId)),
          }
        }),
      shapes: block.symbolId ? (doc.value.symbols.find((item) => item.id === block.symbolId)?.shapes ?? []) : null,
      labels: block.symbolId ? (doc.value.symbols.find((item) => item.id === block.symbolId)?.labels ?? []) : [],
      assets: doc.value.assets,
      selected: selected.value.has(block.id),
    },
    draggable: tool.value === 'select',
    connectable: false,
    style: { width: `${block.width}px`, height: `${block.height}px`, padding: 0, border: 'none', background: 'transparent', overflow: 'visible' },
  })),
)

const wires = computed(() => doc.value.segments.map((segment) => ({ id: segment.id, points: segment.points })))

const diagnostics = computed(() => symbolDiagnostics(doc.value))
const updatePreview = ref<UpdatePreview | null>(null)
const project = ref<DiagramProject | null>(null)
const navigation = ref<HierarchyLocation | null>(null)
const canNavBack = ref(false)
const canNavForward = ref(false)
const crumbs = computed(() => (project.value && navigation.value ? breadcrumbs(project.value, navigation.value) : []))
const sharedLabel = computed(() => (project.value && navigation.value ? sharedDefinitionLabel(project.value, navigation.value) : null))
const pathKey = computed(() => navigation.value?.steps.map((step) => step.blockId).join('/') ?? '')
const treeOpen = ref(true)
const expanded = ref<string[]>([])
const frame = ref<{ mode: 'fit' | 'set'; x: number; y: number; width: number; height: number; zoom: number; token: number } | null>(null)
const viewMemory = new Map<string, { viewport: { x: number; y: number; zoom: number }; selection: string[] }>()
const navPast: HierarchyLocation[] = []
const navFuture: HierarchyLocation[] = []
const rebindChoice = ref<Record<string, string>>({})

const activeSymbol = computed(() => doc.value.symbols.find((symbol) => symbol.id === editingSymbol.value) ?? null)

const symbolInstances = computed(() => doc.value.blocks.filter((block) => block.symbolId && block.symbolId === editingSymbol.value).length)

const paletteLibraries = computed(() => [...builtins, userLibrary.value])

const symbolCategories = computed(() => {
  const names = new Map<string, string>()
  for (const library of paletteLibraries.value) {
    for (const category of library.categories) names.set(category.id, category.name)
  }
  if (!names.has('cat_user')) names.set('cat_user', 'Saved')
  return [...names.entries()].map(([id, name]) => ({ id, name }))
})

const blockPositions = computed(() => doc.value.blocks.map((block) => `${block.symbolId ?? block.id}:${block.x},${block.y}`).join('|'))

const pinKey = computed(() =>
  doc.value.ports
    .map((port) => {
      const at = portAnchor(doc.value, port.id)
      return `${port.id}:${port.side}:${at?.x ?? ''}:${at?.y ?? ''}`
    })
    .join('|'),
)

const anchors = computed(() =>
  doc.value.ports
    .map((port) => {
      const at = portAnchor(doc.value, port.id)
      return `${port.blockId}:${port.side}:${port.id}:${at?.x ?? ''},${at?.y ?? ''}`
    })
    .join('|'),
)

const bindings = computed(() =>
  doc.value.segments
    .map((segment) => {
      const start = segment.start.kind === 'port' ? segment.start.portId : segment.start.kind
      const end = segment.end.kind === 'port' ? segment.end.portId : segment.end.kind
      return `${segment.id}:${start}:${end}`
    })
    .join('|'),
)

const labels = computed(() =>
  doc.value.labels.map((label) => ({
    id: label.id,
    text: labelText(doc.value, label),
    at: labelPlacement(doc.value, label.id),
  })),
)

const wirePreview = computed(() => {
  const draft = wireDraft.value
  if (!draft) return null
  const last = draft.points[draft.points.length - 1]
  return [...draft.points, ...orthogonalTo(last, wireHover.value, draft.elbow).slice(1)]
})

const selectedNet = computed(() => {
  const segment = doc.value.segments.find((item) => item.id === selectedSegment.value)
  return segment ? doc.value.nets.find((net) => net.id === segment.netId) ?? null : null
})

const gridLines = computed(() => {
  const lines: number[] = []
  for (let value = 0; value <= 1600; value += GRID) lines.push(value)
  return lines
})

const oneBlock = computed(() => (selected.value.size === 1 ? doc.value.blocks.find((block) => selected.value.has(block.id)) ?? null : null))

const marqueeBox = computed(() => {
  const box = marquee.value
  if (!box) return null
  return {
    x: Math.min(box.x, box.x + box.width),
    y: Math.min(box.y, box.y + box.height),
    width: Math.abs(box.width),
    height: Math.abs(box.height),
  }
})

const worldStyle = computed(() => ({
  transform: `translate(${viewport.value.x}px, ${viewport.value.y}px) scale(${viewport.value.zoom})`,
}))

function refreshHistory(): void {
  canUndo.value = edits().canUndo
  canRedo.value = edits().canRedo
}

function onViewport(next: ViewportTransform): void {
  viewport.value = { x: next.x, y: next.y, zoom: next.zoom }
}

function openDocument(next: DiagramDocument, message: string): void {
  project.value = null
  navigation.value = null
  documentSessions.discard()
  navPast.length = 0
  navFuture.length = 0
  viewMemory.clear()
  expanded.value = []
  edits().load(next)
  selected.value = new Set()
  selectedStroke.value = null
  selectedSegment.value = null
  wireDraft.value = null
  mergeFrom.value = null
  preview.value = null
  editingSymbol.value = null
  updatePreview.value = null
  refreshHistory()
  syncNav()
  status.value = message
}

function newDiagram(): void {
  openDocument(emptyDocument(), 'New diagram.')
}

function loadExample(): void {
  openDocument(sampleDocument(), 'Example loaded. The label stays on its segment.')
  fitToken.value += 1
}

function loadNetTest(): void {
  openDocument(netFixture(), 'Net test loaded.')
  fitToken.value += 1
}

function loadSymbols(): void {
  openDocument(symbolSheet(), 'Symbol sheet loaded. U1 and U2 are instances of Counter.')
  editingSymbol.value = 'sym_counter'
  fitToken.value += 1
}

function createSymbol(): void {
  let id = ''
  edits().execute((draft) => {
    id = defineSymbol(draft, {
      name: 'Symbol',
      width: 160,
      height: 120,
      ports: [],
      shapes: [{ kind: 'rect', x: 16, y: 16, width: 128, height: 88 }],
      categoryId: 'cat_user',
    })
  })
  editingSymbol.value = id
  refreshHistory()
  status.value = 'Symbol created. Draw it here, then place an instance on the sheet.'
}

function runSymbol(apply: (draft: DiagramDocument) => void): void {
  edits().execute(apply)
  refreshHistory()
}

function previewSymbol(apply: (draft: DiagramDocument) => void): void {
  edits().preview(apply)
}

function commitSymbol(): void {
  edits().commit()
  refreshHistory()
}

function cancelSymbol(): void {
  edits().cancel()
  refreshHistory()
}

function placeSymbolInstance(): void {
  const symbolId = editingSymbol.value
  if (!symbolId) return
  const count = doc.value.blocks.filter((block) => block.symbolId === symbolId).length
  let id = ''
  edits().execute((draft) => {
    id = instantiateSymbol(draft, symbolId, { x: 80 + count * 220, y: 80 + (count % 2) * 40 }, `U${count + 1}`) ?? ''
  })
  if (id) selected.value = new Set([id])
  refreshHistory()
  fitToken.value += 1
  status.value = 'Instance placed. It keeps its own port ids.'
}

function insideStage(client: Point): boolean {
  const rect = stageEl.value?.getBoundingClientRect()
  if (!rect) return false
  return client.x >= rect.left && client.x <= rect.right && client.y >= rect.top && client.y <= rect.bottom
}

function clientToWorldPoint(client: Point): Point {
  const rect = stageEl.value?.getBoundingClientRect()
  return {
    x: snapValue((client.x - (rect?.left ?? 0) - viewport.value.x) / viewport.value.zoom, snapOn.value),
    y: snapValue((client.y - (rect?.top ?? 0) - viewport.value.y) / viewport.value.zoom, snapOn.value),
  }
}

function nextSymbolSlot(): Point {
  const count = doc.value.blocks.length
  return {
    x: snapValue(80 + (count % 4) * 180, snapOn.value),
    y: snapValue(80 + Math.floor(count / 4) * 140, snapOn.value),
  }
}

function libraryFor(symbol: SymbolDefinition) {
  return (
    paletteLibraries.value.find((item) => item.id === symbol.libraryId) ??
    paletteLibraries.value.find((item) => item.symbols.some((entry) => entry.id === symbol.id))
  )
}

function placeFromPalette(symbol: SymbolDefinition, client: Point | null): void {
  if (client && !insideStage(client)) {
    status.value = 'Drop the symbol on the sheet.'
    return
  }
  const library = libraryFor(symbol)
  const existing = doc.value.symbols.find((item) => item.id === symbol.id)
  if (existing && !sameSymbolBody(existing, symbol, doc.value.assets, library?.assets ?? [])) {
    status.value = `${symbol.name} is already in this document with different contents. The document was not changed.`
    return
  }
  const at = client ? clientToWorldPoint(client) : nextSymbolSlot()
  let id = ''
  edits().execute((draft) => {
    const result = placeLibrarySymbol(draft, symbol, at, undefined, library?.assets ?? [])
    if (result.ok) id = result.blockId
  })
  if (id) selected.value = new Set([id])
  refreshHistory()
  status.value = id ? `${symbol.name} placed. Its definition is stored in this document.` : 'The symbol was not placed.'
}

function editFromPalette(symbol: SymbolDefinition): void {
  const library = libraryFor(symbol)
  const existing = doc.value.symbols.find((item) => item.id === symbol.id)
  if (existing && !sameSymbolBody(existing, symbol, doc.value.assets, library?.assets ?? [])) {
    status.value = `${symbol.name} is already in this document with different contents. The document was not changed.`
    return
  }
  if (!existing) {
    edits().execute((draft) => {
      adoptLibrarySymbol(draft, symbol, library?.assets ?? [])
    })
    refreshHistory()
  }
  editingSymbol.value = symbol.id
  status.value = 'Editing the copy stored in this document. The library itself is unchanged.'
}

function copyToUserLibrary(symbol: SymbolDefinition): void {
  const copy = duplicateDefinition(symbol)
  copy.categoryId = 'cat_user'
  const result = saveSymbolToLibrary(userLibrary.value, copy, libraryFor(symbol)?.assets ?? doc.value.assets)
  libraryDiagnostics.value = result.ok ? [] : result.diagnostics
  if (!result.ok) {
    status.value = result.diagnostics[0]?.message ?? 'The copy was not saved.'
    return
  }
  void libraryStorage.save(userLibrary.value)
  status.value = `${copy.name} is in the user library. The original symbol was not changed.`
}

function removeFromUserLibrary(symbolId: string): void {
  const removed = removeLibrarySymbol(userLibrary.value, symbolId)
  if (!removed) {
    status.value = 'A built-in symbol cannot be deleted.'
    return
  }
  void libraryStorage.save(userLibrary.value)
  status.value = 'Removed from the user library. Documents that already contain it are unchanged.'
}

function saveOpenSymbol(): void {
  const symbol = activeSymbol.value
  if (!symbol) return
  const result = saveSymbolToLibrary(userLibrary.value, symbol, doc.value.assets)
  libraryDiagnostics.value = result.ok ? [] : result.diagnostics
  if (!result.ok) {
    status.value = result.diagnostics[0]?.message ?? 'The symbol was not saved.'
    return
  }
  void libraryStorage.save(userLibrary.value)
  status.value = 'Saved in the user library. Diagrams that already copied it are not changed.'
}

function duplicateOpenSymbol(): void {
  const symbol = activeSymbol.value
  if (!symbol) return
  let id = ''
  edits().execute((draft) => {
    const copy = duplicateDefinition(symbol)
    draft.symbols.push(copy)
    id = copy.id
  })
  editingSymbol.value = id
  refreshHistory()
  status.value = 'Duplicated. The new symbol has its own id and its own pin ids.'
}

function exportUserLibrary(): void {
  download('lib_user.json', serializeLibrary(userLibrary.value))
  status.value = 'User library exported.'
}

function requestLibraryImport(): void {
  libraryFile.value?.click()
}

async function onLibraryFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const incoming = parseLibrary(await file.text())
    const audited = auditAssets(incoming.assets ?? [])
    if (!audited.ok) {
      status.value = audited.message
      return
    }
    libraryDiagnostics.value = mergeLibrary(userLibrary.value, incoming)
    await libraryStorage.save(userLibrary.value)
    status.value = libraryDiagnostics.value.length === 0 ? 'Library imported.' : 'Import finished with a diagnosis. Nothing was overwritten.'
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Could not import the library.'
  }
}

function focusedSymbol(): SymbolDefinition | null {
  if (editingSymbol.value) return doc.value.symbols.find((item) => item.id === editingSymbol.value) ?? null
  const block = selected.value.size === 1 ? doc.value.blocks.find((item) => selected.value.has(item.id)) : null
  if (!block?.symbolId) return null
  return doc.value.symbols.find((item) => item.id === block.symbolId) ?? null
}

function facePins(symbol: SymbolDefinition): FacePin[] {
  return symbol.ports.map((pin) => {
    const at = pinPoint(symbol.width, symbol.height, pin)
    return { id: pin.id, name: pin.name, side: pin.side, x: at.x, y: at.y, free: typeof pin.x === 'number' && typeof pin.y === 'number' }
  })
}

const currentUpdateSymbol = computed(() => doc.value.symbols.find((item) => item.id === updatePreview.value?.symbolId) ?? null)
const previewLibrarySymbol = computed(() => {
  const current = currentUpdateSymbol.value
  if (!current) return null
  return libraryFor(current)?.symbols.find((item) => item.id === current.id) ?? null
})
const previewLibraryAssets = computed(() => {
  const current = currentUpdateSymbol.value
  return current ? (libraryFor(current)?.assets ?? []) : []
})

function compareWithLibrary(): void {
  const symbol = focusedSymbol()
  if (!symbol) {
    status.value = 'Open a symbol or select one instance.'
    return
  }
  const library = libraryFor(symbol)
  const incoming = library?.symbols.find((item) => item.id === symbol.id)
  if (!library || !incoming) {
    updatePreview.value = null
    status.value = 'This symbol is not in a loaded library.'
    return
  }
  const prepared = prepareSymbolUpdate(doc.value, symbol.id, incoming, library.assets ?? [])
  if (!prepared.ok) {
    updatePreview.value = null
    status.value = prepared.message
    return
  }
  updatePreview.value = prepared.preview
  status.value =
    prepared.preview.changes.length === 0
      ? 'The library copy matches this document. Nothing was written.'
      : 'Review the library changes. Nothing has been written.'
}

function cancelUpdate(): void {
  updatePreview.value = null
  status.value = 'Update cancelled. The document was not changed.'
}

function confirmUpdate(): void {
  const symbol = focusedSymbol()
  if (!symbol || !updatePreview.value) return
  const library = libraryFor(symbol)
  const incoming = library?.symbols.find((item) => item.id === symbol.id)
  if (!library || !incoming) {
    status.value = 'The library symbol is no longer available.'
    return
  }
  const prepared = prepareSymbolUpdate(doc.value, symbol.id, incoming, library.assets ?? [])
  if (!prepared.ok) {
    status.value = prepared.message
    return
  }
  edits().execute((draft) => {
    commitSymbolUpdate(draft, prepared.prepared)
  })
  updatePreview.value = null
  refreshHistory()
  status.value = `Updated ${prepared.preview.instanceIds.length} instances. Connections keep their port ids.`
}

function publishOpenSymbol(): void {
  const symbol = doc.value.symbols.find((item) => item.id === editingSymbol.value)
  if (!symbol) return
  const result = publishSymbolRevision(userLibrary.value, symbol, doc.value.assets)
  libraryDiagnostics.value = result.ok ? [] : result.diagnostics
  if (!result.ok) {
    status.value = result.diagnostics[0]?.message ?? 'The revision was not published.'
    return
  }
  void libraryStorage.save(userLibrary.value)
  status.value = `Published revision ${result.revision}. Diagrams that already copied it are not changed.`
}

function separateInstance(): void {
  const block = selected.value.size === 1 ? doc.value.blocks.find((item) => selected.value.has(item.id)) : null
  if (!block?.symbolId || !doc.value.symbols.some((item) => item.id === block.symbolId)) {
    status.value = 'Select one symbol instance.'
    return
  }
  edits().execute((draft) => {
    detachInstance(draft, block.id)
  })
  refreshHistory()
  status.value = 'This instance has its own definition. The other instances were not changed.'
}

function replacementPorts(instanceId: string, portId: string) {
  const block = doc.value.blocks.find((item) => item.id === instanceId)
  const symbol = doc.value.symbols.find((item) => item.id === block?.symbolId)
  const pins = new Set(symbol?.ports.map((pin) => pin.id) ?? [])
  return doc.value.ports.filter((port) => port.blockId === instanceId && port.id !== portId && port.symbolPortId && pins.has(port.symbolPortId))
}

function chooseRebind(portId: string, event: Event): void {
  rebindChoice.value[portId] = (event.target as HTMLSelectElement).value
}

function leaveConflict(): void {
  status.value = 'The wire stays on the removed pin and remains visible as a diagnosis.'
}

function assignConflict(portId: string): void {
  const target = rebindChoice.value[portId]
  if (!target) {
    status.value = 'Choose the port that should take this wire.'
    return
  }
  const trial = rebindPort(parseDocument(serialize(doc.value)), portId, target)
  if (!trial.ok) {
    status.value = trial.message
    return
  }
  const names = trial.nets.map((net) => net.name).join(', ')
  edits().execute((draft) => {
    rebindPort(draft, portId, target)
  })
  refreshHistory()
  status.value = `Assigned the wire. Affected nets: ${names}.`
}

function removeConflict(portId: string): void {
  const trial = dropPortWires(parseDocument(serialize(doc.value)), portId)
  if (trial.length === 0) {
    status.value = 'That port has no wire.'
    return
  }
  edits().execute((draft) => {
    dropPortWires(draft, portId)
  })
  refreshHistory()
  status.value = 'The wire was removed. A broken net keeps the D2 split rule.'
}

function loadAcceptance(): void {
  openDocument(acceptanceSheet(), 'Acceptance sheet. It stays as stored until you update a symbol.')
}

function loadBench(): void {
  const started = performance.now()
  const sheet = benchSheet()
  openDocument(sheet, `Bench sheet loaded in ${Math.round(performance.now() - started)} ms.`)
}

function releaseGesture(): void {
  symbolEditor.value?.cancelDraft()
  symbolEditor.value?.abandonGesture()
  if (wireDraft.value) wireDraft.value = null
  mergeFrom.value = null
  preview.value = null
  drawing.value = null
  marquee.value = null
  if (edits().isGesturing) {
    edits().cancel()
    if (drag) drag.cancelled = true
  }
  drag = null
  bendDrag = null
  spanDrag = null
  junctionDrag = null
}

function viewKey(location: HierarchyLocation): string {
  return `${location.projectId}:${location.steps.map((step) => step.blockId).join('/')}`
}

function rememberView(): void {
  const location = navigation.value
  if (!project.value || !location) return
  viewMemory.set(viewKey(location), {
    viewport: { x: viewport.value.x, y: viewport.value.y, zoom: viewport.value.zoom },
    selection: [...selected.value],
  })
}

function reveal(location: HierarchyLocation): void {
  const keys = new Set(expanded.value)
  for (let index = 1; index < location.steps.length; index += 1) {
    keys.add(location.steps.slice(0, index).map((step) => step.blockId).join('/'))
  }
  expanded.value = [...keys]
}

function showLocation(next: HierarchyLocation, record: boolean, remember = true): void {
  const current = project.value
  if (!current) return
  releaseGesture()
  if (remember) rememberView()
  const resolved = resolveLocation(current, next.steps)
  const location = resolved.location
  const sheet = documentById(current, location.documentId)
  if (!sheet) {
    status.value = 'The diagram is not in the project.'
    return
  }
  if (record && navigation.value) {
    navPast.push(navigation.value)
    navFuture.length = 0
  }
  navigation.value = location
  reveal(location)
  doc.value = sheet
  const memory = viewMemory.get(viewKey(location))
  const kept = (memory?.selection ?? []).filter((id) => sheet.blocks.some((block) => block.id === id))
  selected.value = new Set(kept)
  selectedStroke.value = null
  selectedSegment.value = null
  editingSymbol.value = null
  updatePreview.value = null
  refreshHistory()
  const bounds = contentBounds(sheet)
  frame.value = memory
    ? { mode: 'set', x: memory.viewport.x, y: memory.viewport.y, width: bounds.width, height: bounds.height, zoom: memory.viewport.zoom, token: (frame.value?.token ?? 0) + 1 }
    : { mode: 'fit', x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, zoom: 1, token: (frame.value?.token ?? 0) + 1 }
  syncNav()
  if (resolved.message) status.value = resolved.message
}

function loadProject(): void {
  const sample = sampleProject()
  const root = documentById(sample, sample.rootDocumentId)
  if (!root) {
    status.value = 'The sample project has no root diagram.'
    return
  }
  project.value = sample
  documentSessions.discard()
  navPast.length = 0
  navFuture.length = 0
  viewMemory.clear()
  expanded.value = []
  navigation.value = rootLocation(sample)
  doc.value = root
  selected.value = new Set()
  wireDraft.value = null
  editingSymbol.value = null
  refreshHistory()
  const bounds = contentBounds(root)
  frame.value = { mode: 'fit', x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, zoom: 1, token: (frame.value?.token ?? 0) + 1 }
  syncNav()
  const notes = validateProject(sample)
  status.value = notes.length === 0 ? `Project ${sample.name}. U1 and U2 share one counter diagram.` : notes[0]?.message ?? 'Project loaded.'
}

function openInstance(blockId: string): void {
  const current = project.value
  const location = navigation.value
  if (!current || !location) return
  const move = descend(current, location, blockId)
  if (move.kind === 'stay') {
    status.value = move.message
    return
  }
  showLocation(move.location, true)
  status.value = sharedDefinitionLabel(current, navigation.value ?? move.location) ?? 'Opened the shared diagram.'
}

function stabilizePath(): void {
  const current = project.value
  const location = navigation.value
  if (!current || !location) return
  const resolved = resolveLocation(current, location.steps)
  if (!resolved.message) return
  navigation.value = resolved.location
  const sheet = documentById(current, resolved.location.documentId)
  if (sheet) doc.value = sheet
  status.value = resolved.message
}

function syncNav(): void {
  canNavBack.value = navPast.length > 0
  canNavForward.value = navFuture.length > 0
}

function goToSteps(steps: InstanceStep[], record: boolean): void {
  const current = project.value
  if (!current) return
  const resolved = resolveLocation(current, steps)
  showLocation(resolved.location, record)
  if (resolved.message) status.value = resolved.message
}

function goRoot(): void {
  const current = project.value
  if (!current) return
  showLocation(rootLocation(current), true)
}

function goParent(): void {
  const current = project.value
  const location = navigation.value
  if (!current || !location) return
  showLocation(parentLocation(current, location), true)
}

function goBack(): void {
  const previous = navPast.pop()
  const location = navigation.value
  if (!previous || !location) return
  navFuture.push(location)
  showLocation(previous, false)
}

function goForward(): void {
  const next = navFuture.pop()
  const location = navigation.value
  if (!next || !location) return
  navPast.push(location)
  showLocation(next, false)
}

function toggleBranch(key: string): void {
  expanded.value = expanded.value.includes(key) ? expanded.value.filter((item) => item !== key) : [...expanded.value, key]
}

function shiftSymbolPin(): void {
  const pin = doc.value.symbols.find((symbol) => symbol.id === 'sym_counter')?.ports.find((item) => item.id === 'pin_q')
  if (!pin) {
    status.value = 'Load the symbol sheet. The q pin has to be on the symbol.'
    return
  }
  const next = pin.t === 0.2 ? 0.5 : 0.2
  edits().execute((draft) => {
    moveSymbolPort(draft, 'sym_counter', 'pin_q', 'right', next)
  })
  refreshHistory()
  status.value = 'Symbol pin moved. Both instances follow it, and the wire keeps its port ids.'
}

function dropSymbolPin(): void {
  const pin = doc.value.symbols.find((symbol) => symbol.id === 'sym_counter')?.ports.find((item) => item.id === 'pin_q')
  if (!pin) {
    status.value = 'The q pin is already gone from the symbol.'
    return
  }
  edits().execute((draft) => {
    removeSymbolPort(draft, 'sym_counter', 'pin_q')
  })
  refreshHistory()
  const found = symbolDiagnostics(doc.value).find((item) => item.kind === 'missing-port' && item.symbolPortId === 'pin_q')
  status.value = found?.message ?? 'Pin removed from the symbol.'
}

function addFrom(template: BlockTemplate): void {
  let id = ''
  edits().execute((draft) => {
    id = placeTemplate(draft, template, snapOn.value)
  })
  selected.value = new Set([id])
  refreshHistory()
  status.value = 'Block added.'
}

function onNodeDoubleClick(payload: { node: { id: string } }): void {
  openInstance(payload.node.id)
}

function onNodeClick(payload: { node: { id: string }; event: MouseEvent | TouchEvent }): void {
  const id = payload.node.id
  const shift = payload.event instanceof MouseEvent && payload.event.shiftKey
  if (shift) {
    const next = new Set(selected.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selected.value = next
    return
  }
  if (!selected.value.has(id)) selected.value = new Set([id])
}

function onDragStart(event: NodeDragEvent): void {
  if (tool.value !== 'select') return
  const id = event.node.id
  if (!selected.value.has(id)) selected.value = new Set([id])
  const origin = new Map<string, Point>()
  for (const blockId of selected.value) {
    const block = doc.value.blocks.find((item) => item.id === blockId)
    if (block) origin.set(blockId, { x: block.x, y: block.y })
  }
  const base = origin.get(id)
  if (!base) return
  drag = { origin, baseX: base.x, baseY: base.y, cancelled: false }
  edits().begin()
}

function onDrag(event: NodeDragEvent): void {
  if (!drag || drag.cancelled) return
  const dx = event.node.position.x - drag.baseX
  const dy = event.node.position.y - drag.baseY
  const origin = drag.origin
  edits().preview((draft) => {
    for (const [blockId, start] of origin) moveBlock(draft, blockId, start.x + dx, start.y + dy)
  })
}

function onDragStop(): void {
  const current = drag
  drag = null
  if (!current || current.cancelled) return
  const ids = [...current.origin.keys()]
  edits().commit((draft) => snapBlocks(draft, ids, snapOn.value))
  refreshHistory()
  status.value = 'Block moved.'
}

function onNudge(id: string, dx: number, dy: number): void {
  const ids = selected.value.has(id) ? [...selected.value] : [id]
  edits().execute((draft) => {
    for (const blockId of ids) {
      const block = draft.blocks.find((item) => item.id === blockId)
      if (!block) continue
      moveBlock(draft, blockId, snapValue(block.x + dx, snapOn.value), snapValue(block.y + dy, snapOn.value))
    }
  })
  refreshHistory()
  status.value = 'Block moved. The label stays on its segment.'
}

function groupSelection(): void {
  const ids = [...selected.value]
  let created = ''
  edits().execute((draft) => {
    created = groupBlocks(draft, ids) ?? ''
  })
  refreshHistory()
  status.value = created ? 'Group created.' : 'Select at least two blocks.'
}

function ungroupSelection(): void {
  const groups = doc.value.groups.filter((group) => group.blockIds.length > 0 && group.blockIds.every((id) => selected.value.has(id)))
  if (groups.length === 0) {
    status.value = 'Select every block of a group.'
    return
  }
  edits().execute((draft) => {
    for (const group of groups) ungroup(draft, group.id)
  })
  refreshHistory()
  status.value = 'Group removed.'
}

function duplicateSelection(): void {
  const ids = [...selected.value]
  if (ids.length === 0) return
  const group = doc.value.groups.find((item) => item.blockIds.length === ids.length && item.blockIds.every((id) => selected.value.has(id)))
  let created: string[] = []
  edits().execute((draft) => {
    if (group) {
      const id = duplicateGroup(draft, group.id, GRID, GRID)
      created = draft.groups.find((item) => item.id === id)?.blockIds ?? []
    } else {
      created = [...duplicateBlocks(draft, ids, GRID, GRID).values()]
    }
  })
  selected.value = new Set(created)
  refreshHistory()
  status.value = 'Duplicated.'
}

function copySelection(): void {
  if (selected.value.size === 0) return
  clip = captureFragment(doc.value, [...selected.value])
  status.value = 'Copied.'
}

function paste(): void {
  if (!clip) return
  let created: string[] = []
  const fragment = clip
  edits().execute((draft) => {
    created = pasteFragment(draft, fragment, GRID, GRID)
  })
  selected.value = new Set(created)
  refreshHistory()
  status.value = 'Pasted.'
}

function removeSelection(): void {
  const ids = [...selected.value]
  const strokeId = selectedStroke.value
  const segmentId = ids.length === 0 ? selectedSegment.value : null
  if (ids.length === 0 && !strokeId && !segmentId) return
  let created: string[] = []
  edits().execute((draft) => {
    if (ids.length > 0) deleteBlocks(draft, ids)
    if (strokeId) removeStroke(draft, strokeId)
    if (segmentId) created = deleteSegment(draft, segmentId)
  })
  selected.value = new Set()
  selectedStroke.value = null
  selectedSegment.value = null
  preview.value = null
  refreshHistory()
  status.value = created.length > 0 ? 'Segment removed. The disconnected piece has a new net id.' : 'Deleted.'
}

function addPortToSelection(): void {
  const block = oneBlock.value
  if (!block) {
    status.value = 'Select one block to add a port.'
    return
  }
  edits().execute((draft) => addPort(draft, block.id))
  refreshHistory()
  status.value = 'Port added.'
}

function commitName(event: Event): void {
  const block = oneBlock.value
  if (!block) return
  const name = (event.target as HTMLInputElement).value
  edits().execute((draft) => setBlockFields(draft, block.id, { name }))
  refreshHistory()
  status.value = 'Block updated.'
}

function commitNumber(field: 'x' | 'y' | 'width' | 'height', event: Event): void {
  const block = oneBlock.value
  if (!block) return
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  edits().execute((draft) => setBlockFields(draft, block.id, { [field]: value }))
  refreshHistory()
  status.value = 'Block updated.'
}

function clientToWorld(event: PointerEvent): Point {
  const rect = stageEl.value?.getBoundingClientRect()
  return {
    x: (event.clientX - (rect?.left ?? 0) - viewport.value.x) / viewport.value.zoom,
    y: (event.clientY - (rect?.top ?? 0) - viewport.value.y) / viewport.value.zoom,
  }
}

function onStagePointerDown(event: PointerEvent): void {
  if (tool.value !== 'select' || event.button !== 0 || marquee.value) return
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('.vue-flow__node, .bend, .ink, .hit, .junction, .props, button, input')) return
  const start = clientToWorld(event)
  marquee.value = { x: start.x, y: start.y, width: 0, height: 0, shift: event.shiftKey }
}

function onStagePointerMove(event: PointerEvent): void {
  if (!marquee.value) return
  const point = clientToWorld(event)
  marquee.value = { ...marquee.value, width: point.x - marquee.value.x, height: point.y - marquee.value.y }
}

function onStagePointerUp(): void {
  const box = marquee.value
  if (!box) return
  marquee.value = null
  if (Math.abs(box.width) < 4 && Math.abs(box.height) < 4) {
    if (!box.shift) selected.value = new Set()
    return
  }
  const x1 = Math.min(box.x, box.x + box.width)
  const y1 = Math.min(box.y, box.y + box.height)
  const x2 = Math.max(box.x, box.x + box.width)
  const y2 = Math.max(box.y, box.y + box.height)
  const hits = doc.value.blocks
    .filter((block) => block.x < x2 && block.x + block.width > x1 && block.y < y2 && block.y + block.height > y1)
    .map((block) => block.id)
  selected.value = box.shift ? new Set([...selected.value, ...hits]) : new Set(hits)
}

function acceptWire(commit: { points: Point[]; start: Parameters<typeof commitWire>[2]; end: Parameters<typeof commitWire>[3] }): void {
  const probe = probeWire(doc.value, commit.start, commit.end)
  if (!probe.ok) {
    wireDraft.value = null
    status.value = probe.reason
    return
  }
  edits().execute((draft) => {
    commitWire(draft, commit.points, commit.start, commit.end)
  })
  wireDraft.value = null
  refreshHistory()
  status.value = probe.createdNet ? 'New net.' : 'Wire added to the net.'
}

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  if (tool.value === 'wire') {
    const hit = snapTarget(doc.value, clientToWorld(event))
    const step = wireClick(wireDraft.value, hit)
    if (step.commit) acceptWire(step.commit)
    else {
      wireDraft.value = step.draft
      status.value = step.message
    }
    return
  }
  if (tool.value !== 'freehand') return
  status.value = 'Drawing.'
  const point = clientToWorld(event)
  drawing.value = [{ ...point, pressure: event.pressure || 0.5 }]
  ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  const point = clientToWorld(event)
  if (tool.value === 'wire') wireHover.value = point
  if (drawing.value) {
    drawing.value = [...drawing.value, { ...point, pressure: event.pressure || 0.5 }]
    return
  }
  if (junctionDrag) {
    const dragState = junctionDrag
    edits().preview((draft) =>
      moveJunction(draft, dragState.id, dragState.originX + point.x - dragState.pointer.x, dragState.originY + point.y - dragState.pointer.y),
    )
    return
  }
  if (spanDrag) {
    const dragState = spanDrag
    const delta = dragState.horizontal ? point.y - dragState.pointer.y : point.x - dragState.pointer.x
    edits().preview((draft) => placeSpan(draft, dragState.segmentId, dragState.edge, dragState.origin + delta))
    return
  }
  if (!bendDrag) return
  const dragState = bendDrag
  const dx = point.x - dragState.originX
  const dy = point.y - dragState.originY
  if (!dragState.axis) {
    if (Math.hypot(dx, dy) < 2) return
    dragState.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
  }
  if (dragState.axis === 'x') edits().preview((draft) => placeSpan(draft, dragState.segmentId, dragState.xEdge, dragState.originX + dx))
  else edits().preview((draft) => placeSpan(draft, dragState.segmentId, dragState.yEdge, dragState.originY + dy))
}

function onPointerUp(): void {
  if (drawing.value) {
    const points = drawing.value
    drawing.value = null
    let strokeId: string | null = null
    edits().execute((draft) => {
      strokeId = addStroke(draft, points)?.id ?? null
    })
    selectedStroke.value = strokeId
    preview.value = null
    refreshHistory()
    status.value = strokeId ? 'Stroke stored. Convert does not create a net until you confirm.' : 'Stroke ignored.'
    return
  }
  if (junctionDrag) {
    junctionDrag = null
    edits().commit()
    refreshHistory()
    status.value = 'Junction moved.'
    return
  }
  if (spanDrag) {
    const dragState = spanDrag
    spanDrag = null
    edits().commit((draft) => {
      if (!snapOn.value) return
      const segment = draft.segments.find((item) => item.id === dragState.segmentId)
      const point = segment?.points[dragState.edge]
      if (!point) return
      const coord = dragState.horizontal ? snapValue(point.y, true) : snapValue(point.x, true)
      placeSpan(draft, dragState.segmentId, dragState.edge, coord)
    })
    refreshHistory()
    status.value = 'Segment moved.'
    return
  }
  if (!bendDrag) return
  bendDrag = null
  edits().commit()
  refreshHistory()
  status.value = 'Bend moved.'
}

function startBend(segmentId: string, pointIndex: number, event: PointerEvent): void {
  event.stopPropagation()
  const segment = doc.value.segments.find((item) => item.id === segmentId)
  const point = segment?.points[pointIndex]
  const previous = segment?.points[pointIndex - 1]
  if (!segment || !point || !previous) return
  const previousHorizontal = Math.abs(previous.y - point.y) <= Math.abs(previous.x - point.x)
  bendDrag = {
    segmentId,
    xEdge: previousHorizontal ? pointIndex : pointIndex - 1,
    yEdge: previousHorizontal ? pointIndex - 1 : pointIndex,
    originX: point.x,
    originY: point.y,
    axis: null,
  }
  selectedSegment.value = segmentId
  edits().begin()
  ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
}

function onSpanDown(segmentId: string, event: PointerEvent): void {
  if (tool.value !== 'select' || event.button !== 0) return
  event.stopPropagation()
  const segment = doc.value.segments.find((item) => item.id === segmentId)
  if (!segment) return
  if (mergeFrom.value) {
    if (segment.netId === mergeFrom.value) {
      status.value = 'That is the same net.'
      return
    }
    const keep = mergeFrom.value
    const drop = segment.netId
    edits().execute((draft) => {
      mergeNets(draft, keep, drop)
    })
    mergeFrom.value = null
    refreshHistory()
    status.value = 'Nets merged. The first name is kept.'
    return
  }
  const world = clientToWorld(event)
  const hit = snapTarget(doc.value, world)
  const edge = hit.kind === 'segment' && hit.segmentId === segmentId ? hit.edge : 0
  const from = segment.points[edge]
  const to = segment.points[edge + 1]
  if (!from || !to) return
  const horizontal = Math.abs(from.y - to.y) <= Math.abs(from.x - to.x)
  selected.value = new Set()
  selectedSegment.value = segmentId
  selectedEdge.value = edge
  spanDrag = { segmentId, edge, horizontal, origin: horizontal ? from.y : from.x, pointer: world }
  edits().begin()
  ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
}

function onJunctionDown(junctionId: string, event: PointerEvent): void {
  event.stopPropagation()
  const junction = doc.value.junctions.find((item) => item.id === junctionId)
  if (!junction) return
  junctionDrag = { id: junctionId, originX: junction.x, originY: junction.y, pointer: clientToWorld(event) }
  edits().begin()
  ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
}

function commitNetName(event: Event): void {
  const net = selectedNet.value
  if (!net) return
  const name = (event.target as HTMLInputElement).value
  edits().execute((draft) => renameNet(draft, net.id, name))
  refreshHistory()
  status.value = 'Net renamed.'
}

function addLabel(): void {
  const segmentId = selectedSegment.value
  if (!segmentId) return
  edits().execute((draft) => addNameLabel(draft, segmentId, selectedEdge.value, 16, 14))
  refreshHistory()
  status.value = 'Label added. It shows the net name.'
}

function beginMerge(): void {
  const net = selectedNet.value
  if (!net) return
  mergeFrom.value = net.id
  status.value = 'Click a segment of the other net. Escape cancels.'
}

function routeSelected(routed: 'manual' | 'auto'): void {
  const segmentId = selectedSegment.value
  if (!segmentId) return
  edits().execute((draft) => setRouted(draft, segmentId, routed))
  refreshHistory()
  status.value = routed === 'auto' ? 'This segment may be routed automatically.' : 'This segment stays manual.'
}

function selectStroke(strokeId: string, event: PointerEvent): void {
  if (tool.value !== 'select') return
  event.stopPropagation()
  selectedStroke.value = strokeId
  preview.value = null
}

function convertSelected(): void {
  const stroke = doc.value.strokes.find((item) => item.id === selectedStroke.value)
  if (!stroke) {
    status.value = 'Select a freehand stroke first.'
    return
  }
  const result = orthogonalize(stroke.points)
  if (!result.ok) {
    preview.value = null
    status.value = result.reason
    return
  }
  preview.value = result.points
  status.value = 'Preview only. The stroke is still there. Confirm to create a wire.'
}

function confirmPreview(): void {
  if (!preview.value) return
  const points = preview.value
  const strokeId = selectedStroke.value
  edits().execute((draft) => adoptWire(draft, points, strokeId))
  preview.value = null
  selectedStroke.value = null
  refreshHistory()
  status.value = 'Wire created from the sketch. The original stroke was kept until this confirmation.'
}

function undo(): void {
  symbolEditor.value?.abandonGesture()
  edits().undo()
  preview.value = null
  stabilizePath()
  refreshHistory()
  status.value = 'Undone.'
}

function redo(): void {
  symbolEditor.value?.abandonGesture()
  edits().redo()
  preview.value = null
  stabilizePath()
  refreshHistory()
  status.value = 'Redone.'
}

function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function save(): Promise<void> {
  const current = project.value
  if (current) {
    await projectStorage.save(current)
    download(`${current.id}.json`, serializeProject(current))
    refreshHistory()
    status.value = `Saved project ${current.name}.`
    return
  }
  await storage.save(doc.value)
  download(jsonFileName(doc.value), serialize(doc.value))
  refreshHistory()
  status.value = `Saved ${doc.value.id}.`
}

async function reloadSaved(): Promise<void> {
  const current = project.value
  if (current) {
    try {
      const next = await projectStorage.load(current.id)
      const steps = navigation.value?.steps ?? []
      project.value = next
      documentSessions.discard()
      showLocation(resolveLocation(next, steps).location, false, false)
      const resolved = resolveLocation(next, navigation.value?.steps ?? [])
      status.value = resolved.message ?? `Reloaded project ${next.name}.`
    } catch {
      status.value = 'This project is not saved yet.'
    }
    return
  }
  try {
    const next = await storage.load(doc.value.id)
    const audited = auditAssets(next.assets ?? [])
    if (!audited.ok) {
      status.value = audited.message
      return
    }
    openDocument(next, `Reloaded ${next.id}.`)
  } catch {
    status.value = 'This diagram is not saved yet.'
  }
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await file.text()
    if (text.includes('"rootDocumentId"')) {
      const nextProject = parseProject(text)
      project.value = nextProject
      documentSessions.discard()
      navPast.length = 0
      navFuture.length = 0
      showLocation(rootLocation(nextProject), false, false)
      status.value = `Loaded project ${nextProject.name}.`
      return
    }
    const next = await storage.importText(text)
    const audited = auditAssets(next.assets ?? [])
    if (!audited.ok) {
      status.value = audited.message
      return
    }
    openDocument(next, `Loaded ${next.id}.`)
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Could not load the file.'
  }
}

function roundTrip(): string {
  const again = parseDocument(serialize(doc.value))
  const same =
    again.id === doc.value.id &&
    JSON.stringify(again.labels) === JSON.stringify(doc.value.labels) &&
    JSON.stringify(again.nets) === JSON.stringify(doc.value.nets) &&
    JSON.stringify(again.segments) === JSON.stringify(doc.value.segments) &&
    JSON.stringify(again.blocks) === JSON.stringify(doc.value.blocks) &&
    JSON.stringify(again.symbols) === JSON.stringify(doc.value.symbols) &&
    JSON.stringify(again.ports) === JSON.stringify(doc.value.ports)
  return same ? 'Round-trip kept ids, symbols, nets, and segments.' : 'Round-trip changed the document.'
}

function checkRoundTrip(): void {
  status.value = roundTrip()
}

function typingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    if (symbolEditor.value?.cancelDraft()) {
      status.value = 'Polygon cancelled.'
      return
    }
    if (wireDraft.value) {
      wireDraft.value = null
      status.value = 'Wire cancelled.'
      return
    }
    if (mergeFrom.value) {
      mergeFrom.value = null
      status.value = 'Merge cancelled.'
      return
    }
    if (edits().isGesturing) {
      symbolEditor.value?.abandonGesture()
      edits().cancel()
      if (drag) drag.cancelled = true
      bendDrag = null
      spanDrag = null
      junctionDrag = null
      refreshHistory()
      status.value = 'Cancelled.'
      return
    }
    selected.value = new Set()
    selectedSegment.value = null
    return
  }
  if (event.key === 'Enter' && symbolEditor.value?.finishPolygon()) {
    event.preventDefault()
    return
  }
  if (event.key === 'Enter' && wireDraft.value) {
    event.preventDefault()
    acceptWire(finishFree(wireDraft.value, wireHover.value))
    return
  }
  if (event.key === ' ' && wireDraft.value) {
    event.preventDefault()
    wireDraft.value = { ...wireDraft.value, elbow: wireDraft.value.elbow === 'h' ? 'v' : 'h' }
    return
  }
  if (typingTarget(event.target)) return
  const command = event.ctrlKey || event.metaKey
  const key = event.key.toLowerCase()
  if (command && key === 'z') {
    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
    return
  }
  if (command && key === 'y') {
    event.preventDefault()
    redo()
    return
  }
  if (command && key === 'a') {
    event.preventDefault()
    selected.value = new Set(doc.value.blocks.map((block) => block.id))
    return
  }
  if (command && key === 'c') {
    event.preventDefault()
    copySelection()
    return
  }
  if (command && key === 'v') {
    event.preventDefault()
    paste()
    return
  }
  if (command && key === 'd') {
    event.preventDefault()
    duplicateSelection()
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (symbolEditor.value?.removeSelected()) {
      event.preventDefault()
      return
    }
    event.preventDefault()
    removeSelection()
  }
}

function outline(points: Array<Point & { pressure?: number }>, size: number): string {
  const stroke = getStroke(
    points.map((point) => [point.x, point.y, point.pressure ?? 0.5]),
    { size, thinning: 0.5, smoothing: 0.6, streamline: 0.4 },
  )
  if (stroke.length === 0) return ''
  const commands = stroke.reduce<Array<string | number>>((path, [x0, y0], index, all) => {
    const [x1, y1] = all[(index + 1) % all.length]
    path.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
    return path
  }, ['M', ...stroke[0], 'Q'])
  commands.push('Z')
  return commands.join(' ')
}

function pointsAttr(points: Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ')
}

function bends(points: Point[]): Point[] {
  return points.slice(1, -1)
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

defineExpose({ roundTrip, doc })
</script>

<template>
  <div class="lab" :class="{ editing: Boolean(activeSymbol) }">
    <header class="toolbar">
      <button @click="newDiagram">New</button>
      <button @click="loadExample">Example</button>
      <button @click="loadNetTest">Net test</button>
      <button @click="loadSymbols">Symbols</button>
      <button @click="loadAcceptance">Acceptance</button>
      <button @click="loadBench">Bench</button>
      <button @click="loadProject">Project</button>
      <button @click="createSymbol">New symbol</button>
      <button @click="shiftSymbolPin">Shift pin</button>
      <button @click="dropSymbolPin">Drop pin</button>
      <button :class="{ on: tool === 'select' }" @click="tool = 'select'">Select</button>
      <button :class="{ on: tool === 'pan' }" @click="tool = 'pan'">Pan</button>
      <button :class="{ on: tool === 'wire' }" @click="tool = 'wire'">Wire</button>
      <button :class="{ on: tool === 'freehand' }" @click="tool = 'freehand'">Freehand</button>
      <button @click="addPortToSelection">Add port</button>
      <button :disabled="selected.size < 2" @click="groupSelection">Group</button>
      <button @click="ungroupSelection">Ungroup</button>
      <button :disabled="selected.size === 0" @click="duplicateSelection">Duplicate</button>
      <button :disabled="selected.size === 0 && !selectedStroke && !selectedSegment" @click="removeSelection">Delete</button>
      <button :class="{ on: snapOn }" @click="snapOn = !snapOn">Snap</button>
      <button @click="convertSelected">Convert</button>
      <button :disabled="!preview" @click="confirmPreview">Confirm wire</button>
      <button :disabled="!canUndo" @click="undo">Undo</button>
      <button :disabled="!canRedo" @click="redo">Redo</button>
      <button @click="save">Save</button>
      <button @click="reloadSaved">Reload</button>
      <button @click="fileEl?.click()">Load file</button>
      <button @click="checkRoundTrip">Check round-trip</button>
      <button @click="zoomToken += 1">Zoom in</button>
      <button @click="zoomToken -= 1">Zoom out</button>
      <span class="zoom">{{ doc.blocks.length }} blocks · zoom {{ viewport.zoom.toFixed(2) }}</span>
      <input ref="fileEl" class="file" type="file" accept="application/json,.json" @change="onFile" />
      <input ref="libraryFile" class="file" type="file" accept="application/json,.json" @change="onLibraryFile" />
    </header>
    <aside class="palette">
      <div v-if="project" class="tree" :data-tree-open="treeOpen">
        <button type="button" @click="treeOpen = !treeOpen">{{ treeOpen ? 'Hide tree' : 'Show tree' }}</button>
        <template v-if="treeOpen">
          <button type="button" class="tree-item" :class="{ on: pathKey === '' }" data-tree-key="" @click="goRoot">{{ project.name }}</button>
          <HierarchyTree :project="project" :steps="[]" :expanded="expanded" :current-key="pathKey" @toggle="toggleBranch" @open="goToSteps($event, true)" />
        </template>
      </div>
      <SymbolEditor
        v-if="activeSymbol"
        ref="symbolEditor"
        :symbol="activeSymbol"
        :instances="symbolInstances"
        :categories="symbolCategories"
        :assets="doc.assets"
        @execute="runSymbol"
        @begin="edits().begin()"
        @preview="previewSymbol"
        @commit="commitSymbol"
        @cancel="cancelSymbol"
        @place="placeSymbolInstance"
        @save-library="saveOpenSymbol"
        @publish="publishOpenSymbol"
        @duplicate="duplicateOpenSymbol"
        @export-library="exportUserLibrary"
        @import-library="requestLibraryImport"
        @close="editingSymbol = null"
      />
      <template v-else>
        <SymbolPalette
          :libraries="paletteLibraries"
          :diagnostics="libraryDiagnostics"
          @place="placeFromPalette"
          @edit="editFromPalette"
          @copy="copyToUserLibrary"
          @remove="removeFromUserLibrary"
          @export="exportUserLibrary"
          @import="requestLibraryImport"
        />
        <p>Plain blocks</p>
        <button v-for="template in BLOCK_TEMPLATES" :key="template.name" @click="addFrom(template)">{{ template.name }}</button>
      </template>
    </aside>
    <div class="sheet-column">
      <div v-if="project && navigation" class="crumbs" :data-path-ids="pathKey" :data-shared="sharedLabel ?? ''">
        <button v-for="(crumb, index) in crumbs" :key="`${crumb.blockId ?? 'root'}-${index}`" type="button" @click="goToSteps(crumb.steps, true)">{{ crumb.label }}</button>
        <button type="button" @click="goRoot">Root</button>
        <button type="button" :disabled="pathKey === ''" @click="goParent">Up</button>
        <button type="button" :disabled="!canNavBack" @click="goBack">Back</button>
        <button type="button" :disabled="!canNavForward" @click="goForward">Forward</button>
        <span v-if="sharedLabel" class="hint">{{ sharedLabel }}</span>
      </div>
    <div
      ref="stageEl"
      class="stage"
      :data-doc-id="doc.id"
      :data-blocks="doc.blocks.length"
      :data-nets="doc.nets.length"
      :data-junctions="doc.junctions.length"
      :data-segments="doc.segments.length"
      :data-symbols="doc.symbols.length"
      :data-assets="doc.assets.length"
      :data-asset-sums="doc.assets.map((asset) => asset.checksum).join('|')"
      :data-diagnostics="diagnostics.length"
      :data-labels="doc.labels.length"
      :data-revisions="doc.symbols.map((symbol) => `${symbol.id}:${symbol.revision ?? ''}`).join('|')"
      :data-project="project?.id ?? ''"
      :data-path-ids="pathKey"
      :data-component-refs="doc.blocks.filter((block) => block.componentId).map((block) => `${block.name}:${block.componentId}`).join('|')"
      :data-bindings="bindings"
      :data-anchors="anchors"
      :data-block-pos="blockPositions"
      @pointerdown="onStagePointerDown"
      @pointermove="onStagePointerMove"
      @pointerup="onStagePointerUp"
    >
      <VueFlow
        :nodes="flowNodes"
        :edges="[]"
        :nodes-draggable="tool === 'select'"
        :pan-on-drag="tool === 'pan'"
        :nodes-connectable="false"
        :elements-selectable="false"
        :selection-key-code="null"
        :multi-selection-key-code="null"
        :select-nodes-on-drag="false"
        :zoom-on-double-click="false"
        :min-zoom="0.25"
        :max-zoom="2.5"
        fit-view-on-init
        @viewport-change="onViewport"
        @node-click="onNodeClick"
        @node-double-click="onNodeDoubleClick"
        @node-drag-start="onDragStart"
        @node-drag="onDrag"
        @node-drag-stop="onDragStop"
      >
        <template #node-block="nodeProps">
          <BlockNode
            :block-id="nodeProps.id"
            :name="nodeProps.data.name"
            :width="nodeProps.data.width"
            :height="nodeProps.data.height"
            :ports="nodeProps.data.ports"
            :shapes="nodeProps.data.shapes"
            :labels="nodeProps.data.labels"
            :assets="nodeProps.data.assets"
            :selected="nodeProps.data.selected"
            @nudge="onNudge"
          />
        </template>
        <FlowBridge :port-count="doc.ports.length" :ids="doc.blocks.map((block) => block.id)" :fit-token="fitToken" :pin-key="pinKey" :zoom-token="zoomToken" :frame="frame" @viewport="onViewport" />
      </VueFlow>
      <svg class="world" :class="{ drawing: tool === 'freehand' || tool === 'wire' }" :style="worldStyle" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp">
        <g v-if="snapOn" class="grid">
          <line v-for="value in gridLines" :key="`x-${value}`" :x1="value" y1="0" :x2="value" y2="1600" />
          <line v-for="value in gridLines" :key="`y-${value}`" x1="0" :y1="value" x2="1600" :y2="value" />
        </g>
        <polyline
          v-for="wire in wires"
          :key="`${wire.id}-hit`"
          :points="pointsAttr(wire.points)"
          class="hit"
          @pointerdown="onSpanDown(wire.id, $event)"
        />
        <polyline v-for="wire in wires" :key="wire.id" :points="pointsAttr(wire.points)" class="wire" :class="{ selected: wire.id === selectedSegment }" />
        <polyline v-if="wirePreview" :points="pointsAttr(wirePreview)" class="preview" />
        <polyline v-if="preview" :points="pointsAttr(preview)" class="preview" />
        <circle
          v-for="junction in doc.junctions"
          :key="junction.id"
          class="junction"
          :cx="junction.x"
          :cy="junction.y"
          r="5"
          @pointerdown="onJunctionDown(junction.id, $event)"
        />
        <template v-for="wire in wires" :key="`${wire.id}-handles`">
          <circle
            v-for="(bend, index) in bends(wire.points)"
            :key="`${wire.id}-${index}`"
            class="bend"
            :cx="bend.x"
            :cy="bend.y"
            r="6"
            @pointerdown="startBend(wire.id, index + 1, $event)"
          />
        </template>
        <path
          v-for="stroke in doc.strokes"
          :key="stroke.id"
          :d="outline(stroke.points, stroke.size)"
          class="ink"
          :class="{ selected: stroke.id === selectedStroke }"
          @pointerdown="selectStroke(stroke.id, $event)"
        />
        <path v-if="drawing" :d="outline(drawing, 8)" class="ink live" />
        <rect v-if="marqueeBox" class="marquee" :x="marqueeBox.x" :y="marqueeBox.y" :width="marqueeBox.width" :height="marqueeBox.height" />
        <text v-for="label in labels" :key="label.id" v-show="label.at" :x="label.at?.x" :y="label.at?.y" class="label">{{ label.text }}</text>
      </svg>
    </div>
    </div>
    <aside class="props">
      <p>Properties</p>
      <p v-if="sharedLabel" class="hint">{{ sharedLabel }}</p>
      <template v-if="oneBlock">
        <label>Name <input :value="oneBlock.name" @change="commitName" /></label>
        <label>X <input :value="oneBlock.x" type="number" @change="commitNumber('x', $event)" /></label>
        <label>Y <input :value="oneBlock.y" type="number" @change="commitNumber('y', $event)" /></label>
        <label>Width <input :value="oneBlock.width" type="number" @change="commitNumber('width', $event)" /></label>
        <label>Height <input :value="oneBlock.height" type="number" @change="commitNumber('height', $event)" /></label>
      </template>
      <template v-else-if="selectedNet">
        <label>Net <input :value="selectedNet.name" @change="commitNetName" /></label>
        <p class="hint">{{ selectedNet.id }}</p>
        <button @click="addLabel">Add label</button>
        <button @click="beginMerge">Merge</button>
        <button @click="routeSelected('auto')">Auto route</button>
        <button @click="routeSelected('manual')">Keep manual</button>
      </template>
      <p v-else class="hint">{{ selected.size }} selected</p>
      <button v-if="oneBlock?.symbolId" @click="separateInstance">Separate definition</button>
      <button v-if="oneBlock?.symbolId || activeSymbol" @click="compareWithLibrary">Compare library</button>
      <div
        v-if="updatePreview && currentUpdateSymbol && previewLibrarySymbol"
        class="update-preview"
        :data-changes="updatePreview.changes.length"
        :data-instances="updatePreview.instanceIds.length"
        :data-connections="updatePreview.connectionCount"
        :data-conflicts="updatePreview.conflicts.length"
      >
        <p>Update from library</p>
        <p class="hint">Revision {{ updatePreview.fromRevision ?? 'none' }} to {{ updatePreview.toRevision ?? 'none' }}</p>
        <p class="hint">{{ updatePreview.instanceIds.length }} instances, {{ updatePreview.connectionCount }} connections</p>
        <div class="preview-row">
          <svg :viewBox="`0 0 ${currentUpdateSymbol.width} ${currentUpdateSymbol.height}`" width="88" height="64">
            <SymbolFace :width="currentUpdateSymbol.width" :height="currentUpdateSymbol.height" :shapes="currentUpdateSymbol.shapes" :labels="currentUpdateSymbol.labels" :pins="facePins(currentUpdateSymbol)" :assets="doc.assets" />
          </svg>
          <svg :viewBox="`0 0 ${previewLibrarySymbol.width} ${previewLibrarySymbol.height}`" width="88" height="64">
            <SymbolFace :width="previewLibrarySymbol.width" :height="previewLibrarySymbol.height" :shapes="previewLibrarySymbol.shapes" :labels="previewLibrarySymbol.labels" :pins="facePins(previewLibrarySymbol)" :assets="previewLibraryAssets" />
          </svg>
        </div>
        <p v-if="updatePreview.changes.length === 0" class="hint">No content changes.</p>
        <p v-for="(change, index) in updatePreview.changes" :key="index" class="hint">{{ change.detail }}</p>
        <p v-for="conflict in updatePreview.conflicts" :key="conflict.portId" class="hint">
          {{ conflict.blockName }} / {{ conflict.portName }} stays on net {{ conflict.netName ?? 'unnamed' }} unless you assign it after the update.
        </p>
        <button @click="cancelUpdate">Cancel</button>
        <button @click="confirmUpdate">Update all instances</button>
      </div>
      <template v-if="diagnostics.length">
        <p>Symbol diagnosis</p>
        <div v-for="item in diagnostics" :key="`${item.instanceId}-${item.portId}`">
          <p class="hint">{{ item.message }}</p>
          <template v-if="item.portId">
            <select :value="rebindChoice[item.portId] ?? ''" @change="chooseRebind(item.portId, $event)">
              <option value="">Choose a port</option>
              <option v-for="port in replacementPorts(item.instanceId, item.portId)" :key="port.id" :value="port.id">{{ port.name }}</option>
            </select>
            <button @click="leaveConflict">Leave</button>
            <button @click="assignConflict(item.portId)">Assign</button>
            <button @click="removeConflict(item.portId)">Remove wire</button>
          </template>
        </div>
      </template>
    </aside>
    <footer>
      <p class="status">{{ status }}</p>
    </footer>
  </div>
</template>
