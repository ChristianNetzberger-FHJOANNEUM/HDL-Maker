import { adoptLibrarySymbol } from './library'
import { createId, type DiagramDocument, type Point } from './document'
import { emptyDocument } from './edit'
import { instantiateSymbol, pruneAssets, releaseUnboundSymbolPorts } from './symbols'

/** A logical port. It has no position. */
export type ComponentPort = {
  id: string
  name: string
}

/** An explicit link between a logical port and one symbol pin. Names are not consulted. */
export type InterfaceBinding = {
  interfacePortId: string
  symbolPortId: string
}

/**
 * What implements the component.
 * `none` and `diagram` are used. Any other kind is kept and reported, and is not executed.
 */
export type ComponentImplementation = {
  kind: string
  documentId?: string
  extra?: Record<string, unknown>
}

/** Functional identity. It has no position on a sheet. */
export type ComponentDefinition = {
  id: string
  name: string
  description?: string
  ports: ComponentPort[]
  symbolId?: string
  bindings: InterfaceBinding[]
  implementation: ComponentImplementation
  revision?: number
}

export type DiagramProject = {
  schemaVersion: 1
  id: string
  name: string
  rootDocumentId: string
  documents: DiagramDocument[]
  components: ComponentDefinition[]
  extra: Record<string, unknown>
}

export type ProjectDiagnostic = {
  kind:
    | 'missing-root'
    | 'missing-document'
    | 'missing-component'
    | 'missing-symbol'
    | 'invalid-interface'
    | 'cycle'
    | 'unsupported-implementation'
    | 'duplicate-id'
  message: string
  componentId?: string
  documentId?: string
}

export type InstanceStep = {
  documentId: string
  blockId: string
  componentId: string
}

/** A concrete chain of instances. `key` is block ids. `label` is names, for display only. */
export type InstancePath = {
  steps: InstanceStep[]
  key: string
  label: string
}

export type HierarchicalNet = {
  pathKey: string
  documentId: string
  netId: string
  name: string
}

export type ProjectFailure = { ok: false; project: DiagramProject; message: string }
export type ProjectSuccess<T> = { ok: true; project: DiagramProject; value: T }
export type ProjectResult<T> = ProjectSuccess<T> | ProjectFailure

const KNOWN_IMPLEMENTATIONS = new Set(['none', 'diagram'])

export function createProject(name: string, root?: DiagramDocument): DiagramProject {
  const document = root ?? emptyDocument()
  return {
    schemaVersion: 1,
    id: createId('prj'),
    name,
    rootDocumentId: document.id,
    documents: [document],
    components: [],
    extra: {},
  }
}

export function documentById(project: DiagramProject, documentId: string): DiagramDocument | null {
  return project.documents.find((document) => document.id === documentId) ?? null
}

export function componentById(project: DiagramProject, componentId: string): ComponentDefinition | null {
  return project.components.find((component) => component.id === componentId) ?? null
}

export function implementationDocument(project: DiagramProject, componentId: string): DiagramDocument | null {
  const component = componentById(project, componentId)
  if (!component || component.implementation.kind !== 'diagram' || !component.implementation.documentId) return null
  return documentById(project, component.implementation.documentId)
}

function cloneProject(project: DiagramProject): DiagramProject {
  return JSON.parse(JSON.stringify(project)) as DiagramProject
}

function fail(project: DiagramProject, message: string): ProjectFailure {
  return { ok: false, project, message }
}

function dependencyEdges(project: DiagramProject): Map<string, string[]> {
  const edges = new Map<string, string[]>()
  for (const component of project.components) {
    const targets: string[] = []
    if (component.implementation.kind === 'diagram' && component.implementation.documentId) {
      const document = documentById(project, component.implementation.documentId)
      for (const block of document?.blocks ?? []) {
        if (block.componentId && !targets.includes(block.componentId)) targets.push(block.componentId)
      }
    }
    edges.set(component.id, targets)
  }
  return edges
}

/** Directed cycles in the component graph. A repeated instance of one component is not a cycle. */
export function findCycles(project: DiagramProject): string[][] {
  const edges = dependencyEdges(project)
  const seen = new Set<string>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const cycles: string[][] = []
  function walk(id: string): void {
    if (onStack.has(id)) {
      const start = stack.indexOf(id)
      cycles.push([...stack.slice(start), id])
      return
    }
    if (seen.has(id)) return
    seen.add(id)
    onStack.add(id)
    stack.push(id)
    for (const next of edges.get(id) ?? []) walk(next)
    stack.pop()
    onStack.delete(id)
  }
  for (const component of project.components) walk(component.id)
  return cycles
}

export function validateProject(project: DiagramProject): ProjectDiagnostic[] {
  const found: ProjectDiagnostic[] = []
  const componentIds = new Set<string>()
  const documentIds = new Set<string>()
  for (const document of project.documents) {
    if (documentIds.has(document.id)) {
      found.push({ kind: 'duplicate-id', documentId: document.id, message: `Document ${document.id} is repeated.` })
    }
    documentIds.add(document.id)
  }
  if (!documentIds.has(project.rootDocumentId)) {
    found.push({ kind: 'missing-root', documentId: project.rootDocumentId, message: 'The root document is not in the project.' })
  }
  for (const component of project.components) {
    if (componentIds.has(component.id)) {
      found.push({ kind: 'duplicate-id', componentId: component.id, message: `Component ${component.name} repeats an id.` })
    }
    componentIds.add(component.id)
    if (!KNOWN_IMPLEMENTATIONS.has(component.implementation.kind)) {
      found.push({
        kind: 'unsupported-implementation',
        componentId: component.id,
        message: `${component.name} uses implementation “${component.implementation.kind}”, which this version stores but does not open.`,
      })
    }
    if (component.implementation.kind === 'diagram') {
      if (!component.implementation.documentId || !documentIds.has(component.implementation.documentId)) {
        found.push({
          kind: 'missing-document',
          componentId: component.id,
          documentId: component.implementation.documentId,
          message: `${component.name} cites a diagram that is not in the project.`,
        })
      }
    }
    if (component.symbolId && !project.documents.some((document) => document.symbols.some((symbol) => symbol.id === component.symbolId))) {
      found.push({
        kind: 'missing-symbol',
        componentId: component.id,
        message: `${component.name} cites a symbol that is not in the project.`,
      })
    }
  }
  for (const document of project.documents) {
    const owners = project.components.filter(
      (component) => component.implementation.kind === 'diagram' && component.implementation.documentId === document.id,
    )
    for (const block of document.blocks) {
      if (block.componentId && !componentIds.has(block.componentId)) {
        found.push({
          kind: 'missing-component',
          componentId: block.componentId,
          documentId: document.id,
          message: `${block.name} cites ${block.componentId}, which is not defined. No replacement was created.`,
        })
      }
    }
    for (const port of document.ports) {
      if (!port.interfacePortId) continue
      const block = document.blocks.find((item) => item.id === port.blockId)
      const allowed = new Set<string>()
      for (const owner of owners) for (const pin of owner.ports) allowed.add(pin.id)
      if (block?.componentId) {
        const cited = componentById(project, block.componentId)
        for (const pin of cited?.ports ?? []) allowed.add(pin.id)
      }
      if (!allowed.has(port.interfacePortId)) {
        found.push({
          kind: 'invalid-interface',
          documentId: document.id,
          message: `Port ${port.name} cites interface ${port.interfacePortId}, which is not a port of the related component.`,
        })
      }
    }
  }
  for (const cycle of findCycles(project)) {
    found.push({ kind: 'cycle', message: `Component cycle: ${cycle.join(' → ')}.` })
  }
  return found
}

function acyclic(project: DiagramProject, next: DiagramProject): ProjectFailure | null {
  const cycle = findCycles(next)[0]
  if (!cycle) return null
  return fail(project, `Component cycle: ${cycle.join(' → ')}. The project was not changed.`)
}

export function addComponent(
  project: DiagramProject,
  input: {
    id?: string
    name: string
    description?: string
    ports?: ComponentPort[]
    symbolId?: string
    bindings?: InterfaceBinding[]
    revision?: number
    implementation: ComponentImplementation | { kind: 'diagram'; document: DiagramDocument }
  },
): ProjectResult<{ componentId: string }> {
  const componentId = input.id ?? createId('cmp')
  if (project.components.some((component) => component.id === componentId)) {
    return fail(project, `${input.name} repeats an id. The project was not changed.`)
  }
  const spec = input.implementation
  let implementation: ComponentImplementation
  let incoming: DiagramDocument | null = null
  if ('document' in spec) {
    incoming = spec.document
    if (project.documents.some((document) => document.id === incoming?.id)) {
      return fail(project, `Document ${spec.document.id} is already in the project. The project was not changed.`)
    }
    implementation = { kind: 'diagram', documentId: spec.document.id }
  } else {
    if (spec.kind === 'diagram' && spec.documentId && !documentById(project, spec.documentId)) {
      return fail(project, 'The implementation diagram is not in the project. The project was not changed.')
    }
    implementation = {
      kind: spec.kind,
      ...(spec.documentId ? { documentId: spec.documentId } : {}),
      ...(spec.extra ? { extra: spec.extra } : {}),
    }
  }
  const next = cloneProject(project)
  if (incoming) next.documents.push(JSON.parse(JSON.stringify(incoming)) as DiagramDocument)
  next.components.push({
    id: componentId,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    ports: (input.ports ?? []).map((port) => ({ id: port.id, name: port.name })),
    ...(input.symbolId ? { symbolId: input.symbolId } : {}),
    bindings: (input.bindings ?? []).map((binding) => ({ ...binding })),
    implementation,
    ...(typeof input.revision === 'number' ? { revision: input.revision } : {}),
  })
  const cycle = acyclic(project, next)
  if (cycle) return cycle
  return { ok: true, project: next, value: { componentId } }
}

export function setImplementation(
  project: DiagramProject,
  componentId: string,
  documentId: string | null,
): ProjectResult<{ componentId: string }> {
  const component = componentById(project, componentId)
  if (!component) return fail(project, 'That component is not in the project. The project was not changed.')
  if (documentId && !documentById(project, documentId)) {
    return fail(project, 'The implementation diagram is not in the project. The project was not changed.')
  }
  const next = cloneProject(project)
  const target = next.components.find((item) => item.id === componentId)
  if (!target) return fail(project, 'That component is not in the project. The project was not changed.')
  target.implementation = documentId ? { kind: 'diagram', documentId } : { kind: 'none' }
  const cycle = acyclic(project, next)
  if (cycle) return cycle
  return { ok: true, project: next, value: { componentId } }
}

function symbolSource(project: DiagramProject, symbolId: string): { document: DiagramDocument; symbolIndex: number } | null {
  for (const document of project.documents) {
    const symbolIndex = document.symbols.findIndex((symbol) => symbol.id === symbolId)
    if (symbolIndex >= 0) return { document, symbolIndex }
  }
  return null
}

/** Give every logical port an instance port. An existing port that already cites the id is left alone. */
function coverLogicalPorts(document: DiagramDocument, blockId: string, ports: ComponentPort[]): void {
  for (const [index, pin] of ports.entries()) {
    if (document.ports.some((port) => port.blockId === blockId && port.interfacePortId === pin.id)) continue
    const side = index % 2 === 0 ? 'left' : 'right'
    const mates = document.ports.filter((port) => port.blockId === blockId && port.side === side).length
    document.ports.push({
      id: createId('prt'),
      blockId,
      name: pin.name,
      side,
      t: (mates + 1) / (mates + 2),
      interfacePortId: pin.id,
    })
  }
}

function applyBindings(document: DiagramDocument, blockId: string, bindings: InterfaceBinding[], logicalPorts: ComponentPort[]): void {
  for (const port of document.ports) {
    if (port.blockId !== blockId || !port.symbolPortId) continue
    const binding = bindings.find((item) => item.symbolPortId === port.symbolPortId)
    if (!binding) continue
    port.interfacePortId = binding.interfacePortId
    const logical = logicalPorts.find((item) => item.id === binding.interfacePortId)
    if (logical) port.name = logical.name
  }
}

/**
 * Place one instance on a sheet.
 * The implementation diagram is not copied. The new block and its ports get new ids.
 */
export function instantiateComponent(
  project: DiagramProject,
  documentId: string,
  componentId: string,
  at: Point,
  name?: string,
): ProjectResult<{ blockId: string }> {
  const component = componentById(project, componentId)
  if (!component) return fail(project, 'That component is not in the project. The project was not changed.')
  if (!documentById(project, documentId)) return fail(project, 'That diagram is not in the project. The project was not changed.')
  if (component.symbolId && !symbolSource(project, component.symbolId)) {
    return fail(project, `${component.name} cites a symbol that is not in the project. Nothing was placed.`)
  }
  const next = cloneProject(project)
  const document = documentById(next, documentId)
  const defined = componentById(next, componentId)
  if (!document || !defined) return fail(project, 'The project was not changed.')
  let blockId: string | null = null
  if (defined.symbolId) {
    const source = symbolSource(next, defined.symbolId)
    const symbol = source?.document.symbols[source.symbolIndex]
    if (!symbol || !source) return fail(project, `${defined.name} cites a symbol that is not in the project. Nothing was placed.`)
    if (source.document.id !== document.id) {
      const adopted = adoptLibrarySymbol(document, symbol, source.document.assets)
      if (!adopted.ok) return fail(project, adopted.message)
    }
    blockId = instantiateSymbol(document, defined.symbolId, at, name ?? defined.name)
    if (!blockId) return fail(project, 'The symbol could not be placed. The project was not changed.')
    applyBindings(document, blockId, defined.bindings, defined.ports)
  } else {
    blockId = createId('blk')
    document.blocks.push({
      id: blockId,
      name: name ?? defined.name,
      x: at.x,
      y: at.y,
      width: 120,
      height: 80,
    })
    defined.ports.forEach((pin, index) => {
      const side = index % 2 === 0 ? 'left' : 'right'
      const count = defined.ports.filter((_, pinIndex) => pinIndex % 2 === index % 2).length
      const slot = defined.ports.slice(0, index).filter((_, pinIndex) => pinIndex % 2 === index % 2).length
      document.ports.push({
        id: createId('prt'),
        blockId: blockId!,
        name: pin.name,
        side,
        t: (slot + 1) / (count + 1),
        interfacePortId: pin.id,
      })
    })
  }
  const block = document.blocks.find((item) => item.id === blockId)
  if (block) block.componentId = componentId
  coverLogicalPorts(document, blockId, defined.ports)
  releaseUnboundSymbolPorts(document, blockId)
  const cycle = acyclic(project, next)
  if (cycle) return cycle
  return { ok: true, project: next, value: { blockId: blockId! } }
}

export function instancesOf(project: DiagramProject, componentId: string): Array<{ documentId: string; blockId: string; name: string }> {
  const found: Array<{ documentId: string; blockId: string; name: string }> = []
  for (const document of project.documents) {
    for (const block of document.blocks) {
      if (block.componentId === componentId) found.push({ documentId: document.id, blockId: block.id, name: block.name })
    }
  }
  return found
}

export function documentsReferencing(project: DiagramProject, componentId: string): string[] {
  return [...new Set(instancesOf(project, componentId).map((instance) => instance.documentId))]
}

export function removeComponent(project: DiagramProject, componentId: string): ProjectResult<{ componentId: string }> {
  const component = componentById(project, componentId)
  if (!component) return fail(project, 'That component is not in the project. The project was not changed.')
  const used = instancesOf(project, componentId)
  if (used.length > 0) {
    const names = used.map((instance) => instance.name).join(', ')
    return fail(project, `${component.name} is used by ${names}. Remove those instances first. The project was not changed.`)
  }
  const next = cloneProject(project)
  const target = componentById(next, componentId)
  if (!target) return fail(project, 'That component is not in the project. The project was not changed.')
  const symbolId = target.symbolId
  const documentId = target.implementation.kind === 'diagram' ? target.implementation.documentId : undefined
  next.components = next.components.filter((item) => item.id !== componentId)
  if (symbolId && !next.components.some((item) => item.symbolId === symbolId) && !next.documents.some((document) => document.blocks.some((block) => block.symbolId === symbolId))) {
    for (const document of next.documents) {
      document.symbols = document.symbols.filter((symbol) => symbol.id !== symbolId)
      pruneAssets(document)
    }
  }
  if (documentId && documentId !== next.rootDocumentId && !next.components.some((item) => item.implementation.documentId === documentId)) {
    next.documents = next.documents.filter((document) => document.id !== documentId)
  }
  return { ok: true, project: next, value: { componentId } }
}

export function instancePaths(project: DiagramProject): InstancePath[] {
  const paths: InstancePath[] = []
  function walk(documentId: string, steps: InstanceStep[], labels: string[], stack: string[]): void {
    const document = documentById(project, documentId)
    if (!document || stack.includes(documentId)) return
    for (const block of document.blocks) {
      if (!block.componentId) continue
      const step: InstanceStep = { documentId, blockId: block.id, componentId: block.componentId }
      const nextSteps = [...steps, step]
      const nextLabels = [...labels, block.name]
      paths.push({ steps: nextSteps, key: nextSteps.map((item) => item.blockId).join('/'), label: `/${[project.name, ...nextLabels].join('/')}` })
      const child = implementationDocument(project, block.componentId)
      if (child) walk(child.id, nextSteps, nextLabels, [...stack, documentId])
    }
  }
  walk(project.rootDocumentId, [], [], [])
  return paths
}

/**
 * A net stays in its document.
 * The same definition seen through two instance paths is two hierarchical nets, even when the names match.
 */
export function hierarchicalNets(project: DiagramProject): HierarchicalNet[] {
  const nets: HierarchicalNet[] = []
  const root = documentById(project, project.rootDocumentId)
  for (const net of root?.nets ?? []) {
    nets.push({ pathKey: '', documentId: project.rootDocumentId, netId: net.id, name: net.name })
  }
  const seen = new Set<string>()
  for (const path of instancePaths(project)) {
    const leaf = path.steps[path.steps.length - 1]
    if (!leaf) continue
    const child = implementationDocument(project, leaf.componentId)
    if (!child) continue
    const marker = `${path.key}:${child.id}`
    if (seen.has(marker)) continue
    seen.add(marker)
    for (const net of child.nets) {
      nets.push({ pathKey: path.key, documentId: child.id, netId: net.id, name: net.name })
    }
  }
  return nets
}
