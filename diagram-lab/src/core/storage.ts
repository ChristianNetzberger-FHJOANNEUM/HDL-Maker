import type { DiagramDocument } from './document'
import { parseDocument, serialize } from './document'

export type StoredDiagram = { id: string; name: string }

/**
 * The first storage keeps the canonical JSON text.
 * A file download, a workspace folder, or a course server can implement the same methods.
 */
export interface DiagramStorage {
  save(doc: DiagramDocument): Promise<void>
  load(id: string): Promise<DiagramDocument>
  list(): Promise<StoredDiagram[]>
}

export class JsonRecordStorage implements DiagramStorage {
  private records = new Map<string, string>()

  async save(doc: DiagramDocument): Promise<void> {
    this.records.set(doc.id, serialize(doc))
  }

  async load(id: string): Promise<DiagramDocument> {
    const text = this.records.get(id)
    if (text === undefined) throw new Error('Diagram not found.')
    return parseDocument(text)
  }

  async list(): Promise<StoredDiagram[]> {
    return [...this.records.entries()].map(([id, text]) => ({ id, name: diagramName(parseDocument(text)) }))
  }

  exportText(id: string): string {
    const text = this.records.get(id)
    if (text === undefined) throw new Error('Diagram not found.')
    return text
  }

  async importText(text: string): Promise<DiagramDocument> {
    const doc = parseDocument(text)
    await this.save(doc)
    return doc
  }
}

export function diagramName(doc: DiagramDocument): string {
  return doc.blocks[0]?.name ?? doc.id
}

export function jsonFileName(doc: DiagramDocument): string {
  return `${doc.id}.json`
}
