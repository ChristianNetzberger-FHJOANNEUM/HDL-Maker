import {
  componentById,
  documentById,
  implementationDocument,
  instancesOf,
  type DiagramProject,
  type InstanceStep,
} from './component'
import type { DiagramDocument } from './document'
import { EditSession } from './session'

/** Where the editor is. Steps are block ids. The open document is derived from them. */
export type HierarchyLocation = {
  projectId: string
  rootDocumentId: string
  steps: InstanceStep[]
  componentId: string | null
  documentId: string
}

export type NavigationMove =
  | { kind: 'ok'; location: HierarchyLocation }
  | { kind: 'stay'; location: HierarchyLocation; message: string }
  | { kind: 'repaired'; location: HierarchyLocation; message: string }

export type Crumb = {
  steps: InstanceStep[]
  label: string
  blockId: string | null
}

export type TreeStatus = 'diagram' | 'none' | 'unsupported' | 'missing' | 'cycle'

export type TreeNode = {
  key: string
  steps: InstanceStep[]
  instanceName: string
  componentName: string
  componentId: string
  blockId: string
  status: TreeStatus
  expandable: boolean
}

export function rootLocation(project: DiagramProject): HierarchyLocation {
  return {
    projectId: project.id,
    rootDocumentId: project.rootDocumentId,
    steps: [],
    componentId: null,
    documentId: project.rootDocumentId,
  }
}

function locationFrom(project: DiagramProject, steps: InstanceStep[], documentId: string): HierarchyLocation {
  const leaf = steps[steps.length - 1]
  return {
    projectId: project.id,
    rootDocumentId: project.rootDocumentId,
    steps,
    componentId: leaf?.componentId ?? null,
    documentId,
  }
}

function childDocument(project: DiagramProject, componentId: string): DiagramDocument | null {
  const component = componentById(project, componentId)
  if (!component || component.implementation.kind !== 'diagram') return null
  return implementationDocument(project, componentId)
}

/** Walk a stored path. A broken step stops at the last sheet that still exists. */
export function resolveLocation(project: DiagramProject, steps: InstanceStep[]): { location: HierarchyLocation; message: string | null } {
  let documentId = project.rootDocumentId
  const kept: InstanceStep[] = []
  const seen = new Set<string>([documentId])
  for (const step of steps) {
    const document = documentById(project, documentId)
    const block = document?.blocks.find((item) => item.id === step.blockId)
    if (!document || !block || block.componentId !== step.componentId) {
      return {
        location: locationFrom(project, kept, documentId),
        message: 'The instance path no longer matches the sheet. Opened the last valid level.',
      }
    }
    const child = childDocument(project, block.componentId)
    if (!child) {
      return {
        location: locationFrom(project, kept, documentId),
        message: `${block.name} has no diagram at this step. Opened the last valid level.`,
      }
    }
    if (seen.has(child.id)) {
      return {
        location: locationFrom(project, kept, documentId),
        message: 'The path repeats a diagram. Opened the last valid level.',
      }
    }
    kept.push({ documentId, blockId: block.id, componentId: block.componentId })
    seen.add(child.id)
    documentId = child.id
  }
  return { location: locationFrom(project, kept, documentId), message: null }
}

/** Open the diagram of one instance on the current sheet. The diagram is not copied. */
export function descend(project: DiagramProject, location: HierarchyLocation, blockId: string): NavigationMove {
  const document = documentById(project, location.documentId)
  const block = document?.blocks.find((item) => item.id === blockId)
  if (!document || !block) return { kind: 'stay', location, message: 'That block is not on this sheet.' }
  if (!block.componentId) return { kind: 'stay', location, message: `${block.name} is not a component.` }
  const component = componentById(project, block.componentId)
  if (!component) {
    return { kind: 'stay', location, message: `${block.name} cites ${block.componentId}, which is not in the project.` }
  }
  if (component.implementation.kind === 'none') {
    return { kind: 'stay', location, message: `${component.name} has no implementation yet.` }
  }
  if (component.implementation.kind !== 'diagram') {
    return { kind: 'stay', location, message: `${component.name} uses ${component.implementation.kind}, and that editor is not available yet.` }
  }
  const child = implementationDocument(project, component.id)
  if (!child) {
    return { kind: 'stay', location, message: `${component.name} cites a diagram that is not in the project.` }
  }
  const seen = new Set<string>([project.rootDocumentId])
  for (const step of location.steps) {
    const earlier = childDocument(project, step.componentId)
    if (earlier) seen.add(earlier.id)
  }
  if (seen.has(child.id)) {
    return { kind: 'stay', location, message: `${component.name} would repeat a diagram that is already open above it.` }
  }
  const steps = [...location.steps, { documentId: location.documentId, blockId: block.id, componentId: block.componentId }]
  return { kind: 'ok', location: locationFrom(project, steps, child.id) }
}

export function parentLocation(project: DiagramProject, location: HierarchyLocation): HierarchyLocation {
  if (location.steps.length === 0) return rootLocation(project)
  return resolveLocation(project, location.steps.slice(0, -1)).location
}

export function breadcrumbs(project: DiagramProject, location: HierarchyLocation): Crumb[] {
  const crumbs: Crumb[] = [{ steps: [], label: project.name, blockId: null }]
  location.steps.forEach((step, index) => {
    const document = documentById(project, step.documentId)
    const block = document?.blocks.find((item) => item.id === step.blockId)
    const component = componentById(project, step.componentId)
    const instance = block?.name ?? step.blockId
    const name = component?.name ?? step.componentId
    crumbs.push({
      steps: location.steps.slice(0, index + 1),
      label: `${instance} : ${name}`,
      blockId: step.blockId,
    })
  })
  return crumbs
}

export function sharedDefinitionLabel(project: DiagramProject, location: HierarchyLocation): string | null {
  if (!location.componentId) return null
  const component = componentById(project, location.componentId)
  if (!component) return null
  const count = instancesOf(project, component.id).length
  if (count < 2) return null
  return `${component.name} — shared definition — ${count} instances`
}

/** Immediate instances on the sheet reached by `steps`. A repeated diagram is not expanded. */
export function treeNodes(project: DiagramProject, steps: InstanceStep[]): TreeNode[] {
  const where = resolveLocation(project, steps)
  const document = documentById(project, where.location.documentId)
  if (!document) return []
  const seen = new Set<string>([project.rootDocumentId])
  for (const step of where.location.steps) {
    const child = childDocument(project, step.componentId)
    if (child) seen.add(child.id)
  }
  const nodes: TreeNode[] = []
  for (const block of document.blocks) {
    if (!block.componentId) continue
    const component = componentById(project, block.componentId)
    const nextSteps = [...where.location.steps, { documentId: document.id, blockId: block.id, componentId: block.componentId }]
    let status: TreeStatus = 'missing'
    let expandable = false
    if (!component) status = 'missing'
    else if (component.implementation.kind === 'none') status = 'none'
    else if (component.implementation.kind !== 'diagram') status = 'unsupported'
    else {
      const child = implementationDocument(project, component.id)
      if (!child) status = 'missing'
      else if (seen.has(child.id)) status = 'cycle'
      else {
        status = 'diagram'
        expandable = child.blocks.some((item) => item.componentId)
      }
    }
    nodes.push({
      key: nextSteps.map((step) => step.blockId).join('/'),
      steps: nextSteps,
      instanceName: block.name,
      componentName: component?.name ?? block.componentId,
      componentId: block.componentId,
      blockId: block.id,
      status,
      expandable,
    })
  }
  return nodes
}

/** World bounds of blocks and wire points. Used only to ask Vue Flow to frame the sheet. */
export function contentBounds(doc: DiagramDocument): { x: number; y: number; width: number; height: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const include = (x: number, y: number): void => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  for (const block of doc.blocks) {
    include(block.x, block.y)
    include(block.x + block.width, block.y + block.height)
  }
  for (const segment of doc.segments) {
    for (const point of segment.points) include(point.x, point.y)
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 200, height: 120 }
  return { x: minX, y: minY, width: Math.max(40, maxX - minX), height: Math.max(40, maxY - minY) }
}

/**
 * One edit history per document id.
 * Two instance paths that open the same diagram share this session.
 */
export class DocumentSessions {
  private sessions = new Map<string, EditSession>()

  constructor(
    private lookup: (documentId: string) => DiagramDocument | null,
    private commit: (doc: DiagramDocument) => void,
  ) {}

  get(documentId: string): EditSession {
    const existing = this.sessions.get(documentId)
    if (existing) return existing
    let current = this.lookup(documentId)
    const session = new EditSession(
      () => this.lookup(documentId) ?? current ?? this.lookup(documentId)!,
      (next) => {
        current = next
        this.commit(next)
      },
    )
    this.sessions.set(documentId, session)
    return session
  }

  discard(): void {
    this.sessions.clear()
  }

  /** True when an open sheet still has its own undo or redo steps. */
  anyPending(): boolean {
    for (const session of this.sessions.values()) {
      if (session.canUndo || session.canRedo) return true
    }
    return false
  }
}
