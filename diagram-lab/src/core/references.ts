/**
 * Three projects that stay available from the diagram-lab toolbar.
 * They use the same model as a sheet the user builds. No HDL fields.
 */
import { base64ToBytes, sha256Sync } from './assets'
import { addComponent, componentById, createProject, documentById, instantiateComponent, validateProject, type DiagramProject } from './component'
import { builtinLibraries } from './catalog'
import { emptyDocument, groupBlocks, linkPorts } from './edit'
import { adoptLibrarySymbol, placeLibrarySymbol } from './library'
import {
  createId,
  type DiagramDocument,
  type ImageAsset,
  type Point,
  type PortSide,
  type SymbolDefinition,
} from './document'
import { portAnchor } from './geometry'
import { addNameLabel } from './nets'
import { defineSymbol, instantiateSymbol } from './symbols'

type Logic = { id: string; name: string }
type Pin = { id: string; name: string; side: PortSide; t: number }

const PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAABI0lEQVR4nO2ZOw7CMAyGewAO0IGRgbFzD8DMzEk4LIdhQIrakvoVp7YrS/9kQeIvOH6E4f54hdZg7oEOwOV6C6cEsFYCWCsBrIUAjNNc/ZofewJY21cA4zSH03G/wPPzLgoWQkvXNwwBAKreF4ZIAFWjdwDgpKtgvgDQWHcNQLysewz2daCEuOInj6sD/+eK1gdfIcR1iAXcHUB2ol4AxJdS3GJAAIJC05JVZC0GAsDK04153QVAv8pNAjBM5+J18EtMySqK3SW3yaMCAGlOtz3mhi4pjQKTlPqAAjP8DpQNsOdojxFxs111kJAAALNVi6PEGRrYkVeJ4bXUn09Q7yWtBLBWp/ef5Y75LuTPngDW9rP/P+BfCWCtBLDWCiCuwgN8ASkug06rqFkeAAAAAElFTkSuQmCC'

function pixelAsset(): ImageAsset {
  const bytes = base64ToBytes(PIXEL)
  return {
    id: 'ast_ref_pixel',
    name: 'pixel.png',
    mime: 'image/png',
    data: PIXEL,
    width: 64,
    height: 48,
    checksum: sha256Sync(bytes),
  }
}

function rootOf(project: DiagramProject): DiagramDocument {
  const root = documentById(project, project.rootDocumentId)
  if (!root) throw new Error('The reference root is missing.')
  return root
}

function sheet(project: DiagramProject, documentId: string): DiagramDocument {
  const doc = documentById(project, documentId)
  if (!doc) throw new Error('A reference sheet is missing.')
  return doc
}

function catalog(libraryId: string, symbolId: string): { symbol: SymbolDefinition; assets: ImageAsset[] } {
  const library = builtinLibraries().find((item) => item.id === libraryId)
  const symbol = library?.symbols.find((item) => item.id === symbolId)
  if (!library || !symbol) throw new Error(`Missing library symbol ${symbolId}.`)
  return { symbol, assets: library.assets ?? [] }
}

function diagramPart(
  project: DiagramProject,
  spec: {
    name: string
    ports: Logic[]
    pins: Pin[]
    libraryId?: string
    librarySymbolId?: string
    width?: number
    height?: number
  },
): { project: DiagramProject; componentId: string; documentId: string } {
  const root = rootOf(project)
  let symbolId: string
  if (spec.libraryId && spec.librarySymbolId) {
    const source = catalog(spec.libraryId, spec.librarySymbolId)
    const adopted = adoptLibrarySymbol(root, source.symbol, source.assets)
    if (!adopted.ok) throw new Error(adopted.message)
    symbolId = source.symbol.id
  } else {
    symbolId = defineSymbol(root, {
      name: spec.name,
      width: spec.width ?? 120,
      height: spec.height ?? 72,
      ports: spec.pins,
    })
  }
  const added = addComponent(project, {
    name: spec.name,
    ports: spec.ports,
    symbolId,
    bindings: spec.ports.map((port, index) => ({
      interfacePortId: port.id,
      symbolPortId: spec.pins[index].id,
    })),
    implementation: { kind: 'diagram', document: emptyDocument() },
  })
  if (!added.ok) throw new Error(added.message)
  const component = componentById(added.project, added.value.componentId)
  const documentId = component?.implementation.documentId
  if (!documentId) throw new Error(`${spec.name} has no diagram.`)
  return { project: added.project, componentId: added.value.componentId, documentId }
}

function placePart(
  project: DiagramProject,
  documentId: string,
  componentId: string,
  at: Point,
  name: string,
): { project: DiagramProject; blockId: string } {
  const placed = instantiateComponent(project, documentId, componentId, at, name)
  if (!placed.ok) throw new Error(placed.message)
  const block = documentById(placed.project, documentId)?.blocks.find((item) => item.id === placed.value.blockId)
  if (block) block.name = name
  return { project: placed.project, blockId: placed.value.blockId }
}

function placeGraphic(doc: DiagramDocument, libraryId: string, symbolId: string, at: Point, name: string): string {
  const source = catalog(libraryId, symbolId)
  const placed = placeLibrarySymbol(doc, source.symbol, at, name, source.assets)
  if (!placed.ok) throw new Error(placed.message)
  const block = doc.blocks.find((item) => item.id === placed.blockId)
  if (block) block.name = name
  return placed.blockId
}

function portByInterface(doc: DiagramDocument, blockId: string, interfacePortId: string): string {
  const port = doc.ports.find((item) => item.blockId === blockId && item.interfacePortId === interfacePortId)
  if (!port) throw new Error(`Missing ${interfacePortId}.`)
  return port.id
}

function portBySymbol(doc: DiagramDocument, blockId: string, symbolPortId: string): string {
  const port = doc.ports.find((item) => item.blockId === blockId && item.symbolPortId === symbolPortId)
  if (!port) throw new Error(`Missing ${symbolPortId}.`)
  return port.id
}

function portByName(doc: DiagramDocument, blockId: string, name: string): string {
  const port = doc.ports.find((item) => item.blockId === blockId && item.name === name)
  if (!port) throw new Error(`Missing ${name}.`)
  return port.id
}

function connect(doc: DiagramDocument, portIds: string[], name: string): void {
  if (portIds.length < 2) throw new Error(`${name} needs two ends.`)
  if (portIds.length === 2) {
    const segmentId = linkPorts(doc, portIds[0], portIds[1], name)
    if (!segmentId) throw new Error(`Could not wire ${name}.`)
    return
  }
  const anchors = portIds.map((id) => {
    const at = portAnchor(doc, id)
    if (!at) throw new Error(`Could not place ${name}.`)
    return at
  })
  const x = anchors.reduce((sum, point) => sum + point.x, 0) / anchors.length
  const y = anchors.reduce((sum, point) => sum + point.y, 0) / anchors.length
  const netId = createId('net')
  const junctionId = createId('jnc')
  doc.nets.push({ id: netId, name })
  doc.junctions.push({ id: junctionId, netId, x, y })
  portIds.forEach((portId, index) => {
    const at = anchors[index]
    const segmentId = createId('seg')
    doc.segments.push({
      id: segmentId,
      netId,
      routed: 'manual',
      points: [
        { x, y },
        { x: at.x, y },
        { x: at.x, y: at.y },
      ],
      start: { kind: 'junction', junctionId },
      end: { kind: 'port', portId },
    })
    if (index === 0) addNameLabel(doc, segmentId, 0, 10, 14)
  })
}

function boundary(
  doc: DiagramDocument,
  ports: Array<{ interfacePortId: string; name: string; side: PortSide; t: number }>,
): string {
  const id = createId('blk')
  doc.blocks.push({ id, name: 'Boundary', x: 36, y: 64, width: 108, height: 180 })
  for (const port of ports) {
    doc.ports.push({
      id: createId('prt'),
      blockId: id,
      name: port.name,
      side: port.side,
      t: port.t,
      interfacePortId: port.interfacePortId,
    })
  }
  return id
}

function plain(
  doc: DiagramDocument,
  name: string,
  at: Point,
  size: { width: number; height: number },
  ports: Array<{ name: string; side: PortSide; t: number }>,
): string {
  const id = createId('blk')
  doc.blocks.push({ id, name, x: at.x, y: at.y, width: size.width, height: size.height })
  for (const port of ports) {
    doc.ports.push({ id: createId('prt'), blockId: id, name: port.name, side: port.side, t: port.t })
  }
  return id
}

function finish(project: DiagramProject): DiagramProject {
  const problems = validateProject(project)
  if (problems.length) throw new Error(problems.map((item) => item.message).join(' '))
  return project
}

/** Clock, reset, a datapath with two counters, a control unit, switches, and LEDs. */
export function digitalProject(): DiagramProject {
  let project = createProject('Digital System')
  const stage = diagramPart(project, {
    name: 'Stage',
    width: 96,
    height: 56,
    ports: [{ id: 'ifp_stage_d', name: 'd' }],
    pins: [{ id: 'pin_ref_stage_d', name: 'd', side: 'left', t: 0.5 }],
  })
  project = stage.project
  const counter = diagramPart(project, {
    name: 'Counter',
    ports: [
      { id: 'ifp_ctr_clk', name: 'clk' },
      { id: 'ifp_ctr_rst', name: 'rst' },
      { id: 'ifp_ctr_q', name: 'q' },
    ],
    pins: [
      { id: 'pin_counter_clk', name: 'clk', side: 'left', t: 0.3 },
      { id: 'pin_counter_rst', name: 'rst', side: 'left', t: 0.7 },
      { id: 'pin_counter_q', name: 'Q', side: 'right', t: 0.5 },
    ],
    libraryId: 'lib_logic',
    librarySymbolId: 'sym_logic_counter',
  })
  project = counter.project
  const clock = diagramPart(project, {
    name: 'Clock Generator',
    ports: [{ id: 'ifp_clk_out', name: 'clk' }],
    pins: [{ id: 'pin_ref_clk_out', name: 'clk', side: 'right', t: 0.5 }],
  })
  project = clock.project
  const reset = diagramPart(project, {
    name: 'Reset Controller',
    ports: [{ id: 'ifp_rst_out', name: 'rst' }],
    pins: [{ id: 'pin_ref_rst_out', name: 'rst', side: 'right', t: 0.5 }],
  })
  project = reset.project
  const datapath = diagramPart(project, {
    name: 'Datapath',
    width: 140,
    height: 128,
    ports: [
      { id: 'ifp_dp_clk', name: 'clk' },
      { id: 'ifp_dp_rst', name: 'rst' },
      { id: 'ifp_dp_d', name: 'd' },
      { id: 'ifp_dp_sel', name: 'sel' },
      { id: 'ifp_dp_q', name: 'q' },
    ],
    pins: [
      { id: 'pin_ref_dp_clk', name: 'clk', side: 'left', t: 0.2 },
      { id: 'pin_ref_dp_rst', name: 'rst', side: 'left', t: 0.42 },
      { id: 'pin_ref_dp_d', name: 'd', side: 'left', t: 0.7 },
      { id: 'pin_ref_dp_sel', name: 'sel', side: 'bottom', t: 0.55 },
      { id: 'pin_ref_dp_q', name: 'q', side: 'right', t: 0.4 },
    ],
  })
  project = datapath.project
  const control = diagramPart(project, {
    name: 'Control Unit',
    width: 140,
    height: 96,
    ports: [
      { id: 'ifp_cu_clk', name: 'clk' },
      { id: 'ifp_cu_rst', name: 'rst' },
      { id: 'ifp_cu_sel', name: 'sel' },
    ],
    pins: [
      { id: 'pin_ref_cu_clk', name: 'clk', side: 'left', t: 0.32 },
      { id: 'pin_ref_cu_rst', name: 'rst', side: 'left', t: 0.68 },
      { id: 'pin_ref_cu_sel', name: 'sel', side: 'right', t: 0.5 },
    ],
  })
  project = control.project

  project = placePart(project, counter.documentId, stage.componentId, { x: 300, y: 80 }, 'Stage').project
  project = placePart(project, datapath.documentId, counter.componentId, { x: 260, y: 40 }, 'U1').project
  project = placePart(project, datapath.documentId, counter.componentId, { x: 260, y: 200 }, 'U2').project
  project = placePart(project, project.rootDocumentId, clock.componentId, { x: 280, y: 36 }, 'Clock').project
  project = placePart(project, project.rootDocumentId, reset.componentId, { x: 280, y: 200 }, 'Reset').project
  project = placePart(project, project.rootDocumentId, datapath.componentId, { x: 560, y: 120 }, 'Datapath').project
  project = placePart(project, project.rootDocumentId, control.componentId, { x: 560, y: 340 }, 'Control').project

  const root = rootOf(project)
  const sw1 = placeGraphic(root, 'lib_pictures', 'sym_switch', { x: 36, y: 40 }, 'SW1')
  const sw2 = placeGraphic(root, 'lib_pictures', 'sym_switch', { x: 36, y: 240 }, 'SW2')
  const led0 = placeGraphic(root, 'lib_pictures', 'sym_led', { x: 880, y: 80 }, 'LED0')
  const led1 = placeGraphic(root, 'lib_pictures', 'sym_led', { x: 880, y: 280 }, 'LED1')
  const clockId = root.blocks.find((item) => item.name === 'Clock')?.id
  const resetId = root.blocks.find((item) => item.name === 'Reset')?.id
  const dpId = root.blocks.find((item) => item.name === 'Datapath')?.id
  const cuId = root.blocks.find((item) => item.name === 'Control')?.id
  if (!clockId || !resetId || !dpId || !cuId) throw new Error('A root block is missing.')
  connect(root, [
    portByInterface(root, clockId, 'ifp_clk_out'),
    portByInterface(root, dpId, 'ifp_dp_clk'),
    portByInterface(root, cuId, 'ifp_cu_clk'),
  ], 'clk')
  connect(root, [
    portByInterface(root, resetId, 'ifp_rst_out'),
    portByInterface(root, dpId, 'ifp_dp_rst'),
    portByInterface(root, cuId, 'ifp_cu_rst'),
  ], 'rst')
  connect(root, [portBySymbol(root, sw1, 'pin_sw_c'), portByInterface(root, dpId, 'ifp_dp_d')], 'sw')
  connect(root, [portBySymbol(root, sw2, 'pin_sw_c'), portBySymbol(root, led1, 'pin_led_a')], 'sw2')
  connect(root, [portByInterface(root, cuId, 'ifp_cu_sel'), portByInterface(root, dpId, 'ifp_dp_sel')], 'sel')
  connect(root, [portByInterface(root, dpId, 'ifp_dp_q'), portBySymbol(root, led0, 'pin_led_a')], 'led0')

  const counterSheet = sheet(project, counter.documentId)
  const counterEdge = boundary(counterSheet, [
    { interfacePortId: 'ifp_ctr_clk', name: 'clk', side: 'right', t: 0.28 },
    { interfacePortId: 'ifp_ctr_rst', name: 'rst', side: 'right', t: 0.62 },
    { interfacePortId: 'ifp_ctr_q', name: 'q', side: 'left', t: 0.45 },
  ])
  const bit = plain(counterSheet, 'Bit', { x: 300, y: 220 }, { width: 96, height: 64 }, [
    { name: 'clk', side: 'left', t: 0.32 },
    { name: 'rst', side: 'left', t: 0.68 },
  ])
  const stageId = counterSheet.blocks.find((item) => item.name === 'Stage')?.id
  if (!stageId) throw new Error('Stage is missing.')
  connect(counterSheet, [portByInterface(counterSheet, counterEdge, 'ifp_ctr_clk'), portByName(counterSheet, bit, 'clk')], 'clk')
  connect(counterSheet, [portByInterface(counterSheet, counterEdge, 'ifp_ctr_rst'), portByName(counterSheet, bit, 'rst')], 'rst')
  connect(counterSheet, [portByInterface(counterSheet, stageId, 'ifp_stage_d'), portByInterface(counterSheet, counterEdge, 'ifp_ctr_q')], 'q')

  const stageSheet = sheet(project, stage.documentId)
  const stageEdge = boundary(stageSheet, [{ interfacePortId: 'ifp_stage_d', name: 'd', side: 'right', t: 0.5 }])
  const cell = plain(stageSheet, 'Cell', { x: 280, y: 100 }, { width: 88, height: 56 }, [
    { name: 'd', side: 'left', t: 0.5 },
  ])
  connect(stageSheet, [portByInterface(stageSheet, stageEdge, 'ifp_stage_d'), portByName(stageSheet, cell, 'd')], 'd')

  const path = sheet(project, datapath.documentId)
  const pathEdge = boundary(path, [
    { interfacePortId: 'ifp_dp_clk', name: 'clk', side: 'right', t: 0.16 },
    { interfacePortId: 'ifp_dp_rst', name: 'rst', side: 'right', t: 0.34 },
    { interfacePortId: 'ifp_dp_d', name: 'd', side: 'right', t: 0.56 },
    { interfacePortId: 'ifp_dp_sel', name: 'sel', side: 'right', t: 0.78 },
    { interfacePortId: 'ifp_dp_q', name: 'q', side: 'left', t: 0.4 },
  ])
  const reg = placeGraphic(path, 'lib_logic', 'sym_register', { x: 250, y: 360 }, 'Register')
  const mux = placeGraphic(path, 'lib_logic', 'sym_mux', { x: 520, y: 100 }, 'Mux')
  const first = path.blocks.find((item) => item.name === 'U1')?.id
  const second = path.blocks.find((item) => item.name === 'U2')?.id
  if (!first || !second) throw new Error('A counter instance is missing.')
  connect(path, [
    portByInterface(path, pathEdge, 'ifp_dp_clk'),
    portByInterface(path, first, 'ifp_ctr_clk'),
    portByInterface(path, second, 'ifp_ctr_clk'),
    portBySymbol(path, reg, 'pin_reg_clk'),
  ], 'clk')
  connect(path, [
    portByInterface(path, pathEdge, 'ifp_dp_rst'),
    portByInterface(path, first, 'ifp_ctr_rst'),
    portByInterface(path, second, 'ifp_ctr_rst'),
  ], 'rst')
  connect(path, [portByInterface(path, pathEdge, 'ifp_dp_d'), portBySymbol(path, reg, 'pin_reg_d')], 'd')
  connect(path, [portBySymbol(path, reg, 'pin_reg_q'), portBySymbol(path, mux, 'pin_mux_d0')], 'reg')
  connect(path, [portByInterface(path, first, 'ifp_ctr_q'), portBySymbol(path, mux, 'pin_mux_d1')], 'count')
  const probe = plain(path, 'Probe', { x: 520, y: 280 }, { width: 88, height: 48 }, [
    { name: 'd', side: 'left', t: 0.5 },
  ])
  connect(path, [portByInterface(path, second, 'ifp_ctr_q'), portByName(path, probe, 'd')], 'count2')
  connect(path, [portByInterface(path, pathEdge, 'ifp_dp_sel'), portBySymbol(path, mux, 'pin_mux_sel')], 'sel')
  connect(path, [portBySymbol(path, mux, 'pin_mux_y'), portByInterface(path, pathEdge, 'ifp_dp_q')], 'q')

  const controlSheet = sheet(project, control.documentId)
  const controlEdge = boundary(controlSheet, [
    { interfacePortId: 'ifp_cu_clk', name: 'clk', side: 'right', t: 0.3 },
    { interfacePortId: 'ifp_cu_rst', name: 'rst', side: 'right', t: 0.62 },
    { interfacePortId: 'ifp_cu_sel', name: 'sel', side: 'left', t: 0.45 },
  ])
  const decode = plain(controlSheet, 'Decode', { x: 280, y: 80 }, { width: 120, height: 72 }, [
    { name: 'clk', side: 'left', t: 0.3 },
    { name: 'rst', side: 'left', t: 0.7 },
    { name: 'sel', side: 'right', t: 0.5 },
  ])
  connect(controlSheet, [portByInterface(controlSheet, controlEdge, 'ifp_cu_clk'), portByName(controlSheet, decode, 'clk')], 'clk')
  connect(controlSheet, [portByInterface(controlSheet, controlEdge, 'ifp_cu_rst'), portByName(controlSheet, decode, 'rst')], 'rst')
  connect(controlSheet, [portByName(controlSheet, decode, 'sel'), portByInterface(controlSheet, controlEdge, 'ifp_cu_sel')], 'sel')

  const clockSheet = sheet(project, clock.documentId)
  const clockEdge = boundary(clockSheet, [{ interfacePortId: 'ifp_clk_out', name: 'clk', side: 'left', t: 0.5 }])
  const osc = placeGraphic(clockSheet, 'lib_pictures', 'sym_oscillator', { x: 280, y: 80 }, 'OSC')
  connect(clockSheet, [portBySymbol(clockSheet, osc, 'pin_osc_out'), portByInterface(clockSheet, clockEdge, 'ifp_clk_out')], 'clk')

  const resetSheet = sheet(project, reset.documentId)
  const resetEdge = boundary(resetSheet, [{ interfacePortId: 'ifp_rst_out', name: 'rst', side: 'left', t: 0.5 }])
  const sync = plain(resetSheet, 'Sync', { x: 280, y: 90 }, { width: 110, height: 64 }, [
    { name: 'rst', side: 'right', t: 0.5 },
  ])
  connect(resetSheet, [portByName(resetSheet, sync, 'rst'), portByInterface(resetSheet, resetEdge, 'ifp_rst_out')], 'rst')

  return finish(project)
}

/** A signal chain with custom symbols, an SVG meter, a bitmap, and a nested channel. */
export function signalProject(): DiagramProject {
  let project = createProject('Signal Processing')
  const adc = diagramPart(project, {
    name: 'ADC',
    width: 110,
    height: 88,
    ports: [
      { id: 'ifp_adc_in', name: 'in' },
      { id: 'ifp_adc_clk', name: 'clk' },
      { id: 'ifp_adc_out', name: 'out' },
    ],
    pins: [
      { id: 'pin_ref_adc_in', name: 'in', side: 'left', t: 0.4 },
      { id: 'pin_ref_adc_clk', name: 'clk', side: 'bottom', t: 0.5 },
      { id: 'pin_ref_adc_out', name: 'out', side: 'right', t: 0.4 },
    ],
  })
  project = adc.project
  const channel = diagramPart(project, {
    name: 'Channel',
    width: 120,
    height: 72,
    ports: [
      { id: 'ifp_ch_in', name: 'in' },
      { id: 'ifp_ch_out', name: 'out' },
    ],
    pins: [
      { id: 'pin_ref_ch_in', name: 'in', side: 'left', t: 0.5 },
      { id: 'pin_ref_ch_out', name: 'out', side: 'right', t: 0.5 },
    ],
  })
  project = channel.project
  const dds = diagramPart(project, {
    name: 'DDS',
    width: 110,
    height: 88,
    ports: [
      { id: 'ifp_dds_clk', name: 'clk' },
      { id: 'ifp_dds_tune', name: 'tune' },
      { id: 'ifp_dds_out', name: 'out' },
    ],
    pins: [
      { id: 'pin_ref_dds_clk', name: 'clk', side: 'left', t: 0.4 },
      { id: 'pin_ref_dds_tune', name: 'tune', side: 'bottom', t: 0.5 },
      { id: 'pin_ref_dds_out', name: 'out', side: 'right', t: 0.4 },
    ],
  })
  project = dds.project
  const dac = diagramPart(project, {
    name: 'DAC',
    width: 110,
    height: 72,
    ports: [
      { id: 'ifp_dac_in', name: 'in' },
      { id: 'ifp_dac_out', name: 'out' },
    ],
    pins: [
      { id: 'pin_ref_dac_in', name: 'in', side: 'left', t: 0.5 },
      { id: 'pin_ref_dac_out', name: 'out', side: 'right', t: 0.5 },
    ],
  })
  project = dac.project

  const root = rootOf(project)
  const sourceId = defineSymbol(root, {
    name: 'Source',
    width: 110,
    height: 64,
    ports: [{ id: 'pin_ref_src_out', name: 'out', side: 'right', t: 0.5 }],
  })
  const mixerId = defineSymbol(root, {
    name: 'Mixer',
    width: 110,
    height: 88,
    ports: [
      { id: 'pin_ref_mix_a', name: 'a', side: 'left', t: 0.45 },
      { id: 'pin_ref_mix_b', name: 'b', side: 'top', t: 0.5 },
      { id: 'pin_ref_mix_y', name: 'y', side: 'right', t: 0.45 },
    ],
  })
  const wordId = defineSymbol(root, {
    name: 'Word clock',
    width: 120,
    height: 64,
    ports: [{ id: 'pin_ref_word_out', name: 'clk', side: 'bottom', t: 0.5 }],
  })
  root.assets.push(pixelAsset())
  const scopeId = defineSymbol(root, {
    name: 'Scope',
    width: 96,
    height: 72,
    ports: [{ id: 'pin_ref_scope_in', name: 'in', side: 'left', t: 0.5 }],
    shapes: [{ kind: 'image', assetId: 'ast_ref_pixel', x: 8, y: 8, width: 80, height: 56, lockAspect: true }],
  })
  const source = instantiateSymbol(root, sourceId, { x: 40, y: 160 }, 'Source')
  const mixer = instantiateSymbol(root, mixerId, { x: 620, y: 140 }, 'Mixer')
  const word = instantiateSymbol(root, wordId, { x: 250, y: 40 }, 'Word')
  const scope = instantiateSymbol(root, scopeId, { x: 980, y: 300 }, 'Scope')
  if (!source || !mixer || !word || !scope) throw new Error('A signal symbol could not be placed.')

  project = placePart(project, project.rootDocumentId, adc.componentId, { x: 240, y: 150 }, 'ADC').project
  project = placePart(project, project.rootDocumentId, channel.componentId, { x: 430, y: 160 }, 'Channel').project
  project = placePart(project, project.rootDocumentId, dds.componentId, { x: 430, y: 340 }, 'DDS').project
  project = placePart(project, project.rootDocumentId, dac.componentId, { x: 820, y: 160 }, 'DAC').project
  const live = rootOf(project)
  const meterIn = placeGraphic(live, 'lib_pictures', 'sym_meter', { x: 980, y: 40 }, 'Meter in')
  const meterOut = placeGraphic(live, 'lib_pictures', 'sym_meter', { x: 980, y: 160 }, 'Meter out')
  const gain = placeGraphic(live, 'lib_signal', 'sym_gain', { x: 40, y: 340 }, 'Gain')

  const adcId = live.blocks.find((item) => item.name === 'ADC')?.id
  const channelId = live.blocks.find((item) => item.name === 'Channel')?.id
  const ddsId = live.blocks.find((item) => item.name === 'DDS')?.id
  const dacId = live.blocks.find((item) => item.name === 'DAC')?.id
  if (!adcId || !channelId || !ddsId || !dacId) throw new Error('A signal block is missing.')
  connect(live, [portBySymbol(live, source, 'pin_ref_src_out'), portByInterface(live, adcId, 'ifp_adc_in')], 'analog')
  connect(live, [portByInterface(live, adcId, 'ifp_adc_out'), portByInterface(live, channelId, 'ifp_ch_in')], 'samples')
  connect(live, [portByInterface(live, channelId, 'ifp_ch_out'), portBySymbol(live, mixer, 'pin_ref_mix_a')], 'base')
  connect(live, [portByInterface(live, ddsId, 'ifp_dds_out'), portBySymbol(live, mixer, 'pin_ref_mix_b')], 'carrier')
  connect(live, [portBySymbol(live, mixer, 'pin_ref_mix_y'), portByInterface(live, dacId, 'ifp_dac_in')], 'mix')
  connect(live, [portByInterface(live, dacId, 'ifp_dac_out'), portBySymbol(live, meterOut, 'pin_meter_p')], 'out')
  connect(live, [
    portBySymbol(live, word, 'pin_ref_word_out'),
    portByInterface(live, adcId, 'ifp_adc_clk'),
    portByInterface(live, ddsId, 'ifp_dds_clk'),
  ], 'word')
  connect(live, [portBySymbol(live, gain, 'pin_gain_out'), portBySymbol(live, meterIn, 'pin_meter_p')], 'level')
  connect(live, [portBySymbol(live, meterOut, 'pin_meter_n'), portBySymbol(live, scope, 'pin_ref_scope_in')], 'probe')

  const adcSheet = sheet(project, adc.documentId)
  const adcEdge = boundary(adcSheet, [
    { interfacePortId: 'ifp_adc_in', name: 'in', side: 'right', t: 0.28 },
    { interfacePortId: 'ifp_adc_clk', name: 'clk', side: 'top', t: 0.5 },
    { interfacePortId: 'ifp_adc_out', name: 'out', side: 'left', t: 0.45 },
  ])
  const sample = plain(adcSheet, 'Sample', { x: 280, y: 100 }, { width: 110, height: 72 }, [
    { name: 'in', side: 'left', t: 0.35 },
    { name: 'clk', side: 'bottom', t: 0.5 },
    { name: 'out', side: 'right', t: 0.35 },
  ])
  connect(adcSheet, [portByInterface(adcSheet, adcEdge, 'ifp_adc_in'), portByName(adcSheet, sample, 'in')], 'in')
  connect(adcSheet, [portByInterface(adcSheet, adcEdge, 'ifp_adc_clk'), portByName(adcSheet, sample, 'clk')], 'clk')
  connect(adcSheet, [portByName(adcSheet, sample, 'out'), portByInterface(adcSheet, adcEdge, 'ifp_adc_out')], 'out')

  const channelSheet = sheet(project, channel.documentId)
  const channelEdge = boundary(channelSheet, [
    { interfacePortId: 'ifp_ch_in', name: 'in', side: 'right', t: 0.4 },
    { interfacePortId: 'ifp_ch_out', name: 'out', side: 'left', t: 0.4 },
  ])
  const filter = placeGraphic(channelSheet, 'lib_signal', 'sym_filter', { x: 240, y: 90 }, 'Filter')
  const innerGain = placeGraphic(channelSheet, 'lib_signal', 'sym_gain', { x: 460, y: 90 }, 'Gain')
  connect(channelSheet, [portByInterface(channelSheet, channelEdge, 'ifp_ch_in'), portBySymbol(channelSheet, filter, 'pin_filter_in')], 'in')
  connect(channelSheet, [portBySymbol(channelSheet, filter, 'pin_filter_out'), portBySymbol(channelSheet, innerGain, 'pin_gain_in')], 'filtered')
  connect(channelSheet, [portBySymbol(channelSheet, innerGain, 'pin_gain_out'), portByInterface(channelSheet, channelEdge, 'ifp_ch_out')], 'out')

  const ddsSheet = sheet(project, dds.documentId)
  const ddsEdge = boundary(ddsSheet, [
    { interfacePortId: 'ifp_dds_clk', name: 'clk', side: 'right', t: 0.3 },
    { interfacePortId: 'ifp_dds_tune', name: 'tune', side: 'top', t: 0.5 },
    { interfacePortId: 'ifp_dds_out', name: 'out', side: 'left', t: 0.45 },
  ])
  const phase = plain(ddsSheet, 'Phase', { x: 280, y: 110 }, { width: 110, height: 80 }, [
    { name: 'clk', side: 'left', t: 0.3 },
    { name: 'tune', side: 'bottom', t: 0.5 },
    { name: 'out', side: 'right', t: 0.35 },
  ])
  connect(ddsSheet, [portByInterface(ddsSheet, ddsEdge, 'ifp_dds_clk'), portByName(ddsSheet, phase, 'clk')], 'clk')
  connect(ddsSheet, [portByInterface(ddsSheet, ddsEdge, 'ifp_dds_tune'), portByName(ddsSheet, phase, 'tune')], 'tune')
  connect(ddsSheet, [portByName(ddsSheet, phase, 'out'), portByInterface(ddsSheet, ddsEdge, 'ifp_dds_out')], 'out')

  const dacSheet = sheet(project, dac.documentId)
  const dacEdge = boundary(dacSheet, [
    { interfacePortId: 'ifp_dac_in', name: 'in', side: 'right', t: 0.45 },
    { interfacePortId: 'ifp_dac_out', name: 'out', side: 'left', t: 0.45 },
  ])
  const hold = plain(dacSheet, 'Hold', { x: 280, y: 100 }, { width: 100, height: 64 }, [
    { name: 'in', side: 'left', t: 0.5 },
    { name: 'out', side: 'right', t: 0.5 },
  ])
  connect(dacSheet, [portByInterface(dacSheet, dacEdge, 'ifp_dac_in'), portByName(dacSheet, hold, 'in')], 'in')
  connect(dacSheet, [portByName(dacSheet, hold, 'out'), portByInterface(dacSheet, dacEdge, 'ifp_dac_out')], 'out')

  return finish(project)
}

/** A flowchart sheet for a script or a whiteboard: symbols, text, pictures, a group, wires, and ink. */
export function generalProject(): DiagramProject {
  const project = createProject('General Diagram')
  const doc = rootOf(project)
  const start = placeGraphic(doc, 'lib_flowchart', 'sym_start', { x: 60, y: 40 }, 'Start')
  const read = placeGraphic(doc, 'lib_flowchart', 'sym_process', { x: 60, y: 180 }, 'Read')
  const choice = placeGraphic(doc, 'lib_flowchart', 'sym_decision', { x: 60, y: 340 }, 'Ready?')
  const keep = placeGraphic(doc, 'lib_flowchart', 'sym_process', { x: 340, y: 220 }, 'Keep')
  const ask = placeGraphic(doc, 'lib_flowchart', 'sym_io', { x: 340, y: 400 }, 'Ask again')
  const note = placeGraphic(doc, 'lib_general', 'sym_textbox', { x: 620, y: 40 }, 'Note')
  const board = placeGraphic(doc, 'lib_pictures', 'sym_board', { x: 620, y: 180 }, 'Board')
  doc.assets.push(pixelAsset())
  const figureId = defineSymbol(doc, {
    name: 'Figure',
    width: 96,
    height: 72,
    ports: [],
    shapes: [{ kind: 'image', assetId: 'ast_ref_pixel', x: 8, y: 8, width: 80, height: 56, lockAspect: true }],
  })
  const figure = instantiateSymbol(doc, figureId, { x: 620, y: 400 }, 'Figure')
  if (!figure) throw new Error('The figure could not be placed.')
  const grouped = groupBlocks(doc, [read, keep])
  if (!grouped) throw new Error('The group could not be created.')
  connect(doc, [portBySymbol(doc, start, 'pin_start_out'), portBySymbol(doc, read, 'pin_process_in')], 'begin')
  connect(doc, [portBySymbol(doc, read, 'pin_process_out'), portBySymbol(doc, choice, 'pin_decision_in')], 'step')
  connect(doc, [portBySymbol(doc, choice, 'pin_decision_yes'), portBySymbol(doc, keep, 'pin_process_in')], 'yes')
  connect(doc, [portBySymbol(doc, choice, 'pin_decision_no'), portBySymbol(doc, ask, 'pin_io_in')], 'no')
  doc.strokes.push({
    id: 'stk_ref_note',
    points: [
      { x: 40, y: 520, pressure: 0.35 },
      { x: 90, y: 490, pressure: 0.6 },
      { x: 150, y: 530, pressure: 0.45 },
      { x: 210, y: 500, pressure: 0.3 },
    ],
    color: '#2c3a4a',
    size: 8,
  })
  void note
  void board
  return finish(project)
}
