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

export interface OpenSourceBuild {
  build_id: string
  toolchain: string
  status: 'running' | 'passed' | 'failed'
  target: string
  top: string
  part: string
  directory: string
  vhdl_standard: '93' | '2008'
  stages: Record<string, 'not_run' | 'running' | 'passed' | 'failed'>
  diagnostics: Diagnostic[]
  bitstream_path: string | null
  bitstream_bytes: number | null
  reports: {
    nextpnr?: {
      slice_lutx: number | null
      slice_ffx: number | null
      carry4: number | null
      critical_path_ns: number | null
      logic_ns: number | null
      routing_ns: number | null
      max_frequency_mhz: number | null
    }
  }
}

export interface OpenSourceTools {
  ghdl_path: string
  yosys_path: string
  nextpnr_xilinx_path: string
  fasm2frames_path: string
  xc7frames2bit_path: string
  prjxray_db_path: string
  openfpga_loader_path: string
}

export interface ValidationState {
  build_passed: boolean | null
  jtag_detected: boolean | null
  programming_completed: boolean | null
  hardware_function_verified: boolean | null
}

export interface BuildSummary {
  build_id: string
  toolchain: 'vivado' | 'opensource'
  part: string
  vhdl_standard: string
  status: string
  elapsed_seconds: number | null
  bitstream_path: string | null
  bitstream_sha256: string | null
  bitstream_bytes: number | null
  resources: Record<string, number | null>
  timing: Record<string, number | string | null>
  warnings: string[]
  validation: ValidationState
}

export interface HardwareValidation {
  validation_id: string
  build_id: string | null
  toolchain: string
  part: string
  bitstream_sha256: string | null
  bitstream_path: string | null
  file_present: boolean
  build_passed: boolean | null
  jtag_detected: boolean | null
  programming_completed: boolean | null
  hardware_function_verified: boolean | null
  evidence: string
}

export interface FpgaComparison {
  timing_note: string
  resource_note: string
  vivado: BuildSummary | null
  opensource: BuildSummary | null
  validations: HardwareValidation[]
}

export interface OpenCheck {
  ok: boolean
  tools: Record<string, { path: string | null; version: string | null; ok: boolean; code: string | null }>
  database: { zynq7: string | null }
}

export function getFpgaComparison(): Promise<FpgaComparison> {
  return request<FpgaComparison>('/api/fpga/comparison')
}

export function getOpenSourceTools(): Promise<OpenSourceTools> {
  return request<OpenSourceTools>('/api/fpga/opensource/tools')
}

export function saveOpenSourceTools(settings: OpenSourceTools): Promise<OpenSourceTools> {
  return request<OpenSourceTools>('/api/fpga/opensource/tools', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

export function checkOpenSource(): Promise<OpenCheck> {
  return request<OpenCheck>('/api/fpga/opensource/check', { method: 'POST' })
}

export function startOpenBuild(): Promise<OpenSourceBuild> {
  return request<OpenSourceBuild>('/api/fpga/opensource/builds', { method: 'POST' })
}

export function getOpenBuild(buildId: string): Promise<OpenSourceBuild> {
  return request<OpenSourceBuild>(`/api/fpga/opensource/builds/${buildId}`)
}

export function getLatestOpenBuild(): Promise<OpenSourceBuild | null> {
  return request<OpenSourceBuild | null>('/api/fpga/opensource/builds/latest')
}

export interface OpenDevice {
  device_id: string
  name: string
  kind: string
  part: string
  idcode: string
  raw_idcode: string | null
  matches_part: boolean
}

export interface OpenScan {
  scan_id: string
  status: 'running' | 'devices' | 'failed'
  mock: boolean
  programmed: boolean
  serial: string
  part: string
  devices: OpenDevice[]
  message: string
}

export interface OpenProgram {
  program_id: string
  status: 'running' | 'failed' | 'mock_passed' | 'passed'
  mock: boolean
  programmed: boolean
  mode: string
  message: string
  device_name: string
}

export function startOpenScan(serial: string): Promise<OpenScan> {
  return request<OpenScan>('/api/fpga/opensource/hardware/scans', {
    method: 'POST',
    body: JSON.stringify({ serial }),
  })
}

export function getOpenScan(scanId: string): Promise<OpenScan> {
  return request<OpenScan>(`/api/fpga/opensource/hardware/scans/${scanId}`)
}

export function startOpenProgram(body: { scan_id: string; device_id: string; build_id: string; confirm: boolean }): Promise<OpenProgram> {
  return request<OpenProgram>('/api/fpga/opensource/hardware/programs', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getOpenProgram(programId: string): Promise<OpenProgram> {
  return request<OpenProgram>(`/api/fpga/opensource/hardware/programs/${programId}`)
}

export interface HwDevice {
  device_id: string
  target: string
  name: string
  part: string
  matches_part: boolean
}

export interface HwScan {
  scan_id: string
  status: 'running' | 'devices' | 'no_hardware' | 'failed'
  mock: boolean
  programmed: boolean
  jtag_download: string
  part: string
  devices: HwDevice[]
  message: string
  diagnostics: Diagnostic[]
}

export interface HwProgram {
  program_id: string
  scan_id: string
  build_id: string
  status: 'running' | 'mock_passed' | 'passed' | 'failed'
  mock: boolean
  programmed: boolean
  jtag_download: string
  part: string
  device_name: string
  target: string
  bitstream_path: string | null
  message: string
  diagnostics: Diagnostic[]
}

export function getLatestBitstream(): Promise<FpgaBuild | null> {
  return request<FpgaBuild | null>('/api/fpga/bitstreams/latest')
}

export function startHardwareScan(): Promise<HwScan> {
  return request<HwScan>('/api/fpga/hardware/scans', { method: 'POST' })
}

export function getHardwareScan(scanId: string): Promise<HwScan> {
  return request<HwScan>(`/api/fpga/hardware/scans/${scanId}`)
}

export function startProgram(body: { scan_id: string; device_id: string; build_id: string; confirm: boolean }): Promise<HwProgram> {
  return request<HwProgram>('/api/fpga/hardware/programs', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getProgram(programId: string): Promise<HwProgram> {
  return request<HwProgram>(`/api/fpga/hardware/programs/${programId}`)
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
  port_label_style: 'short' | 'long'
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
