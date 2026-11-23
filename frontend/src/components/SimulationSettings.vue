<script setup lang="ts">
import { computed } from 'vue'
import { useStudioStore } from '../stores/studio'

const studio = useStudioStore()
const entities = computed(() =>
  (studio.project?.design_units ?? [])
    .filter((unit) => unit.kind === 'entity' && unit.language === 'vhdl')
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name)),
)
const standardLabel = computed(() => (studio.vhdlStandard === '2008' ? 'VHDL-2008' : 'VHDL-93'))
const profileLabel = computed(() => (studio.libraryProfile === 'synopsys' ? 'Synopsys legacy' : 'Standard IEEE'))

function chooseTestbench(event: Event): void {
  studio.simulation.testbench_unit_id = (event.target as HTMLSelectElement).value
  void studio.saveSimulationSettings()
}

function chooseFormat(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  studio.simulation.waveform_format = value === 'vcd' ? 'vcd' : 'ghw'
  void studio.saveSimulationSettings()
}

function editStop(event: Event): void {
  studio.simulation.stop_time = (event.target as HTMLInputElement).value.trim()
}

function editGtkw(event: Event): void {
  studio.simulation.gtkw_path = (event.target as HTMLInputElement).value
}

function addGeneric(): void {
  studio.simulation.generic_overrides.push({ name: '', value: '' })
}

function removeGeneric(index: number): void {
  studio.simulation.generic_overrides.splice(index, 1)
  void studio.saveSimulationSettings()
}
</script>

<template>
  <div class="simulation-settings">
    <label for="testbench-entity">Testbench top-level entity</label>
    <p class="hint">This is not the hierarchy root. Only a VHDL entity can be simulated.</p>
    <select id="testbench-entity" :value="studio.simulation.testbench_unit_id" @change="chooseTestbench">
      <option value="">Choose a testbench</option>
      <option v-for="entity in entities" :key="entity.id" :value="entity.id">{{ entity.name }}</option>
    </select>
    <p class="chosen">Language standard: {{ standardLabel }}. Library compatibility: {{ profileLabel }}.</p>
    <label for="stop-time">Stop time</label>
    <input id="stop-time" :value="studio.simulation.stop_time" spellcheck="false" @input="editStop" @change="studio.saveSimulationSettings()" />
    <label for="waveform-format">Waveform format</label>
    <select id="waveform-format" :value="studio.simulation.waveform_format" @change="chooseFormat">
      <option value="ghw">GHW</option>
      <option value="vcd">VCD</option>
    </select>
    <p class="hint">GHW is GHDL's native waveform. VCD is the portable alternative.</p>
    <label for="gtkw-path">GTKWave save file</label>
    <input
      id="gtkw-path"
      :value="studio.simulation.gtkw_path"
      spellcheck="false"
      placeholder="Optional .gtkw path"
      @input="editGtkw"
      @change="studio.saveSimulationSettings()"
    />
    <p class="hint">Optional, one file for this simulation configuration. Later runs reuse its signals and zoom. HDL-Maker does not invent the signal list.</p>
    <h3>Testbench generics</h3>
    <p class="hint">Optional overrides of generics on the testbench entity. Each value is one token.</p>
    <div v-for="(item, index) in studio.simulation.generic_overrides" :key="index" class="generic">
      <input v-model="item.name" aria-label="Generic name" placeholder="Name" @change="studio.saveSimulationSettings()" />
      <input v-model="item.value" aria-label="Generic value" placeholder="Value" @change="studio.saveSimulationSettings()" />
      <button type="button" @click="removeGeneric(index)">Remove</button>
    </div>
    <button type="button" @click="addGeneric">Add generic</button>
  </div>
</template>

<style scoped>
.hint,
.chosen {
  margin: 4px 0 12px;
  color: #5c6775;
  font-size: 12px;
}

.chosen {
  color: #1c2430;
}

label,
h3 {
  display: block;
  margin: 0 0 4px;
  font-size: 13px;
}

input,
select,
button {
  margin: 0 0 12px;
}

select,
input {
  display: block;
  width: min(100%, 360px);
}

.generic {
  display: flex;
  gap: 8px;
  align-items: center;
}

.generic input {
  width: 140px;
  margin: 0;
}

.generic button {
  margin: 0;
}
</style>
