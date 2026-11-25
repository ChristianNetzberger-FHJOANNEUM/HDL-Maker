import {
  componentById,
  documentById,
  findCycles,
  instancesOf,
  type ComponentDefinition,
  type ComponentPort,
  type DiagramProject,
  type ProjectResult,
} from './component'
import { createId, type DiagramDocument, type PortSide, type SymbolDefinition } from './document'
import { emptyDocument, hideSymbolPin, portIsWired } from './edit'
import { refreshAll } from './geometry'
import { adoptLibrarySymbol } from './library'
import { defineSymbol } from './symbols'

export type InterfaceNote = {
  kind: 'unbound' | 'ambiguous' | 'missing-pin' | 'wired-removed'
  message: string
  componentId: string
  interfacePortId?: string
  symbolPortId?: string
  documentId?: string
  portId?: string
}

type Failure = { ok: false; project: DiagramProject; message: string }

function cloneProject(project: DiagramProject): DiagramProject {
  return JSON.parse(JSON.stringify(project)) as DiagramProject
}

function fail(project: DiagramProject, message: string): Failure {
  return { ok: false, project, message }
}

function wired(document: DiagramDocument, portId: string): boolean {
  return document.segments.some(
    (segment) =>
      (segment.start.kind === 'port' && segment.start.portId === portId) ||
      (segment.end.kind === 'port' && segment.end.portId === portId),
  )
}

function symbolOf(project: DiagramProject, symbolId: string): { document: DiagramDocument; symbol: SymbolDefinition } | null {
  for (const document of project.documents) {
    const symbol = document.symbols.find((item) => item.id === symbolId)
    if (symbol) return { document, symbol }
  }
  return null
}

function restack(document: DiagramDocument, blockId: string, order: string[]): void {
  const sides: PortSide[] = ['left', 'right', 'top', 'bottom']
  for (const side of sides) {
    const ports = document.ports.filter(
      (port) => port.blockId === blockId && port.side === side && port.interfacePortId && order.includes(port.interfacePortId),
    )
    ports.sort((a, b) => order.indexOf(a.interfacePortId ?? '') - order.indexOf(b.interfacePortId ?? ''))
    const flexible = ports.filter((port) => !port.placed)
    flexible.forEach((port, index) => {
      port.t = (index + 1) / (flexible.length + 1)
    })
  }
  refreshAll(document)
}

function touchInstances(project: DiagramProject, componentId: string, order: string[]): void {
  for (const instance of instancesOf(project, componentId)) {
    const document = documentById(project, instance.documentId)
    if (document) restack(document, instance.blockId, order)
  }
  const component = componentById(project, componentId)
  const childId = component?.implementation.kind === 'diagram' ? component.implementation.documentId : undefined
  const child = childId ? documentById(project, childId) : null
  const boundary = child?.blocks.find((block) => !block.componentId && block.name === 'Boundary')
  if (child && boundary) restack(child, boundary.id, order)
}

function sideFor(project: DiagramProject, componentId: string, interfacePortId: string, fallback: PortSide): PortSide {
  for (const instance of instancesOf(project, componentId)) {
    const document = documentById(project, instance.documentId)
    const port = document?.ports.find((item) => item.blockId === instance.blockId && item.interfacePortId === interfacePortId)
    if (port) return port.side
  }
  return fallback
}

function placeOnBlock(
  document: DiagramDocument,
  blockId: string,
  pin: ComponentPort,
  side: PortSide,
): void {
  if (document.ports.some((port) => port.blockId === blockId && port.interfacePortId === pin.id)) return
  document.ports.push({
    id: createId('prt'),
    blockId,
    name: pin.name,
    side,
    t: 0.5,
    interfacePortId: pin.id,
  })
}

function boundaryBlock(document: DiagramDocument): { id: string } {
  const existing = document.blocks.find((block) => !block.componentId && block.name === 'Boundary')
  if (existing) return existing
  const created = { id: createId('blk'), name: 'Boundary', x: 40, y: 200, width: 120, height: 80 }
  document.blocks.push(created)
  return created
}

function renameCited(project: DiagramProject, component: ComponentDefinition, interfacePortId: string, name: string): void {
  const apply = (document: DiagramDocument, blockId: string): void => {
    for (const port of document.ports) {
      if (port.blockId === blockId && port.interfacePortId === interfacePortId) port.name = name
    }
  }
  for (const instance of instancesOf(project, component.id)) {
    const document = documentById(project, instance.documentId)
    if (document) apply(document, instance.blockId)
  }
  if (component.implementation.kind === 'diagram' && component.implementation.documentId) {
    const child = documentById(project, component.implementation.documentId)
    const boundary = child?.blocks.find((block) => !block.componentId && block.name === 'Boundary')
    if (child && boundary) apply(child, boundary.id)
  }
  if (!component.symbolId) return
  const binding = component.bindings.find((item) => item.interfacePortId === interfacePortId)
  if (!binding) return
  for (const document of project.documents) {
    const pin = document.symbols.find((symbol) => symbol.id === component.symbolId)?.ports.find((item) => item.id === binding.symbolPortId)
    if (pin) pin.name = name
  }
}

/**
 * Add one logical port and the matching instance and boundary ports.
 * Existing port ids and wires are not changed. Nothing is matched by name.
 */
export function addInterfacePort(
  project: DiagramProject,
  componentId: string,
  name: string,
  side: PortSide = 'left',
  at?: { documentId: string; blockId: string; t: number },
): ProjectResult<{ interfacePortId: string }> {
  const component = componentById(project, componentId)
  const trimmed = name.trim()
  if (!component) return fail(project, 'That component is not in the project.')
  if (!trimmed) return fail(project, 'A port needs a name.')
  if (component.ports.some((port) => port.name.toLowerCase() === trimmed.toLowerCase())) {
    return fail(project, 'That port name is already used on this component.')
  }
  const next = cloneProject(project)
  const target = componentById(next, componentId)
  if (!target) return fail(project, 'That component is not in the project.')
  const interfacePortId = createId('ifp')
  const pin: ComponentPort = { id: interfacePortId, name: trimmed }
  target.ports.push(pin)
  for (const instance of instancesOf(next, componentId)) {
    const document = documentById(next, instance.documentId)
    if (document) placeOnBlock(document, instance.blockId, pin, side)
  }
  if (target.implementation.kind === 'diagram' && target.implementation.documentId) {
    const child = documentById(next, target.implementation.documentId)
    if (child) placeOnBlock(child, boundaryBlock(child).id, pin, side)
  }
  touchInstances(next, componentId, target.ports.map((port) => port.id))
  if (at) {
    const document = documentById(next, at.documentId)
    const port = document?.ports.find((item) => item.blockId === at.blockId && item.interfacePortId === interfacePortId)
    if (document && port) {
      port.side = side
      port.t = Math.min(1, Math.max(0, at.t))
      port.placed = true
      delete port.x
      delete port.y
      refreshAll(document)
    }
  }
  return { ok: true, project: next, value: { interfacePortId } }
}

/** Change the visible name. Port ids, bindings, and net ids stay. */
export function renameInterfacePort(
  project: DiagramProject,
  componentId: string,
  interfacePortId: string,
  name: string,
): ProjectResult<{ interfacePortId: string }> {
  const component = componentById(project, componentId)
  const trimmed = name.trim()
  if (!component) return fail(project, 'That component is not in the project.')
  if (!component.ports.some((port) => port.id === interfacePortId)) return fail(project, 'That logical port is not on the component.')
  if (!trimmed) return fail(project, 'A port needs a name.')
  if (component.ports.some((port) => port.id !== interfacePortId && port.name.toLowerCase() === trimmed.toLowerCase())) {
    return fail(project, 'That port name is already used on this component.')
  }
  const next = cloneProject(project)
  const target = componentById(next, componentId)
  const port = target?.ports.find((item) => item.id === interfacePortId)
  if (!target || !port) return fail(project, 'That logical port is not on the component.')
  port.name = trimmed
  renameCited(next, target, interfacePortId, trimmed)
  return { ok: true, project: next, value: { interfacePortId } }
}

function wiredCopies(project: DiagramProject, component: ComponentDefinition, interfacePortId: string): string[] {
  const names: string[] = []
  const visit = (document: DiagramDocument, blockId: string): void => {
    const block = document.blocks.find((item) => item.id === blockId)
    const port = document.ports.find((item) => item.blockId === blockId && item.interfacePortId === interfacePortId)
    if (block && port && wired(document, port.id)) names.push(block.name)
  }
  for (const instance of instancesOf(project, component.id)) {
    const document = documentById(project, instance.documentId)
    if (document) visit(document, instance.blockId)
  }
  if (component.implementation.kind === 'diagram' && component.implementation.documentId) {
    const child = documentById(project, component.implementation.documentId)
    const boundary = child?.blocks.find((block) => !block.componentId && block.name === 'Boundary')
    if (child && boundary) visit(child, boundary.id)
  }
  return names
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'a block'
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

/**
 * Drop a logical port from the definition, every instance, and the Boundary.
 * If any of those copies has a wire, the whole command is refused and nothing changes.
 * No wire is deleted.
 */
export function removeInterfacePort(
  project: DiagramProject,
  componentId: string,
  interfacePortId: string,
): ProjectResult<{ interfacePortId: string }> {
  const component = componentById(project, componentId)
  if (!component) return fail(project, 'That component is not in the project.')
  const logical = component.ports.find((port) => port.id === interfacePortId)
  if (!logical) return fail(project, 'That logical port is not on the component.')
  const sites = wiredCopies(project, component, interfacePortId)
  if (sites.length > 0) {
    return fail(project, `${logical.name} is wired on ${joinNames(sites)}. The port was kept.`)
  }
  const next = cloneProject(project)
  const target = componentById(next, componentId)
  if (!target) return fail(project, 'That component is not in the project.')
  target.ports = target.ports.filter((port) => port.id !== interfacePortId)
  target.bindings = target.bindings.filter((binding) => binding.interfacePortId !== interfacePortId)
  const dropCopy = (document: DiagramDocument, blockId: string): void => {
    const block = document.blocks.find((item) => item.id === blockId)
    document.ports = document.ports.filter((port) => {
      if (port.blockId !== blockId || port.interfacePortId !== interfacePortId) return true
      if (block) hideSymbolPin(block, port.symbolPortId)
      return false
    })
  }
  for (const instance of instancesOf(next, componentId)) {
    const document = documentById(next, instance.documentId)
    if (document) dropCopy(document, instance.blockId)
  }
  if (target.implementation.kind === 'diagram' && target.implementation.documentId) {
    const child = documentById(next, target.implementation.documentId)
    const boundary = child?.blocks.find((block) => !block.componentId && block.name === 'Boundary')
    if (child && boundary) dropCopy(child, boundary.id)
  }
  touchInstances(next, componentId, target.ports.map((port) => port.id))
  return { ok: true, project: next, value: { interfacePortId } }
}

/** Move a logical port up or down. Graphical order follows. Ids do not change. */
export function moveInterfacePort(
  project: DiagramProject,
  componentId: string,
  interfacePortId: string,
  delta: -1 | 1,
): ProjectResult<{ interfacePortId: string }> {
  const component = componentById(project, componentId)
  if (!component) return fail(project, 'That component is not in the project.')
  const index = component.ports.findIndex((port) => port.id === interfacePortId)
  const targetIndex = index + delta
  if (index < 0 || targetIndex < 0 || targetIndex >= component.ports.length) {
    return fail(project, 'That port cannot move further.')
  }
  const next = cloneProject(project)
  const target = componentById(next, componentId)
  if (!target) return fail(project, 'That component is not in the project.')
  const [port] = target.ports.splice(index, 1)
  if (!port) return fail(project, 'That logical port is not on the component.')
  target.ports.splice(targetIndex, 0, port)
  touchInstances(next, componentId, target.ports.map((item) => item.id))
  return { ok: true, project: next, value: { interfacePortId } }
}

function mirrorSymbol(project: DiagramProject, symbolId: string): void {
  const found = symbolOf(project, symbolId)
  if (!found) return
  const picture = JSON.parse(JSON.stringify(found.symbol)) as SymbolDefinition
  for (const document of project.documents) {
    if (document.id === found.document.id) continue
    const index = document.symbols.findIndex((symbol) => symbol.id === symbolId)
    if (index >= 0) document.symbols[index] = JSON.parse(JSON.stringify(picture)) as SymbolDefinition
  }
}

function ensureSymbol(project: DiagramProject, component: ComponentDefinition): SymbolDefinition | null {
  if (component.symbolId) {
    const found = symbolOf(project, component.symbolId)
    if (found) return found.symbol
  }
  const root = documentById(project, project.rootDocumentId)
  if (!root) return null
  const symbolId = defineSymbol(root, { name: component.name, width: 120, height: 80, ports: [] })
  component.symbolId = symbolId
  return root.symbols.find((symbol) => symbol.id === symbolId) ?? null
}

function attachPin(
  project: DiagramProject,
  component: ComponentDefinition,
  interfacePortId: string,
  symbolPortId: string,
): string | null {
  const symbol = component.symbolId ? symbolOf(project, component.symbolId) : null
  const pin = symbol?.symbol.ports.find((item) => item.id === symbolPortId)
  const logical = component.ports.find((port) => port.id === interfacePortId)
  if (!symbol || !pin || !logical) return 'That symbol pin is not on this component.'
  if (component.bindings.some((binding) => binding.symbolPortId === symbolPortId && binding.interfacePortId !== interfacePortId)) {
    return 'That symbol pin is already bound to another logical port.'
  }
  component.bindings = component.bindings.filter((binding) => binding.interfacePortId !== interfacePortId)
  component.bindings.push({ interfacePortId, symbolPortId })
  const sourceAssets = symbol.document.assets ?? []
  for (const instance of instancesOf(project, component.id)) {
    const document = documentById(project, instance.documentId)
    const block = document?.blocks.find((item) => item.id === instance.blockId)
    if (!document || !block) continue
    if (!document.symbols.some((item) => item.id === symbol.symbol.id)) {
      const adopted = adoptLibrarySymbol(document, symbol.symbol, sourceAssets)
      if (!adopted.ok) return adopted.message
    }
    if (!block.symbolId) {
      block.symbolId = symbol.symbol.id
      block.width = symbol.symbol.width
      block.height = symbol.symbol.height
    }
    const port = document.ports.find((item) => item.blockId === block.id && item.interfacePortId === interfacePortId)
    if (!port) continue
    const duplicate = document.ports.find(
      (item) => item.blockId === block.id && item.id !== port.id && item.symbolPortId === symbolPortId,
    )
    if (duplicate && wired(document, duplicate.id)) return 'That pin already has a wire on another port.'
    if (duplicate) document.ports = document.ports.filter((item) => item.id !== duplicate.id)
    port.symbolPortId = symbolPortId
    port.name = logical.name
    if (!port.placed) {
      port.side = pin.side
      port.t = pin.t
    }
    refreshAll(document)
  }
  mirrorSymbol(project, symbol.symbol.id)
  return null
}

/** Bind a logical port to one symbol pin by id. Equal names are not used. */
export function bindInterfacePort(
  project: DiagramProject,
  componentId: string,
  interfacePortId: string,
  symbolPortId: string | null,
): ProjectResult<{ interfacePortId: string }> {
  const component = componentById(project, componentId)
  if (!component) return fail(project, 'That component is not in the project.')
  if (!component.ports.some((port) => port.id === interfacePortId)) return fail(project, 'That logical port is not on the component.')
  const next = cloneProject(project)
  const target = componentById(next, componentId)
  if (!target) return fail(project, 'That component is not in the project.')
  if (!symbolPortId) {
    target.bindings = target.bindings.filter((binding) => binding.interfacePortId !== interfacePortId)
    for (const instance of instancesOf(next, componentId)) {
      const document = documentById(next, instance.documentId)
      const port = document?.ports.find((item) => item.blockId === instance.blockId && item.interfacePortId === interfacePortId)
      if (!document || !port) continue
      delete port.symbolPortId
      refreshAll(document)
    }
    return { ok: true, project: next, value: { interfacePortId } }
  }
  const message = attachPin(next, target, interfacePortId, symbolPortId)
  if (message) return fail(project, message)
  return { ok: true, project: next, value: { interfacePortId } }
}

/** Create a symbol pin and bind it to one logical port. The pin position stays on the symbol. */
export function addBoundPin(
  project: DiagramProject,
  componentId: string,
  interfacePortId: string,
  side: PortSide,
): ProjectResult<{ interfacePortId: string; symbolPortId: string }> {
  const component = componentById(project, componentId)
  if (!component) return fail(project, 'That component is not in the project.')
  const logical = component.ports.find((port) => port.id === interfacePortId)
  if (!logical) return fail(project, 'That logical port is not on the component.')
  const next = cloneProject(project)
  const target = componentById(next, componentId)
  if (!target) return fail(project, 'That component is not in the project.')
  const symbol = ensureSymbol(next, target)
  const refreshed = componentById(next, componentId)
  if (!symbol || !refreshed) return fail(project, 'The symbol could not be created.')
  const mates = symbol.ports.filter((port) => port.side === side).length
  const symbolPortId = createId('pin')
  symbol.ports.push({ id: symbolPortId, name: logical.name, side, t: (mates + 1) / (mates + 2) })
  const message = attachPin(next, refreshed, interfacePortId, symbolPortId)
  if (message) return fail(project, message)
  return { ok: true, project: next, value: { interfacePortId, symbolPortId } }
}

/**
 * Create the empty implementation diagram of a component that already exists.
 * Confirming Open as on that component calls this. A double-click alone does not.
 * An existing diagram is left as it is.
 */
export function createImplementation(
  project: DiagramProject,
  componentId: string,
): ProjectResult<{ documentId: string }> {
  const component = componentById(project, componentId)
  if (!component) return fail(project, 'That component is not in the project.')
  if (component.implementation.kind === 'diagram') return fail(project, `${component.name} already has an implementation.`)
  if (component.implementation.kind !== 'none') {
    return fail(project, `${component.name} uses ${component.implementation.kind}, and a diagram was not created.`)
  }
  const next = cloneProject(project)
  const target = componentById(next, componentId)
  if (!target) return fail(project, 'That component is not in the project.')
  const child = emptyDocument()
  const boundary = boundaryBlock(child)
  for (const pin of target.ports) {
    placeOnBlock(child, boundary.id, pin, sideFor(next, componentId, pin.id, 'left'))
  }
  restack(child, boundary.id, target.ports.map((port) => port.id))
  next.documents.push(child)
  target.implementation = { kind: 'diagram', documentId: child.id }
  return { ok: true, project: next, value: { documentId: child.id } }
}

export type OpenAsResult = {
  componentId: string
  documentId: string
  /** True when the selected block had no component and this command created the definition. */
  createdDefinition: boolean
}

/**
 * Turn the selected block into a diagram component, or give an existing abstract component its diagram.
 * The block id, place, size, name, symbol, port ids, and wires stay.
 * A second call does not create another definition or another diagram.
 */
export function openAsDiagram(
  project: DiagramProject,
  documentId: string,
  blockId: string,
): ProjectResult<OpenAsResult> {
  const sheet = documentById(project, documentId)
  const block = sheet?.blocks.find((item) => item.id === blockId)
  if (!sheet || !block) return fail(project, 'That block is not on this sheet.')
  if (!block.componentId && block.name === 'Boundary') {
    return fail(project, 'Boundary stays the interface of this diagram.')
  }
  if (block.componentId) {
    const component = componentById(project, block.componentId)
    if (!component) return fail(project, `${block.name} cites ${block.componentId}, which is not in the project.`)
    if (component.implementation.kind === 'diagram') return fail(project, `${component.name} already has an implementation.`)
    if (component.implementation.kind !== 'none') {
      return fail(project, `${component.name} uses ${component.implementation.kind}, and a diagram was not created.`)
    }
    const created = createImplementation(project, component.id)
    if (!created.ok) return created
    return {
      ok: true,
      project: created.project,
      value: { componentId: component.id, documentId: created.value.documentId, createdDefinition: false },
    }
  }
  const next = cloneProject(project)
  const parent = documentById(next, documentId)
  const target = parent?.blocks.find((item) => item.id === blockId)
  if (!parent || !target) return fail(project, 'That block is not on this sheet.')
  const ownPorts = parent.ports.filter((port) => port.blockId === target.id)
  const logical = ownPorts.map((port) => ({ port, interfacePortId: createId('ifp') }))
  const symbol = target.symbolId
    ? next.documents.flatMap((document) => document.symbols).find((item) => item.id === target.symbolId)
    : undefined
  const usedPins = new Set<string>()
  const bindings: Array<{ interfacePortId: string; symbolPortId: string }> = []
  for (const item of logical) {
    const pinId = item.port.symbolPortId
    if (!pinId || !symbol?.ports.some((pin) => pin.id === pinId) || usedPins.has(pinId)) continue
    usedPins.add(pinId)
    bindings.push({ interfacePortId: item.interfacePortId, symbolPortId: pinId })
  }
  for (const item of logical) item.port.interfacePortId = item.interfacePortId
  const componentId = createId('cmp')
  const child = emptyDocument()
  const boundary = boundaryBlock(child)
  for (const item of logical) {
    child.ports.push({
      id: createId('prt'),
      blockId: boundary.id,
      name: item.port.name,
      side: item.port.side,
      t: item.port.t,
      ...(item.port.placed ? { placed: true } : {}),
      interfacePortId: item.interfacePortId,
    })
  }
  next.documents.push(child)
  next.components.push({
    id: componentId,
    name: target.name.trim() || 'Block',
    ports: logical.map((item) => ({ id: item.interfacePortId, name: item.port.name })),
    ...(symbol ? { symbolId: symbol.id } : {}),
    bindings,
    implementation: { kind: 'diagram', documentId: child.id },
  })
  target.componentId = componentId
  const cycle = findCycles(next)[0]
  if (cycle) return fail(project, `Component cycle: ${cycle.join(' → ')}. The project was not changed.`)
  return { ok: true, project: next, value: { componentId, documentId: child.id, createdDefinition: true } }
}

export type PortDeleteKind =
  | { kind: 'logical'; componentId: string; interfacePortId: string }
  | { kind: 'dangling'; wired: boolean }
  | { kind: 'wired' }
  | { kind: 'local' }

/** The component whose logical interface this block shows, or null for an ordinary block. */
export function componentOwningBlock(
  project: DiagramProject,
  documentId: string,
  block: { componentId?: string; name: string },
): ComponentDefinition | null {
  if (block.componentId) return componentById(project, block.componentId)
  if (block.name !== 'Boundary') return null
  return project.components.find((item) => item.implementation.kind === 'diagram' && item.implementation.documentId === documentId) ?? null
}

/**
 * Visible name of a port that cites a logical interface id.
 * The component definition is the authority. A free instance name is used only when there is no interface id.
 */
export function logicalPortName(
  project: DiagramProject | null,
  port: { name: string; interfacePortId?: string },
): string {
  if (!project || !port.interfacePortId) return port.name
  for (const component of project.components) {
    const logical = component.ports.find((item) => item.id === port.interfacePortId)
    if (logical) return logical.name
  }
  return port.name
}

/**
 * Choose the delete operation for one port.
 * A logical id is used only when that id is still on the owning component.
 * Anything else with an interface id is a dangling reference, not a second logical delete.
 */
export function classifyPortDelete(project: DiagramProject | null, document: DiagramDocument, portId: string): PortDeleteKind | null {
  const port = document.ports.find((item) => item.id === portId)
  if (!port) return null
  const block = document.blocks.find((item) => item.id === port.blockId)
  if (!block) return null
  if (port.interfacePortId && project) {
    const owner = componentOwningBlock(project, document.id, block)
    if (owner && owner.ports.some((item) => item.id === port.interfacePortId)) {
      return { kind: 'logical', componentId: owner.id, interfacePortId: port.interfacePortId }
    }
    return { kind: 'dangling', wired: portIsWired(document, port.id) }
  }
  if (portIsWired(document, port.id)) return { kind: 'wired' }
  return { kind: 'local' }
}

/** Bindings and wired ports whose logical port is gone. Names are never used as a match. */
export function interfaceDiagnostics(project: DiagramProject, componentId: string): InterfaceNote[] {
  const component = componentById(project, componentId)
  if (!component) return []
  const notes: InterfaceNote[] = []
  const logical = new Set(component.ports.map((port) => port.id))
  const symbol = component.symbolId ? symbolOf(project, component.symbolId)?.symbol : undefined
  const pinIds = new Set(symbol?.ports.map((port) => port.id) ?? [])
  const byPin = new Map<string, string[]>()
  for (const binding of component.bindings) {
    const users = byPin.get(binding.symbolPortId) ?? []
    users.push(binding.interfacePortId)
    byPin.set(binding.symbolPortId, users)
    if (symbol && !pinIds.has(binding.symbolPortId)) {
      notes.push({
        kind: 'missing-pin',
        componentId,
        interfacePortId: binding.interfacePortId,
        symbolPortId: binding.symbolPortId,
        message: `A binding cites symbol pin ${binding.symbolPortId}, which is not on the symbol.`,
      })
    }
    if (!logical.has(binding.interfacePortId)) {
      notes.push({
        kind: 'missing-pin',
        componentId,
        interfacePortId: binding.interfacePortId,
        symbolPortId: binding.symbolPortId,
        message: `A binding cites logical port ${binding.interfacePortId}, which was removed.`,
      })
    }
  }
  for (const [symbolPortId, ids] of byPin) {
    if (ids.length < 2) continue
    notes.push({
      kind: 'ambiguous',
      componentId,
      symbolPortId,
      message: `Symbol pin ${symbolPortId} is bound to more than one logical port.`,
    })
  }
  if (symbol) {
    for (const port of component.ports) {
      if (!component.bindings.some((binding) => binding.interfacePortId === port.id)) {
        notes.push({
          kind: 'unbound',
          componentId,
          interfacePortId: port.id,
          message: `${port.name} has no symbol pin. It was not matched by name.`,
        })
      }
    }
  }
  const childId = component.implementation.kind === 'diagram' ? component.implementation.documentId : undefined
  for (const document of project.documents) {
    for (const port of document.ports) {
      if (!port.interfacePortId || logical.has(port.interfacePortId)) continue
      const block = document.blocks.find((item) => item.id === port.blockId)
      const onInstance = block?.componentId === componentId
      const onBoundary = document.id === childId && block && !block.componentId
      if (!onInstance && !onBoundary) continue
      if (!wired(document, port.id)) continue
      notes.push({
        kind: 'wired-removed',
        componentId,
        interfacePortId: port.interfacePortId,
        documentId: document.id,
        portId: port.id,
        message: `${block?.name ?? 'Port'}.${port.name} still has a wire, but its logical port was removed.`,
      })
    }
  }
  return notes
}
