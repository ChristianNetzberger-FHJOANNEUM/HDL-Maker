export type Direction = 'in' | 'out' | 'inout' | 'buffer' | 'linkage' | null
export type WidthStatus = 'literal' | 'scalar' | 'not_applicable' | 'unresolved'
export type UnitKind =
  | 'entity'
  | 'architecture'
  | 'package'
  | 'package_body'
  | 'configuration'
  | 'context'
export type ParseStatus = 'parsed' | 'partial' | 'unsupported' | 'skipped'
export type Severity = 'error' | 'warning' | 'info'

export interface Diagnostic {
  severity: Severity
  code: string
  message: string
  path: string | null
  line: number | null
  unit_id: string | null
}

export interface Port {
  id: string
  name: string
  direction: Direction
  type_text: string
  range_text: string | null
  width: number | null
  width_status: WidthStatus
  default_text: string | null
}

export interface GenericPort {
  id: string
  name: string
  generic_kind: string
  type_text: string | null
  default_text: string | null
}

export interface DesignUnit {
  id: string
  library_id: string
  kind: UnitKind
  name: string
  language: string
  parent_name: string | null
  generics: GenericPort[]
  ports: Port[]
  dependencies: string[]
  instantiates?: string[]
  source: {
    path: string
    sha256: string
    start_line: number
    end_line: number
  }
  parse_status: ParseStatus
  diagnostics: Diagnostic[]
}

export interface FileEntry {
  path: string
  extension: string
  size: number
  role: string
  classification: string
  binary: boolean
}

export interface Library {
  id: string
  name: string
  root_path: string
  imported_at: string
  updated_at: string
  last_import: {
    library_id: string
    library_name: string
    root_path: string
    scanned_at: string
    files: FileEntry[]
    unit_ids: string[]
    counts: Record<string, number>
    diagnostics: Diagnostic[]
  } | null
}

export interface ProjectFile {
  schema_version: number
  project_id: string
  name: string
  libraries: Library[]
  design_units: DesignUnit[]
  diagrams: DiagramDocument[]
}

export interface DiagramPort {
  id: string
  name: string
  direction: Direction
  type_text: string | null
  range_text: string | null
  hds_uid: string | null
  hds_object: number | null
  marker_m: number | null
  x1: number | null
  y1: number | null
  x2: number | null
  y2: number | null
}

export interface DiagramInstance {
  id: string
  name: string
  component_name: string | null
  component_library: string | null
  hds_uid: string | null
  hds_object: number | null
  x1: number | null
  y1: number | null
  x2: number | null
  y2: number | null
  generics: { name: string; type_text: string | null; value: string | null }[]
  ports: DiagramPort[]
}

export interface DiagramWire {
  id: string
  hds_uid: string | null
  hds_object: number | null
  start_object: number | null
  end_object: number | null
  net_object: number | null
  points: { x: number; y: number }[]
}

export interface DiagramDocument {
  id: string
  library_id: string
  source_path: string
  sha256: string
  view: 'block' | 'symbol' | 'state' | 'unknown'
  entity_name: string | null
  architecture_name: string | null
  machine_name: string | null
  state_signal_name: string | null
  parse_status: ParseStatus
  instances: DiagramInstance[]
  ports: DiagramPort[]
  nets: { id: string; name: string; hds_object: number | null }[]
  wires: DiagramWire[]
  embedded_blocks: {
    id: string
    name: string
    number: string | null
    text: string | null
    x1: number | null
    y1: number | null
    x2: number | null
    y2: number | null
  }[]
  preserved_records: { type_name: string; line: number }[]
  diagnostics: Diagnostic[]
  vhdl_check: Diagnostic[]
}

export interface Health {
  status: string
  service: string
  version: string
  python: string
  ghdl: string | null
}

export interface SourceText {
  path: string
  start_line: number
  end_line: number
  text: string
  truncated: boolean
  language: string
}
