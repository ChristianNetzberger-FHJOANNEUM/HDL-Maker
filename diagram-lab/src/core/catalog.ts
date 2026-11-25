import type { ImageAsset, SymbolDefinition, SymbolLabel, SymbolPort, SymbolShape } from './document'
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
): SymbolDefinition {
  return { id, name, width, height, shapes, ports, labels, libraryId, libraryVersion: version, categoryId, revision: 1 }
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
    symbol(id, 1, category, 'sym_block', 'Generic block', [rect()], [pin('pin_block_in', 'in', 'left', 0.5), pin('pin_block_out', 'out', 'right', 0.5)]),
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
    symbol(id, 1, category, 'sym_process', 'Process', [rect()], [pin('pin_process_in', 'in', 'left', 0.5), pin('pin_process_out', 'out', 'right', 0.5)]),
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
    PICTURE_SOURCES.map((source) =>
      symbol(
        id,
        1,
        category,
        source.symbolId,
        source.title,
        [{ kind: 'image', assetId: source.assetId, x: 20, y: 4, width: 120, height: 80, lockAspect: true }],
        source.pins.map((item) => pin(item.id, item.name, item.side, item.t)),
        [text(`lbl_${source.symbolId}`, source.label, 58, 100)],
        160,
        108,
      ),
    ),
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
    symbol(id, 1, category, 'sym_adder', 'Adder', [{ kind: 'ellipse', x: 16, y: 8, width: 56, height: 48 }], [
      pin('pin_adder_a', 'a', 'left', 0.35),
      pin('pin_adder_b', 'b', 'left', 0.7),
      pin('pin_adder_y', 'y', 'right', 0.5),
    ], [text('lbl_adder', '+', 40, 38)]),
    symbol(id, 1, category, 'sym_multiplier', 'Multiplier', [{ kind: 'ellipse', x: 16, y: 8, width: 56, height: 48 }], [
      pin('pin_mul_a', 'a', 'left', 0.35),
      pin('pin_mul_b', 'b', 'left', 0.7),
      pin('pin_mul_y', 'y', 'right', 0.5),
    ], [text('lbl_mul', 'x', 40, 38)]),
    symbol(id, 1, category, 'sym_integrator', 'Integrator', [rect()], [pin('pin_int_in', 'in', 'left', 0.5), pin('pin_int_out', 'out', 'right', 0.5)], [text('lbl_int', '1/s', 30, 36)]),
    symbol(id, 1, category, 'sym_delay', 'Delay', [rect()], [pin('pin_delay_in', 'in', 'left', 0.5), pin('pin_delay_out', 'out', 'right', 0.5)], [text('lbl_delay', 'z-1', 30, 36)]),
    symbol(id, 1, category, 'sym_filter', 'Filter', [rect()], [pin('pin_filter_in', 'in', 'left', 0.5), pin('pin_filter_out', 'out', 'right', 0.5)], [text('lbl_filter', 'H', 38, 36)]),
  ])
}
