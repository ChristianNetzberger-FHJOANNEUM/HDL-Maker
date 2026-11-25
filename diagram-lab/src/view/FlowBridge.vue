<script setup lang="ts">
import { useVueFlow, type ViewportTransform } from '@vue-flow/core'
import { nextTick, onMounted, watch } from 'vue'

const props = defineProps<{
  portCount: number
  ids: string[]
  fitToken: number
  pinKey: string
  zoomToken: number
  frame: { mode: 'fit' | 'set'; x: number; y: number; width: number; height: number; zoom: number; token: number } | null
}>()
const emit = defineEmits<{ viewport: [ViewportTransform] }>()
const flow = useVueFlow()

function publish(): void {
  const view = flow.viewport.value
  emit('viewport', { x: view.x, y: view.y, zoom: view.zoom })
}

onMounted(publish)
watch(() => [flow.viewport.value.x, flow.viewport.value.y, flow.viewport.value.zoom], publish)
watch(
  () => [props.portCount, props.pinKey],
  () => {
    flow.updateNodeInternals(props.ids)
  },
)
watch(
  () => props.fitToken,
  () => {
    void flow.fitView({ padding: 0.2 })
  },
)
watch(
  () => props.zoomToken,
  (next, previous) => {
    if (previous === undefined || next === previous) return
    if (next > previous) void flow.zoomIn()
    else void flow.zoomOut()
  },
)
watch(
  () => props.frame?.token,
  async () => {
    const frame = props.frame
    if (!frame) return
    await nextTick()
    if (frame.mode === 'fit') void flow.fitBounds({ x: frame.x, y: frame.y, width: frame.width, height: frame.height }, { padding: 0.2 })
    else void flow.setViewport({ x: frame.x, y: frame.y, zoom: frame.zoom })
  },
)
</script>

<template><span class="bridge" /></template>
