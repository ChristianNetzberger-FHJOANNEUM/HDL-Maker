import { createId, type DiagramDocument, type Endpoint, type Junction, type Label, type Point, type Segment, type Waypoint } from './document'
import type { TextAlign } from './textTypography'
import { endpointPoint, orthogonalTo, pointOnEdge, portAnchor, refreshAll, refreshSegment, samePoint, simplifyOrthogonal } from './geometry'

export const SNAP = 14

export type SnapHit =
  | { kind: 'port'; portId: string; point: Point }
  | { kind: 'junction'; junctionId: string; point: Point }
  | { kind: 'segment'; segmentId: string; point: Point; edge: number; distance: number }
  | { kind: 'end'; segmentId: string; which: 'start' | 'end'; point: Point }
  | { kind: 'free'; point: Point }
  | { kind: 'ambiguous'; point: Point }

export type WireResult =
  | { ok: true; netId: string; segmentId: string; createdNet: boolean }
  | { ok: false; reason: string; netIds: string[] }

export type LabelTextFormat = 'plain' | 'latex' | 'markdown'

/**
 * Resolve the string drawn for a label (A2-P2).
 * Note labels → `label.text`. Name labels → custom `displayText` when set, else `Net.name`.
 * Empty/whitespace `displayText` is treated as absent (callers should delete it via `setLabelDisplayText`).
 * For LaTeX labels this is the source text (SVG is a runtime artefact from the math service).
 */
export function labelText(doc: DiagramDocument, label: Label): string {
  const anchor = label.anchor
  if (anchor.kind !== 'segment' || label.role === 'note') return label.text
  const custom = typeof label.displayText === 'string' ? label.displayText.trim() : ''
  if (custom.length > 0) return custom
  const segment = doc.segments.find((item) => item.id === anchor.segmentId)
  const net = doc.nets.find((item) => item.id === segment?.netId)
  return net?.name ?? label.text
}

/**
 * Effective text format for drawing (A2-P3).
 * Inherited net-name labels and note labels are always plain.
 * Missing `textFormat` means plain. LaTeX applies only with a custom `displayText`.
 */
export function labelTextFormat(label: Label): LabelTextFormat {
  if (!isNameLabel(label)) return 'plain'
  const custom = typeof label.displayText === 'string' ? label.displayText.trim() : ''
  if (custom.length === 0) return 'plain'
  if (label.textFormat === 'latex') return 'latex'
  if (label.textFormat === 'markdown') return 'markdown'
  return 'plain'
}

/**
 * Set or clear a name-label display override (A2-P2).
 * `null` / empty / whitespace → delete `displayText` and `textFormat` (inherit net name).
 * Does not rename nets, change visibility, or move the label.
 */
export function setLabelDisplayText(doc: DiagramDocument, labelId: string, value: string | null): boolean {
  const label = doc.labels.find((item) => item.id === labelId)
  if (!label || !isNameLabel(label)) return false
  const trimmed = typeof value === 'string' ? value.trim() : ''
  const before = typeof label.displayText === 'string' ? label.displayText : undefined
  if (trimmed.length === 0) {
    let changed = false
    if (before !== undefined) {
      delete label.displayText
      changed = true
    }
    if (label.textFormat !== undefined) {
      delete label.textFormat
      changed = true
    }
    if (label.textAlign !== undefined) {
      delete label.textAlign
      changed = true
    }
    if (label.fontSize !== undefined) {
      delete label.fontSize
      changed = true
    }
    return changed
  }
  if (before === trimmed) return false
  label.displayText = trimmed
  return true
}

/**
 * Set Plain Text vs LaTeX for a custom name-label display (A2-P3).
 * No-op when the label inherits the net name (no custom displayText).
 * `'plain'` deletes `textFormat`; `'latex'` stores it. Preserves source text.
 */
export function setLabelTextFormat(doc: DiagramDocument, labelId: string, format: LabelTextFormat): boolean {
  const label = doc.labels.find((item) => item.id === labelId)
  if (!label || !isNameLabel(label)) return false
  const custom = typeof label.displayText === 'string' ? label.displayText.trim() : ''
  if (custom.length === 0) return false
  const before: LabelTextFormat =
    label.textFormat === 'latex' ? 'latex' : label.textFormat === 'markdown' ? 'markdown' : 'plain'
  if (before === format) return false
  if (format === 'plain') delete label.textFormat
  else label.textFormat = format
  return true
}

/**
 * Set display text and/or format in one mutation (A2-P3 — single history entry).
 * Clearing text also clears format (inherit net name as plain).
 */
export function setLabelDisplay(
  doc: DiagramDocument,
  labelId: string,
  fields: { text?: string | null; format?: LabelTextFormat },
): boolean {
  const label = doc.labels.find((item) => item.id === labelId)
  if (!label || !isNameLabel(label)) return false
  let changed = false
  if (fields.text !== undefined) {
    if (setLabelDisplayText(doc, labelId, fields.text)) changed = true
  }
  if (fields.format !== undefined) {
    if (setLabelTextFormat(doc, labelId, fields.format)) changed = true
  }
  return changed
}

/** A2-P5a — wire label typography (custom display only). */
export function setLabelTypography(
  doc: DiagramDocument,
  labelId: string,
  fields: { fontSize?: number | null; textAlign?: TextAlign | null },
): boolean {
  const label = doc.labels.find((item) => item.id === labelId)
  if (!label || !isNameLabel(label)) return false
  const custom = typeof label.displayText === 'string' ? label.displayText.trim() : ''
  if (custom.length === 0) return false
  let changed = false
  if (fields.fontSize !== undefined) {
    const before = label.fontSize
    if (fields.fontSize === null || !Number.isFinite(fields.fontSize) || fields.fontSize <= 0) {
      if (before !== undefined) {
        delete label.fontSize
        changed = true
      }
    } else if (before !== fields.fontSize) {
      label.fontSize = fields.fontSize
      changed = true
    }
  }
  if (fields.textAlign !== undefined) {
    const before = label.textAlign
    if (fields.textAlign === null || fields.textAlign === 'left') {
      if (before !== undefined) {
        delete label.textAlign
        changed = true
      }
    } else if (before !== fields.textAlign) {
      label.textAlign = fields.textAlign
      changed = true
    }
  }
  return changed
}

export function resetLabelTypography(doc: DiagramDocument, labelId: string): boolean {
  return setLabelTypography(doc, labelId, { fontSize: null, textAlign: null })
}

export function netPortIds(doc: DiagramDocument, netId: string): string[] {
  const ids = new Set<string>()
  for (const segment of doc.segments) {
    if (segment.netId !== netId) continue
    if (segment.start.kind === 'port') ids.add(segment.start.portId)
    if (segment.end.kind === 'port') ids.add(segment.end.portId)
  }
  return [...ids]
}

/** Sheet-scope lookup by display name (D5c.5). Exact match after trim. */
export function findNetByName(doc: DiagramDocument, rawName: string): { id: string; name: string } | null {
  const name = rawName.trim()
  if (!name) return null
  const net = doc.nets.find((item) => item.name === name)
  return net ? { id: net.id, name: net.name } : null
}

export function netsNamed(doc: DiagramDocument, rawName: string): string[] {
  const name = rawName.trim()
  if (!name) return []
  return doc.nets.filter((item) => item.name === name).map((item) => item.id)
}

export function nameCollisions(doc: DiagramDocument): Array<{ name: string; netIds: string[]; count: number }> {
  const groups = new Map<string, string[]>()
  for (const net of doc.nets) {
    const list = groups.get(net.name) ?? []
    list.push(net.id)
    groups.set(net.name, list)
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([name, netIds]) => ({ name, netIds, count: netIds.length }))
    .sort((a, b) => (a.name < b.name ? -1 : 1))
}

/** Family base for generated suffixes (`out_1` → `out`). Legacy names with spaces are never parsed. */
export function netNameFamilyBase(raw: string): string {
  const trimmed = raw.trim() || 'net'
  const match = /^(.+)_(\d+)$/.exec(trimmed)
  return match ? match[1]! : trimmed
}

function occupiedNetNames(doc: DiagramDocument): Set<string> {
  return new Set(doc.nets.map((net) => net.name.trim()))
}

/**
 * Deterministic unique net display name on this sheet.
 * Uses unsuffixed preferred when free, then smallest gap in `base_1`, `base_2`, …
 */
export function allocateUniqueNetName(doc: DiagramDocument, preferredRaw: string): string {
  const preferred = preferredRaw.trim() || 'net'
  const occupied = occupiedNetNames(doc)
  if (!occupied.has(preferred)) return preferred
  const base = netNameFamilyBase(preferred)
  let index = 1
  while (occupied.has(`${base}_${index}`)) index += 1
  return `${base}_${index}`
}

/** @deprecated Use `allocateUniqueNetName` — kept as alias for existing imports. */
export function uniqueNetName(doc: DiagramDocument, baseRaw: string): string {
  return allocateUniqueNetName(doc, baseRaw)
}

/** New logical net: unique display name and a new net id (independent create — not by-name join). */
export function createIndependentNet(doc: DiagramDocument, preferredBase?: string): string {
  const name = allocateUniqueNetName(doc, preferredBase ?? 'net')
  const id = createId('net')
  doc.nets.push({ id, name })
  return id
}

/** Reuse an existing sheet net with this name, or create one. */
export function ensureNetByName(doc: DiagramDocument, rawName: string): string {
  const name = rawName.trim()
  if (!name) return createNet(doc)
  const existing = findNetByName(doc, name)
  if (existing) return existing.id
  const id = createId('net')
  doc.nets.push({ id, name })
  return id
}

/**
 * Merge every sheet net that shares `name` into one id (keep lexicographically smallest id).
 * Used for legacy collisions; does not run automatically on load.
 */
export function mergeNetsByName(doc: DiagramDocument, rawName: string): { ok: true; keptId: string; merged: number } | { ok: false; reason: string } {
  const name = rawName.trim()
  if (!name) return { ok: false, reason: 'Wire name cannot be empty.' }
  const ids = netsNamed(doc, name).sort()
  if (ids.length === 0) return { ok: false, reason: 'No net with that name.' }
  if (ids.length === 1) return { ok: true, keptId: ids[0]!, merged: 0 }
  const keptId = ids[0]!
  let merged = 0
  for (const dropId of ids.slice(1)) {
    if (mergeNets(doc, keptId, dropId)) merged += 1
  }
  return { ok: true, keptId, merged }
}

export function snapTarget(doc: DiagramDocument, point: Point): SnapHit {
  const found: Array<{ hit: SnapHit; rank: number; gap: number }> = []
  for (const port of doc.ports) {
    const anchor = portAnchor(doc, port.id)
    if (!anchor) continue
    const gap = Math.hypot(anchor.x - point.x, anchor.y - point.y)
    if (gap <= SNAP) found.push({ hit: { kind: 'port', portId: port.id, point: anchor }, rank: 0, gap })
  }
  for (const junction of doc.junctions) {
    const gap = Math.hypot(junction.x - point.x, junction.y - point.y)
    if (gap <= SNAP) found.push({ hit: { kind: 'junction', junctionId: junction.id, point: { x: junction.x, y: junction.y } }, rank: 1, gap })
  }
  for (const segment of doc.segments) {
    if (segment.start.kind === 'free') {
      const gap = Math.hypot(segment.start.x - point.x, segment.start.y - point.y)
      if (gap <= SNAP) found.push({ hit: { kind: 'end', segmentId: segment.id, which: 'start', point: { x: segment.start.x, y: segment.start.y } }, rank: 2, gap })
    }
    if (segment.end.kind === 'free') {
      const gap = Math.hypot(segment.end.x - point.x, segment.end.y - point.y)
      if (gap <= SNAP) found.push({ hit: { kind: 'end', segmentId: segment.id, which: 'end', point: { x: segment.end.x, y: segment.end.y } }, rank: 2, gap })
    }
    const projected = projectOnto(segment.points, point)
    if (projected && projected.distance <= SNAP) {
      found.push({
        hit: { kind: 'segment', segmentId: segment.id, point: projected.point, edge: projected.edge, distance: projected.along },
        rank: 3,
        gap: projected.distance,
      })
    }
  }
  if (found.length === 0) return { kind: 'free', point: { ...point } }
  found.sort((a, b) => a.rank - b.rank || a.gap - b.gap)
  const best = found.filter((item) => item.rank === found[0].rank)
  const separated = best.some((item) => Math.hypot(item.hit.point.x - best[0].hit.point.x, item.hit.point.y - best[0].hit.point.y) > 8)
  if (best.length > 1 && separated) return { kind: 'ambiguous', point: { ...point } }
  return best[0].hit
}

/** Refuse before any edit when two nets would be joined by accident. */
export function probeWire(doc: DiagramDocument, start: SnapHit, end: SnapHit): WireResult {
  if (start.kind === 'ambiguous' || end.kind === 'ambiguous') {
    return { ok: false, reason: 'Two targets overlap. Choose one.', netIds: [] }
  }
  if (samePoint(start.point, end.point, 4)) return { ok: false, reason: 'That wire has no length.', netIds: [] }
  const nets = [...new Set([...netsTouching(doc, start), ...netsTouching(doc, end)])]
  if (nets.length > 1) return { ok: false, reason: 'Two nets meet. Merge them explicitly.', netIds: nets }
  return { ok: true, netId: nets[0] ?? '', segmentId: '', createdNet: nets.length === 0 }
}

export function commitWire(doc: DiagramDocument, points: Point[], start: SnapHit, end: SnapHit): WireResult {
  const probe = probeWire(doc, start, end)
  if (!probe.ok) return probe
  if (start.kind === 'end') return extendSegment(doc, points, start, end)
  const resolvedStart = resolveHit(doc, start)
  const resolvedEnd = resolveHit(doc, end)
  if ('error' in resolvedStart) return { ok: false, reason: resolvedStart.error, netIds: [] }
  if ('error' in resolvedEnd) return { ok: false, reason: resolvedEnd.error, netIds: [] }
  // Geometry wins when a hit already touches a net; else unique independent net (port name = preferred label only).
  let createdNet = false
  let netId = probe.netId
  if (!netId) {
    const inherited = inheritNetName(doc, start, end)
    netId = createIndependentNet(doc, inherited ?? undefined)
    createdNet = true
  }
  const segmentId = createId('seg')
  const routedPoints = simplifyOrthogonal(points.map((point) => ({ ...point })))
  if (routedPoints.length >= 1) routedPoints[0] = { ...routedPoints[0], ...resolvedStart.point }
  if (routedPoints.length >= 2) routedPoints[routedPoints.length - 1] = { ...routedPoints[routedPoints.length - 1], ...resolvedEnd.point }
  doc.segments.push({
    id: segmentId,
    netId,
    points: routedPoints.length >= 2 ? routedPoints : [resolvedStart.point, resolvedEnd.point],
    start: resolvedStart.endpoint,
    end: resolvedEnd.endpoint,
    routed: 'manual',
  })
  const segment = doc.segments.find((item) => item.id === segmentId)
  if (segment) refreshSegment(doc, segment)
  addNameLabel(doc, segmentId, 0, 16, 14)
  return { ok: true, netId, segmentId, createdNet }
}

export function mergeNets(doc: DiagramDocument, keepId: string, dropId: string): boolean {
  if (keepId === dropId) return false
  if (!doc.nets.some((net) => net.id === keepId) || !doc.nets.some((net) => net.id === dropId)) return false
  for (const segment of doc.segments) if (segment.netId === dropId) segment.netId = keepId
  for (const junction of doc.junctions) if (junction.netId === dropId) junction.netId = keepId
  doc.nets = doc.nets.filter((net) => net.id !== dropId)
  return true
}

/**
 * Remove one segment, then split the net only when deletion fractures a previously
 * single geometric component (DEL10 / Fall B). Multi-fragment canonical nets (Fall A/C)
 * keep one netId when unrelated stubs survive.
 */
export function deleteSegment(doc: DiagramDocument, segmentId: string): string[] {
  const segment = doc.segments.find((item) => item.id === segmentId)
  if (!segment) return []
  const netId = segment.netId
  const beforeOwned = doc.segments.filter((item) => item.netId === netId)
  doc.segments = doc.segments.filter((item) => item.id !== segmentId)
  doc.labels = doc.labels.filter((label) => label.anchor.kind !== 'segment' || label.anchor.segmentId !== segmentId)
  return reassignComponents(doc, netId, beforeOwned)
}

/**
 * After deletions on `netId`, assign new net ids only when a **single** geometric
 * component (ports/junctions) was fractured into two or more (bridge cut).
 * Pre-existing multiple components on one canonical net (shared-by-intent) are unchanged (DEL10).
 */
export function reassignComponents(doc: DiagramDocument, netId: string, beforeOwned?: Segment[]): string[] {
  const owned = doc.segments.filter((segment) => segment.netId === netId)
  const afterComponents = componentsOf(owned)
  if (afterComponents.length <= 1) {
    pruneTopology(doc)
    return []
  }
  const beforeComponents = beforeOwned ? componentsOf(beforeOwned) : []
  const shouldSplit = beforeComponents.length === 1 && afterComponents.length > 1
  if (!shouldSplit) {
    pruneTopology(doc)
    return []
  }
  const ranked = afterComponents
    .map((ids) => ({ ids, key: [...ids].sort()[0] ?? '' }))
    .sort((a, b) => (a.key < b.key ? -1 : 1))
  const net = doc.nets.find((item) => item.id === netId)
  const created: string[] = []
  for (const component of ranked.slice(1)) {
    // Unique names so a geometric split does not recreate silent name collisions (D5c.5).
    const id = createId('net')
    doc.nets.push({ id, name: allocateUniqueNetName(doc, net?.name ?? 'net') })
    created.push(id)
    for (const segmentId of component.ids) {
      const segment = doc.segments.find((item) => item.id === segmentId)
      if (segment) segment.netId = id
    }
  }
  for (const junction of doc.junctions) {
    const host = doc.segments.find(
      (segment) =>
        (segment.start.kind === 'junction' && segment.start.junctionId === junction.id) ||
        (segment.end.kind === 'junction' && segment.end.junctionId === junction.id),
    )
    if (host) junction.netId = host.netId
  }
  pruneTopology(doc)
  return created
}

export function pruneTopology(doc: DiagramDocument): void {
  const used = new Set<string>()
  for (const segment of doc.segments) {
    if (segment.start.kind === 'junction') used.add(segment.start.junctionId)
    if (segment.end.kind === 'junction') used.add(segment.end.junctionId)
  }
  doc.junctions = doc.junctions.filter((junction) => used.has(junction.id))
  const nets = new Set(doc.segments.map((segment) => segment.netId))
  doc.nets = doc.nets.filter((net) => nets.has(net.id))
}

export type RenameNetResult =
  | { ok: true; name: string; joined: boolean; netId: string }
  | { ok: false; reason: string }

/**
 * Rename a net (D5c.4 / D5c.5). Empty / whitespace-only names are refused.
 * If another sheet net already uses the name, **join** into that net (keep the
 * target id, drop this one). A free new name only renames — no silent split.
 */
export function renameNet(doc: DiagramDocument, netId: string, rawName: string): RenameNetResult {
  const net = doc.nets.find((item) => item.id === netId)
  if (!net) return { ok: false, reason: 'No net for this wire.' }
  const name = rawName.trim()
  if (!name) return { ok: false, reason: 'Wire name cannot be empty.' }
  const target = doc.nets.find((item) => item.id !== netId && item.name === name)
  if (target) {
    if (!mergeNets(doc, target.id, netId)) return { ok: false, reason: 'Could not join nets.' }
    return { ok: true, name, joined: true, netId: target.id }
  }
  net.name = name
  return { ok: true, name, joined: false, netId }
}

export function addNameLabel(doc: DiagramDocument, segmentId: string, edge: number, distance: number, offset: number): string | null {
  const segment = doc.segments.find((item) => item.id === segmentId)
  if (!segment) return null
  const net = doc.nets.find((item) => item.id === segment.netId)
  const id = createId('lbl')
  doc.labels.push({
    id,
    text: net?.name ?? '',
    role: 'name',
    anchor: { kind: 'segment', segmentId, edge, distance, offset },
  })
  return id
}

/**
 * Remove name-label instances anchored on one segment (P5b).
 * Does not delete the segment, rename/remove the net, or change geometry.
 * Note-role labels on the same segment are left alone. Missing `role` ≡ name.
 * @returns true when at least one label was removed.
 */
export function removeSegmentNameLabels(doc: DiagramDocument, segmentId: string): boolean {
  const before = doc.labels.length
  doc.labels = doc.labels.filter((label) => {
    if (label.anchor.kind !== 'segment' || label.anchor.segmentId !== segmentId) return true
    if (label.role === 'note') return true
    return false
  })
  return doc.labels.length < before
}

/** True when the label is a net-name label (explicit or legacy missing role). */
export function isNameLabel(label: { role?: 'name' | 'note' }): boolean {
  return label.role !== 'note'
}

export function moveLabelAlong(doc: DiagramDocument, labelId: string, edge: number, distance: number): void {
  const label = doc.labels.find((item) => item.id === labelId)
  if (!label || label.anchor.kind !== 'segment') return
  label.anchor = { ...label.anchor, edge, distance }
}

/** Default normal offset used by `addNameLabel` / reset (diagram units). */
export const DEFAULT_NAME_LABEL_OFFSET = 14

export function setLabelOffset(doc: DiagramDocument, labelId: string, offset: number): void {
  const label = doc.labels.find((item) => item.id === labelId)
  if (!label || label.anchor.kind !== 'segment') return
  // Legacy 1D API: clear free shift so drawing uses `offset` again.
  const next = { ...label.anchor, offset }
  delete next.shift
  label.anchor = next
}

/**
 * Place a segment-anchored label from a world point (D5c.1 / P5a).
 * Stays on the same segment; stores free 2D `shift` from the on-wire attachment
 * so labels may sit beyond endpoints (unlike the legacy 1D normal offset).
 */
export function placeLabelAt(doc: DiagramDocument, labelId: string, point: Point): boolean {
  const label = doc.labels.find((item) => item.id === labelId)
  if (!label || label.anchor.kind !== 'segment') return false
  const anchor = label.anchor
  const segment = doc.segments.find((item) => item.id === anchor.segmentId)
  if (!segment) return false
  const hit = projectOnto(segment.points, point)
  if (!hit) return false
  const shift = { x: point.x - hit.point.x, y: point.y - hit.point.y }
  const next: typeof anchor = {
    kind: 'segment',
    segmentId: anchor.segmentId,
    edge: hit.edge,
    distance: hit.along,
    offset: 0,
  }
  if (Math.abs(shift.x) > 1e-9 || Math.abs(shift.y) > 1e-9) next.shift = shift
  label.anchor = next
  return true
}

/**
 * Restore default name-label placement on the current attachment (P5a).
 * Clears free `shift` and sets legacy normal `offset` to DEFAULT_NAME_LABEL_OFFSET.
 */
export function resetLabelPosition(doc: DiagramDocument, labelId: string): boolean {
  const label = doc.labels.find((item) => item.id === labelId)
  if (!label || label.anchor.kind !== 'segment') return false
  const before = label.anchor
  const hadShift = Boolean(before.shift)
  const offsetChanged = before.offset !== DEFAULT_NAME_LABEL_OFFSET
  if (!hadShift && !offsetChanged) return false
  const next = { ...before, offset: DEFAULT_NAME_LABEL_OFFSET }
  delete next.shift
  label.anchor = next
  return true
}

export function placeSpan(doc: DiagramDocument, segmentId: string, edge: number, coord: number): void {
  const segment = doc.segments.find((item) => item.id === segmentId)
  if (!segment || edge < 0 || edge >= segment.points.length - 1) return
  const horizontal = Math.abs(segment.points[edge].y - segment.points[edge + 1].y) <= Math.abs(segment.points[edge].x - segment.points[edge + 1].x)
  const current = horizontal ? segment.points[edge].y : segment.points[edge].x
  moveSpan(doc, segmentId, edge, coord - current)
}

/**
 * Move a free endpoint in diagram space (S5b).
 * Keeps every point except the free tip; rebuilds only the terminal orthogonal leg
 * from the adjacent hinge. Does not move ports/junctions or change net identity.
 */
export function placeFreeEnd(doc: DiagramDocument, segmentId: string, which: 'start' | 'end', at: Point): boolean {
  const segment = doc.segments.find((item) => item.id === segmentId)
  if (!segment || segment.points.length < 2) return false
  if (which === 'start' && segment.start.kind !== 'free') return false
  if (which === 'end' && segment.end.kind !== 'free') return false

  const previous = segment.points.map(copyPoint)
  const target = { x: at.x, y: at.y }
  segment.routed = 'manual'

  if (which === 'end') {
    const kept = previous.slice(0, -1).map(copyPoint)
    const hinge = kept[kept.length - 1]!
    const oldTip = previous[previous.length - 1]!
    if (samePoint(hinge, target, 0.5)) return false
    const prefer: 'h' | 'v' = Math.abs(oldTip.x - hinge.x) >= Math.abs(oldTip.y - hinge.y) ? 'h' : 'v'
    const extension = orthogonalTo(hinge, target, prefer).slice(1)
    segment.points = simplifyOrthogonal([...kept, ...extension])
    const tip = segment.points[segment.points.length - 1]
    if (tip) {
      tip.x = target.x
      tip.y = target.y
    }
    segment.end = { kind: 'free', x: target.x, y: target.y }
  } else {
    const kept = previous.slice(1).map(copyPoint)
    const hinge = kept[0]!
    const oldTip = previous[0]!
    if (samePoint(hinge, target, 0.5)) return false
    const prefer: 'h' | 'v' = Math.abs(oldTip.x - hinge.x) >= Math.abs(oldTip.y - hinge.y) ? 'h' : 'v'
    const head = orthogonalTo(target, hinge, prefer)
    segment.points = simplifyOrthogonal([...head.slice(0, -1), ...kept])
    const tip = segment.points[0]
    if (tip) {
      tip.x = target.x
      tip.y = target.y
    }
    segment.start = { kind: 'free', x: target.x, y: target.y }
  }

  refreshSegment(doc, segment)
  if (segment.points.length !== previous.length) reanchor(doc, segment.id, previous, segment.points)
  return true
}

export function moveSpan(doc: DiagramDocument, segmentId: string, edge: number, delta: number): void {
  const segment = doc.segments.find((item) => item.id === segmentId)
  if (!segment || edge < 0 || edge >= segment.points.length - 1 || Math.abs(delta) < 1e-6) return
  const previous = segment.points.map((point) => ({ ...point }))
  segment.routed = 'manual'
  const pts = segment.points
  const horizontal = Math.abs(pts[edge].y - pts[edge + 1].y) <= Math.abs(pts[edge].x - pts[edge + 1].x)
  const dx = horizontal ? 0 : delta
  const dy = horizontal ? delta : 0
  const head = pts.slice(0, edge).map(copyPoint)
  const tail = pts.slice(edge + 2).map(copyPoint)
  const left =
    edge === 0 && bound(segment.start)
      ? [copyPoint(pts[0]), { x: pts[0].x + dx, y: pts[0].y + dy }]
      : [shifted(pts[edge], dx, dy)]
  const right =
    edge + 1 === pts.length - 1 && bound(segment.end)
      ? [{ x: pts[edge + 1].x + dx, y: pts[edge + 1].y + dy }, copyPoint(pts[edge + 1])]
      : [shifted(pts[edge + 1], dx, dy)]
  if (edge === 0 && segment.start.kind === 'free') segment.start = { kind: 'free', x: left[0].x, y: left[0].y }
  if (edge + 1 === pts.length - 1 && segment.end.kind === 'free') {
    const far = right[right.length - 1]
    segment.end = { kind: 'free', x: far.x, y: far.y }
  }
  segment.points = simplifyOrthogonal([...head, ...left, ...right, ...tail])
  refreshSegment(doc, segment)
  if (segment.points.length !== previous.length) reanchor(doc, segment.id, previous, segment.points)
}

export function addCorner(doc: DiagramDocument, segmentId: string, edge: number, at: Point): void {
  const segment = doc.segments.find((item) => item.id === segmentId)
  if (!segment || edge < 0 || edge >= segment.points.length - 1) return
  const previous = segment.points.map((point) => ({ ...point }))
  segment.routed = 'manual'
  const from = segment.points[edge]
  const to = segment.points[edge + 1]
  const going = orthogonalTo(from, at, Math.abs(at.x - from.x) >= Math.abs(at.y - from.y) ? 'h' : 'v')
  const back = orthogonalTo(at, to, Math.abs(to.x - at.x) >= Math.abs(to.y - at.y) ? 'h' : 'v')
  const middle = [...going, ...back.slice(1)]
  segment.points = simplifyOrthogonal([...segment.points.slice(0, edge), ...middle, ...segment.points.slice(edge + 2)])
  refreshSegment(doc, segment)
  reanchor(doc, segment.id, previous, segment.points)
}

export function removeBend(doc: DiagramDocument, segmentId: string, index: number): void {
  const segment = doc.segments.find((item) => item.id === segmentId)
  if (!segment || index <= 0 || index >= segment.points.length - 1) return
  const previous = segment.points.map((point) => ({ ...point }))
  segment.routed = 'manual'
  const pts = segment.points.filter((_, pointIndex) => pointIndex !== index).map(copyPoint)
  const before = pts[index - 1]
  const after = pts[index]
  if (before && after && Math.abs(before.x - after.x) > 0.5 && Math.abs(before.y - after.y) > 0.5) {
    pts.splice(index, 0, { x: after.x, y: before.y })
  }
  segment.points = simplifyOrthogonal(pts)
  refreshSegment(doc, segment)
  reanchor(doc, segment.id, previous, segment.points)
}

/** Whether a free stub end may bind to `hit` (S5b.2 / port reconnect). */
export function probeConnectFreeEnd(
  doc: DiagramDocument,
  segmentId: string,
  which: 'start' | 'end',
  hit: SnapHit,
): WireResult {
  if (hit.kind !== 'port') return { ok: false, reason: 'Target is not a port.', netIds: [] }
  const segment = doc.segments.find((item) => item.id === segmentId)
  if (!segment) return { ok: false, reason: 'Segment not found.', netIds: [] }
  const free = which === 'start' ? segment.start : segment.end
  if (free.kind !== 'free') return { ok: false, reason: 'This end is not free.', netIds: [] }
  const fixed = which === 'start' ? segment.end : segment.start
  if (fixed.kind === 'port' && fixed.portId === hit.portId) {
    return { ok: false, reason: 'That port is already on this wire.', netIds: [] }
  }
  const otherHit = endpointToHit(doc, fixed)
  const probe = probeWire(doc, which === 'start' ? hit : otherHit, which === 'end' ? hit : otherHit)
  if (!probe.ok) return probe
  if (probe.netId && probe.netId !== segment.netId && netsTouching(doc, hit).length > 0) {
    return { ok: false, reason: 'Two nets meet. Merge them explicitly.', netIds: [segment.netId, probe.netId] }
  }
  return { ok: true, netId: segment.netId, segmentId, createdNet: false }
}

/** Move a free end or snap-connect it to a port without creating a new segment (S5b.2). */
export function connectFreeEnd(
  doc: DiagramDocument,
  segmentId: string,
  which: 'start' | 'end',
  world: Point,
  snapFree: (point: Point) => Point,
): WireResult {
  const hit = snapTarget(doc, world)
  if (hit.kind !== 'port') {
    const at = hit.kind === 'free' || hit.kind === 'ambiguous' ? snapFree(world) : { ...hit.point }
    if (!placeFreeEnd(doc, segmentId, which, at)) {
      return { ok: false, reason: 'Could not move the free end.', netIds: [] }
    }
    const segment = doc.segments.find((item) => item.id === segmentId)
    return segment
      ? { ok: true, netId: segment.netId, segmentId, createdNet: false }
      : { ok: false, reason: 'Segment not found.', netIds: [] }
  }
  const allowed = probeConnectFreeEnd(doc, segmentId, which, hit)
  if (!allowed.ok) return allowed
  if (!placeFreeEnd(doc, segmentId, which, hit.point)) {
    return { ok: false, reason: 'Could not reach the port.', netIds: [] }
  }
  return reconnectEnd(doc, segmentId, which, hit)
}

export function reconnectEnd(doc: DiagramDocument, segmentId: string, which: 'start' | 'end', hit: SnapHit): WireResult {
  const segment = doc.segments.find((item) => item.id === segmentId)
  if (!segment) return { ok: false, reason: 'Segment not found.', netIds: [] }
  const other = which === 'start' ? segment.end : segment.start
  const otherHit = endpointToHit(doc, other)
  const probe = probeWire(doc, which === 'start' ? hit : otherHit, which === 'end' ? hit : otherHit)
  if (!probe.ok) return probe
  if (probe.netId && probe.netId !== segment.netId && netsTouching(doc, hit).length > 0) {
    return { ok: false, reason: 'Two nets meet. Merge them explicitly.', netIds: [segment.netId, probe.netId] }
  }
  const resolved = resolveHit(doc, hit)
  if ('error' in resolved) return { ok: false, reason: resolved.error, netIds: [] }
  if (which === 'start') segment.start = resolved.endpoint
  else segment.end = resolved.endpoint
  segment.routed = 'manual'
  refreshSegment(doc, segment)
  return { ok: true, netId: segment.netId, segmentId, createdNet: false }
}

export function setRouted(doc: DiagramDocument, segmentId: string, routed: 'manual' | 'auto'): void {
  const segment = doc.segments.find((item) => item.id === segmentId)
  if (!segment) return
  segment.routed = routed
  if (routed === 'auto') refreshSegment(doc, segment)
}

export function moveJunction(doc: DiagramDocument, junctionId: string, x: number, y: number): void {
  const junction = doc.junctions.find((item) => item.id === junctionId)
  if (!junction) return
  junction.x = x
  junction.y = y
  refreshAll(doc)
}

export function crossings(doc: DiagramDocument): Array<{ a: string; b: string; x: number; y: number }> {
  const found: Array<{ a: string; b: string; x: number; y: number }> = []
  for (let left = 0; left < doc.segments.length; left += 1) {
    for (let right = left + 1; right < doc.segments.length; right += 1) {
      const a = doc.segments[left]
      const b = doc.segments[right]
      for (let i = 0; i < a.points.length - 1; i += 1) {
        for (let j = 0; j < b.points.length - 1; j += 1) {
          const hit = properCross(a.points[i], a.points[i + 1], b.points[j], b.points[j + 1])
          if (!hit) continue
          const joined = doc.junctions.some((junction) => samePoint(junction, hit, 1) && (a.netId === junction.netId || b.netId === junction.netId))
          if (!joined && a.netId !== b.netId) found.push({ a: a.id, b: b.id, x: hit.x, y: hit.y })
        }
      }
    }
  }
  return found
}

function extendSegment(doc: DiagramDocument, points: Point[], start: Extract<SnapHit, { kind: 'end' }>, end: SnapHit): WireResult {
  const segment = doc.segments.find((item) => item.id === start.segmentId)
  if (!segment) return { ok: false, reason: 'Segment not found.', netIds: [] }
  const resolved = resolveHit(doc, end)
  if ('error' in resolved) return { ok: false, reason: resolved.error, netIds: [] }
  const previous = segment.points.map(copyPoint)
  const extra = simplifyOrthogonal(points)
  if (start.which === 'end') {
    segment.points = simplifyOrthogonal([...segment.points, ...extra.slice(1)])
    segment.end = resolved.endpoint
  } else {
    segment.points = simplifyOrthogonal([...[...extra].reverse().slice(0, -1), ...segment.points])
    segment.start = resolved.endpoint
  }
  segment.routed = 'manual'
  refreshSegment(doc, segment)
  reanchor(doc, segment.id, previous, segment.points)
  return { ok: true, netId: segment.netId, segmentId: segment.id, createdNet: false }
}

function resolveHit(doc: DiagramDocument, hit: SnapHit): { endpoint: Endpoint; point: Point } | { error: string } {
  if (hit.kind === 'port') return { endpoint: { kind: 'port', portId: hit.portId }, point: { ...hit.point } }
  if (hit.kind === 'junction') return { endpoint: { kind: 'junction', junctionId: hit.junctionId }, point: { ...hit.point } }
  if (hit.kind === 'free') return { endpoint: { kind: 'free', x: hit.point.x, y: hit.point.y }, point: { ...hit.point } }
  if (hit.kind === 'end') {
    const segment = doc.segments.find((item) => item.id === hit.segmentId)
    if (!segment) return { error: 'Segment not found.' }
    const junction = makeJunction(doc, segment.netId, hit.point)
    if (hit.which === 'start') segment.start = { kind: 'junction', junctionId: junction.id }
    else segment.end = { kind: 'junction', junctionId: junction.id }
    return { endpoint: { kind: 'junction', junctionId: junction.id }, point: { x: junction.x, y: junction.y } }
  }
  if (hit.kind === 'segment') {
    const junctionId = splitSegmentAt(doc, hit.segmentId, hit.edge, hit.distance)
    if (!junctionId) return { error: 'That point is too close to a corner.' }
    const junction = doc.junctions.find((item) => item.id === junctionId)
    return junction
      ? { endpoint: { kind: 'junction', junctionId }, point: { x: junction.x, y: junction.y } }
      : { error: 'Junction not found.' }
  }
  return { error: 'Choose one target.' }
}

function splitSegmentAt(doc: DiagramDocument, segmentId: string, edge: number, distance: number): string | null {
  const segment = doc.segments.find((item) => item.id === segmentId)
  if (!segment || edge < 0 || edge >= segment.points.length - 1) return null
  const original = segment.points.map(copyPoint)
  const from = original[edge]
  const to = original[edge + 1]
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  if (length < 8) return null
  const travel = Math.min(length, Math.max(0, distance))
  if (travel < 4 || length - travel < 4) return null
  const at = { x: from.x + ((to.x - from.x) * travel) / length, y: from.y + ((to.y - from.y) * travel) / length }
  const remembered = doc.labels
    .filter((label) => label.anchor.kind === 'segment' && label.anchor.segmentId === segment.id)
    .map((label) => ({
      label,
      at: label.anchor.kind === 'segment' ? pointOnEdge(original, label.anchor.edge, label.anchor.distance, 0) : null,
    }))
  const junction = makeJunction(doc, segment.netId, at)
  const newId = createId('seg')
  const head = simplifyOrthogonal([...original.slice(0, edge + 1), at])
  const tail = simplifyOrthogonal([at, ...original.slice(edge + 1)])
  const oldEnd = segment.end
  segment.points = head
  segment.end = { kind: 'junction', junctionId: junction.id }
  segment.routed = 'manual'
  const inheritedArrowheads = segment.arrowheads
  doc.segments.push({
    id: newId,
    netId: segment.netId,
    points: tail,
    start: { kind: 'junction', junctionId: junction.id },
    end: oldEnd,
    routed: 'manual',
    ...(inheritedArrowheads ? { arrowheads: inheritedArrowheads } : {}),
  })
  if (inheritedArrowheads) segment.arrowheads = inheritedArrowheads
  for (const item of remembered) {
    if (!item.at || item.label.anchor.kind !== 'segment') continue
    const onHead = nearestOnPolyline(head, item.at)
    const onTail = nearestOnPolyline(tail, item.at)
    const headGap = onHead ? Math.hypot(onHead.point.x - item.at.x, onHead.point.y - item.at.y) : Number.POSITIVE_INFINITY
    const tailGap = onTail ? Math.hypot(onTail.point.x - item.at.x, onTail.point.y - item.at.y) : Number.POSITIVE_INFINITY
    if (onTail && tailGap < headGap) item.label.anchor = { ...item.label.anchor, segmentId: newId, edge: onTail.edge, distance: onTail.distance }
    else if (onHead) item.label.anchor = { ...item.label.anchor, edge: onHead.edge, distance: onHead.distance }
  }
  return junction.id
}

function makeJunction(doc: DiagramDocument, netId: string, point: Point): Junction {
  const junction: Junction = { id: createId('jnc'), netId, x: point.x, y: point.y }
  doc.junctions.push(junction)
  return junction
}

function createNet(doc: DiagramDocument, preferredName?: string): string {
  if (preferredName?.trim()) return ensureNetByName(doc, preferredName)
  return createIndependentNet(doc, 'net')
}

/** Preferred display name when neither hit already belongs to a net (not join-by-name). */
function inheritNetName(doc: DiagramDocument, start: SnapHit, end: SnapHit): string | null {
  if (start.kind === 'port') {
    const port = doc.ports.find((item) => item.id === start.portId)
    if (port?.name.trim()) return port.name.trim()
  }
  if (end.kind === 'port') {
    const port = doc.ports.find((item) => item.id === end.portId)
    if (port?.name.trim()) return port.name.trim()
  }
  return null
}

function netsTouching(doc: DiagramDocument, hit: SnapHit): string[] {
  if (hit.kind === 'port') {
    return [...new Set(doc.segments.filter((segment) => citesPort(segment, hit.portId)).map((segment) => segment.netId))]
  }
  if (hit.kind === 'junction') return [doc.junctions.find((item) => item.id === hit.junctionId)?.netId ?? ''].filter(Boolean)
  if (hit.kind === 'segment' || hit.kind === 'end') {
    return [doc.segments.find((item) => item.id === hit.segmentId)?.netId ?? ''].filter(Boolean)
  }
  return []
}

function citesPort(segment: Segment, portId: string): boolean {
  return (segment.start.kind === 'port' && segment.start.portId === portId) || (segment.end.kind === 'port' && segment.end.portId === portId)
}

function componentsOf(segments: Segment[]): string[][] {
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    const next = parent.get(id) ?? id
    if (next === id) return id
    const root = find(next)
    parent.set(id, root)
    return root
  }
  const join = (a: string, b: string) => {
    const left = find(a)
    const right = find(b)
    if (left !== right) parent.set(right, left)
  }
  for (const segment of segments) parent.set(segment.id, segment.id)
  for (let left = 0; left < segments.length; left += 1) {
    for (let right = left + 1; right < segments.length; right += 1) {
      if (sharesNode(segments[left], segments[right])) join(segments[left].id, segments[right].id)
    }
  }
  const groups = new Map<string, string[]>()
  for (const segment of segments) {
    const root = find(segment.id)
    groups.set(root, [...(groups.get(root) ?? []), segment.id])
  }
  return [...groups.values()]
}

function sharesNode(a: Segment, b: Segment): boolean {
  const nodes = new Set([nodeKey(a.start), nodeKey(a.end)].filter(Boolean) as string[])
  return [nodeKey(b.start), nodeKey(b.end)].some((key) => key !== null && nodes.has(key))
}

function nodeKey(end: Endpoint): string | null {
  if (end.kind === 'port') return `port:${end.portId}`
  if (end.kind === 'junction') return `junction:${end.junctionId}`
  return null
}

function bound(end: Endpoint): boolean {
  return end.kind === 'port' || end.kind === 'junction'
}

function copyPoint(point: Waypoint): Waypoint {
  return { x: point.x, y: point.y, ...(point.fixed ? { fixed: true } : {}) }
}

function shifted(point: Waypoint, dx: number, dy: number): Waypoint {
  return { x: point.x + dx, y: point.y + dy, ...(point.fixed ? { fixed: true } : {}) }
}

function endpointToHit(doc: DiagramDocument, end: Endpoint): SnapHit {
  const point = endpointPoint(doc, end) ?? { x: 0, y: 0 }
  if (end.kind === 'port') return { kind: 'port', portId: end.portId, point }
  if (end.kind === 'junction') return { kind: 'junction', junctionId: end.junctionId, point }
  return { kind: 'free', point }
}

function reanchor(doc: DiagramDocument, segmentId: string, previous: Point[], next: Point[]): void {
  for (const label of doc.labels) {
    if (label.anchor.kind !== 'segment' || label.anchor.segmentId !== segmentId) continue
    const at = pointOnEdge(previous, label.anchor.edge, label.anchor.distance, 0)
    if (!at) continue
    const place = nearestOnPolyline(next, at)
    if (!place) continue
    label.anchor = { ...label.anchor, edge: place.edge, distance: place.distance }
  }
}

function projectOnto(points: Point[], point: Point): { point: Point; edge: number; along: number; distance: number } | null {
  let best: { point: Point; edge: number; along: number; distance: number } | null = null
  for (let edge = 0; edge < points.length - 1; edge += 1) {
    const from = points[edge]
    const to = points[edge + 1]
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    if (length < 1e-6) continue
    const t = Math.min(1, Math.max(0, ((point.x - from.x) * (to.x - from.x) + (point.y - from.y) * (to.y - from.y)) / (length * length)))
    const at = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
    const distance = Math.hypot(at.x - point.x, at.y - point.y)
    if (!best || distance < best.distance) best = { point: at, edge, along: t * length, distance }
  }
  return best
}

function nearestOnPolyline(points: Point[], point: Point): { point: Point; edge: number; distance: number } | null {
  const hit = projectOnto(points, point)
  return hit ? { point: hit.point, edge: hit.edge, distance: hit.along } : null
}

function properCross(a: Point, b: Point, c: Point, d: Point): Point | null {
  const denom = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x)
  if (Math.abs(denom) < 1e-6) return null
  const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denom
  const u = ((a.x - c.x) * (a.y - b.y) - (a.y - c.y) * (a.x - b.x)) / denom
  if (t <= 0.02 || t >= 0.98 || u <= 0.02 || u >= 0.98) return null
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}
