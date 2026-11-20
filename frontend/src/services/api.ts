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

export function getProject(): Promise<ProjectFile> {
  return request<ProjectFile>('/api/project')
}

export function getExamplesPath(): Promise<string> {
  return request<{ path: string }>('/api/examples/path').then((body) => body.path)
}

export function scanLibrary(path: string, libraryName: string): Promise<ProjectFile> {
  return request<ProjectFile>('/api/libraries/scan', {
    method: 'POST',
    body: JSON.stringify({
      path,
      library_name: libraryName.trim() || null,
    }),
  })
}

export function getSource(unitId: string): Promise<SourceText> {
  return request<SourceText>(`/api/design-units/${encodeURIComponent(unitId)}/source`)
}
