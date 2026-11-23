<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { ConnectionMode, Handle, Position, VueFlow, useVueFlow, type Connection } from '@vue-flow/core'
import { computed, ref } from 'vue'
import type { DesignUnit } from '../../models/design'
import type { EditableDiagram, EditableInstance, EditableNet, EditablePort, EditableWire } from '../../models/editable'
import { newDiagramId } from '../../models/editable'
import { getEditableDiagram } from '../../services/api'
import { useStudioStore } from '../../stores/studio'
import { mapX, mapY, sourceDelta, translateOwner } from './geometry'
import { addEndpoint, addWire, ensureNet, mergeNets, netContaining, type PortEnd } from './nets'
import OrthogonalEdge from './OrthogonalEdge.vue'
import { layoutPortLabels, portAnchor, portCaption, signalStroke } from './portLabels'
import { connectionChecks, type Check } from './validate'

const studio = useStudioStore()
const { viewport } = useVueFlow()
const entityId = ref('')
const childId = ref('')
const dragStart = ref<{ id: string; x: number; y: number } | null>(null)
const editingSignalId = ref<string | null>(null)
const pending = ref<{ from: PortEnd; to: PortEnd; leftId: string; rightId: string; leftName: string; rightName: string } | null>(null)

const diagram = computed(() => studio.editable)
const checks = computed(() => (diagram.value ? shownChecks(diagram.value) : []))
const otherDesigns = computed(() => studio.designs.filter((item) => item.id !== diagram.value?.id))
const selectedInstance = computed(() => {
  if (studio.selection?.kind !== 'instance') return null
  return diagram.value?.instances.find((item) => item.id === studio.selection?.id) ?? null
})
const entities = computed(() => {
  const libraryId = diagram.value?.provenance.library_id
  return (studio.project?.design_units ?? []).filter(
    (unit) => unit.kind === 'entity' && unit.library_id === libraryId,
  )
})

const graph = computed(() => {
  const doc = diagram.value
  const labelStyle = studio.portLabelStyle
  if (!doc) return { nodes: [], edges: [] }
  const frame = doc.frame
  const nodes = [
    ...looseRoutes(doc),
    ...doc.instances.map((instance) => nodeForInstance(instance, frame, labelStyle)),
    ...doc.diagram_ports.map((port) => ({
      id: port.id,
      type: 'port',
      position: { x: mapX(frame.origin_x, frame.scale, port.x), y: mapY(frame.origin_y, frame.scale, port.y) },
        data: {
          title: portCaption(port, labelStyle),
          caption: '',
          tip: portCaption(port, 'long'),
          handleId: port.id,
          side: port.direction === 'out' ? Position.Left : Position.Right,
        },
      style: { width: `${Math.max(port.box_width * frame.scale, 8)}px`, height: `${Math.max(port.box_height * frame.scale, 8)}px` },
    })),
    ...doc.embedded_blocks.map((block) => ({
      id: block.id,
      type: 'embedded',
      position: { x: mapX(frame.origin_x, frame.scale, block.x), y: mapY(frame.origin_y, frame.scale, block.y) },
      data: { block },
      style: { width: `${Math.max(block.width * frame.scale, 24)}px`, height: `${Math.max(block.height * frame.scale, 24)}px` },
    })),
    ...doc.junctions.map((junction) => ({
      id: junction.id,
      type: 'junction',
      position: {
        x: mapX(frame.origin_x, frame.scale, junction.x) - 6,
        y: mapY(frame.origin_y, frame.scale, junction.y) - 6,
      },
      data: {},
      style: { width: '12px', height: '12px' },
    })),
    ...doc.labels.map((label) => ({
      id: label.id,
      type: 'label',
      position: { x: mapX(frame.origin_x, frame.scale, label.x), y: mapY(frame.origin_y, frame.scale, label.y) },
      data: { label },
      style: { width: '120px', height: '28px' },
    })),
    ...signalNodes(doc, frame, labelStyle),
  ]
  const edges = doc.wires.flatMap((wire) => {
    if (!wire.start || !wire.end) return []
    return [
      {
        id: wire.id,
        type: 'ortho',
        source: wire.start.owner_id,
        target: wire.end.owner_id,
        sourceHandle: wire.start.port_id ?? 'body',
        targetHandle: wire.end.port_id ?? 'body',
        data: {
          points: wire.points.map((point) => ({
            x: mapX(frame.origin_x, frame.scale, point.x),
            y: mapY(frame.origin_y, frame.scale, point.y),
          })),
          width: signalStroke(doc.nets.find((net) => net.id === wire.net_id)?.range_text),
          onBend: (index: number, event: PointerEvent) => bend(wire.id, index, event),
        },
      },
    ]
  })
  return { nodes, edges }
})

function nodeForInstance(
  instance: EditableInstance,
  frame: { origin_x: number; origin_y: number; scale: number },
  labelStyle: 'short' | 'long',
) {
  const width = Math.max(instance.width * frame.scale, 36)
  const height = Math.max(instance.height * frame.scale, 24)
  return {
    id: instance.id,
    type: 'instance',
    zIndex: 3,
    position: { x: mapX(frame.origin_x, frame.scale, instance.x), y: mapY(frame.origin_y, frame.scale, instance.y) },
    data: {
      instance,
      labels: layoutPortLabels(instance, width, height, labelStyle),
      handles: instance.ports.map((port) => {
        const anchor = portAnchor(instance, port, height, width)
        return {
          id: port.id,
          name: port.name,
          type: port.direction === 'in' ? 'target' : 'source',
          position: anchor.side === 'right' ? Position.Right : Position.Left,
          style: { left: anchor.left, top: anchor.top },
        }
      }),
    },
    style: { width: `${width}px`, height: `${height}px` },
  }
}

function signalNodes(
  doc: NonNullable<typeof diagram.value>,
  frame: { origin_x: number; origin_y: number; scale: number },
  labelStyle: 'short' | 'long',
) {
  return doc.wires.flatMap((wire) => {
    if (wire.label_hidden || wire.label_x == null || wire.label_y == null || !wire.label_width || !wire.label_height) return []
    const net = doc.nets.find((item) => item.id === wire.net_id)
    if (!net) return []
    const width = Math.max(wire.label_width * frame.scale, 1)
    const height = Math.max(wire.label_height * frame.scale, 1)
    return [
      {
        id: `signal:${wire.id}`,
        type: 'signal',
        position: {
          x: mapX(frame.origin_x, frame.scale, wire.label_x),
          y: mapY(frame.origin_y, frame.scale, wire.label_y) - height,
        },
        draggable: true,
        connectable: false,
        zIndex: 2,
        data: {
          wireId: wire.id,
          net,
          text: portCaption(net, labelStyle),
          title: portCaption(net, 'long'),
          fontSize: Math.max(1, Math.min(11, height * 0.8)),
        },
        style: { width: `${width}px`, height: `${height}px` },
      },
    ]
  })
}

function looseRoutes(doc: NonNullable<typeof diagram.value>) {
  const loose = doc.wires.filter((wire) => !wire.start || !wire.end)
  if (!loose.length) return []
  const frame = doc.frame
  const width = 1100
  const height = 1100
  return [
    {
      id: 'loose-routes',
      type: 'routes',
      position: { x: 0, y: 0 },
      draggable: false,
      connectable: false,
      selectable: false,
      zIndex: 0,
      data: {
        routes: loose.map((wire) => ({
          points: wire.points
            .map((point) => `${mapX(frame.origin_x, frame.scale, point.x)},${mapY(frame.origin_y, frame.scale, point.y)}`)
            .join(' '),
          width: signalStroke(doc.nets.find((net) => net.id === wire.net_id)?.range_text),
        })),
        width,
        height,
      },
      style: { width: `${width}px`, height: `${height}px` },
    },
  ]
}

function onDragStart(event: { node: { id: string; position: { x: number; y: number } } }): void {
  dragStart.value = { id: event.node.id, x: event.node.position.x, y: event.node.position.y }
}

function onDragStop(event: { node: { id: string; type?: string; position: { x: number; y: number } } }): void {
  const doc = studio.editable
  const start = dragStart.value
  if (!doc || !start || start.id !== event.node.id) return
  const delta = sourceDelta(doc.frame.scale, event.node.position.x - start.x, event.node.position.y - start.y)
  dragStart.value = null
  if (delta.dx === 0 && delta.dy === 0) return
  if (event.node.type === 'signal') {
    const wire = doc.wires.find((item) => `signal:${item.id}` === event.node.id)
    if (!wire || wire.label_x == null || wire.label_y == null) return
    studio.commit()
    wire.label_x += delta.dx
    wire.label_y += delta.dy
    return
  }
  studio.commit()
  translateOwner(doc, event.node.id, delta.dx, delta.dy)
}

function bend(wireId: string, index: number, event: PointerEvent): void {
  const doc = studio.editable
  if (!doc) return
  const wire = doc.wires.find((item) => item.id === wireId)
  const point = wire?.points[index]
  if (!wire || !point) return
  const origin = { x: point.x, y: point.y, cx: event.clientX, cy: event.clientY }
  studio.commit()
  const move = (ev: PointerEvent) => {
    const zoom = viewport.value.zoom || 1
    const delta = sourceDelta(doc.frame.scale, (ev.clientX - origin.cx) / zoom, (ev.clientY - origin.cy) / zoom)
    point.x = origin.x + delta.dx
    point.y = origin.y + delta.dy
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function shownChecks(doc: EditableDiagram): Check[] {
  const live = connectionChecks(doc)
  const seen = new Set(live.map((item) => `${item.code}\n${item.message}`))
  const extra: Check[] = []
  for (const item of doc.checks ?? []) {
    const severity = item.severity === 'error' || item.severity === 'warning' || item.severity === 'info' ? item.severity : 'info'
    if (seen.has(`${item.code}\n${item.message}`)) continue
    extra.push({ severity, code: item.code, message: item.message })
  }
  return [...live, ...extra]
}

function onConnect(connection: Connection): void {
  const doc = studio.editable
  if (!doc || !connection.source || !connection.target || connection.source === connection.target) return
  const from = locate(doc, connection.source, connection.sourceHandle ?? null)
  const to = locate(doc, connection.target, connection.targetHandle ?? null)
  if (!from || !to) return
  const netFrom = netContaining(doc, from)
  const netTo = netContaining(doc, to)
  if (netFrom && netTo && netFrom.id !== netTo.id) {
    pending.value = {
      from,
      to,
      leftId: netFrom.id,
      rightId: netTo.id,
      leftName: netFrom.name,
      rightName: netTo.name,
    }
    studio.error = ''
    return
  }
  studio.commit()
  studio.error = ''
  join(doc, from, to, netFrom ?? netTo)
}

function cancelMerge(): void {
  pending.value = null
}

function confirmMerge(keep: 'left' | 'right'): void {
  const request = pending.value
  const doc = studio.editable
  if (!request || !doc) return
  const keepId = keep === 'left' ? request.leftId : request.rightId
  const dropId = keep === 'left' ? request.rightId : request.leftId
  studio.commit()
  mergeNets(doc, keepId, dropId)
  const net = doc.nets.find((item) => item.id === keepId)
  if (net) join(doc, request.from, request.to, net)
  pending.value = null
  studio.error = ''
}

function join(doc: EditableDiagram, from: PortEnd, to: PortEnd, existing: ReturnType<typeof netContaining>): void {
  const net = ensureNet(doc, existing)
  addEndpoint(net, from)
  addEndpoint(net, to)
  addWire(doc, net, from, to)
}

function locate(doc: NonNullable<typeof diagram.value>, nodeId: string, handle: string | null) {
  const instance = doc.instances.find((item) => item.id === nodeId)
  if (instance) {
    const port = instance.ports.find((item) => item.id === handle) ?? instance.ports[0]
    if (!port) return null
    return { kind: 'instance' as const, owner: instance.id, portId: port.id, center: centerOf(instance, port) }
  }
  const port = doc.diagram_ports.find((item) => item.id === nodeId)
  if (port) {
    return {
      kind: 'diagram_port' as const,
      owner: port.id,
      portId: port.id,
      center: { x: port.x + Math.round(port.box_width / 2), y: port.y - Math.round(port.box_height / 2) },
    }
  }
  return null
}

function centerOf(instance: EditableInstance, port: EditablePort): { x: number; y: number } {
  if (port.x1 !== null && port.x2 !== null && port.y1 !== null && port.y2 !== null) {
    return { x: Math.round((port.x1 + port.x2) / 2), y: Math.round((port.y1 + port.y2) / 2) }
  }
  const outgoing = port.direction === 'out' || port.direction === 'buffer'
  const group = instance.ports.filter((item) => (item.direction === 'out' || item.direction === 'buffer') === outgoing)
  const index = Math.max(group.indexOf(port), 0)
  return {
    x: outgoing ? instance.x + instance.width : instance.x,
    y: instance.y - Math.round(((index + 1) / (group.length + 1)) * instance.height),
  }
}

function addInstance(): void {
  const doc = studio.editable
  const unit = entities.value.find((item) => item.id === entityId.value)
  if (!doc || !unit) return
  studio.commit()
  doc.instances.push(instanceFrom(unit, doc))
}

function instanceFrom(unit: DesignUnit, doc: NonNullable<typeof diagram.value>): EditableInstance {
  const height = Math.max(3000, unit.ports.length * 900)
  const right = doc.instances.reduce((max, item) => Math.max(max, item.x + item.width), doc.frame.origin_x)
  return {
    id: newDiagramId('inst'),
    name: uniqueInstanceName(doc),
    component_name: unit.name,
    component_library: libraryName(doc),
    design_unit_id: unit.id,
    child_diagram_id: null,
    x: right + 2000,
    y: doc.frame.origin_y,
    width: 9000,
    height,
    hds_uid: null,
    hds_object: null,
    generics: unit.generics.map((generic) => ({
      name: generic.name,
      type_text: generic.type_text,
      value: generic.default_text,
    })),
    ports: unit.ports.map((port) => ({
      id: newDiagramId('dport'),
      name: port.name,
      direction: port.direction,
      type_text: port.type_text,
      range_text: port.range_text,
      width: port.width,
      width_status: port.width_status,
      hds_object: null,
      x1: null,
      y1: null,
      x2: null,
      y2: null,
    })),
  }
}

async function addDesign(): Promise<void> {
  const doc = studio.editable
  const id = childId.value
  if (!doc || !id) return
  if (!(await studio.canInstantiate(id))) return
  const child = await getEditableDiagram(id)
  studio.commit()
  const height = Math.max(3000, child.diagram_ports.length * 900)
  const right = doc.instances.reduce((max, item) => Math.max(max, item.x + item.width), doc.frame.origin_x)
  const library = studio.project?.libraries.find((item) => item.id === child.provenance.library_id)
  doc.instances.push({
    id: newDiagramId('inst'),
    name: uniqueInstanceName(doc),
    component_name: child.entity_name ?? child.name,
    component_library: library?.name ?? null,
    design_unit_id: null,
    child_diagram_id: child.id,
    x: right + 2000,
    y: doc.frame.origin_y,
    width: 9000,
    height,
    hds_uid: null,
    hds_object: null,
    generics: (child.generics ?? []).map((generic) => ({
      name: generic.name,
      type_text: generic.type_text,
      value: generic.default_text,
    })),
    ports: child.diagram_ports.map((port) => ({
      id: newDiagramId('dport'),
      name: port.name,
      direction: port.direction,
      type_text: port.type_text,
      range_text: port.range_text,
      width: port.width,
      width_status: port.width_status,
      hds_object: null,
      x1: null,
      y1: null,
      x2: null,
      y2: null,
    })),
  })
}

function uniqueInstanceName(doc: EditableDiagram): string {
  const used = new Set(doc.instances.map((item) => item.name))
  let number = 0
  while (used.has(`U_${number}`)) number += 1
  return `U_${number}`
}

function libraryName(doc: EditableDiagram): string | null {
  return studio.project?.libraries.find((item) => item.id === doc.provenance.library_id)?.name ?? null
}

function addLabel(): void {
  const doc = studio.editable
  if (!doc) return
  studio.commit()
  doc.labels.push({
    id: newDiagramId('lbl'),
    text: 'label',
    x: doc.frame.origin_x + 1500,
    y: doc.frame.origin_y - 1500,
  })
  studio.selection = { kind: 'label', id: doc.labels[doc.labels.length - 1].id }
}

function removeSelection(): void {
  const doc = studio.editable
  const selected = studio.selection
  if (!doc || !selected || selected.kind === 'signal') return
  if (selected.kind === 'wire') {
    disconnect(selected.id)
    return
  }
  const attached = doc.wires.filter((wire) => wire.start?.owner_id === selected.id || wire.end?.owner_id === selected.id)
  if (attached.length && !window.confirm(`Remove this object and its ${attached.length} wires?`)) return
  studio.commit()
  doc.wires = doc.wires.filter((wire) => wire.start?.owner_id !== selected.id && wire.end?.owner_id !== selected.id)
  doc.instances = doc.instances.filter((item) => item.id !== selected.id)
  doc.diagram_ports = doc.diagram_ports.filter((item) => item.id !== selected.id)
  doc.embedded_blocks = doc.embedded_blocks.filter((item) => item.id !== selected.id)
  doc.junctions = doc.junctions.filter((item) => item.id !== selected.id)
  doc.labels = doc.labels.filter((item) => item.id !== selected.id)
  for (const net of doc.nets) {
    net.endpoints = net.endpoints.filter((endpoint) => endpoint.owner_id !== selected.id && wireUses(doc.wires, net.id, endpoint))
  }
  doc.nets = doc.nets.filter((net) => net.endpoints.length > 0 || doc.wires.some((wire) => wire.net_id === net.id))
  studio.selection = null
}

function disconnect(wireId: string): void {
  const doc = studio.editable
  if (!doc) return
  const wire = doc.wires.find((item) => item.id === wireId)
  if (!wire) return
  studio.commit()
  doc.wires = doc.wires.filter((item) => item.id !== wireId)
  const net = doc.nets.find((item) => item.id === wire.net_id)
  if (net) {
    net.endpoints = net.endpoints.filter((endpoint) => wireUses(doc.wires, net.id, endpoint))
    if (!net.endpoints.length && !doc.wires.some((item) => item.net_id === net.id)) {
      doc.nets = doc.nets.filter((item) => item.id !== net.id)
    }
  }
  if (studio.selection?.id === wireId) studio.selection = null
}

function wireUses(wires: EditableWire[], netId: string, endpoint: { kind: string; owner_id: string; port_id: string }): boolean {
  return wires.some(
    (wire) =>
      wire.net_id === netId &&
      [wire.start, wire.end].some(
        (end) => end?.kind === endpoint.kind && end.owner_id === endpoint.owner_id && end.port_id === endpoint.port_id,
      ),
  )
}

function onNodeClick(event: { node: { id: string; type?: string; data?: { wireId?: string } } }): void {
  if (event.node.type === 'signal' && event.node.data?.wireId) {
    studio.selection = { kind: 'signal', id: event.node.data.wireId }
    return
  }
  editingSignalId.value = null
  studio.selection = { kind: event.node.type ?? 'node', id: event.node.id }
}

function renameNet(net: EditableNet, event: Event): void {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const value = input.value.trim()
  if (!value) {
    input.value = net.name
    return
  }
  net.name = value
}

function onEdgeClick(event: { edge: { id: string } }): void {
  studio.selection = { kind: 'wire', id: event.edge.id }
}
</script>

<template>
  <div v-if="diagram" class="diagram-view">
    <div class="toolbar">
      <button type="button" @click="studio.saveEditable()">Save</button>
      <button type="button" :disabled="!studio.canUndo" @click="studio.undo()">Undo</button>
      <button type="button" :disabled="!studio.canRedo" @click="studio.redo()">Redo</button>
      <button v-if="studio.hierarchy.length" type="button" @click="studio.backToParent()">Up</button>
      <button v-if="selectedInstance?.child_diagram_id" type="button" @click="studio.openChildDiagram(selectedInstance.child_diagram_id)">
        Open inside
      </button>
      <span class="path">
        <template v-for="crumb in studio.hierarchy" :key="crumb.id">{{ crumb.name }} / </template>
        {{ diagram.name }}
      </span>
      <label>
        Add
        <select v-model="entityId">
          <option value="">Entity…</option>
          <option v-for="unit in entities" :key="unit.id" :value="unit.id">{{ unit.name }}</option>
        </select>
      </label>
      <button type="button" :disabled="!entityId" @click="addInstance">Add instance</button>
      <label>
        Design
        <select v-model="childId">
          <option value="">Design…</option>
          <option v-for="design in otherDesigns" :key="design.id" :value="design.id">{{ design.name }}</option>
        </select>
      </label>
      <button type="button" :disabled="!childId" @click="addDesign">Add design</button>
      <button type="button" @click="addLabel">Add label</button>
      <button type="button" :disabled="!studio.selection" @click="removeSelection">Delete</button>
      <span class="state">{{ studio.dirty ? 'Unsaved changes' : 'Saved' }}</span>
      <span class="path">{{ diagram.provenance.source_path ?? 'New design' }}</span>
    </div>
    <div v-if="pending" class="decision">
      <p>
        These ports already belong to different nets, {{ pending.leftName }} and {{ pending.rightName }}. Join them into one
        net, or leave them separate.
      </p>
      <button type="button" @click="confirmMerge('left')">Merge into {{ pending.leftName }}</button>
      <button type="button" @click="confirmMerge('right')">Merge into {{ pending.rightName }}</button>
      <button type="button" @click="cancelMerge">Keep separate</button>
    </div>
    <p v-if="studio.error" class="error">{{ studio.error }}</p>
    <ul v-if="checks.length" class="checks">
      <li v-for="item in checks" :key="item.code + item.message" :class="item.severity">{{ item.severity }} {{ item.message }}</li>
    </ul>
    <VueFlow
      class="canvas"
      :nodes="graph.nodes"
      :edges="graph.edges"
      :connection-mode="ConnectionMode.Loose"
      :nodes-connectable="true"
      :edges-updatable="false"
      :fit-view-on-init="true"
      :min-zoom="0.05"
      :max-zoom="4"
      @node-drag-start="onDragStart"
      @node-drag-stop="onDragStop"
      @connect="onConnect"
      @node-click="onNodeClick"
      @edge-click="onEdgeClick"
      @pane-click="studio.selection = null; editingSignalId = null"
    >
      <template #node-instance="{ data }">
        <div class="box instance" :title="[data.instance.name, data.instance.component_name].filter(Boolean).join(' ')">
          <div class="instance-title">
            <strong>{{ data.instance.name }}</strong>
            <span>{{ data.instance.component_name }}</span>
          </div>
          <Handle
            v-for="handle in data.handles"
            :key="handle.id"
            :id="handle.id"
            :type="handle.type"
            :position="handle.position"
            :style="handle.style"
            :title="handle.name"
          />
          <span
            v-for="label in data.labels"
            :key="label.id"
            class="port-name"
            :class="label.side"
            :style="{ top: `${label.top}px`, fontSize: `${label.fontSize}px` }"
            :title="label.title"
          >{{ label.text }}</span>
        </div>
      </template>
      <template #node-port="{ data }">
        <div class="box port" :title="data.tip || data.title">
          <strong>{{ data.title }}</strong>
          <small v-if="data.caption">{{ data.caption }}</small>
          <Handle :id="data.handleId" type="source" :position="data.side" />
        </div>
      </template>
      <template #node-embedded="{ data }">
        <div class="box embedded">
          <strong>{{ data.block.name }} <span v-if="data.block.number">#{{ data.block.number }}</span></strong>
          <em>embedded HDL</em>
          <textarea v-model="data.block.text" spellcheck="false" @pointerdown.stop @focus="studio.beginChange()" @blur="studio.endChange()" />
          <Handle id="body" type="source" :position="Position.Left" />
        </div>
      </template>
      <template #node-junction>
        <div class="junction"><Handle id="body" type="source" :position="Position.Right" /></div>
      </template>
      <template #node-label="{ data }">
        <input v-model="data.label.text" class="label" @pointerdown.stop @focus="studio.beginChange()" @blur="studio.endChange()" />
      </template>
      <template #node-signal="{ data }">
        <div
          class="signal-label"
          :class="{ selected: studio.selection?.kind === 'signal' && studio.selection.id === data.wireId }"
          :style="{ fontSize: `${data.fontSize}px` }"
          :title="data.title"
          @dblclick.stop="editingSignalId = data.wireId"
        >
          <input
            v-if="studio.selection?.kind === 'signal' && studio.selection.id === data.wireId && editingSignalId === data.wireId"
            class="nodrag nopan"
            :value="data.net.name"
            @change="renameNet(data.net, $event)"
            @pointerdown.stop
            @focus="studio.beginChange()"
            @blur="studio.endChange()"
          />
          <span v-else>{{ data.text }}</span>
        </div>
      </template>
      <template #node-routes="{ data }">
        <svg class="routes" :width="data.width" :height="data.height">
          <polyline
            v-for="(route, index) in data.routes"
            :key="index"
            :points="route.points"
            :stroke-width="route.width"
          />
        </svg>
      </template>
      <template #edge-ortho="edgeProps">
        <OrthogonalEdge :data="edgeProps.data" />
      </template>
      <Background />
      <Controls :show-interactive="false" />
    </VueFlow>
  </div>
</template>

<style scoped>
.diagram-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
}

.toolbar select,
.toolbar button,
.label,
textarea {
  font: inherit;
}

.state {
  color: #0b5cab;
  font-size: 12px;
}

.path,
.checks {
  color: #5c6775;
  font-size: 12px;
}

.checks {
  margin: 0;
  padding: 0 12px 6px 28px;
  max-height: 72px;
  overflow: auto;
}

.checks .warning {
  color: #8a4b08;
}

.checks .error {
  color: #9d1c1c;
}

.decision {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 0 12px 8px;
  padding: 8px 10px;
  background: #fff6e8;
  border: 1px solid #e0b15a;
  font-size: 13px;
}

.decision p {
  margin: 0;
  flex: 1 1 240px;
}

.canvas {
  flex: 1;
  min-height: 0;
  background: #f4f6f8;
}

.box {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid #1f7a4d;
  background: rgba(223, 244, 232, 0.94);
  color: #163524;
  font-size: 11px;
  line-height: 1.2;
  padding: 2px 4px;
}

.box.port {
  border-color: #0b5cab;
  background: rgba(229, 240, 250, 0.94);
  color: #16324f;
}

.box.embedded {
  display: flex;
  flex-direction: column;
  border-color: #6b5420;
  background: rgba(255, 244, 214, 0.96);
  color: #3d3112;
}

.box.instance,
.box.port,
.box.embedded {
  position: relative;
}

.box.instance {
  overflow: hidden;
  padding: 0;
}

.box.port,
.box.embedded {
  overflow: visible;
}

.box strong,
.box span,
.box small {
  display: block;
  white-space: nowrap;
}

.box.port strong,
.box.port small {
  overflow: visible;
  text-overflow: clip;
}

.instance-title {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 1;
  max-width: 46%;
  transform: translate(-50%, -50%);
  background: inherit;
  text-align: center;
  pointer-events: none;
}

.instance-title strong,
.instance-title span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.box.embedded em {
  display: block;
  font-style: normal;
  font-size: 9px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.port-name {
  position: absolute;
  z-index: 2;
  max-width: calc(50% - 3px);
  overflow: hidden;
  color: #163524;
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
  transform: translateY(-50%);
}

.port-name.left {
  left: 2px;
  text-align: left;
}

.port-name.right {
  right: 2px;
  text-align: right;
}

textarea {
  flex: 1;
  min-height: 0;
  width: 100%;
  resize: none;
  border: 0;
  background: transparent;
  font-family: Consolas, "Cascadia Mono", monospace;
  font-size: 10px;
}

.junction {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #3d4754;
}

.label {
  width: 100%;
  border: 1px dashed #5c6775;
  background: rgba(255, 255, 255, 0.9);
}

.routes {
  overflow: visible;
  pointer-events: none;
}

.signal-label {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  color: #16324f;
  line-height: 1;
  overflow: visible;
  white-space: nowrap;
}

.signal-label.selected {
  outline: 1px solid #0b5cab;
  background: rgba(255, 255, 255, 0.92);
  cursor: move;
}

.signal-label input {
  width: 100%;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 1;
}

.routes polyline {
  fill: none;
  stroke: #3d4754;
}

.error {
  margin: 0;
  padding: 0 12px 6px;
  color: #9d1c1c;
}
</style>
