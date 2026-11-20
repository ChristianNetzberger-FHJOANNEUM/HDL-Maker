<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { computed } from 'vue'
import type { GenericPort, Port } from '../../models/design'
import { leftPorts, rightPorts, rowCenter } from './layout'

const props = defineProps<{
  data: {
    name: string
    generics: GenericPort[]
    ports: Port[]
  }
}>()

const inputs = computed(() => leftPorts(props.data.ports))
const outputs = computed(() => rightPorts(props.data.ports))

function labelTop(index: number): string {
  return `${rowCenter(index, props.data.generics.length) - 11}px`
}
</script>

<template>
  <div class="symbol">
    <header>{{ data.name }}</header>
    <ul v-if="data.generics.length" class="generics">
      <li v-for="generic in data.generics" :key="generic.id">
        {{ generic.name }}
        <template v-if="generic.default_text"> = {{ generic.default_text }}</template>
      </li>
    </ul>
    <Handle
      v-for="(port, index) in inputs"
      :id="port.id"
      :key="port.id"
      type="target"
      :position="Position.Left"
      :style="{ top: rowCenter(index, data.generics.length) + 'px' }"
    />
    <Handle
      v-for="(port, index) in outputs"
      :id="port.id"
      :key="port.id"
      type="source"
      :position="Position.Right"
      :style="{ top: rowCenter(index, data.generics.length) + 'px' }"
    />
    <div
      v-for="(port, index) in inputs"
      :key="`${port.id}-label`"
      class="port-label in"
      :style="{ top: labelTop(index) }"
    >
      <span class="dir" :data-dir="port.direction ?? 'unresolved'">{{ port.direction ?? '?' }}</span>
      <span>{{ port.name }}</span>
    </div>
    <div
      v-for="(port, index) in outputs"
      :key="`${port.id}-label`"
      class="port-label out"
      :style="{ top: labelTop(index) }"
    >
      <span>{{ port.name }}</span>
      <span class="dir" :data-dir="port.direction ?? 'unresolved'">{{ port.direction ?? '?' }}</span>
    </div>
  </div>
</template>

<style scoped>
.symbol {
  position: relative;
  width: 100%;
  height: 100%;
  background: #fff;
  border: 1.5px solid #1e2430;
  border-radius: 2px;
  box-sizing: border-box;
}

header {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #d0d5dd;
  font-weight: 650;
  background: #f7f8fa;
}

.generics {
  list-style: none;
  margin: 4px 12px 0;
  padding: 0;
  color: #5c6775;
  font-family: Consolas, "Cascadia Mono", monospace;
  font-size: 12px;
  line-height: 16px;
}

.port-label {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  font-family: Consolas, "Cascadia Mono", monospace;
  font-size: 12px;
}

.port-label.in {
  left: 10px;
}

.port-label.out {
  right: 10px;
}

.dir {
  color: #5c6775;
  font-size: 10px;
  text-transform: uppercase;
}

.dir[data-dir='in'] {
  color: #1f7a4d;
}

.dir[data-dir='out'] {
  color: #0b5cab;
}

.dir[data-dir='inout'],
.dir[data-dir='buffer'] {
  color: #8a5a00;
}

.dir[data-dir='unresolved'] {
  color: #a12626;
}
</style>
