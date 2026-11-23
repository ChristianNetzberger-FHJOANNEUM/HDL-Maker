<script setup lang="ts">
defineProps<{
  data: {
    points: { x: number; y: number }[]
    width?: number
    onBend: (index: number, event: PointerEvent) => void
  }
}>()
</script>

<template>
  <g class="ortho-edge">
    <polyline
      :points="data.points.map((point) => `${point.x},${point.y}`).join(' ')"
      :stroke-width="data.width ?? 0.6"
    />
    <circle
      v-for="(point, index) in data.points.slice(1, -1)"
      :key="index"
      class="bend"
      :cx="point.x"
      :cy="point.y"
      r="5"
      @pointerdown.stop.prevent="data.onBend(index + 1, $event)"
    />
  </g>
</template>

<style scoped>
.ortho-edge polyline {
  fill: none;
  stroke: #3d4754;
}

.bend {
  fill: #fff;
  stroke: #0b5cab;
  stroke-width: 1.5;
  cursor: move;
}
</style>
