<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import DiagnosticsPanel from './components/DiagnosticsPanel.vue'
import LibraryTree from './components/LibraryTree.vue'
import PropertiesPanel from './components/PropertiesPanel.vue'
import PreferencesView from './components/PreferencesView.vue'
import FpgaBuildView from './components/FpgaBuildView.vue'
import SimulationView from './components/SimulationView.vue'
import SourceView from './components/SourceView.vue'
import DiagramEditor from './editors/diagram/DiagramEditor.vue'
import DiagramView from './editors/diagram/DiagramView.vue'
import StateEditor from './editors/diagram/StateEditor.vue'
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
  await studio.loadTools()
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
          <button type="button" :class="{ active: studio.tab === 'simulation' }" @click="studio.tab = 'simulation'">
            Simulation
          </button>
          <button type="button" :class="{ active: studio.tab === 'fpga' }" @click="studio.tab = 'fpga'">
            FPGA Build
          </button>
          <button
            type="button"
            class="gear"
            :class="{ active: studio.tab === 'preferences' }"
            aria-label="Preferences"
            title="Preferences"
            @click="studio.tab = 'preferences'"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"
              />
            </svg>
          </button>
        </div>
        <div class="stage">
          <SymbolView
            v-if="studio.tab === 'symbol'"
            :symbol="studio.symbolUnit"
            :selected="studio.selectedUnit"
          />
          <StateEditor v-else-if="studio.tab === 'diagram' && studio.editing && studio.editable?.kind === 'state'" />
          <DiagramEditor v-else-if="studio.tab === 'diagram' && studio.editing" />
          <DiagramView v-else-if="studio.tab === 'diagram'" :diagram="studio.selectedDiagram" @edit="studio.openEditable()" />
          <SourceView v-else-if="studio.tab === 'source'" />
          <SimulationView v-else-if="studio.tab === 'simulation'" />
          <FpgaBuildView v-else-if="studio.tab === 'fpga'" />
          <PreferencesView v-else-if="studio.tab === 'preferences'" />
        </div>
      </section>
      <PropertiesPanel />
    </div>

    <DiagnosticsPanel />
  </div>
</template>
