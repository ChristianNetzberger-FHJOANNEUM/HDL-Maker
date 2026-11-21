import type { EditableDiagram, EditableSummary } from '../models/editable'
import type { Health, ProjectFile, SourceText } from '../models/design'

export class ApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    throw await toError(response)
  }
  return (await response.json()) as T
}

async function toError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    const detail = body.detail
    if (detail && typeof detail === 'object' && 'message' in detail) {
      const record = detail as { code?: string; message?: string }
      return new ApiError(record.code ?? 'request_failed', record.message ?? response.statusText)
    }
    if (typeof detail === 'string') {
      return new ApiError('request_failed', detail)
    }
  } catch {
    // The body was not JSON.
  }
  return new ApiError('request_failed', `Request failed (${response.status}).`)
}

export function getHealth(): Promise<Health> {
  return request<Health>('/api/health')
}

export interface UiSettings {
  library_path: string
  library_name: string
  include_side_data: boolean
  board_id: string
  hierarchy_root_id: string
}

export interface BoardProfile {
  id: string
  name: string
  display_name: string
  vendor: string
  file_version: string
  revisions: string[]
  part_names: string[]
}

export function getProject(): Promise<ProjectFile> {
  return request<ProjectFile>('/api/project')
}

export function getUiSettings(): Promise<UiSettings> {
  return request<UiSettings>('/api/ui')
}

export function saveUiSettings(settings: UiSettings): Promise<UiSettings> {
  return request<UiSettings>('/api/ui', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

export function getBoards(): Promise<{ boards: BoardProfile[]; unreadable: string[] }> {
  return request<{ boards: BoardProfile[]; unreadable: string[] }>('/api/boards')
}

export function getExamplesPath(): Promise<string> {
  return request<{ path: string }>('/api/examples/path').then((body) => body.path)
}

export function scanLibrary(path: string, libraryName: string, includeSideData = false): Promise<ProjectFile> {
  return request<ProjectFile>('/api/libraries/scan', {
    method: 'POST',
    body: JSON.stringify({
      path,
      library_name: libraryName.trim() || null,
      include_side_data: includeSideData,
    }),
  })
}

export function getSource(unitId: string): Promise<SourceText> {
  return request<SourceText>(`/api/design-units/${encodeURIComponent(unitId)}/source`)
}

export function createDesign(name: string, libraryId: string): Promise<EditableDiagram> {
  return request<EditableDiagram>('/api/editable-diagrams', {
    method: 'POST',
    body: JSON.stringify({ name, library_id: libraryId }),
  })
}

export function getEditableDiagram(diagramId: string): Promise<EditableDiagram> {
  return request<EditableDiagram>(`/api/editable-diagrams/${encodeURIComponent(diagramId)}`)
}

export function createEditableDiagram(sourceId: string): Promise<EditableDiagram> {
  return request<EditableDiagram>(`/api/editable-diagrams/from-import/${encodeURIComponent(sourceId)}`, {
    method: 'POST',
  })
}

export function saveEditableDiagram(diagram: EditableDiagram): Promise<EditableDiagram> {
  return request<EditableDiagram>(`/api/editable-diagrams/${encodeURIComponent(diagram.id)}`, {
    method: 'PUT',
    body: JSON.stringify(diagram),
  })
}

export function listEditableDiagrams(): Promise<EditableSummary[]> {
  return request<EditableSummary[]>('/api/editable-diagrams')
}
