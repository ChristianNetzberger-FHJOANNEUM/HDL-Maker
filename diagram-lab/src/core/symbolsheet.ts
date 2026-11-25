import type { DiagramDocument } from './document'
import { emptyDocument } from './edit'
import { portAnchor } from './geometry'
import { commitWire } from './nets'
import { defineSymbol, instantiateSymbol } from './symbols'

/** Two instances of one counter symbol, wired by their own port ids. */
export function symbolSheet(): DiagramDocument {
  const doc = emptyDocument()
  doc.id = 'doc_symbols'
  defineSymbol(doc, {
    id: 'sym_counter',
    name: 'Counter',
    width: 160,
    height: 120,
    ports: [
      { id: 'pin_clk', name: 'clk', side: 'left', t: 0.3 },
      { id: 'pin_rst', name: 'rst', side: 'left', t: 0.7 },
      { id: 'pin_q', name: 'q', side: 'right', t: 0.5 },
    ],
    shapes: [
      { kind: 'rect', x: 8, y: 8, width: 144, height: 104 },
      { kind: 'text', x: 48, y: 58, text: 'CTR' },
    ],
  })
  const u1 = instantiateSymbol(doc, 'sym_counter', { x: 80, y: 80 }, 'U1')
  const u2 = instantiateSymbol(doc, 'sym_counter', { x: 420, y: 160 }, 'U2')
  if (!u1 || !u2) return doc
  const q = doc.ports.find((port) => port.blockId === u1 && port.symbolPortId === 'pin_q')
  const clk = doc.ports.find((port) => port.blockId === u2 && port.symbolPortId === 'pin_clk')
  const from = q ? portAnchor(doc, q.id) : null
  const to = clk ? portAnchor(doc, clk.id) : null
  if (q && clk && from && to) {
    const trunk = (from.x + to.x) / 2
    commitWire(
      doc,
      [from, { x: trunk, y: from.y }, { x: trunk, y: to.y }, to],
      { kind: 'port', portId: q.id, point: from },
      { kind: 'port', portId: clk.id, point: to },
    )
  }
  return doc
}
