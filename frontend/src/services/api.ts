import type { EditableDiagram, EditableSummary } from '../models/editable'
import type { Diagnostic, FpgaBuildConfig, Health, ProjectFile, SimulationConfig, SourceText } from '../models/design'

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

export interface SimulationRun {
  run_id: string
  status: 'running' | 'passed' | 'failed'
  top: string
  vhdl_standard: '93' | '2008'
  library_profile: 'ieee' | 'synopsys'
  stop_time: string
  waveform_format: 'ghw' | 'vcd'
  ghdl_analysis: 'not_run' | 'passed' | 'failed'
  ghdl_elaboration: 'not_run' | 'passed' | 'failed'
  ghdl_simulation: 'not_run' | 'passed' | 'failed'
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  waveform_path: string | null
  directory: string
  diagnostics: Diagnostic[]
  stderr: string
}

export function saveSimulation(config: SimulationConfig): Promise<ProjectFile> {
  return request<ProjectFile>('/api/simulation', {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}

export function startSimulation(): Promise<SimulationRun> {
  return request<SimulationRun>('/api/simulation/runs', { method: 'POST' })
}

export function cancelSimulation(runId: string): Promise<SimulationRun> {
  return request<SimulationRun>(`/api/simulation/runs/${runId}/cancel`, { method: 'POST' })
}

export function getSimulationRun(runId: string): Promise<SimulationRun> {
  return request<SimulationRun>(`/api/simulation/runs/${runId}`)
}

export function getLatestSimulation(): Promise<SimulationRun | null> {
  return request<SimulationRun | null>('/api/simulation/runs/latest')
}

export function openWaveform(runId: string): Promise<{ opened: boolean; message: string; waveform_path: string }> {
  return request(`/api/simulation/runs/${runId}/gtkwave`, { method: 'POST' })
}

export interface FpgaStageMap {
  validation: 'not_run' | 'running' | 'passed' | 'failed'
  synthesis: 'not_run' | 'running' | 'passed' | 'failed'
  optimization: 'not_run' | 'running' | 'passed' | 'failed'
  placement: 'not_run' | 'running' | 'passed' | 'failed'
  routing: 'not_run' | 'running' | 'passed' | 'failed'
  bitstream: 'not_run' | 'running' | 'passed' | 'failed'
}

export interface FpgaBuild {
  build_id: string
  status: 'running' | 'passed' | 'failed'
  target: 'synthesis' | 'bitstream'
  top: string
  board_id: string
  part: string
  vhdl_standard: '93' | '2008'
  library_profile: 'ieee' | 'synopsys'
  xdc_paths: string[]
  directory: string
  vivado: string | null
  vivado_version: string | null
  stages: FpgaStageMap
  diagnostics: Diagnostic[]
  warnings: string[]
  errors: string[]
  warning_count: number
  error_count: number
  bitstream_path: string | null
  started_at: string
  finished_at: string | null
}

export function saveFpga(config: FpgaBuildConfig): Promise<ProjectFile> {
  return request<ProjectFile>('/api/fpga', {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}

export function checkVivado(): Promise<{ ok: boolean; message: string; version: string | null; path: string | null }> {
  return request('/api/fpga/vivado-check', { method: 'POST' })
}

export function startFpgaBuild(): Promise<FpgaBuild> {
  return request<FpgaBuild>('/api/fpga/builds', { method: 'POST' })
}

export function getFpgaBuild(buildId: string): Promise<FpgaBuild> {
  return request<FpgaBuild>(`/api/fpga/builds/${buildId}`)
}

export function getLatestFpgaBuild(): Promise<FpgaBuild | null> {
  return request<FpgaBuild | null>('/api/fpga/builds/latest')
}

export function cancelFpgaBuild(buildId: string): Promise<FpgaBuild> {
  return request<FpgaBuild>(`/api/fpga/builds/${buildId}/cancel`, { method: 'POST' })
}

export function getFpgaReport(buildId: string, name: string): Promise<{ name: string; text: string }> {
  return request(`/api/fpga/builds/${buildId}/reports/${name}`)
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
  state_text_px: number
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

export function saveVhdlStandard(vhdlStandard: '93' | '2008'): Promise<ProjectFile> {
  return request<ProjectFile>('/api/project/vhdl-standard', {
    method: 'PUT',
    body: JSON.stringify({ vhdl_standard: vhdlStandard }),
  })
}

export function saveLibraryProfile(libraryProfile: 'ieee' | 'synopsys'): Promise<ProjectFile> {
  return request<ProjectFile>('/api/project/library-profile', {
    method: 'PUT',
    body: JSON.stringify({ library_profile: libraryProfile }),
  })
}

export interface GenerateResult {
  vhdl_standard: '93' | '2008'
  library_profile: 'ieee' | 'synopsys'
  root_diagram_id: string
  output_dir: string
  files: { entity_name: string; library_name: string; relative_path: string; text: string }[]
  diagnostics: Diagnostic[]
  ghdl: 'not_run' | 'passed' | 'failed'
  ghdl_analysis: 'not_run' | 'passed' | 'failed'
  ghdl_elaboration: 'not_run' | 'passed' | 'failed'
  manifest_path: string | null
}

export function generateStructural(rootDiagramId: string): Promise<GenerateResult> {
  return request<GenerateResult>('/api/generate', {
    method: 'POST',
    body: JSON.stringify({ root_diagram_id: rootDiagramId }),
  })
}

export interface ToolSettings {
  gtkwave_path: string
  vivado_path: string
}

export function getTools(): Promise<ToolSettings> {
  return request<ToolSettings>('/api/tools')
}

export function saveTools(settings: ToolSettings): Promise<ToolSettings> {
  return request<ToolSettings>('/api/tools', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
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
