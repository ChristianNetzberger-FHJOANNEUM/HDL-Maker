<script setup lang="ts">
import { VueFlow, type NodeDragEvent, type ViewportTransform } from '@vue-flow/core'
import { getStroke } from 'perfect-freehand'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { adoptWire, addStroke, removeStroke } from '../core/commands'
import { parseDocument, serialize, type DiagramDocument, type Point, type PortSide, type SymbolDefinition } from '../core/document'
import {
  BLOCK_TEMPLATES,
  type BlockTemplate,
  type Fragment,
  blockTextFormat,
  captureFragment,
  deleteBlocks,
  duplicateBlocks,
  duplicateGroup,
  emptyDocument,
  groupBlocks,
  pasteFragment,
  placeTemplate,
  addPortAt,
  borderPlacement,
  nearestBlockBorder,
  placePort,
  placeGuidedPort,
  removeUnwiredPort,
  renameInstancePort,
  unusedPortName,
  resizeBox,
  setBlockFields,
  setBlockTypography,
  resetBlockTypography,
  setPortDirection,
  setBlockTextFormat,
  setBlockStyle,
  resetBlockStyle,
  setDisplayTextOffset,
  setSegmentLabelsVisible,
  snapBlocks,
  snapValue,
  DUPLICATE_OFFSET,
  ungroup,
  type ResizeHandle,
} from '../core/edit'
import {
  DEFAULT_EDITOR_PREFERENCES,
  loadEditorPreferences,
  normalizeSpacing,
  saveEditorPreferences,
  sanitizeEditorPreferences,
  SPACING_PRESETS,
  type EditorPreferences,
} from '../core/preferences'
import {
  continuousGuideU,
  findSymbolGuide,
  guidedPinPoint,
  isGuidedPin,
  labelPlacement,
  moveBlock,
  orthogonalTo,
  pinPoint,
  portAnchor,
  projectOntoEllipseGuide,
  radialLeadSegment,
  scaleEllipseGuide,
} from '../core/geometry'
import { netFixture } from '../core/fixture'
import {
  addNameLabel,
  commitWire,
  deleteSegment,
  labelText,
  mergeNets,
  mergeNetsByName,
  moveJunction,
  nameCollisions,
  netsNamed,
  netPortIds,
  placeFreeEnd,
  placeLabelAt,
  placeSpan,
  probeWire,
  renameNet,
  removeSegmentNameLabels,
  resetLabelPosition,
  isNameLabel,
  labelTextFormat,
  setLabelDisplayText,
  setLabelTextFormat,
  setLabelTypography,
  resetLabelTypography,
  setRouted,
  snapTarget,
  type LabelTextFormat,
  type SnapHit,
} from '../core/nets'
import {
  beginMathRequest,
  endMathConsumer,
  isMathRequestCurrent,
  renderMath,
  type MathRenderResult,
} from '../core/mathRender'
import { renderFormattedText, renderPlainDisplayText, type FormattedTextResult } from '../core/formattedTextRender'
import {
  blockDisplayEm,
  blockDisplayTextAlign,
  labelDisplayEm,
  labelDisplayTextAlign,
  wireLabelAnchorDx,
  BLOCK_DISPLAY_DEFAULT_EM,
  LABEL_DISPLAY_DEFAULT_EM,
} from '../core/textTypography'
import type { TextAlign } from '../core/textTypography'
import { resolvePortDirection, symbolPinForPort, type PortDirection } from '../core/portDirection'
import {
  automaticNetStatus,
  buildNetArrowAnalyses,
  connectedSegmentGroups,
  diagramArrowheadDefault,
  effectiveArrowheadMode,
  resetSegmentArrowheads,
  segmentArrowMarkers,
  setDiagramArrowheadDefault,
  setSegmentArrowheads,
  type ArrowheadDiagramDefault,
  type ArrowheadSegmentOverride,
} from '../core/wireArrowheads'
import { finishFree, undoWireStep, wireClick, type WireDraft } from '../core/wiretool'
import { orthogonalize } from '../core/orthogonalize'
import { sampleDocument } from '../core/sample'
import { symbolSheet } from '../core/symbolsheet'
import { defineSymbol, instantiateSymbol, moveSymbolPort, removeSymbolPort, symbolDiagnostics } from '../core/symbols'
import { auditAssets } from '../core/assets'
import { acceptanceSheet, benchSheet } from '../core/acceptance'
import {
  BENCHGEN_SIZES,
  estimateBenchCounts,
  generateBenchDocument,
  type BenchGeometry,
  type BenchGenSize,
  type BenchTopology,
  type BenchWiring,
} from '../core/benchgen'
import { addComponent, createProject, documentById, instancesOf, instantiateComponent, removeComponent, validateProject, type DiagramProject, type InstanceStep, type ProjectResult } from '../core/component'
import {
  duplicateComponent,
  expandComponent,
  extractComponent,
  makeUnique,
  previewExpand,
  previewExtract,
  renameComponent,
  type ExpandPreview,
  type ExtractPreview,
} from '../core/hierarchy'
import { JsonProjectStorage, parseProject, sampleProject, serializeProject } from '../core/project'
import { TransactionManager } from '../core/transaction'
import { digitalProject, generalProject, signalProject } from '../core/references'
import {
  addBoundPin,
  addInterfacePort,
  bindInterfacePort,
  classifyPortDelete,
  componentOwningBlock,
  createImplementation,
  interfaceDiagnostics,
  logicalPortName,
  moveInterfacePort,
  openAsDiagram,
  removeInterfacePort,
  renameInterfacePort,
} from '../core/interface'
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
  parentLocation,
  resolveLocation,
  rootLocation,
  sharedDefinitionLabel,
  type HierarchyLocation,
} from '../core/navigate'
import { GestureCloseLatch, actionForRedoWhileGesturing } from './gestureGuard'
import {
  allowMarquee,
  blockDragMode,
  chooseTool as nextTool,
  duplicateDragMoved,
  isDoublePress,
  isTextEditingTarget,
  panOnDragButtons,
  nextEscapeAction,
  shouldBeginViewPan,
  spaceReleaseAction,
  wireDrawingShortcut,
  type EditorTool,
  type PressStamp,
} from './interactionPolicy'
import HierarchyTree from './HierarchyTree.vue'
import { JsonRecordStorage, jsonFileName } from '../core/storage'
import BlockNode from './BlockNode.vue'
import FlowBridge from './FlowBridge.vue'
import SymbolEditor from './SymbolEditor.vue'
import SymbolFace, { type FacePin } from './SymbolFace.vue'
import SymbolPalette from './SymbolPalette.vue'

type Tool = EditorTool
type BendDrag = { segmentId: string; xEdge: number; yEdge: number; originX: number; originY: number; axis: 'x' | 'y' | null }
type SpanDrag = { segmentId: string; edge: number; horizontal: boolean; origin: number; pointer: Point }
type FreeEndDrag = { segmentId: string; which: 'start' | 'end' }
type Drag = {
  origin: Map<string, Point>
  sourceIds: string[]
  baseX: number
  baseY: number
  cancelled: boolean
  mode: 'move' | 'duplicate'
  /** Last preview’s created block ids (duplicate mode). */
  createdIds: string[]
  lastDx: number
  lastDy: number
}
type ResizeDrag = {
  blockId: string
  handle: ResizeHandle
  origin: { x: number; y: number; width: number; height: number }
  cancelled: boolean
}
type Marquee = { x: number; y: number; width: number; height: number; shift: boolean }
type ContextMenu =
  | { kind: 'block'; blockId: string; x: number; y: number }
  | { kind: 'stage'; x: number; y: number }

const doc = ref<DiagramDocument>(emptyDocument())
const tool = ref<Tool>('select')
const spaceHeld = ref(false)
const viewport = ref<ViewportTransform>({ x: 0, y: 0, zoom: 1 })
const status = ref('New diagram.')
const selected = ref<Set<string>>(new Set())
const selectedPort = ref<string | null>(null)
const portPreview = ref<{ x: number; y: number; side: PortSide; t: number } | null>(null)
const selectedStroke = ref<string | null>(null)
const preview = ref<Point[] | null>(null)
const drawing = ref<Array<Point & { pressure: number }> | null>(null)
const marquee = ref<Marquee | null>(null)
/** Canonical editor prefs (P4b) — not document state; localStorage for Diagram-Lab. */
const prefs = ref<EditorPreferences>(loadEditorPreferences())
const preferencesOpen = ref(false)
/** Frozen snap policy for the open document gesture (P4b mid-gesture safety). */
let gestureSnap: { enabled: boolean; spacing: number } | null = null

const snapOn = computed({
  get: () => prefs.value.snapEnabled,
  set: (value: boolean) => patchPrefs({ snapEnabled: value }),
})
const showGrid = computed({
  get: () => prefs.value.gridVisible,
  set: (value: boolean) => patchPrefs({ gridVisible: value }),
})

function activeSnapEnabled(): boolean {
  return gestureSnap?.enabled ?? prefs.value.snapEnabled
}

function activeSnapSpacing(): number {
  return gestureSnap?.spacing ?? prefs.value.snapSpacing
}

function patchPrefs(patch: Partial<EditorPreferences>): void {
  const next = sanitizeEditorPreferences({ ...prefs.value, ...patch })
  prefs.value = next
  saveEditorPreferences(next)
}

function resetPrefsToDefaults(): void {
  prefs.value = { ...DEFAULT_EDITOR_PREFERENCES }
  saveEditorPreferences(prefs.value)
}

function commitSpacingField(field: 'gridSpacing' | 'snapSpacing', event: Event): void {
  const input = event.target as HTMLInputElement
  const fallback = field === 'gridSpacing' ? prefs.value.gridSpacing : prefs.value.snapSpacing
  const next = normalizeSpacing(input.value, fallback)
  input.value = String(next)
  patchPrefs({ [field]: next })
  input.blur()
}

function commitPrefsFlag(field: 'gridVisible' | 'snapEnabled', event: Event): void {
  const input = event.target as HTMLInputElement
  patchPrefs({ [field]: input.checked })
  input.blur()
}
const stageEl = ref<HTMLElement | null>(null)
const fileEl = ref<HTMLInputElement | null>(null)
const canUndo = ref(false)
const canRedo = ref(false)
const interfaceFocus = ref<string | null>(null)
const openAsBlock = ref<string | null>(null)
const contextMenu = ref<ContextMenu | null>(null)
const extractPlan = ref<ExtractPreview | null>(null)
const expandPlan = ref<ExpandPreview | null>(null)
const componentName = ref('Processing')
const interfaceName = ref('in')
const interfaceSide = ref<PortSide>('left')
const fitToken = ref(0)
const wireDraft = ref<WireDraft | null>(null)
const wireHover = ref<Point>({ x: 0, y: 0 })
/** Client-space stamp for free-space double-press stub finish (PointerEvent.detail is always 0). */
let wireFreePress: PressStamp | null = null
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
const flowBridge = ref<{
  setViewport: (next: ViewportTransform) => void
  applyWheelZoom: (event: WheelEvent, stageRect: DOMRect) => void
} | null>(null)
const storage = new JsonRecordStorage()
const projectStorage = new JsonProjectStorage()
const libraryStorage = new JsonLibraryStorage()
const builtins = builtinLibraries()
const userLibrary = ref<SymbolLibrary>(emptyUserLibrary())
const libraryDiagnostics = ref<LibraryDiagnostic[]>([])
const libraryFile = ref<HTMLInputElement | null>(null)
const zoomToken = ref(0)
/** Session-remembered Σ dialog settings (D5d.0-A-Fix2). Not persisted across reloads. */
const benchGenOpen = ref(false)
const benchGenTopology = ref<BenchTopology>('C')
const benchGenBlocks = ref<BenchGenSize>(50)
const benchGenSeed = ref(1)
const benchGenGeometry = ref<BenchGeometry>('simple')
const benchGenWiring = ref<BenchWiring>('stubs')
const benchGenEstimate = computed(() =>
  estimateBenchCounts({
    topology: benchGenTopology.value,
    blocks: benchGenBlocks.value,
    seed: benchGenSeed.value,
    geometry: benchGenGeometry.value,
    wiring: benchGenWiring.value,
  }),
)
let clip: Fragment | null = null
/** Increments on each paste so copies do not stack on the same point (D5c.3). */
let clipPasteCount = 0
let drag: Drag | null = null
let resizeDrag: ResizeDrag | null = null
const resizing = ref(false)
let portDrag: {
  portId: string
  side: PortSide
  t: number
  placed: boolean
  cancelled: boolean
  /** Guided-port drag baseline (A2-P1); absent for side/free placement. */
  guided?: { lastU: number; guideU: number | undefined }
} | null = null
let bendDrag: BendDrag | null = null
let spanDrag: SpanDrag | null = null
let freeEndDrag: FreeEndDrag | null = null
let junctionDrag: { id: string; originX: number; originY: number; pointer: Point } | null = null
let labelDrag: {
  labelId: string
  origin: {
    edge: number
    distance: number
    offset: number
    shiftX: number
    shiftY: number
  }
  cancelled: boolean
} | null = null
/** P3a: drag of the P2 display-text group relative to the block centre. */
let displayTextDrag: {
  blockId: string
  originX: number
  originY: number
  startClientX: number
  startClientY: number
  cancelled: boolean
} | null = null
/** Prevents double commit/cancel from late pointerup / lostpointercapture (D5b.4). */
const gestureLatch = new GestureCloseLatch()
/** Bumped on focus loss so a racing pointerup can still cancel instead of commit (D5b.4a E3). */
let focusLossToken = 0
/** Viewport pan over the world SVG (MMB / Space+LMB) — does not touch wire draft (D5b.5b). */
let viewPan: {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
} | null = null
let spacePanMoved = false
let lastPointerClient: { x: number; y: number } | null = null

/** Sheet-only history when no project is open (Example, Symbols, …). */
const sheetSession = new EditSession(
  () => doc.value,
  (next) => {
    doc.value = next
  },
)

/**
 * One TransactionManager per open project (D5b.3).
 * Sheet edits and project commands share this history. No DocumentSessions / ProjectSession.
 */
let transactions: TransactionManager | null = null

function bindTransactions(created: DiagramProject): void {
  project.value = created
  transactions = new TransactionManager({
    get: () => {
      const current = project.value
      if (!current) throw new Error('The project is not open.')
      return current
    },
    set: (next) => {
      project.value = next
    },
  })
}

function clearTransactions(): void {
  transactions = null
}

/** Active sheet id for project edits — keep navigation and doc in sync (D5b.3). */
function activeSheetId(): string {
  if (navigation.value?.documentId) return navigation.value.documentId
  const current = project.value
  if (current) return current.rootDocumentId
  return doc.value.id
}

/** Re-bind the transaction manager if hot reload cleared the module slot while a project is open. */
function ensureProjectTransactions(): TransactionManager | null {
  const current = project.value
  if (!current) return null
  if (!transactions) bindTransactions(current)
  return transactions
}

/** Duck-typed EditSession that records full project snapshots while a project is open. */
const projectSheetAdapter = {
  get canUndo(): boolean {
    return transactions?.canUndo ?? false
  },
  get canRedo(): boolean {
    return transactions?.canRedo ?? false
  },
  get isGesturing(): boolean {
    return transactions?.isGesturing ?? false
  },
  execute(apply: (draft: DiagramDocument) => void): void {
    const manager = ensureProjectTransactions()
    const sheetId = activeSheetId()
    if (!manager) return
    // Concurrent command during a gesture: cancel first, then one new transaction.
    if (manager.isGesturing) {
      manager.cancel()
      rebindAfterProject()
    }
    const result = manager.transact('Edit', (proj) => {
      const sheet = documentById(proj, sheetId)
      if (!sheet) return { ok: false as const, message: 'The sheet is not in the project.' }
      apply(sheet)
      return proj
    })
    if (result.ok) {
      rebindAfterProject()
      const live = project.value
      const pinned = live ? documentById(live, sheetId) : null
      if (pinned) doc.value = pinned
    } else status.value = result.message
  },
  begin(): void {
    gestureLatch.reset()
    ensureProjectTransactions()?.begin('Gesture')
  },
  preview(apply: (draft: DiagramDocument) => void): void {
    const manager = ensureProjectTransactions()
    const sheetId = activeSheetId()
    if (!manager || gestureLatch.isClosing) return
    manager.preview((proj) => {
      const sheet = documentById(proj, sheetId)
      if (sheet) apply(sheet)
    })
    // Preview restores a fresh project graph from baseline — rebind doc to the live sheet.
    rebindAfterProject()
  },
  commit(finalize?: (draft: DiagramDocument) => void): boolean {
    if (!transactions?.isGesturing) return false
    if (finalize) finalize(doc.value)
    const recorded = transactions.commit()
    rebindAfterProject()
    return recorded
  },
  cancel(): void {
    if (!transactions?.isGesturing) return
    transactions.cancel()
    rebindAfterProject()
  },
  undo(): void {
    const manager = transactions
    if (!manager) return
    if (manager.isGesturing) {
      manager.cancel()
      rebindAfterProject()
      return
    }
    if (manager.undo().ok) rebindAfterProject()
  },
  redo(): void {
    const manager = transactions
    if (!manager) return
    // D5b.4: redo refuses while gesturing — does not cancel and does not touch redo.
    if (manager.isGesturing) return
    if (manager.redo().ok) rebindAfterProject()
  },
  load(next: DiagramDocument): void {
    sheetSession.load(next)
  },
}

function edits(): EditSession {
  if (project.value) return projectSheetAdapter as unknown as EditSession
  return sheetSession
}

const flowNodes = computed(() =>
  doc.value.blocks.map((block) => {
    const symbol = block.symbolId ? doc.value.symbols.find((item) => item.id === block.symbolId) : undefined
    return {
    id: block.id,
    type: 'block',
    position: { x: block.x, y: block.y },
    data: {
      name: block.name,
      width: block.width,
      height: block.height,
      symbolWidth: symbol?.width,
      symbolHeight: symbol?.height,
      showName: block.showName !== false,
      showPortNames: block.showPortNames !== false,
      displayText: block.displayText ?? null,
      displayTextFormat: blockTextFormat(block),
      displayMath: blockTextFormat(block) === 'latex' ? mathByBlock.get(block.id) ?? null : null,
      displayFormatted:
        blockTextFormat(block) === 'markdown' ? formattedByBlock.get(block.id) ?? null : null,
      displayPlain:
        blockTextFormat(block) === 'plain' ? plainByBlock.get(block.id) ?? null : null,
      showDisplayText: block.showDisplayText !== false,
      displayTextOffsetX: block.displayTextOffset?.x ?? 0,
      displayTextOffsetY: block.displayTextOffset?.y ?? 0,
      appearance: block.style ?? null,
      ports: doc.value.ports
        .filter((port) => port.blockId === block.id)
        .map((port) => {
          const at = portAnchor(doc.value, port.id)
          const symbolPort = port.symbolPortId ? symbol?.ports.find((pin) => pin.id === port.symbolPortId) : undefined
          const guided = Boolean(symbol && symbolPort && isGuidedPin(symbolPort) && !port.placed)
          return {
            ...port,
            name: logicalPortName(project.value, port),
            top: (at?.y ?? block.y) - block.y,
            left: (at?.x ?? block.x) - block.x,
            missing: Boolean(port.symbolPortId && symbol && !symbol.ports.some((pin) => pin.id === port.symbolPortId)),
            guided,
          }
        }),
      leads: symbol
        ? doc.value.ports
            .filter((port) => port.blockId === block.id && !port.placed)
            .map((port) => {
              const symbolPort = port.symbolPortId ? symbol.ports.find((pin) => pin.id === port.symbolPortId) : undefined
              if (!symbolPort) return null
              return radialLeadSegment(symbol, symbolPort, block.width, block.height, port.guideU ?? symbolPort.u)
            })
            .filter((lead): lead is NonNullable<typeof lead> => lead !== null)
        : [],
      // A plain block such as Boundary has no symbol. A flush rectangle reuses SymbolFace so port names show inside the outline.
      shapes: symbol ? symbol.shapes : null,
      labels: symbol ? symbol.labels : [],
      assets: doc.value.assets,
      selected: selected.value.has(block.id),
      handles: selected.value.size === 1 && selected.value.has(block.id) && tool.value === 'select',
      portsLive: tool.value === 'select',
      selectedPort: selectedPort.value,
    },
    draggable: tool.value === 'select' && !resizing.value && portDrag === null,
    connectable: false,
    style: { width: `${block.width}px`, height: `${block.height}px`, padding: 0, border: 'none', background: 'transparent', overflow: 'visible' },
  }
  }),
)

const netArrowAnalyses = computed(() => buildNetArrowAnalyses(doc.value))

/** Inputs to automatic arrowheads — forces wire marker recompute when metadata changes without geometry edits. */
const wireArrowRenderEpoch = computed(() => {
  const sheet = doc.value
  const dirs = sheet.ports.map((port) => `${port.id}:${resolvePortDirection(sheet, port.id)}`).join('\0')
  const overrides = sheet.segments.map((seg) => `${seg.id}:${seg.arrowheads ?? ''}`).join('\0')
  return `${diagramArrowheadDefault(sheet)}\0${dirs}\0${overrides}`
})

const wires = computed(() => {
  wireArrowRenderEpoch.value
  const analyses = netArrowAnalyses.value
  return doc.value.segments.map((segment) => {
    const markers = segmentArrowMarkers(doc.value, segment, analyses)
    return {
      id: segment.id,
      points: segment.points,
      start: segment.start,
      end: segment.end,
      markerStart: markers.markerStart,
      markerEnd: markers.markerEnd,
    }
  })
})

const diagnostics = computed(() => symbolDiagnostics(doc.value))
const updatePreview = ref<UpdatePreview | null>(null)
const project = ref<DiagramProject | null>(null)
const navigation = ref<HierarchyLocation | null>(null)
const canNavBack = ref(false)
const canNavForward = ref(false)
const crumbs = computed(() => (project.value && navigation.value ? breadcrumbs(project.value, navigation.value) : []))
const sharedLabel = computed(() => (project.value && navigation.value ? sharedDefinitionLabel(project.value, navigation.value) : null))
const pathKey = computed(() => navigation.value?.steps.map((step) => step.blockId).join('/') ?? '')
const focusedComponent = computed(() => project.value?.components.find((item) => item.id === interfaceFocus.value) ?? null)
const componentUses = computed(() => (project.value && interfaceFocus.value ? instancesOf(project.value, interfaceFocus.value) : []))
const interfaceNotes = computed(() => (project.value && focusedComponent.value ? interfaceDiagnostics(project.value, focusedComponent.value.id) : []))
const symbolPins = computed(() => {
  const current = project.value
  const component = focusedComponent.value
  if (!current || !component?.symbolId) return []
  for (const document of current.documents) {
    const symbol = document.symbols.find((item) => item.id === component.symbolId)
    if (symbol) return symbol.ports
  }
  return []
})
const interfacePortIds = computed(() =>
  doc.value.ports.map((port) => `${port.id}:${port.name}:${port.interfacePortId ?? ''}:${port.symbolPortId ?? ''}`).join('|'),
)
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

/** Runtime MathJax SVG keyed by label id (A2-P3). Not part of the document. */
const mathByLabel = reactive(new Map<string, MathRenderResult>())
/** Runtime MathJax SVG keyed by block id (A2-P3a). */
const mathByBlock = reactive(new Map<string, MathRenderResult>())
const formattedByLabel = reactive(new Map<string, FormattedTextResult>())
const formattedByBlock = reactive(new Map<string, FormattedTextResult>())
const plainByLabel = reactive(new Map<string, FormattedTextResult>())
const plainByBlock = reactive(new Map<string, FormattedTextResult>())

function blockCaptionPayload(block: DiagramDocument['blocks'][number]): string {
  const text = typeof block.displayText === 'string' ? block.displayText : ''
  if (!text.trim() || block.showDisplayText === false) return ''
  const em = blockDisplayEm(block)
  const align = blockDisplayTextAlign(block)
  return `${block.id}\n${em}\n${align}\n${text}`
}

function labelCaptionPayload(label: DiagramDocument['labels'][number]): string {
  if (label.visible === false) return ''
  const text = labelText(doc.value, label)
  if (!text.trim()) return ''
  const em = labelDisplayEm(label)
  const align = labelDisplayTextAlign(label)
  return `${label.id}\n${em}\n${align}\n${text}`
}

function parseCaptionEntry(entry: string): { id: string; em: number; align: TextAlign; text: string } {
  const parts = entry.split('\n')
  const id = parts[0]!
  const em = Number(parts[1])
  const align = (parts[2] as TextAlign) ?? 'left'
  const text = parts.slice(3).join('\n')
  return { id, em, align, text }
}
const mathPreview = ref<MathRenderResult | null>(null)
const blockMathPreview = ref<MathRenderResult | null>(null)
const formattedPreview = ref<FormattedTextResult | null>(null)
const blockFormattedPreview = ref<FormattedTextResult | null>(null)
const plainPreview = ref<FormattedTextResult | null>(null)
const blockPlainPreview = ref<FormattedTextResult | null>(null)

const labels = computed(() =>
  doc.value.labels.map((label) => {
    const format = labelTextFormat(label)
    const text = labelText(doc.value, label)
    const fontSize = typeof label.fontSize === 'number' && label.fontSize > 0 ? label.fontSize : null
    const math = format === 'latex' ? mathByLabel.get(label.id) ?? null : null
    const formatted = format === 'markdown' ? formattedByLabel.get(label.id) ?? null : null
    const plainLayout = format === 'plain' && typeof label.displayText === 'string' ? plainByLabel.get(label.id) ?? null : null
    const textAlign = labelDisplayTextAlign(label)
    const layoutWidth =
      formatted?.ok ? formatted.width : math?.ok ? math.width : plainLayout?.ok ? plainLayout.width : 0
    const anchorDx = layoutWidth > 0 ? wireLabelAnchorDx(layoutWidth, textAlign) : 0
    const inheritedOnly = isNameLabel(label) && !label.displayText?.trim()
    return {
      id: label.id,
      text,
      format,
      math,
      formatted,
      plain: plainLayout,
      textAlign,
      anchorDx,
      inheritedOnly,
      at: labelPlacement(doc.value, label.id),
      fontSize,
      visible: label.visible !== false,
    }
  }),
)

watch(
  () =>
    doc.value.labels
      .map((label) => {
        const format = labelTextFormat(label)
        if (format !== 'latex' || label.visible === false) return ''
        return labelCaptionPayload(label)
      })
      .filter(Boolean)
      .join('\0'),
  (serialized) => {
    const live = new Set<string>()
    const items = serialized
      ? serialized.split('\0').map((entry) => parseCaptionEntry(entry))
      : []
    for (const item of items) {
      live.add(item.id)
      const existing = mathByLabel.get(item.id)
      if (existing && existing.source === item.text && existing.em === item.em) continue
      const token = beginMathRequest(item.id)
      void renderMath(item.text, { em: item.em, display: false })
        .then((result) => {
          if (!isMathRequestCurrent(item.id, token)) return
          mathByLabel.set(item.id, result)
        })
        .catch((err) => {
          if (!isMathRequestCurrent(item.id, token)) return
          mathByLabel.set(item.id, {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            source: item.text,
            em: item.em,
          })
        })
    }
    for (const id of [...mathByLabel.keys()]) {
      if (live.has(id)) continue
      mathByLabel.delete(id)
      endMathConsumer(id)
    }
  },
  { immediate: true },
)

watch(
  () =>
    doc.value.labels
      .map((label) => {
        const format = labelTextFormat(label)
        if (format !== 'markdown' || label.visible === false) return ''
        return labelCaptionPayload(label)
      })
      .filter(Boolean)
      .join('\0'),
  (serialized) => {
    const live = new Set<string>()
    const items = serialized
      ? serialized.split('\0').map((entry) => parseCaptionEntry(entry))
      : []
    for (const item of items) {
      live.add(item.id)
      const existing = formattedByLabel.get(item.id)
      if (existing?.ok && existing.source === item.text && existing.em === item.em && existing.align === item.align)
        continue
      const token = beginMathRequest(`md:${item.id}`)
      void renderFormattedText(item.text, { em: item.em, align: item.align, idPrefix: `lbl${item.id}_` })
        .then((result) => {
          if (!isMathRequestCurrent(`md:${item.id}`, token)) return
          formattedByLabel.set(item.id, result)
        })
        .catch((err) => {
          if (!isMathRequestCurrent(`md:${item.id}`, token)) return
          formattedByLabel.set(item.id, {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            source: item.text,
            em: item.em,
            warnings: [],
          })
        })
    }
    for (const id of [...formattedByLabel.keys()]) {
      if (live.has(id)) continue
      formattedByLabel.delete(id)
      endMathConsumer(`md:${id}`)
    }
  },
  { immediate: true },
)

watch(
  () =>
    doc.value.labels
      .map((label) => {
        const format = labelTextFormat(label)
        if (format !== 'plain' || label.visible === false) return ''
        if (typeof label.displayText !== 'string' || !label.displayText.trim()) return ''
        return labelCaptionPayload(label)
      })
      .filter(Boolean)
      .join('\0'),
  (serialized) => {
    const live = new Set<string>()
    const items = serialized ? serialized.split('\0').map((entry) => parseCaptionEntry(entry)) : []
    for (const item of items) {
      live.add(item.id)
      const existing = plainByLabel.get(item.id)
      if (existing?.ok && existing.source === item.text && existing.em === item.em && existing.align === item.align)
        continue
      const token = beginMathRequest(`pl:${item.id}`)
      void renderPlainDisplayText(item.text, { em: item.em, align: item.align, idPrefix: `lpl${item.id}_` })
        .then((result) => {
          if (!isMathRequestCurrent(`pl:${item.id}`, token)) return
          plainByLabel.set(item.id, result)
        })
        .catch((err) => {
          if (!isMathRequestCurrent(`pl:${item.id}`, token)) return
          plainByLabel.set(item.id, {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            source: item.text,
            em: item.em,
            warnings: [],
          })
        })
    }
    for (const id of [...plainByLabel.keys()]) {
      if (live.has(id)) continue
      plainByLabel.delete(id)
      endMathConsumer(`pl:${id}`)
    }
  },
  { immediate: true },
)

watch(
  () =>
    doc.value.blocks
      .map((block) => {
        if (blockTextFormat(block) !== 'latex' || block.showDisplayText === false) return ''
        return blockCaptionPayload(block)
      })
      .filter(Boolean)
      .join('\0'),
  (serialized) => {
    const live = new Set<string>()
    const items = serialized
      ? serialized.split('\0').map((entry) => parseCaptionEntry(entry))
      : []
    for (const item of items) {
      live.add(item.id)
      const existing = mathByBlock.get(item.id)
      if (existing && existing.source === item.text && existing.em === item.em) continue
      const token = beginMathRequest(`block:${item.id}`)
      void renderMath(item.text, { em: item.em, display: false })
        .then((result) => {
          if (!isMathRequestCurrent(`block:${item.id}`, token)) return
          mathByBlock.set(item.id, result)
        })
        .catch((err) => {
          if (!isMathRequestCurrent(`block:${item.id}`, token)) return
          mathByBlock.set(item.id, {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            source: item.text,
            em: item.em,
          })
        })
    }
    for (const id of [...mathByBlock.keys()]) {
      if (live.has(id)) continue
      mathByBlock.delete(id)
      endMathConsumer(`block:${id}`)
    }
  },
  { immediate: true },
)

watch(
  () =>
    doc.value.blocks
      .map((block) => {
        if (blockTextFormat(block) !== 'markdown' || block.showDisplayText === false) return ''
        return blockCaptionPayload(block)
      })
      .filter(Boolean)
      .join('\0'),
  (serialized) => {
    const live = new Set<string>()
    const items = serialized ? serialized.split('\0').map((entry) => parseCaptionEntry(entry)) : []
    for (const item of items) {
      live.add(item.id)
      const existing = formattedByBlock.get(item.id)
      if (existing?.ok && existing.source === item.text && existing.em === item.em && existing.align === item.align)
        continue
      const token = beginMathRequest(`md:block:${item.id}`)
      void renderFormattedText(item.text, { em: item.em, align: item.align, idPrefix: `blk${item.id}_` })
        .then((result) => {
          if (!isMathRequestCurrent(`md:block:${item.id}`, token)) return
          formattedByBlock.set(item.id, result)
        })
        .catch((err) => {
          if (!isMathRequestCurrent(`md:block:${item.id}`, token)) return
          formattedByBlock.set(item.id, {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            source: item.text,
            em: item.em,
            warnings: [],
          })
        })
    }
    for (const id of [...formattedByBlock.keys()]) {
      if (live.has(id)) continue
      formattedByBlock.delete(id)
      endMathConsumer(`md:block:${id}`)
    }
  },
  { immediate: true },
)

watch(
  () =>
    doc.value.blocks
      .map((block) => {
        if (blockTextFormat(block) !== 'plain' || block.showDisplayText === false) return ''
        return blockCaptionPayload(block)
      })
      .filter(Boolean)
      .join('\0'),
  (serialized) => {
    const live = new Set<string>()
    const items = serialized ? serialized.split('\0').map((entry) => parseCaptionEntry(entry)) : []
    for (const item of items) {
      live.add(item.id)
      const existing = plainByBlock.get(item.id)
      if (existing?.ok && existing.source === item.text && existing.em === item.em && existing.align === item.align)
        continue
      const token = beginMathRequest(`pl:block:${item.id}`)
      void renderPlainDisplayText(item.text, { em: item.em, align: item.align, idPrefix: `bpl${item.id}_` })
        .then((result) => {
          if (!isMathRequestCurrent(`pl:block:${item.id}`, token)) return
          plainByBlock.set(item.id, result)
        })
        .catch((err) => {
          if (!isMathRequestCurrent(`pl:block:${item.id}`, token)) return
          plainByBlock.set(item.id, {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            source: item.text,
            em: item.em,
            warnings: [],
          })
        })
    }
    for (const id of [...plainByBlock.keys()]) {
      if (live.has(id)) continue
      plainByBlock.delete(id)
      endMathConsumer(`pl:block:${id}`)
    }
  },
  { immediate: true },
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

const selectedWireSegment = computed(() =>
  selectedSegment.value ? doc.value.segments.find((item) => item.id === selectedSegment.value) ?? null : null,
)

const diagramArrowDefault = computed((): ArrowheadDiagramDefault => diagramArrowheadDefault(doc.value))

const selectedSegmentArrowOverride = computed((): ArrowheadSegmentOverride => {
  const segment = selectedWireSegment.value
  return segment?.arrowheads ?? 'inherit'
})

const selectedSegmentEffectiveArrowMode = computed(() => {
  const segment = selectedWireSegment.value
  return segment ? effectiveArrowheadMode(doc.value, segment) : 'none'
})

/** Labels anchored on one segment (P1 visibility is per segment, not per named net). */
function labelsForSegment(segmentId: string) {
  return doc.value.labels.filter((label) => label.anchor.kind === 'segment' && label.anchor.segmentId === segmentId)
}

/** Read-only summary when a wire is selected (D5c.4). */
const wireInspectorSummary = computed(() => {
  const net = selectedNet.value
  if (!net) return ''
  const segmentId = selectedSegment.value ?? selectedWireSegment.value?.id
  const onNet = doc.value.segments.filter((item) => item.netId === net.id)
  const group = segmentId
    ? connectedSegmentGroups(onNet).find((g) => g.some((item) => item.id === segmentId)) ?? onNet
    : onNet
  const groupIds = new Set(group.map((item) => item.id))
  const ports = new Set<string>()
  for (const segment of group) {
    if (segment.start.kind === 'port') ports.add(segment.start.portId)
    if (segment.end.kind === 'port') ports.add(segment.end.portId)
  }
  const labels = doc.value.labels.filter((label) => label.anchor.kind === 'segment' && groupIds.has(label.anchor.segmentId))
  const base = `${group.length} segment${group.length === 1 ? '' : 's'}, ${ports.size} port${ports.size === 1 ? '' : 's'}, ${labels.length} label${labels.length === 1 ? '' : 's'}`
  if (diagramArrowheadDefault(doc.value) !== 'automatic') return base
  const arrow = automaticNetStatus(doc.value, net.id, segmentId ?? undefined)
  return `${base}. ${arrow.detail}`
})

/** Name labels on the selected segment (P5b: at most one expected). */
function nameLabelsForSegment(segmentId: string) {
  return labelsForSegment(segmentId).filter((label) => isNameLabel(label))
}

/** True when the selected segment already has a name label (visible or hidden). */
const selectedSegmentHasNameLabel = computed(() => {
  const segmentId = selectedSegment.value
  if (!segmentId) return false
  return nameLabelsForSegment(segmentId).length > 0
})

/** Primary name label on the selected segment (P5b: typically one). */
const selectedNameLabel = computed(() => {
  const segmentId = selectedSegment.value
  if (!segmentId) return null
  return nameLabelsForSegment(segmentId)[0] ?? null
})

/** A2-P2: custom display override present on the selected name label. */
const selectedLabelUsesCustomDisplay = computed(() => {
  const label = selectedNameLabel.value
  return Boolean(label && typeof label.displayText === 'string' && label.displayText.trim().length > 0)
})

const selectedLabelDisplayText = computed(() => {
  const label = selectedNameLabel.value
  if (!label || typeof label.displayText !== 'string') return ''
  return label.displayText
})

/** A2-P3: Plain Text vs LaTeX for the selected custom display label. */
const selectedLabelTextFormat = computed((): LabelTextFormat => {
  const label = selectedNameLabel.value
  return label ? labelTextFormat(label) : 'plain'
})

const selectedLabelDisplayAlign = computed((): TextAlign => {
  const label = selectedNameLabel.value
  return label ? labelDisplayTextAlign(label) : 'left'
})

const selectedLabelDisplayEm = computed(() => {
  const label = selectedNameLabel.value
  return label ? labelDisplayEm(label) : LABEL_DISPLAY_DEFAULT_EM
})

watch(
  () => {
    const label = selectedNameLabel.value
    if (!label || !selectedLabelUsesCustomDisplay.value) return ''
    if (labelTextFormat(label) !== 'latex') return ''
    const em = labelDisplayEm(label)
    const align = labelDisplayTextAlign(label)
    const text = typeof label.displayText === 'string' ? label.displayText : ''
    return `${em}\n${align}\n${text}`
  },
  (serialized) => {
    if (!serialized) {
      mathPreview.value = null
      endMathConsumer('__preview__')
      return
    }
    const first = serialized.indexOf('\n')
    const second = serialized.indexOf('\n', first + 1)
    const em = Number(serialized.slice(0, first))
    const text = serialized.slice(second + 1)
    const existing = mathPreview.value
    if (existing && existing.source === text && existing.em === em) return
    const token = beginMathRequest('__preview__')
    void renderMath(text, { em, display: false })
      .then((result) => {
        if (!isMathRequestCurrent('__preview__', token)) return
        mathPreview.value = result
      })
      .catch((err) => {
        if (!isMathRequestCurrent('__preview__', token)) return
        mathPreview.value = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          source: text,
          em,
        }
      })
  },
  { immediate: true },
)

watch(
  () => {
    const label = selectedNameLabel.value
    if (!label || !selectedLabelUsesCustomDisplay.value) return ''
    if (labelTextFormat(label) !== 'markdown') return ''
    const em = labelDisplayEm(label)
    const align = labelDisplayTextAlign(label)
    const text = typeof label.displayText === 'string' ? label.displayText : ''
    if (!text.trim()) return ''
    return `${em}\n${align}\n${text}`
  },
  (serialized) => {
    if (!serialized) {
      formattedPreview.value = null
      endMathConsumer('__fmt-preview__')
      return
    }
    const first = serialized.indexOf('\n')
    const second = serialized.indexOf('\n', first + 1)
    const em = Number(serialized.slice(0, first))
    const align = serialized.slice(first + 1, second) as TextAlign
    const text = serialized.slice(second + 1)
    const existing = formattedPreview.value
    if (existing?.ok && existing.source === text && existing.em === em && existing.align === align) return
    const token = beginMathRequest('__fmt-preview__')
    void renderFormattedText(text, { em, align, idPrefix: 'prev_' })
      .then((result) => {
        if (!isMathRequestCurrent('__fmt-preview__', token)) return
        formattedPreview.value = result
      })
      .catch((err) => {
        if (!isMathRequestCurrent('__fmt-preview__', token)) return
        formattedPreview.value = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          source: text,
          em,
          warnings: [],
        }
      })
  },
  { immediate: true },
)

watch(
  () => {
    const label = selectedNameLabel.value
    if (!label || !selectedLabelUsesCustomDisplay.value) return ''
    if (labelTextFormat(label) !== 'plain') return ''
    const em = labelDisplayEm(label)
    const align = labelDisplayTextAlign(label)
    const text = typeof label.displayText === 'string' ? label.displayText : ''
    if (!text.trim()) return ''
    return `${em}\n${align}\n${text}`
  },
  (serialized) => {
    if (!serialized) {
      plainPreview.value = null
      endMathConsumer('__plain-preview__')
      return
    }
    const first = serialized.indexOf('\n')
    const second = serialized.indexOf('\n', first + 1)
    const em = Number(serialized.slice(0, first))
    const align = serialized.slice(first + 1, second) as TextAlign
    const text = serialized.slice(second + 1)
    const existing = plainPreview.value
    if (existing?.ok && existing.source === text && existing.em === em && existing.align === align) return
    const token = beginMathRequest('__plain-preview__')
    void renderPlainDisplayText(text, { em, align, idPrefix: 'lprev_' })
      .then((result) => {
        if (!isMathRequestCurrent('__plain-preview__', token)) return
        plainPreview.value = result
      })
      .catch((err) => {
        if (!isMathRequestCurrent('__plain-preview__', token)) return
        plainPreview.value = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          source: text,
          em,
          warnings: [],
        }
      })
  },
  { immediate: true },
)

/** True when the selected segment has no name labels or at least one drawn label (P1 / P5b). */
const selectedSegmentLabelsVisible = computed(() => {
  const segmentId = selectedSegment.value
  if (!segmentId) return true
  const labels = nameLabelsForSegment(segmentId)
  if (labels.length === 0) return true
  return labels.some((label) => label.visible !== false)
})

/** Legacy / accidental duplicate display names on this sheet (D5c.5). */
const selectedNameCollision = computed(() => {
  const net = selectedNet.value
  if (!net) return null
  const ids = netsNamed(doc.value, net.name)
  if (ids.length <= 1) return null
  return { name: net.name, count: ids.length, netIds: ids }
})

const sheetNameCollisions = computed(() => nameCollisions(doc.value))

/** Skip line generation when the grid is hidden; pitch from gridSpacing (P4b). */
const gridLines = computed(() => {
  if (!prefs.value.gridVisible) return []
  const step = normalizeSpacing(prefs.value.gridSpacing)
  const lines: number[] = []
  for (let value = 0; value <= 1600; value += step) lines.push(value)
  return lines
})

const oneBlock = computed(() => (selected.value.size === 1 ? doc.value.blocks.find((block) => selected.value.has(block.id)) ?? null : null))

const selectedBlockDisplayAlign = computed((): TextAlign => {
  const block = oneBlock.value
  return block ? blockDisplayTextAlign(block) : 'left'
})

const selectedBlockDisplayEm = computed(() => {
  const block = oneBlock.value
  return block ? blockDisplayEm(block) : BLOCK_DISPLAY_DEFAULT_EM
})

const selectedBlockTextFormat = computed(() => {
  const block = oneBlock.value
  return block ? blockTextFormat(block) : 'plain'
})

watch(
  () => {
    const block = oneBlock.value
    if (!block) return ''
    if (blockTextFormat(block) !== 'latex') return ''
    const em = blockDisplayEm(block)
    const text = typeof block.displayText === 'string' ? block.displayText : ''
    if (!text.trim()) return ''
    return `${em}\n${text}`
  },
  (serialized) => {
    if (!serialized) {
      blockMathPreview.value = null
      endMathConsumer('__block-preview__')
      return
    }
    const newline = serialized.indexOf('\n')
    const em = Number(serialized.slice(0, newline))
    const text = serialized.slice(newline + 1)
    const existing = blockMathPreview.value
    if (existing && existing.source === text && existing.em === em) return
    const token = beginMathRequest('__block-preview__')
    void renderMath(text, { em, display: false })
      .then((result) => {
        if (!isMathRequestCurrent('__block-preview__', token)) return
        blockMathPreview.value = result
      })
      .catch((err) => {
        if (!isMathRequestCurrent('__block-preview__', token)) return
        blockMathPreview.value = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          source: text,
          em,
        }
      })
  },
  { immediate: true },
)

watch(
  () => {
    const block = oneBlock.value
    if (!block) return ''
    if (blockTextFormat(block) !== 'markdown') return ''
    const em = blockDisplayEm(block)
    const align = blockDisplayTextAlign(block)
    const text = typeof block.displayText === 'string' ? block.displayText : ''
    if (!text.trim()) return ''
    return `${em}\n${align}\n${text}`
  },
  (serialized) => {
    if (!serialized) {
      blockFormattedPreview.value = null
      endMathConsumer('__block-fmt-preview__')
      return
    }
    const first = serialized.indexOf('\n')
    const second = serialized.indexOf('\n', first + 1)
    const em = Number(serialized.slice(0, first))
    const align = serialized.slice(first + 1, second) as TextAlign
    const text = serialized.slice(second + 1)
    const existing = blockFormattedPreview.value
    if (existing?.ok && existing.source === text && existing.em === em && existing.align === align) return
    const token = beginMathRequest('__block-fmt-preview__')
    void renderFormattedText(text, { em, align, idPrefix: 'bprev_' })
      .then((result) => {
        if (!isMathRequestCurrent('__block-fmt-preview__', token)) return
        blockFormattedPreview.value = result
      })
      .catch((err) => {
        if (!isMathRequestCurrent('__block-fmt-preview__', token)) return
        blockFormattedPreview.value = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          source: text,
          em,
          warnings: [],
        }
      })
  },
  { immediate: true },
)

watch(
  () => {
    const block = oneBlock.value
    if (!block) return ''
    if (blockTextFormat(block) !== 'plain') return ''
    const em = blockDisplayEm(block)
    const align = blockDisplayTextAlign(block)
    const text = typeof block.displayText === 'string' ? block.displayText : ''
    if (!text.trim()) return ''
    return `${em}\n${align}\n${text}`
  },
  (serialized) => {
    if (!serialized) {
      blockPlainPreview.value = null
      endMathConsumer('__block-plain-preview__')
      return
    }
    const first = serialized.indexOf('\n')
    const second = serialized.indexOf('\n', first + 1)
    const em = Number(serialized.slice(0, first))
    const align = serialized.slice(first + 1, second) as TextAlign
    const text = serialized.slice(second + 1)
    const existing = blockPlainPreview.value
    if (existing?.ok && existing.source === text && existing.em === em && existing.align === align) return
    const token = beginMathRequest('__block-plain-preview__')
    void renderPlainDisplayText(text, { em, align, idPrefix: 'bplprev_' })
      .then((result) => {
        if (!isMathRequestCurrent('__block-plain-preview__', token)) return
        blockPlainPreview.value = result
      })
      .catch((err) => {
        if (!isMathRequestCurrent('__block-plain-preview__', token)) return
        blockPlainPreview.value = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          source: text,
          em,
          warnings: [],
        }
      })
  },
  { immediate: true },
)

const expandTarget = computed(() => {
  const block = oneBlock.value
  const current = project.value
  if (!block?.componentId || !current) return null
  const component = current.components.find((item) => item.id === block.componentId)
  if (!component || component.implementation.kind !== 'diagram') return null
  return block
})
const canMakeUnique = computed(() => {
  const block = oneBlock.value
  const current = project.value
  if (!block?.componentId || !current) return false
  return instancesOf(current, block.componentId).length >= 2
})

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

/** Middle-click always pans; left pans only in Pan tool or while Space is held (D5b.5a). */
const panDragButtons = computed(() => panOnDragButtons(tool.value, spaceHeld.value))

const stageCursorClass = computed(() => {
  if (spaceHeld.value || tool.value === 'pan') return 'cursor-pan'
  if (tool.value === 'wire' || tool.value === 'freehand' || tool.value === 'port') return 'cursor-draw'
  return 'cursor-select'
})

function resetInteractionMode(): void {
  tool.value = 'select'
  spaceHeld.value = false
  spacePanMoved = false
  viewPan = null
  portPreview.value = null
  clearWireDraft()
  marquee.value = null
  clip = null
  clipPasteCount = 0
}

function chooseEditorTool(next: Tool): void {
  const previous = tool.value
  const chosen = nextTool(previous, next)
  if (chosen !== 'port') portPreview.value = null
  if (chosen !== 'wire') clearWireDraft()
  if (chosen !== 'freehand') drawing.value = null
  if (chosen !== 'select') marquee.value = null
  tool.value = chosen
  if (chosen === 'select') status.value = 'Select.'
  else if (chosen === 'pan') status.value = 'Pan. Middle-click or Space+drag also pan in any tool.'
  else if (chosen === 'wire')
    status.value = 'LMB: Add point | Double-click: Finish | Esc/Backspace: Undo point | Shift+Esc: Cancel'
  else if (chosen === 'freehand') status.value = 'Freehand.'
  else if (chosen === 'port') status.value = 'Click a block edge to add a port.'
}

function refreshHistory(): void {
  canUndo.value = edits().canUndo
  canRedo.value = edits().canRedo
}

function onViewport(next: ViewportTransform): void {
  viewport.value = { x: next.x, y: next.y, zoom: next.zoom }
  refreshWireHoverFromClient()
}

/**
 * One stage-level wheel path (D5d.0-A-Fix1). Vue Flow's own zoom-on-scroll is off so overlay
 * hits (wires, labels, junctions) and empty pane space share the same cursor-centred zoom.
 * Capture + stop keeps a second handler from applying the same delta.
 */
function onStageWheel(event: WheelEvent): void {
  event.preventDefault()
  event.stopPropagation()
  const rect = stageEl.value?.getBoundingClientRect()
  if (!rect) return
  flowBridge.value?.applyWheelZoom(event, rect)
}

function clientPointToWorld(clientX: number, clientY: number): Point {
  const rect = stageEl.value?.getBoundingClientRect()
  return {
    x: (clientX - (rect?.left ?? 0) - viewport.value.x) / viewport.value.zoom,
    y: (clientY - (rect?.top ?? 0) - viewport.value.y) / viewport.value.zoom,
  }
}

/** P4a/P4b: grid-quantize a free point using active (or gesture-frozen) snap policy. */
function gridSnapPoint(point: Point): Point {
  const enabled = activeSnapEnabled()
  const spacing = activeSnapSpacing()
  return {
    x: snapValue(point.x, enabled, spacing),
    y: snapValue(point.y, enabled, spacing),
  }
}

/**
 * P4a: after connectivity hit-test, snap only free-space points.
 * Port / junction / segment / end hits keep exact anchors (connectivity wins).
 */
function snapFreeHit(hit: SnapHit): SnapHit {
  if (hit.kind !== 'free') return hit
  return { kind: 'free', point: gridSnapPoint(hit.point) }
}

/** Rubber-band target while drawing: exact connection hit, else grid-snapped free point. */
function wireHoverFromWorld(world: Point): Point {
  const hit = snapTarget(doc.value, world)
  if (hit.kind === 'free' || hit.kind === 'ambiguous') return gridSnapPoint(world)
  return { ...hit.point }
}

function refreshWireHoverFromClient(): void {
  if (!wireDraft.value || !lastPointerClient) return
  wireHover.value = wireHoverFromWorld(clientPointToWorld(lastPointerClient.x, lastPointerClient.y))
}

function beginViewPan(event: PointerEvent): void {
  event.preventDefault()
  event.stopPropagation()
  viewPan = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: viewport.value.x,
    originY: viewport.value.y,
    moved: false,
  }
  try {
    ;(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId)
  } catch {
    // Window / element listeners still receive moves when capture is unavailable.
  }
}

function moveViewPan(event: PointerEvent): boolean {
  const current = viewPan
  if (!current || event.pointerId !== current.pointerId) return false
  const dx = event.clientX - current.startX
  const dy = event.clientY - current.startY
  if (!current.moved && Math.hypot(dx, dy) >= 2) {
    current.moved = true
    if (spaceHeld.value) spacePanMoved = true
  }
  const next = { x: current.originX + dx, y: current.originY + dy, zoom: viewport.value.zoom }
  viewport.value = next
  flowBridge.value?.setViewport(next)
  lastPointerClient = { x: event.clientX, y: event.clientY }
  refreshWireHoverFromClient()
  return true
}

function endViewPan(event?: PointerEvent): boolean {
  if (!viewPan) return false
  if (event && event.pointerId !== viewPan.pointerId) return false
  viewPan = null
  return true
}

function openDocument(next: DiagramDocument, message: string): void {
  project.value = null
  navigation.value = null
  clearTransactions()
  navPast.length = 0
  navFuture.length = 0
  viewMemory.clear()
  expanded.value = []
  sheetSession.load(next)
  selected.value = new Set()
  selectedStroke.value = null
  selectedSegment.value = null
  mergeFrom.value = null
  preview.value = null
  editingSymbol.value = null
  updatePreview.value = null
  resetInteractionMode()
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
    x: snapValue((client.x - (rect?.left ?? 0) - viewport.value.x) / viewport.value.zoom, activeSnapEnabled(), activeSnapSpacing()),
    y: snapValue((client.y - (rect?.top ?? 0) - viewport.value.y) / viewport.value.zoom, activeSnapEnabled(), activeSnapSpacing()),
  }
}

function nextSymbolSlot(): Point {
  const count = doc.value.blocks.length
  return {
    x: snapValue(80 + (count % 4) * 180, activeSnapEnabled(), activeSnapSpacing()),
    y: snapValue(80 + Math.floor(count / 4) * 140, activeSnapEnabled(), activeSnapSpacing()),
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
    const guided = isGuidedPin(pin)
    const at = guided
      ? guidedPinPoint(symbol, pin, symbol.width, symbol.height) ?? pinPoint(symbol.width, symbol.height, pin)
      : pinPoint(symbol.width, symbol.height, pin)
    return {
      id: pin.id,
      name: pin.name,
      side: pin.side,
      x: at.x,
      y: at.y,
      free: typeof pin.x === 'number' && typeof pin.y === 'number',
      guided,
    }
  })
}

function faceLeads(symbol: SymbolDefinition) {
  return symbol.ports
    .map((pin) => radialLeadSegment(symbol, pin, symbol.width, symbol.height))
    .filter((lead): lead is NonNullable<typeof lead> => lead !== null)
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

/** Developer-only opener for D5d.0-A synthetic sheets. Not the Benchmark Center. */
function openSyntheticBenchDialog(): void {
  benchGenOpen.value = true
}

function resetSyntheticBenchForm(): void {
  benchGenTopology.value = 'C'
  benchGenBlocks.value = 50
  benchGenSeed.value = 1
  benchGenGeometry.value = 'simple'
  benchGenWiring.value = 'stubs'
}

function dismissSyntheticBenchDialog(): void {
  benchGenOpen.value = false
}

function generateSyntheticBench(): void {
  const topology = benchGenTopology.value
  const blocks = benchGenBlocks.value
  const seed = Number(benchGenSeed.value)
  const geometry = benchGenGeometry.value
  const wiring = benchGenWiring.value
  if (!BENCHGEN_SIZES.includes(blocks)) {
    status.value = `Unsupported size. Use ${BENCHGEN_SIZES.join(', ')}.`
    return
  }
  if (!Number.isInteger(seed) || seed < 0) {
    status.value = 'Seed must be a non-negative integer.'
    return
  }
  try {
    const started = performance.now()
    const result = generateBenchDocument({ topology, blocks, seed, geometry, wiring })
    benchGenOpen.value = false
    // Install as a project root so hierarchy / Open as stay available (openDocument would clear the project).
    openInstalled(
      createProject(`Synthetic ${topology}/${blocks}`, result.doc),
      `Synthetic ${topology}/${blocks} seed=${seed} ${geometry} ${wiring} · seg=${result.actual.segments} nets=${result.actual.nets} · hash ${result.hash.slice(0, 12)}… · ${Math.round(performance.now() - started)} ms · project ready for Open as`,
    )
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Synthetic bench failed.'
  }
}

function clearUiGestureState(): void {
  symbolEditor.value?.cancelDraft()
  symbolEditor.value?.abandonGesture()
  if (wireDraft.value) clearWireDraft()
  mergeFrom.value = null
  preview.value = null
  drawing.value = null
  marquee.value = null
  stopResizeListeners()
  stopPortListeners()
  if (resizeDrag) resizeDrag.cancelled = true
  if (portDrag) portDrag.cancelled = true
  if (drag) drag.cancelled = true
  if (labelDrag) labelDrag.cancelled = true
  if (displayTextDrag) displayTextDrag.cancelled = true
  portPreview.value = null
  resizing.value = false
  resizeDrag = null
  portDrag = null
  drag = null
  bendDrag = null
  spanDrag = null
  freeEndDrag = null
  junctionDrag = null
  labelDrag = null
  displayTextDrag = null
  gestureSnap = null
  stopLabelListeners()
  stopDisplayTextListeners()
}

/**
 * Cancel an open document gesture and clear UI drag state (D5b.4).
 * Idempotent against late pointer events after the first close.
 */
function cancelActiveDocumentGesture(message?: string): boolean {
  const wasGesturing = edits().isGesturing
  const hadUi = Boolean(
    resizeDrag ||
      portDrag ||
      drag ||
      bendDrag ||
      spanDrag ||
      freeEndDrag ||
      junctionDrag ||
      labelDrag ||
      displayTextDrag ||
      wireDraft.value ||
      drawing.value,
  )
  if (!wasGesturing && !hadUi && !gestureLatch.isClosing) {
    clearUiGestureState()
    return false
  }
  gestureLatch.tryBeginClose()
  if (wasGesturing) edits().cancel()
  clearUiGestureState()
  refreshHistory()
  if (message) status.value = message
  return wasGesturing || hadUi
}

/** @deprecated name kept for call sites — cancels without a status message. */
function releaseGesture(): void {
  cancelActiveDocumentGesture()
}

function beginDocumentGesture(): void {
  gestureLatch.reset()
  // Freeze snap enable + spacing for the whole gesture (P4b).
  gestureSnap = { enabled: prefs.value.snapEnabled, spacing: prefs.value.snapSpacing }
  edits().begin()
}

/** Closes the open gesture once. Returns whether a history entry was recorded (project mode). */
function commitDocumentGesture(finalize?: (draft: DiagramDocument) => void): boolean {
  if (gestureLatch.isClosing || !edits().isGesturing) {
    clearUiGestureState()
    return false
  }
  gestureLatch.tryBeginClose()
  const out = (edits() as EditSession & { commit: (fn?: (draft: DiagramDocument) => void) => boolean | void }).commit(finalize)
  clearUiGestureState()
  refreshHistory()
  return typeof out === 'boolean' ? out : true
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
  selectedPort.value = null
  portPreview.value = null
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

function rebindAfterProject(): void {
  const current = project.value
  const location = navigation.value
  if (!current || !location) {
    refreshHistory()
    return
  }
  const resolved = resolveLocation(current, location.steps)
  navigation.value = resolved.location
  reveal(resolved.location)
  const sheetId = resolved.location.documentId
  const sheet =
    documentById(current, sheetId) ??
    documentById(current, current.rootDocumentId)
  if (sheet) doc.value = sheet
  if (interfaceFocus.value && !current.components.some((item) => item.id === interfaceFocus.value)) interfaceFocus.value = null
  selected.value = new Set([...selected.value].filter((id) => sheet?.blocks.some((block) => block.id === id)))
  selectedPort.value = selectedPort.value && sheet?.ports.some((port) => port.id === selectedPort.value) ? selectedPort.value : null
  selectedSegment.value = selectedSegment.value && sheet?.segments.some((segment) => segment.id === selectedSegment.value) ? selectedSegment.value : null
  refreshHistory()
  syncNav()
  if (resolved.message) status.value = resolved.message
}

function applyProject<T>(make: (current: DiagramProject) => ProjectResult<T>, done: (value: T) => string, label = 'Project change'): void {
  const manager = transactions
  if (!project.value || !manager) return
  releaseGesture()
  const result = manager.transact(label, (current) => {
    const outcome = make(current)
    if (!outcome.ok) return { ok: false as const, message: outcome.message }
    return { ok: true as const, project: outcome.project, value: outcome.value }
  })
  if (!result.ok) {
    status.value = result.message
    refreshHistory()
    return
  }
  rebindAfterProject()
  status.value = done(result.value)
}

function openInstalled(created: DiagramProject, message: string): void {
  const root = documentById(created, created.rootDocumentId)
  if (!root) {
    status.value = 'The project has no root diagram.'
    return
  }
  bindTransactions(created)
  navPast.length = 0
  navFuture.length = 0
  viewMemory.clear()
  expanded.value = []
  interfaceFocus.value = null
  extractPlan.value = null
  expandPlan.value = null
  closeOpenAs()
  navigation.value = rootLocation(created)
  selected.value = new Set()
  editingSymbol.value = null
  resetInteractionMode()
  rebindAfterProject()
  refreshHistory()
  const bounds = contentBounds(doc.value)
  frame.value = { mode: 'fit', x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, zoom: 1, token: (frame.value?.token ?? 0) + 1 }
  syncNav()
  status.value = message
}

function newDesign(): void {
  openInstalled(createProject('Design'), 'New project. The root sheet is empty.')
}

function loadDigital(): void {
  openInstalled(digitalProject(), 'Digital System. Double-click Datapath, then U1, then Stage.')
}

function loadSignal(): void {
  openInstalled(signalProject(), 'Signal Processing. Meters are SVG. Scope is a bitmap. Double-click Channel.')
}

function loadGeneral(): void {
  openInstalled(generalProject(), 'General diagram. Flowchart, text, pictures, a group, and ink.')
}

function createAbstract(): void {
  const name = componentName.value.trim() || 'Component'
  applyProject(
    (current) => addComponent(current, { name, ports: [], implementation: { kind: 'none' } }),
    (value) => {
      interfaceFocus.value = value.componentId
      return `${name} has no implementation yet.`
    },
  )
}

function placeFocused(): void {
  const component = focusedComponent.value
  if (!component) return
  const sheetId = doc.value.id
  const count = doc.value.blocks.length
  const at = { x: 80 + (count % 3) * 220, y: 80 + Math.floor(count / 3) * 160 }
  applyProject(
    (current) => instantiateComponent(current, sheetId, component.id, at, component.name),
    () => `${component.name} placed on this sheet.`,
  )
}

function addLogicalPort(): void {
  const component = focusedComponent.value
  if (!component) return
  const name = interfaceName.value.trim()
  const side = interfaceSide.value
  applyProject(
    (current) => addInterfacePort(current, component.id, name, side),
    () => `Port ${name} was added to every instance of ${component.name}.`,
  )
}

function renameLogical(interfacePortId: string, event: Event): void {
  const component = focusedComponent.value
  if (!component) return
  const name = (event.target as HTMLInputElement).value
  applyProject(
    (current) => renameInterfacePort(current, component.id, interfacePortId, name),
    () => `Port renamed to ${name}. Connections were kept.`,
  )
}

function removeLogical(interfacePortId: string): void {
  const component = focusedComponent.value
  if (!component) return
  applyProject(
    (current) => removeInterfacePort(current, component.id, interfacePortId),
    () => 'Logical port removed.',
  )
}

function shiftLogical(interfacePortId: string, delta: -1 | 1): void {
  const component = focusedComponent.value
  if (!component) return
  applyProject(
    (current) => moveInterfacePort(current, component.id, interfacePortId, delta),
    () => 'Port order updated.',
  )
}

function bindLogical(interfacePortId: string, event: Event): void {
  const component = focusedComponent.value
  if (!component) return
  const symbolPortId = (event.target as HTMLSelectElement).value
  applyProject(
    (current) => bindInterfacePort(current, component.id, interfacePortId, symbolPortId || null),
    () => (symbolPortId ? 'Bound by pin id.' : 'Binding cleared. The wire was kept.'),
  )
}

function pinLogical(interfacePortId: string): void {
  const component = focusedComponent.value
  if (!component) return
  applyProject(
    (current) => addBoundPin(current, component.id, interfacePortId, interfaceSide.value),
    () => 'Symbol pin added and bound by id.',
  )
}

function makeImplementation(): void {
  const component = focusedComponent.value
  if (!component) return
  applyProject(
    (current) => createImplementation(current, component.id),
    () => `${component.name} has an empty diagram. Double-click an instance to open it.`,
  )
}

function focusComponent(id: string): void {
  interfaceFocus.value = id
  const item = project.value?.components.find((component) => component.id === id)
  if (item) componentName.value = item.name
  extractPlan.value = null
  expandPlan.value = null
}

function renameFocused(): void {
  const component = focusedComponent.value
  if (!component) return
  const name = componentName.value.trim()
  applyProject(
    (current) => renameComponent(current, component.id, name),
    () => `${name} renamed. Instances keep their own names.`,
  )
}

function duplicateFocused(): void {
  const component = focusedComponent.value
  if (!component) return
  applyProject(
    (current) => duplicateComponent(current, component.id),
    (value) => {
      interfaceFocus.value = value.componentId
      const copy = project.value?.components.find((item) => item.id === value.componentId)
      if (copy) componentName.value = copy.name
      return `${component.name} was copied with its diagram. Instances of the original were not moved.`
    },
  )
}

function deleteFocused(): void {
  const component = focusedComponent.value
  if (!component) return
  applyProject(
    (current) => removeComponent(current, component.id),
    () => `${component.name} and its unused diagram were removed.`,
  )
}

function proposeExtract(): void {
  const current = project.value
  if (!current) return
  const preview = previewExtract(current, doc.value.id, [...selected.value])
  extractPlan.value = preview
  expandPlan.value = null
  status.value = preview.ok ? `Extract would add ${preview.ports.length} ports. Nothing has changed yet.` : preview.message
}

function confirmExtract(): void {
  const plan = extractPlan.value
  if (!plan?.ok) return
  const name = componentName.value.trim() || 'Block'
  const ids = [...plan.blockIds]
  const sheetId = doc.value.id
  applyProject(
    (current) => extractComponent(current, sheetId, ids, name),
    (value) => {
      extractPlan.value = null
      interfaceFocus.value = value.componentId
      selected.value = new Set([value.blockId])
      return `${name} replaces the selection. Open it with a double-click.`
    },
  )
}

function proposeExpand(): void {
  const block = expandTarget.value
  const current = project.value
  if (!block || !current) return
  const preview = previewExpand(current, doc.value.id, block.id)
  expandPlan.value = preview
  extractPlan.value = null
  status.value = preview.ok ? `Expand would replace ${block.name}. Other instances stay. Nothing has changed yet.` : preview.message
}

function confirmExpand(): void {
  const plan = expandPlan.value
  if (!plan?.ok) return
  const sheetId = doc.value.id
  applyProject(
    (current) => expandComponent(current, sheetId, plan.blockId),
    (value) => {
      expandPlan.value = null
      selected.value = new Set(value.blockIds)
      return `${plan.blockName} was replaced by its diagram. The shared definition remains for the other instances.`
    },
  )
}

function makeUniqueSelected(): void {
  const block = oneBlock.value
  if (!block) return
  const sheetId = doc.value.id
  applyProject(
    (current) => makeUnique(current, sheetId, block.id),
    (value) => {
      interfaceFocus.value = value.componentId
      const copy = project.value?.components.find((item) => item.id === value.componentId)
      if (copy) componentName.value = copy.name
      return `${block.name} has its own definition. The other instances still share the original.`
    },
  )
}

function loadProject(): void {
  const sample = sampleProject()
  const root = documentById(sample, sample.rootDocumentId)
  if (!root) {
    status.value = 'The sample project has no root diagram.'
    return
  }
  bindTransactions(sample)
  interfaceFocus.value = null
  extractPlan.value = null
  expandPlan.value = null
  navPast.length = 0
  navFuture.length = 0
  viewMemory.clear()
  expanded.value = []
  navigation.value = rootLocation(sample)
  selected.value = new Set()
  clearWireDraft()
  editingSymbol.value = null
  rebindAfterProject()
  refreshHistory()
  const bounds = contentBounds(doc.value)
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

function closeOpenAs(): void {
  openAsBlock.value = null
  contextMenu.value = null
}

function dismissOpenAs(): void {
  closeOpenAs()
  status.value = 'Open as cancelled.'
}

function blockOpenKind(blockId: string): 'diagram' | 'choose' | 'other' | 'boundary' | 'missing' {
  const block = doc.value.blocks.find((item) => item.id === blockId)
  if (!block) return 'missing'
  if (!block.componentId && block.name === 'Boundary') return 'boundary'
  if (!project.value) return 'missing'
  if (!block.componentId) return 'choose'
  const component = project.value.components.find((item) => item.id === block.componentId)
  if (!component || component.implementation.kind === 'none') return 'choose'
  if (component.implementation.kind === 'diagram') return 'diagram'
  return 'other'
}

function showOpenAs(blockId: string): void {
  if (!project.value) {
    status.value = 'Open as needs a project. Use New project.'
    return
  }
  const kind = blockOpenKind(blockId)
  if (kind === 'boundary') {
    status.value = 'Boundary stays the interface of this diagram.'
    return
  }
  if (kind !== 'choose') return
  contextMenu.value = null
  selected.value = new Set([blockId])
  openAsBlock.value = blockId
  status.value = 'Choose what this block opens. Cancel leaves the sheet unchanged.'
}

function onBlockContext(blockId: string, event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  if (!project.value) {
    status.value = 'Open as needs a project. Use New project.'
    return
  }
  const kind = blockOpenKind(blockId)
  if (kind === 'boundary' || kind === 'missing') return
  selected.value = new Set([blockId])
  contextMenu.value = { kind: 'block', blockId, x: event.clientX, y: event.clientY }
}

function onStageContextMenu(event: MouseEvent): void {
  // RMB is reserved for menus — never pan/zoom. Stub menu on empty canvas (D5b.5a).
  if (event.button !== 2 && event.type === 'contextmenu') {
    // contextmenu fires after button 2; still prevent browser menu on stage chrome.
  }
  const target = event.target
  if (target instanceof Element && target.closest('.vue-flow__node, .context-menu, .open-as, .props, .palette, button, input, select, textarea')) {
    return
  }
  event.preventDefault()
  contextMenu.value = { kind: 'stage', x: event.clientX, y: event.clientY }
}

function runContextAction(): void {
  const menu = contextMenu.value
  if (!menu || menu.kind !== 'block') return
  const kind = blockOpenKind(menu.blockId)
  contextMenu.value = null
  if (kind === 'diagram' || kind === 'other') {
    openInstance(menu.blockId)
    return
  }
  showOpenAs(menu.blockId)
}

function runStageContextPaste(): void {
  contextMenu.value = null
  paste()
}

function confirmOpenAs(): void {
  const blockId = openAsBlock.value
  const sheetId = doc.value.id
  if (!blockId) return
  openAsBlock.value = null
  applyProject(
    (current) => openAsDiagram(current, sheetId, blockId),
    (value) => {
      interfaceFocus.value = value.componentId
      const current = project.value
      const location = navigation.value
      if (current && location) {
        const move = descend(current, location, blockId)
        if (move.kind === 'ok') showLocation(move.location, true)
      }
      return value.createdDefinition ? 'This block now opens a diagram.' : 'The implementation diagram is open.'
    },
  )
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
    id = placeTemplate(draft, template, activeSnapEnabled(), activeSnapSpacing())
  })
  selected.value = new Set([id])
  refreshHistory()
  status.value = 'Block added.'
}

function onNodeDoubleClick(payload: { node: { id: string } }): void {
  if (!project.value) {
    status.value = 'Open as needs a project. Use New project.'
    return
  }
  const kind = blockOpenKind(payload.node.id)
  if (kind === 'choose') {
    showOpenAs(payload.node.id)
    return
  }
  if (kind === 'diagram' || kind === 'other') openInstance(payload.node.id)
}

function onNodeClick(payload: { node: { id: string }; event: MouseEvent | TouchEvent }): void {
  selectedPort.value = null
  selectedSegment.value = null
  selectedStroke.value = null
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

function onResizeStart(blockId: string, handle: ResizeHandle, event: PointerEvent): void {
  if (tool.value !== 'select' || event.button !== 0 || selected.value.size !== 1) return
  if (edits().isGesturing) cancelActiveDocumentGesture()
  const block = doc.value.blocks.find((item) => item.id === blockId)
  if (!block) return
  selected.value = new Set([blockId])
  resizeDrag = {
    blockId,
    handle,
    origin: { x: block.x, y: block.y, width: block.width, height: block.height },
    cancelled: false,
  }
  resizing.value = true
  beginDocumentGesture()
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeEnd)
  window.addEventListener('pointercancel', onResizeCancel)
}

function stopResizeListeners(): void {
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeEnd)
  window.removeEventListener('pointercancel', onResizeCancel)
}

function onResizeMove(event: PointerEvent): void {
  const current = resizeDrag
  if (!current || current.cancelled || gestureLatch.isClosing) return
  const world = clientToWorld(event)
  edits().preview((draft) => {
    const box = resizeBox(current.origin, current.handle, world, activeSnapEnabled(), activeSnapSpacing())
    setBlockFields(draft, current.blockId, box)
  })
}

function onResizeEnd(): void {
  stopResizeListeners()
  const current = resizeDrag
  if (!current || current.cancelled || gestureLatch.isClosing) {
    resizeDrag = null
    resizing.value = false
    return
  }
  resizeDrag = null
  resizing.value = false
  // Defer commit one frame so window blur / visibilitychange from Alt-Tab can cancel first (E3).
  const lossAtStart = focusLossToken
  const origin = current.origin
  const blockId = current.blockId
  requestAnimationFrame(() => {
    if (gestureLatch.isClosing || lossAtStart !== focusLossToken) {
      if (edits().isGesturing) cancelActiveDocumentGesture('Resize cancelled.')
      return
    }
    if (!document.hasFocus() || document.visibilityState === 'hidden') {
      cancelActiveDocumentGesture('Resize cancelled.')
      return
    }
    if (!edits().isGesturing) return
    const block = doc.value.blocks.find((item) => item.id === blockId)
    const changed = Boolean(
      block &&
        (block.x !== origin.x || block.y !== origin.y || block.width !== origin.width || block.height !== origin.height),
    )
    commitDocumentGesture()
    if (changed) status.value = 'Block resized.'
  })
}

function onResizeCancel(): void {
  // onResizeEnd clears resizeDrag before the deferred commit. The handle then fires
  // lostpointercapture → resizeCancel; ignoring that lets the commit proceed. A real
  // mid-gesture cancel still has resizeDrag set (pointercancel / unexpected capture loss).
  if (!resizeDrag || gestureLatch.isClosing) return
  cancelActiveDocumentGesture('Resize cancelled.')
}

function onDragStart(event: NodeDragEvent): void {
  if (tool.value !== 'select') return
  if (edits().isGesturing) cancelActiveDocumentGesture()
  const id = event.node.id
  const shift = event.event instanceof MouseEvent && event.event.shiftKey
  const mode = blockDragMode(shift)
  // Shift+drag on a block duplicates; do not treat as marquee (marquee starts on empty canvas).
  if (!selected.value.has(id)) selected.value = new Set([id])
  const origin = new Map<string, Point>()
  for (const blockId of selected.value) {
    const block = doc.value.blocks.find((item) => item.id === blockId)
    if (block) origin.set(blockId, { x: block.x, y: block.y })
  }
  const base = origin.get(id)
  if (!base) return
  drag = {
    origin,
    sourceIds: [...origin.keys()],
    baseX: base.x,
    baseY: base.y,
    cancelled: false,
    mode,
    createdIds: [],
    lastDx: 0,
    lastDy: 0,
  }
  beginDocumentGesture()
  if (mode === 'duplicate') status.value = 'Duplicating… release to place, Esc to cancel.'
}

function onDrag(event: NodeDragEvent): void {
  if (!drag || drag.cancelled || gestureLatch.isClosing) return
  const dx = event.node.position.x - drag.baseX
  const dy = event.node.position.y - drag.baseY
  drag.lastDx = dx
  drag.lastDy = dy
  const origin = drag.origin
  if (drag.mode === 'duplicate') {
    const sourceIds = drag.sourceIds
    edits().preview((draft) => {
      // Baseline keeps originals; each preview rebuilds copies under the pointer (D5c.6).
      const map = duplicateBlocks(draft, sourceIds, dx, dy)
      drag!.createdIds = [...map.values()]
    })
    return
  }
  edits().preview((draft) => {
    for (const [blockId, start] of origin) moveBlock(draft, blockId, start.x + dx, start.y + dy)
  })
}

function onDragStop(): void {
  const current = drag
  if (!current || current.cancelled || gestureLatch.isClosing) {
    drag = null
    return
  }
  const mode = current.mode
  const ids = mode === 'duplicate' ? current.createdIds : [...current.origin.keys()]
  const moved = duplicateDragMoved(current.lastDx, current.lastDy)
  drag = null
  if (mode === 'duplicate' && !moved) {
    cancelActiveDocumentGesture()
    status.value = 'Duplicate cancelled (no move).'
    return
  }
  const lossAtStart = focusLossToken
  const createdIds = mode === 'duplicate' ? [...ids] : []
  requestAnimationFrame(() => {
    if (gestureLatch.isClosing || lossAtStart !== focusLossToken) {
      if (edits().isGesturing) cancelActiveDocumentGesture('Gesture cancelled.')
      return
    }
    if (!document.hasFocus() || document.visibilityState === 'hidden') {
      cancelActiveDocumentGesture('Gesture cancelled.')
      return
    }
    if (!edits().isGesturing) return
    const recorded = commitDocumentGesture((draft) => snapBlocks(draft, ids, activeSnapEnabled(), activeSnapSpacing()))
    if (!recorded) return
    if (mode === 'duplicate') {
      selected.value = new Set(createdIds.filter((id) => doc.value.blocks.some((block) => block.id === id)))
      selectedPort.value = null
      selectedSegment.value = null
      status.value = `Duplicated ${createdIds.length} block${createdIds.length === 1 ? '' : 's'}.`
    } else {
      status.value = 'Block moved.'
    }
  })
}

function onNudge(id: string, dx: number, dy: number): void {
  const ids = selected.value.has(id) ? [...selected.value] : [id]
  edits().execute((draft) => {
    for (const blockId of ids) {
      const block = draft.blocks.find((item) => item.id === blockId)
      if (!block) continue
      moveBlock(draft, blockId, snapValue(block.x + dx, activeSnapEnabled(), activeSnapSpacing()), snapValue(block.y + dy, activeSnapEnabled(), activeSnapSpacing()))
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
  if (ids.length === 0) {
    status.value = 'Select a block to duplicate.'
    return
  }
  // Flat blocks and component instances share duplicateBlocks; hierarchy "Place on sheet" is separate.
  const group = doc.value.groups.find((item) => item.blockIds.length === ids.length && item.blockIds.every((id) => selected.value.has(id)))
  let created: string[] = []
  edits().execute((draft) => {
    if (group) {
      const id = duplicateGroup(draft, group.id, DUPLICATE_OFFSET, DUPLICATE_OFFSET)
      created = draft.groups.find((item) => item.id === id)?.blockIds ?? []
    } else {
      created = [...duplicateBlocks(draft, ids, DUPLICATE_OFFSET, DUPLICATE_OFFSET).values()]
    }
  })
  selected.value = new Set(created)
  selectedPort.value = null
  selectedSegment.value = null
  refreshHistory()
  status.value = created.length > 0 ? `Duplicated ${created.length} block${created.length === 1 ? '' : 's'}.` : 'Nothing to duplicate.'
}

function copySelection(): void {
  if (selected.value.size === 0) {
    status.value = 'Select a block to copy.'
    return
  }
  clip = captureFragment(doc.value, [...selected.value])
  clipPasteCount = 0
  status.value = `Copied ${clip.blocks.length} block${clip.blocks.length === 1 ? '' : 's'}.`
}

function paste(): void {
  if (!clip || clip.blocks.length === 0) {
    status.value = 'Clipboard is empty. Copy a block first.'
    return
  }
  clipPasteCount += 1
  const dx = DUPLICATE_OFFSET * clipPasteCount
  const dy = DUPLICATE_OFFSET * clipPasteCount
  let created: string[] = []
  const fragment = clip
  edits().execute((draft) => {
    created = pasteFragment(draft, fragment, dx, dy)
  })
  selected.value = new Set(created)
  selectedPort.value = null
  selectedSegment.value = null
  refreshHistory()
  status.value = created.length > 0 ? `Pasted ${created.length} block${created.length === 1 ? '' : 's'}.` : 'Paste failed.'
}

function focusPortSelection(portId: string): void {
  selected.value = new Set()
  selectedStroke.value = null
  selectedSegment.value = null
  selectedPort.value = portId
}

function focusSegmentSelection(segmentId: string): void {
  selected.value = new Set()
  selectedStroke.value = null
  selectedPort.value = null
  selectedSegment.value = segmentId
}

function removeSelection(): void {
  const ids = [...selected.value]
  const strokeId = selectedStroke.value
  const segmentId = ids.length === 0 ? selectedSegment.value : null
  const portOnly = ids.length === 0 && !strokeId && !segmentId && selectedPort.value
  if (ids.length === 0 && !strokeId && !segmentId && !portOnly) return
  if (portOnly) {
    deleteActivePort()
    return
  }
  let created: string[] = []
  edits().execute((draft) => {
    if (ids.length > 0) deleteBlocks(draft, ids)
    else if (strokeId) removeStroke(draft, strokeId)
    else if (segmentId) created = deleteSegment(draft, segmentId)
  })
  selected.value = new Set()
  selectedStroke.value = null
  selectedSegment.value = null
  selectedPort.value = null
  preview.value = null
  refreshHistory()
  status.value = created.length > 0 ? 'Segment removed. The disconnected piece has a new net id.' : 'Deleted.'
}

function portReach(): number {
  const zoom = viewport.value.zoom > 0 ? viewport.value.zoom : 1
  return 16 / zoom
}

function beginAddPort(): void {
  chooseEditorTool('port')
}

function confirmPort(hit: { blockId: string; side: PortSide; t: number }): void {
  const block = doc.value.blocks.find((item) => item.id === hit.blockId)
  if (!block) return
  const owner = project.value ? componentOwningBlock(project.value, doc.value.id, block) : null
  if (owner) {
    const name = unusedPortName(owner.ports.map((port) => port.name))
    const componentId = owner.id
    const documentId = doc.value.id
    applyProject(
      (current) => addInterfacePort(current, componentId, name, hit.side, { documentId, blockId: block.id, t: hit.t }),
      (value) => {
        const sheet = project.value ? documentById(project.value, documentId) : null
        const created = sheet?.ports.find((port) => port.blockId === block.id && port.interfacePortId === value.interfacePortId)
        selected.value = new Set()
        selectedPort.value = created?.id ?? null
        return `Port ${name} was added to every instance. This block keeps the position you chose.`
      },
    )
    return
  }
  let created = ''
  edits().execute((draft) => {
    created = addPortAt(draft, block.id, hit.side, hit.t) ?? ''
  })
  selected.value = new Set()
  selectedPort.value = created || null
  refreshHistory()
  status.value = 'Port added.'
}

const activePort = computed(() => doc.value.ports.find((port) => port.id === selectedPort.value) ?? null)

const activePortEffectiveDirection = computed((): PortDirection => {
  const port = activePort.value
  return port ? resolvePortDirection(doc.value, port) : 'unspecified'
})

const activePortDirectionHint = computed(() => {
  const port = activePort.value
  if (!port?.direction) return ''
  const pin = symbolPinForPort(doc.value, port)
  if (pin?.direction) return `Instance override (symbol default: ${pin.direction}).`
  return 'Instance override.'
})

function commitPortName(event: Event): void {
  const port = activePort.value
  if (!port) return
  const name = (event.target as HTMLInputElement).value
  const decision = classifyPortDelete(project.value, doc.value, port.id)
  if (decision?.kind === 'logical') {
    const componentId = decision.componentId
    applyProject(
      (current) => renameInterfacePort(current, componentId, decision.interfacePortId, name),
      () => `Port renamed to ${name}. Connections were kept.`,
    )
    return
  }
  let renamed = false
  edits().execute((draft) => {
    renamed = renameInstancePort(draft, port.id, name)
  })
  refreshHistory()
  status.value = renamed ? 'Port renamed.' : 'That name is already used on this block.'
}

function commitPortSide(event: Event): void {
  const port = activePort.value
  if (!port) return
  const side = (event.target as HTMLSelectElement).value as PortSide
  edits().execute((draft) => placePort(draft, port.id, side, port.t ?? 0.5))
  refreshHistory()
  status.value = 'Port moved.'
}

function commitPortT(event: Event): void {
  const port = activePort.value
  if (!port) return
  const t = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(t)) return
  edits().execute((draft) => placePort(draft, port.id, port.side, t))
  refreshHistory()
  status.value = 'Port moved.'
}

function commitDiagramArrowDefault(event: Event): void {
  const value = (event.target as HTMLSelectElement).value as ArrowheadDiagramDefault
  const expected: ArrowheadDiagramDefault = value === 'automatic' ? 'automatic' : 'none'
  let mutated = false
  edits().execute((draft) => {
    mutated = setDiagramArrowheadDefault(draft, value)
  })
  if (!mutated) return
  if (diagramArrowheadDefault(doc.value) === expected) {
    refreshHistory()
    status.value = 'Diagram arrow default updated.'
    return
  }
  status.value = 'The diagram arrow default could not be saved. Use New project or Reload.'
}

function commitSegmentArrowOverride(event: Event): void {
  const segment = selectedWireSegment.value
  if (!segment) return
  const value = (event.target as HTMLSelectElement).value as ArrowheadSegmentOverride
  let changed = false
  edits().execute((draft) => {
    changed = setSegmentArrowheads(draft, segment.id, value === 'inherit' ? null : value)
  })
  if (changed) {
    refreshHistory()
    status.value = 'Segment arrowheads updated.'
  }
}

function resetSegmentArrowOverride(): void {
  const segment = selectedWireSegment.value
  if (!segment) return
  let changed = false
  edits().execute((draft) => {
    changed = resetSegmentArrowheads(draft, segment.id)
  })
  if (changed) {
    refreshHistory()
    status.value = 'Segment uses diagram default.'
  }
}

function commitPortDirection(event: Event): void {
  const port = activePort.value
  if (!port) return
  const choice = (event.target as HTMLSelectElement).value as PortDirection
  let changed = false
  edits().execute((draft) => {
    changed = setPortDirection(draft, port.id, choice)
  })
  if (changed) {
    refreshHistory()
    status.value = 'Port direction updated.'
  }
}

function deleteActivePort(): void {
  const port = activePort.value
  if (!port) return
  const decision = classifyPortDelete(project.value, doc.value, port.id)
  if (!decision) return
  if (decision.kind === 'logical') {
    const componentId = decision.componentId
    applyProject(
      (current) => removeInterfacePort(current, componentId, decision.interfacePortId),
      () => 'Logical port removed.',
    )
    return
  }
  if (decision.kind === 'dangling') {
    if (decision.wired) {
      status.value = 'This port cites a logical port that is not on the component. The port and the wire were kept.'
      return
    }
    edits().execute((draft) => {
      removeUnwiredPort(draft, port.id)
    })
    selectedPort.value = null
    refreshHistory()
    status.value = 'This port cited a logical port that is not on the component. It was removed from this instance.'
    return
  }
  if (decision.kind === 'wired') {
    status.value = 'This port has a wire. The port and the wire were kept.'
    return
  }
  edits().execute((draft) => {
    removeUnwiredPort(draft, port.id)
  })
  selectedPort.value = null
  refreshHistory()
  status.value = 'Port removed.'
}

function stopPortListeners(): void {
  window.removeEventListener('pointermove', onPortMove)
  window.removeEventListener('pointerup', onPortEnd)
  window.removeEventListener('pointercancel', onPortCancel)
}

function guidedPortContext(port: { blockId: string; symbolPortId?: string | null; placed?: boolean; guideU?: number }) {
  if (port.placed) return null
  const block = doc.value.blocks.find((item) => item.id === port.blockId)
  if (!block?.symbolId) return null
  const symbol = doc.value.symbols.find((item) => item.id === block.symbolId)
  if (!symbol) return null
  const pin = port.symbolPortId ? symbol.ports.find((item) => item.id === port.symbolPortId) : undefined
  if (!pin || !isGuidedPin(pin) || !pin.guideId) return null
  const guide = findSymbolGuide(symbol, pin.guideId)
  if (!guide || guide.kind !== 'ellipse') return null
  return { block, symbol, pin, guide }
}

function onPortDown(blockId: string, portId: string, event: PointerEvent): void {
  if (tool.value !== 'select' || event.button !== 0 || resizing.value) return
  if (edits().isGesturing) cancelActiveDocumentGesture()
  const port = doc.value.ports.find((item) => item.id === portId && item.blockId === blockId)
  if (!port) return
  focusPortSelection(portId)
  const guided = guidedPortContext(port)
  const baselineU = guided ? (port.guideU ?? guided.pin.u ?? 0) : undefined
  portDrag = {
    portId,
    side: port.side,
    t: port.t ?? 0.5,
    placed: Boolean(port.placed),
    cancelled: false,
    guided:
      guided && typeof baselineU === 'number'
        ? { lastU: baselineU, guideU: port.guideU }
        : undefined,
  }
  beginDocumentGesture()
  window.addEventListener('pointermove', onPortMove)
  window.addEventListener('pointerup', onPortEnd)
  window.addEventListener('pointercancel', onPortCancel)
  try {
    ;(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId)
  } catch {
    // Window listeners still drive the drag when capture is unavailable.
  }
}

function onPortMove(event: PointerEvent): void {
  const current = portDrag
  if (!current || current.cancelled || gestureLatch.isClosing) return
  const port = doc.value.ports.find((item) => item.id === current.portId)
  const block = port ? doc.value.blocks.find((item) => item.id === port.blockId) : undefined
  if (!block || !port) return
  if (current.guided) {
    const guided = guidedPortContext(port)
    if (!guided) return
    const world = clientToWorld(event)
    const sx = guided.symbol.width > 0 ? guided.block.width / guided.symbol.width : 1
    const sy = guided.symbol.height > 0 ? guided.block.height / guided.symbol.height : 1
    const scaled = scaleEllipseGuide(guided.guide, sx, sy)
    const local = { x: world.x - guided.block.x, y: world.y - guided.block.y }
    // Guide constraint wins over Cartesian grid snapping (A2-P1).
    const projected = projectOntoEllipseGuide(scaled, local)
    const continuous = continuousGuideU(current.guided.lastU, projected)
    current.guided.lastU = continuous
    const u = ((continuous % 1) + 1) % 1
    edits().preview((draft) => placeGuidedPort(draft, current.portId, u))
    return
  }
  const place = borderPlacement(block, clientToWorld(event), activeSnapEnabled(), activeSnapSpacing())
  edits().preview((draft) => placePort(draft, current.portId, place.side, place.t))
}

function onPortEnd(): void {
  stopPortListeners()
  const current = portDrag
  if (!current || current.cancelled || gestureLatch.isClosing) {
    portDrag = null
    return
  }
  portDrag = null
  const lossAtStart = focusLossToken
  const snapshot = { ...current, guided: current.guided ? { ...current.guided } : undefined }
  requestAnimationFrame(() => {
    if (gestureLatch.isClosing || lossAtStart !== focusLossToken) {
      if (edits().isGesturing) cancelActiveDocumentGesture('Port move cancelled.')
      return
    }
    if (!document.hasFocus() || document.visibilityState === 'hidden') {
      cancelActiveDocumentGesture('Port move cancelled.')
      return
    }
    if (!edits().isGesturing) return
    const port = doc.value.ports.find((item) => item.id === snapshot.portId)
    const changed = Boolean(
      port &&
        (snapshot.guided
          ? Math.abs((port.guideU ?? -1) - (snapshot.guided.guideU ?? -1)) > 1e-6 ||
            (typeof port.guideU === 'number') !== (typeof snapshot.guided.guideU === 'number')
          : port.side !== snapshot.side ||
            Math.abs((port.t ?? 0) - snapshot.t) > 1e-6 ||
            Boolean(port.placed) !== snapshot.placed),
    )
    commitDocumentGesture()
    if (changed) status.value = 'Port moved.'
  })
}

function onPortCancel(): void {
  if (!portDrag || gestureLatch.isClosing) return
  cancelActiveDocumentGesture('Port move cancelled.')
}

function stopLabelListeners(): void {
  window.removeEventListener('pointermove', onLabelMove)
  window.removeEventListener('pointerup', onLabelEnd)
  window.removeEventListener('pointercancel', onLabelCancel)
}

/** Hit priority: label above wire `.hit` (D5c.1). */
function onLabelDown(labelId: string, event: PointerEvent): void {
  if (tool.value !== 'select' || event.button !== 0 || spaceHeld.value) return
  event.stopPropagation()
  event.preventDefault()
  const label = doc.value.labels.find((item) => item.id === labelId)
  if (!label || label.anchor.kind !== 'segment') return
  if (edits().isGesturing) cancelActiveDocumentGesture()
  labelDrag = {
    labelId,
    origin: {
      edge: label.anchor.edge,
      distance: label.anchor.distance,
      offset: label.anchor.offset,
      shiftX: label.anchor.shift?.x ?? 0,
      shiftY: label.anchor.shift?.y ?? 0,
    },
    cancelled: false,
  }
  focusSegmentSelection(label.anchor.segmentId)
  beginDocumentGesture()
  // Window listeners only — setPointerCapture on the label would fire lostpointercapture
  // on the world SVG after pointerup and cancel the deferred commit (same class of bug as E3 resize).
  window.addEventListener('pointermove', onLabelMove)
  window.addEventListener('pointerup', onLabelEnd)
  window.addEventListener('pointercancel', onLabelCancel)
}

function onLabelMove(event: PointerEvent): void {
  const current = labelDrag
  if (!current || current.cancelled || gestureLatch.isClosing) return
  const world = clientToWorld(event)
  edits().preview((draft) => {
    placeLabelAt(draft, current.labelId, world)
  })
}

function onLabelEnd(): void {
  stopLabelListeners()
  const current = labelDrag
  if (!current || current.cancelled || gestureLatch.isClosing) {
    labelDrag = null
    return
  }
  labelDrag = null
  const lossAtStart = focusLossToken
  const snapshot = { ...current, origin: { ...current.origin } }
  requestAnimationFrame(() => {
    if (gestureLatch.isClosing || lossAtStart !== focusLossToken) {
      if (edits().isGesturing) cancelActiveDocumentGesture('Label move cancelled.')
      return
    }
    if (!document.hasFocus() || document.visibilityState === 'hidden') {
      cancelActiveDocumentGesture('Label move cancelled.')
      return
    }
    if (!edits().isGesturing) return
    const label = doc.value.labels.find((item) => item.id === snapshot.labelId)
    const changed = Boolean(
      label &&
        label.anchor.kind === 'segment' &&
        (label.anchor.edge !== snapshot.origin.edge ||
          Math.abs(label.anchor.distance - snapshot.origin.distance) > 1e-6 ||
          Math.abs(label.anchor.offset - snapshot.origin.offset) > 1e-6 ||
          Math.abs((label.anchor.shift?.x ?? 0) - snapshot.origin.shiftX) > 1e-6 ||
          Math.abs((label.anchor.shift?.y ?? 0) - snapshot.origin.shiftY) > 1e-6),
    )
    commitDocumentGesture()
    if (changed) status.value = 'Label moved.'
  })
}

function onLabelCancel(): void {
  if (!labelDrag || gestureLatch.isClosing) return
  cancelActiveDocumentGesture('Label move cancelled.')
}

function stopDisplayTextListeners(): void {
  window.removeEventListener('pointermove', onDisplayTextMove)
  window.removeEventListener('pointerup', onDisplayTextEnd)
  window.removeEventListener('pointercancel', onDisplayTextCancel)
}

/**
 * P3a: drag the multiline display-text group. Reuses label-drag history pattern
 * (begin/preview/commit, window listeners, Escape cancel). Offset is centre-relative
 * and not grid-snapped so presentation can be adjusted finely.
 */
function onDisplayTextDown(blockId: string, event: PointerEvent): void {
  if (tool.value !== 'select' || event.button !== 0 || spaceHeld.value) return
  event.stopPropagation()
  event.preventDefault()
  const block = doc.value.blocks.find((item) => item.id === blockId)
  if (!block || !block.displayText || block.showDisplayText === false) return
  if (edits().isGesturing) cancelActiveDocumentGesture()
  displayTextDrag = {
    blockId,
    originX: block.displayTextOffset?.x ?? 0,
    originY: block.displayTextOffset?.y ?? 0,
    startClientX: event.clientX,
    startClientY: event.clientY,
    cancelled: false,
  }
  beginDocumentGesture()
  window.addEventListener('pointermove', onDisplayTextMove)
  window.addEventListener('pointerup', onDisplayTextEnd)
  window.addEventListener('pointercancel', onDisplayTextCancel)
}

function onDisplayTextMove(event: PointerEvent): void {
  const current = displayTextDrag
  if (!current || current.cancelled || gestureLatch.isClosing) return
  const zoom = viewport.value.zoom > 0 ? viewport.value.zoom : 1
  const dx = (event.clientX - current.startClientX) / zoom
  const dy = (event.clientY - current.startClientY) / zoom
  // Integer diagram units, no GRID snap — fine presentation placement (P3a).
  const next = { x: Math.round(current.originX + dx), y: Math.round(current.originY + dy) }
  edits().preview((draft) => {
    setDisplayTextOffset(draft, current.blockId, next)
  })
}

function onDisplayTextEnd(): void {
  stopDisplayTextListeners()
  const current = displayTextDrag
  if (!current || current.cancelled || gestureLatch.isClosing) {
    displayTextDrag = null
    return
  }
  displayTextDrag = null
  const lossAtStart = focusLossToken
  const snapshot = { ...current }
  requestAnimationFrame(() => {
    if (gestureLatch.isClosing || lossAtStart !== focusLossToken) {
      if (edits().isGesturing) cancelActiveDocumentGesture('Display text move cancelled.')
      return
    }
    if (!document.hasFocus() || document.visibilityState === 'hidden') {
      cancelActiveDocumentGesture('Display text move cancelled.')
      return
    }
    if (!edits().isGesturing) return
    const block = doc.value.blocks.find((item) => item.id === snapshot.blockId)
    const ox = block?.displayTextOffset?.x ?? 0
    const oy = block?.displayTextOffset?.y ?? 0
    const changed = Math.abs(ox - snapshot.originX) > 1e-6 || Math.abs(oy - snapshot.originY) > 1e-6
    commitDocumentGesture()
    if (changed) status.value = 'Display text moved.'
  })
}

function onDisplayTextCancel(): void {
  if (!displayTextDrag || gestureLatch.isClosing) return
  cancelActiveDocumentGesture('Display text move cancelled.')
}

function commitDisplayTextOffsetAxis(axis: 'x' | 'y', event: Event): void {
  const block = oneBlock.value
  if (!block) return
  const input = event.target as HTMLInputElement
  const parsed = Number(input.value)
  if (!Number.isFinite(parsed)) return
  const currentX = block.displayTextOffset?.x ?? 0
  const currentY = block.displayTextOffset?.y ?? 0
  const next = axis === 'x' ? { x: parsed, y: currentY } : { x: currentX, y: parsed }
  if (Math.abs(next.x - currentX) < 1e-9 && Math.abs(next.y - currentY) < 1e-9) return
  edits().execute((draft) => setDisplayTextOffset(draft, block.id, next))
  refreshHistory()
  input.blur()
  status.value = 'Display text position updated.'
}

function resetDisplayTextPosition(): void {
  const block = oneBlock.value
  if (!block?.displayTextOffset) return
  edits().execute((draft) => setDisplayTextOffset(draft, block.id, null))
  refreshHistory()
  status.value = 'Display text centred.'
}

function commitName(event: Event): void {
  const block = oneBlock.value
  if (!block) return
  const name = (event.target as HTMLInputElement).value
  edits().execute((draft) => setBlockFields(draft, block.id, { name }))
  refreshHistory()
  status.value = 'Block updated.'
}

function commitBlockVisibility(field: 'showName' | 'showPortNames' | 'showDisplayText', event: Event): void {
  const block = oneBlock.value
  if (!block) return
  const input = event.target as HTMLInputElement
  const visible = input.checked
  const currently = block[field] !== false
  if (currently === visible) return
  edits().execute((draft) => setBlockFields(draft, block.id, { [field]: visible }))
  refreshHistory()
  // Leave the checkbox so Ctrl+Z reaches document history (P1-Fix).
  input.blur()
  status.value = 'Block presentation updated.'
}

function commitDisplayText(event: Event): void {
  const block = oneBlock.value
  if (!block) return
  const next = (event.target as HTMLTextAreaElement).value
  const current = block.displayText ?? ''
  if (next === current) return
  edits().execute((draft) => setBlockFields(draft, block.id, { displayText: next }))
  refreshHistory()
  status.value = next.length > 0 ? 'Display text updated.' : 'Display text cleared.'
}

function commitLabelTypographyAlign(event: Event): void {
  const label = selectedNameLabel.value
  if (!label || !selectedLabelUsesCustomDisplay.value) return
  const select = event.target as HTMLSelectElement
  const value = select.value as TextAlign
  let changed = false
  edits().execute((draft) => {
    changed = setLabelTypography(draft, label.id, { textAlign: value })
  })
  if (changed) {
    refreshHistory()
    status.value = 'Label typography updated.'
  }
}

function commitLabelTypographySize(event: Event): void {
  const label = selectedNameLabel.value
  if (!label || !selectedLabelUsesCustomDisplay.value) return
  const input = event.target as HTMLInputElement
  const parsed = Number(input.value)
  if (!Number.isFinite(parsed)) return
  let changed = false
  edits().execute((draft) => {
    changed = setLabelTypography(draft, label.id, { fontSize: parsed })
  })
  if (changed) {
    refreshHistory()
    status.value = 'Label font size updated.'
  }
}

function resetLabelTypographyAction(): void {
  const label = selectedNameLabel.value
  if (!label || !selectedLabelUsesCustomDisplay.value) return
  let changed = false
  edits().execute((draft) => {
    changed = resetLabelTypography(draft, label.id)
  })
  if (changed) {
    refreshHistory()
    status.value = 'Label typography reset.'
  }
}

function commitBlockTypographyAlign(event: Event): void {
  const block = oneBlock.value
  if (!block || !block.displayText?.trim()) return
  const select = event.target as HTMLSelectElement
  const value = select.value as TextAlign
  let changed = false
  edits().execute((draft) => {
    changed = setBlockTypography(draft, block.id, { textAlign: value })
  })
  if (changed) {
    refreshHistory()
    status.value = 'Block typography updated.'
  }
}

function commitBlockTypographySize(event: Event): void {
  const block = oneBlock.value
  if (!block || !block.displayText?.trim()) return
  const input = event.target as HTMLInputElement
  const parsed = Number(input.value)
  if (!Number.isFinite(parsed)) return
  let changed = false
  edits().execute((draft) => {
    changed = setBlockTypography(draft, block.id, { fontSize: parsed })
  })
  if (changed) {
    refreshHistory()
    status.value = 'Block font size updated.'
  }
}

function resetBlockTypographyAction(): void {
  const block = oneBlock.value
  if (!block || !block.displayText?.trim()) return
  let changed = false
  edits().execute((draft) => {
    changed = resetBlockTypography(draft, block.id)
  })
  if (changed) {
    refreshHistory()
    status.value = 'Block typography reset.'
  }
}

function commitBlockTextFormat(event: Event): void {
  const block = oneBlock.value
  if (!block) return
  const value = (event.target as HTMLSelectElement).value
  const format = value === 'latex' ? 'latex' : value === 'markdown' ? 'markdown' : 'plain'
  if (blockTextFormat(block) === format) return
  edits().execute((draft) => setBlockTextFormat(draft, block.id, format))
  refreshHistory()
  status.value =
    format === 'latex' ? 'Display format: LaTeX.' : format === 'markdown' ? 'Display format: Markdown.' : 'Display format: Plain Text.'
}

const FILL_PRESETS = ['#cfe8ff', '#d8f0d8', '#fff4cc', '#f0d4d4'] as const

function blockFillPickerValue(block: { style?: { fill?: string; fillTransparent?: boolean } }): string {
  if (block.style?.fillTransparent) return '#ffffff'
  return block.style?.fill ?? '#ffffff'
}

function blockStrokePickerValue(block: { style?: { stroke?: string } }): string {
  return block.style?.stroke ?? '#243140'
}

function blockTextPickerValue(block: { style?: { text?: string } }): string {
  return block.style?.text ?? '#1c2430'
}

function commitBlockFill(event: Event): void {
  const block = oneBlock.value
  if (!block) return
  const input = event.target as HTMLInputElement
  const colour = input.value
  const current = block.style?.fillTransparent ? '' : (block.style?.fill ?? '')
  if (colour.toLowerCase() === current.toLowerCase() && !block.style?.fillTransparent) return
  edits().execute((draft) => setBlockStyle(draft, block.id, { fill: colour, fillTransparent: false }))
  refreshHistory()
  input.blur()
  status.value = 'Fill colour updated.'
}

function commitBlockFillTransparent(event: Event): void {
  const block = oneBlock.value
  if (!block) return
  const input = event.target as HTMLInputElement
  const transparent = input.checked
  const currently = block.style?.fillTransparent === true
  if (currently === transparent) return
  edits().execute((draft) => setBlockStyle(draft, block.id, { fillTransparent: transparent }))
  refreshHistory()
  input.blur()
  status.value = transparent ? 'Fill set to transparent.' : 'Transparent fill cleared.'
}

function applyFillPreset(colour: string): void {
  const block = oneBlock.value
  if (!block) return
  if (block.style?.fill?.toLowerCase() === colour.toLowerCase() && !block.style.fillTransparent) return
  edits().execute((draft) => setBlockStyle(draft, block.id, { fill: colour, fillTransparent: false }))
  refreshHistory()
  status.value = 'Fill colour updated.'
}

function commitBlockStroke(event: Event): void {
  const block = oneBlock.value
  if (!block) return
  const input = event.target as HTMLInputElement
  const colour = input.value
  if ((block.style?.stroke ?? '#243140').toLowerCase() === colour.toLowerCase()) return
  edits().execute((draft) => setBlockStyle(draft, block.id, { stroke: colour }))
  refreshHistory()
  input.blur()
  status.value = 'Border colour updated.'
}

function commitBlockTextColour(event: Event): void {
  const block = oneBlock.value
  if (!block) return
  const input = event.target as HTMLInputElement
  const colour = input.value
  if ((block.style?.text ?? '#1c2430').toLowerCase() === colour.toLowerCase()) return
  edits().execute((draft) => setBlockStyle(draft, block.id, { text: colour }))
  refreshHistory()
  input.blur()
  status.value = 'Text colour updated.'
}

function resetBlockAppearance(): void {
  const block = oneBlock.value
  if (!block || !block.style) return
  edits().execute((draft) => resetBlockStyle(draft, block.id))
  refreshHistory()
  status.value = 'Appearance reset.'
}

function commitSegmentLabelsVisible(event: Event): void {
  const segmentId = selectedSegment.value
  if (!segmentId) return
  const input = event.target as HTMLInputElement
  const visible = input.checked
  const labels = nameLabelsForSegment(segmentId)
  if (labels.length === 0) return
  const currently = labels.some((label) => label.visible !== false)
  if (currently === visible) return
  edits().execute((draft) => {
    setSegmentLabelsVisible(draft, segmentId, visible)
  })
  refreshHistory()
  input.blur()
  status.value = visible ? 'Wire label shown.' : 'Wire label hidden.'
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

/**
 * Wire hit strokes (12px) sit above Vue Flow nodes and cover port marks at endpoints (C3).
 * Prefer starting a port drag when the pointer is near a port.
 */
function portNearWorld(point: Point, reach = 14): { blockId: string; portId: string } | null {
  let best: { blockId: string; portId: string; dist: number } | null = null
  for (const port of doc.value.ports) {
    const at = portAnchor(doc.value, port.id)
    if (!at) continue
    const dist = Math.hypot(at.x - point.x, at.y - point.y)
    if (dist <= reach && (!best || dist < best.dist)) best = { blockId: port.blockId, portId: port.id, dist }
  }
  return best ? { blockId: best.blockId, portId: best.portId } : null
}

function onStagePointerDown(event: PointerEvent): void {
  if (!allowMarquee(tool.value, spaceHeld.value, event.button) || marquee.value) return
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('.vue-flow__node, .bend, .bend-hit, .free-end, .free-end-hit, .ink, .hit, .junction, .label-group, .label-hit, .props, button, input')) return
  const start = clientToWorld(event)
  marquee.value = { x: start.x, y: start.y, width: 0, height: 0, shift: event.shiftKey }
}

function onStageAuxMouseDown(event: MouseEvent): void {
  // Prevent the browser auto-scroll / paste affordance on middle click so Vue Flow can pan.
  if (event.button === 1) event.preventDefault()
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
    if (!box.shift) {
      selected.value = new Set()
      selectedPort.value = null
      selectedSegment.value = null
      selectedStroke.value = null
    }
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
  if (hits.length > 0 || !box.shift) {
    selectedPort.value = null
    selectedSegment.value = null
    selectedStroke.value = null
  }
}

function clearWireDraft(): void {
  wireDraft.value = null
  wireFreePress = null
}

function acceptWire(commit: { points: Point[]; start: Parameters<typeof commitWire>[2]; end: Parameters<typeof commitWire>[3] }): void {
  const probe = probeWire(doc.value, commit.start, commit.end)
  if (!probe.ok) {
    clearWireDraft()
    status.value = probe.reason
    return
  }
  let createdNet = probe.createdNet
  let netId = probe.netId
  let createdSegmentId = ''
  edits().execute((draft) => {
    const result = commitWire(draft, commit.points, commit.start, commit.end)
    if (result.ok) {
      createdNet = result.createdNet
      netId = result.netId
      createdSegmentId = result.segmentId
    }
  })
  clearWireDraft()
  refreshHistory()
  if (createdSegmentId) focusSegmentSelection(createdSegmentId)
  const netName = doc.value.nets.find((item) => item.id === netId)?.name
  status.value = createdNet
    ? `New net${netName ? ` "${netName}"` : ''}.`
    : `Wire on net${netName ? ` "${netName}"` : ''}.`
}

/** Finish an open stub on free space (S5a). Prefer this over PointerEvent.detail. */
function finishWireStubAt(world: Point): void {
  const draft = wireDraft.value
  if (!draft) return
  // P4a: free tip snaps; connectivity hits never reach this path.
  acceptWire(finishFree(draft, gridSnapPoint(world), { fromBeforeLastFreeBend: true }))
}

/** S5a.1: pop one drawing step, or cancel when only the start anchor remains. */
function applyWireStepUndo(): void {
  const draft = wireDraft.value
  if (!draft) return
  wireFreePress = null
  const step = undoWireStep(draft)
  if (step.cancelled || !step.draft) {
    clearWireDraft()
    status.value = 'Wire cancelled.'
    return
  }
  wireDraft.value = step.draft
  status.value = step.message
}

function cancelWireDraftEntirely(): void {
  clearWireDraft()
  status.value = 'Wire cancelled.'
}

/** Native dblclick backup — fires after the second click when pointerdown timing missed. */
function onWorldDblClick(event: MouseEvent): void {
  if (tool.value !== 'wire' || !wireDraft.value || event.button !== 0) return
  event.preventDefault()
  const world = clientPointToWorld(event.clientX, event.clientY)
  const hit = snapTarget(doc.value, world)
  if (hit.kind !== 'free') return
  finishWireStubAt(world)
}

function onPointerDown(event: PointerEvent): void {
  lastPointerClient = { x: event.clientX, y: event.clientY }
  // Viewport pan must not commit/cancel an open wire draft (D5b.5b).
  if (shouldBeginViewPan(event.button, spaceHeld.value)) {
    beginViewPan(event)
    return
  }
  if (event.button !== 0) return
  if (tool.value === 'port') {
    const hit = nearestBlockBorder(doc.value.blocks, clientToWorld(event), activeSnapEnabled(), portReach(), activeSnapSpacing())
    portPreview.value = hit
    if (!hit) {
      status.value = 'Choose a point on a block edge.'
      return
    }
    confirmPort(hit)
    return
  }
  if (tool.value === 'wire') {
    const world = clientToWorld(event)
    // Connectivity hit-test first; grid snap only free points (P4a).
    const hit = snapFreeHit(snapTarget(doc.value, world))
    // D5c.5 / S5a: double-press on free space finishes an open stub (Port→free).
    // PointerEvent.detail is always 0 on pointerdown — use client-space timing instead.
    if (wireDraft.value && hit.kind === 'free') {
      const stamp = { t: performance.now(), x: event.clientX, y: event.clientY }
      const doubled = isDoublePress(wireFreePress, stamp) || event.detail >= 2
      wireFreePress = stamp
      if (doubled) {
        finishWireStubAt(hit.point)
        return
      }
    } else {
      wireFreePress = null
    }
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
  lastPointerClient = { x: event.clientX, y: event.clientY }
  if (moveViewPan(event)) return
  const point = clientToWorld(event)
  if (tool.value === 'port') {
    portPreview.value = nearestBlockBorder(doc.value.blocks, point, activeSnapEnabled(), portReach(), activeSnapSpacing())
    return
  }
  if (tool.value === 'wire') wireHover.value = wireHoverFromWorld(point)
  if (drawing.value) {
    drawing.value = [...drawing.value, { ...point, pressure: event.pressure || 0.5 }]
    return
  }
  if (gestureLatch.isClosing) return
  if (junctionDrag) {
    const dragState = junctionDrag
    // P4a: snap during preview so release does not jump.
    const x = snapValue(dragState.originX + point.x - dragState.pointer.x, activeSnapEnabled(), activeSnapSpacing())
    const y = snapValue(dragState.originY + point.y - dragState.pointer.y, activeSnapEnabled(), activeSnapSpacing())
    edits().preview((draft) => moveJunction(draft, dragState.id, x, y))
    return
  }
  if (freeEndDrag) {
    const dragState = freeEndDrag
    const at = {
      x: snapValue(point.x, activeSnapEnabled(), activeSnapSpacing()),
      y: snapValue(point.y, activeSnapEnabled(), activeSnapSpacing()),
    }
    edits().preview((draft) => placeFreeEnd(draft, dragState.segmentId, dragState.which, at))
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
  // P4a/P4b: preview-snap bend axis; commit keeps preview geometry.
  if (dragState.axis === 'x') {
    const coord = snapValue(dragState.originX + dx, activeSnapEnabled(), activeSnapSpacing())
    edits().preview((draft) => placeSpan(draft, dragState.segmentId, dragState.xEdge, coord))
  } else {
    const coord = snapValue(dragState.originY + dy, activeSnapEnabled(), activeSnapSpacing())
    edits().preview((draft) => placeSpan(draft, dragState.segmentId, dragState.yEdge, coord))
  }
}

function onPointerUp(event: PointerEvent): void {
  if (endViewPan(event)) return
  if (drawing.value) {
    const points = drawing.value
    drawing.value = null
    let strokeId: string | null = null
    edits().execute((draft) => {
      strokeId = addStroke(draft, points)?.id ?? null
    })
    selected.value = new Set()
    selectedPort.value = null
    selectedSegment.value = null
    selectedStroke.value = strokeId
    preview.value = null
    refreshHistory()
    status.value = strokeId ? 'Stroke stored. Convert does not create a net until you confirm.' : 'Stroke ignored.'
    return
  }
  if (junctionDrag) {
    if (gestureLatch.isClosing) {
      junctionDrag = null
      return
    }
    junctionDrag = null
    commitDocumentGesture()
    status.value = 'Junction moved.'
    return
  }
  if (freeEndDrag) {
    if (gestureLatch.isClosing) {
      freeEndDrag = null
      return
    }
    const dragState = freeEndDrag
    freeEndDrag = null
    commitDocumentGesture((draft) => {
      if (!activeSnapEnabled()) return
      const spacing = activeSnapSpacing()
      const segment = draft.segments.find((item) => item.id === dragState.segmentId)
      if (!segment) return
      const tip =
        dragState.which === 'end'
          ? segment.points[segment.points.length - 1]
          : segment.points[0]
      if (!tip) return
      placeFreeEnd(draft, dragState.segmentId, dragState.which, {
        x: snapValue(tip.x, true, spacing),
        y: snapValue(tip.y, true, spacing),
      })
    })
    status.value = 'Free end moved.'
    return
  }
  if (spanDrag) {
    if (gestureLatch.isClosing) {
      spanDrag = null
      return
    }
    const dragState = spanDrag
    spanDrag = null
    commitDocumentGesture((draft) => {
      if (!activeSnapEnabled()) return
      const spacing = activeSnapSpacing()
      const segment = draft.segments.find((item) => item.id === dragState.segmentId)
      const point = segment?.points[dragState.edge]
      if (!point) return
      const coord = dragState.horizontal ? snapValue(point.y, true, spacing) : snapValue(point.x, true, spacing)
      placeSpan(draft, dragState.segmentId, dragState.edge, coord)
    })
    status.value = 'Segment moved.'
    return
  }
  if (!bendDrag) return
  if (gestureLatch.isClosing) {
    bendDrag = null
    return
  }
  bendDrag = null
  commitDocumentGesture()
  status.value = 'Bend moved.'
}

function onPointerCancel(event: PointerEvent): void {
  if (endViewPan(event)) return
  if (drawing.value) {
    drawing.value = null
    status.value = 'Stroke cancelled.'
    return
  }
  if (bendDrag || spanDrag || freeEndDrag || junctionDrag || edits().isGesturing) {
    cancelActiveDocumentGesture('Gesture cancelled.')
  }
}

function onLostPointerCapture(): void {
  // View-pan capture end must not cancel an open wire draft.
  if (viewPan) {
    viewPan = null
    return
  }
  // Expected after a normal commit that released capture — latch ignores duplicates.
  // Do not cancel on isGesturing alone: deferred commit clears UI drag state first (label/resize/port).
  if (gestureLatch.isClosing) return
  if (bendDrag || spanDrag || freeEndDrag || junctionDrag || resizeDrag || portDrag || labelDrag || displayTextDrag) {
    cancelActiveDocumentGesture('Gesture cancelled.')
  }
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
  focusSegmentSelection(segmentId)
  if (edits().isGesturing) cancelActiveDocumentGesture()
  beginDocumentGesture()
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
  // D5b.4a C3: wire hit overlay steals pointerdown from wired ports — hand off to port drag.
  const nearPort = portNearWorld(world, Math.max(12, 16 / Math.max(viewport.value.zoom, 0.25)))
  if (nearPort) {
    onPortDown(nearPort.blockId, nearPort.portId, event)
    return
  }
  const hit = snapTarget(doc.value, world)
  // S5b: free-end hit must not fall through to span edge 0 (port dogleg / jump).
  if (hit.kind === 'end' && hit.segmentId === segmentId) {
    startFreeEnd(segmentId, hit.which, event)
    return
  }
  const freeWhich = freeEndNear(segment, world, Math.max(10, 14 / Math.max(viewport.value.zoom, 0.25)))
  if (freeWhich) {
    startFreeEnd(segmentId, freeWhich, event)
    return
  }
  const edge = hit.kind === 'segment' && hit.segmentId === segmentId ? hit.edge : 0
  const from = segment.points[edge]
  const to = segment.points[edge + 1]
  if (!from || !to) return
  const horizontal = Math.abs(from.y - to.y) <= Math.abs(from.x - to.x)
  focusSegmentSelection(segmentId)
  selectedEdge.value = edge
  spanDrag = { segmentId, edge, horizontal, origin: horizontal ? from.y : from.x, pointer: world }
  if (edits().isGesturing) cancelActiveDocumentGesture()
  beginDocumentGesture()
  ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
}

function freeEndNear(segment: { start: { kind: string; x?: number; y?: number }; end: { kind: string; x?: number; y?: number } }, world: Point, reach: number): 'start' | 'end' | null {
  let best: { which: 'start' | 'end'; dist: number } | null = null
  if (segment.start.kind === 'free' && typeof segment.start.x === 'number' && typeof segment.start.y === 'number') {
    const dist = Math.hypot(segment.start.x - world.x, segment.start.y - world.y)
    if (dist <= reach) best = { which: 'start', dist }
  }
  if (segment.end.kind === 'free' && typeof segment.end.x === 'number' && typeof segment.end.y === 'number') {
    const dist = Math.hypot(segment.end.x - world.x, segment.end.y - world.y)
    if (dist <= reach && (!best || dist < best.dist)) best = { which: 'end', dist }
  }
  return best?.which ?? null
}

function startFreeEnd(segmentId: string, which: 'start' | 'end', event: PointerEvent): void {
  event.stopPropagation()
  focusSegmentSelection(segmentId)
  freeEndDrag = { segmentId, which }
  if (edits().isGesturing) cancelActiveDocumentGesture()
  beginDocumentGesture()
  const at = {
    x: snapValue(clientToWorld(event).x, activeSnapEnabled(), activeSnapSpacing()),
    y: snapValue(clientToWorld(event).y, activeSnapEnabled(), activeSnapSpacing()),
  }
  edits().preview((draft) => placeFreeEnd(draft, segmentId, which, at))
  ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
}

function onJunctionDown(junctionId: string, event: PointerEvent): void {
  event.stopPropagation()
  const junction = doc.value.junctions.find((item) => item.id === junctionId)
  if (!junction) return
  junctionDrag = { id: junctionId, originX: junction.x, originY: junction.y, pointer: clientToWorld(event) }
  if (edits().isGesturing) cancelActiveDocumentGesture()
  beginDocumentGesture()
  ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
}

function commitNetName(event: Event): void {
  const net = selectedNet.value
  if (!net) return
  const input = event.target as HTMLInputElement
  const candidate = input.value.trim()
  if (!candidate) {
    input.value = net.name
    status.value = 'Wire name cannot be empty.'
    return
  }
  if (candidate === net.name) {
    input.value = net.name
    return
  }
  let renamed = ''
  let joined = false
  let keptId = net.id
  let refused = ''
  edits().execute((draft) => {
    const outcome = renameNet(draft, net.id, candidate)
    if (!outcome.ok) {
      refused = outcome.reason
      return
    }
    renamed = outcome.name
    joined = outcome.joined
    keptId = outcome.netId
  })
  refreshHistory()
  if (refused || !renamed) {
    input.value = selectedNet.value?.name ?? net.name
    status.value = refused || 'Rename failed.'
    return
  }
  if (joined) {
    const still = doc.value.segments.find((segment) => segment.netId === keptId)
    selectedSegment.value = still?.id ?? selectedSegment.value
    status.value = `Joined into "${renamed}" (one net).`
  } else {
    status.value = `Wire renamed to "${renamed}".`
  }
}

function mergeSelectedByName(): void {
  const net = selectedNet.value
  if (!net) return
  let keptId = net.id
  let merged = 0
  edits().execute((draft) => {
    const outcome = mergeNetsByName(draft, net.name)
    if (!outcome.ok) {
      status.value = outcome.reason
      return
    }
    keptId = outcome.keptId
    merged = outcome.merged
  })
  refreshHistory()
  if (merged === 0) {
    status.value = 'No other nets share this name.'
    return
  }
  const still = doc.value.segments.find((segment) => segment.netId === keptId)
  selectedSegment.value = still?.id ?? null
  status.value = `Merged ${merged + 1} nets named "${net.name}" into one.`
}

function addLabel(): void {
  const segmentId = selectedSegment.value
  if (!segmentId) return
  if (nameLabelsForSegment(segmentId).length > 0) {
    status.value = 'This segment already has a name label.'
    return
  }
  edits().execute((draft) => addNameLabel(draft, segmentId, selectedEdge.value, 16, 14))
  refreshHistory()
  status.value = 'Name label added.'
}

/** P5b: delete the visual name-label instance(s) on the selected segment. Net unchanged. */
function removeSelectedNameLabel(): void {
  const segmentId = selectedSegment.value
  if (!segmentId) return
  if (nameLabelsForSegment(segmentId).length === 0) return
  let removed = false
  edits().execute((draft) => {
    removed = removeSegmentNameLabels(draft, segmentId)
  })
  refreshHistory()
  status.value = removed ? 'Name label removed.' : 'No name label to remove.'
}

/** P5a: clear free shift; restore default normal offset on the current attachment. */
function resetSelectedLabelPosition(): void {
  const segmentId = selectedSegment.value
  if (!segmentId) return
  const labels = nameLabelsForSegment(segmentId)
  if (labels.length === 0) return
  let changed = false
  edits().execute((draft) => {
    for (const label of labels) {
      if (resetLabelPosition(draft, label.id)) changed = true
    }
  })
  refreshHistory()
  status.value = changed ? 'Label position reset.' : 'Label already at default position.'
}

/** A2-P2: inherit net name vs custom display text (one history entry on change). */
function commitLabelDisplayMode(event: Event): void {
  const label = selectedNameLabel.value
  if (!label) return
  const mode = (event.target as HTMLSelectElement).value
  if (mode === 'net') {
    let changed = false
    edits().execute((draft) => {
      changed = setLabelDisplayText(draft, label.id, null)
    })
    refreshHistory()
    if (changed) status.value = 'Label shows the net name.'
    return
  }
  if (mode === 'custom' && !selectedLabelUsesCustomDisplay.value) {
    const seed = selectedNet.value?.name ?? 'label'
    edits().execute((draft) => {
      setLabelDisplayText(draft, label.id, seed)
    })
    refreshHistory()
    status.value = 'Custom display label.'
  }
}

function commitLabelTextFormat(event: Event): void {
  const label = selectedNameLabel.value
  if (!label || !selectedLabelUsesCustomDisplay.value) return
  const value = (event.target as HTMLSelectElement).value
  const format: LabelTextFormat = value === 'latex' ? 'latex' : value === 'markdown' ? 'markdown' : 'plain'
  let changed = false
  edits().execute((draft) => {
    changed = setLabelTextFormat(draft, label.id, format)
  })
  refreshHistory()
  if (changed) {
    status.value =
      format === 'latex' ? 'Display format: LaTeX.' : format === 'markdown' ? 'Display format: Markdown.' : 'Display format: Plain Text.'
  }
}

function commitLabelDisplayText(event: Event): void {
  const label = selectedNameLabel.value
  if (!label) return
  const input = event.target as HTMLInputElement
  const next = input.value
  let changed = false
  edits().execute((draft) => {
    changed = setLabelDisplayText(draft, label.id, next)
  })
  refreshHistory()
  if (!changed) {
    input.value = selectedLabelDisplayText.value
    return
  }
  status.value = selectedLabelUsesCustomDisplay.value ? 'Display label updated.' : 'Label shows the net name.'
}

function labelHitRadius(label: { fontSize: number | null; math: MathRenderResult | null }): number {
  const base = label.fontSize ? Math.max(8, label.fontSize) : 12
  const math = label.math
  if (!math || !math.ok) return base
  return Math.max(base, Math.min(48, Math.max(math.width, math.height) * 0.5))
}

const selectedSegmentHasLabelShift = computed(() => {
  const segmentId = selectedSegment.value
  if (!segmentId) return false
  return nameLabelsForSegment(segmentId).some((label) => {
    if (label.anchor.kind !== 'segment') return false
    if (label.anchor.shift) return true
    return label.anchor.offset !== 14
  })
})

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
  selected.value = new Set()
  selectedPort.value = null
  selectedSegment.value = null
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
  if (edits().isGesturing || resizeDrag || portDrag || drag || bendDrag || spanDrag || freeEndDrag || junctionDrag || labelDrag || displayTextDrag) {
    // First Undo during a gesture only cancels — no history step.
    cancelActiveDocumentGesture('Gesture cancelled.')
    preview.value = null
    return
  }
  releaseGesture()
  edits().undo()
  preview.value = null
  extractPlan.value = null
  expandPlan.value = null
  closeOpenAs()
  stabilizePath()
  refreshHistory()
  status.value = 'Undone.'
}

function redo(): void {
  symbolEditor.value?.abandonGesture()
  if (edits().isGesturing || resizeDrag || portDrag || drag || bendDrag || spanDrag || freeEndDrag || junctionDrag || labelDrag || displayTextDrag) {
    // D5b.4: redo refuses while gesturing; history and gesture stay as they are.
    void actionForRedoWhileGesturing()
    status.value = 'Finish or cancel the drag before redo.'
    return
  }
  releaseGesture()
  edits().redo()
  preview.value = null
  extractPlan.value = null
  expandPlan.value = null
  closeOpenAs()
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
  // D5b.4: cancel any open gesture so a preview is never marked saved.
  if (edits().isGesturing || resizeDrag || portDrag || drag || bendDrag || spanDrag || freeEndDrag || junctionDrag || labelDrag || displayTextDrag) {
    cancelActiveDocumentGesture()
  }
  const current = project.value
  if (current && transactions) {
    const snapshot = serializeProject(current)
    const savedProject = parseProject(snapshot)
    await projectStorage.save(savedProject)
    download(`${savedProject.id}.json`, snapshot)
    const live = project.value
    if (live && serializeProject(live) === snapshot) {
      transactions.markSaved()
      status.value = `Saved project ${savedProject.name}.`
    } else {
      status.value = `Saved project ${savedProject.name}. Later edits are still unsaved.`
    }
    refreshHistory()
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
      bindTransactions(next)
      extractPlan.value = null
      expandPlan.value = null
      showLocation(resolveLocation(next, steps).location, false, false)
      const resolved = resolveLocation(project.value ?? next, navigation.value?.steps ?? [])
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
      bindTransactions(nextProject)
      navPast.length = 0
      navFuture.length = 0
      viewMemory.clear()
      expanded.value = []
      extractPlan.value = null
      expandPlan.value = null
      closeOpenAs()
      navigation.value = rootLocation(nextProject)
      editingSymbol.value = null
      resetInteractionMode()
      rebindAfterProject()
      refreshHistory()
      const bounds = contentBounds(doc.value)
      frame.value = { mode: 'fit', x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, zoom: 1, token: (frame.value?.token ?? 0) + 1 }
      syncNav()
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

/** Text fields only — checkboxes must not block document Undo (P1-Fix). */
function typingTarget(target: EventTarget | null): boolean {
  return isTextEditingTarget(target)
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    // Overlays / symbol polygon draft consume Esc before the Select stack (D5c.2).
    if (preferencesOpen.value) {
      preferencesOpen.value = false
      return
    }
    if (openAsBlock.value || contextMenu.value) {
      dismissOpenAs()
      return
    }
    if (symbolEditor.value?.cancelDraft()) {
      status.value = 'Polygon cancelled.'
      return
    }
    // S5a.1: wire draft owns Esc / Shift+Esc before the general cancel stack.
    const wireEsc = wireDrawingShortcut('Escape', Boolean(wireDraft.value), { shift: event.shiftKey })
    if (wireEsc === 'cancel-all') {
      cancelWireDraftEntirely()
      return
    }
    if (wireEsc === 'undo-step') {
      applyWireStepUndo()
      return
    }
    const hasTransient = Boolean(
      mergeFrom.value ||
        edits().isGesturing ||
        resizeDrag ||
        portDrag ||
        drag ||
        bendDrag ||
        spanDrag ||
        freeEndDrag ||
        junctionDrag ||
        labelDrag ||
        displayTextDrag,
    )
    const hasSelection =
      selected.value.size > 0 ||
      Boolean(selectedPort.value) ||
      Boolean(selectedSegment.value) ||
      Boolean(selectedStroke.value)
    const escape = nextEscapeAction(tool.value, hasTransient, hasSelection)
    if (escape === 'cancel') {
      if (mergeFrom.value) {
        mergeFrom.value = null
        status.value = 'Merge cancelled.'
        return
      }
      const wasResize = resizeDrag !== null
      const wasPort = portDrag !== null
      const wasLabel = labelDrag !== null
      const wasDisplayText = displayTextDrag !== null
      cancelActiveDocumentGesture(
        wasDisplayText
          ? 'Display text move cancelled.'
          : wasLabel
            ? 'Label move cancelled.'
            : wasPort
              ? 'Port move cancelled.'
              : wasResize
                ? 'Resize cancelled.'
                : 'Cancelled.',
      )
      return
    }
    if (escape === 'tool-select') {
      // Keep selection; only leave the sticky tool (Cancel → Select → Deselect).
      chooseEditorTool('select')
      return
    }
    if (escape === 'clear-selection') {
      selected.value = new Set()
      selectedPort.value = null
      selectedSegment.value = null
      selectedStroke.value = null
      return
    }
    return
  }
  if (event.key === 'Enter' && symbolEditor.value?.finishPolygon()) {
    event.preventDefault()
    return
  }
  if (event.key === 'Enter' && wireDraft.value) {
    event.preventDefault()
    wireFreePress = null
    // wireHover is already free-snapped / target-exact via wireHoverFromWorld (P4a).
    acceptWire(finishFree(wireDraft.value, wireHover.value))
    return
  }
  if (typingTarget(event.target)) return
  if (event.key === ' ') {
    // Arm Space-pan; elbow toggles on keyup only if no pan occurred (D5b.5b).
    event.preventDefault()
    if (!event.repeat) {
      spaceHeld.value = true
      spacePanMoved = false
      marquee.value = null
    }
    return
  }
  const command = event.ctrlKey || event.metaKey
  const key = event.key.toLowerCase()
  if (command && key === 'z') {
    event.preventDefault()
    if (event.shiftKey) {
      redo()
      return
    }
    if (wireDrawingShortcut('z', Boolean(wireDraft.value), { ctrlOrMeta: true }) === 'undo-step') {
      applyWireStepUndo()
      return
    }
    undo()
    return
  }
  if (command && key === 'y') {
    event.preventDefault()
    redo()
    return
  }
  if (command && key === 's') {
    event.preventDefault()
    void save()
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
    if (event.key === 'Backspace' && wireDrawingShortcut('Backspace', Boolean(wireDraft.value)) === 'undo-step') {
      event.preventDefault()
      applyWireStepUndo()
      return
    }
    event.preventDefault()
    removeSelection()
  }
}

function onKeyUp(event: KeyboardEvent): void {
  if (event.key !== ' ') return
  const panOccurred = spacePanMoved || Boolean(viewPan?.moved)
  spaceHeld.value = false
  spacePanMoved = false
  if (spaceReleaseAction(Boolean(wireDraft.value), panOccurred) === 'elbow' && wireDraft.value) {
    wireDraft.value = { ...wireDraft.value, elbow: wireDraft.value.elbow === 'h' ? 'v' : 'h' }
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

/** Convert constant screen pixels to world units under the current viewport scale (P0). */
function chromeWorld(screenPx: number): number {
  const zoom = viewport.value.zoom > 0 ? viewport.value.zoom : 1
  return screenPx / zoom
}

const bendHandleSize = computed(() => chromeWorld(6))
const bendHitR = computed(() => chromeWorld(8))
const freeEndTipR = computed(() => chromeWorld(2.5))
const freeEndHandleR = computed(() => chromeWorld(5))
const freeEndHitR = computed(() => chromeWorld(9))

function wireSelected(wireId: string): boolean {
  return wireId === selectedSegment.value
}

function onWindowBlur(): void {
  focusLossToken += 1
  spaceHeld.value = false
  spacePanMoved = false
  viewPan = null
  if (edits().isGesturing || resizeDrag || portDrag || drag || bendDrag || spanDrag || freeEndDrag || junctionDrag || labelDrag || displayTextDrag) {
    cancelActiveDocumentGesture('Gesture cancelled.')
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') onWindowBlur()
}

function onPageHide(): void {
  onWindowBlur()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onWindowBlur)
  window.addEventListener('pagehide', onPageHide)
  document.addEventListener('visibilitychange', onVisibilityChange)
})
onUnmounted(() => {
  cancelActiveDocumentGesture()
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onWindowBlur)
  window.removeEventListener('pagehide', onPageHide)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

defineExpose({ roundTrip, doc })
</script>

<template>
  <div class="lab" :class="{ editing: Boolean(activeSymbol) }">
    <header class="toolbar" data-toolbar="docked" data-toolbar-icons="only" role="banner">
      <div class="toolbar-group" data-group="file" role="group" aria-label="Sheets and fixtures">
        <button type="button" class="tool-btn" title="New" aria-label="New" @click="newDiagram">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h5l3 3v9H4V2zm5 0v3h3" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6 9h4M8 7v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </button>
        <button type="button" class="tool-btn" title="Example" aria-label="Example" @click="loadExample">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2l1.5 3.5L13 6l-2.8 2.4L11 12 8 10.2 5 12l.8-3.6L3 6l3.5-.5z" fill="currentColor"/></svg>
        </button>
        <button type="button" class="tool-btn" title="Net test" aria-label="Net test" @click="loadNetTest">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1.5" fill="currentColor"/><circle cx="13" cy="4" r="1.5" fill="currentColor"/><circle cx="13" cy="12" r="1.5" fill="currentColor"/><path d="M4.5 8H11M11.5 5v6" stroke="currentColor" stroke-width="1.3"/></svg>
        </button>
        <button type="button" class="tool-btn" title="Symbols" aria-label="Symbols" @click="loadSymbols">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3 6h10M6 3v10" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
        <button type="button" class="tool-btn" title="Acceptance" aria-label="Acceptance" @click="loadAcceptance">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button type="button" class="tool-btn" title="Bench" aria-label="Bench" @click="loadBench">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 11h12M4 11V7l4-3 4 3v4M6 11v2m4-2v2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        </button>
        <button type="button" class="tool-btn" data-benchgen="open" title="Synthetic bench (D5d.0-A)" aria-label="Synthetic bench" @click="openSyntheticBenchDialog">
          <span class="tool-glyph">Σ</span>
        </button>
        <button type="button" class="tool-btn" title="Project" aria-label="Project" @click="loadProject">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h5l1 1.5H14v8H2V4z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
        </button>
        <button type="button" class="tool-btn" title="New project" aria-label="New project" @click="newDesign">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h5l1 1.5H14v8H2V4z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 7v5M5.5 9.5h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </button>
        <button type="button" class="tool-btn" data-reference="digital" title="Digital" aria-label="Digital" @click="loadDigital">
          <span class="tool-glyph">D</span>
        </button>
        <button type="button" class="tool-btn" data-reference="signal" title="Signal" aria-label="Signal" @click="loadSignal">
          <span class="tool-glyph">S</span>
        </button>
        <button type="button" class="tool-btn" data-reference="general" title="General" aria-label="General" @click="loadGeneral">
          <span class="tool-glyph">G</span>
        </button>
        <button type="button" class="tool-btn" title="New symbol" aria-label="New symbol" @click="createSymbol">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 5.5v5M5.5 8h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </button>
        <button type="button" class="tool-btn" title="Shift pin" aria-label="Shift pin" @click="shiftSymbolPin">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="5" cy="8" r="1.5" fill="currentColor"/><path d="M7 8h5M10 5.5 12.5 8 10 10.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button type="button" class="tool-btn" title="Drop pin" aria-label="Drop pin" @click="dropSymbolPin">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5" r="1.5" fill="currentColor"/><path d="M8 7v5M5.5 10 8 12.5 10.5 10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <span class="toolbar-sep" aria-hidden="true" />
      <div class="toolbar-group" data-group="navigate" role="toolbar" aria-label="Select and navigate">
        <button
          type="button"
          class="tool-btn"
          data-tool-id="select"
          :class="{ on: tool === 'select' }"
          title="Select — Esc returns here"
          aria-label="Select"
          :aria-pressed="tool === 'select'"
          @click="chooseEditorTool('select')"
        >
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2v12l3.5-3.2L9.8 14l1.4-1.4-3.2-3.2L14 6.2z" fill="currentColor"/></svg>
        </button>
        <button
          type="button"
          class="tool-btn"
          data-tool-id="pan"
          :class="{ on: tool === 'pan' }"
          title="Pan — MMB drag · Space+LMB · or this tool"
          aria-label="Pan"
          :aria-pressed="tool === 'pan'"
          @click="chooseEditorTool('pan')"
        >
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 10 4H9v3h3V6l2.5 2L12 10.5V9H9v3h1l-2 2.5L6 12h1V9H4v1.5L1.5 8 4 6v1h3V4H6z" fill="currentColor"/></svg>
        </button>
      </div>
      <span class="toolbar-sep" aria-hidden="true" />
      <div class="toolbar-group" data-group="draw" role="toolbar" aria-label="Draw">
        <button
          type="button"
          class="tool-btn"
          data-tool-id="wire"
          :class="{ on: tool === 'wire' }"
          title="Wire — sticky; click again for Select · Enter finishes stub · Esc cancels"
          aria-label="Wire"
          :aria-pressed="tool === 'wire'"
          @click="chooseEditorTool('wire')"
        >
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 11h3v3H2zm9-9h3v3h-3zM5.2 11.5 10.5 4.8l1.1 1.1-5.3 6.7z" fill="currentColor"/></svg>
        </button>
        <button
          type="button"
          class="tool-btn"
          data-tool-id="freehand"
          :class="{ on: tool === 'freehand' }"
          title="Freehand — sticky; click again for Select"
          aria-label="Freehand"
          :aria-pressed="tool === 'freehand'"
          @click="chooseEditorTool('freehand')"
        >
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 12c2-3 3-5 5-5s2 3 4 3 3-2 3-2l1 1s-1 3-4 3-3-3-5-3-2 2-3 3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        </button>
        <button
          type="button"
          class="tool-btn"
          data-tool-id="port"
          :class="{ on: tool === 'port' }"
          title="Add port — sticky; click again for Select"
          aria-label="Add port"
          :aria-pressed="tool === 'port'"
          @click="beginAddPort"
        >
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="13" cy="8" r="1.6" fill="currentColor"/></svg>
        </button>
      </div>
      <span class="toolbar-sep" aria-hidden="true" />
      <div class="toolbar-group" data-group="edit" role="group" aria-label="Edit">
        <button type="button" class="tool-btn" :disabled="selected.size < 2" title="Group" aria-label="Group" @click="groupSelection">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="9" y="9" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 4.5h2.5V9" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
        <button type="button" class="tool-btn" title="Ungroup" aria-label="Ungroup" @click="ungroupSelection">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="9" y="9" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 3.5h2.5M11.5 6V8" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        </button>
        <button type="button" class="tool-btn" :disabled="selected.size === 0" title="Duplicate — Ctrl/Cmd+D · or Shift+drag" aria-label="Duplicate" @click="duplicateSelection">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3 10V3.5A1.5 1.5 0 0 1 4.5 2H11" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
        </button>
        <button type="button" class="tool-btn" :disabled="selected.size === 0 && !selectedPort && !selectedStroke && !selectedSegment" title="Delete — Del" aria-label="Delete" @click="removeSelection">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5h10M6 5V3.5h4V5m-.5 0v8h-5V5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        </button>
        <button
          type="button"
          class="tool-btn"
          data-show-grid
          :class="{ on: showGrid }"
          :title="showGrid ? 'Hide grid' : 'Show grid'"
          :aria-label="showGrid ? 'Hide grid' : 'Show grid'"
          :aria-pressed="showGrid"
          @click="showGrid = !showGrid"
        >
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2.5" y="2.5" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.2" />
            <path d="M2.5 6.5h11M2.5 9.5h11M6.5 2.5v11M9.5 2.5v11" fill="none" stroke="currentColor" stroke-width="1.1" />
          </svg>
        </button>
        <button
          type="button"
          class="tool-btn"
          data-snap
          :class="{ on: snapOn }"
          :title="snapOn ? 'Disable snapping' : 'Enable snapping'"
          :aria-label="snapOn ? 'Disable snapping' : 'Enable snapping'"
          :aria-pressed="snapOn"
          @click="snapOn = !snapOn"
        >
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2h3v3H2zm9 0h3v3h-3zM2 11h3v3H2zm9 0h3v3h-3zM5 3.5h6M3.5 5v6M12.5 5v6M5 12.5h6" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
        <button
          type="button"
          class="tool-btn"
          data-preferences
          :class="{ on: preferencesOpen }"
          title="Editor preferences"
          aria-label="Editor preferences"
          :aria-pressed="preferencesOpen"
          @click="preferencesOpen = !preferencesOpen"
        >
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="1.3" />
            <path
              d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <button type="button" class="tool-btn" title="Convert" aria-label="Convert" @click="convertSelected">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5c2-3 8-3 10 0M13 3v3h-3M13 11c-2 3-8 3-10 0M3 13v-3h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button type="button" class="tool-btn" :disabled="!preview" title="Confirm wire" aria-label="Confirm wire" @click="confirmPreview">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 9c2 0 3-3 5-3s2 4 4 4 3-2 3-2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M10 3.5 12.5 6 10 8.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button type="button" class="tool-btn" data-action="undo" :disabled="!canUndo" :title="project ? 'Undo — Ctrl/Cmd+Z' : 'Undo — Ctrl/Cmd+Z'" aria-label="Undo" @click="undo">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3 3 7l4 4V8.5c3 0 5 1 6 3-.5-3.5-2.5-5-6-5V3z" fill="currentColor"/></svg>
        </button>
        <button type="button" class="tool-btn" data-action="redo" :disabled="!canRedo" :title="project ? 'Redo — Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y' : 'Redo — Ctrl/Cmd+Shift+Z or Y'" aria-label="Redo" @click="redo">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M9 3d4 4-4 4V8.5c-3 0-5 1-6 3 .5-3.5 2.5-5 6-5V3z" fill="currentColor"/></svg>
        </button>
      </div>
      <span class="toolbar-sep" aria-hidden="true" />
      <div class="toolbar-group" data-group="io" role="group" aria-label="Save and load">
        <button type="button" class="tool-btn" title="Save — Ctrl/Cmd+S" aria-label="Save" @click="save">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h8l2 2v10H3V2zm2 0v4h5V2m-6 8h8v4H4v-4z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
        </button>
        <button type="button" class="tool-btn" title="Reload" aria-label="Reload" @click="reloadSaved">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.2-3.3M13 3v3h-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button type="button" class="tool-btn" title="Load file" aria-label="Load file" @click="fileEl?.click()">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 7.5 8 12l5-4.5M8 2v10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 14h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </button>
        <button type="button" class="tool-btn" title="Check round-trip" aria-label="Check round-trip" @click="checkRoundTrip">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5h7l2 2v6H3V5zm7 0v2h2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 9.5 7 11l3-3.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <span class="toolbar-sep" aria-hidden="true" />
      <div class="toolbar-group" data-group="view" role="group" aria-label="View">
        <button type="button" class="tool-btn" data-action="zoom-in" title="Zoom in" aria-label="Zoom in" @click="zoomToken += 1">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 10.5 14 14M5 7h4M7 5v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        </button>
        <button type="button" class="tool-btn" data-action="zoom-out" title="Zoom out" aria-label="Zoom out" @click="zoomToken -= 1">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 10.5 14 14M5 7h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        </button>
        <span class="zoom" title="Sheet status">{{ doc.blocks.length }} · {{ viewport.zoom.toFixed(2) }}×</span>
      </div>
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
      <div
        v-if="project && navigation"
        class="crumbs hierarchy-chrome"
        data-chrome="hierarchy"
        role="navigation"
        aria-label="Hierarchy"
        :data-path-ids="pathKey"
        :data-shared="sharedLabel ?? ''"
      >
        <button v-for="(crumb, index) in crumbs" :key="`${crumb.blockId ?? 'root'}-${index}`" type="button" class="crumb-label" :title="crumb.label" @click="goToSteps(crumb.steps, true)">{{ crumb.label }}</button>
        <span class="toolbar-sep crumbs-sep" aria-hidden="true" />
        <button type="button" class="tool-btn" title="Root" aria-label="Root" @click="goRoot">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 2 7h2v6h3V9h2v4h3V7h2z" fill="currentColor"/></svg>
        </button>
        <button type="button" class="tool-btn" title="Up" aria-label="Up" :disabled="pathKey === ''" @click="goParent">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3 3 8h3v5h4V8h3z" fill="currentColor"/></svg>
        </button>
        <button type="button" class="tool-btn" title="Back" aria-label="Back" :disabled="!canNavBack" @click="goBack">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M9 3 4 8l5 5V9.5h4v-3H9V3z" fill="currentColor"/></svg>
        </button>
        <button type="button" class="tool-btn" title="Forward" aria-label="Forward" :disabled="!canNavForward" @click="goForward">
          <svg class="tool-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3d5 5-5 5V9.5H3v-3h4V3z" fill="currentColor"/></svg>
        </button>
        <span v-if="sharedLabel" class="hint">{{ sharedLabel }}</span>
      </div>
    <div
      ref="stageEl"
      class="stage"
      :class="stageCursorClass"
      :data-tool="tool"
      :data-space-pan="spaceHeld"
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
      :data-interface-ports="interfacePortIds"
      :data-component-refs="doc.blocks.filter((block) => block.componentId).map((block) => `${block.name}:${block.componentId}`).join('|')"
      :data-bindings="bindings"
      :data-anchors="anchors"
      :data-block-pos="blockPositions"
      @pointerdown="onStagePointerDown"
      @pointermove="onStagePointerMove"
      @pointerup="onStagePointerUp"
      @mousedown="onStageAuxMouseDown"
      @contextmenu="onStageContextMenu"
      @wheel.capture="onStageWheel"
    >
      <!-- P0b/P4: grid under Vue Flow; visibility independent of snapOn -->
      <svg class="world-grid" aria-hidden="true" :style="worldStyle">
        <g v-if="showGrid" class="grid">
          <line v-for="value in gridLines" :key="`x-${value}`" :x1="value" y1="0" :x2="value" y2="1600" />
          <line v-for="value in gridLines" :key="`y-${value}`" x1="0" :y1="value" x2="1600" :y2="value" />
        </g>
      </svg>
      <VueFlow
        :nodes="flowNodes"
        :edges="[]"
        :nodes-draggable="tool === 'select' && !spaceHeld"
        :pan-on-drag="panDragButtons"
        :nodes-connectable="false"
        :elements-selectable="false"
        :selection-key-code="null"
        :multi-selection-key-code="null"
        :select-nodes-on-drag="false"
        :zoom-on-scroll="false"
        :zoom-on-pinch="false"
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
            :leads="nodeProps.data.leads"
            :shapes="nodeProps.data.shapes"
            :labels="nodeProps.data.labels"
            :assets="nodeProps.data.assets"
            :selected="nodeProps.data.selected"
            :handles="nodeProps.data.handles"
            :zoom="viewport.zoom"
            :symbol-width="nodeProps.data.symbolWidth"
            :symbol-height="nodeProps.data.symbolHeight"
            :ports-live="nodeProps.data.portsLive"
            :selected-port="nodeProps.data.selectedPort"
            :show-name="nodeProps.data.showName"
            :show-port-names="nodeProps.data.showPortNames"
            :display-text="nodeProps.data.displayText"
            :display-text-format="nodeProps.data.displayTextFormat"
            :display-math="nodeProps.data.displayMath"
            :display-formatted="nodeProps.data.displayFormatted"
            :display-plain="nodeProps.data.displayPlain"
            :show-display-text="nodeProps.data.showDisplayText"
            :display-text-offset-x="nodeProps.data.displayTextOffsetX"
            :display-text-offset-y="nodeProps.data.displayTextOffsetY"
            :appearance="nodeProps.data.appearance"
            @nudge="onNudge"
            @context="onBlockContext"
            @resize-start="onResizeStart"
            @resize-move="onResizeMove"
            @resize-end="onResizeEnd"
            @resize-cancel="onResizeCancel"
            @port-down="onPortDown"
            @display-text-down="onDisplayTextDown"
          />
        </template>
        <FlowBridge ref="flowBridge" :port-count="doc.ports.length" :ids="doc.blocks.map((block) => block.id)" :fit-token="fitToken" :pin-key="pinKey" :zoom-token="zoomToken" :frame="frame" @viewport="onViewport" />
      </VueFlow>
      <svg
        class="world"
        :class="{ drawing: tool === 'freehand' || tool === 'wire' || tool === 'port' }"
        :style="worldStyle"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
        @lostpointercapture="onLostPointerCapture"
        @dblclick="onWorldDblClick"
      >
        <defs>
          <marker
            id="dl-arrow-end"
            markerUnits="strokeWidth"
            orient="auto"
            overflow="visible"
            refX="4"
            refY="2.5"
            markerWidth="5"
            markerHeight="5"
            viewBox="0 0 6 6"
          >
            <path d="M0,0 L6,3 L0,6 Z" class="wire-arrow-fill" />
          </marker>
          <marker
            id="dl-arrow-start"
            markerUnits="strokeWidth"
            orient="auto-start-reverse"
            overflow="visible"
            refX="4"
            refY="2.5"
            markerWidth="5"
            markerHeight="5"
            viewBox="0 0 6 6"
          >
            <path d="M0,0 L6,3 L0,6 Z" class="wire-arrow-fill" />
          </marker>
        </defs>
        <polyline
          v-for="wire in wires"
          :key="`${wire.id}-hit`"
          :points="pointsAttr(wire.points)"
          class="hit"
          @pointerdown="onSpanDown(wire.id, $event)"
        />
        <polyline
          v-for="wire in wires"
          :key="`${wire.id}:${wire.markerStart ? 1 : 0}:${wire.markerEnd ? 1 : 0}`"
          :points="pointsAttr(wire.points)"
          class="wire"
          :class="{ selected: wire.id === selectedSegment }"
          :marker-start="wire.markerStart ? 'url(#dl-arrow-start)' : undefined"
          :marker-end="wire.markerEnd ? 'url(#dl-arrow-end)' : undefined"
        />
        <circle v-if="portPreview" class="port-preview" :cx="portPreview.x" :cy="portPreview.y" r="5" />
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
          <template v-if="wireSelected(wire.id)">
            <g v-for="(bend, index) in bends(wire.points)" :key="`${wire.id}-bend-${index}`" class="bend-group">
              <circle
                class="bend-hit"
                :cx="bend.x"
                :cy="bend.y"
                :r="bendHitR"
                @pointerdown="startBend(wire.id, index + 1, $event)"
              />
              <rect
                class="bend"
                :x="bend.x - bendHandleSize / 2"
                :y="bend.y - bendHandleSize / 2"
                :width="bendHandleSize"
                :height="bendHandleSize"
              />
            </g>
          </template>
          <g v-if="wire.start.kind === 'free'" class="free-end-group">
            <circle
              class="free-end-hit"
              :cx="wire.start.x"
              :cy="wire.start.y"
              :r="freeEndHitR"
              @pointerdown="startFreeEnd(wire.id, 'start', $event)"
            />
            <circle
              class="free-end"
              :class="{ tip: !wireSelected(wire.id) }"
              :cx="wire.start.x"
              :cy="wire.start.y"
              :r="wireSelected(wire.id) ? freeEndHandleR : freeEndTipR"
            />
          </g>
          <g v-if="wire.end.kind === 'free'" class="free-end-group">
            <circle
              class="free-end-hit"
              :cx="wire.end.x"
              :cy="wire.end.y"
              :r="freeEndHitR"
              @pointerdown="startFreeEnd(wire.id, 'end', $event)"
            />
            <circle
              class="free-end"
              :class="{ tip: !wireSelected(wire.id) }"
              :cx="wire.end.x"
              :cy="wire.end.y"
              :r="wireSelected(wire.id) ? freeEndHandleR : freeEndTipR"
            />
          </g>
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
        <g
          v-for="label in labels"
          :key="label.id"
          v-show="label.at && label.visible"
          class="label-group"
          @pointerdown="onLabelDown(label.id, $event)"
        >
          <circle class="label-hit" :cx="label.at?.x ?? 0" :cy="label.at?.y ?? 0" :r="labelHitRadius(label)" />
          <g
            v-if="label.format === 'latex' && label.math?.ok && label.at"
            class="label math"
            :transform="`translate(${label.at.x + label.anchorDx}, ${label.at.y})`"
            pointer-events="none"
            v-html="label.math.svg"
          />
          <g
            v-else-if="label.format === 'markdown' && label.formatted?.ok && label.at"
            class="label formatted"
            :transform="`translate(${label.at.x + label.anchorDx}, ${label.at.y})`"
            pointer-events="none"
            v-html="label.formatted.svg"
          />
          <g
            v-else-if="label.format === 'plain' && label.plain?.ok && label.at"
            class="label formatted"
            :transform="`translate(${label.at.x + label.anchorDx}, ${label.at.y})`"
            pointer-events="none"
            v-html="label.plain.svg"
          />
          <text
            v-else
            class="label"
            :class="{
              compact: Boolean(label.fontSize && label.fontSize < 12),
              'math-fallback': label.format === 'latex' || label.format === 'markdown',
            }"
            :x="label.at?.x"
            :y="label.at?.y"
            :text-anchor="label.textAlign === 'center' ? 'middle' : label.textAlign === 'right' ? 'end' : 'start'"
            :style="label.fontSize ? { fontSize: `${label.fontSize}px` } : undefined"
          >{{ label.text }}</text>
        </g>
      </svg>
    </div>
    </div>
    <aside class="props">
      <p>Properties</p>
      <template v-if="!activeSymbol && !oneBlock">
        <p class="hint">Arrowheads (whole sheet)</p>
        <label>
          Diagram default
          <select data-diagram-arrow-default :value="diagramArrowDefault" @change="commitDiagramArrowDefault">
            <option value="none">None</option>
            <option value="automatic">Automatic</option>
          </select>
        </label>
        <p class="hint">You can set Automatic anytime. Arrows appear once a net has one out and at least one in port. Legacy sheets default to None.</p>
      </template>
      <template v-if="selectedNet && !activePort && !oneBlock">
        <p data-wire-inspector>Wire</p>
        <label>Name <input data-wire-name :value="selectedNet.name" @change="commitNetName" /></label>
        <p class="hint" data-wire-net-id>Net id {{ selectedNet.id }}</p>
        <p class="hint" data-wire-net-info>{{ wireInspectorSummary }}</p>
        <p class="hint">This segment</p>
        <label v-if="selectedWireSegment">
          Segment arrowheads
          <select data-segment-arrowheads :value="selectedSegmentArrowOverride" @change="commitSegmentArrowOverride">
            <option value="inherit">Inherit diagram default</option>
            <option value="none">None</option>
            <option value="automatic">Automatic</option>
            <option value="start">Start</option>
            <option value="end">End</option>
            <option value="both">Both</option>
          </select>
        </label>
        <p v-if="selectedWireSegment" class="hint" data-effective-arrow-mode>Effective mode: {{ selectedSegmentEffectiveArrowMode }}</p>
        <button
          v-if="selectedWireSegment && selectedSegmentArrowOverride !== 'inherit'"
          type="button"
          data-reset-segment-arrowheads
          @click="resetSegmentArrowOverride"
        >
          Reset to inherit
        </button>
        <p
          v-if="selectedNameCollision"
          class="hint"
          data-wire-name-collision
        >Name "{{ selectedNameCollision.name }}" is used {{ selectedNameCollision.count }} times on this sheet. Rename-join or merge to make one net.</p>
        <p class="hint">Name label</p>
        <template v-if="selectedSegmentHasNameLabel">
          <label>
            Display
            <select data-wire-display-mode :value="selectedLabelUsesCustomDisplay ? 'custom' : 'net'" @change="commitLabelDisplayMode">
              <option value="net">Use net name</option>
              <option value="custom">Custom display label</option>
            </select>
          </label>
          <template v-if="selectedLabelUsesCustomDisplay">
            <label>
              Text format
              <select data-wire-text-format :value="selectedLabelTextFormat" @change="commitLabelTextFormat">
                <option value="plain">Plain Text</option>
                <option value="latex">LaTeX</option>
                <option value="markdown">Markdown</option>
              </select>
            </label>
            <label>
              Display text
              <textarea
                v-if="selectedLabelTextFormat !== 'plain'"
                data-wire-display-text
                :rows="selectedLabelTextFormat === 'latex' ? 2 : 5"
                :value="selectedLabelDisplayText"
                :placeholder="selectedLabelTextFormat === 'latex' ? '\\\\sqrt{2E_b/T_b}' : '**Title**\\n$x$'"
                @change="commitLabelDisplayText"
              />
              <input
                v-else
                data-wire-display-text
                :value="selectedLabelDisplayText"
                placeholder="e.g. cos(ω₀t)"
                @change="commitLabelDisplayText"
              />
            </label>
            <div
              v-if="selectedLabelTextFormat === 'latex'"
              class="math-preview"
              data-wire-math-preview
            >
              <p class="hint">Preview</p>
              <div
                v-if="mathPreview?.ok"
                class="math-preview-svg"
                v-html="mathPreview.svg"
              />
              <p v-else-if="mathPreview && !mathPreview.ok" class="hint math-error" data-wire-math-error>
                {{ mathPreview.error }}
              </p>
              <p v-else class="hint">Typesetting…</p>
            </div>
            <template v-if="selectedLabelUsesCustomDisplay && selectedLabelDisplayText.trim().length > 0">
              <p class="hint">Typography</p>
              <label>
                Alignment
                <select data-label-text-align :value="selectedLabelDisplayAlign" @change="commitLabelTypographyAlign">
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
              <label>
                Font size
                <input
                  data-label-font-size
                  type="number"
                  min="8"
                  max="48"
                  step="1"
                  :value="selectedLabelDisplayEm"
                  @change="commitLabelTypographySize"
                />
              </label>
              <button type="button" data-reset-label-typography @click="resetLabelTypographyAction">Reset typography</button>
            </template>
            <div
              v-if="selectedLabelTextFormat === 'markdown' && selectedLabelDisplayText.trim().length > 0"
              class="math-preview"
              data-wire-formatted-preview
            >
              <p class="hint">Preview</p>
              <div
                v-if="formattedPreview?.ok"
                class="math-preview-svg formatted-preview-host"
                v-html="formattedPreview.svg"
              />
              <p v-else-if="formattedPreview && !formattedPreview.ok" class="hint math-error">
                {{ formattedPreview.error }}
              </p>
              <p v-else class="hint">Typesetting…</p>
            </div>
            <div
              v-if="selectedLabelTextFormat === 'plain' && selectedLabelDisplayText.trim().length > 0"
              class="math-preview"
              data-wire-plain-preview
            >
              <p class="hint">Preview</p>
              <div
                v-if="plainPreview?.ok"
                class="math-preview-svg formatted-preview-host"
                v-html="plainPreview.svg"
              />
              <p v-else-if="plainPreview && !plainPreview.ok" class="hint math-error">
                {{ plainPreview.error }}
              </p>
              <p v-else class="hint">Typesetting…</p>
            </div>
          </template>
          <label class="check">
            <input data-wire-show-label type="checkbox" :checked="selectedSegmentLabelsVisible" @change="commitSegmentLabelsVisible" />
            Show label
          </label>
          <button type="button" data-remove-name-label @click="removeSelectedNameLabel">Remove name label</button>
          <button
            type="button"
            data-reset-label-position
            :disabled="!selectedSegmentHasLabelShift"
            @click="resetSelectedLabelPosition"
          >
            Reset label position
          </button>
        </template>
        <button v-else type="button" data-add-name-label @click="addLabel">Add name label</button>
        <button type="button" @click="beginMerge">Merge</button>
        <button
          v-if="selectedNameCollision"
          type="button"
          data-merge-by-name
          @click="mergeSelectedByName"
        >Merge all with this name</button>
        <button type="button" @click="routeSelected('auto')">Auto route</button>
        <button type="button" @click="routeSelected('manual')">Keep manual</button>
      </template>
      <p
        v-if="sheetNameCollisions.length && !(selectedNet && !activePort && !oneBlock)"
        class="hint"
        data-sheet-name-collisions
      >{{ sheetNameCollisions.length }} duplicate net name{{ sheetNameCollisions.length === 1 ? '' : 's' }} on this sheet.</p>
      <section v-if="project" class="components" data-interface-editor>
        <p>Components</p>
        <p class="hint" data-undo-rule>One undo history for this project. Sheet and component edits share it.</p>
        <label>Component <input v-model="componentName" data-component-name /></label>
        <button type="button" data-new-component @click="createAbstract">New component</button>
        <button
          v-for="item in project.components"
          :key="item.id"
          type="button"
          :data-component-id="item.id"
          :data-component-kind="item.implementation.kind"
          :class="{ on: item.id === interfaceFocus }"
          @click="focusComponent(item.id)"
        >{{ item.name }} <span v-if="instancesOf(project, item.id).length">({{ instancesOf(project, item.id).length }})</span></button>
        <template v-if="focusedComponent">
          <button type="button" data-rename-component @click="renameFocused">Rename</button>
          <button type="button" data-place-component @click="placeFocused">Place on sheet</button>
          <button type="button" data-duplicate-component @click="duplicateFocused">Duplicate definition</button>
          <button type="button" data-delete-component @click="deleteFocused">Delete</button>
          <p v-if="componentUses.length === 0" class="hint" data-component-unused>Not used.</p>
          <p v-for="use in componentUses" :key="`${use.documentId}:${use.blockId}`" class="hint" :data-component-use="use.blockId">{{ use.name }}</p>
          <button type="button" data-create-impl :disabled="focusedComponent.implementation.kind !== 'none'" @click="makeImplementation">Create implementation</button>
          <label>Port <input v-model="interfaceName" data-port-name /></label>
          <label>Side
            <select v-model="interfaceSide" data-port-side>
              <option value="left">left</option>
              <option value="right">right</option>
              <option value="top">top</option>
              <option value="bottom">bottom</option>
            </select>
          </label>
          <button type="button" data-add-port @click="addLogicalPort">Add port</button>
          <div v-for="port in focusedComponent.ports" :key="port.id" class="port-row" :data-interface-port="port.id">
            <input :value="port.name" @change="renameLogical(port.id, $event)" />
            <button type="button" @click="shiftLogical(port.id, -1)">Up</button>
            <button type="button" @click="shiftLogical(port.id, 1)">Down</button>
            <button type="button" data-remove-port @click="removeLogical(port.id)">Remove</button>
            <button type="button" data-add-pin @click="pinLogical(port.id)">Add pin</button>
            <select :value="focusedComponent.bindings.find((item) => item.interfacePortId === port.id)?.symbolPortId ?? ''" @change="bindLogical(port.id, $event)">
              <option value="">Unbound</option>
              <option v-for="pin in symbolPins" :key="pin.id" :value="pin.id">{{ pin.name }}</option>
            </select>
          </div>
          <p v-for="note in interfaceNotes" :key="note.message" class="hint" data-interface-note>{{ note.message }}</p>
        </template>
        <button type="button" data-extract :disabled="selected.size < 2" @click="proposeExtract">Extract component</button>
        <div v-if="extractPlan" class="extract-plan" data-extract-preview :data-extract-ok="extractPlan.ok">
          <p v-if="!extractPlan.ok">{{ extractPlan.message }}</p>
          <template v-else>
            <p v-for="port in extractPlan.ports" :key="port.netId" class="hint" :data-extract-port="port.name">{{ port.name }} on the {{ port.side }}, from net {{ port.netName || port.netId }}</p>
            <p v-if="extractPlan.ports.length === 0" class="hint">No nets leave the selection.</p>
            <p v-for="(note, index) in extractPlan.notes" :key="index" class="hint">{{ note }}</p>
            <button type="button" data-extract-confirm @click="confirmExtract">Create component</button>
          </template>
          <button type="button" data-extract-cancel @click="extractPlan = null">Cancel</button>
        </div>
        <button type="button" data-expand :disabled="!expandTarget" @click="proposeExpand">Expand component</button>
        <div v-if="expandPlan" class="extract-plan" data-expand-preview :data-expand-ok="expandPlan.ok">
          <p v-if="!expandPlan.ok">{{ expandPlan.message }}</p>
          <template v-else>
            <p class="hint">{{ expandPlan.moving.join(', ') || 'No inner blocks' }}</p>
            <p v-for="(note, index) in expandPlan.notes" :key="index" class="hint">{{ note }}</p>
            <button type="button" data-expand-confirm @click="confirmExpand">Replace instance</button>
          </template>
          <button type="button" data-expand-cancel @click="expandPlan = null">Cancel</button>
        </div>
        <button type="button" data-make-unique :disabled="!canMakeUnique" @click="makeUniqueSelected">Make unique</button>
      </section>
      <p v-if="sharedLabel" class="hint">{{ sharedLabel }}</p>
      <template v-if="activePort">
        <label>Port <input :value="activePort.name" data-port-instance-name @change="commitPortName" /></label>
        <label>
          Direction
          <select data-port-direction :value="activePortEffectiveDirection" @change="commitPortDirection">
            <option value="unspecified">Unspecified</option>
            <option value="in">Input</option>
            <option value="out">Output</option>
            <option value="inout">Bidirectional</option>
          </select>
        </label>
        <p v-if="activePortDirectionHint" class="hint" data-port-direction-hint>{{ activePortDirectionHint }}</p>
        <label>Side
          <select :value="activePort.side" data-port-instance-side @change="commitPortSide">
            <option value="left">left</option>
            <option value="right">right</option>
            <option value="top">top</option>
            <option value="bottom">bottom</option>
          </select>
        </label>
        <label>Position <input :value="activePort.t ?? 0.5" data-port-instance-t type="number" min="0" max="1" step="0.05" @change="commitPortT" /></label>
        <button type="button" data-delete-port @click="deleteActivePort">Delete port</button>
        <p class="hint">{{ activePort.placed ? 'This instance keeps its own position.' : 'The symbol pin supplies the position.' }}</p>
      </template>
      <template v-else-if="oneBlock">
        <label>Name <input :value="oneBlock.name" data-block-name @change="commitName" /></label>
        <label class="check">
          <input data-block-show-name type="checkbox" :checked="oneBlock.showName !== false" @change="commitBlockVisibility('showName', $event)" />
          Show instance name
        </label>
        <label>
          Text format
          <select data-block-text-format :value="selectedBlockTextFormat" @change="commitBlockTextFormat">
            <option value="plain">Plain Text</option>
            <option value="latex">LaTeX</option>
            <option value="markdown">Markdown</option>
          </select>
        </label>
        <label>
          Display text
          <textarea
            data-block-display-text
            :rows="selectedBlockTextFormat === 'plain' ? 3 : 5"
            :value="oneBlock.displayText ?? ''"
            :placeholder="selectedBlockTextFormat === 'latex' ? 'y(t)=K\\cdot x(t)' : selectedBlockTextFormat === 'markdown' ? '**Title**\\n$math$' : 'Multiline plain text'"
            @change="commitDisplayText"
          />
        </label>
        <template v-if="(oneBlock.displayText?.trim().length ?? 0) > 0">
          <p class="hint">Typography</p>
          <label>
            Alignment
            <select data-block-text-align :value="selectedBlockDisplayAlign" @change="commitBlockTypographyAlign">
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label>
            Font size
            <input
              data-block-font-size
              type="number"
              min="8"
              max="48"
              step="1"
              :value="selectedBlockDisplayEm"
              @change="commitBlockTypographySize"
            />
          </label>
          <button type="button" data-reset-block-typography @click="resetBlockTypographyAction">Reset typography</button>
        </template>
        <div
          v-if="selectedBlockTextFormat === 'latex' && (oneBlock.displayText?.trim().length ?? 0) > 0"
          class="math-preview"
          data-block-math-preview
        >
          <p class="hint">Preview</p>
          <div
            v-if="blockMathPreview?.ok"
            class="math-preview-svg"
            v-html="blockMathPreview.svg"
          />
          <p v-else-if="blockMathPreview && !blockMathPreview.ok" class="hint math-error" data-block-math-error>
            {{ blockMathPreview.error }}
          </p>
          <p v-else class="hint">Typesetting…</p>
        </div>
        <div
          v-if="selectedBlockTextFormat === 'markdown' && (oneBlock.displayText?.trim().length ?? 0) > 0"
          class="math-preview"
          data-block-formatted-preview
        >
          <p class="hint">Preview</p>
          <div
            v-if="blockFormattedPreview?.ok"
            class="math-preview-svg formatted-preview-host"
            v-html="blockFormattedPreview.svg"
          />
          <p v-else-if="blockFormattedPreview && !blockFormattedPreview.ok" class="hint math-error">
            {{ blockFormattedPreview.error }}
          </p>
          <p v-else class="hint">Typesetting…</p>
        </div>
        <div
          v-if="selectedBlockTextFormat === 'plain' && (oneBlock.displayText?.trim().length ?? 0) > 0"
          class="math-preview"
          data-block-plain-preview
        >
          <p class="hint">Preview</p>
          <div
            v-if="blockPlainPreview?.ok"
            class="math-preview-svg formatted-preview-host"
            v-html="blockPlainPreview.svg"
          />
          <p v-else-if="blockPlainPreview && !blockPlainPreview.ok" class="hint math-error">
            {{ blockPlainPreview.error }}
          </p>
          <p v-else class="hint">Typesetting…</p>
        </div>
        <label class="check">
          <input data-block-show-display type="checkbox" :checked="oneBlock.showDisplayText !== false" @change="commitBlockVisibility('showDisplayText', $event)" />
          Show display text
        </label>
        <label>
          Text offset X
          <input
            data-block-display-offset-x
            type="number"
            step="1"
            :value="oneBlock.displayTextOffset?.x ?? 0"
            :disabled="!oneBlock.displayText || oneBlock.showDisplayText === false"
            @change="commitDisplayTextOffsetAxis('x', $event)"
          />
        </label>
        <label>
          Text offset Y
          <input
            data-block-display-offset-y
            type="number"
            step="1"
            :value="oneBlock.displayTextOffset?.y ?? 0"
            :disabled="!oneBlock.displayText || oneBlock.showDisplayText === false"
            @change="commitDisplayTextOffsetAxis('y', $event)"
          />
        </label>
        <button
          type="button"
          data-block-reset-display-position
          :disabled="!oneBlock.displayTextOffset"
          @click="resetDisplayTextPosition"
        >
          Reset text position
        </button>
        <p class="hint">Drag display text on a selected block to reposition; reset restores centre.</p>
        <label class="check">
          <input data-block-show-ports type="checkbox" :checked="oneBlock.showPortNames !== false" @change="commitBlockVisibility('showPortNames', $event)" />
          Show port names
        </label>
        <p class="hint">Appearance</p>
        <label class="colour">
          Fill colour
          <input
            data-block-fill
            type="color"
            :value="blockFillPickerValue(oneBlock)"
            :disabled="oneBlock.style?.fillTransparent === true"
            @change="commitBlockFill"
          />
        </label>
        <div class="colour-presets" role="group" aria-label="Fill presets">
          <button
            v-for="preset in FILL_PRESETS"
            :key="preset"
            type="button"
            class="colour-swatch"
            :style="{ background: preset }"
            :title="preset"
            :data-fill-preset="preset"
            @click="applyFillPreset(preset)"
          />
        </div>
        <label class="check">
          <input
            data-block-fill-transparent
            type="checkbox"
            :checked="oneBlock.style?.fillTransparent === true"
            @change="commitBlockFillTransparent"
          />
          Transparent fill
        </label>
        <label class="colour">
          Border colour
          <input data-block-stroke type="color" :value="blockStrokePickerValue(oneBlock)" @change="commitBlockStroke" />
        </label>
        <label class="colour">
          Text colour
          <input data-block-text-colour type="color" :value="blockTextPickerValue(oneBlock)" @change="commitBlockTextColour" />
        </label>
        <button type="button" data-block-reset-appearance :disabled="!oneBlock.style" @click="resetBlockAppearance">
          Reset appearance
        </button>
        <label>X <input :value="oneBlock.x" type="number" @change="commitNumber('x', $event)" /></label>
        <label>Y <input :value="oneBlock.y" type="number" @change="commitNumber('y', $event)" /></label>
        <label>Width <input :value="oneBlock.width" type="number" @change="commitNumber('width', $event)" /></label>
        <label>Height <input :value="oneBlock.height" type="number" @change="commitNumber('height', $event)" /></label>
      </template>
      <p v-else-if="!selectedNet" class="hint">{{ selected.size }} selected</p>
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
            <SymbolFace :width="currentUpdateSymbol.width" :height="currentUpdateSymbol.height" :shapes="currentUpdateSymbol.shapes" :labels="currentUpdateSymbol.labels" :pins="facePins(currentUpdateSymbol)" :leads="faceLeads(currentUpdateSymbol)" :assets="doc.assets" />
          </svg>
          <svg :viewBox="`0 0 ${previewLibrarySymbol.width} ${previewLibrarySymbol.height}`" width="88" height="64">
            <SymbolFace :width="previewLibrarySymbol.width" :height="previewLibrarySymbol.height" :shapes="previewLibrarySymbol.shapes" :labels="previewLibrarySymbol.labels" :pins="facePins(previewLibrarySymbol)" :leads="faceLeads(previewLibrarySymbol)" :assets="previewLibraryAssets" />
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
    <div v-if="contextMenu" class="menu-back" @pointerdown="contextMenu = null">
      <div class="context-menu" data-context-menu :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" @pointerdown.stop>
        <template v-if="contextMenu.kind === 'block'">
          <button type="button" data-context-action @click="runContextAction">{{ blockOpenKind(contextMenu.blockId) === 'diagram' ? 'Open implementation' : 'Open as…' }}</button>
        </template>
        <template v-else>
          <button type="button" data-context-action="paste" @click="runStageContextPaste">Paste</button>
          <button type="button" data-context-action="select" @click="chooseEditorTool('select'); contextMenu = null">Select tool</button>
        </template>
      </div>
    </div>
    <div v-if="openAsBlock" class="menu-back" data-open-as @pointerdown.self="dismissOpenAs">
      <div class="open-as" role="dialog" aria-label="Open as">
        <p>Open as</p>
        <button type="button" data-open-as-diagram @click="confirmOpenAs">Block diagram</button>
        <button type="button" data-open-as-fsm disabled>State machine (FSM)</button>
        <button type="button" data-open-as-vhdl disabled>VHDL text</button>
        <button type="button" data-open-as-sv disabled>SystemVerilog text</button>
        <button type="button" data-open-as-cancel @click="dismissOpenAs">Cancel</button>
      </div>
    </div>
    <div v-if="preferencesOpen" class="menu-back" data-preferences-dialog @pointerdown.self="preferencesOpen = false">
      <div class="prefs-dialog open-as" role="dialog" aria-label="Editor preferences" @pointerdown.stop>
        <p class="benchgen-title">Editor Preferences</p>
        <p class="hint">Grid &amp; Snapping</p>
        <label class="check">
          <input
            data-prefs-grid-visible
            type="checkbox"
            :checked="prefs.gridVisible"
            @change="commitPrefsFlag('gridVisible', $event)"
          />
          Show grid
        </label>
        <label class="benchgen-field">
          Grid spacing
          <input
            data-prefs-grid-spacing
            type="number"
            min="5"
            max="200"
            step="1"
            :value="prefs.gridSpacing"
            @change="commitSpacingField('gridSpacing', $event)"
          />
        </label>
        <div class="prefs-presets" role="group" aria-label="Grid spacing presets">
          <button
            v-for="preset in SPACING_PRESETS"
            :key="`grid-${preset}`"
            type="button"
            class="prefs-preset"
            :class="{ on: prefs.gridSpacing === preset }"
            :data-prefs-grid-preset="preset"
            @click="patchPrefs({ gridSpacing: preset })"
          >
            {{ preset }}
          </button>
        </div>
        <label class="check">
          <input
            data-prefs-snap-enabled
            type="checkbox"
            :checked="prefs.snapEnabled"
            @change="commitPrefsFlag('snapEnabled', $event)"
          />
          Snap to grid
        </label>
        <label class="benchgen-field">
          Snap spacing
          <input
            data-prefs-snap-spacing
            type="number"
            min="5"
            max="200"
            step="1"
            :value="prefs.snapSpacing"
            @change="commitSpacingField('snapSpacing', $event)"
          />
        </label>
        <div class="prefs-presets" role="group" aria-label="Snap spacing presets">
          <button
            v-for="preset in SPACING_PRESETS"
            :key="`snap-${preset}`"
            type="button"
            class="prefs-preset"
            :class="{ on: prefs.snapSpacing === preset }"
            :data-prefs-snap-preset="preset"
            @click="patchPrefs({ snapSpacing: preset })"
          >
            {{ preset }}
          </button>
        </div>
        <p class="hint" data-prefs-summary>Grid: {{ prefs.gridSpacing }} · Snap: {{ prefs.snapSpacing }}</p>
        <div class="benchgen-actions">
          <button type="button" data-prefs-reset @click="resetPrefsToDefaults">Reset to defaults</button>
          <button type="button" data-prefs-close @click="preferencesOpen = false">Close</button>
        </div>
      </div>
    </div>
    <div v-if="benchGenOpen" class="menu-back" data-benchgen-dialog @pointerdown.self="dismissSyntheticBenchDialog">
      <div class="benchgen-dialog open-as" role="dialog" aria-label="Generate benchmark diagram" @pointerdown.stop>
        <p class="benchgen-title">Σ Generate benchmark diagram</p>
        <label class="benchgen-field">
          Topology
          <select v-model="benchGenTopology" data-benchgen-topology>
            <option value="A">A — Regular</option>
            <option value="B">B — High Connectivity</option>
            <option value="C">C — HDL-derived</option>
          </select>
        </label>
        <label class="benchgen-field">
          Number of blocks
          <select v-model.number="benchGenBlocks" data-benchgen-blocks>
            <option v-for="size in BENCHGEN_SIZES" :key="size" :value="size">{{ size }}</option>
          </select>
        </label>
        <label class="benchgen-field">
          Random seed
          <input v-model.number="benchGenSeed" type="number" min="0" step="1" data-benchgen-seed />
        </label>
        <label class="benchgen-field">
          Symbol geometry
          <select v-model="benchGenGeometry" data-benchgen-geometry>
            <option value="simple">Simple</option>
            <option value="complex">Complex</option>
          </select>
        </label>
        <label class="benchgen-field">
          Wiring
          <select v-model="benchGenWiring" data-benchgen-wiring>
            <option value="stubs">Stubs + name labels (HDL-like)</option>
            <option value="routed">Full routed corridors (stress)</option>
          </select>
        </label>
        <p class="hint" data-benchgen-estimate>
          Blocks {{ benchGenEstimate.blocks }} · ~{{ benchGenEstimate.segments }}
          {{ benchGenWiring === 'stubs' ? 'stubs' : 'segments' }} · ~{{ benchGenEstimate.nets }} nets · ~{{ benchGenEstimate.ports }} ports
          <template v-if="benchGenWiring === 'stubs'"> · no long wires</template>
        </p>
        <div class="benchgen-actions">
          <button type="button" data-benchgen-reset @click="resetSyntheticBenchForm">Reset defaults</button>
          <button type="button" data-benchgen-cancel @click="dismissSyntheticBenchDialog">Cancel</button>
          <button type="button" class="benchgen-generate" data-benchgen-generate @click="generateSyntheticBench">Generate</button>
        </div>
      </div>
    </div>
  </div>
</template>
