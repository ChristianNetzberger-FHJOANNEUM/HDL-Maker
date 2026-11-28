/**
 * A2-P5b — semantic port direction (independent of geometry).
 * Omitted fields ≡ unspecified at that level; instance may override symbol default.
 */

import type { DiagramDocument, Port, SymbolPort } from './document'

export type PortDirection = 'unspecified' | 'in' | 'out' | 'inout'
export type PortDirectionValue = 'in' | 'out' | 'inout'

const VALUES: PortDirectionValue[] = ['in', 'out', 'inout']

export function isPortDirectionValue(value: unknown): value is PortDirectionValue {
  return typeof value === 'string' && (VALUES as string[]).includes(value)
}

export function symbolPinForPort(doc: DiagramDocument, port: Pick<Port, 'blockId' | 'symbolPortId'>): SymbolPort | undefined {
  if (!port.symbolPortId) return undefined
  const block = doc.blocks.find((item) => item.id === port.blockId)
  const symbol = block?.symbolId ? doc.symbols.find((item) => item.id === block.symbolId) : undefined
  return symbol?.ports.find((item) => item.id === port.symbolPortId)
}

/** Effective direction for rendering / future P5c; does not inspect connectivity. */
export function resolvePortDirection(doc: DiagramDocument, portId: string): PortDirection
export function resolvePortDirection(
  doc: DiagramDocument,
  port: Pick<Port, 'id' | 'direction' | 'blockId' | 'symbolPortId'>,
): PortDirection
export function resolvePortDirection(
  doc: DiagramDocument,
  portOrId: string | Pick<Port, 'id' | 'direction' | 'blockId' | 'symbolPortId'>,
): PortDirection {
  const port =
    typeof portOrId === 'string'
      ? doc.ports.find((item) => item.id === portOrId)
      : portOrId
  if (!port) return 'unspecified'
  if (isPortDirectionValue(port.direction)) return port.direction
  const pin = symbolPinForPort(doc, port)
  if (pin && isPortDirectionValue(pin.direction)) return pin.direction
  return 'unspecified'
}

function symbolDefaultDirection(pin: SymbolPort | undefined): PortDirection {
  return pin && isPortDirectionValue(pin.direction) ? pin.direction : 'unspecified'
}

/** Set instance override; `unspecified` clears override (inherit symbol). Returns false when unchanged. */
export function setInstancePortDirection(doc: DiagramDocument, portId: string, choice: PortDirection): boolean {
  const port = doc.ports.find((item) => item.id === portId)
  if (!port) return false
  const pin = symbolPinForPort(doc, port)
  const base = symbolDefaultDirection(pin)
  if (choice === 'unspecified' || choice === base) {
    if (port.direction === undefined) return false
    delete port.direction
    return true
  }
  if (port.direction === choice) return false
  port.direction = choice
  return true
}

/** Set symbol-pin default; `unspecified` clears. Propagates via resolvePortDirection on instances without override. */
export function setSymbolPortDirection(
  doc: DiagramDocument,
  symbolId: string,
  symbolPortId: string,
  choice: PortDirection,
): boolean {
  const pin = doc.symbols.find((item) => item.id === symbolId)?.ports.find((item) => item.id === symbolPortId)
  if (!pin) return false
  if (choice === 'unspecified') {
    if (pin.direction === undefined) return false
    delete pin.direction
    return true
  }
  if (pin.direction === choice) return false
  pin.direction = choice
  return true
}

export const PORT_DIRECTION_LABELS: Record<PortDirection, string> = {
  unspecified: 'Unspecified',
  in: 'Input',
  out: 'Output',
  inout: 'Bidirectional',
}