<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { computed, nextTick, ref, watch } from 'vue'
import type { DiagramDocument } from '../../models/design'
import { useStudioStore } from '../../stores/studio'
import { fitZoomFor, readableTextBox, usePaneWidth } from './textLayout'
import { layoutAnchoredPorts, layoutSignalLabels, portCaption, signalStroke, type PortLabel } from './portLabels'

const props = defineProps<{
  diagram: DiagramDocument | null
}>()

defineEmits<{ edit: [] }>()

const studio = useStudioStore()
const pane = usePaneWidth()
const { fitView } = useVueFlow({ id: 'diagram-view' })
const fittedFor = ref('')

const TARGET_SPAN = 1100

function boxText(
  owner: {
    entry_actions?: string | null
    during_actions?: string | null
    exit_actions?: string | null
    condition?: string | null
    actions?: string | null
  },
  role: string,
): string {
  if (role === 'entry') return owner.entry_actions ?? ''
  if (role === 'during') return owner.during_actions ?? ''
  if (role === 'exit') return owner.exit_actions ?? ''
  if (role === 'condition') return owner.condition ?? ''
  if (role === 'actions') return owner.actions ?? ''
  return ''
}

interface Box {
  id: string
  kind: string
  title: string
  subtitle: string
  tip: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  lineHeight: number
  labels: PortLabel[]
}

const placed = computed(() => {
  const diagram = props.diagram
  const labelStyle = studio.portLabelStyle
  if (!diagram) return null
  const xs: number[] = []
  const ys: number[] = []
  const raw: {
    id: string
    kind: string
    title: string
    subtitle: string
    tip: string
    x1: number
    y1: number
    x2: number
    y2: number
  }[] = []
  function add(
    id: string,
    kind: string,
    title: string,
    subtitle: string,
    x1: number | null,
    y1: number | null,
    x2: number | null,
    y2: number | null,
    tip = '',
  ) {
    if (x1 === null || y1 === null || x2 === null || y2 === null) return
    xs.push(x1, x2)
    ys.push(y1, y2)
    raw.push({ id, kind, title, subtitle, tip, x1, y1, x2, y2 })
  }
  for (const instance of diagram.instances) {
    add(
      instance.id,
      'instance',
      instance.name,
      instance.component_name ?? '',
      instance.x1,
      instance.y1,
      instance.x2,
      instance.y2,
    )
  }
  for (const port of diagram.ports) {
    add(port.id, 'port', portCaption(port, labelStyle), '', port.x1, port.y1, port.x2, port.y2, portCaption(port, 'long'))
  }
  for (const block of diagram.embedded_blocks) {
    add(
      block.id,
      'embedded',
      block.name,
      block.text?.trim().split('\n').find((line) => line.trim()) || (block.number ? `#${block.number}` : 'HDL text'),
      block.x1,
      block.y1,
      block.x2,
      block.y2,
    )
  }
  for (const state of diagram.states ?? []) {
    add(state.id, 'state', state.name, '', state.x1, state.y1, state.x2, state.y2)
    for (const box of state.text_boxes ?? []) {
      add(box.id, 'text', boxText(state, box.role), '', box.x1, box.y1, box.x2, box.y2)
    }
  }
  for (const transition of diagram.transitions ?? []) {
    for (const box of transition.text_boxes ?? []) {
      add(box.id, 'text', boxText(transition, box.role), '', box.x1, box.y1, box.x2, box.y2)
    }
  }
  const wires = diagram.wires.filter((wire) => wire.points.length >= 2)
  const transitions = (diagram.transitions ?? []).filter((item) => item.points.length >= 2)
  for (const wire of wires) {
    for (const point of wire.points) {
      xs.push(point.x)
      ys.push(point.y)
    }
  }
  for (const transition of transitions) {
    for (const point of transition.points) {
      xs.push(point.x)
      ys.push(point.y)
    }
  }
  if (xs.length === 0) return { empty: true as const }
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const scale = TARGET_SPAN / Math.max(maxX - minX, maxY - minY, 1)
  const mapX = (value: number) => (value - minX) * scale
  // The source files place titles at a higher Y than the component rectangle.
  const mapY = (value: number) => (maxY - value) * scale
  const labelsById = new Map<string, PortLabel[]>()
  for (const instance of diagram.instances) {
    if (instance.x1 === null || instance.y1 === null || instance.x2 === null || instance.y2 === null) continue
    const width = Math.max(Math.abs(instance.x2 - instance.x1) * scale, 2)
    const left = mapX(Math.min(instance.x1, instance.x2))
    const top = mapY(Math.max(instance.y1, instance.y2))
    const anchored = instance.ports.flatMap((port) => {
      if (port.x1 === null || port.y1 === null || port.x2 === null || port.y2 === null) return []
      return [
        {
          id: port.id,
          name: port.name,
          direction: port.direction,
          type_text: port.type_text,
          range_text: port.range_text,
          leftPx: mapX((port.x1 + port.x2) / 2) - left,
          topPx: mapY((port.y1 + port.y2) / 2) - top,
        },
      ]
    })
    labelsById.set(instance.id, layoutAnchoredPorts(anchored, width, labelStyle))
  }
  const width = Math.max((maxX - minX) * scale, 1)
  const height = Math.max((maxY - minY) * scale, 1)
  const fitZoom = fitZoomFor(pane.width.value, width)
  const boxes: Box[] = raw.map((box) => {
    const left = mapX(Math.min(box.x1, box.x2))
    const top = mapY(Math.max(box.y1, box.y2))
    const importedWidth = Math.max(Math.abs(box.x2 - box.x1) * scale, 2)
    const importedHeight = Math.max(Math.abs(box.y2 - box.y1) * scale, 2)
    const readable =
      box.kind === 'text'
        ? readableTextBox(box.title, importedWidth, importedHeight, fitZoom, studio.stateTextPx)
        : null
    return {
      id: box.id,
      kind: box.kind,
      title: box.title,
      subtitle: box.subtitle,
      tip: box.tip,
      x: left,
      y: top,
      width: readable ? readable.width : importedWidth,
      height: readable ? readable.height : importedHeight,
      fontSize: readable?.fontSize ?? 0,
      lineHeight: readable?.lineHeight ?? 0,
      labels: labelsById.get(box.id) ?? [],
    }
  })
  const netByObject = new Map(diagram.nets.filter((net) => net.hds_object !== null).map((net) => [net.hds_object, net]))
  const routes = [
    ...wires.map((wire) => ({
      points: wire.points.map((point) => `${mapX(point.x)},${mapY(point.y)}`).join(' '),
      width: signalStroke(wire.net_object === null ? null : netByObject.get(wire.net_object)?.range_text),
    })),
    ...transitions.map((transition) => ({
      points: transition.points.map((point) => `${mapX(point.x)},${mapY(point.y)}`).join(' '),
      width: 1.5,
    })),
  ]
  const signalLabels = layoutSignalLabels(wires, diagram.nets, mapX, mapY, labelStyle)
  return { empty: false as const, boxes, routes, signalLabels, width, height }
})

watch(
  () => [props.diagram?.id ?? '', pane.width.value] as const,
  async ([id, width]) => {
    if (!id || width < 200 || fittedFor.value === id) return
    fittedFor.value = id
    await nextTick()
    await fitView({ padding: 0.12 })
  },
)

const nodes = computed(() => {
  const layout = placed.value
  if (!layout || layout.empty) return []
  return [
    {
      id: 'routes',
      type: 'routes',
      position: { x: 0, y: 0 },
      draggable: false,
      connectable: false,
      selectable: false,
      zIndex: 0,
      data: { routes: layout.routes, signalLabels: layout.signalLabels, width: layout.width, height: layout.height },
      style: { width: `${layout.width}px`, height: `${layout.height}px` },
    },
    ...layout.boxes.map((box) => ({
      id: box.id,
      type: 'box',
      position: { x: box.x, y: box.y },
      draggable: false,
      connectable: false,
      zIndex: box.kind === 'text' ? 2 : 1,
      data: box,
      style: { width: `${box.width}px`, height: `${box.height}px` },
    })),
  ]
})

const note = computed(() => {
  const diagram = props.diagram
  if (!diagram) return ''
  if (diagram.view === 'state' && !(diagram.states ?? []).length) {
    return 'This state diagram has no placed states. Palette records without a uid are listed in the diagnostics.'
  }
  return 'Read only. Coordinates come from the HDL Designer file. Y is flipped because titles sit above the component box in that file.'
})
</script>

<template>
  <div class="diagram-view">
    <p v-if="!diagram" class="note">Select a diagram in the library tree.</p>
    <template v-else>
      <p class="note">
        {{ diagram.source_path }}
        <span v-if="diagram.entity_name"> · {{ diagram.entity_name }}</span>
        <span v-if="diagram.architecture_name"> / {{ diagram.architecture_name }}</span>
        · {{ note }}
        <button v-if="diagram.view === 'block' || diagram.view === 'state'" type="button" @click="$emit('edit')">
          Edit a copy
        </button>
      </p>
      <div :ref="pane.bind" class="canvas-host">
      <VueFlow
        v-if="nodes.length"
        id="diagram-view"
        :key="diagram.id"
        class="canvas"
        :nodes="nodes"
        :edges="[]"
        :nodes-draggable="false"
        :nodes-connectable="false"
        :edges-updatable="false"
        :fit-view-on-init="true"
        :min-zoom="0.05"
        :max-zoom="4"
      >
        <template #node-box="{ data }">
          <div
            class="box"
            :class="data.kind"
            :title="data.tip || [data.title, data.subtitle].filter(Boolean).join(' ')"
          >
            <div v-if="data.kind === 'instance'" class="instance-title">
              <strong>{{ data.title }}</strong>
              <span v-if="data.subtitle">{{ data.subtitle }}</span>
            </div>
            <template v-else>
              <strong :style="data.fontSize ? { fontSize: `${data.fontSize}px`, lineHeight: `${data.lineHeight}px` } : undefined">{{ data.title }}</strong>
              <span v-if="data.subtitle">{{ data.subtitle }}</span>
            </template>
            <em v-if="data.kind === 'embedded'">embedded HDL</em>
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
        <template #node-routes="{ data }">
          <svg class="routes" :width="data.width" :height="data.height">
            <polyline
              v-for="(route, index) in data.routes"
              :key="index"
              :points="route.points"
              :stroke-width="route.width"
            />
            <text
              v-for="label in data.signalLabels"
              :key="label.id"
              :x="label.x"
              :y="label.y"
              :font-size="label.fontSize"
              :title="label.title"
              text-anchor="middle"
              dominant-baseline="alphabetic"
            >{{ label.text }}</text>
          </svg>
        </template>
        <Background />
        <Controls :show-interactive="false" />
      </VueFlow>
      <p v-else class="note">{{ note }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.diagram-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.canvas-host {
  flex: 1;
  min-height: 0;
}

.canvas {
  width: 100%;
  height: 100%;
  background: #f4f6f8;
}

.canvas :deep(.vue-flow__node-box) {
  padding: 0;
  border: none;
  background: transparent;
  overflow: visible;
}

.note {
  margin: 0;
  padding: 8px 12px;
  color: #5c6775;
  font-size: 12px;
}

.box {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid #1f7a4d;
  background: rgba(223, 244, 232, 0.92);
  color: #163524;
  font-size: 11px;
  line-height: 1.2;
  padding: 2px 4px;
  pointer-events: none;
}

.box.port {
  border-color: #0b5cab;
  background: rgba(229, 240, 250, 0.92);
  color: #16324f;
}

.box.embedded {
  border-color: #6b5420;
  background: rgba(255, 244, 214, 0.92);
  color: #3d3112;
}

.box.state {
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  border-color: #0b5cab;
  background: rgba(229, 240, 250, 0.92);
  color: #16324f;
}

.box.text {
  border-radius: 2px;
  border-color: #5c6775;
  background: rgba(255, 255, 255, 0.94);
  color: #16324f;
  overflow: hidden;
  padding: 4px 6px;
}

.box.text strong {
  white-space: pre-wrap;
  overflow: visible;
  text-overflow: clip;
  font-weight: 400;
  font-family: Consolas, 'Courier New', monospace;
  overflow-wrap: break-word;
}

.box > strong,
.box > span:not(.port-name) {
  display: block;
  white-space: nowrap;
}

.box:not(.instance):not(.port) > strong,
.box:not(.instance):not(.port) > span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.box.instance,
.box.port {
  position: relative;
  overflow: hidden;
}

.box.instance {
  padding: 0;
}
.box.instance > strong,
.box.instance > span:not(.port-name) {
  width: max-content;
  max-width: 280px;
  overflow: visible;
  text-overflow: clip;
}

.box.embedded em {
  display: block;
  font-style: normal;
  font-size: 9px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
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
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.routes {
  overflow: visible;
  pointer-events: none;
}

.routes polyline {
  fill: none;
  stroke: #3d4754;
}

.routes text {
  fill: #16324f;
  pointer-events: none;
}
</style>
