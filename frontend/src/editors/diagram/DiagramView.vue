<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { VueFlow } from '@vue-flow/core'
import { computed } from 'vue'
import type { DiagramDocument } from '../../models/design'

const props = defineProps<{
  diagram: DiagramDocument | null
}>()

defineEmits<{ edit: [] }>()

const TARGET_SPAN = 1100

interface Box {
  id: string
  kind: string
  title: string
  subtitle: string
  x: number
  y: number
  width: number
  height: number
}

const placed = computed(() => {
  const diagram = props.diagram
  if (!diagram) return null
  const xs: number[] = []
  const ys: number[] = []
  const raw: {
    id: string
    kind: string
    title: string
    subtitle: string
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
  ) {
    if (x1 === null || y1 === null || x2 === null || y2 === null) return
    xs.push(x1, x2)
    ys.push(y1, y2)
    raw.push({ id, kind, title, subtitle, x1, y1, x2, y2 })
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
    add(port.id, 'port', port.name, port.direction ?? '', port.x1, port.y1, port.x2, port.y2)
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
  const wires = diagram.wires.filter((wire) => wire.points.length >= 2)
  for (const wire of wires) {
    for (const point of wire.points) {
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
  const boxes: Box[] = raw.map((box) => {
    const left = mapX(Math.min(box.x1, box.x2))
    const top = mapY(Math.max(box.y1, box.y2))
    return {
      id: box.id,
      kind: box.kind,
      title: box.title,
      subtitle: box.subtitle,
      x: left,
      y: top,
      width: Math.max(Math.abs(box.x2 - box.x1) * scale, 2),
      height: Math.max(Math.abs(box.y2 - box.y1) * scale, 2),
    }
  })
  const width = Math.max((maxX - minX) * scale, 1)
  const height = Math.max((maxY - minY) * scale, 1)
  const routes = wires.map((wire) => wire.points.map((point) => `${mapX(point.x)},${mapY(point.y)}`).join(' '))
  return { empty: false as const, boxes, routes, width, height }
})

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
      data: { routes: layout.routes, width: layout.width, height: layout.height },
      style: { width: `${layout.width}px`, height: `${layout.height}px` },
    },
    ...layout.boxes.map((box) => ({
      id: box.id,
      type: 'box',
      position: { x: box.x, y: box.y },
      draggable: false,
      connectable: false,
      zIndex: 1,
      data: box,
      style: { width: `${box.width}px`, height: `${box.height}px` },
    })),
  ]
})

const note = computed(() => {
  const diagram = props.diagram
  if (!diagram) return ''
  if (diagram.view === 'state') {
    return 'State and transition geometry is counted and is not drawn. The machine name is in the properties.'
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
        <button v-if="diagram.view === 'block'" type="button" @click="$emit('edit')">Edit a copy</button>
      </p>
      <VueFlow
        v-if="nodes.length"
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
          <div class="box" :class="data.kind">
            <strong>{{ data.title }}</strong>
            <span v-if="data.subtitle">{{ data.subtitle }}</span>
          </div>
        </template>
        <template #node-routes="{ data }">
          <svg class="routes" :width="data.width" :height="data.height">
            <polyline v-for="(points, index) in data.routes" :key="index" :points="points" />
          </svg>
        </template>
        <Background />
        <Controls :show-interactive="false" />
      </VueFlow>
      <p v-else class="note">{{ note }}</p>
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

.canvas {
  flex: 1;
  min-height: 0;
  background: #f4f6f8;
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

.box strong,
.box span {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.routes {
  overflow: visible;
  pointer-events: none;
}

.routes polyline {
  fill: none;
  stroke: #3d4754;
  stroke-width: 1.5;
}
</style>
