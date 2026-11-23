<script setup lang="ts">
import { computed } from 'vue'
import { useStudioStore } from '../stores/studio'

const studio = useStudioStore()
const openSource = computed(() => studio.fpga.toolchain === 'opensource')
const build = computed(() => (openSource.value ? studio.openBuild : studio.fpgaBuild))
const running = computed(() => build.value?.status === 'running')
const scan = computed(() => (openSource.value ? studio.openScan : studio.hardwareScan))
const programmed = computed(() => (openSource.value ? studio.openProgram : studio.hardwareProgram))
const selectedDevice = computed(() => scan.value?.devices.find((device) => device.device_id === studio.selectedDeviceId) ?? null)
const vhdl2008Blocked = computed(() => openSource.value && studio.vhdlStandard === '2008')
const canProgram = computed(() => {
  if (openSource.value) {
    return Boolean(studio.openBuild?.bitstream_path) &&
      Boolean(selectedDevice.value?.matches_part) &&
      studio.programConfirm &&
      scan.value?.status === 'devices' &&
      programmed.value?.status !== 'running'
  }
  return Boolean(studio.fpgaBitstream) &&
    Boolean(selectedDevice.value?.matches_part) &&
    studio.programConfirm &&
    scan.value?.status === 'devices' &&
    programmed.value?.status !== 'running'
})
void studio.refreshHardware()
void studio.loadComparison()

function flag(value: boolean | null | undefined): string {
  if (value === true) return 'yes'
  if (value === false) return 'no'
  return 'not run'
}
const entities = computed(() =>
  (studio.project?.design_units ?? [])
    .filter((unit) => unit.kind === 'entity' && unit.language === 'vhdl')
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name)),
)
const selectedBoard = computed(() => studio.boards.find((board) => board.id === studio.fpga.board_id))
const stageNames = computed(() =>
  openSource.value
    ? (['ghdl', 'yosys', 'nextpnr', 'fasm2frames', 'xc7frames2bit'] as const)
    : (['validation', 'synthesis', 'optimization', 'placement', 'routing', 'bitstream'] as const),
)

function chooseToolchain(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  studio.fpga.toolchain = value === 'opensource' ? 'opensource' : 'vivado'
  studio.programConfirm = false
  studio.selectedDeviceId = ''
  void studio.saveFpgaSettings()
}

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

function editLoader(event: Event): void {
  studio.openLoaderPath = (event.target as HTMLInputElement).value
}

function editSerial(event: Event): void {
  studio.jtagSerial = (event.target as HTMLInputElement).value
}

function stageLabel(name: string): string {
  const stages = build.value?.stages as Record<string, string> | undefined
  const value = stages?.[name]
  if (value === 'passed') return 'passed'
  if (value === 'failed') return 'failed'
  if (value === 'running') return 'running'
  return 'not run'
}

const nextpnr = computed(() => studio.openBuild?.reports?.nextpnr ?? null)
</script>

<template>
  <div class="fpga">
    <h2>FPGA Build</h2>
    <label for="fpga-toolchain">Backend</label>
    <select id="fpga-toolchain" :value="studio.fpga.toolchain" @change="chooseToolchain">
      <option value="vivado">Vivado (proprietary)</option>
      <option value="opensource">Open Source (GHDL, Yosys, nextpnr/openXC7)</option>
    </select>
    <p v-if="openSource" class="hint">
      The open-source backend uses the same VHDL. It does not fall back to Vivado. VHDL-2008 stays unavailable until that chain has been validated.
    </p>
    <p v-else class="hint">
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
    <p v-if="vhdl2008Blocked" class="note">The open-source chain was validated for VHDL-93 only. VHDL-2008 was not run, and the VHDL-93 setting was not changed.</p>
    <div class="actions">
      <template v-if="openSource">
        <button type="button" @click="studio.checkOpenToolchain()">Check toolchain</button>
        <button type="button" :disabled="running || vhdl2008Blocked" @click="studio.runOpenBuild()">Build Bitstream</button>
      </template>
      <template v-else>
        <button type="button" :disabled="running" @click="studio.runFpga('synthesis')">Run Synthesis</button>
        <button type="button" :disabled="running" @click="studio.runFpga('bitstream')">Build Bitstream</button>
        <button type="button" :disabled="!running" @click="studio.cancelFpga()">Cancel</button>
      </template>
    </div>
    <ul v-if="openSource && studio.openCheck">
      <li v-for="(tool, name) in studio.openCheck.tools" :key="name">
        {{ name }}: {{ tool.ok ? tool.version : tool.code || 'missing' }}
      </li>
    </ul>
    <p v-if="studio.fpgaNote" class="note">{{ studio.fpgaNote }}</p>
    <section v-if="build">
      <h3>{{ build.target === 'bitstream' ? 'Bitstream build' : 'Synthesis' }}</h3>
      <p>Status: {{ build.status }}. Part: {{ build.part || 'not chosen' }}.</p>
      <p v-for="name in stageNames" :key="name">{{ name }} {{ stageLabel(name) }}.</p>
      <p v-if="build.bitstream_path" class="mono">{{ build.bitstream_path }}</p>
      <p v-if="openSource && studio.openBuild" class="mono">{{ studio.openBuild.directory }}/manifest.json</p>
      <p v-if="openSource && nextpnr">
        Resources: SLICE_LUTX {{ nextpnr.slice_lutx ?? 'not reported' }}, SLICE_FFX {{ nextpnr.slice_ffx ?? 'not reported' }}, CARRY4 {{ nextpnr.carry4 ?? 'not reported' }}.
        Timing: critical path {{ nextpnr.critical_path_ns ?? 'not reported' }} ns, max frequency {{ nextpnr.max_frequency_mhz ?? 'not reported' }} MHz.
      </p>
      <p v-else-if="!openSource && build.target === 'synthesis' && build.status === 'passed'">Synthesis finished. No bitstream was requested.</p>
      <ul>
        <li v-for="item in build.diagnostics" :key="`${item.code}-${item.message}`">{{ item.severity }} {{ item.code }}: {{ item.message }}</li>
      </ul>
      <div v-if="!openSource" class="actions">
        <button type="button" @click="studio.openFpgaReport('utilization_synth.rpt')">Utilization</button>
        <button type="button" @click="studio.openFpgaReport('timing_synth.rpt')">Timing</button>
        <button type="button" @click="studio.openFpgaReport('drc.rpt')">DRC</button>
        <button type="button" @click="studio.openFpgaReport('vivado.log')">Vivado log</button>
      </div>
      <pre v-if="studio.fpgaReport" class="report">{{ studio.fpgaReport }}</pre>
    </section>
    <section v-if="openSource">
      <h3>Program FPGA</h3>
      <p class="hint">
        This page loads SRAM only. It does not program flash. The serial must be interface A. The first FTDI device is not opened. ftd2xx.dll stays in the Windows installation.
      </p>
      <label for="open-loader">openFPGALoader executable</label>
      <input id="open-loader" :value="studio.openLoaderPath" spellcheck="false" placeholder="Path to the local D2XX openFPGALoader.exe" @input="editLoader" @change="studio.saveOpenLoaderPath()" />
      <p v-if="studio.openBuild?.bitstream_path" class="mono">{{ studio.openBuild.bitstream_path }}</p>
      <p v-else class="hint">No finished open-source bitstream is available.</p>
      <p v-if="studio.openBuild?.part">Bitstream part: {{ studio.openBuild.part }}. Board part: {{ studio.fpga.part || 'not chosen' }}.</p>
      <label for="jtag-serial">Interface A serial</label>
      <input id="jtag-serial" :value="studio.jtagSerial" spellcheck="false" placeholder="Serial of interface A" @input="editSerial" />
      <button type="button" :disabled="studio.openScan?.status === 'running'" @click="studio.scanOpenHardware()">Scan JTAG</button>
      <p v-if="studio.openScan" class="note">{{ studio.openScan.message }}</p>
      <label v-if="studio.openScan?.devices.length" for="fpga-device">JTAG device</label>
      <select v-if="studio.openScan?.devices.length" id="fpga-device" :value="studio.selectedDeviceId" @change="chooseDevice">
        <option value="">Choose a device</option>
        <option v-for="device in studio.openScan.devices" :key="device.device_id" :value="device.device_id">
          {{ device.name }} — {{ device.part || device.kind }} — {{ device.raw_idcode || device.idcode }}{{ device.matches_part ? '' : ' — part does not match' }}
        </option>
      </select>
      <label v-if="selectedDevice" class="check">
        <input v-model="studio.programConfirm" type="checkbox" />
        Program SRAM only on {{ selectedDevice.name }}
      </label>
      <div class="actions">
        <button type="button" :disabled="!canProgram" @click="studio.programOpenDevice()">Program SRAM</button>
      </div>
      <p v-if="studio.openProgram?.mock">Mock test. The FPGA was not programmed. A passed build is not a hardware test.</p>
      <p v-else-if="studio.openProgram?.programmed">SRAM programmed {{ studio.openProgram.device_name }}.</p>
      <p v-else-if="studio.openProgram">{{ studio.openProgram.message }}</p>
    </section>
    <section v-else>
      <h3>Program FPGA</h3>
      <p class="hint">
        JTAG programming uses the finished bitstream and one device you select. The first device in the chain is not used automatically. A Zynq PL-only bitstream can warn that the PS7 cell is absent. This step does not add a processing system.
      </p>
      <p v-if="studio.fpgaBitstream" class="mono">{{ studio.fpgaBitstream.bitstream_path }}</p>
      <p v-else class="hint">No finished bitstream build is available.</p>
      <p v-if="studio.fpgaBitstream">Bitstream part: {{ studio.fpgaBitstream.part }}.</p>
      <button type="button" :disabled="studio.hardwareScan?.status === 'running'" @click="studio.scanHardware()">Scan JTAG</button>
      <p v-if="studio.hardwareScan" class="note">{{ studio.hardwareScan.message }}</p>
      <p v-if="studio.hardwareScan?.mock">Mock scan. The FPGA was not programmed.</p>
      <p v-if="studio.hardwareScan && !studio.hardwareScan.mock && studio.hardwareScan.jtag_download === 'not_tested_no_hardware'">JTAG download: not tested, no hardware.</p>
      <label v-if="studio.hardwareScan?.devices.length" for="fpga-device">JTAG device</label>
      <select v-if="studio.hardwareScan?.devices.length" id="fpga-device" :value="studio.selectedDeviceId" @change="chooseDevice">
        <option value="">Choose a device</option>
        <option v-for="device in studio.hardwareScan.devices" :key="device.device_id" :value="device.device_id">
          {{ device.name }} — {{ device.part || 'no part' }} — {{ device.target }}{{ device.matches_part ? '' : ' — part does not match' }}
        </option>
      </select>
      <label v-if="selectedDevice && !openSource" class="check">
        <input v-model="studio.programConfirm" type="checkbox" />
        Program only {{ selectedDevice.name }} on {{ 'target' in selectedDevice ? selectedDevice.target : selectedDevice.name }}
      </label>
      <div class="actions">
        <button type="button" :disabled="!canProgram" @click="studio.programDevice()">Program selected device</button>
      </div>
      <p v-if="studio.hardwareProgram?.mock">Mock test. The FPGA was not programmed.</p>
      <p v-else-if="studio.hardwareProgram?.programmed">Programmed {{ studio.hardwareProgram.device_name }} on {{ studio.hardwareProgram.target }}.</p>
      <p v-else-if="studio.hardwareProgram">{{ studio.hardwareProgram.message }}</p>
    </section>
    <section v-if="studio.fpgaComparison">
      <h3>Toolchain comparison</h3>
      <p class="hint">{{ studio.fpgaComparison.timing_note }} {{ studio.fpgaComparison.resource_note }} The rows below are the latest passed bitstream of each toolchain. A hardware result names the build and the hash that were programmed.</p>
      <article v-if="studio.fpgaComparison.vivado">
        <h4>Vivado {{ studio.fpgaComparison.vivado.build_id }}</h4>
        <p>Part {{ studio.fpgaComparison.vivado.part }}. VHDL-{{ studio.fpgaComparison.vivado.vhdl_standard }}. Duration {{ studio.fpgaComparison.vivado.elapsed_seconds ?? 'not reported' }} s.</p>
        <p>
          Resources: Slice LUTs {{ studio.fpgaComparison.vivado.resources.slice_luts ?? 'not reported' }},
          registers {{ studio.fpgaComparison.vivado.resources.slice_registers ?? 'not reported' }},
          CARRY4 {{ studio.fpgaComparison.vivado.resources.carry4 ?? 'not reported' }}.
          Timing: WNS {{ studio.fpgaComparison.vivado.timing.wns_ns ?? 'not reported' }} ns,
          WHS {{ studio.fpgaComparison.vivado.timing.whs_ns ?? 'not reported' }} ns ({{ studio.fpgaComparison.vivado.timing.method }}).
        </p>
        <p>Warnings: {{ studio.fpgaComparison.vivado.warnings.length }}.</p>
        <p class="mono">{{ studio.fpgaComparison.vivado.bitstream_sha256 || 'no bitstream hash' }}</p>
        <p>
          Build passed {{ flag(studio.fpgaComparison.vivado.validation.build_passed) }}.
          JTAG detected {{ flag(studio.fpgaComparison.vivado.validation.jtag_detected) }}.
          Programming completed {{ flag(studio.fpgaComparison.vivado.validation.programming_completed) }}.
          Hardware function verified {{ flag(studio.fpgaComparison.vivado.validation.hardware_function_verified) }}.
        </p>
      </article>
      <article v-if="studio.fpgaComparison.opensource">
        <h4>Open Source {{ studio.fpgaComparison.opensource.build_id }}</h4>
        <p>Part {{ studio.fpgaComparison.opensource.part }}. VHDL-{{ studio.fpgaComparison.opensource.vhdl_standard }}. Duration {{ studio.fpgaComparison.opensource.elapsed_seconds ?? 'not reported' }} s.</p>
        <p>
          Resources: SLICE_LUTX {{ studio.fpgaComparison.opensource.resources.slice_lutx ?? 'not reported' }},
          SLICE_FFX {{ studio.fpgaComparison.opensource.resources.slice_ffx ?? 'not reported' }},
          CARRY4 {{ studio.fpgaComparison.opensource.resources.carry4 ?? 'not reported' }}.
          Timing: critical path {{ studio.fpgaComparison.opensource.timing.critical_path_ns ?? 'not reported' }} ns
          ({{ studio.fpgaComparison.opensource.timing.method }}).
        </p>
        <p>Warnings: {{ studio.fpgaComparison.opensource.warnings.length }}.</p>
        <p class="mono">{{ studio.fpgaComparison.opensource.bitstream_sha256 || 'no bitstream hash' }}</p>
        <p>
          Build passed {{ flag(studio.fpgaComparison.opensource.validation.build_passed) }}.
          JTAG detected {{ flag(studio.fpgaComparison.opensource.validation.jtag_detected) }}.
          Programming completed {{ flag(studio.fpgaComparison.opensource.validation.programming_completed) }}.
          Hardware function verified {{ flag(studio.fpgaComparison.opensource.validation.hardware_function_verified) }}.
        </p>
      </article>
      <h4>Recorded hardware results</h4>
      <ul>
        <li v-for="item in studio.fpgaComparison.validations" :key="item.validation_id">
          {{ item.toolchain }} {{ item.build_id || 'no build' }}
          {{ item.bitstream_sha256 || 'no bitstream hash' }}.
          Build {{ flag(item.build_passed) }}, JTAG {{ flag(item.jtag_detected) }},
          programming {{ flag(item.programming_completed) }}, function {{ flag(item.hardware_function_verified) }}.
          {{ item.bitstream_sha256 ? (item.file_present ? 'Bitstream file present.' : 'Bitstream file is not in the workspace.') : 'No bitstream was loaded.' }}
          {{ item.evidence }}
        </li>
      </ul>
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
