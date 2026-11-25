import type { DiagramDocument } from './document'

/** Two blocks, one orthogonal wire, one label anchored on the vertical segment. */
export function sampleDocument(): DiagramDocument {
  return {
    schemaVersion: 1,
    id: 'doc_demo',
    blocks: [
      { id: 'blk_a', name: 'Block A', x: 80, y: 120, width: 160, height: 120 },
      { id: 'blk_b', name: 'Block B', x: 460, y: 260, width: 160, height: 120 },
    ],
    symbols: [],
    assets: [],
    ports: [
      { id: 'prt_a1', blockId: 'blk_a', name: 'p1', side: 'right' },
      { id: 'prt_b1', blockId: 'blk_b', name: 'q1', side: 'left' },
    ],
    nets: [{ id: 'net_link', name: 'link' }],
    junctions: [],
    segments: [
      {
        id: 'seg_link',
        netId: 'net_link',
        points: [
          { x: 240, y: 180 },
          { x: 350, y: 180 },
          { x: 350, y: 320 },
          { x: 460, y: 320 },
        ],
        start: { kind: 'port', portId: 'prt_a1' },
        end: { kind: 'port', portId: 'prt_b1' },
        routed: 'manual',
      },
    ],
    labels: [
      {
        id: 'lbl_link',
        text: 'link',
        anchor: { kind: 'segment', segmentId: 'seg_link', edge: 1, distance: 70, offset: 16 },
      },
    ],
    strokes: [],
    groups: [],
    extensions: {},
    extra: {},
  }
}
