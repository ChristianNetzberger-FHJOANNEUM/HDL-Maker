export interface LayoutFrame {
  origin_x: number
  origin_y: number
  scale: number
}

export interface EditablePort {
  id: string
  name: string
  direction: 'in' | 'out' | 'inout' | 'buffer' | 'linkage' | null
  type_text: string | null
  range_text: string | null
  width: number | null
  width_status: 'literal' | 'scalar' | 'not_applicable' | 'unresolved'
  hds_object: number | null
  x1: number | null
  y1: number | null
  x2: number | null
  y2: number | null
}

export interface EditableInstance {
  id: string
  name: string
  component_name: string | null
  component_library: string | null
  design_unit_id: string | null
  x: number
  y: number
  width: number
  height: number
  hds_uid: string | null
  hds_object: number | null
  child_diagram_id: string | null
  generics: { name: string; type_text: string | null; value: string | null }[]
  ports: EditablePort[]
}

export interface EditableDiagramPort {
  id: string
  name: string
  direction: EditablePort['direction']
  type_text: string | null
  range_text: string | null
  width: number | null
  width_status: EditablePort['width_status']
  default_text: string | null
  hds_object: number | null
  x: number
  y: number
  box_width: number
  box_height: number
}

export interface EditableJunction {
  id: string
  x: number
  y: number
  hds_object: number | null
}

export interface EditableBlock {
  id: string
  name: string
  number: string | null
  text: string
  x: number
  y: number
  width: number
  height: number
  hds_object: number | null
}

export interface EditableLabel {
  id: string
  text: string
  x: number
  y: number
}

export interface WireEnd {
  kind: 'instance' | 'diagram_port' | 'embedded' | 'junction'
  owner_id: string
  port_id: string | null
}

export interface EditableWire {
  id: string
  net_id: string | null
  points: { x: number; y: number }[]
  start: WireEnd | null
  end: WireEnd | null
  slice_text: string | null
  hds_object: number | null
}

export interface NetEndpoint {
  id: string
  kind: 'instance' | 'diagram_port'
  owner_id: string
  port_id: string
  slice_text: string | null
}

export interface EditableNet {
  id: string
  name: string
  type_text: string | null
  range_text: string | null
  hds_object: number | null
  endpoints: NetEndpoint[]
}

export interface DiagramGenericDef {
  id: string
  name: string
  type_text: string | null
  default_text: string | null
}

export interface EditableDiagram {
  schema_version: 1
  id: string
  name: string
  entity_name: string | null
  architecture_name: string | null
  frame: LayoutFrame
  provenance: {
    library_id: string
    origin?: 'import' | 'created'
    source_diagram_id: string | null
    source_path: string | null
    source_sha256: string | null
  }
  generics: DiagramGenericDef[]
  instances: EditableInstance[]
  diagram_ports: EditableDiagramPort[]
  junctions: EditableJunction[]
  nets: EditableNet[]
  wires: EditableWire[]
  embedded_blocks: EditableBlock[]
  labels: EditableLabel[]
  preserved_records: { type_name: string; line: number; hds_object: number | null; payload: string }[]
  checks: { severity: string; code: string; message: string; path: string | null; line: number | null; unit_id: string | null }[]
}

export interface EditableSummary {
  id: string
  name: string
  library_id: string
  origin: 'import' | 'created'
  source_diagram_id: string | null
  source_path: string | null
  entity_name: string | null
}

export function newDiagramId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`
}
