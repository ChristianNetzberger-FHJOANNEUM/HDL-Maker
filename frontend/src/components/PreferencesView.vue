<script setup lang="ts">
import { computed } from 'vue'
import SimulationSettings from './SimulationSettings.vue'
import { useStudioStore } from '../stores/studio'

const studio = useStudioStore()
const standardLabel = computed(() => (studio.vhdlStandard === '2008' ? 'VHDL-2008' : 'VHDL-93'))
const profileLabel = computed(() => (studio.libraryProfile === 'synopsys' ? 'Synopsys legacy' : 'Standard IEEE'))
const canGenerate = computed(() => studio.editing && studio.editable?.kind === 'block' && !studio.busy)

function setSize(event: Event): void {
  studio.setStateTextPx(Number((event.target as HTMLInputElement).value))
}

function setStandard(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (value === '93' || value === '2008') void studio.setVhdlStandard(value)
}

function setProfile(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'ieee' || value === 'synopsys') void studio.setLibraryProfile(value)
}

function generate(): void {
  void studio.generateHdl()
}

function editGtkwave(event: Event): void {
  studio.gtkwavePath = (event.target as HTMLInputElement).value
}

function editVivado(event: Event): void {
  studio.vivadoPath = (event.target as HTMLInputElement).value
}
</script>

<template>
  <div class="preferences">
    <h2>Preferences</h2>
    <section>
      <h3>State diagrams</h3>
      <p class="hint">Text size is a studio setting. It is saved in the workspace UI file and does not change a design.</p>
      <label for="state-text-px">Text size</label>
      <p class="hint">
        On-screen size of action and condition text when a sheet fits the window. Zoom then scales the text with its box.
      </p>
      <div class="row">
        <input
          id="state-text-px"
          type="range"
          min="8"
          max="16"
          step="1"
          :value="studio.stateTextPx"
          aria-label="FSM text size"
          @input="setSize"
        />
        <strong>{{ studio.stateTextPx }} px</strong>
      </div>
      <p class="sample" :style="{ fontSize: `${studio.stateTextPx}px` }">cnt &lt;= cnt + 1;</p>
    </section>
    <section>
      <h3>Generate HDL</h3>
      <label for="vhdl-standard">VHDL Language Standard</label>
      <p class="hint">
        This is project build configuration. It is stored with the project, not with diagram geometry, and it does not rewrite
        imported diagrams or original HDL files.
      </p>
      <select id="vhdl-standard" :value="studio.vhdlStandard" aria-label="VHDL Language Standard" @change="setStandard">
        <option value="93">VHDL-93</option>
        <option value="2008">VHDL-2008</option>
      </select>
      <p class="chosen">Selected standard: {{ standardLabel }}</p>
      <label for="library-profile">GHDL library compatibility</label>
      <p class="hint">
        This is independent of the language standard. It changes the GHDL command only. Package clauses and VHDL expressions stay as they are stored.
      </p>
      <select id="library-profile" :value="studio.libraryProfile" aria-label="GHDL library compatibility" @change="setProfile">
        <option value="ieee">Standard IEEE</option>
        <option value="synopsys">Synopsys legacy</option>
      </select>
      <p class="chosen">Selected compatibility: {{ profileLabel }}</p>
      <button type="button" class="generate" :disabled="!canGenerate" @click="generate">Generate HDL</button>
      <p v-if="!studio.editing || studio.editable?.kind !== 'block'" class="hint">
        Open a block diagram to generate structural VHDL. State diagrams use the same project settings when their VHDL is generated.
      </p>
      <div v-if="studio.generation" class="result">
        <p>
          {{ studio.generation.files.length }} file(s) for {{ studio.generation.vhdl_standard === '2008' ? 'VHDL-2008' : 'VHDL-93' }}.
        </p>
        <p v-if="studio.generation.ghdl_analysis === 'not_run'">GHDL analysis was not run.</p>
        <p v-else-if="studio.generation.ghdl_analysis === 'passed'">GHDL analysis passed.</p>
        <p v-else>GHDL analysis failed.</p>
        <p v-if="studio.generation.ghdl_elaboration === 'not_run'">GHDL elaboration was not run.</p>
        <p v-else-if="studio.generation.ghdl_elaboration === 'passed'">GHDL elaboration passed.</p>
        <p v-else>GHDL elaboration failed.</p>
        <p class="mono">{{ studio.generation.output_dir }}</p>
        <ul>
          <li v-for="file in studio.generation.files" :key="file.relative_path">{{ file.relative_path }}</li>
        </ul>
        <ul>
          <li v-for="item in studio.generation.diagnostics" :key="`${item.code}-${item.message}`">
            {{ item.code }}: {{ item.message }}
          </li>
        </ul>
      </div>
    </section>
    <section>
      <h3>GTKWave</h3>
      <p class="hint">
        The executable path is local tool configuration for this machine. It is stored in the workspace tools file, not in a diagram and not in the project.
        Leave it empty to use GTKWave from PATH.
      </p>
      <label for="gtkwave-path">GTKWave executable</label>
      <input
        id="gtkwave-path"
        class="path"
        :value="studio.gtkwavePath"
        spellcheck="false"
        placeholder="Path to gtkwave.exe"
        @input="editGtkwave"
        @change="studio.saveGtkwavePath()"
      />
      <p class="chosen">{{ studio.health?.gtkwave ? studio.health.gtkwave : 'GTKWave was not found.' }}</p>
    </section>
    <section>
      <h3>Vivado</h3>
      <p class="hint">
        The path to vivado.bat is local tool configuration. It is stored in the workspace tools file, not in a diagram and not in the project. PATH is not changed.
      </p>
      <label for="vivado-path">Vivado batch file</label>
      <input
        id="vivado-path"
        class="path"
        :value="studio.vivadoPath"
        spellcheck="false"
        placeholder="Path to vivado.bat"
        @input="editVivado"
        @change="studio.saveVivadoPath()"
      />
      <button type="button" @click="studio.checkVivadoInstall()">Check Vivado</button>
      <p class="chosen">{{ studio.vivadoNote || (studio.health?.vivado ? studio.health.vivado : 'Vivado was not found.') }}</p>
    </section>
    <section>
      <h3>Simulation</h3>
      <p class="hint">
        These settings belong to the project. Text size, the board, and the hierarchy root stay in the workspace UI file. The Simulation
        tab runs GHDL with the language standard and library compatibility selected above.
      </p>
      <SimulationSettings />
    </section>
  </div>
</template>

<style scoped>
.preferences {
  height: 100%;
  overflow: auto;
  padding: 16px 20px 24px;
  background: #fff;
}

h2 {
  margin: 0 0 12px;
  font-size: 16px;
}

h3 {
  margin: 0 0 6px;
  font-size: 13px;
}

.hint,
.chosen {
  margin: 0 0 12px;
  color: #5c6775;
  font-size: 12px;
}

.chosen {
  color: #1c2430;
}

section {
  max-width: 460px;
  padding-top: 4px;
  margin-bottom: 20px;
}

label {
  font-size: 13px;
}

.path {
  box-sizing: border-box;
  width: 100%;
  margin: 4px 0 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 0;
}

input {
  width: 180px;
  margin: 0;
}

select {
  display: block;
  min-width: 180px;
  margin: 8px 0;
}

button.generate {
  margin: 0 0 8px;
}

.sample {
  margin: 8px 0 0;
  padding: 8px 10px;
  border: 1px solid #d5dbe3;
  background: #f7f8fa;
  font-family: Consolas, 'Courier New', monospace;
  line-height: 1.35;
}

.result {
  margin-top: 8px;
  font-size: 12px;
}

.mono {
  font-family: Consolas, 'Courier New', monospace;
  word-break: break-all;
}

ul {
  margin: 4px 0 8px;
  padding-left: 18px;
}
</style>
