<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { VueFlow } from '@vue-flow/core'
import { computed } from 'vue'
import type { DesignUnit } from '../../models/design'
import EntitySymbol from './EntitySymbol.vue'
import { SYMBOL_WIDTH, symbolHeight } from './layout'

const props = defineProps<{
  symbol: DesignUnit | null
  selected: DesignUnit | null
}>()

const nodes = computed(() => {
  if (!props.symbol) return []
  return [
    {
      id: props.symbol.id,
      type: 'entity',
      position: { x: 80, y: 48 },
      draggable: false,
      connectable: false,
      data: {
        name: props.symbol.name,
        generics: props.symbol.generics,
        ports: props.symbol.ports,
      },
      style: {
        width: `${SYMBOL_WIDTH}px`,
        height: `${symbolHeight(props.symbol.generics.length, props.symbol.ports)}px`,
      },
    },
  ]
})

const note = computed(() => {
  if (!props.selected || !props.symbol) return ''
  if (props.selected.kind === 'architecture') {
    return `Symbol shows entity ${props.symbol.name}. Architecture ${props.selected.name} is listed and its body is not imported.`
  }
  return ''
})
</script>

<template>
  <div class="symbol-view">
    <p v-if="note" class="note">{{ note }}</p>
    <div v-if="symbol" class="canvas">
      <VueFlow
        :key="symbol.id"
        :nodes="nodes"
        :edges="[]"
        :nodes-draggable="false"
        :nodes-connectable="false"
        :elements-selectable="false"
        fit-view-on-init
      >
        <template #node-entity="nodeProps">
          <EntitySymbol :data="nodeProps.data" />
        </template>
        <Background />
        <Controls />
      </VueFlow>
    </div>
    <p v-else class="empty">
      Select an entity to see its symbol. Packages are listed, and their declarations are not drawn.
    </p>
  </div>
</template>

<style scoped>
.symbol-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.note,
.empty {
  margin: 0;
  padding: 8px 12px;
  color: #3d4754;
  background: #f7f8fa;
  border-bottom: 1px solid #d0d5dd;
}

.canvas {
  flex: 1;
  min-height: 0;
}

.canvas :deep(.vue-flow) {
  height: 100%;
  background: #f4f6f8;
}

.canvas :deep(.vue-flow__node-entity) {
  background: transparent;
  border: none;
  padding: 0;
  box-shadow: none;
  border-radius: 0;
}
</style>
