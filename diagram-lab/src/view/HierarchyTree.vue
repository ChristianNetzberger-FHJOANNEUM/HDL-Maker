<script setup lang="ts">
import { computed } from 'vue'
import type { DiagramProject, InstanceStep } from '../core/component'
import { treeNodes } from '../core/navigate'
import HierarchyTree from './HierarchyTree.vue'

const props = defineProps<{
  project: DiagramProject
  steps: InstanceStep[]
  expanded: string[]
  currentKey: string
}>()

const emit = defineEmits<{ toggle: [key: string]; open: [steps: InstanceStep[]] }>()

const nodes = computed(() => treeNodes(props.project, props.steps))
</script>

<template>
  <ul class="tree-list">
    <li v-for="node in nodes" :key="node.key">
      <button v-if="node.expandable" type="button" class="tree-twist" @click="emit('toggle', node.key)">
        {{ expanded.includes(node.key) ? '−' : '+' }}
      </button>
      <button
        type="button"
        class="tree-item"
        :class="{ on: node.key === currentKey }"
        :data-tree-key="node.key"
        :data-tree-status="node.status"
        @click="emit('open', node.steps)"
      >
        {{ node.instanceName }} : {{ node.componentName }}
      </button>
      <HierarchyTree
        v-if="node.expandable && expanded.includes(node.key)"
        :project="project"
        :steps="node.steps"
        :expanded="expanded"
        :current-key="currentKey"
        @toggle="emit('toggle', $event)"
        @open="emit('open', $event)"
      />
    </li>
  </ul>
</template>
