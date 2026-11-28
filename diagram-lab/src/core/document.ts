/** Generic diagram document. No HDL, no Vue, no DOM. */

export const SCHEMA_VERSION = 1 as const

export type Point = { x: number; y: number }

/** A corner the automatic router must keep. Absent means the point may move. */
export type Waypoint = Point & { fixed?: boolean }

/**
 * Optional instance presentation overrides (P3). Absent object ⇒ application defaults.
 * `fillTransparent: true` is an explicit no-fill, distinct from omitting `fill`.
 */
export type BlockStyle = {
  /** CSS colour for closed body shapes / plain-block background. */
  fill?: string
  /** When true, body has no fill (grid may show through). */
  fillTransparent?: boolean
  /** CSS colour for plain-block border or closed-shape stroke. */
  stroke?: string
  /** CSS colour for P2 display text. */
  text?: string
}

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
  /**
   * Symbol pin ids this instance does not show.
   * The symbol definition and every other instance keep those pins.
   */
  suppressedPins?: string[]
  parameters?: Record<string, string>
  /**
   * When false, the instance name is not drawn on the sheet.
   * Omitted or true keeps today’s appearance. Logical `name` is unchanged (P1).
   */
  showName?: boolean
  /**
   * When false, port name glyphs are not drawn (marks stay).
   * Omitted or true keeps today’s appearance. Port identity is unchanged (P1).
   */
  showPortNames?: boolean
  /**
   * Optional centred multiline caption inside the instance box (P2).
   * Independent of logical `name`. Omitted = no display text (pre-P2 appearance).
   */
  displayText?: string
  /**
   * When false, `displayText` is not drawn. Omitted or true shows it when set (P2).
   */
  showDisplayText?: boolean
  /**
   * Offset of the P2 display-text group from the block centre, in diagram units (P3a).
   * Omitted or `{ x: 0, y: 0 }` means automatic centring.
   */
  displayTextOffset?: Point
  /**
   * How to interpret `displayText` for the centred caption (A2-P3a).
   * Omitted ≡ plain. LaTeX applies only when `displayText` is set.
   */
  textFormat?: 'plain' | 'latex' | 'markdown'
  /**
   * Caption font size in diagram px (A2-P5a). Omitted ≡ 12 for layout.
   * Independent of viewport zoom.
   */
  fontSize?: number
  /** Line alignment inside the caption group (A2-P5a). Omitted uses format-specific default. */
  textAlign?: 'left' | 'center' | 'right'
  /** Instance-level appearance overrides (P3). Does not alter the symbol library. */
  style?: BlockStyle
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
   * Fraction along `side`. Left and right run from top to bottom.
   * Top and bottom run from left to right.
   * With `placed`, this is the instance's own graphic position.
   * Without it, a bound symbol pin supplies the position and `t` is the fallback.
   */
  t?: number
  /**
   * This instance draws from its own `side` and `t`.
   * The symbol pin, the logical port, and every other instance stay where they are.
   */
  placed?: boolean
  /** Fractions inside the symbol when the pin is free. Absent on a side pin. */
  x?: number
  y?: number
  /**
   * Instance override of a guided symbol pin’s normalised parameter `u` (A2-P1).
   * Absent ⇒ use the definition’s `u`. Does not rewrite the library definition.
   */
  guideU?: number
}

/** A drawing primitive owned by a symbol. Coordinates are inside the symbol, not on the sheet. */
export type SymbolShape =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx?: number }
  | { kind: 'ellipse'; x: number; y: number; width: number; height: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'polygon'; points: Point[] }
  | { kind: 'text'; x: number; y: number; text: string }
  | { kind: 'image'; assetId: string; x: number; y: number; width: number; height: number; lockAspect?: boolean }

/**
 * Symbol-local port guide (A2-P1). Invisible; constrains guided pin placement.
 * Ellipse covers circles (`rx === ry`). Polyline guides are reserved for later.
 */
export type SymbolGuide = {
  id: string
  kind: 'ellipse'
  /** Centre and radii in symbol-local units. */
  cx: number
  cy: number
  rx: number
  ry: number
}

export type SymbolPort = {
  id: string
  name: string
  side: PortSide
  /**
   * Fraction along the side, from 0 to 1.
   * Left and right: top to bottom. Top and bottom: left to right.
   * Kept for side-based pins and as a fallback hint for label layout.
   */
  t: number
  /** Fractions of the symbol width and height. Set only for a free pin. */
  x?: number
  y?: number
  /**
   * When set, the pin rides the named guide; position is derived from `u` (A2-P1).
   * Free `x`/`y` and side/`t` anchors are ignored for geometry while guided.
   */
  guideId?: string
  /**
   * Normalised guide parameter in [0, 1). For ellipses, φ = 2πu
   * (u=0 right, 0.25 bottom, 0.5 left, 0.75 top in screen coordinates).
   */
  u?: number
  /**
   * Derived graphical lead (not a net). `radial` connects this pin to `leadGuideId`
   * using the same `u` when both guides are concentric ellipses.
   */
  lead?: 'none' | 'radial'
  /** Inner contour guide for `lead: 'radial'`. */
  leadGuideId?: string
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
  /** Optional port guides (A2-P1). Omitted on legacy symbols. */
  guides?: SymbolGuide[]
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
  | {
      kind: 'segment'
      segmentId: string
      edge: number
      distance: number
      /**
       * Legacy signed normal offset from the on-wire attachment (pre-P5a).
       * Used for drawing only when `shift` is absent — preserves old documents exactly.
       */
      offset: number
      /**
       * Free 2D offset from the on-wire attachment in diagram units (P5a).
       * When present, drawing uses attachment(edge, distance) + shift and ignores `offset`.
       * Omit ≡ legacy-offset drawing.
       */
      shift?: Point
    }
  | { kind: 'free'; x: number; y: number }

export type Label = {
  id: string
  text: string
  /**
   * name: the drawing shows the net name (or `displayText` when set — A2-P2).
   * note: the drawing shows `text`.
   * A missing role on a segment anchor is a name label, so older files keep their meaning.
   */
  role?: 'name' | 'note'
  /**
   * Optional per-label display override for name-role labels (A2-P2).
   * When set (non-empty after trim), the drawing shows this string instead of `Net.name`.
   * Omitted = inherit the logical net name. Empty / whitespace is normalized to omitted.
   * Does not rename nets or change connectivity. Independent of `visible` and position.
   */
  displayText?: string
  /**
   * How to interpret `displayText` for name-role custom labels (A2-P3).
   * Omitted or `'plain'` → literal text. `'latex'` → MathJax SVG from the source (no $ delimiters).
   * Inherited net-name labels are always plain. Persist source + format only — never generated SVG.
   */
  textFormat?: 'plain' | 'latex' | 'markdown'
  /** Optional drawing size in CSS px. Omit for the stage default (~13px). */
  fontSize?: number
  /** Horizontal alignment of the label text group at its anchor (A2-P5a). Omitted ≡ left. */
  textAlign?: 'left' | 'center' | 'right'
  /**
   * When false, the label is not painted. Omitted or true keeps today’s appearance.
   * Net name and identity are unchanged (P1).
   */
  visible?: boolean
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
