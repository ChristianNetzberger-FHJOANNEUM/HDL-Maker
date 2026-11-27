<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SymbolDefinition } from '../core/document'
import { guidedPinPoint, isFreePin, isGuidedPin, pinPoint, radialLeadSegment } from '../core/geometry'
import type { LibraryDiagnostic, SymbolLibrary } from '../core/library'
import SymbolFace, { type FaceLead, type FacePin } from './SymbolFace.vue'

const props = defineProps<{
  libraries: SymbolLibrary[]
  diagnostics: LibraryDiagnostic[]
}>()

const emit = defineEmits<{
  place: [symbol: SymbolDefinition, client: { x: number; y: number } | null]
  edit: [symbol: SymbolDefinition]
  copy: [symbol: SymbolDefinition]
  remove: [symbolId: string]
  export: []
  import: []
}>()

const libraryId = ref(props.libraries[0]?.id ?? '')
const categoryId = ref('all')
const query = ref('')
const ghost = ref<{ name: string; x: number; y: number } | null>(null)
let drag: { symbol: SymbolDefinition; x: number; y: number; moved: boolean } | null = null

const selectedLibrary = computed(() => props.libraries.find((item) => item.id === libraryId.value) ?? props.libraries[0])

const categories = computed(() => selectedLibrary.value?.categories ?? [])

const visible = computed(() => {
  const library = selectedLibrary.value
  if (!library) return []
  const term = query.value.trim().toLowerCase()
  return library.symbols.filter((symbol) => {
    if (categoryId.value !== 'all' && symbol.categoryId !== categoryId.value) return false
    return term.length === 0 || symbol.name.toLowerCase().includes(term)
  })
})

function pinsOf(symbol: SymbolDefinition): FacePin[] {
  return symbol.ports.map((pin) => {
    const guided = isGuidedPin(pin)
    const at = guided
      ? guidedPinPoint(symbol, pin, symbol.width, symbol.height) ?? pinPoint(symbol.width, symbol.height, pin)
      : pinPoint(symbol.width, symbol.height, pin)
    return { id: pin.id, name: pin.name, side: pin.side, x: at.x, y: at.y, free: isFreePin(pin), guided }
  })
}

function leadsOf(symbol: SymbolDefinition): FaceLead[] {
  return symbol.ports
    .map((pin) => radialLeadSegment(symbol, pin, symbol.width, symbol.height))
    .filter((lead): lead is FaceLead => lead !== null)
}

function onLibrary(event: Event): void {
  libraryId.value = (event.target as HTMLSelectElement).value
  categoryId.value = 'all'
}

function onDown(symbol: SymbolDefinition, event: PointerEvent): void {
  if (event.button !== 0) return
  drag = { symbol, x: event.clientX, y: event.clientY, moved: false }
  try {
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
  } catch {
    // A synthetic pointer has no capture target. The drag still ends on pointerup.
  }
}

function onMove(event: PointerEvent): void {
  if (!drag) return
  if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5) {
    drag.moved = true
    ghost.value = { name: drag.symbol.name, x: event.clientX + 8, y: event.clientY + 8 }
  }
}

function onUp(event: PointerEvent): void {
  const current = drag
  drag = null
  ghost.value = null
  if (!current) return
  emit('place', current.symbol, current.moved ? { x: event.clientX, y: event.clientY } : null)
}
</script>

<template>
  <div class="symbol-palette" :data-library="selectedLibrary?.id" :data-visible="visible.length">
    <p>Libraries</p>
    <label>
      Library
      <select :value="selectedLibrary?.id" @change="onLibrary">
        <option v-for="library in libraries" :key="library.id" :value="library.id">{{ library.name }}</option>
      </select>
    </label>
    <label>
      Category
      <select v-model="categoryId">
        <option value="all">All</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option>
      </select>
    </label>
    <label>Search <input v-model="query" type="search" /></label>
    <p class="hint">{{ selectedLibrary?.description }}</p>
    <div
      v-for="symbol in visible"
      :key="symbol.id"
      class="palette-item"
      role="button"
      tabindex="0"
      :data-symbol-id="symbol.id"
      @pointerdown="onDown(symbol, $event)"
      @pointermove="onMove"
      @pointerup="onUp"
    >
      <svg class="palette-preview" :viewBox="`0 0 ${symbol.width} ${symbol.height}`" width="72" height="48">
        <SymbolFace :width="symbol.width" :height="symbol.height" :shapes="symbol.shapes" :labels="symbol.labels" :assets="selectedLibrary?.assets ?? []" :pins="pinsOf(symbol)" :leads="leadsOf(symbol)" />
      </svg>
      <span>{{ symbol.name }}</span>
      <span class="palette-actions">
        <button type="button" @pointerdown.stop @click.stop="emit('edit', symbol)">Edit</button>
        <button type="button" @pointerdown.stop @click.stop="emit('copy', symbol)">Copy</button>
        <button v-if="!selectedLibrary?.builtin" type="button" @pointerdown.stop @click.stop="emit('remove', symbol.id)">Delete</button>
      </span>
    </div>
    <button type="button" @click="emit('export')">Export library</button>
    <button type="button" @click="emit('import')">Import library</button>
    <p v-for="item in diagnostics" :key="`${item.kind}-${item.symbolId}`" class="hint">{{ item.message }}</p>
    <div v-if="ghost" class="palette-ghost" :style="{ left: `${ghost.x}px`, top: `${ghost.y}px` }">{{ ghost.name }}</div>
  </div>
</template>
