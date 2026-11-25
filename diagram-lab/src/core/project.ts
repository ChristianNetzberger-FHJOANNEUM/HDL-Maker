import { auditAssets } from './assets'
import {
  addComponent,
  componentById,
  createProject,
  documentById,
  implementationDocument,
  instantiateComponent,
  type ComponentDefinition,
  type ComponentImplementation,
  type DiagramProject,
} from './component'
import { parseDocument, serialize } from './document'
import { emptyDocument } from './edit'
import { defineSymbol } from './symbols'

export const PROJECT_SCHEMA = 1 as const

const KNOWN_KEYS = new Set(['schemaVersion', 'id', 'name', 'rootDocumentId', 'documents', 'components', 'extra'])

export function serializeProject(project: DiagramProject): string {
  const body: Record<string, unknown> = {
    schemaVersion: project.schemaVersion,
    id: project.id,
    name: project.name,
    rootDocumentId: project.rootDocumentId,
    documents: project.documents.map((document) => JSON.parse(serialize(document)) as unknown),
    components: project.components,
    extra: project.extra,
  }
  return JSON.stringify(body)
}

export function parseProject(text: string): DiagramProject {
  const raw = JSON.parse(text) as Record<string, unknown>
  if (raw.schemaVersion !== PROJECT_SCHEMA) throw new Error('Unsupported project schema.')
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string' || typeof raw.rootDocumentId !== 'string') {
    throw new Error('Project id is missing.')
  }
  if (!Array.isArray(raw.documents)) throw new Error('Project documents are missing.')
  const documents = raw.documents.map((item, index) => {
    try {
      return parseDocument(JSON.stringify(item))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid document.'
      throw new Error(`Document ${index + 1} was refused. ${message}`)
    }
  })
  for (const document of documents) {
    const audited = auditAssets(document.assets ?? [])
    if (!audited.ok) throw new Error(audited.message)
  }
  const components = (Array.isArray(raw.components) ? raw.components : []).map((item, index) => parseComponent(item, index))
  const extra = isRecord(raw.extra) ? { ...raw.extra } : {}
  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) extra[key] = raw[key]
  }
  return {
    schemaVersion: PROJECT_SCHEMA,
    id: raw.id,
    name: raw.name,
    rootDocumentId: raw.rootDocumentId,
    documents,
    components,
    extra,
  }
}

function parseComponent(value: unknown, index: number): ComponentDefinition {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') {
    throw new Error(`Component ${index + 1} is missing an id or a name.`)
  }
  if (!Array.isArray(value.ports)) throw new Error(`${value.name} is missing its ports.`)
  const ports = value.ports.map((port) => {
    if (!isRecord(port) || typeof port.id !== 'string' || typeof port.name !== 'string') {
      throw new Error(`${value.name} has a port without an id.`)
    }
    return { id: port.id, name: port.name }
  })
  const bindings = Array.isArray(value.bindings)
    ? value.bindings.map((binding) => {
        if (!isRecord(binding) || typeof binding.interfacePortId !== 'string' || typeof binding.symbolPortId !== 'string') {
          throw new Error(`${value.name} has a binding without ids.`)
        }
        return { interfacePortId: binding.interfacePortId, symbolPortId: binding.symbolPortId }
      })
    : []
  return {
    id: value.id,
    name: value.name,
    ...(typeof value.description === 'string' ? { description: value.description } : {}),
    ports,
    ...(typeof value.symbolId === 'string' ? { symbolId: value.symbolId } : {}),
    bindings,
    implementation: parseImplementation(value.implementation, value.name),
    ...(typeof value.revision === 'number' ? { revision: value.revision } : {}),
  }
}

function parseImplementation(value: unknown, name: string): ComponentImplementation {
  if (value === undefined) return { kind: 'none' }
  if (!isRecord(value) || typeof value.kind !== 'string') throw new Error(`${name} has an invalid implementation.`)
  const extra: Record<string, unknown> = {}
  if (isRecord(value.extra)) {
    for (const [key, item] of Object.entries(value.extra)) extra[key] = item
  }
  for (const key of Object.keys(value)) {
    if (key !== 'kind' && key !== 'documentId' && key !== 'extra') extra[key] = value[key]
  }
  return {
    kind: value.kind,
    ...(typeof value.documentId === 'string' ? { documentId: value.documentId } : {}),
    ...(Object.keys(extra).length > 0 ? { extra } : {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export type StoredProject = { id: string; name: string }

export interface ProjectStorage {
  save(project: DiagramProject): Promise<void>
  load(id: string): Promise<DiagramProject>
  list(): Promise<StoredProject[]>
}

export class JsonProjectStorage implements ProjectStorage {
  private records = new Map<string, string>()

  async save(project: DiagramProject): Promise<void> {
    this.records.set(project.id, serializeProject(project))
  }

  async load(id: string): Promise<DiagramProject> {
    const text = this.records.get(id)
    if (text === undefined) throw new Error('Project not found.')
    return parseProject(text)
  }

  async list(): Promise<StoredProject[]> {
    return [...this.records.entries()].map(([id, text]) => {
      const project = parseProject(text)
      return { id, name: project.name }
    })
  }
}

/**
 * Undo for a project transaction.
 * A document edit stays on EditSession. This history is only for project commands.
 * A refused command does not add a step.
 */
export class ProjectSession {
  private past: string[] = []
  private future: string[] = []

  constructor(
    private current: () => DiagramProject,
    private replace: (project: DiagramProject) => void,
  ) {}

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  transact(apply: (project: DiagramProject) => DiagramProject): boolean {
    const before = this.current()
    const next = apply(before)
    if (next === before) return false
    this.past.push(serializeProject(before))
    this.future = []
    if (this.past.length > 40) this.past.shift()
    this.replace(next)
    return true
  }

  undo(): void {
    const previous = this.past.pop()
    if (!previous) return
    this.future.push(serializeProject(this.current()))
    this.replace(parseProject(previous))
  }

  redo(): void {
    const next = this.future.pop()
    if (!next) return
    this.past.push(serializeProject(this.current()))
    this.replace(parseProject(next))
  }

  /** Drop project history. Used when a different project is opened. */
  clear(): void {
    this.past = []
    this.future = []
  }
}

/** A small hierarchy: one shared counter sheet, two instances, one nested part, one unimplemented part. */
export function sampleProject(): DiagramProject {
  let project = createProject('Sample')
  const rootId = project.rootDocumentId
  const root = documentById(project, rootId)
  if (!root) throw new Error('The sample root is missing.')
  const symbolId = defineSymbol(root, {
    name: 'Counter',
    width: 120,
    height: 80,
    ports: [
      { id: 'pin_clk', name: 'clk', side: 'left', t: 0.35 },
      { id: 'pin_q', name: 'q', side: 'right', t: 0.5 },
    ],
  })
  const counter = addComponent(project, {
    name: 'Counter',
    description: 'One diagram, two instances.',
    revision: 1,
    ports: [
      { id: 'ifp_clk', name: 'clk' },
      { id: 'ifp_q', name: 'q' },
    ],
    symbolId,
    bindings: [
      { interfacePortId: 'ifp_clk', symbolPortId: 'pin_clk' },
      { interfacePortId: 'ifp_q', symbolPortId: 'pin_q' },
    ],
    implementation: { kind: 'diagram', document: emptyDocument() },
  })
  if (!counter.ok) throw new Error(counter.message)
  project = counter.project
  const stage = addComponent(project, {
    name: 'Stage',
    ports: [{ id: 'ifp_stage', name: 'd' }],
    implementation: { kind: 'diagram', document: emptyDocument() },
  })
  if (!stage.ok) throw new Error(stage.message)
  project = stage.project
  const buffer = addComponent(project, {
    name: 'Buffer',
    description: 'Not implemented yet.',
    ports: [{ id: 'ifp_buf', name: 'd' }],
    implementation: { kind: 'none' },
  })
  if (!buffer.ok) throw new Error(buffer.message)
  project = buffer.project
  const counterDocId = componentById(project, counter.value.componentId)?.implementation.documentId
  if (!counterDocId) throw new Error('Counter has no diagram.')
  const placedU1 = instantiateComponent(project, rootId, counter.value.componentId, { x: 80, y: 80 }, 'U1')
  if (!placedU1.ok) throw new Error(placedU1.message)
  project = placedU1.project
  const placedU2 = instantiateComponent(project, rootId, counter.value.componentId, { x: 360, y: 80 }, 'U2')
  if (!placedU2.ok) throw new Error(placedU2.message)
  project = placedU2.project
  const stageDocId = componentById(project, stage.value.componentId)?.implementation.documentId
  if (!stageDocId) throw new Error('Stage has no diagram.')
  const placedStage = instantiateComponent(project, counterDocId, stage.value.componentId, { x: 80, y: 80 }, 'Stage')
  if (!placedStage.ok) throw new Error(placedStage.message)
  project = placedStage.project
  const placedBuffer = instantiateComponent(project, rootId, buffer.value.componentId, { x: 80, y: 240 }, 'Buf')
  if (!placedBuffer.ok) throw new Error(placedBuffer.message)
  project = placedBuffer.project
  const child = documentById(project, counterDocId)
  const sheet = documentById(project, rootId)
  const stageSheet = documentById(project, stageDocId)
  if (!child || !sheet || !stageSheet) throw new Error('A sample diagram is missing.')
  const boundaryId = 'blk_boundary'
  child.blocks.push({ id: boundaryId, name: 'Boundary', x: 40, y: 200, width: 88, height: 48 })
  child.ports.push({
    id: 'prt_inner_clk',
    blockId: boundaryId,
    name: 'clock',
    side: 'left',
    t: 0.5,
    interfacePortId: 'ifp_clk',
  })
  child.nets.push({ id: 'net_child_tick', name: 'tick' })
  sheet.nets.push({ id: 'net_top_tick', name: 'tick' })
  stageSheet.nets.push({ id: 'net_stage_tick', name: 'tick' })
  return project
}
