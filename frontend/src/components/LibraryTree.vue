<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DesignUnit, FileEntry, Library } from '../models/design'
import type { BoardProfile } from '../services/api'
import { useStudioStore } from '../stores/studio'

const studio = useStudioStore()
const designName = ref('')
const designLibraryId = ref('')

const libraries = computed(() => studio.project?.libraries ?? [])

function boardLabel(board: BoardProfile): string {
  const revision = board.revisions.join(', ') || board.file_version
  const part = board.part_names.join(', ')
  const folder = board.id.replace(/\/board\.xml$/, '')
  return [board.display_name, revision, part, folder].filter((partOfLabel) => partOfLabel).join(' — ')
}

function diagramsOf(library: Library) {
  return studio.diagramsIn(library)
}

function entitiesOf(library: Library): { unit: DesignUnit; architectures: DesignUnit[] }[] {
  const units = studio.unitsIn(library)
  const architectures = units.filter((unit) => unit.kind === 'architecture')
  return units
    .filter((unit) => unit.kind === 'entity')
    .map((unit) => ({
      unit,
      architectures: architectures.filter(
        (architecture) => architecture.parent_name?.toLowerCase() === unit.name.toLowerCase(),
      ),
    }))
}

function packagesOf(library: Library): DesignUnit[] {
  return studio.unitsIn(library).filter((unit) => unit.kind === 'package' || unit.kind === 'package_body')
}

interface EntityBranch {
  unit: DesignUnit
  architectures: DesignUnit[]
}

type HierarchyRow =
  | { kind: 'entity'; key: string; unit: DesignUnit; architectures: DesignUnit[]; depth: number; missing?: undefined }
  | { kind: 'missing'; key: string; missing: string; depth: number; unit?: undefined; architectures: DesignUnit[] }
  | { kind: 'divider'; key: string; unit?: undefined; architectures: DesignUnit[]; depth: number; missing?: undefined }

function hierarchyOf(library: Library): HierarchyRow[] {
  const entities = entitiesOf(library)
  const byName = new Map<string, EntityBranch>()
  for (const entry of entities) byName.set(entry.unit.name.toLowerCase(), entry)
  const children = new Map<string, string[]>()
  for (const entry of entities) {
    const names: string[] = []
    const seen = new Set<string>()
    for (const architecture of entry.architectures) {
      for (const raw of architecture.instantiates ?? []) {
        const key = raw.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        names.push(raw)
      }
    }
    children.set(entry.unit.name.toLowerCase(), names)
  }
  const referenced = new Set<string>()
  for (const names of children.values()) {
    for (const name of names) {
      if (byName.has(name.toLowerCase())) referenced.add(name.toLowerCase())
    }
  }
  const selected = entities.find((entry) => entry.unit.id === studio.hierarchyRootId) ?? null
  const starts = selected
    ? [selected]
    : entities.filter((entry) => !referenced.has(entry.unit.name.toLowerCase()))
  const rows: HierarchyRow[] = []
  const seenUnits = new Set<string>()

  function walk(entry: EntityBranch, depth: number, stack: Set<string>): void {
    const name = entry.unit.name.toLowerCase()
    if (stack.has(name)) return
    rows.push({
      kind: 'entity',
      key: `${entry.unit.id}-${rows.length}`,
      unit: entry.unit,
      architectures: entry.architectures,
      depth,
    })
    seenUnits.add(entry.unit.id)
    const next = new Set(stack)
    next.add(name)
    for (const childName of children.get(name) ?? []) {
      const child = byName.get(childName.toLowerCase())
      if (!child) {
        rows.push({
          kind: 'missing',
          key: `${entry.unit.id}-${childName}-${rows.length}`,
          missing: childName,
          architectures: [],
          depth: depth + 1,
        })
        continue
      }
      walk(child, depth + 1, next)
    }
  }

  for (const entry of starts) walk(entry, 0, new Set())
  const outside = entities.filter((entry) => !seenUnits.has(entry.unit.id))
  if (!selected) {
    for (const entry of outside) walk(entry, 0, new Set())
  } else if (outside.length) {
    rows.push({ kind: 'divider', key: `${library.id}-outside`, architectures: [], depth: 0 })
    for (const entry of outside) {
      rows.push({
        kind: 'entity',
        key: `${entry.unit.id}-outside`,
        unit: entry.unit,
        architectures: entry.architectures,
        depth: 0,
      })
    }
  }
  return rows
}

function otherUnitsOf(library: Library): DesignUnit[] {
  const matched = new Set<string>()
  for (const entity of entitiesOf(library)) {
    matched.add(entity.unit.id)
    for (const architecture of entity.architectures) matched.add(architecture.id)
  }
  for (const unit of packagesOf(library)) matched.add(unit.id)
  return studio.unitsIn(library).filter((unit) => !matched.has(unit.id))
}

function otherFilesOf(library: Library): FileEntry[] {
  const unitPaths = new Set(studio.unitsIn(library).map((unit) => unit.source.path))
  return (library.last_import?.files ?? []).filter((file) => !unitPaths.has(file.path))
}

async function onScan(): Promise<void> {
  if (studio.dirty && !window.confirm('The open diagram has unsaved changes. Scan anyway? The editor keeps those changes.')) return
  await studio.scan(studio.libraryPath, studio.libraryName, studio.includeSideData)
}

async function onCreate(): Promise<void> {
  const libraryId = designLibraryId.value || libraries.value[0]?.id
  const name = designName.value.trim()
  if (!libraryId || !name) return
  await studio.createWorkspaceDesign(name, libraryId)
  if (!studio.error) designName.value = ''
}

async function onExamples(): Promise<void> {
  try {
    studio.libraryPath = await studio.scanExamples()
    studio.libraryName = 'demo'
  } catch (reason) {
    studio.error = reason instanceof Error ? reason.message : 'The examples library could not be opened.'
  }
}
</script>

<template>
  <div class="browser">
    <form class="scan" @submit.prevent="onScan">
      <label>
        Target board
        <select v-model="studio.boardId">
          <option value="">No board selected</option>
          <option v-if="studio.boardMissing" :value="studio.boardId">Saved board is not in boardfiles</option>
          <option v-for="board in studio.boards" :key="board.id" :value="board.id">
            {{ boardLabel(board) }}
          </option>
        </select>
      </label>
      <label>
        Library directory
        <input v-model="studio.libraryPath" type="text" spellcheck="false" placeholder="C:\path\to\library" />
      </label>
      <label>
        Library name
        <input v-model="studio.libraryName" type="text" spellcheck="false" />
      </label>
      <label class="check">
        <input v-model="studio.includeSideData" type="checkbox" />
        List hidden side-data directories
      </label>
      <div class="actions">
        <button type="submit" :disabled="studio.busy || !studio.libraryPath.trim()">Scan</button>
        <button type="button" :disabled="studio.busy" @click="onExamples">Examples</button>
      </div>
      <p v-if="studio.error" class="error">{{ studio.error }}</p>
    </form>

    <form v-if="libraries.length" class="scan" @submit.prevent="onCreate">
      <label>
        New design
        <input v-model="designName" type="text" spellcheck="false" placeholder="Design name" />
      </label>
      <label>
        Target library
        <select v-model="designLibraryId">
          <option value="">{{ libraries[0]?.name }}</option>
          <option v-for="library in libraries" :key="library.id" :value="library.id">{{ library.name }}</option>
        </select>
      </label>
      <button type="submit" :disabled="!designName.trim()">Create design</button>
    </form>

    <div v-if="libraries.length === 0" class="empty">
      No library imported yet. Scan a directory or open the examples.
    </div>

    <section v-for="library in libraries" :key="library.id" class="library">
      <header>
        <h2>{{ library.name }}</h2>
        <p>{{ library.root_path }}</p>
        <p v-if="library.last_import" class="counts">
          {{ library.last_import.counts.entities ?? 0 }} entities,
          {{ library.last_import.counts.block_diagrams ?? 0 }} block diagrams,
          {{ library.last_import.counts.files ?? 0 }} files,
          {{ library.last_import.counts.warnings ?? 0 }} warnings
        </p>
      </header>

      <h3>Workspace designs</h3>
      <ul>
        <li v-for="design in studio.designsFor(library.id)" :key="design.id">
          <button type="button" :class="{ selected: studio.editable?.id === design.id }" @click="studio.openDesign(design.id)">
            {{ design.name }}
            <span class="role">{{ design.origin === 'created' ? 'new' : 'copy' }}</span>
          </button>
        </li>
      </ul>
      <p v-if="studio.designsFor(library.id).length === 0" class="empty">No workspace designs for this library yet.</p>

      <h3>Diagrams</h3>
      <ul>
        <li v-for="diagram in diagramsOf(library)" :key="diagram.id">
          <button
            type="button"
            :class="{ selected: studio.selectedDiagramId === diagram.id }"
            @click="studio.selectDiagram(diagram.id)"
          >
            {{ diagram.entity_name || diagram.source_path }}
            <span class="role">{{ diagram.view }}</span>
          </button>
        </li>
      </ul>
      <p v-if="diagramsOf(library).length === 0" class="empty">No graphical views were parsed.</p>

      <h3>Entities</h3>
      <ul>
        <template v-for="row in hierarchyOf(library)" :key="row.key">
          <li v-if="row.kind === 'divider'" class="hier-note">Outside this root</li>
          <li v-else class="hier" :style="{ marginLeft: `${row.depth * 14}px` }">
            <div class="hier-line">
              <button
                v-if="row.unit"
                type="button"
                :class="{ selected: studio.selectedUnitId === row.unit.id }"
                @click="studio.selectUnit(row.unit.id)"
              >
                {{ row.unit.name }}
              </button>
              <span v-else class="missing">{{ row.missing }} <span class="role">not in this library</span></span>
              <button
                v-if="row.unit"
                type="button"
                class="root-toggle"
                :aria-pressed="studio.hierarchyRootId === row.unit.id"
                :title="studio.hierarchyRootId === row.unit.id ? 'Root design' : 'Set as root design'"
                @click="studio.toggleHierarchyRoot(row.unit.id)"
              >
                {{ studio.hierarchyRootId === row.unit.id ? '★' : '☆' }}
              </button>
            </div>
            <ul v-if="row.architectures.length">
              <li v-for="architecture in row.architectures" :key="architecture.id">
                <button
                  type="button"
                  class="nested"
                  :class="{ selected: studio.selectedUnitId === architecture.id }"
                  @click="studio.selectUnit(architecture.id)"
                >
                  {{ architecture.name }}
                </button>
              </li>
            </ul>
          </li>
        </template>
      </ul>

      <h3>Packages</h3>
      <ul>
        <li v-for="unit in packagesOf(library)" :key="unit.id">
          <button
            type="button"
            :class="{ selected: studio.selectedUnitId === unit.id }"
            @click="studio.selectUnit(unit.id)"
          >
            {{ unit.kind === 'package_body' ? `${unit.name} body` : unit.name }}
          </button>
        </li>
      </ul>

      <template v-if="otherUnitsOf(library).length">
        <h3>Other units</h3>
        <ul>
          <li v-for="unit in otherUnitsOf(library)" :key="unit.id">
            <button
              type="button"
              :class="{ selected: studio.selectedUnitId === unit.id }"
              @click="studio.selectUnit(unit.id)"
            >
              {{ unit.kind }} {{ unit.name }}
            </button>
          </li>
        </ul>
      </template>

      <template v-if="otherFilesOf(library).length">
        <h3>Other files</h3>
        <ul class="files">
          <li v-for="file in otherFilesOf(library)" :key="file.path">
            <span class="mono">{{ file.path }}</span>
            <span class="role">{{ file.role }}</span>
          </li>
        </ul>
      </template>
    </section>
  </div>
</template>

<style scoped>
.browser {
  height: 100%;
  overflow: auto;
  padding: 12px;
}

.scan {
  display: grid;
  gap: 8px;
  margin-bottom: 14px;
}

label {
  display: grid;
  gap: 4px;
  color: #5c6775;
  font-size: 12px;
}

input,
select {
  width: 100%;
  border: 1px solid #c5cad3;
  border-radius: 4px;
  padding: 6px 8px;
  background: #fff;
}

.actions {
  display: flex;
  gap: 8px;
}

button {
  border: 1px solid #c5cad3;
  background: #fff;
  border-radius: 4px;
  padding: 5px 10px;
  text-align: left;
  cursor: pointer;
}

button:disabled {
  cursor: default;
  color: #8b95a3;
}

.actions button {
  background: #0b5cab;
  border-color: #0b5cab;
  color: #fff;
}

.actions button:disabled {
  background: #c5cad3;
  border-color: #c5cad3;
}

.error {
  margin: 0;
  color: #a12626;
}

.empty {
  color: #5c6775;
}

.library header h2,
h3 {
  margin: 0;
  font-size: 13px;
}

.library header p,
.files .role {
  margin: 2px 0 0;
  color: #5c6775;
  font-size: 12px;
  word-break: break-all;
}

.counts {
  margin-bottom: 8px;
}

ul {
  list-style: none;
  margin: 6px 0 12px;
  padding: 0;
}

ul ul {
  margin: 2px 0 6px 12px;
}

.browser button.selected {
  background: #e5f0fa;
  border-color: #0b5cab;
}

.nested {
  color: #3d4754;
}

.hier-line {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hier-line > button:first-child {
  flex: 1;
}

.root-toggle {
  width: 28px;
  padding: 4px 0;
  text-align: center;
}

.root-toggle[aria-pressed='true'] {
  background: #0b5cab;
  border-color: #0b5cab;
  color: #fff;
}

.hier-note,
.missing {
  color: #5c6775;
  font-size: 12px;
}

.check {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #3d4754;
}

.role {
  margin-left: 6px;
  color: #5c6775;
  font-size: 11px;
}

.files li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 0;
  font-size: 12px;
}
</style>
