import { sha256Sync } from './assets'
import type { ImageAsset, SymbolDefinition, SymbolLabel, SymbolPort, SymbolShape } from './document'

export type SymbolChangeKind =
  | 'size'
  | 'shape-added'
  | 'shape-removed'
  | 'shape-changed'
  | 'text'
  | 'image'
  | 'pin-added'
  | 'pin-removed'
  | 'pin-renamed'
  | 'pin-moved'
  | 'pin-freedom'

export type SymbolChange = {
  kind: SymbolChangeKind
  pinId: string | null
  detail: string
}

function free(pin: SymbolPort): boolean {
  return typeof pin.x === 'number' && typeof pin.y === 'number'
}

function shapeKey(shape: SymbolShape, assets: ImageAsset[]): unknown {
  if (shape.kind !== 'image') return shape
  const checksum = assets.find((asset) => asset.id === shape.assetId)?.checksum ?? shape.assetId
  return { ...shape, assetId: checksum }
}

/** Fingerprint of the picture and the pins. Revision and library fields are not part of it. */
export function symbolFingerprint(symbol: SymbolDefinition, assets: ImageAsset[] = []): string {
  const body = JSON.stringify({
    name: symbol.name,
    width: symbol.width,
    height: symbol.height,
    ports: [...symbol.ports].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    labels: [...symbol.labels].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    shapes: symbol.shapes.map((shape) => shapeKey(shape, assets)),
  })
  return sha256Sync(new TextEncoder().encode(body))
}

/**
 * Compare two definitions by pin id and by picture content.
 * A different revision alone is not a change. This function does not write.
 */
export function compareSymbols(
  before: SymbolDefinition,
  after: SymbolDefinition,
  beforeAssets: ImageAsset[] = [],
  afterAssets: ImageAsset[] = [],
): SymbolChange[] {
  const changes: SymbolChange[] = []
  if (before.width !== after.width || before.height !== after.height) {
    changes.push({
      kind: 'size',
      pinId: null,
      detail: `Size ${before.width}×${before.height} becomes ${after.width}×${after.height}.`,
    })
  }
  const count = Math.max(before.shapes.length, after.shapes.length)
  for (let index = 0; index < count; index += 1) {
    const left = before.shapes[index]
    const right = after.shapes[index]
    if (!left) {
      changes.push({ kind: 'shape-added', pinId: null, detail: `Shape ${index + 1} was added.` })
      continue
    }
    if (!right) {
      changes.push({ kind: 'shape-removed', pinId: null, detail: `Shape ${index + 1} was removed.` })
      continue
    }
    if (JSON.stringify(shapeKey(left, beforeAssets)) === JSON.stringify(shapeKey(right, afterAssets))) continue
    if (left.kind === 'image' && right.kind === 'image') {
      changes.push({ kind: 'image', pinId: null, detail: `Picture ${index + 1} was replaced.` })
      continue
    }
    if (left.kind === 'text' && right.kind === 'text' && left.text !== right.text) {
      changes.push({ kind: 'text', pinId: null, detail: `Text ${index + 1} changed.` })
      continue
    }
    changes.push({ kind: 'shape-changed', pinId: null, detail: `Shape ${index + 1} changed.` })
  }
  changes.push(...labelChanges(before.labels, after.labels))
  changes.push(...pinChanges(before.ports, after.ports))
  return changes
}

function labelChanges(before: SymbolLabel[], after: SymbolLabel[]): SymbolChange[] {
  const changes: SymbolChange[] = []
  const next = new Map(after.map((label) => [label.id, label]))
  const prev = new Map(before.map((label) => [label.id, label]))
  for (const label of after) {
    const old = prev.get(label.id)
    if (!old) changes.push({ kind: 'text', pinId: null, detail: `Text “${label.text}” was added.` })
    else if (old.text !== label.text) changes.push({ kind: 'text', pinId: null, detail: `Text “${old.text}” is now “${label.text}”.` })
  }
  for (const label of before) {
    if (!next.has(label.id)) changes.push({ kind: 'text', pinId: null, detail: `Text “${label.text}” was removed.` })
  }
  return changes
}

function pinChanges(before: SymbolPort[], after: SymbolPort[]): SymbolChange[] {
  const changes: SymbolChange[] = []
  const next = new Map(after.map((pin) => [pin.id, pin]))
  const prev = new Map(before.map((pin) => [pin.id, pin]))
  for (const pin of after) {
    if (!prev.has(pin.id)) changes.push({ kind: 'pin-added', pinId: pin.id, detail: `Pin ${pin.name} was added.` })
  }
  for (const pin of before) {
    const newer = next.get(pin.id)
    if (!newer) {
      changes.push({ kind: 'pin-removed', pinId: pin.id, detail: `Pin ${pin.name} was removed.` })
      continue
    }
    if (pin.name !== newer.name) {
      changes.push({ kind: 'pin-renamed', pinId: pin.id, detail: `Pin ${pin.name} is now ${newer.name}.` })
    }
    if (free(pin) !== free(newer)) {
      changes.push({
        kind: 'pin-freedom',
        pinId: pin.id,
        detail: free(newer) ? `${newer.name} is now a free pin.` : `${newer.name} is now bound to a side.`,
      })
    } else if (free(pin) ? pin.x !== newer.x || pin.y !== newer.y : pin.side !== newer.side || pin.t !== newer.t) {
      changes.push({ kind: 'pin-moved', pinId: pin.id, detail: `${newer.name} moved.` })
    }
  }
  return changes
}
