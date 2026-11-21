import type { EditableDiagram, EditablePort, NetEndpoint } from '../../models/editable'

export interface Check {
  severity: 'error' | 'warning' | 'info'
  code: string
  message: string
}

const rangePattern = /\(\s*(-?\d+)\s+(?:downto|to)\s+(-?\d+)\s*\)/i

export function connectionChecks(diagram: EditableDiagram): Check[] {
  const ports = portIndex(diagram)
  const connected = new Set(diagram.nets.flatMap((net) => net.endpoints.map((item) => key(item.kind, item.owner_id, item.port_id))))
  const findings: Check[] = [...duplicateNames(diagram)]
  for (const net of diagram.nets) findings.push(...netFindings(diagram, net.name, net.endpoints, ports))
  for (const instance of diagram.instances) {
    for (const port of instance.ports) {
      const id = key('instance', instance.id, port.id)
      if (port.direction === 'in' && !connected.has(id)) {
        findings.push({ severity: 'warning', code: 'unconnected_input', message: `Input '${port.name}' of '${instance.name}' has no net.` })
      } else if (port.direction === null && !connected.has(id)) {
        findings.push({
          severity: 'info',
          code: 'direction_unknown',
          message: `Port '${port.name}' of '${instance.name}' has no recorded direction, so it is not treated as a required input.`,
        })
      }
    }
  }
  for (const port of diagram.diagram_ports) {
    if (port.direction === 'in' && !connected.has(key('diagram_port', port.id, port.id))) {
      findings.push({ severity: 'warning', code: 'unconnected_input', message: `Diagram input '${port.name}' has no net.` })
    }
  }
  return findings
}

function netFindings(diagram: EditableDiagram, name: string, endpoints: NetEndpoint[], ports: Map<string, EditablePort>): Check[] {
  const findings: Check[] = []
  const drivers: string[] = []
  const uncertain: string[] = []
  const widths: { label: string; width: number }[] = []
  const types: { label: string; value: string }[] = []
  let unresolved = false
  let missingType = false
  for (const endpoint of endpoints) {
    const port = ports.get(key(endpoint.kind, endpoint.owner_id, endpoint.port_id))
    const label = endpointLabel(diagram, endpoint, port)
    if (!port || port.direction === null || port.direction === 'inout') uncertain.push(label)
    else if (port.direction === 'out' || port.direction === 'buffer') drivers.push(label)
    const sliced = rangeWidth(endpoint.slice_text)
    if (sliced !== null) widths.push({ label, width: sliced })
    else if (port?.width_status === 'literal' && port.width !== null) widths.push({ label, width: port.width })
    else if (port?.width_status === 'scalar') widths.push({ label, width: 1 })
    else if (port?.width_status === 'unresolved') unresolved = true
    const known = knownType(port)
    if (known) types.push({ label, value: known })
    else missingType = true
  }
  if (drivers.length > 1) {
    findings.push({ severity: 'warning', code: 'multiple_drivers', message: `Net '${name}' has more than one driver: ${drivers.join(', ')}.` })
  } else if (drivers.length && uncertain.length) {
    findings.push({
      severity: 'info',
      code: 'driver_uncertain',
      message: `Net '${name}' has driver ${drivers[0]}. ${uncertain.join(', ')} has no definite direction, so a second driver is not assumed.`,
    })
  }
  const distinct = new Set(widths.map((item) => item.width))
  if (distinct.size > 1) {
    findings.push({
      severity: 'warning',
      code: 'width_mismatch',
      message: `Net '${name}' connects different widths: ${widths.map((item) => `${item.label} width ${item.width}`).join(', ')}.`,
    })
  } else if (unresolved) {
    findings.push({
      severity: 'info',
      code: 'width_unresolved',
      message: `Net '${name}' has a port whose width is not stated. No width was invented.`,
    })
  }
  const distinctTypes = new Set(types.map((item) => item.value))
  if (distinctTypes.size > 1) {
    findings.push({
      severity: 'warning',
      code: 'type_mismatch',
      message: `Net '${name}' connects different types: ${types.map((item) => `${item.label} ${item.value}`).join(', ')}.`,
    })
  } else if (missingType && types.length) {
    findings.push({
      severity: 'info',
      code: 'type_unresolved',
      message: `Net '${name}' has a port whose type is not stated. No type was invented.`,
    })
  }
  return findings
}

export function describedWidth(typeText: string | null, rangeText: string | null): { width: number | null; width_status: EditablePort['width_status'] } {
  const folded = (typeText ?? '').trim().toLowerCase()
  if (nonVector.has(folded) && !rangeText) return { width: null, width_status: 'not_applicable' }
  const parsed = rangeWidth(rangeText)
  if (parsed !== null) return { width: parsed, width_status: 'literal' }
  if (scalars.has(folded) && !rangeText) return { width: 1, width_status: 'scalar' }
  return { width: null, width_status: 'unresolved' }
}

const scalars = new Set(['std_logic', 'std_ulogic', 'bit'])
const nonVector = new Set(['integer', 'boolean', 'natural', 'positive', 'character', 'string'])

function duplicateNames(diagram: EditableDiagram): Check[] {
  return [
    ...repeated('Instance', diagram.instances.map((item) => item.name)),
    ...repeated('Top-level port', diagram.diagram_ports.map((item) => item.name)),
    ...repeated('Generic', (diagram.generics ?? []).map((item) => item.name)),
    ...(diagram.diagram_ports.some((port) => !port.name.trim())
      ? [{ severity: 'warning' as const, code: 'interface_unnamed', message: 'A top-level port has no name.' }]
      : []),
  ]
}

function repeated(kind: string, names: string[]): Check[] {
  const seen = new Set<string>()
  const reported = new Set<string>()
  const findings: Check[] = []
  for (const name of names) {
    const key = name.trim().toLowerCase()
    if (!key) continue
    if (seen.has(key) && !reported.has(key)) {
      findings.push({ severity: 'warning', code: 'duplicate_name', message: `${kind} name '${name}' is used more than once.` })
      reported.add(key)
    }
    seen.add(key)
  }
  return findings
}

function knownType(port: EditablePort | undefined): string | null {
  const folded = port?.type_text?.trim().toLowerCase().replace(/\s+/g, ' ') ?? ''
  return folded || null
}

function portIndex(diagram: EditableDiagram): Map<string, EditablePort> {
  const found = new Map<string, EditablePort>()
  for (const instance of diagram.instances) {
    for (const port of instance.ports) found.set(key('instance', instance.id, port.id), port)
  }
  for (const port of diagram.diagram_ports) {
    found.set(key('diagram_port', port.id, port.id), {
      id: port.id,
      name: port.name,
      direction: port.direction,
      type_text: port.type_text,
      range_text: port.range_text,
      width: port.width,
      width_status: port.width_status,
      hds_object: port.hds_object,
      x1: null,
      y1: null,
      x2: null,
      y2: null,
    })
  }
  return found
}

function endpointLabel(diagram: EditableDiagram, endpoint: NetEndpoint, port: EditablePort | undefined): string {
  const portName = port?.name ?? endpoint.port_id
  if (endpoint.kind === 'diagram_port') return portName
  const instance = diagram.instances.find((item) => item.id === endpoint.owner_id)
  return `${instance?.name ?? endpoint.owner_id}.${portName}`
}

function rangeWidth(text: string | null): number | null {
  if (!text) return null
  const match = rangePattern.exec(text)
  if (!match) return null
  return Math.abs(Number(match[1]) - Number(match[2])) + 1
}

function key(kind: string, ownerId: string, portId: string): string {
  return `${kind}:${ownerId}:${portId}`
}
