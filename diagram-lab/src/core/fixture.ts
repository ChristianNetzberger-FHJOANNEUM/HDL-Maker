import type { DiagramDocument, Point } from './document'
import { portAnchor } from './geometry'

/** Ten blocks, one branched net, a crossing, a long manual route, and a free wire. */
export function netFixture(): DiagramDocument {
  const blocks = [
    ['blk_a', 'A', 40, 40],
    ['blk_b', 'B', 280, 40],
    ['blk_c', 'C', 520, 40],
    ['blk_d', 'D', 760, 40],
    ['blk_e', 'E', 1000, 40],
    ['blk_f', 'F', 40, 220],
    ['blk_g', 'G', 280, 220],
    ['blk_h', 'H', 520, 220],
    ['blk_i', 'I', 760, 220],
    ['blk_j', 'J', 1000, 220],
  ] as const
  const doc: DiagramDocument = {
    schemaVersion: 1,
    id: 'doc_nets',
    blocks: blocks.map(([id, name, x, y]) => ({ id, name, x, y, width: 120, height: 80 })),
    symbols: [],
    assets: [],
    ports: blocks.flatMap(([id]) => [
      { id: `${id}_l`, blockId: id, name: 'l', side: 'left' as const },
      { id: `${id}_r`, blockId: id, name: 'r', side: 'right' as const },
    ]),
    nets: [
      { id: 'net_main', name: 'main' },
      { id: 'net_cross', name: 'cross' },
      { id: 'net_hop', name: 'hop' },
      { id: 'net_long', name: 'long' },
      { id: 'net_free', name: 'free' },
    ],
    junctions: [
      { id: 'jnc_1', netId: 'net_main', x: 220, y: 0 },
      { id: 'jnc_2', netId: 'net_main', x: 220, y: 0 },
      { id: 'jnc_3', netId: 'net_main', x: 220, y: 0 },
    ],
    segments: [],
    labels: [],
    strokes: [],
    groups: [],
    extensions: {},
    extra: {},
  }
  const pin = (portId: string): Point => portAnchor(doc, portId) ?? { x: 0, y: 0 }
  const a = pin('blk_a_r')
  const b = pin('blk_b_l')
  const c = pin('blk_c_l')
  const f = pin('blk_f_r')
  doc.junctions[0].y = a.y
  doc.junctions[1].y = 160
  doc.junctions[2].y = f.y
  const j1 = doc.junctions[0]
  const j2 = doc.junctions[1]
  const j3 = doc.junctions[2]
  doc.segments.push(
    wire('seg_ab1', 'net_main', [a, { x: j1.x, y: j1.y }], { kind: 'port', portId: 'blk_a_r' }, { kind: 'junction', junctionId: 'jnc_1' }),
    wire('seg_ab2', 'net_main', [{ x: j1.x, y: j1.y }, b], { kind: 'junction', junctionId: 'jnc_1' }, { kind: 'port', portId: 'blk_b_l' }),
    wire('seg_link', 'net_main', [{ x: j1.x, y: j1.y }, { x: j2.x, y: j2.y }], { kind: 'junction', junctionId: 'jnc_1' }, { kind: 'junction', junctionId: 'jnc_2' }),
    wire('seg_c', 'net_main', [{ x: j2.x, y: j2.y }, { x: c.x, y: j2.y }, c], { kind: 'junction', junctionId: 'jnc_2' }, { kind: 'port', portId: 'blk_c_l' }),
    wire('seg_down', 'net_main', [{ x: j2.x, y: j2.y }, { x: j3.x, y: j3.y }], { kind: 'junction', junctionId: 'jnc_2' }, { kind: 'junction', junctionId: 'jnc_3' }),
    wire('seg_f', 'net_main', [{ x: j3.x, y: j3.y }, f], { kind: 'junction', junctionId: 'jnc_3' }, { kind: 'port', portId: 'blk_f_r' }),
  )
  const g = pin('blk_g_r')
  const i = pin('blk_i_l')
  doc.segments.push(wire('seg_cross', 'net_cross', [g, i], { kind: 'port', portId: 'blk_g_r' }, { kind: 'port', portId: 'blk_i_l' }))
  doc.segments.push(
    wire(
      'seg_hop',
      'net_hop',
      [
        { x: 600, y: 200 },
        { x: 600, y: 340 },
      ],
      { kind: 'free', x: 600, y: 200 },
      { kind: 'free', x: 600, y: 340 },
    ),
  )
  const e = pin('blk_e_r')
  const j = pin('blk_j_l')
  doc.segments.push(
    wire(
      'seg_long',
      'net_long',
      [e, { x: 1180, y: e.y }, { x: 1180, y: 120 }, { x: 1240, y: 120 }, { x: 1240, y: 160 }, { x: 1300, y: 160 }, { x: 1300, y: 220 }, { x: 1300, y: j.y }, j],
      { kind: 'port', portId: 'blk_e_r' },
      { kind: 'port', portId: 'blk_j_l' },
    ),
  )
  doc.segments.push(
    wire(
      'seg_free',
      'net_free',
      [
        { x: 40, y: 400 },
        { x: 140, y: 400 },
        { x: 140, y: 460 },
      ],
      { kind: 'free', x: 40, y: 400 },
      { kind: 'free', x: 140, y: 460 },
    ),
  )
  doc.labels.push(
    { id: 'lbl_main_a', text: 'main', role: 'name', anchor: { kind: 'segment', segmentId: 'seg_ab1', edge: 0, distance: 20, offset: 14 } },
    { id: 'lbl_main_b', text: 'main', role: 'name', anchor: { kind: 'segment', segmentId: 'seg_down', edge: 0, distance: 24, offset: -12 } },
  )
  return doc
}

function wire(
  id: string,
  netId: string,
  points: Point[],
  start: DiagramDocument['segments'][number]['start'],
  end: DiagramDocument['segments'][number]['end'],
): DiagramDocument['segments'][number] {
  return { id, netId, points, start, end, routed: 'manual' }
}
