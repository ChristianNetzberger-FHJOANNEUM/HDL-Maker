<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DesignUnit, FileEntry, Library } from '../models/design'
import { useStudioStore } from '../stores/studio'

const studio = useStudioStore()
const path = ref('')
const libraryName = ref('demo')

const libraries = computed(() => studio.project?.libraries ?? [])

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
  await studio.scan(path.value, libraryName.value)
}

async function onExamples(): Promise<void> {
  try {
    path.value = await studio.scanExamples()
    libraryName.value = 'demo'
  } catch (reason) {
    studio.error = reason instanceof Error ? reason.message : 'The examples library could not be opened.'
  }
}
</script>

<template>
  <div class="browser">
    <form class="scan" @submit.prevent="onScan">
      <label>
        Library directory
        <input v-model="path" type="text" spellcheck="false" placeholder="C:\path\to\library" />
      </label>
      <label>
        Library name
        <input v-model="libraryName" type="text" spellcheck="false" />
      </label>
      <div class="actions">
        <button type="submit" :disabled="studio.busy || !path.trim()">Scan</button>
        <button type="button" :disabled="studio.busy" @click="onExamples">Examples</button>
      </div>
      <p v-if="studio.error" class="error">{{ studio.error }}</p>
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
          {{ library.last_import.counts.files ?? 0 }} files,
          {{ library.last_import.counts.warnings ?? 0 }} warnings
        </p>
      </header>

      <h3>Entities</h3>
      <ul>
        <li v-for="entity in entitiesOf(library)" :key="entity.unit.id">
          <button
            type="button"
            :class="{ selected: studio.selectedUnitId === entity.unit.id }"
            @click="studio.selectUnit(entity.unit.id)"
          >
            {{ entity.unit.name }}
          </button>
          <ul>
            <li v-for="architecture in entity.architectures" :key="architecture.id">
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

input {
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

.files li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 0;
  font-size: 12px;
}
</style>
