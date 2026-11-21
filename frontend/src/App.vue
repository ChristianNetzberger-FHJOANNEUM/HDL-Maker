<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import DiagnosticsPanel from './components/DiagnosticsPanel.vue'
import LibraryTree from './components/LibraryTree.vue'
import PropertiesPanel from './components/PropertiesPanel.vue'
import SourceView from './components/SourceView.vue'
import DiagramEditor from './editors/diagram/DiagramEditor.vue'
import DiagramView from './editors/diagram/DiagramView.vue'
import SymbolView from './editors/symbol/SymbolView.vue'
import { useStudioStore } from './stores/studio'

const studio = useStudioStore()

function keepUnsaved(event: BeforeUnloadEvent): void {
  if (!studio.dirty) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(async () => {
  window.addEventListener('beforeunload', keepUnsaved)
  await studio.loadHealth()
  try {
    await studio.loadProject()
  } catch (reason) {
    studio.error = reason instanceof Error ? reason.message : 'The project could not be loaded.'
  }
  await studio.loadUi()
})

onBeforeUnmount(() => window.removeEventListener('beforeunload', keepUnsaved))
</script>

<template>
  <div class="studio">
    <header class="topbar">
      <div>
        <strong>HDL Design Studio</strong>
        <span>Library inventory</span>
      </div>
      <p v-if="studio.health">
        Backend {{ studio.health.python }}
        <span class="dot">·</span>
        GHDL {{ studio.health.ghdl ?? 'not installed' }}
      </p>
      <p v-else>{{ studio.healthError || 'Checking backend…' }}</p>
    </header>

    <div class="workspace">
      <LibraryTree />
      <section class="center">
        <div class="tabs">
          <button type="button" :class="{ active: studio.tab === 'symbol' }" @click="studio.tab = 'symbol'">
            Symbol
          </button>
          <button type="button" :class="{ active: studio.tab === 'diagram' }" @click="studio.tab = 'diagram'">
            Diagram
          </button>
          <button type="button" :class="{ active: studio.tab === 'source' }" @click="studio.tab = 'source'">
            Source
          </button>
        </div>
        <div class="stage">
          <SymbolView
            v-if="studio.tab === 'symbol'"
            :symbol="studio.symbolUnit"
            :selected="studio.selectedUnit"
          />
          <DiagramEditor v-else-if="studio.tab === 'diagram' && studio.editing" />
          <DiagramView v-else-if="studio.tab === 'diagram'" :diagram="studio.selectedDiagram" @edit="studio.openEditable()" />
          <SourceView v-else />
        </div>
      </section>
      <PropertiesPanel />
    </div>

    <DiagnosticsPanel />
  </div>
</template>
