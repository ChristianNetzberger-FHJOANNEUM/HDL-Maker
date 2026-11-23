import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { DesignUnit, DiagramDocument, FpgaBuildConfig, Health, Library, ProjectFile, SimulationConfig, SourceText } from '../models/design'
import type { EditableDiagram, EditableSummary } from '../models/editable'
import { createDesign, createEditableDiagram, generateStructural, getBoards, getEditableDiagram, getExamplesPath, getHealth, cancelFpgaBuild, cancelSimulation, checkOpenSource, checkVivado, getFpgaBuild, getFpgaReport, getHardwareScan, getLatestBitstream, getLatestFpgaBuild, getLatestOpenBuild, getLatestSimulation, getOpenBuild, getOpenProgram, getOpenScan, getFpgaComparison, getOpenSourceTools, getProgram, getProject, getSimulationRun, getSource, getTools, getUiSettings, listEditableDiagrams, openWaveform, saveEditableDiagram, saveFpga, saveLibraryProfile, saveOpenSourceTools, saveSimulation, saveTools, saveUiSettings, saveVhdlStandard, scanLibrary, startFpgaBuild, startHardwareScan, startOpenBuild, startOpenProgram, startOpenScan, startProgram, startSimulation } from '../services/api'
import type { BoardProfile, FpgaBuild, FpgaComparison, GenerateResult, HwProgram, HwScan, OpenCheck, OpenProgram, OpenScan, OpenSourceBuild, OpenSourceTools, SimulationRun } from '../services/api'

function clampTextPx(value: number): number {
  if (!Number.isFinite(value)) return 13
  return Math.min(16, Math.max(8, Math.round(value)))
}

export const useStudioStore = defineStore('studio', () => {
  const health = ref<Health | null>(null)
  const healthError = ref('')
  const project = ref<ProjectFile | null>(null)
  const selectedUnitId = ref<string | null>(null)
  const selectedDiagramId = ref<string | null>(null)
  const tab = ref<'symbol' | 'source' | 'diagram' | 'simulation' | 'fpga' | 'preferences'>('symbol')
  const source = ref<SourceText | null>(null)
  const busy = ref(false)
  const error = ref('')
  const libraryPath = ref('')
  const libraryName = ref('demo')
  const includeSideData = ref(false)
  const boards = ref<BoardProfile[]>([])
  const boardId = ref('')
  const boardsLoaded = ref(false)
  const hierarchyRootId = ref('')
  const stateTextPx = ref(13)
  const portLabelStyle = ref<'short' | 'long'>('short')
  const vhdlStandard = ref<'93' | '2008'>('93')
  const libraryProfile = ref<'ieee' | 'synopsys'>('ieee')
  const simulation = ref<SimulationConfig>({
    testbench_unit_id: '',
    stop_time: '1us',
    waveform_format: 'ghw',
    generic_overrides: [],
    gtkw_path: '',
  })
  const fpga = ref<FpgaBuildConfig>({
    top_unit_id: '',
    board_id: '',
    part: '',
    xdc_paths: [],
    target: 'synthesis',
    toolchain: 'vivado',
  })
  const fpgaBuild = ref<FpgaBuild | null>(null)
  const openBuild = ref<OpenSourceBuild | null>(null)
  const openCheck = ref<OpenCheck | null>(null)
  const openTools = ref<OpenSourceTools | null>(null)
  const openLoaderPath = ref('')
  const jtagSerial = ref('')
  const fpgaBitstream = ref<FpgaBuild | OpenSourceBuild | null>(null)
  const hardwareScan = ref<HwScan | null>(null)
  const hardwareProgram = ref<HwProgram | null>(null)
  const openScan = ref<OpenScan | null>(null)
  const openProgram = ref<OpenProgram | null>(null)
  const fpgaComparison = ref<FpgaComparison | null>(null)
  const selectedDeviceId = ref('')
  const programConfirm = ref(false)
  const fpgaNote = ref('')
  const fpgaReport = ref('')
  const gtkwavePath = ref('')
  const vivadoPath = ref('')
  const vivadoNote = ref('')
  const simulationRun = ref<SimulationRun | null>(null)
  const simulationNote = ref('')
  const generation = ref<GenerateResult | null>(null)
  let simulationPoll = 0
  let fpgaPoll = 0
  let hardwarePoll = 0
  const uiReady = ref(false)
  const editable = ref<EditableDiagram | null>(null)
  const editing = ref(false)
  const diagramBusy = ref(false)
  const openingDiagrams = new Map<string, Promise<void>>()
  const dirty = ref(false)
  const selection = ref<{ kind: string; id: string } | null>(null)
  const past = ref<string[]>([])
  const future = ref<string[]>([])
  const designs = ref<EditableSummary[]>([])
  const hierarchy = ref<{ id: string; name: string }[]>([])
  let uiTimer = 0
  let changing = false
  let savedJson = ''

  const units = computed(() => project.value?.design_units ?? [])
  const diagrams = computed(() => project.value?.diagrams ?? [])
  const selectedUnit = computed(
    () => units.value.find((unit) => unit.id === selectedUnitId.value) ?? null,
  )
  const selectedDiagram = computed(
    () => diagrams.value.find((diagram) => diagram.id === selectedDiagramId.value) ?? null,
  )
  const symbolUnit = computed(() => entityFor(selectedUnit.value))
  const activeLibrary = computed(() => {
    const selected = selectedUnit.value
    const libraries = project.value?.libraries ?? []
    if (selected) {
      return libraries.find((library) => library.id === selected.library_id) ?? null
    }
    return libraries.at(-1) ?? null
  })

  function entityFor(unit: DesignUnit | null): DesignUnit | null {
    if (!unit) return null
    if (unit.kind === 'entity') return unit
    if (unit.kind !== 'architecture' || !unit.parent_name) return null
    const parent = unit.parent_name.toLowerCase()
    return (
      units.value.find(
        (candidate) =>
          candidate.kind === 'entity' &&
          candidate.library_id === unit.library_id &&
          candidate.name.toLowerCase() === parent,
      ) ?? null
    )
  }

  async function loadHealth(): Promise<void> {
    try {
      health.value = await getHealth()
      healthError.value = ''
    } catch (reason) {
      health.value = null
      healthError.value = reason instanceof Error ? reason.message : 'Backend is not reachable.'
    }
  }

  function applyProject(next: ProjectFile): void {
    project.value = next
    vhdlStandard.value = next.vhdl_standard === '2008' ? '2008' : '93'
    libraryProfile.value = next.library_profile === 'synopsys' ? 'synopsys' : 'ieee'
    const stored = next.simulation
    simulation.value = {
      testbench_unit_id: stored?.testbench_unit_id ?? '',
      stop_time: stored?.stop_time || '1us',
      waveform_format: stored?.waveform_format === 'vcd' ? 'vcd' : 'ghw',
      generic_overrides: (stored?.generic_overrides ?? []).map((item) => ({ name: item.name, value: item.value })),
      gtkw_path: stored?.gtkw_path ?? '',
    }
    const storedFpga = next.fpga
    fpga.value = {
      top_unit_id: storedFpga?.top_unit_id ?? '',
      board_id: storedFpga?.board_id ?? '',
      part: storedFpga?.part ?? '',
      xdc_paths: [...(storedFpga?.xdc_paths ?? [])],
      target: storedFpga?.target === 'bitstream' ? 'bitstream' : 'synthesis',
      toolchain: storedFpga?.toolchain === 'opensource' ? 'opensource' : 'vivado',
    }
  }

  async function loadProject(): Promise<void> {
    applyProject(await getProject())
    try {
      simulationRun.value = await getLatestSimulation()
    } catch {
      simulationRun.value = null
    }
    try {
      if (fpga.value.toolchain === 'opensource') {
        openBuild.value = await getLatestOpenBuild()
        fpgaBitstream.value = openBuild.value?.status === 'passed' && openBuild.value.bitstream_path ? openBuild.value : null
      } else {
        fpgaBuild.value = await getLatestFpgaBuild()
      }
    } catch {
      fpgaBuild.value = null
      openBuild.value = null
    }
    await refreshDesigns()
    if (!selectedUnitId.value) {
      const entity = units.value.find((unit) => unit.kind === 'entity')
      if (entity) await selectUnit(entity.id)
    }
  }

  async function loadTools(): Promise<void> {
    try {
      const tools = await getTools()
      gtkwavePath.value = tools.gtkwave_path
      vivadoPath.value = tools.vivado_path
    } catch {
      gtkwavePath.value = ''
      vivadoPath.value = ''
    }
    try {
      openTools.value = await getOpenSourceTools()
      openLoaderPath.value = openTools.value.openfpga_loader_path
    } catch {
      openTools.value = null
      openLoaderPath.value = ''
    }
  }

  function toolPayload() {
    return { gtkwave_path: gtkwavePath.value.trim(), vivado_path: vivadoPath.value.trim() }
  }

  async function saveGtkwavePath(): Promise<void> {
    try {
      const saved = await saveTools(toolPayload())
      gtkwavePath.value = saved.gtkwave_path
      vivadoPath.value = saved.vivado_path
      await loadHealth()
      error.value = ''
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'The GTKWave path could not be saved.'
    }
  }

  async function saveVivadoPath(): Promise<void> {
    try {
      const saved = await saveTools(toolPayload())
      gtkwavePath.value = saved.gtkwave_path
      vivadoPath.value = saved.vivado_path
      await loadHealth()
      vivadoNote.value = ''
      error.value = ''
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'The Vivado path could not be saved.'
    }
  }

  async function checkVivadoInstall(): Promise<void> {
    await saveVivadoPath()
    vivadoNote.value = 'Checking Vivado…'
    try {
      const result = await checkVivado()
      vivadoNote.value = result.message
    } catch (reason) {
      vivadoNote.value = reason instanceof Error ? reason.message : 'Vivado could not be checked.'
    }
  }

  async function saveFpgaSettings(): Promise<void> {
    try {
      applyProject(await saveFpga({ ...fpga.value, xdc_paths: fpga.value.xdc_paths.map((item) => item.trim()).filter((item) => item) }))
      fpgaNote.value = ''
      if (fpga.value.toolchain === 'opensource') {
        openBuild.value = await getLatestOpenBuild()
        fpgaBitstream.value = openBuild.value?.status === 'passed' && openBuild.value.bitstream_path ? openBuild.value : null
      } else {
        fpgaBuild.value = await getLatestFpgaBuild()
        await refreshHardware()
      }
    } catch (reason) {
      fpgaNote.value = reason instanceof Error ? reason.message : 'The FPGA settings could not be saved.'
    }
  }

  function scheduleFpgaPoll(): void {
    window.clearTimeout(fpgaPoll)
    fpgaPoll = window.setTimeout(async () => {
      const current = fpgaBuild.value
      if (!current || current.status !== 'running') return
      try {
        fpgaBuild.value = await getFpgaBuild(current.build_id)
      } catch {
        return
      }
      if (fpgaBuild.value.status === 'running') scheduleFpgaPoll()
    }, 1000)
  }

  async function runFpga(target: 'synthesis' | 'bitstream'): Promise<void> {
    fpga.value.target = target
    await saveFpgaSettings()
    fpgaNote.value = target === 'bitstream' ? 'Starting the bitstream build.' : 'Starting synthesis.'
    fpgaReport.value = ''
    try {
      fpgaBuild.value = await startFpgaBuild()
      if (fpgaBuild.value.status === 'running') scheduleFpgaPoll()
      else fpgaNote.value = fpgaBuild.value.diagnostics[0]?.message || 'The build did not start.'
    } catch (reason) {
      fpgaNote.value = reason instanceof Error ? reason.message : 'The FPGA build could not be started.'
    }
  }

  async function cancelFpga(): Promise<void> {
    const current = fpgaBuild.value
    if (!current || current.status !== 'running') return
    try {
      await cancelFpgaBuild(current.build_id)
      fpgaNote.value = 'Cancelling the Vivado build.'
    } catch (reason) {
      fpgaNote.value = reason instanceof Error ? reason.message : 'The build could not be cancelled.'
    }
  }

  async function loadComparison(): Promise<void> {
    try {
      fpgaComparison.value = await getFpgaComparison()
    } catch {
      fpgaComparison.value = null
    }
  }

  async function refreshHardware(): Promise<void> {
    if (fpga.value.toolchain === 'opensource') {
      fpgaBitstream.value = openBuild.value?.status === 'passed' && openBuild.value.bitstream_path ? openBuild.value : null
      return
    }
    try {
      fpgaBitstream.value = await getLatestBitstream()
    } catch {
      fpgaBitstream.value = null
    }
  }

  function scheduleHardwarePoll(): void {
    window.clearTimeout(hardwarePoll)
    hardwarePoll = window.setTimeout(async () => {
      const scan = hardwareScan.value
      const program = hardwareProgram.value
      try {
        if (scan?.status === 'running') hardwareScan.value = await getHardwareScan(scan.scan_id)
        if (program?.status === 'running') hardwareProgram.value = await getProgram(program.program_id)
      } catch {
        return
      }
      if (hardwareScan.value?.status === 'running' || hardwareProgram.value?.status === 'running') scheduleHardwarePoll()
    }, 1000)
  }

  async function scanHardware(): Promise<void> {
    fpgaNote.value = 'Scanning JTAG targets.'
    selectedDeviceId.value = ''
    programConfirm.value = false
    try {
      hardwareScan.value = await startHardwareScan()
      if (hardwareScan.value.status === 'running') scheduleHardwarePoll()
      else fpgaNote.value = hardwareScan.value.message
    } catch (reason) {
      fpgaNote.value = reason instanceof Error ? reason.message : 'The hardware scan could not be started.'
    }
  }

  async function programDevice(): Promise<void> {
    const scan = hardwareScan.value
    const bitstream = fpgaBitstream.value
    if (!scan || !bitstream || !selectedDeviceId.value || !programConfirm.value) {
      fpgaNote.value = 'Choose one device and confirm it before programming.'
      return
    }
    fpgaNote.value = 'Programming the selected device.'
    try {
      hardwareProgram.value = await startProgram({
        scan_id: scan.scan_id,
        device_id: selectedDeviceId.value,
        build_id: bitstream.build_id,
        confirm: true,
      })
      if (hardwareProgram.value.status === 'running') scheduleHardwarePoll()
      else fpgaNote.value = hardwareProgram.value.message
    } catch (reason) {
      fpgaNote.value = reason instanceof Error ? reason.message : 'Programming could not be started.'
    }
  }

  async function saveOpenLoaderPath(): Promise<void> {
    if (!openTools.value) {
      try {
        openTools.value = await getOpenSourceTools()
      } catch (reason) {
        fpgaNote.value = reason instanceof Error ? reason.message : 'The open-source tool settings could not be read.'
        return
      }
    }
    const current = openTools.value
    if (!current) return
    try {
      openTools.value = await saveOpenSourceTools({ ...current, openfpga_loader_path: openLoaderPath.value.trim() })
      openLoaderPath.value = openTools.value.openfpga_loader_path
      fpgaNote.value = ''
    } catch (reason) {
      fpgaNote.value = reason instanceof Error ? reason.message : 'The openFPGALoader path could not be saved.'
    }
  }

  async function checkOpenToolchain(): Promise<void> {
    fpgaNote.value = 'Checking the open-source tools.'
    try {
      openCheck.value = await checkOpenSource()
      fpgaNote.value = openCheck.value.ok ? 'The five tools and the zynq7 database are available.' : 'One or more open-source tools are missing. Vivado was not called.'
    } catch (reason) {
      fpgaNote.value = reason instanceof Error ? reason.message : 'The open-source tools could not be checked.'
    }
  }

  async function runOpenBuild(): Promise<void> {
    if (vhdlStandard.value === '2008') {
      fpgaNote.value = 'The open-source chain was validated for VHDL-93 only. VHDL-2008 was not run, and the VHDL-93 setting was not changed.'
      return
    }
    fpga.value.toolchain = 'opensource'
    fpga.value.target = 'bitstream'
    await saveFpgaSettings()
    fpgaNote.value = 'Starting the open-source bitstream build.'
    try {
      openBuild.value = await startOpenBuild()
      if (openBuild.value.status === 'running') scheduleOpenPoll()
      else fpgaNote.value = openBuild.value.diagnostics[0]?.message || 'The open-source build did not start.'
      if (openBuild.value.status === 'passed' && openBuild.value.bitstream_path) fpgaBitstream.value = openBuild.value
    } catch (reason) {
      fpgaNote.value = reason instanceof Error ? reason.message : 'The open-source build could not be started.'
    }
  }

  function scheduleOpenPoll(): void {
    window.clearTimeout(fpgaPoll)
    fpgaPoll = window.setTimeout(async () => {
      const current = openBuild.value
      if (!current || current.status !== 'running') return
      try {
        openBuild.value = await getOpenBuild(current.build_id)
      } catch {
        return
      }
      if (openBuild.value.status === 'running') scheduleOpenPoll()
      else if (openBuild.value.status === 'passed' && openBuild.value.bitstream_path) fpgaBitstream.value = openBuild.value
    }, 1000)
  }

  async function scanOpenHardware(): Promise<void> {
    fpgaNote.value = 'Scanning the named JTAG serial.'
    selectedDeviceId.value = ''
    programConfirm.value = false
    try {
      openScan.value = await startOpenScan(jtagSerial.value.trim())
      if (openScan.value.status === 'running') scheduleOpenHardwarePoll()
      else fpgaNote.value = openScan.value.message
    } catch (reason) {
      fpgaNote.value = reason instanceof Error ? reason.message : 'The JTAG scan could not be started.'
    }
  }

  function scheduleOpenHardwarePoll(): void {
    window.clearTimeout(hardwarePoll)
    hardwarePoll = window.setTimeout(async () => {
      const scan = openScan.value
      const program = openProgram.value
      try {
        if (scan?.status === 'running') openScan.value = await getOpenScan(scan.scan_id)
        if (program?.status === 'running') openProgram.value = await getOpenProgram(program.program_id)
      } catch {
        return
      }
      if (openScan.value?.status === 'running' || openProgram.value?.status === 'running') scheduleOpenHardwarePoll()
    }, 1000)
  }

  async function programOpenDevice(): Promise<void> {
    const scan = openScan.value
    const bitstream = openBuild.value
    if (!scan || !bitstream || !selectedDeviceId.value || !programConfirm.value) {
      fpgaNote.value = 'Choose the FPGA and confirm the SRAM download before programming.'
      return
    }
    fpgaNote.value = 'Programming SRAM on the selected device.'
    try {
      openProgram.value = await startOpenProgram({
        scan_id: scan.scan_id,
        device_id: selectedDeviceId.value,
        build_id: bitstream.build_id,
        confirm: true,
      })
      if (openProgram.value.status === 'running') scheduleOpenHardwarePoll()
      else fpgaNote.value = openProgram.value.message
    } catch (reason) {
      fpgaNote.value = reason instanceof Error ? reason.message : 'SRAM programming could not be started.'
    }
  }

  async function openFpgaReport(name: string): Promise<void> {
    const current = fpgaBuild.value
    if (!current) return
    try {
      fpgaReport.value = (await getFpgaReport(current.build_id, name)).text
    } catch (reason) {
      fpgaReport.value = reason instanceof Error ? reason.message : 'The report could not be opened.'
    }
  }

  async function loadUi(): Promise<void> {
    uiReady.value = false
    try {
      const settings = await getUiSettings()
      libraryPath.value = settings.library_path
      libraryName.value = settings.library_name || 'demo'
      includeSideData.value = settings.include_side_data
      boardId.value = settings.board_id || ''
      hierarchyRootId.value = settings.hierarchy_root_id || ''
      stateTextPx.value = clampTextPx(settings.state_text_px)
      portLabelStyle.value = settings.port_label_style === 'long' ? 'long' : 'short'
      const catalog = await getBoards()
      boards.value = catalog.boards
      boardsLoaded.value = true
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'The saved library path could not be read.'
    }
    if (!libraryPath.value.trim()) {
      const last = project.value?.libraries.at(-1)
      if (last) {
        libraryPath.value = last.root_path
        libraryName.value = last.name
      }
    }
    uiReady.value = true
  }

  function rememberLibraryForm(): void {
    if (!uiReady.value) return
    window.clearTimeout(uiTimer)
    uiTimer = window.setTimeout(() => {
      void saveUiSettings({
        library_path: libraryPath.value,
        library_name: libraryName.value,
        include_side_data: includeSideData.value,
        board_id: boardId.value,
        hierarchy_root_id: hierarchyRootId.value,
        state_text_px: stateTextPx.value,
        port_label_style: portLabelStyle.value,
      }).catch((reason: unknown) => {
        error.value = reason instanceof Error ? reason.message : 'The library path could not be saved.'
      })
    }, 300)
  }

  const boardMissing = computed(
    () => boardsLoaded.value && boardId.value !== '' && !boards.value.some((board) => board.id === boardId.value),
  )

  function toggleHierarchyRoot(unitId: string): void {
    hierarchyRootId.value = hierarchyRootId.value === unitId ? '' : unitId
  }

  function setStateTextPx(value: number): void {
    stateTextPx.value = clampTextPx(value)
  }

  function setPortLabelStyle(value: 'short' | 'long'): void {
    portLabelStyle.value = value
  }

  async function setVhdlStandard(value: '93' | '2008'): Promise<void> {
    if (value === vhdlStandard.value) return
    try {
      applyProject(await saveVhdlStandard(value))
      error.value = ''
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'The VHDL standard could not be saved.'
    }
  }

  function stopTimeValid(value: string): boolean {
    const match = /^(\d+(?:\.\d+)?)(fs|ps|ns|us|ms|sec|min|hr)$/.exec(value)
    return match !== null && Number(match[1]) > 0
  }

  async function saveSimulationSettings(): Promise<void> {
    if (!stopTimeValid(simulation.value.stop_time)) {
      simulationNote.value = 'Stop time must be a positive number and a unit, such as 1us.'
      return
    }
    try {
      applyProject(await saveSimulation({ ...simulation.value, generic_overrides: simulation.value.generic_overrides.filter((item) => item.name) }))
      simulationNote.value = ''
    } catch (reason) {
      simulationNote.value = reason instanceof Error ? reason.message : 'The simulation settings could not be saved.'
    }
  }

  async function runSimulation(): Promise<void> {
    await saveSimulationSettings()
    if (simulationNote.value) return
    try {
      simulationRun.value = await startSimulation()
      simulationNote.value = ''
      if (simulationRun.value.status === 'running') scheduleSimulationPoll()
    } catch (reason) {
      simulationNote.value = reason instanceof Error ? reason.message : 'The simulation could not be started.'
    }
  }

  function scheduleSimulationPoll(): void {
    window.clearTimeout(simulationPoll)
    simulationPoll = window.setTimeout(async () => {
      const current = simulationRun.value
      if (!current || current.status !== 'running') return
      try {
        simulationRun.value = await getSimulationRun(current.run_id)
      } catch (reason) {
        simulationNote.value = reason instanceof Error ? reason.message : 'The simulation status could not be read.'
        return
      }
      if (simulationRun.value.status === 'running') scheduleSimulationPoll()
    }, 400)
  }

  async function cancelRunningSimulation(): Promise<void> {
    const current = simulationRun.value
    if (!current || current.status !== 'running') return
    try {
      await cancelSimulation(current.run_id)
      simulationNote.value = 'Cancelling the simulation.'
    } catch (reason) {
      simulationNote.value = reason instanceof Error ? reason.message : 'The simulation could not be cancelled.'
    }
  }

  async function showWaveform(): Promise<void> {
    const current = simulationRun.value
    if (!current) return
    try {
      const opened = await openWaveform(current.run_id)
      simulationNote.value = opened.message
    } catch (reason) {
      simulationNote.value = reason instanceof Error ? reason.message : 'The waveform could not be opened.'
    }
  }

  async function setLibraryProfile(value: 'ieee' | 'synopsys'): Promise<void> {
    if (value === libraryProfile.value) return
    try {
      applyProject(await saveLibraryProfile(value))
      error.value = ''
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'The GHDL library compatibility could not be saved.'
    }
  }

  async function generateHdl(): Promise<void> {
    const diagram = editable.value
    if (!editing.value || diagram === null || diagram.kind !== 'block') {
      error.value = 'Open a block diagram to generate structural VHDL.'
      return
    }
    busy.value = true
    error.value = ''
    try {
      generation.value = await generateStructural(diagram.id)
    } catch (reason) {
      generation.value = null
      error.value = reason instanceof Error ? reason.message : 'VHDL generation failed.'
    } finally {
      busy.value = false
    }
  }

  watch([libraryPath, libraryName, includeSideData, boardId, hierarchyRootId, stateTextPx, portLabelStyle], rememberLibraryForm)

  async function scan(path: string, libraryName: string, includeSideData = false): Promise<void> {
    busy.value = true
    error.value = ''
    try {
      applyProject(await scanLibrary(path, libraryName, includeSideData))
      const entity = units.value.find((unit) => unit.kind === 'entity')
      if (entity) await selectUnit(entity.id)
      const block =
        diagrams.value.find((diagram) => diagram.source_path.endsWith('audio_gain/struct.bd')) ??
        diagrams.value.find((diagram) => diagram.view === 'block')
      if (block) await selectDiagram(block.id)
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'The library scan failed.'
    } finally {
      busy.value = false
    }
  }

  async function scanExamples(): Promise<string> {
    const path = await getExamplesPath()
    await scan(path, 'demo')
    return path
  }

  async function selectUnit(unitId: string): Promise<void> {
    selectedUnitId.value = unitId
    if (tab.value === 'diagram') tab.value = 'symbol'
    source.value = null
    try {
      source.value = await getSource(unitId)
      error.value = ''
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'The source file could not be read.'
    }
  }

  const diagramStatus = computed(() => {
    if (diagramBusy.value) return 'Opening the diagram…'
    const diagram = selectedDiagram.value
    if (!diagram) return 'Select a diagram in the library tree.'
    if (diagram.view !== 'block' && diagram.view !== 'state') return 'This file is not a block or state diagram.'
    if (!editing.value) return error.value || 'The diagram could not be opened.'
    return ''
  })

  function selectDiagram(diagramId: string): Promise<void> {
    const pending = openingDiagrams.get(diagramId)
    if (pending) {
      selectedDiagramId.value = diagramId
      tab.value = 'diagram'
      return pending
    }
    const task = openImportedDiagram(diagramId)
    openingDiagrams.set(diagramId, task)
    void task.finally(() => {
      if (openingDiagrams.get(diagramId) === task) openingDiagrams.delete(diagramId)
    })
    return task
  }

  async function openImportedDiagram(diagramId: string): Promise<void> {
    const diagram = diagrams.value.find((item) => item.id === diagramId) ?? null
    if (editable.value?.provenance.source_diagram_id === diagramId && editing.value) {
      selectedDiagramId.value = diagramId
      tab.value = 'diagram'
      return
    }
    if (!confirmDirty('The open diagram has unsaved changes. Open this diagram anyway?')) return
    const previousSelection = selectedDiagramId.value
    const previousHierarchy = hierarchy.value
    const wasEditing = editing.value
    selectedDiagramId.value = diagramId
    tab.value = 'diagram'
    hierarchy.value = []
    if (!diagram || (diagram.view !== 'block' && diagram.view !== 'state')) {
      editing.value = false
      return
    }
    error.value = ''
    diagramBusy.value = true
    editing.value = false
    try {
      const doc = await createEditableDiagram(diagramId)
      if (selectedDiagramId.value !== diagramId) return
      editable.value = doc
      past.value = []
      future.value = []
      savedJson = JSON.stringify(doc)
      dirty.value = false
      selection.value = null
      editing.value = true
      await refreshDesigns()
    } catch (reason) {
      if (selectedDiagramId.value === diagramId) {
        selectedDiagramId.value = previousSelection
        hierarchy.value = previousHierarchy
        editing.value = wasEditing
        error.value = reason instanceof Error ? reason.message : 'The diagram could not be opened.'
      }
    } finally {
      diagramBusy.value = false
    }
  }

  function commit(): void {
    if (!editable.value) return
    past.value.push(JSON.stringify(editable.value))
    if (past.value.length > 40) past.value.shift()
    future.value = []
    dirty.value = true
  }

  function beginChange(): void {
    if (changing) return
    commit()
    changing = true
  }

  function endChange(): void {
    changing = false
  }

  function syncDirty(): void {
    dirty.value = JSON.stringify(editable.value) !== savedJson
  }

  function undo(): void {
    if (!past.value.length || !editable.value) return
    future.value.push(JSON.stringify(editable.value))
    editable.value = JSON.parse(past.value.pop() as string) as EditableDiagram
    syncDirty()
  }

  function redo(): void {
    if (!future.value.length || !editable.value) return
    past.value.push(JSON.stringify(editable.value))
    editable.value = JSON.parse(future.value.pop() as string) as EditableDiagram
    syncDirty()
  }

  async function openEditable(sourceId?: string): Promise<void> {
    const id = sourceId ?? selectedDiagramId.value
    if (!id) return
    await selectDiagram(id)
  }

  async function saveEditable(): Promise<void> {
    if (!editable.value) return
    error.value = ''
    try {
      const saved = await saveEditableDiagram(editable.value)
      const history = past.value
      const ahead = future.value
      editable.value = saved
      past.value = history
      future.value = ahead
      savedJson = JSON.stringify(saved)
      dirty.value = false
      await refreshDesigns()
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'The diagram could not be saved.'
    }
  }

  function confirmDirty(message: string): boolean {
    return !dirty.value || window.confirm(message)
  }

  async function refreshDesigns(): Promise<void> {
    try {
      designs.value = await listEditableDiagrams()
    } catch (reason) {
      designs.value = []
      error.value = reason instanceof Error ? reason.message : 'The workspace designs could not be listed.'
    }
  }

  function designsFor(libraryId: string): EditableSummary[] {
    return designs.value.filter((design) => design.library_id === libraryId)
  }

  async function loadDesign(id: string): Promise<void> {
    const doc = await getEditableDiagram(id)
    editable.value = doc
    past.value = []
    future.value = []
    savedJson = JSON.stringify(doc)
    dirty.value = false
    selection.value = null
    editing.value = true
    tab.value = 'diagram'
    error.value = ''
  }

  async function createWorkspaceDesign(name: string, libraryId: string): Promise<void> {
    if (!confirmDirty('The open diagram has unsaved changes. Create a new design anyway?')) return
    error.value = ''
    try {
      const created = await createDesign(name, libraryId)
      hierarchy.value = []
      editable.value = created
      past.value = []
      future.value = []
      savedJson = JSON.stringify(created)
      dirty.value = false
      selection.value = null
      editing.value = true
      tab.value = 'diagram'
      await refreshDesigns()
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'The design could not be created.'
    }
  }

  async function openDesign(id: string): Promise<void> {
    if (editable.value?.id === id && editing.value) {
      tab.value = 'diagram'
      return
    }
    if (!confirmDirty('The open diagram has unsaved changes. Open another design anyway?')) return
    hierarchy.value = []
    try {
      await loadDesign(id)
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'The design could not be opened.'
    }
  }

  async function openChildDiagram(childId: string): Promise<void> {
    const current = editable.value
    if (!current) return
    if (!confirmDirty('The open diagram has unsaved changes. Open the design inside this instance anyway?')) return
    const parent = { id: current.id, name: current.name }
    hierarchy.value = [...hierarchy.value, parent]
    try {
      await loadDesign(childId)
    } catch (reason) {
      hierarchy.value = hierarchy.value.slice(0, -1)
      error.value = reason instanceof Error ? reason.message : 'The design inside this instance could not be opened.'
    }
  }

  async function backToParent(): Promise<void> {
    const parent = hierarchy.value.at(-1)
    if (!parent) return
    if (!confirmDirty('The open diagram has unsaved changes. Return to the parent design anyway?')) return
    hierarchy.value = hierarchy.value.slice(0, -1)
    try {
      await loadDesign(parent.id)
    } catch (reason) {
      hierarchy.value = [...hierarchy.value, parent]
      error.value = reason instanceof Error ? reason.message : 'The parent design could not be opened.'
    }
  }

  async function canInstantiate(childId: string): Promise<boolean> {
    const current = editable.value
    if (!current) return false
    if (childId === current.id || hierarchy.value.some((item) => item.id === childId)) {
      error.value = 'That design is already above this one. The reference was not added.'
      return false
    }
    if (await reaches(childId, current.id, new Set())) {
      error.value = 'That design already refers to this diagram. The reference was not added.'
      return false
    }
    error.value = ''
    return true
  }

  async function reaches(diagramId: string, targetId: string, seen: Set<string>): Promise<boolean> {
    if (diagramId === targetId) return true
    if (seen.has(diagramId)) return false
    seen.add(diagramId)
    let doc: EditableDiagram
    try {
      doc = diagramId === editable.value?.id && editable.value ? editable.value : await getEditableDiagram(diagramId)
    } catch {
      return false
    }
    for (const instance of doc.instances) {
      if (instance.child_diagram_id && (await reaches(instance.child_diagram_id, targetId, seen))) return true
    }
    return false
  }

  function diagramsIn(library: Library): DiagramDocument[] {
    return diagrams.value.filter((diagram) => diagram.library_id === library.id)
  }

  function unitsIn(library: Library): DesignUnit[] {
    return units.value.filter((unit) => unit.library_id === library.id)
  }

  return {
    health,
    healthError,
    project,
    selectedUnitId,
    selectedUnit,
    selectedDiagramId,
    selectedDiagram,
    symbolUnit,
    activeLibrary,
    tab,
    source,
    busy,
    error,
    libraryPath,
    libraryName,
    includeSideData,
    boards,
    boardId,
    boardMissing,
    hierarchyRootId,
    stateTextPx,
    setStateTextPx,
    portLabelStyle,
    setPortLabelStyle,
    vhdlStandard,
    libraryProfile,
    simulation,
    simulationRun,
    simulationNote,
    gtkwavePath,
    vivadoPath,
    vivadoNote,
    fpga,
    fpgaBuild,
    openBuild,
    openCheck,
    openLoaderPath,
    jtagSerial,
    fpgaBitstream,
    hardwareScan,
    hardwareProgram,
    openScan,
    openProgram,
    fpgaComparison,
    loadComparison,
    selectedDeviceId,
    programConfirm,
    fpgaNote,
    fpgaReport,
    loadTools,
    saveGtkwavePath,
    saveVivadoPath,
    checkVivadoInstall,
    saveFpgaSettings,
    runFpga,
    cancelFpga,
    checkOpenToolchain,
    saveOpenLoaderPath,
    runOpenBuild,
    scanOpenHardware,
    programOpenDevice,
    refreshHardware,
    scanHardware,
    programDevice,
    openFpgaReport,
    generation,
    setVhdlStandard,
    setLibraryProfile,
    saveSimulationSettings,
    runSimulation,
    cancelRunningSimulation,
    showWaveform,
    generateHdl,
    toggleHierarchyRoot,
    unitsIn,
    diagramsIn,
    loadHealth,
    loadProject,
    loadUi,
    editable,
    editing,
    diagramStatus,
    dirty,
    selection,
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
    commit,
    beginChange,
    endChange,
    undo,
    redo,
    openEditable,
    saveEditable,
    designs,
    hierarchy,
    designsFor,
    createWorkspaceDesign,
    openDesign,
    openChildDiagram,
    backToParent,
    canInstantiate,
    scan,
    scanExamples,
    selectUnit,
    selectDiagram,
  }
})
