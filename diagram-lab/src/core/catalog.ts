import type { ImageAsset, SymbolDefinition, SymbolGuide, SymbolLabel, SymbolPort, SymbolShape } from './document'
import type { SymbolLibrary } from './library'
import { PICTURE_SOURCES, pictureAssets } from './pictures'

const W = 88
const H = 64

function pin(id: string, name: string, side: SymbolPort['side'], t: number): SymbolPort {
  return { id, name, side, t }
}

function text(id: string, value: string, x: number, y: number): SymbolLabel {
  return { id, text: value, x, y }
}

function rect(x = 10, y = 10, width = W - 20, height = H - 20, rx?: number): SymbolShape {
  return { kind: 'rect', x, y, width, height, ...(rx ? { rx } : {}) }
}

function symbol(
  libraryId: string,
  version: number,
  categoryId: string,
  id: string,
  name: string,
  shapes: SymbolShape[],
  ports: SymbolPort[],
  labels: SymbolLabel[] = [],
  width = W,
  height = H,
  revision = 1,
  guides?: SymbolGuide[],
): SymbolDefinition {
  return {
    id,
    name,
    width,
    height,
    shapes,
    ports,
    labels,
    libraryId,
    libraryVersion: version,
    categoryId,
    revision,
    ...(guides && guides.length > 0 ? { guides } : {}),
  }
}

/**
 * Canonical circular DSP body (A2-P1 catalog geometry).
 * Box 120×120, centre (60,60), artwork r=40, outer guide r=60, constant lead length 20.
 * Declarative guides — not hardcoded by symbol id in the editor.
 */
function guidedEllipseSymbol(
  libraryId: string,
  categoryId: string,
  id: string,
  name: string,
  ports: Array<{ id: string; name: string; side: SymbolPort['side']; t: number; u: number }>,
  labels: SymbolLabel[],
): SymbolDefinition {
  const size = 120
  const body: SymbolShape = { kind: 'ellipse', x: 20, y: 20, width: 80, height: 80 }
  const guides: SymbolGuide[] = [
    { id: 'guide_ports', kind: 'ellipse', cx: 60, cy: 60, rx: 60, ry: 60 },
    { id: 'guide_body', kind: 'ellipse', cx: 60, cy: 60, rx: 40, ry: 40 },
  ]
  const pins: SymbolPort[] = ports.map((port) => ({
    id: port.id,
    name: port.name,
    side: port.side,
    t: port.t,
    guideId: 'guide_ports',
    u: port.u,
    lead: 'radial',
    leadGuideId: 'guide_body',
  }))
  return symbol(libraryId, 1, categoryId, id, name, [body], pins, labels, size, size, 4, guides)
}

function library(
  id: string,
  name: string,
  description: string,
  categories: Array<{ id: string; name: string }>,
  symbols: SymbolDefinition[],
  assets: ImageAsset[] = [],
): SymbolLibrary {
  return {
    schemaVersion: 1,
    id,
    name,
    description,
    version: 1,
    origin: 'diagram-lab',
    license: 'MIT',
    builtin: true,
    categories,
    symbols,
    assets,
  }
}

export function builtinLibraries(): SymbolLibrary[] {
  return [generalLibrary(), flowchartLibrary(), logicLibrary(), signalLibrary(), pictureLibrary()].map(
    (item) => JSON.parse(JSON.stringify(item)) as SymbolLibrary,
  )
}

function generalLibrary(): SymbolLibrary {
  const id = 'lib_general'
  const category = 'cat_general'
  return library(id, 'General', 'Plain drawing symbols.', [{ id: category, name: 'General' }], [
    symbol(id, 1, category, 'sym_rectangle', 'Rectangle', [rect()], []),
    symbol(id, 1, category, 'sym_roundrect', 'Rounded rectangle', [rect(10, 10, W - 20, H - 20, 14)], []),
    symbol(id, 1, category, 'sym_ellipse', 'Ellipse', [{ kind: 'ellipse', x: 10, y: 12, width: W - 20, height: H - 24 }], []),
    // A2-P1: 160×80 so centred side ports land on g=20 (W,H multiples of 40).
    symbol(
      id,
      1,
      category,
      'sym_block',
      'Generic block',
      [rect(10, 10, 140, 60)],
      [pin('pin_block_in', 'in', 'left', 0.5), pin('pin_block_out', 'out', 'right', 0.5)],
      [],
      160,
      80,
      2,
    ),
    symbol(id, 1, category, 'sym_textbox', 'Text box', [rect()], [], [text('lbl_textbox', 'Text', 28, 36)]),
  ])
}

function flowchartLibrary(): SymbolLibrary {
  const id = 'lib_flowchart'
  const category = 'cat_flowchart'
  return library(id, 'Flowchart', 'Start, process, and decision symbols.', [{ id: category, name: 'Flowchart' }], [
    symbol(id, 1, category, 'sym_start', 'Start / End', [{ kind: 'ellipse', x: 8, y: 14, width: W - 16, height: H - 28 }], [
      pin('pin_start_in', 'in', 'left', 0.5),
      pin('pin_start_out', 'out', 'right', 0.5),
    ]),
    // A2-P1: 200×120 — centred side ports on g=20 lattice.
    symbol(
      id,
      1,
      category,
      'sym_process',
      'Process',
      [rect(10, 10, 180, 100)],
      [pin('pin_process_in', 'in', 'left', 0.5), pin('pin_process_out', 'out', 'right', 0.5)],
      [],
      200,
      120,
      2,
    ),
    symbol(
      id,
      1,
      category,
      'sym_decision',
      'Decision',
      [{ kind: 'polygon', points: [{ x: 44, y: 6 }, { x: 82, y: 32 }, { x: 44, y: 58 }, { x: 6, y: 32 }] }],
      [pin('pin_decision_in', 'in', 'left', 0.5), pin('pin_decision_yes', 'yes', 'right', 0.5), pin('pin_decision_no', 'no', 'bottom', 0.5)],
    ),
    symbol(
      id,
      1,
      category,
      'sym_io',
      'Input / Output',
      [{ kind: 'polygon', points: [{ x: 22, y: 12 }, { x: 80, y: 12 }, { x: 66, y: 52 }, { x: 8, y: 52 }] }],
      [pin('pin_io_in', 'in', 'left', 0.5), pin('pin_io_out', 'out', 'right', 0.5)],
    ),
  ])
}

function logicLibrary(): SymbolLibrary {
  const id = 'lib_logic'
  const category = 'cat_logic'
  const andShape: SymbolShape = { kind: 'polygon', points: [{ x: 8, y: 10 }, { x: 40, y: 10 }, { x: 64, y: 32 }, { x: 40, y: 54 }, { x: 8, y: 54 }] }
  const orShape: SymbolShape = {
    kind: 'polygon',
    points: [{ x: 8, y: 10 }, { x: 34, y: 10 }, { x: 70, y: 32 }, { x: 34, y: 54 }, { x: 8, y: 54 }, { x: 20, y: 32 }],
  }
  return library(id, 'Digital Logic', 'Gates and storage symbols. They have no simulation and no HDL.', [{ id: category, name: 'Digital Logic' }], [
    symbol(id, 1, category, 'sym_and', 'AND', [andShape], [pin('pin_and_a', 'a', 'left', 0.32), pin('pin_and_b', 'b', 'left', 0.68), pin('pin_and_y', 'y', 'right', 0.5)]),
    symbol(id, 1, category, 'sym_or', 'OR', [orShape], [pin('pin_or_a', 'a', 'left', 0.32), pin('pin_or_b', 'b', 'left', 0.68), pin('pin_or_y', 'y', 'right', 0.5)]),
    symbol(id, 1, category, 'sym_not', 'NOT', [
      { kind: 'polygon', points: [{ x: 8, y: 12 }, { x: 8, y: 52 }, { x: 58, y: 32 }] },
      { kind: 'ellipse', x: 58, y: 26, width: 12, height: 12 },
    ], [pin('pin_not_a', 'a', 'left', 0.5), pin('pin_not_y', 'y', 'right', 0.5)]),
    symbol(id, 1, category, 'sym_nand', 'NAND', [andShape, { kind: 'ellipse', x: 62, y: 26, width: 12, height: 12 }], [
      pin('pin_nand_a', 'a', 'left', 0.32),
      pin('pin_nand_b', 'b', 'left', 0.68),
      pin('pin_nand_y', 'y', 'right', 0.5),
    ]),
    symbol(id, 1, category, 'sym_nor', 'NOR', [orShape, { kind: 'ellipse', x: 66, y: 26, width: 12, height: 12 }], [
      pin('pin_nor_a', 'a', 'left', 0.32),
      pin('pin_nor_b', 'b', 'left', 0.68),
      pin('pin_nor_y', 'y', 'right', 0.5),
    ]),
    symbol(id, 1, category, 'sym_xor', 'XOR', [orShape, { kind: 'line', x1: 4, y1: 16, x2: 16, y2: 32 }, { kind: 'line', x1: 16, y1: 32, x2: 4, y2: 48 }], [
      pin('pin_xor_a', 'a', 'left', 0.32),
      pin('pin_xor_b', 'b', 'left', 0.68),
      pin('pin_xor_y', 'y', 'right', 0.5),
    ]),
    symbol(
      id,
      1,
      category,
      'sym_mux',
      'Multiplexer',
      [{ kind: 'polygon', points: [{ x: 14, y: 8 }, { x: 74, y: 16 }, { x: 74, y: 48 }, { x: 14, y: 56 }] }],
      [pin('pin_mux_d0', 'd0', 'left', 0.3), pin('pin_mux_d1', 'd1', 'left', 0.7), pin('pin_mux_sel', 'sel', 'bottom', 0.5), pin('pin_mux_y', 'y', 'right', 0.5)],
      [text('lbl_mux', 'MUX', 30, 36)],
    ),
    symbol(id, 1, category, 'sym_dff', 'D flip-flop', [rect()], [
      pin('pin_dff_d', 'D', 'left', 0.35),
      pin('pin_dff_clk', 'clk', 'bottom', 0.5),
      pin('pin_dff_q', 'Q', 'right', 0.35),
      pin('pin_dff_qn', 'Qn', 'right', 0.7),
    ], [text('lbl_dff', 'DFF', 30, 28)]),
    symbol(id, 1, category, 'sym_register', 'Register', [rect(8, 10, 112, 44)], [
      pin('pin_reg_d', 'D', 'left', 0.5),
      pin('pin_reg_clk', 'clk', 'bottom', 0.5),
      pin('pin_reg_q', 'Q', 'right', 0.5),
    ], [text('lbl_reg', 'REG', 48, 36)], 128, H),
    symbol(id, 1, category, 'sym_logic_counter', 'Counter', [rect()], [
      pin('pin_counter_clk', 'clk', 'left', 0.35),
      pin('pin_counter_rst', 'rst', 'left', 0.7),
      pin('pin_counter_q', 'Q', 'right', 0.5),
    ], [text('lbl_counter', 'CTR', 30, 28)]),
  ])
}

function pictureLibrary(): SymbolLibrary {
  const id = 'lib_pictures'
  const category = 'cat_pictures'
  return library(
    id,
    'Pictures',
    'Reference pictures. They have no electrical function and no HDL.',
    [{ id: category, name: 'Pictures' }],
    PICTURE_SOURCES.map((source) => {
      // A2-P1: Oscillator uses 160×120 with centred 120×80 image so mid-side ports are on-grid.
      const oscillator = source.symbolId === 'sym_oscillator'
      const boxW = 160
      const boxH = oscillator ? 120 : 108
      const imageY = oscillator ? 20 : 4
      const labelY = oscillator ? 112 : 100
      return symbol(
        id,
        1,
        category,
        source.symbolId,
        source.title,
        [{ kind: 'image', assetId: source.assetId, x: 20, y: imageY, width: 120, height: 80, lockAspect: true }],
        source.pins.map((item) => pin(item.id, item.name, item.side, item.t)),
        [text(`lbl_${source.symbolId}`, source.label, 58, labelY)],
        boxW,
        boxH,
        oscillator ? 2 : 1,
      )
    }),
    pictureAssets(),
  )
}

function signalLibrary(): SymbolLibrary {
  const id = 'lib_signal'
  const category = 'cat_signal'
  return library(id, 'Signal Processing', 'Block symbols for signal flow. They have no simulation and no HDL.', [{ id: category, name: 'Signal Processing' }], [
    symbol(id, 1, category, 'sym_gain', 'Gain', [{ kind: 'polygon', points: [{ x: 8, y: 10 }, { x: 8, y: 54 }, { x: 76, y: 32 }] }], [
      pin('pin_gain_in', 'in', 'left', 0.5),
      pin('pin_gain_out', 'out', 'right', 0.5),
    ]),
    // A2-P1: declarative ellipse guides + radial leads (not symbol-name special cases).
    guidedEllipseSymbol(
      id,
      category,
      'sym_adder',
      'Adder',
      [
        { id: 'pin_adder_a', name: 'a', side: 'left', t: 0.35, u: 0.58 },
        { id: 'pin_adder_b', name: 'b', side: 'left', t: 0.7, u: 0.42 },
        { id: 'pin_adder_y', name: 'y', side: 'right', t: 0.5, u: 0 },
      ],
      [text('lbl_adder', '+', 54, 66)],
    ),
    guidedEllipseSymbol(
      id,
      category,
      'sym_multiplier',
      'Multiplier',
      [
        { id: 'pin_mul_a', name: 'a', side: 'left', t: 0.35, u: 0.58 },
        { id: 'pin_mul_b', name: 'b', side: 'left', t: 0.7, u: 0.42 },
        { id: 'pin_mul_y', name: 'y', side: 'right', t: 0.5, u: 0 },
      ],
      [text('lbl_mul', 'x', 54, 66)],
    ),
    symbol(id, 1, category, 'sym_integrator', 'Integrator', [rect()], [pin('pin_int_in', 'in', 'left', 0.5), pin('pin_int_out', 'out', 'right', 0.5)], [text('lbl_int', '1/s', 30, 36)]),
    symbol(id, 1, category, 'sym_delay', 'Delay', [rect()], [pin('pin_delay_in', 'in', 'left', 0.5), pin('pin_delay_out', 'out', 'right', 0.5)], [text('lbl_delay', 'z-1', 30, 36)]),
    symbol(id, 1, category, 'sym_filter', 'Filter', [rect()], [pin('pin_filter_in', 'in', 'left', 0.5), pin('pin_filter_out', 'out', 'right', 0.5)], [text('lbl_filter', 'H', 38, 36)]),
  ])
}
