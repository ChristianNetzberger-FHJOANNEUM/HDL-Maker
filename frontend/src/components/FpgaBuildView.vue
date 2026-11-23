<script setup lang="ts">
import { computed } from 'vue'
import { useStudioStore } from '../stores/studio'

const studio = useStudioStore()
const build = computed(() => studio.fpgaBuild)
const running = computed(() => build.value?.status === 'running')
const scan = computed(() => studio.hardwareScan)
const programmed = computed(() => studio.hardwareProgram)
const selectedDevice = computed(() => scan.value?.devices.find((device) => device.device_id === studio.selectedDeviceId) ?? null)
const canProgram = computed(
  () =>
    Boolean(studio.fpgaBitstream) &&
    Boolean(selectedDevice.value?.matches_part) &&
    studio.programConfirm &&
    scan.value?.status === 'devices' &&
    programmed.value?.status !== 'running',
)
void studio.refreshHardware()
const entities = computed(() =>
  (studio.project?.design_units ?? [])
    .filter((unit) => unit.kind === 'entity' && unit.language === 'vhdl')
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name)),
)
const selectedBoard = computed(() => studio.boards.find((board) => board.id === studio.fpga.board_id))
const stageNames = ['validation', 'synthesis', 'optimization', 'placement', 'routing', 'bitstream'] as const

function chooseTop(event: Event): void {
  studio.fpga.top_unit_id = (event.target as HTMLSelectElement).value
  void studio.saveFpgaSettings()
}

function chooseBoard(event: Event): void {
  studio.fpga.board_id = (event.target as HTMLSelectElement).value
  studio.fpga.part = ''
  void studio.saveFpgaSettings()
}

function choosePart(event: Event): void {
  studio.fpga.part = (event.target as HTMLSelectElement).value
  void studio.saveFpgaSettings()
}

function editXdc(index: number, event: Event): void {
  studio.fpga.xdc_paths[index] = (event.target as HTMLInputElement).value
}

function addXdc(): void {
  studio.fpga.xdc_paths.push('')
}

function removeXdc(index: number): void {
  studio.fpga.xdc_paths.splice(index, 1)
  void studio.saveFpgaSettings()
}

function chooseDevice(event: Event): void {
  studio.selectedDeviceId = (event.target as HTMLSelectElement).value
  studio.programConfirm = false
}

function stageLabel(name: string): string {
  const value = build.value?.stages[name as keyof typeof build.value.stages]
  if (value === 'passed') return 'passed'
  if (value === 'failed') return 'failed'
  if (value === 'running') return 'running'
  return 'not run'
}
</script>

<template>
  <div class="fpga">
    <h2>FPGA Build</h2>
    <p class="hint">
      Vivado runs in non-project batch mode. The top-level entity is not the simulation testbench and not the hierarchy root. The part is chosen from the board file.
    </p>
    <label for="fpga-top">Top-level entity</label>
    <select id="fpga-top" :value="studio.fpga.top_unit_id" @change="chooseTop">
      <option value="">Choose a top-level entity</option>
      <option v-for="entity in entities" :key="entity.id" :value="entity.id">{{ entity.name }}</option>
    </select>
    <label for="fpga-board">Board</label>
    <select id="fpga-board" :value="studio.fpga.board_id" @change="chooseBoard">
      <option value="">Choose a board</option>
      <option v-for="board in studio.boards" :key="board.id" :value="board.id">
        {{ board.display_name }} — {{ board.id }}
      </option>
    </select>
    <p class="hint">Language standard: {{ studio.vhdlStandard === '2008' ? 'VHDL-2008' : 'VHDL-93' }}. Library profile: {{ studio.libraryProfile }}.</p>
    <label for="fpga-part">FPGA part</label>
    <select id="fpga-part" :value="studio.fpga.part" @change="choosePart">
      <option value="">Choose a part</option>
      <option v-for="part in selectedBoard?.part_names ?? []" :key="part" :value="part">{{ part }}</option>
    </select>
    <p v-if="selectedBoard" class="hint">The board file names: {{ selectedBoard.part_names.join(', ') || 'no part' }}.</p>
    <h3>XDC files</h3>
    <p class="hint">External constraint files. A board definition is not used as a pin or clock constraint.</p>
    <div v-for="(path, index) in studio.fpga.xdc_paths" :key="index" class="xdc">
      <input :value="path" spellcheck="false" aria-label="XDC path" @input="editXdc(index, $event)" @change="studio.saveFpgaSettings()" />
      <button type="button" @click="removeXdc(index)">Remove</button>
    </div>
    <button type="button" @click="addXdc">Add XDC</button>
    <div class="actions">
      <button type="button" :disabled="running" @click="studio.runFpga('synthesis')">Run Synthesis</button>
      <button type="button" :disabled="running" @click="studio.runFpga('bitstream')">Build Bitstream</button>
      <button type="button" :disabled="!running" @click="studio.cancelFpga()">Cancel</button>
    </div>
    <p v-if="studio.fpgaNote" class="note">{{ studio.fpgaNote }}</p>
    <section v-if="build">
      <h3>{{ build.target === 'bitstream' ? 'Bitstream build' : 'Synthesis' }}</h3>
      <p>Status: {{ build.status }}. Part: {{ build.part || 'not chosen' }}.</p>
      <p v-for="name in stageNames" :key="name">{{ name }} {{ stageLabel(name) }}.</p>
      <p v-if="build.bitstream_path" class="mono">{{ build.bitstream_path }}</p>
      <p v-else-if="build.target === 'synthesis' && build.status === 'passed'">Synthesis finished. No bitstream was requested.</p>
      <p>{{ build.warning_count }} warning(s), {{ build.error_count }} error(s).</p>
      <ul>
        <li v-for="item in build.diagnostics" :key="`${item.code}-${item.message}`">{{ item.code }}: {{ item.message }}</li>
      </ul>
      <div class="actions">
        <button type="button" @click="studio.openFpgaReport('utilization_synth.rpt')">Utilization</button>
        <button type="button" @click="studio.openFpgaReport('timing_synth.rpt')">Timing</button>
        <button type="button" @click="studio.openFpgaReport('drc.rpt')">DRC</button>
        <button type="button" @click="studio.openFpgaReport('vivado.log')">Vivado log</button>
      </div>
      <pre v-if="studio.fpgaReport" class="report">{{ studio.fpgaReport }}</pre>
    </section>
    <section>
      <h3>Program FPGA</h3>
      <p class="hint">
        JTAG programming uses the finished bitstream and one device you select. The first device in the chain is not used automatically. A Zynq PL-only bitstream can warn that the PS7 cell is absent. This step does not add a processing system.
      </p>
      <p v-if="studio.fpgaBitstream" class="mono">{{ studio.fpgaBitstream.bitstream_path }}</p>
      <p v-else class="hint">No finished bitstream build is available.</p>
      <p v-if="studio.fpgaBitstream">Bitstream part: {{ studio.fpgaBitstream.part }}.</p>
      <button type="button" :disabled="scan?.status === 'running'" @click="studio.scanHardware()">Scan JTAG</button>
      <p v-if="scan" class="note">{{ scan.message }}</p>
      <p v-if="scan?.mock">Mock scan. The FPGA was not programmed.</p>
      <p v-if="scan && !scan.mock && scan.jtag_download === 'not_tested_no_hardware'">JTAG download: not tested, no hardware.</p>
      <label v-if="scan?.devices.length" for="fpga-device">JTAG device</label>
      <select v-if="scan?.devices.length" id="fpga-device" :value="studio.selectedDeviceId" @change="chooseDevice">
        <option value="">Choose a device</option>
        <option v-for="device in scan.devices" :key="device.device_id" :value="device.device_id">
          {{ device.name }} — {{ device.part || 'no part' }} — {{ device.target }}{{ device.matches_part ? '' : ' — part does not match' }}
        </option>
      </select>
      <label v-if="selectedDevice" class="check">
        <input v-model="studio.programConfirm" type="checkbox" />
        Program only {{ selectedDevice.name }} on {{ selectedDevice.target }}
      </label>
      <div class="actions">
        <button type="button" :disabled="!canProgram" @click="studio.programDevice()">Program selected device</button>
      </div>
      <p v-if="programmed?.mock">Mock test. The FPGA was not programmed.</p>
      <p v-else-if="programmed?.programmed">Programmed {{ programmed.device_name }} on {{ programmed.target }}.</p>
      <p v-else-if="programmed">{{ programmed.message }}</p>
    </section>
  </div>
</template>

<style scoped>
.fpga {
  height: 100%;
  overflow: auto;
  padding: 16px 20px 32px;
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
.note {
  margin: 4px 0 12px;
  color: #5c6775;
  font-size: 12px;
}

label {
  display: block;
  margin-top: 8px;
  font-size: 13px;
}

.check {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

select,
input,
button {
  margin: 4px 8px 8px 0;
}

input {
  width: min(100%, 520px);
}

.mono,
.report {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  word-break: break-all;
}

.report {
  white-space: pre-wrap;
  max-height: 280px;
  overflow: auto;
  background: #f6f8fa;
  padding: 8px;
}

ul {
  margin: 4px 0 8px;
  padding-left: 18px;
}
</style>
