import { imageAssetIds } from './assets'
import { symbolFingerprint } from './compare'
import { createId, type DiagramDocument, type ImageAsset, type ImageMime, type Point, type PortSide, type SymbolDefinition, type SymbolShape } from './document'
import { instantiateSymbol } from './symbols'

export const LIBRARY_SCHEMA = 1 as const

export type SymbolCategory = { id: string; name: string }

/** A catalog of symbol definitions. It is not a diagram and it has no sheet position. */
export type SymbolLibrary = {
  schemaVersion: typeof LIBRARY_SCHEMA
  id: string
  name: string
  description: string
  version: number
  origin?: string
  license?: string
  /** Built-in catalogs are not edited and are not replaced by an import. */
  builtin: boolean
  categories: SymbolCategory[]
  symbols: SymbolDefinition[]
  /** Pictures cited by the symbols. A checksum is stored once. */
  assets: ImageAsset[]
}

export type LibraryDiagnostic = {
  kind: 'duplicate-id' | 'invalid' | 'version-conflict'
  symbolId: string | null
  message: string
}

export type StoredLibrary = { id: string; name: string; version: number }

/** A course server or a file folder can implement the same three methods. */
export interface LibraryStorage {
  save(library: SymbolLibrary): Promise<void>
  load(id: string): Promise<SymbolLibrary>
  list(): Promise<StoredLibrary[]>
}

export class JsonLibraryStorage implements LibraryStorage {
  private records = new Map<string, string>()

  async save(library: SymbolLibrary): Promise<void> {
    this.records.set(library.id, serializeLibrary(library))
  }

  async load(id: string): Promise<SymbolLibrary> {
    const text = this.records.get(id)
    if (text === undefined) throw new Error('Library not found.')
    return parseLibrary(text)
  }

  async list(): Promise<StoredLibrary[]> {
    return [...this.records.values()].map((text) => {
      const library = parseLibrary(text)
      return { id: library.id, name: library.name, version: library.version }
    })
  }

  exportText(id: string): string {
    const text = this.records.get(id)
    if (text === undefined) throw new Error('Library not found.')
    return text
  }
}

const SIDES = new Set<PortSide>(['left', 'right', 'top', 'bottom'])
const SHAPE_KINDS = new Set(['rect', 'ellipse', 'line', 'polygon', 'text', 'image'])
const IMAGE_MIME = new Set<ImageMime>(['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'])

export function emptyUserLibrary(): SymbolLibrary {
  return {
    schemaVersion: LIBRARY_SCHEMA,
    id: 'lib_user',
    name: 'User',
    description: 'Symbols saved from the editor.',
    version: 1,
    origin: 'user',
    builtin: false,
    categories: [{ id: 'cat_user', name: 'Saved' }],
    symbols: [],
    assets: [],
  }
}

export function serializeLibrary(library: SymbolLibrary): string {
  return JSON.stringify(library)
}

export function parseLibrary(text: string): SymbolLibrary {
  const raw = JSON.parse(text) as Partial<SymbolLibrary>
  if (raw.schemaVersion !== LIBRARY_SCHEMA) throw new Error('This library schema is not supported.')
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string' || typeof raw.version !== 'number') {
    throw new Error('The library is missing an id, a name, or a version.')
  }
  return {
    schemaVersion: LIBRARY_SCHEMA,
    id: raw.id,
    name: raw.name,
    description: typeof raw.description === 'string' ? raw.description : '',
    version: raw.version,
    ...(typeof raw.origin === 'string' ? { origin: raw.origin } : {}),
    ...(typeof raw.license === 'string' ? { license: raw.license } : {}),
    builtin: false,
    categories: Array.isArray(raw.categories)
      ? raw.categories.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string')
      : [],
    symbols: Array.isArray(raw.symbols) ? raw.symbols.filter((item) => validateSymbol(item)) : [],
    assets: parseAssets(raw.assets),
  }
}

function parseAssets(value: unknown): ImageAsset[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (!isAsset(item)) throw new Error('A library image is missing an id, a type, or its data.')
    return item
  })
}

function isAsset(value: unknown): value is ImageAsset {
  if (!value || typeof value !== 'object') return false
  const asset = value as ImageAsset
  return (
    typeof asset.id === 'string' &&
    asset.id.length > 0 &&
    typeof asset.name === 'string' &&
    IMAGE_MIME.has(asset.mime) &&
    typeof asset.data === 'string' &&
    asset.data.length > 0 &&
    typeof asset.checksum === 'string' &&
    asset.checksum.length > 0 &&
    (typeof asset.width === 'number' || asset.width === null) &&
    (typeof asset.height === 'number' || asset.height === null)
  )
}

export function validateSymbol(value: unknown): value is SymbolDefinition {
  if (!value || typeof value !== 'object') return false
  const symbol = value as SymbolDefinition
  if (typeof symbol.id !== 'string' || symbol.id.length === 0) return false
  if (typeof symbol.name !== 'string') return false
  if (typeof symbol.width !== 'number' || typeof symbol.height !== 'number') return false
  if (!Array.isArray(symbol.ports) || !Array.isArray(symbol.shapes) || !Array.isArray(symbol.labels)) return false
  if (symbol.ports.some((port) => typeof port.id !== 'string' || typeof port.name !== 'string' || !SIDES.has(port.side) || typeof port.t !== 'number')) {
    return false
  }
  if (symbol.guides !== undefined) {
    if (!Array.isArray(symbol.guides)) return false
    if (
      symbol.guides.some(
        (guide) =>
          !guide ||
          typeof guide.id !== 'string' ||
          guide.kind !== 'ellipse' ||
          typeof guide.cx !== 'number' ||
          typeof guide.cy !== 'number' ||
          typeof guide.rx !== 'number' ||
          typeof guide.ry !== 'number',
      )
    ) {
      return false
    }
  }
  return symbol.shapes.every((shape) => validShape(shape))
}

function validShape(shape: SymbolShape): boolean {
  if (!shape || !SHAPE_KINDS.has(shape.kind)) return false
  if (shape.kind !== 'image') return true
  return typeof shape.assetId === 'string' && typeof shape.x === 'number' && typeof shape.y === 'number' && typeof shape.width === 'number' && typeof shape.height === 'number'
}

function bodyRecord(symbol: SymbolDefinition, assets: ImageAsset[]) {
  return {
    name: symbol.name,
    width: symbol.width,
    height: symbol.height,
    ports: symbol.ports,
    labels: symbol.labels,
    guides: symbol.guides ?? [],
    shapes: symbol.shapes.map((shape) => {
      if (shape.kind !== 'image') return shape
      const checksum = assets.find((asset) => asset.id === shape.assetId)?.checksum ?? shape.assetId
      return { ...shape, assetId: checksum }
    }),
  }
}

/** Picture, pins, and name. The same picture compares equal even when its asset id was reused. */
export function sameSymbolBody(a: SymbolDefinition, b: SymbolDefinition, assetsA: ImageAsset[] = [], assetsB: ImageAsset[] = []): boolean {
  return JSON.stringify(bodyRecord(a, assetsA)) === JSON.stringify(bodyRecord(b, assetsB))
}

function remapSymbol(symbol: SymbolDefinition, map: Map<string, string>): SymbolDefinition {
  const copy = cloneSymbol(symbol)
  copy.shapes = copy.shapes.map((shape) => (shape.kind === 'image' ? { ...shape, assetId: map.get(shape.assetId) ?? shape.assetId } : shape))
  return copy
}

export function transferAssets(
  target: ImageAsset[],
  source: ImageAsset[],
  ids: string[],
): { ok: true; map: Map<string, string>; pending: ImageAsset[] } | { ok: false; message: string } {
  const map = new Map<string, string>()
  const pending: ImageAsset[] = []
  const pool = (): ImageAsset[] => [...target, ...pending]
  for (const id of ids) {
    const asset = source.find((item) => item.id === id)
    if (!asset) return { ok: false, message: `The picture ${id} is missing. Nothing was written.` }
    const byChecksum = pool().find((item) => item.checksum === asset.checksum)
    if (byChecksum) {
      map.set(id, byChecksum.id)
      continue
    }
    if (pool().some((item) => item.id === asset.id)) {
      return { ok: false, message: `${asset.name} uses an id that already stores a different picture. Nothing was written.` }
    }
    const copy = JSON.parse(JSON.stringify(asset)) as ImageAsset
    pending.push(copy)
    map.set(id, copy.id)
  }
  return { ok: true, map, pending }
}

export function cloneSymbol(symbol: SymbolDefinition): SymbolDefinition {
  return JSON.parse(JSON.stringify(symbol)) as SymbolDefinition
}

/** A new definition. Pin ids change so the copy is not another name for the original pins. */
export function duplicateDefinition(symbol: SymbolDefinition): SymbolDefinition {
  const copy = cloneSymbol(symbol)
  copy.id = createId('sym')
  copy.name = `${symbol.name} copy`
  copy.ports = copy.ports.map((port) => ({ ...port, id: createId('pin') }))
  delete copy.libraryId
  delete copy.libraryVersion
  return copy
}

function ensureCategory(library: SymbolLibrary, categoryId: string | undefined): void {
  if (!categoryId) return
  if (library.categories.some((item) => item.id === categoryId)) return
  library.categories.push({ id: categoryId, name: categoryId })
}

/**
 * Copy a definition into the document once.
 * A second instance reuses that copy. Different contents with the same id are refused.
 */
export function adoptLibrarySymbol(
  doc: DiagramDocument,
  source: SymbolDefinition,
  sourceAssets: ImageAsset[] = [],
): { ok: true } | { ok: false; message: string } {
  if (!doc.assets) doc.assets = []
  const moved = transferAssets(doc.assets, sourceAssets, imageAssetIds(source.shapes))
  if (!moved.ok) return moved
  const copy = remapSymbol(source, moved.map)
  const existing = doc.symbols.find((item) => item.id === source.id)
  if (existing && !sameSymbolBody(existing, copy, doc.assets, [...doc.assets, ...moved.pending])) {
    return {
      ok: false,
      message: `${source.name} is already in this document with different contents. The document was not changed.`,
    }
  }
  if (!existing) {
    doc.assets.push(...moved.pending)
    doc.symbols.push(copy)
  }
  return { ok: true }
}

export function placeLibrarySymbol(
  doc: DiagramDocument,
  source: SymbolDefinition,
  at: Point,
  name?: string,
  sourceAssets: ImageAsset[] = [],
): { ok: true; blockId: string } | { ok: false; message: string } {
  const adopted = adoptLibrarySymbol(doc, source, sourceAssets)
  if (!adopted.ok) return adopted
  const count = doc.blocks.filter((block) => block.symbolId === source.id).length
  const blockId = instantiateSymbol(doc, source.id, at, name ?? source.name)
  if (!blockId) return { ok: false, message: 'The symbol could not be placed.' }
  if (count > 0) {
    const block = doc.blocks.find((item) => item.id === blockId)
    if (block) block.name = `${source.name} ${count + 1}`
  }
  return { ok: true, blockId }
}

/** Store a document symbol in a user library. A different symbol with the same id is left untouched. */
export function saveSymbolToLibrary(
  library: SymbolLibrary,
  symbol: SymbolDefinition,
  sourceAssets: ImageAsset[] = [],
): { ok: true } | { ok: false; diagnostics: LibraryDiagnostic[] } {
  if (library.builtin) {
    return { ok: false, diagnostics: [{ kind: 'invalid', symbolId: symbol.id, message: 'A built-in library cannot be changed.' }] }
  }
  if (!library.assets) library.assets = []
  const moved = transferAssets(library.assets, sourceAssets, imageAssetIds(symbol.shapes))
  if (!moved.ok) {
    return { ok: false, diagnostics: [{ kind: 'invalid', symbolId: symbol.id, message: moved.message }] }
  }
  const copy = remapSymbol(symbol, moved.map)
  copy.libraryId = library.id
  copy.libraryVersion = library.version
  if (!copy.categoryId) copy.categoryId = library.categories[0]?.id
  const existing = library.symbols.find((item) => item.id === symbol.id)
  if (existing && !sameSymbolBody(existing, copy, library.assets, [...library.assets, ...moved.pending])) {
    return {
      ok: false,
      diagnostics: [
        {
          kind: 'duplicate-id',
          symbolId: symbol.id,
          message: `${existing.name} is already stored under this id. The library was not changed.`,
        },
      ],
    }
  }
  ensureCategory(library, copy.categoryId)
  if (existing) {
    existing.categoryId = copy.categoryId
    return { ok: true }
  }
  copy.revision = 1
  copy.bodyChecksum = symbolFingerprint(copy, [...library.assets, ...moved.pending])
  library.assets.push(...moved.pending)
  library.symbols.push(copy)
  return { ok: true }
}

/**
 * Explicit new revision of a user-library symbol.
 * The same picture is kept. A different picture replaces the library entry and bumps the revision.
 */
export function publishSymbolRevision(
  library: SymbolLibrary,
  symbol: SymbolDefinition,
  sourceAssets: ImageAsset[] = [],
): { ok: true; revision: number } | { ok: false; diagnostics: LibraryDiagnostic[] } {
  if (library.builtin) {
    return { ok: false, diagnostics: [{ kind: 'invalid', symbolId: symbol.id, message: 'A built-in library cannot be changed.' }] }
  }
  if (!library.assets) library.assets = []
  const moved = transferAssets(library.assets, sourceAssets, imageAssetIds(symbol.shapes))
  if (!moved.ok) return { ok: false, diagnostics: [{ kind: 'invalid', symbolId: symbol.id, message: moved.message }] }
  const copy = remapSymbol(symbol, moved.map)
  copy.libraryId = library.id
  copy.libraryVersion = library.version
  if (!copy.categoryId) copy.categoryId = library.categories[0]?.id
  const existing = library.symbols.find((item) => item.id === symbol.id)
  const pool = [...library.assets, ...moved.pending]
  if (existing && sameSymbolBody(existing, copy, library.assets, pool)) {
    return { ok: true, revision: existing.revision ?? 1 }
  }
  copy.revision = (existing?.revision ?? 0) + 1
  copy.bodyChecksum = symbolFingerprint(copy, pool)
  ensureCategory(library, copy.categoryId)
  if (!existing) {
    library.assets.push(...moved.pending)
    library.symbols.push(copy)
    return { ok: true, revision: copy.revision }
  }
  existing.name = copy.name
  existing.width = copy.width
  existing.height = copy.height
  existing.ports = copy.ports
  existing.shapes = copy.shapes
  existing.labels = copy.labels
  existing.revision = copy.revision
  existing.bodyChecksum = copy.bodyChecksum
  existing.libraryVersion = copy.libraryVersion
  if (copy.categoryId) existing.categoryId = copy.categoryId
  library.assets.push(...moved.pending)
  const used = new Set(library.symbols.flatMap((item) => imageAssetIds(item.shapes)))
  library.assets = library.assets.filter((asset) => used.has(asset.id))
  return { ok: true, revision: copy.revision }
}

/** Remove a symbol from a user library. Documents that already copied it are not opened and not changed. */
export function removeLibrarySymbol(library: SymbolLibrary, symbolId: string): boolean {
  if (library.builtin) return false
  const before = library.symbols.length
  library.symbols = library.symbols.filter((item) => item.id !== symbolId)
  const used = new Set(library.symbols.flatMap((symbol) => imageAssetIds(symbol.shapes)))
  library.assets = (library.assets ?? []).filter((asset) => used.has(asset.id))
  return library.symbols.length !== before
}

/**
 * Add symbols from a file into the user library.
 * Matching ids with different contents are reported and kept as they were stored.
 */
export function mergeLibrary(target: SymbolLibrary, incoming: SymbolLibrary): LibraryDiagnostic[] {
  if (target.builtin) {
    return [{ kind: 'invalid', symbolId: null, message: 'A built-in library cannot be replaced.' }]
  }
  if (!target.assets) target.assets = []
  const diagnostics: LibraryDiagnostic[] = []
  const seen = new Set<string>()
  const versionDiffers = incoming.id === target.id && incoming.version !== target.version
  for (const symbol of incoming.symbols) {
    if (!validateSymbol(symbol)) {
      const symbolId = symbol && typeof symbol === 'object' && typeof (symbol as SymbolDefinition).id === 'string' ? (symbol as SymbolDefinition).id : null
      diagnostics.push({ kind: 'invalid', symbolId, message: 'A symbol in the library file is missing an id, a size, or a pin.' })
      continue
    }
    if (seen.has(symbol.id)) {
      diagnostics.push({ kind: 'duplicate-id', symbolId: symbol.id, message: `${symbol.id} is repeated in the library file and was skipped.` })
      continue
    }
    seen.add(symbol.id)
    const moved = transferAssets(target.assets, incoming.assets ?? [], imageAssetIds(symbol.shapes))
    if (!moved.ok) {
      diagnostics.push({ kind: 'invalid', symbolId: symbol.id, message: moved.message })
      continue
    }
    const copy = remapSymbol(symbol, moved.map)
    const existing = target.symbols.find((item) => item.id === symbol.id)
    if (!existing) {
      ensureCategory(target, copy.categoryId)
      target.assets.push(...moved.pending)
      target.symbols.push(copy)
      continue
    }
    if (sameSymbolBody(existing, copy, target.assets, [...target.assets, ...moved.pending])) continue
    diagnostics.push({
      kind: versionDiffers ? 'version-conflict' : 'duplicate-id',
      symbolId: symbol.id,
      message: versionDiffers
        ? `${symbol.name} differs, and the file version is ${incoming.version} rather than ${target.version}. The stored symbol was kept.`
        : `${existing.name} is already stored under this id. The library was not changed.`,
    })
  }
  return diagnostics
}
