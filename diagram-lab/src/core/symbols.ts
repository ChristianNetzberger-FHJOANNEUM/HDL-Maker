import { imageAssetIds, storeAsset, type AssetDraft } from './assets'
import { symbolFingerprint } from './compare'
import { createId, type DiagramDocument, type Point, type SymbolDefinition, type SymbolPort, type SymbolShape } from './document'
import { refreshAll } from './geometry'

export type SymbolDiagnostic = {
  instanceId: string
  portId: string | null
  symbolPortId: string | null
  kind: 'missing-symbol' | 'missing-port'
  message: string
}

export function defineSymbol(
  doc: DiagramDocument,
  input: {
    id?: string
    name: string
    width: number
    height: number
    ports: Array<Omit<SymbolPort, 'id'> & { id?: string }>
    shapes?: SymbolShape[]
    categoryId?: string
  },
): string {
  const id = input.id ?? createId('sym')
  const symbol: SymbolDefinition = {
    id,
    name: input.name,
    width: input.width,
    height: input.height,
    ports: input.ports.map((port) => ({ id: port.id ?? createId('pin'), name: port.name, side: port.side, t: port.t })),
    shapes: input.shapes ?? [{ kind: 'rect', x: 0, y: 0, width: input.width, height: input.height }],
    labels: [],
    revision: 1,
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
  }
  symbol.bodyChecksum = symbolFingerprint(symbol, doc.assets ?? [])
  doc.symbols.push(symbol)
  return id
}

/** A new block. Its pins get new ids and keep the definition's pin ids. */
export function instantiateSymbol(doc: DiagramDocument, symbolId: string, at: Point, name: string): string | null {
  const symbol = doc.symbols.find((item) => item.id === symbolId)
  if (!symbol) return null
  const id = createId('blk')
  doc.blocks.push({
    id,
    name,
    x: at.x,
    y: at.y,
    width: symbol.width,
    height: symbol.height,
    symbolId,
  })
  for (const pin of symbol.ports) {
    doc.ports.push({
      id: createId('prt'),
      blockId: id,
      name: pin.name,
      side: pin.side,
      symbolPortId: pin.id,
      t: pin.t,
      ...(typeof pin.x === 'number' && typeof pin.y === 'number' ? { x: pin.x, y: pin.y } : {}),
    })
  }
  return id
}

export function setComponent(doc: DiagramDocument, blockId: string, componentId: string | null): void {
  const block = doc.blocks.find((item) => item.id === blockId)
  if (!block) return
  if (componentId) block.componentId = componentId
  else delete block.componentId
}

/** Copy the definition's size and pin sides onto every instance. Pin ids and wires stay. */
export function applySymbol(doc: DiagramDocument, symbolId: string): void {
  const symbol = doc.symbols.find((item) => item.id === symbolId)
  if (!symbol) return
  for (const block of doc.blocks.filter((item) => item.symbolId === symbolId)) {
    block.width = symbol.width
    block.height = symbol.height
    for (const pin of symbol.ports) {
      const existing = doc.ports.find((port) => port.blockId === block.id && port.symbolPortId === pin.id)
      if (existing) {
        existing.name = pin.name
        existing.side = pin.side
        existing.t = pin.t
        if (typeof pin.x === 'number' && typeof pin.y === 'number') {
          existing.x = pin.x
          existing.y = pin.y
        } else {
          delete existing.x
          delete existing.y
        }
        continue
      }
      doc.ports.push({
        id: createId('prt'),
        blockId: block.id,
        name: pin.name,
        side: pin.side,
        symbolPortId: pin.id,
        t: pin.t,
        ...(typeof pin.x === 'number' && typeof pin.y === 'number' ? { x: pin.x, y: pin.y } : {}),
      })
    }
  }
  refreshAll(doc)
}

export function moveSymbolPort(doc: DiagramDocument, symbolId: string, symbolPortId: string, side: SymbolPort['side'], t: number): boolean {
  const symbol = doc.symbols.find((item) => item.id === symbolId)
  const pin = symbol?.ports.find((item) => item.id === symbolPortId)
  if (!pin) return false
  pin.side = side
  pin.t = Math.min(1, Math.max(0, t))
  delete pin.x
  delete pin.y
  applySymbol(doc, symbolId)
  return true
}

/** Keep the pin id and move it to a fraction of the symbol box. */
export function moveFreeSymbolPort(doc: DiagramDocument, symbolId: string, symbolPortId: string, x: number, y: number): boolean {
  const symbol = doc.symbols.find((item) => item.id === symbolId)
  const pin = symbol?.ports.find((item) => item.id === symbolPortId)
  if (!symbol || !pin) return false
  pin.x = Math.min(1, Math.max(0, x))
  pin.y = Math.min(1, Math.max(0, y))
  applySymbol(doc, symbolId)
  return true
}

/** Drop the pin from the picture. Connected instance pins and their wires remain, and a diagnosis names them. */
export function removeSymbolPort(doc: DiagramDocument, symbolId: string, symbolPortId: string): boolean {
  const symbol = doc.symbols.find((item) => item.id === symbolId)
  if (!symbol?.ports.some((port) => port.id === symbolPortId)) return false
  symbol.ports = symbol.ports.filter((port) => port.id !== symbolPortId)
  applySymbol(doc, symbolId)
  return true
}

export function setSymbolSize(doc: DiagramDocument, symbolId: string, width: number, height: number): boolean {
  const symbol = doc.symbols.find((item) => item.id === symbolId)
  if (!symbol) return false
  symbol.width = Math.max(40, width)
  symbol.height = Math.max(40, height)
  applySymbol(doc, symbolId)
  return true
}

export function setSymbolCategory(doc: DiagramDocument, symbolId: string, categoryId: string): void {
  const symbol = doc.symbols.find((item) => item.id === symbolId)
  if (symbol) symbol.categoryId = categoryId
}

export function renameSymbol(doc: DiagramDocument, symbolId: string, name: string): void {
  const symbol = doc.symbols.find((item) => item.id === symbolId)
  if (symbol) symbol.name = name
}

export function addSymbolShape(doc: DiagramDocument, symbolId: string, shape: SymbolShape): number {
  const symbol = doc.symbols.find((item) => item.id === symbolId)
  if (!symbol) return -1
  symbol.shapes.push(shape)
  return symbol.shapes.length - 1
}

export function replaceSymbolShape(doc: DiagramDocument, symbolId: string, index: number, shape: SymbolShape): void {
  const symbol = doc.symbols.find((item) => item.id === symbolId)
  if (!symbol || index < 0 || index >= symbol.shapes.length) return
  symbol.shapes[index] = shape
}

export function removeSymbolShape(doc: DiagramDocument, symbolId: string, index: number): void {
  const symbol = doc.symbols.find((item) => item.id === symbolId)
  if (!symbol || index < 0 || index >= symbol.shapes.length) return
  symbol.shapes.splice(index, 1)
  pruneAssets(doc)
}

/** Drop a picture that no symbol cites. A shared picture stays. */
export function pruneAssets(doc: DiagramDocument): void {
  const used = new Set(doc.symbols.flatMap((symbol) => imageAssetIds(symbol.shapes)))
  doc.assets = doc.assets.filter((asset) => used.has(asset.id))
}

export function addImageAsset(doc: DiagramDocument, draft: AssetDraft & { id?: string }): { ok: true; id: string; reused: boolean } | { ok: false; message: string } {
  if (!doc.assets) doc.assets = []
  return storeAsset(doc.assets, draft)
}

export function addSymbolLabel(doc: DiagramDocument, symbolId: string, x: number, y: number, text: string): string | null {
  const symbol = doc.symbols.find((item) => item.id === symbolId)
  if (!symbol) return null
  const id = createId('slb')
  symbol.labels.push({ id, text, x, y })
  return id
}

export function moveSymbolLabel(doc: DiagramDocument, symbolId: string, labelId: string, x: number, y: number): void {
  const label = doc.symbols.find((item) => item.id === symbolId)?.labels.find((item) => item.id === labelId)
  if (!label) return
  label.x = x
  label.y = y
}

export function setSymbolLabelText(doc: DiagramDocument, symbolId: string, labelId: string, text: string): void {
  const label = doc.symbols.find((item) => item.id === symbolId)?.labels.find((item) => item.id === labelId)
  if (label) label.text = text
}

export function removeSymbolLabel(doc: DiagramDocument, symbolId: string, labelId: string): void {
  const symbol = doc.symbols.find((item) => item.id === symbolId)
  if (!symbol) return
  symbol.labels = symbol.labels.filter((label) => label.id !== labelId)
}

export function renameSymbolPort(doc: DiagramDocument, symbolId: string, symbolPortId: string, name: string): boolean {
  const pin = doc.symbols.find((item) => item.id === symbolId)?.ports.find((item) => item.id === symbolPortId)
  if (!pin) return false
  pin.name = name
  applySymbol(doc, symbolId)
  return true
}

export function translatedShape(origin: SymbolShape, dx: number, dy: number): SymbolShape {
  if (origin.kind === 'line') {
    return { ...origin, x1: origin.x1 + dx, y1: origin.y1 + dy, x2: origin.x2 + dx, y2: origin.y2 + dy }
  }
  if (origin.kind === 'polygon') {
    return { ...origin, points: origin.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) }
  }
  if (origin.kind === 'text') return { ...origin, x: origin.x + dx, y: origin.y + dy }
  return { ...origin, x: origin.x + dx, y: origin.y + dy }
}

export function addSymbolPort(doc: DiagramDocument, symbolId: string, port: Omit<SymbolPort, 'id'> & { id?: string }): string | null {
  const symbol = doc.symbols.find((item) => item.id === symbolId)
  if (!symbol) return null
  const id = port.id ?? createId('pin')
  symbol.ports.push({
    id,
    name: port.name,
    side: port.side,
    t: port.t,
    ...(typeof port.x === 'number' && typeof port.y === 'number' ? { x: port.x, y: port.y } : {}),
  })
  applySymbol(doc, symbolId)
  return id
}

export function symbolDiagnostics(doc: DiagramDocument): SymbolDiagnostic[] {
  const found: SymbolDiagnostic[] = []
  for (const block of doc.blocks) {
    if (!block.symbolId) continue
    const symbol = doc.symbols.find((item) => item.id === block.symbolId)
    if (!symbol) {
      found.push({
        instanceId: block.id,
        portId: null,
        symbolPortId: null,
        kind: 'missing-symbol',
        message: `${block.name} cites a symbol that is not in this document.`,
      })
      continue
    }
    const pins = new Set(symbol.ports.map((port) => port.id))
    for (const port of doc.ports.filter((item) => item.blockId === block.id && item.symbolPortId)) {
      if (port.symbolPortId && !pins.has(port.symbolPortId)) {
        const wired = doc.segments.some(
          (segment) =>
            (segment.start.kind === 'port' && segment.start.portId === port.id) ||
            (segment.end.kind === 'port' && segment.end.portId === port.id),
        )
        found.push({
          instanceId: block.id,
          portId: port.id,
          symbolPortId: port.symbolPortId,
          kind: 'missing-port',
          message: wired
            ? `${block.name}.${port.name} still has a wire, but its symbol pin was removed.`
            : `${block.name}.${port.name} remains, but its symbol pin was removed.`,
        })
      }
    }
  }
  return found
}
