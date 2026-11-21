import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { DesignUnit, DiagramDocument, Health, Library, ProjectFile, SourceText } from '../models/design'
import type { EditableDiagram, EditableSummary } from '../models/editable'
import { createDesign, createEditableDiagram, getBoards, getEditableDiagram, getExamplesPath, getHealth, getProject, getSource, getUiSettings, listEditableDiagrams, saveEditableDiagram, saveUiSettings, scanLibrary } from '../services/api'
import type { BoardProfile } from '../services/api'

export const useStudioStore = defineStore('studio', () => {
  const health = ref<Health | null>(null)
  const healthError = ref('')
  const project = ref<ProjectFile | null>(null)
  const selectedUnitId = ref<string | null>(null)
  const selectedDiagramId = ref<string | null>(null)
  const tab = ref<'symbol' | 'source' | 'diagram'>('symbol')
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
  const uiReady = ref(false)
  const editable = ref<EditableDiagram | null>(null)
  const editing = ref(false)
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

  async function loadProject(): Promise<void> {
    project.value = await getProject()
    await refreshDesigns()
    if (!selectedUnitId.value) {
      const entity = units.value.find((unit) => unit.kind === 'entity')
      if (entity) await selectUnit(entity.id)
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

  watch([libraryPath, libraryName, includeSideData, boardId, hierarchyRootId], rememberLibraryForm)

  async function scan(path: string, libraryName: string, includeSideData = false): Promise<void> {
    busy.value = true
    error.value = ''
    try {
      project.value = await scanLibrary(path, libraryName, includeSideData)
      const entity = units.value.find((unit) => unit.kind === 'entity')
      if (entity) await selectUnit(entity.id)
      const block =
        diagrams.value.find((diagram) => diagram.source_path.endsWith('audio_gain/struct.bd')) ??
        diagrams.value.find((diagram) => diagram.view === 'block')
      if (block) selectDiagram(block.id)
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

  function selectDiagram(diagramId: string): void {
    selectedDiagramId.value = diagramId
    editing.value = false
    tab.value = 'diagram'
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
    if (editable.value?.provenance.source_diagram_id === id) {
      editing.value = true
      tab.value = 'diagram'
      return
    }
    if (!confirmDirty('The open diagram has unsaved changes. Open another copy anyway?')) return
    hierarchy.value = []
    error.value = ''
    try {
      editable.value = await createEditableDiagram(id)
      past.value = []
      future.value = []
      savedJson = JSON.stringify(editable.value)
      dirty.value = false
      selection.value = null
      editing.value = true
      tab.value = 'diagram'
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'The editable diagram could not be opened.'
    }
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

  function showOriginal(): void {
    editing.value = false
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
    toggleHierarchyRoot,
    unitsIn,
    diagramsIn,
    loadHealth,
    loadProject,
    loadUi,
    editable,
    editing,
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
    showOriginal,
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
