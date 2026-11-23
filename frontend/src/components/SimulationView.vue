<script setup lang="ts">
import { computed } from 'vue'
import SimulationSettings from './SimulationSettings.vue'
import { useStudioStore } from '../stores/studio'

const studio = useStudioStore()
const run = computed(() => studio.simulationRun)
const running = computed(() => run.value?.status === 'running')

function stage(value: 'not_run' | 'passed' | 'failed' | undefined): string {
  if (value === 'passed') return 'passed'
  if (value === 'failed') return 'failed'
  return 'not run'
}

const duration = computed(() => {
  const ms = run.value?.duration_ms
  if (ms === null || ms === undefined) return ''
  return `${(ms / 1000).toFixed(1)} s`
})
</script>

<template>
  <div class="simulation">
    <h2>Simulation</h2>
    <p class="hint">GHDL runs the selected testbench. The language standard and the library profile come from the project.</p>
    <SimulationSettings />
    <div class="actions">
      <button type="button" :disabled="running" @click="studio.runSimulation()">Run Simulation</button>
      <button type="button" :disabled="!running" @click="studio.cancelRunningSimulation()">Cancel</button>
      <button type="button" :disabled="!run?.waveform_path" @click="studio.showWaveform()">Open in GTKWave</button>
    </div>
    <p v-if="studio.simulationNote" class="note">{{ studio.simulationNote }}</p>
    <p class="hint">
      GTKWave {{ studio.health?.gtkwave ? 'is available' : 'was not found' }}. A missing viewer, a bad executable path, or a missing waveform leaves the waveform file in place. The viewer keeps running if the studio is closed.
    </p>
    <section v-if="run">
      <h3>Latest run</h3>
      <p>Status: {{ run.status }}</p>
      <p>Analysis {{ stage(run.ghdl_analysis) }}. Elaboration {{ stage(run.ghdl_elaboration) }}. Simulation {{ stage(run.ghdl_simulation) }}.</p>
      <p v-if="duration">Duration: {{ duration }}</p>
      <p v-if="run.top">Top: {{ run.top }}</p>
      <p v-if="run.waveform_path" class="mono">{{ run.waveform_path }}</p>
      <p v-else-if="run.directory" class="mono">{{ run.directory }}</p>
      <ul>
        <li v-for="item in run.diagnostics" :key="`${item.code}-${item.message}`">{{ item.code }}: {{ item.message }}</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.simulation {
  height: 100%;
  overflow: auto;
  padding: 16px 20px 24px;
  background: #fff;
}

h2 {
  margin: 0 0 8px;
  font-size: 16px;
}

h3 {
  margin: 16px 0 6px;
  font-size: 13px;
}

.hint,
.note,
p {
  margin: 0 0 8px;
  font-size: 13px;
}

.hint {
  color: #5c6775;
  font-size: 12px;
}

.actions {
  display: flex;
  gap: 8px;
  margin: 4px 0 12px;
}

.mono {
  font-family: Consolas, "Cascadia Mono", monospace;
  font-size: 12px;
  word-break: break-all;
}

ul {
  margin: 0;
  padding-left: 18px;
}

button:disabled {
  opacity: 0.55;
}
</style>
