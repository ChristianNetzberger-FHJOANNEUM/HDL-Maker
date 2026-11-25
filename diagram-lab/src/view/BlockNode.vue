<script setup lang="ts">
import { computed } from 'vue'
import type { ImageAsset, Port, SymbolLabel, SymbolShape } from '../core/document'
import { portsOnSide } from '../core/geometry'
import SymbolFace, { type FacePin } from './SymbolFace.vue'

const props = defineProps<{
  blockId: string
  name: string
  width: number
  height: number
  ports: Array<Port & { top?: number; left?: number; missing?: boolean }>
  shapes: SymbolShape[] | null
  labels: SymbolLabel[]
  assets: ImageAsset[]
  selected: boolean
}>()

const emit = defineEmits<{ nudge: [id: string, dx: number, dy: number] }>()

const symbolPins = computed<FacePin[]>(() =>
  props.ports.map((port) => ({
    id: port.id,
    name: port.name,
    side: port.side,
    x: port.left ?? (port.side === 'left' ? 0 : props.width),
    y: port.top ?? 0,
    missing: port.missing,
    free: typeof port.x === 'number' && typeof port.y === 'number',
  })),
)

function top(port: Port & { top?: number }): number {
  if (typeof port.top === 'number') return port.top
  const side = portsOnSide(props.ports, port.blockId, port.side)
  const index = side.findIndex((item) => item.id === port.id)
  return (props.height * (index + 1)) / (side.length + 1)
}

function onKey(event: KeyboardEvent): void {
  const step = 20
  if (event.key === 'ArrowRight') emit('nudge', props.blockId, step, 0)
  else if (event.key === 'ArrowLeft') emit('nudge', props.blockId, -step, 0)
  else if (event.key === 'ArrowDown') emit('nudge', props.blockId, 0, step)
  else if (event.key === 'ArrowUp') emit('nudge', props.blockId, 0, -step)
  else return
  event.preventDefault()
}
</script>

<template>
  <div class="block" :class="{ selected, symbol: shapes !== null }" role="group" tabindex="0" :aria-label="name" :style="{ width: `${width}px`, height: `${height}px` }">
    <button type="button" class="block-name" @keydown="onKey">{{ name }}</button>
    <svg v-if="shapes" class="symbol-node" :viewBox="`0 0 ${width} ${height}`" :width="width" :height="height">
      <SymbolFace :width="width" :height="height" :shapes="shapes" :labels="labels" :assets="assets" :pins="symbolPins" hit />
    </svg>
    <span
      v-for="port in shapes ? [] : ports"
      :key="port.id"
      class="port"
      :style="{ top: `${top(port)}px`, [port.side]: '-5px' }"
      :title="port.name"
    >{{ port.name }}</span>
  </div>
</template>
