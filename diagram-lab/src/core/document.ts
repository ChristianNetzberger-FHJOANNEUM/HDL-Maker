/** Generic diagram document. No HDL, no Vue, no DOM. */

export const SCHEMA_VERSION = 1 as const

export type Point = { x: number; y: number }

/** A corner the automatic router must keep. Absent means the point may move. */
export type Waypoint = Point & { fixed?: boolean }

export type Block = {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  /** Set when this block is an instance of a symbol. */
  symbolId?: string
  /** Id of a ComponentDefinition, when this block is an instance of one. A sheet may store it without a project. */
  componentId?: string
  parameters?: Record<string, string>
}

export type PortSide = 'left' | 'right' | 'top' | 'bottom'

export type Port = {
  id: string
  blockId: string
  name: string
  side: PortSide
  /** The pin on the symbol definition. Wires cite `id`, which stays when the symbol changes. */
  symbolPortId?: string
  /** Logical component port. No coordinates. Set only by an explicit id binding. */
  interfacePortId?: string
  /**
   * Last fraction along the side. Left and right run from top to bottom.
   * Top and bottom run from left to right. Used when the definition pin is gone.
   */
  t?: number
  /** Fractions inside the symbol when the pin is free. Absent on a side pin. */
  x?: number
  y?: number
}

/** A drawing primitive owned by a symbol. Coordinates are inside the symbol, not on the sheet. */
export type SymbolShape =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx?: number }
  | { kind: 'ellipse'; x: number; y: number; width: number; height: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'polygon'; points: Point[] }
  | { kind: 'text'; x: number; y: number; text: string }
  | { kind: 'image'; assetId: string; x: number; y: number; width: number; height: number; lockAspect?: boolean }

export type SymbolPort = {
  id: string
  name: string
  side: PortSide
  /**
   * Fraction along the side, from 0 to 1.
   * Left and right: top to bottom. Top and bottom: left to right.
   */
  t: number
  /** Fractions of the symbol width and height. Set only for a free pin. */
  x?: number
  y?: number
}

export type ImageMime = 'image/svg+xml' | 'image/png' | 'image/jpeg' | 'image/webp'

/** One embedded picture. Several shapes may cite the same id. */
export type ImageAsset = {
  id: string
  name: string
  mime: ImageMime
  /** Base64 of the file bytes. Not a URL and not a file path. */
  data: string
  width: number | null
  height: number | null
  checksum: string
  origin?: string
  license?: string
}

export type SymbolLabel = {
  id: string
  text: string
  x: number
  y: number
}

/** Shared picture and pins. It has no position on the sheet. */
export type SymbolDefinition = {
  id: string
  name: string
  width: number
  height: number
  ports: SymbolPort[]
  shapes: SymbolShape[]
  labels: SymbolLabel[]
  /** Set when the definition was copied from a library. Later library edits do not follow this copy. */
  libraryId?: string
  libraryVersion?: number
  categoryId?: string
  /** Revision of this stored definition. Missing on older documents. It does not decide equality. */
  revision?: number
  /** Content fingerprint recorded at the last explicit stamp. A comparison still reads the picture and the pins. */
  bodyChecksum?: string
}

/** Electrical identity. Coordinates do not belong here. */
export type Net = {
  id: string
  name: string
  signal?: Record<string, unknown>
}

export type Endpoint =
  | { kind: 'port'; portId: string }
  | { kind: 'free'; x: number; y: number }
  | { kind: 'junction'; junctionId: string }

/** A branch point. It belongs to one net and has a position. The net does not. */
export type Junction = {
  id: string
  netId: string
  x: number
  y: number
}

/** One drawn polyline. Several segments may share a net. */
export type Segment = {
  id: string
  netId: string
  points: Waypoint[]
  start: Endpoint
  end: Endpoint
  /** manual is kept as drawn. auto may be replaced by the local router. */
  routed: 'manual' | 'auto'
}

export type LabelAnchor =
  | { kind: 'segment'; segmentId: string; edge: number; distance: number; offset: number }
  | { kind: 'free'; x: number; y: number }

export type Label = {
  id: string
  text: string
  /**
   * name: the drawing shows the net name. note: the drawing shows `text`.
   * A missing role on a segment anchor is a name label, so older files keep their meaning.
   */
  role?: 'name' | 'note'
  anchor: LabelAnchor
}

export type Stroke = {
  id: string
  points: Array<Point & { pressure: number }>
  color: string
  size: number
}

/** A group is a set of block ids. It has no geometry of its own. */
export type BlockGroup = {
  id: string
  name: string
  blockIds: string[]
}

export type DiagramDocument = {
  schemaVersion: typeof SCHEMA_VERSION
  id: string
  blocks: Block[]
  symbols: SymbolDefinition[]
  assets: ImageAsset[]
  ports: Port[]
  nets: Net[]
  junctions: Junction[]
  segments: Segment[]
  labels: Label[]
  strokes: Stroke[]
  groups: BlockGroup[]
  extensions: Record<string, unknown>
  /** Unknown top-level fields, preserved across save and load. */
  extra: Record<string, unknown>
}

const KNOWN_KEYS = new Set([
  'schemaVersion',
  'id',
  'blocks',
  'symbols',
  'assets',
  'ports',
  'nets',
  'junctions',
  'segments',
  'labels',
  'strokes',
  'groups',
  'extensions',
])

export function createId(prefix: string): string {
  const bytes = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return `${prefix}_${bytes}`
}

export function serialize(doc: DiagramDocument): string {
  const body: Record<string, unknown> = {
    schemaVersion: doc.schemaVersion,
    id: doc.id,
    blocks: doc.blocks,
    symbols: doc.symbols,
    assets: doc.assets,
    ports: doc.ports,
    nets: doc.nets,
    junctions: doc.junctions,
    segments: doc.segments,
    labels: doc.labels,
    strokes: doc.strokes,
    groups: doc.groups,
    extensions: doc.extensions,
    ...doc.extra,
  }
  return JSON.stringify(body)
}

export function parseDocument(text: string): DiagramDocument {
  const raw = JSON.parse(text) as Record<string, unknown>
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    throw new Error('Unsupported diagram schema.')
  }
  if (typeof raw.id !== 'string') throw new Error('Diagram id is missing.')
  const extensions = isRecord(raw.extensions) ? { ...raw.extensions } : {}
  const extra: Record<string, unknown> = {}
  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) extra[key] = raw[key]
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    id: raw.id,
    blocks: asArray<Block>(raw.blocks),
    symbols: asArray<SymbolDefinition>(raw.symbols),
    assets: asArray<ImageAsset>(raw.assets),
    ports: asArray<Port>(raw.ports),
    nets: asArray<Net>(raw.nets),
    junctions: asArray<Junction>(raw.junctions),
    segments: asArray<Segment>(raw.segments).map(normalizeSegment),
    labels: asArray<Label>(raw.labels),
    strokes: asArray<Stroke>(raw.strokes),
    groups: asArray<BlockGroup>(raw.groups),
    extensions,
    extra,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function normalizeSegment(segment: Segment): Segment {
  return { ...segment, routed: segment.routed === 'auto' ? 'auto' : 'manual' }
}
