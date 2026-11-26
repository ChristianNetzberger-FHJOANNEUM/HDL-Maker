/**
 * D5d.0-A — Deterministic synthetic benchmark document generator.
 * Canonical Diagram-Lab documents only. No HDL, no Studio, no Vue.
 *
 * Recipe version is embedded in every document's extensions.benchgen.
 * d5d0a-5: stub mode uses wider pitch + compact net labels for readable sheets.
 */

import { sha256Sync } from './assets'
import { emptyDocument } from './edit'
import { portAnchor } from './geometry'
import {
  serialize,
  type DiagramDocument,
  type Endpoint,
  type Point,
  type PortSide,
  type SymbolShape,
} from './document'

export const BENCHGEN_RECIPE_VERSION = 'd5d0a-5' as const
const TRACK_PITCH = 12
const CHANNEL_PAD = 20

export const BENCHGEN_SIZES = [50, 100, 250, 500, 1000] as const
export type BenchGenSize = (typeof BENCHGEN_SIZES)[number]

export type BenchTopology = 'A' | 'B' | 'C'
export type BenchGeometry = 'simple' | 'complex'
/** `stubs` = HDL Designer style (short named stubs only). `routed` = full corridor polylines. */
export type BenchWiring = 'stubs' | 'routed'

export type BenchGenConfig = {
  blocks: BenchGenSize
  topology: BenchTopology
  /** Default 1. Same seed + config ⇒ identical document. */
  seed?: number
  /** Default `simple`. */
  geometry?: BenchGeometry
  /** Default `stubs` (readable HDL-like sheets). Use `routed` for dense wire-stress benches. */
  wiring?: BenchWiring
}

export type BenchGenTargets = {
  segmentsPerBlock: number
  netsPerBlock: number
  portsPerBlock: number
  labelCoverage: number
  junctionsPerBlock: number
  stubsPerBlock: number
}

export type BenchGenCounts = {
  blocks: number
  ports: number
  nets: number
  segments: number
  junctions: number
  labels: number
  stubs: number
  symbols: number
  segmentsPerBlock: number
  netsPerBlock: number
  portsPerBlock: number
}

export type BenchGenResult = {
  doc: DiagramDocument
  hash: string
  config: Required<BenchGenConfig>
  recipeVersion: typeof BENCHGEN_RECIPE_VERSION
  targets: BenchGenTargets
  actual: BenchGenCounts
  notes: string[]
}

export type BenchGenEstimate = {
  blocks: number
  ports: number
  nets: number
  segments: number
  junctions: number
  stubs: number
}

type TopologyRecipe = BenchGenTargets & {
  blockWidth: number
  blockHeight: number
  leftPins: number
  rightPins: number
  /** Extra CSS-px between block boxes (routing corridors). */
  gapX: number
  gapY: number
}

const RECIPES: Record<BenchTopology, TopologyRecipe> = {
  A: {
    segmentsPerBlock: 7,
    netsPerBlock: 0.8,
    portsPerBlock: 10,
    labelCoverage: 1,
    junctionsPerBlock: 0.05,
    stubsPerBlock: 0.1,
    blockWidth: 72,
    blockHeight: 56,
    leftPins: 5,
    rightPins: 5,
    gapX: 140,
    gapY: 110,
  },
  B: {
    segmentsPerBlock: 22.5,
    netsPerBlock: 2,
    portsPerBlock: 24,
    labelCoverage: 1,
    junctionsPerBlock: 0.35,
    stubsPerBlock: 3,
    blockWidth: 96,
    blockHeight: 120,
    leftPins: 12,
    rightPins: 12,
    gapX: 110,
    gapY: 90,
  },
  C: {
    segmentsPerBlock: 15,
    netsPerBlock: 8.5,
    portsPerBlock: 15,
    labelCoverage: 1,
    junctionsPerBlock: 0.1,
    stubsPerBlock: 6,
    blockWidth: 80,
    blockHeight: 72,
    leftPins: 7,
    rightPins: 8,
    gapX: 130,
    gapY: 100,
  },
}

/** Normalize and fill defaults. */
export function normalizeBenchGenConfig(input: BenchGenConfig): Required<BenchGenConfig> {
  if (!BENCHGEN_SIZES.includes(input.blocks)) {
    throw new Error(`Unsupported block count ${input.blocks}. Use ${BENCHGEN_SIZES.join(', ')}.`)
  }
  if (input.topology !== 'A' && input.topology !== 'B' && input.topology !== 'C') {
    throw new Error(`Unsupported topology ${String(input.topology)}.`)
  }
  const seed = input.seed ?? 1
  if (!Number.isInteger(seed) || seed < 0) throw new Error('seed must be a non-negative integer.')
  const geometry = input.geometry ?? 'simple'
  if (geometry !== 'simple' && geometry !== 'complex') throw new Error(`Unsupported geometry ${String(geometry)}.`)
  const wiring = input.wiring ?? 'stubs'
  if (wiring !== 'stubs' && wiring !== 'routed') throw new Error(`Unsupported wiring ${String(wiring)}.`)
  return { blocks: input.blocks, topology: input.topology, seed, geometry, wiring }
}

export function topologyTargets(topology: BenchTopology): BenchGenTargets {
  const recipe = RECIPES[topology]
  return {
    segmentsPerBlock: recipe.segmentsPerBlock,
    netsPerBlock: recipe.netsPerBlock,
    portsPerBlock: recipe.portsPerBlock,
    labelCoverage: recipe.labelCoverage,
    junctionsPerBlock: recipe.junctionsPerBlock,
    stubsPerBlock: recipe.stubsPerBlock,
  }
}

/** Fast estimate for the Σ dialog (targets × size, not a full generate). */
export function estimateBenchCounts(input: BenchGenConfig): BenchGenEstimate {
  const config = normalizeBenchGenConfig(input)
  const recipe = RECIPES[config.topology]
  const n = config.blocks
  const ports = n * (recipe.leftPins + recipe.rightPins)
  const nets = Math.max(1, Math.round(recipe.netsPerBlock * n))
  if (config.wiring === 'stubs') {
    // One short stub per connected port — far fewer drawn polylines than routed mode.
    const linked = Math.min(ports, Math.round(recipe.segmentsPerBlock * n * 1.4))
    return { blocks: n, ports, nets, segments: linked, junctions: 0, stubs: linked }
  }
  return {
    blocks: n,
    ports,
    nets,
    segments: Math.round(recipe.segmentsPerBlock * n),
    junctions: Math.max(0, Math.round(recipe.junctionsPerBlock * n)),
    stubs: Math.max(0, Math.round(recipe.stubsPerBlock * n)),
  }
}

/**
 * Orthogonal polyline. Aligned ends → 2 points; otherwise HVH or VHV (4 points).
 * No diagonal legs.
 */
export function orthogonalPoints(start: Point, end: Point, bias: 'hvh' | 'vhv' = 'hvh'): Point[] {
  const sx = Math.round(start.x)
  const sy = Math.round(start.y)
  const ex = Math.round(end.x)
  const ey = Math.round(end.y)
  if (sx === ex && sy === ey) return [{ x: sx, y: sy }, { x: ex, y: ey }]
  if (sx === ex || sy === ey) return [{ x: sx, y: sy }, { x: ex, y: ey }]
  if (bias === 'vhv') {
    const my = Math.round((sy + ey) / 2)
    return [
      { x: sx, y: sy },
      { x: sx, y: my },
      { x: ex, y: my },
      { x: ex, y: ey },
    ]
  }
  const mx = Math.round((sx + ex) / 2)
  return [
    { x: sx, y: sy },
    { x: mx, y: sy },
    { x: mx, y: ey },
    { x: ex, y: ey },
  ]
}

export function segmentIsOrthogonal(points: Point[]): boolean {
  if (points.length < 2) return false
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!
    const b = points[index]!
    if (a.x !== b.x && a.y !== b.y) return false
  }
  return true
}

/**
 * Orthogonal route on an exclusive horizontal track (below/between rows).
 * start → exitX/start.y → exitX/trackY → entryX/trackY → entryX/end.y → end
 */
export function channelRouteHorizontal(start: Point, end: Point, trackY: number, exitX: number, entryX: number): Point[] {
  return dedupePoints([
    { x: Math.round(start.x), y: Math.round(start.y) },
    { x: Math.round(exitX), y: Math.round(start.y) },
    { x: Math.round(exitX), y: Math.round(trackY) },
    { x: Math.round(entryX), y: Math.round(trackY) },
    { x: Math.round(entryX), y: Math.round(end.y) },
    { x: Math.round(end.x), y: Math.round(end.y) },
  ])
}

/** Orthogonal route on an exclusive vertical track (between columns). */
export function channelRouteVertical(start: Point, end: Point, trackX: number): Point[] {
  return dedupePoints([
    { x: Math.round(start.x), y: Math.round(start.y) },
    { x: Math.round(trackX), y: Math.round(start.y) },
    { x: Math.round(trackX), y: Math.round(end.y) },
    { x: Math.round(end.x), y: Math.round(end.y) },
  ])
}

function dedupePoints(points: Point[]): Point[] {
  const out: Point[] = []
  for (const point of points) {
    const last = out[out.length - 1]
    if (last && last.x === point.x && last.y === point.y) continue
    out.push(point)
  }
  return out.length >= 2 ? out : points
}

/** Build one synthetic benchmark document. */
export function generateBenchDocument(input: BenchGenConfig): BenchGenResult {
  const config = normalizeBenchGenConfig(input)
  const recipe = RECIPES[config.topology]
  const stubMode = config.wiring === 'stubs'
  const notes: string[] = [
    stubMode
      ? `recipe ${BENCHGEN_RECIPE_VERSION}: HDL-like named stubs (by-name, no long routes)`
      : `recipe ${BENCHGEN_RECIPE_VERSION}: exclusive corridor tracks`,
  ]
  const rng = mulberry32(hashSeed(config.topology, config.blocks, config.seed, config.geometry, config.wiring))

  const n = config.blocks
  const segmentTarget = Math.round(recipe.segmentsPerBlock * n)
  const netTarget = Math.max(1, Math.round(recipe.netsPerBlock * n))
  const junctionTarget = stubMode ? 0 : Math.max(0, Math.round(recipe.junctionsPerBlock * n))
  const stubTarget = stubMode
    ? 0
    : Math.min(segmentTarget, Math.max(0, Math.round(recipe.stubsPerBlock * n)))
  const portPortSegments = stubMode ? segmentTarget : Math.max(0, segmentTarget - stubTarget)

  const doc = emptyDocument()
  doc.id = `doc_benchgen_${config.topology}_${n}_${config.seed}_${config.geometry}_${config.wiring}`

  const pinLeft = recipe.leftPins
  const pinRight = recipe.rightPins
  const portsPerBlock = pinLeft + pinRight
  if (portsPerBlock !== recipe.portsPerBlock) {
    notes.push(`portsPerBlock adjusted to ${portsPerBlock} from left/right pin split.`)
  }

  // Topology C: three size variants; A/B: one shared cell.
  const symbolSpecs =
    config.topology === 'C'
      ? [
          { id: 'sym_bench_C_sm', name: 'BenchCell_C_sm', width: 64, height: 56 },
          { id: 'sym_bench_C_md', name: 'BenchCell_C_md', width: recipe.blockWidth, height: recipe.blockHeight },
          { id: 'sym_bench_C_lg', name: 'BenchCell_C_lg', width: 104, height: 96 },
        ]
      : [{ id: `sym_bench_${config.topology}_${config.geometry}`, name: `BenchCell_${config.topology}_${config.geometry}`, width: recipe.blockWidth, height: recipe.blockHeight }]

  for (const spec of symbolSpecs) {
    const shapes = symbolShapes(config.geometry, spec.width, spec.height)
    const symbolPorts: Array<{ id: string; name: string; side: PortSide; t: number }> = []
    for (let index = 0; index < pinLeft; index += 1) {
      symbolPorts.push({
        id: `pin_L${index}`,
        name: `L${index}`,
        side: 'left',
        t: (index + 1) / (pinLeft + 1),
      })
    }
    for (let index = 0; index < pinRight; index += 1) {
      symbolPorts.push({
        id: `pin_R${index}`,
        name: `R${index}`,
        side: 'right',
        t: (index + 1) / (pinRight + 1),
      })
    }
    doc.symbols.push({
      id: spec.id,
      name: spec.name,
      width: spec.width,
      height: spec.height,
      ports: symbolPorts,
      shapes,
      labels: [],
      revision: 1,
    })
  }

  const columns = Math.max(1, Math.ceil(Math.sqrt(n)))
  const rows = Math.max(1, Math.ceil(n / columns))
  // Routed mode reserves exclusive corridor tracks; stub mode uses compact HDL-like pitch.
  const tracksPerRowBand = stubMode ? 0 : Math.max(8, Math.ceil(portPortSegments / Math.max(1, rows)) + 4)
  const bandHeight = stubMode ? 0 : CHANNEL_PAD + tracksPerRowBand * TRACK_PITCH + CHANNEL_PAD
  const tracksPerColBand = stubMode ? 0 : Math.max(4, Math.ceil(portPortSegments / Math.max(1, columns)) + 2)
  const bandWidth = stubMode ? 0 : CHANNEL_PAD + tracksPerColBand * TRACK_PITCH + CHANNEL_PAD
  // Stub sheets need room for left stub + label and right stub + label between neighbours.
  const stubGapX = Math.max(200, Math.round(recipe.gapX * 1.55))
  const stubGapY = Math.max(96, Math.round(recipe.gapY * 0.95))
  const pitchX = recipe.blockWidth + (stubMode ? stubGapX : Math.max(recipe.gapX, bandWidth))
  const pitchY = recipe.blockHeight + (stubMode ? stubGapY : Math.max(recipe.gapY, bandHeight))
  notes.push(
    stubMode
      ? `layout pitch ${pitchX}×${pitchY} (stub gap ${stubGapX}×${stubGapY})`
      : `layout pitch ${pitchX}×${pitchY} (≈${tracksPerRowBand} H-tracks/row, ≈${tracksPerColBand} V-tracks/col)`,
  )

  const blockIds: string[] = []
  const rightPortIds: string[][] = []
  const leftPortIds: string[][] = []
  const blockCol: number[] = []
  const blockRow: number[] = []

  for (let index = 0; index < n; index += 1) {
    const column = index % columns
    const row = Math.floor(index / columns)
    blockCol.push(column)
    blockRow.push(row)
    const symbol = doc.symbols[config.topology === 'C' ? index % doc.symbols.length : 0]!
    const blockId = `blk_${index}`
    blockIds.push(blockId)
    doc.blocks.push({
      id: blockId,
      name: `U${index + 1}`,
      x: 40 + column * pitchX,
      y: 40 + row * pitchY,
      width: symbol.width,
      height: symbol.height,
      symbolId: symbol.id,
    })
    const leftIds: string[] = []
    const rightIds: string[] = []
    for (let pin = 0; pin < pinLeft; pin += 1) {
      const portId = `prt_${index}_L${pin}`
      leftIds.push(portId)
      doc.ports.push({
        id: portId,
        blockId,
        name: `L${pin}`,
        side: 'left',
        symbolPortId: `pin_L${pin}`,
        t: (pin + 1) / (pinLeft + 1),
      })
    }
    for (let pin = 0; pin < pinRight; pin += 1) {
      const portId = `prt_${index}_R${pin}`
      rightIds.push(portId)
      doc.ports.push({
        id: portId,
        blockId,
        name: `R${pin}`,
        side: 'right',
        symbolPortId: `pin_R${pin}`,
        t: (pin + 1) / (pinRight + 1),
      })
    }
    leftPortIds.push(leftIds)
    rightPortIds.push(rightIds)
  }

  for (let index = 0; index < netTarget; index += 1) {
    doc.nets.push({ id: `net_${index}`, name: `n${index}` })
  }

  let segmentIndex = 0

  if (stubMode) {
    // Logical connectivity → one short named stub per connected port (HDL Designer style).
    const portNet = new Map<string, string>()
    for (let index = 0; index < portPortSegments; index += 1) {
      const fromBlock = pickSourceBlock(config.topology, index, n, columns)
      const toBlock = pickTargetBlock(config.topology, fromBlock, index, n, columns, rng)
      if (fromBlock === toBlock) continue
      const fromPort = rightPortIds[fromBlock]![index % pinRight]!
      const toPort = leftPortIds[toBlock]![index % pinLeft]!
      const netId = `net_${index % netTarget}`
      if (!portNet.has(fromPort)) portNet.set(fromPort, netId)
      if (!portNet.has(toPort)) portNet.set(toPort, netId)
    }
    const portSide = new Map(doc.ports.map((port) => [port.id, port.side] as const))
    for (const [portId, netId] of portNet) {
      const start = portAnchor(doc, portId)
      if (!start) continue
      const side = portSide.get(portId) ?? 'left'
      // Keep stubs short vs. the widened gap so opposing labels do not meet in the middle.
      const stubLen = config.topology === 'C' ? 28 + (segmentIndex % 4) * 2 : 32 + (segmentIndex % 3) * 2
      const free: Point =
        side === 'right'
          ? { x: Math.round(start.x + stubLen), y: Math.round(start.y) }
          : { x: Math.round(start.x - stubLen), y: Math.round(start.y) }
      pushSegment(doc, `seg_${segmentIndex}`, netId, orthogonalPoints(start, free, 'hvh'), {
        start: { kind: 'port', portId },
        end: { kind: 'free', x: free.x, y: free.y },
        routed: 'manual',
      })
      segmentIndex += 1
    }
    notes.push(`stub wiring: ${portNet.size} named stubs, 0 junctions, ${netTarget} nets`)
  } else {
    const hTrackNext = new Map<string, number>()
    const vTrackNext = new Map<string, number>()
    const allocTrack = (map: Map<string, number>, key: string, limit: number) => {
      const used = map.get(key) ?? 0
      map.set(key, used + 1)
      return used % limit
    }

    // Junctions on exclusive tracks under their host row (not on block faces).
    for (let index = 0; index < junctionTarget; index += 1) {
      const netId = `net_${index % netTarget}`
      const host = index % n
      const col = blockCol[host]!
      const row = blockRow[host]!
      const block = doc.blocks[host]!
      const track = allocTrack(hTrackNext, `jnc-row-${row}`, tracksPerRowBand)
      const trackY = 40 + row * pitchY + recipe.blockHeight + CHANNEL_PAD + track * TRACK_PITCH
      const channelX = block.x + block.width + CHANNEL_PAD + (col % Math.max(1, tracksPerColBand)) * TRACK_PITCH
      doc.junctions.push({
        id: `jnc_${index}`,
        netId,
        x: channelX,
        y: trackY,
      })
    }

    for (let index = 0; index < portPortSegments; index += 1) {
      const fromBlock = pickSourceBlock(config.topology, index, n, columns)
      const toBlock = pickTargetBlock(config.topology, fromBlock, index, n, columns, rng)
      if (fromBlock === toBlock) continue
      const fromPort = rightPortIds[fromBlock]![index % pinRight]!
      const toPort = leftPortIds[toBlock]![index % pinLeft]!
      const netId = `net_${index % netTarget}`
      const start = portAnchor(doc, fromPort)
      const end = portAnchor(doc, toPort)
      if (!start || !end) continue

      const from = doc.blocks[fromBlock]!
      const to = doc.blocks[toBlock]!
      const rowA = blockRow[fromBlock]!
      const rowB = blockRow[toBlock]!
      const colA = blockCol[fromBlock]!
      const colB = blockCol[toBlock]!

      const junctionCandidates = doc.junctions.filter((item) => item.netId === netId)
      const useJunction = junctionCandidates.length > 0 && config.topology === 'B' && index % 5 === 0

      let points: Point[]
      if (useJunction) {
        const junction = junctionCandidates[index % junctionCandidates.length]!
        points = channelRouteHorizontal(
          start,
          { x: junction.x, y: junction.y },
          junction.y,
          from.x + from.width + CHANNEL_PAD,
          junction.x,
        )
        pushSegment(doc, `seg_${segmentIndex}`, netId, points, {
          start: { kind: 'port', portId: fromPort },
          end: { kind: 'junction', junctionId: junction.id },
          routed: 'manual',
        })
      } else if (colA === colB) {
        const bandKey = `vcol-${colA}`
        const track = allocTrack(vTrackNext, bandKey, tracksPerColBand)
        const trackX = from.x + from.width + CHANNEL_PAD + track * TRACK_PITCH
        points = channelRouteVertical(start, end, trackX)
        pushSegment(doc, `seg_${segmentIndex}`, netId, points, {
          start: { kind: 'port', portId: fromPort },
          end: { kind: 'port', portId: toPort },
          routed: index % 11 === 0 ? 'auto' : 'manual',
        })
      } else {
        const bandRow = Math.min(rowA, rowB)
        const bandKey = `hrow-${bandRow}`
        const track = allocTrack(hTrackNext, bandKey, tracksPerRowBand)
        const trackY = 40 + bandRow * pitchY + recipe.blockHeight + CHANNEL_PAD + track * TRACK_PITCH
        const exitX = from.x <= to.x ? from.x + from.width + CHANNEL_PAD : from.x - CHANNEL_PAD
        const entryX = from.x <= to.x ? to.x - CHANNEL_PAD : to.x + to.width + CHANNEL_PAD
        points = channelRouteHorizontal(start, end, trackY, exitX, entryX)
        pushSegment(doc, `seg_${segmentIndex}`, netId, points, {
          start: { kind: 'port', portId: fromPort },
          end: { kind: 'port', portId: toPort },
          routed: index % 11 === 0 ? 'auto' : 'manual',
        })
      }
      segmentIndex += 1
    }

    // Named stubs: short leftward runs at the port Y (unique ports → no stack).
    for (let index = 0; index < stubTarget; index += 1) {
      const block = index % n
      const portId = leftPortIds[block]![index % pinLeft]!
      const netId = `net_${index % netTarget}`
      const start = portAnchor(doc, portId)
      if (!start) continue
      const stubLen = config.topology === 'C' ? 24 + (index % 5) * 4 : 32 + (index % 4) * 6
      const free: Point = { x: Math.round(start.x - stubLen), y: Math.round(start.y) }
      pushSegment(doc, `seg_${segmentIndex}`, netId, orthogonalPoints(start, free, 'hvh'), {
        start: { kind: 'port', portId },
        end: { kind: 'free', x: free.x, y: free.y },
        routed: 'manual',
      })
      segmentIndex += 1
    }
  }

  for (const segment of doc.segments) {
    const net = doc.nets.find((item) => item.id === segment.netId)
    if (!net) continue
    // Prefer labelling the long horizontal track edge when present (usually edge 2); stubs use edge 0 mid-stub.
    const edge = stubMode ? 0 : segment.points.length >= 4 ? 2 : 0
    const nudge = (Number(segment.id.replace(/\D/g, '')) || 0) % 7
    const stubSpan =
      stubMode && segment.points.length >= 2
        ? Math.hypot(segment.points[1]!.x - segment.points[0]!.x, segment.points[1]!.y - segment.points[0]!.y)
        : 0
    doc.labels.push({
      id: `lbl_${segment.id}`,
      text: net.name,
      role: 'name',
      ...(stubMode ? { fontSize: 9 } : {}),
      anchor: {
        kind: 'segment',
        segmentId: segment.id,
        edge,
        distance: stubMode ? Math.max(10, Math.round(stubSpan * 0.55)) : 8 + nudge * 4,
        offset: stubMode ? 4 : 10,
      },
    })
  }

  const actual = measureCounts(doc)
  const targets = stubMode
    ? {
        segmentsPerBlock: actual.segmentsPerBlock,
        netsPerBlock: recipe.netsPerBlock,
        portsPerBlock: recipe.portsPerBlock,
        labelCoverage: 1,
        junctionsPerBlock: 0,
        stubsPerBlock: actual.stubs / Math.max(1, n),
      }
    : topologyTargets(config.topology)
  doc.extensions = {
    ...doc.extensions,
    benchgen: {
      recipeVersion: BENCHGEN_RECIPE_VERSION,
      config,
      targets,
      actual,
    },
  }
  const stampedHash = documentHash(doc)
  ;(doc.extensions.benchgen as { hash?: string }).hash = stampedHash

  return {
    doc,
    hash: stampedHash,
    config,
    recipeVersion: BENCHGEN_RECIPE_VERSION,
    targets,
    actual: measureCounts(doc),
    notes,
  }
}

/** Content hash. The optional `extensions.benchgen.hash` field is excluded so stamping is stable. */
export function documentHash(doc: DiagramDocument): string {
  const raw = JSON.parse(serialize(doc)) as Record<string, unknown>
  const extensions = raw.extensions
  if (extensions && typeof extensions === 'object' && !Array.isArray(extensions)) {
    const bench = (extensions as Record<string, unknown>).benchgen
    if (bench && typeof bench === 'object' && !Array.isArray(bench)) {
      const copy = { ...(bench as Record<string, unknown>) }
      delete copy.hash
      ;(extensions as Record<string, unknown>).benchgen = copy
    }
  }
  return sha256Sync(new TextEncoder().encode(JSON.stringify(raw)))
}

export function measureCounts(doc: DiagramDocument): BenchGenCounts {
  const stubs = doc.segments.filter((segment) => segment.start.kind === 'free' || segment.end.kind === 'free').length
  const blocks = doc.blocks.length || 1
  return {
    blocks: doc.blocks.length,
    ports: doc.ports.length,
    nets: doc.nets.length,
    segments: doc.segments.length,
    junctions: doc.junctions.length,
    labels: doc.labels.length,
    stubs,
    symbols: doc.symbols.length,
    segmentsPerBlock: doc.segments.length / blocks,
    netsPerBlock: doc.nets.length / blocks,
    portsPerBlock: doc.ports.length / blocks,
  }
}

export type BenchGenValidation = { ok: true } | { ok: false; errors: string[] }

/** Structural checks for generated (or any) documents used as benches. */
export function validateBenchDocument(doc: DiagramDocument): BenchGenValidation {
  const errors: string[] = []
  const blockIds = new Set(doc.blocks.map((item) => item.id))
  const portIds = new Set(doc.ports.map((item) => item.id))
  const netIds = new Set(doc.nets.map((item) => item.id))
  const junctionIds = new Set(doc.junctions.map((item) => item.id))
  const segmentIds = new Set(doc.segments.map((item) => item.id))
  const symbolIds = new Set(doc.symbols.map((item) => item.id))

  const names = new Map<string, string>()
  for (const net of doc.nets) {
    const key = net.name.trim().toLowerCase()
    if (names.has(key)) errors.push(`Duplicate net name "${net.name}" (${names.get(key)} / ${net.id}).`)
    else names.set(key, net.id)
  }

  for (const port of doc.ports) {
    if (!blockIds.has(port.blockId)) errors.push(`Port ${port.id} references missing block ${port.blockId}.`)
  }
  for (const block of doc.blocks) {
    if (block.symbolId && !symbolIds.has(block.symbolId)) {
      errors.push(`Block ${block.id} references missing symbol ${block.symbolId}.`)
    }
  }
  for (const junction of doc.junctions) {
    if (!netIds.has(junction.netId)) errors.push(`Junction ${junction.id} references missing net ${junction.netId}.`)
  }
  for (const segment of doc.segments) {
    if (!netIds.has(segment.netId)) errors.push(`Segment ${segment.id} references missing net ${segment.netId}.`)
    if (segment.points.length < 2) errors.push(`Segment ${segment.id} has fewer than two points.`)
    if (!segmentIsOrthogonal(segment.points)) errors.push(`Segment ${segment.id} is not orthogonal.`)
    checkEnd(segment.start, `segment ${segment.id} start`, portIds, junctionIds, errors)
    checkEnd(segment.end, `segment ${segment.id} end`, portIds, junctionIds, errors)
  }
  for (const label of doc.labels) {
    if (label.anchor.kind === 'segment' && !segmentIds.has(label.anchor.segmentId)) {
      errors.push(`Label ${label.id} references missing segment ${label.anchor.segmentId}.`)
    }
  }

  const seen = new Set<string>()
  for (const collection of [doc.blocks, doc.ports, doc.nets, doc.segments, doc.junctions, doc.labels, doc.symbols]) {
    for (const item of collection) {
      if (seen.has(item.id)) errors.push(`Duplicate id ${item.id}.`)
      seen.add(item.id)
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}

export function densityWithinTolerance(
  actual: BenchGenCounts,
  targets: BenchGenTargets,
  tolerance = 0.25,
): { ok: boolean; deltas: Record<string, number> } {
  const deltas = {
    segmentsPerBlock: relativeDelta(actual.segmentsPerBlock, targets.segmentsPerBlock),
    netsPerBlock: relativeDelta(actual.netsPerBlock, targets.netsPerBlock),
    portsPerBlock: relativeDelta(actual.portsPerBlock, targets.portsPerBlock),
  }
  const ok = Object.values(deltas).every((value) => Math.abs(value) <= tolerance)
  return { ok, deltas }
}

/** Inventory all 15 size × topology pairs for a fixed seed/geometry. */
export function inventoryBenchMatrix(seed = 1, geometry: BenchGeometry = 'simple'): BenchGenResult[] {
  const rows: BenchGenResult[] = []
  for (const topology of ['A', 'B', 'C'] as const) {
    for (const blocks of BENCHGEN_SIZES) {
      rows.push(generateBenchDocument({ topology, blocks, seed, geometry }))
    }
  }
  return rows
}

function pickSourceBlock(topology: BenchTopology, index: number, n: number, _columns: number): number {
  void topology
  return index % n
}

function pickTargetBlock(
  topology: BenchTopology,
  fromBlock: number,
  index: number,
  n: number,
  columns: number,
  rng: () => number,
): number {
  if (topology === 'A') {
    // Mostly immediate neighbours (east, then south).
    const east = fromBlock + 1
    if (Math.floor(east / columns) === Math.floor(fromBlock / columns) && east < n) return east
    const south = fromBlock + columns
    if (south < n) return south
    return (fromBlock + 1) % n
  }
  if (topology === 'C') {
    // Short local hops — HDL-like.
    const span = 1 + (index % 2)
    return (fromBlock + span) % n
  }
  // B — local and longer reaches.
  const maxSpan = Math.min(columns + 2, n - 1)
  const span = 1 + Math.floor(rng() * maxSpan)
  return (fromBlock + span) % n
}

function checkEnd(
  end: Endpoint,
  label: string,
  portIds: Set<string>,
  junctionIds: Set<string>,
  errors: string[],
): void {
  if (end.kind === 'port' && !portIds.has(end.portId)) errors.push(`${label} missing port ${end.portId}.`)
  if (end.kind === 'junction' && !junctionIds.has(end.junctionId)) {
    errors.push(`${label} missing junction ${end.junctionId}.`)
  }
}

function relativeDelta(actual: number, target: number): number {
  if (target === 0) return actual === 0 ? 0 : 1
  return (actual - target) / target
}

function pushSegment(
  doc: DiagramDocument,
  id: string,
  netId: string,
  points: Point[],
  ends: {
    start: Endpoint
    end: Endpoint
    routed: 'manual' | 'auto'
  },
): void {
  doc.segments.push({
    id,
    netId,
    routed: ends.routed,
    points: points.map((point) => ({ ...point })),
    start: ends.start,
    end: ends.end,
  })
}

function symbolShapes(geometry: BenchGeometry, width: number, height: number): SymbolShape[] {
  if (geometry === 'simple') {
    return [{ kind: 'rect', x: 4, y: 4, width: width - 8, height: height - 8, rx: 2 }]
  }
  return [
    { kind: 'rect', x: 4, y: 4, width: width - 8, height: height - 8, rx: 4 },
    { kind: 'ellipse', x: 12, y: 10, width: width - 24, height: Math.max(16, height / 3) },
    { kind: 'line', x1: 10, y1: height - 14, x2: width - 10, y2: height - 14 },
    { kind: 'text', x: 14, y: height / 2 + 4, text: 'cell' },
  ]
}

function hashSeed(
  topology: BenchTopology,
  blocks: number,
  seed: number,
  geometry: BenchGeometry,
  wiring: BenchWiring,
): number {
  let value = seed >>> 0
  value =
    (value * 1664525 +
      topology.charCodeAt(0) * 101 +
      blocks +
      geometry.length * 17 +
      wiring.charCodeAt(0) * 31 +
      3) >>>
    0
  return value || 1
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let next = state
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}
