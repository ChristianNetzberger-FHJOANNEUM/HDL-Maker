import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { DesignUnit, Health, Library, ProjectFile, SourceText } from '../models/design'
import { getExamplesPath, getHealth, getProject, getSource, scanLibrary } from '../services/api'

export const useStudioStore = defineStore('studio', () => {
  const health = ref<Health | null>(null)
  const healthError = ref('')
  const project = ref<ProjectFile | null>(null)
  const selectedUnitId = ref<string | null>(null)
  const tab = ref<'symbol' | 'source'>('symbol')
  const source = ref<SourceText | null>(null)
  const busy = ref(false)
  const error = ref('')

  const units = computed(() => project.value?.design_units ?? [])
  const selectedUnit = computed(
    () => units.value.find((unit) => unit.id === selectedUnitId.value) ?? null,
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
    if (!selectedUnitId.value) {
      const entity = units.value.find((unit) => unit.kind === 'entity')
      if (entity) await selectUnit(entity.id)
    }
  }

  async function scan(path: string, libraryName: string): Promise<void> {
    busy.value = true
    error.value = ''
    try {
      project.value = await scanLibrary(path, libraryName)
      const entity = units.value.find((unit) => unit.kind === 'entity')
      if (entity) await selectUnit(entity.id)
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
    source.value = null
    try {
      source.value = await getSource(unitId)
      error.value = ''
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'The source file could not be read.'
    }
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
    symbolUnit,
    activeLibrary,
    tab,
    source,
    busy,
    error,
    unitsIn,
    loadHealth,
    loadProject,
    scan,
    scanExamples,
    selectUnit,
  }
})
