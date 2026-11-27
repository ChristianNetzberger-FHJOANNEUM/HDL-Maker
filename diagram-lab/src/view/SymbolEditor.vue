<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { inspectImage } from '../core/assets'
import type { DiagramDocument, ImageAsset, Point, SymbolDefinition, SymbolShape } from '../core/document'
import { guidedPinPoint, isFreePin, isGuidedPin, pinOnBorder, pinPoint, radialLeadSegment } from '../core/geometry'
import {
  addImageAsset,
  addSymbolLabel,
  addSymbolPort,
  addSymbolShape,
  moveFreeSymbolPort,
  pruneAssets,
  moveSymbolLabel,
  moveSymbolPort,
  removeSymbolLabel,
  removeSymbolPort,
  removeSymbolShape,
  renameSymbol,
  renameSymbolPort,
  setSymbolCategory,
  replaceSymbolShape,
  setSymbolLabelText,
  setSymbolSize,
  translatedShape,
} from '../core/symbols'
import SymbolFace, { type FaceLead, type FacePin } from './SymbolFace.vue'

type Tool = 'select' | 'rect' | 'ellipse' | 'line' | 'polygon' | 'text' | 'pin' | 'free'
type Selection = { kind: 'shape'; index: number } | { kind: 'label'; id: string } | { kind: 'pin'; id: string } | null
type Gesture =
  | { kind: 'box'; index: number; x0: number; y0: number; shape: 'rect' | 'ellipse' }
  | { kind: 'line'; index: number; x0: number; y0: number }
  | { kind: 'move-shape'; index: number; origin: SymbolShape; x0: number; y0: number }
  | { kind: 'move-label'; id: string; x: number; y: number; px: number; py: number }
  | { kind: 'move-pin'; id: string }

const props = defineProps<{ symbol: SymbolDefinition; instances: number; categories: Array<{ id: string; name: string }>; assets: ImageAsset[] }>()
const emit = defineEmits<{
  execute: [apply: (doc: DiagramDocument) => void]
  begin: []
  preview: [apply: (doc: DiagramDocument) => void]
  commit: []
  cancel: []
  place: []
  close: []
  saveLibrary: []
  publish: []
  duplicate: []
  exportLibrary: []
  importLibrary: []
}>()

const pad = 28
const tool = ref<Tool>('select')
const selected = ref<Selection>(null)
const draft = ref<Point[] | null>(null)
const hint = ref('Select a shape or a pin.')
const svgEl = ref<SVGSVGElement | null>(null)
const imageFile = ref<HTMLInputElement | null>(null)
let imageMode: 'place' | 'replace' = 'place'
let gesture: Gesture | null = null

const pins = computed<FacePin[]>(() =>
  props.symbol.ports.map((pin) => {
    const guided = isGuidedPin(pin)
    const at = guided
      ? guidedPinPoint(props.symbol, pin, props.symbol.width, props.symbol.height) ?? pinPoint(props.symbol.width, props.symbol.height, pin)
      : pinPoint(props.symbol.width, props.symbol.height, pin)
    return { id: pin.id, name: pin.name, side: pin.side, x: at.x, y: at.y, free: isFreePin(pin), guided }
  }),
)

const leads = computed<FaceLead[]>(() =>
  props.symbol.ports
    .map((pin) => radialLeadSegment(props.symbol, pin, props.symbol.width, props.symbol.height))
    .filter((lead): lead is FaceLead => lead !== null),
)

const selectedImage = computed(() => {
  const current = selected.value
  if (current?.kind !== 'shape') return null
  const shape = props.symbol.shapes[current.index]
  return shape?.kind === 'image' ? shape : null
})

const selectedPin = computed(() => {
  const current = selected.value
  if (current?.kind !== 'pin') return null
  return props.symbol.ports.find((pin) => pin.id === current.id) ?? null
})

const selectedLabel = computed(() => {
  const current = selected.value
  if (current?.kind !== 'label') return null
  return props.symbol.labels.find((label) => label.id === current.id) ?? null
})

const viewBox = computed(() => `${-pad} ${-pad} ${props.symbol.width + pad * 2} ${props.symbol.height + pad * 2}`)

function localPoint(event: PointerEvent): Point {
  const svg = svgEl.value
  if (!svg) return { x: 0, y: 0 }
  const rect = svg.getBoundingClientRect()
  const box = svg.viewBox.baseVal
  const x = box.x + ((event.clientX - rect.left) / rect.width) * box.width
  const y = box.y + ((event.clientY - rect.top) / rect.height) * box.height
  return { x, y }
}

function boxOf(x0: number, y0: number, x1: number, y1: number): { x: number; y: number; width: number; height: number } {
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) }
}

function near(a: Point, b: Point, radius = 8): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= radius
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = dx * dx + dy * dy
  if (length < 1e-6) return Math.hypot(point.x - a.x, point.y - a.y)
  const t = Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length))
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t))
}

function hitsShape(point: Point, shape: SymbolShape): boolean {
  if (shape.kind === 'rect' || shape.kind === 'ellipse' || shape.kind === 'image') {
    return point.x >= shape.x && point.x <= shape.x + shape.width && point.y >= shape.y && point.y <= shape.y + shape.height
  }
  if (shape.kind === 'line') return distanceToSegment(point, { x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 }) <= 6
  if (shape.kind === 'text') return near(point, { x: shape.x, y: shape.y }, 12)
  if (shape.points.length === 0) return false
  for (let index = 0; index < shape.points.length; index += 1) {
    const a = shape.points[index]
    const b = shape.points[(index + 1) % shape.points.length]
    if (distanceToSegment(point, a, b) <= 6) return true
  }
  let inside = false
  for (let i = 0, j = shape.points.length - 1; i < shape.points.length; j = i, i += 1) {
    const a = shape.points[i]
    const b = shape.points[j]
    const cross = a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-6) + a.x
    if (cross) inside = !inside
  }
  return inside
}

function pick(point: Point): Selection {
  const pin = pins.value.find((item) => near(point, item))
  if (pin) return { kind: 'pin', id: pin.id }
  const label = [...props.symbol.labels].reverse().find((item) => near(point, item, 12))
  if (label) return { kind: 'label', id: label.id }
  for (let index = props.symbol.shapes.length - 1; index >= 0; index -= 1) {
    if (hitsShape(point, props.symbol.shapes[index])) return { kind: 'shape', index }
  }
  return null
}

function onDown(event: PointerEvent): void {
  if (event.button !== 0) return
  const point = localPoint(event)
  try {
    svgEl.value?.setPointerCapture(event.pointerId)
  } catch {
    // The pointer is already gone, or the event was synthesized.
  }
  if (tool.value === 'polygon') {
    const corners = draft.value ?? []
    if (corners.length >= 3 && near(point, corners[0])) {
      finishPolygon()
      return
    }
    draft.value = [...corners, point]
    hint.value = 'Click the next corner. Enter closes the polygon.'
    return
  }
  if (tool.value === 'pin' || tool.value === 'free') {
    const placed = pinOnBorder(props.symbol.width, props.symbol.height, point.x, point.y)
    const free = tool.value === 'free'
    let id = ''
    emit('execute', (doc) => {
      id =
        addSymbolPort(doc, props.symbol.id, {
          name: `p${props.symbol.ports.length + 1}`,
          side: placed.side,
          t: placed.t,
          ...(free ? { x: point.x / props.symbol.width, y: point.y / props.symbol.height } : {}),
        }) ?? ''
    })
    if (id) selected.value = { kind: 'pin', id }
    hint.value = free ? 'Free pin added. It keeps this fraction when the symbol is resized.' : 'Pin added on the nearest side.'
    return
  }
  if (tool.value === 'text') {
    let id = ''
    emit('execute', (doc) => {
      id = addSymbolLabel(doc, props.symbol.id, point.x, point.y, 'Text') ?? ''
    })
    if (id) selected.value = { kind: 'label', id }
    hint.value = 'Label placed.'
    return
  }
  if (tool.value === 'rect' || tool.value === 'ellipse') {
    emit('begin')
    let index = -1
    emit('preview', (doc) => {
      index = addSymbolShape(doc, props.symbol.id, { kind: tool.value as 'rect' | 'ellipse', x: point.x, y: point.y, width: 1, height: 1 })
    })
    gesture = { kind: 'box', index, x0: point.x, y0: point.y, shape: tool.value }
    selected.value = { kind: 'shape', index }
    return
  }
  if (tool.value === 'line') {
    emit('begin')
    let index = -1
    emit('preview', (doc) => {
      index = addSymbolShape(doc, props.symbol.id, { kind: 'line', x1: point.x, y1: point.y, x2: point.x, y2: point.y })
    })
    gesture = { kind: 'line', index, x0: point.x, y0: point.y }
    selected.value = { kind: 'shape', index }
    return
  }
  const hit = pick(point)
  selected.value = hit
  if (!hit) {
    hint.value = 'Nothing selected.'
    return
  }
  emit('begin')
  if (hit.kind === 'shape') {
    gesture = { kind: 'move-shape', index: hit.index, origin: JSON.parse(JSON.stringify(props.symbol.shapes[hit.index])) as SymbolShape, x0: point.x, y0: point.y }
  } else if (hit.kind === 'label') {
    const label = props.symbol.labels.find((item) => item.id === hit.id)
    if (!label) return
    gesture = { kind: 'move-label', id: hit.id, x: label.x, y: label.y, px: point.x, py: point.y }
  } else {
    gesture = { kind: 'move-pin', id: hit.id }
  }
  const dragged = props.symbol.ports.find((pin) => hit.kind === 'pin' && pin.id === hit.id)
  hint.value = hit.kind === 'pin' ? (dragged && isFreePin(dragged) ? 'Drag the free pin.' : 'Drag the pin. It stays on a side.') : 'Drag to move.'
}

function onMove(event: PointerEvent): void {
  if (!gesture) return
  const point = localPoint(event)
  const current = gesture
  if (current.kind === 'box') {
    const box = boxOf(current.x0, current.y0, point.x, point.y)
    emit('preview', (doc) => {
      replaceSymbolShape(doc, props.symbol.id, current.index, { kind: current.shape, ...box })
    })
    return
  }
  if (current.kind === 'line') {
    emit('preview', (doc) => {
      replaceSymbolShape(doc, props.symbol.id, current.index, {
        kind: 'line',
        x1: current.x0,
        y1: current.y0,
        x2: point.x,
        y2: point.y,
      })
    })
    return
  }
  if (current.kind === 'move-shape') {
    emit('preview', (doc) => {
      replaceSymbolShape(doc, props.symbol.id, current.index, translatedShape(current.origin, point.x - current.x0, point.y - current.y0))
    })
    return
  }
  if (current.kind === 'move-label') {
    emit('preview', (doc) => {
      moveSymbolLabel(doc, props.symbol.id, current.id, current.x + point.x - current.px, current.y + point.y - current.py)
    })
    return
  }
  const pin = props.symbol.ports.find((item) => item.id === current.id)
  if (pin && isFreePin(pin)) {
    emit('preview', (doc) => {
      moveFreeSymbolPort(doc, props.symbol.id, current.id, point.x / props.symbol.width, point.y / props.symbol.height)
    })
    return
  }
  const placed = pinOnBorder(props.symbol.width, props.symbol.height, point.x, point.y)
  emit('preview', (doc) => {
    moveSymbolPort(doc, props.symbol.id, current.id, placed.side, placed.t)
  })
}

function onUp(): void {
  const current = gesture
  gesture = null
  if (!current) return
  if (current.kind === 'box' || current.kind === 'line') {
    const shape = props.symbol.shapes[current.index]
    const tiny =
      shape &&
      ((shape.kind === 'rect' || shape.kind === 'ellipse') ? shape.width < 4 || shape.height < 4 : shape.kind === 'line' && Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1) < 4)
    if (tiny) {
      emit('cancel')
      selected.value = null
      hint.value = 'Shape cancelled.'
      return
    }
  }
  emit('commit')
  hint.value = 'Edited.'
}

function finishPolygon(): boolean {
  const corners = draft.value
  if (!corners || corners.length < 3) return false
  emit('execute', (doc) => {
    addSymbolShape(doc, props.symbol.id, { kind: 'polygon', points: corners.map((point) => ({ ...point })) })
  })
  draft.value = null
  tool.value = 'select'
  hint.value = 'Polygon added.'
  return true
}

function cancelDraft(): boolean {
  if (!draft.value) return false
  draft.value = null
  hint.value = 'Polygon cancelled.'
  return true
}

function abandonGesture(): void {
  gesture = null
}

function removeSelected(): boolean {
  const current = selected.value
  if (!current) return false
  if (current.kind === 'pin') {
    emit('execute', (doc) => {
      removeSymbolPort(doc, props.symbol.id, current.id)
    })
    hint.value = 'Pin removed from the symbol. A connected instance keeps the wire.'
  } else if (current.kind === 'label') {
    emit('execute', (doc) => {
      removeSymbolLabel(doc, props.symbol.id, current.id)
    })
    hint.value = 'Label removed.'
  } else {
    emit('execute', (doc) => {
      removeSymbolShape(doc, props.symbol.id, current.index)
    })
    hint.value = 'Shape removed.'
  }
  selected.value = null
  return true
}

function commitName(event: Event): void {
  const name = (event.target as HTMLInputElement).value
  emit('execute', (doc) => renameSymbol(doc, props.symbol.id, name))
}

function commitSize(field: 'width' | 'height', event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  emit('execute', (doc) => {
    setSymbolSize(doc, props.symbol.id, field === 'width' ? value : props.symbol.width, field === 'height' ? value : props.symbol.height)
  })
}

function commitPinName(event: Event): void {
  const pin = selectedPin.value
  if (!pin) return
  const name = (event.target as HTMLInputElement).value
  emit('execute', (doc) => renameSymbolPort(doc, props.symbol.id, pin.id, name))
}

function commitPinSide(event: Event): void {
  const pin = selectedPin.value
  if (!pin) return
  const side = (event.target as HTMLSelectElement).value as typeof pin.side
  emit('execute', (doc) => moveSymbolPort(doc, props.symbol.id, pin.id, side, pin.t))
}

function commitPinT(event: Event): void {
  const pin = selectedPin.value
  if (!pin) return
  const t = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(t)) return
  emit('execute', (doc) => moveSymbolPort(doc, props.symbol.id, pin.id, pin.side, t))
}

function commitCategory(event: Event): void {
  const categoryId = (event.target as HTMLSelectElement).value
  emit('execute', (doc) => setSymbolCategory(doc, props.symbol.id, categoryId))
}

function pickImage(mode: 'place' | 'replace'): void {
  imageMode = mode
  imageFile.value?.click()
}

async function takeImage(file: File, at?: Point): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const inspected = await inspectImage(bytes, file.name, file.type)
  if (!inspected.ok) {
    hint.value = inspected.message
    return
  }
  const draft = inspected.draft
  const naturalWidth = draft.width && draft.width > 0 ? draft.width : 120
  const naturalHeight = draft.height && draft.height > 0 ? draft.height : 80
  const fitted = fitBox(naturalWidth, naturalHeight)
  emit('execute', (doc) => {
    const stored = addImageAsset(doc, draft)
    if (!stored.ok) return
    if (imageMode === 'replace' && selected.value?.kind === 'shape') {
      const current = props.symbol.shapes[selected.value.index]
      if (current?.kind === 'image') {
        replaceSymbolShape(doc, props.symbol.id, selected.value.index, { ...current, assetId: stored.id })
        pruneAssets(doc)
        return
      }
    }
    const index = addSymbolShape(doc, props.symbol.id, {
      kind: 'image',
      assetId: stored.id,
      x: at?.x ?? 16,
      y: at?.y ?? 16,
      width: fitted.width,
      height: fitted.height,
      lockAspect: true,
    })
    selected.value = { kind: 'shape', index }
  })
  hint.value = draft.mime === 'image/svg+xml' ? 'SVG added. It is drawn as a picture, not as editable paths.' : 'Image added.'
  tool.value = 'select'
}

function fitBox(width: number, height: number): { width: number; height: number } {
  const limit = Math.max(40, Math.min(props.symbol.width, props.symbol.height) - 24)
  const scale = Math.min(1, limit / Math.max(width, height))
  return { width: Math.max(8, width * scale), height: Math.max(8, height * scale) }
}

async function onImageFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await takeImage(file)
}

function onDragOver(event: DragEvent): void {
  if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
}

function onDrop(event: DragEvent): void {
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  event.preventDefault()
  imageMode = 'place'
  void takeImage(file, localPoint(event as unknown as PointerEvent))
}

function onPaste(event: ClipboardEvent): void {
  const target = event.target
  if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
  const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith('image/'))
  if (!file) return
  event.preventDefault()
  imageMode = 'place'
  void takeImage(file)
}

function commitImage(field: 'x' | 'y' | 'width' | 'height', event: Event): void {
  const current = selected.value
  const shape = selectedImage.value
  if (!shape || current?.kind !== 'shape') return
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  const next = { ...shape }
  if (field === 'width' || field === 'height') {
    const ratio = shape.height === 0 ? 1 : shape.width / shape.height
    if (shape.lockAspect !== false && ratio > 0) {
      if (field === 'width') {
        next.width = Math.max(8, value)
        next.height = Math.max(8, next.width / ratio)
      } else {
        next.height = Math.max(8, value)
        next.width = Math.max(8, next.height * ratio)
      }
    } else {
      next[field] = Math.max(8, value)
    }
  } else {
    next[field] = value
  }
  emit('execute', (doc) => replaceSymbolShape(doc, props.symbol.id, current.index, next))
}

function commitAspect(event: Event): void {
  const current = selected.value
  const shape = selectedImage.value
  if (!shape || current?.kind !== 'shape') return
  const lockAspect = (event.target as HTMLInputElement).checked
  emit('execute', (doc) => replaceSymbolShape(doc, props.symbol.id, current.index, { ...shape, lockAspect }))
}

function bindPin(): void {
  const pin = selectedPin.value
  if (!pin) return
  emit('execute', (doc) => moveSymbolPort(doc, props.symbol.id, pin.id, pin.side, pin.t))
}

function releasePin(): void {
  const pin = selectedPin.value
  if (!pin) return
  const at = pinPoint(props.symbol.width, props.symbol.height, { ...pin, x: undefined, y: undefined })
  emit('execute', (doc) => moveFreeSymbolPort(doc, props.symbol.id, pin.id, at.x / props.symbol.width, at.y / props.symbol.height))
}

function commitFree(axis: 'x' | 'y', event: Event): void {
  const pin = selectedPin.value
  if (!pin || !isFreePin(pin)) return
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  emit('execute', (doc) => moveFreeSymbolPort(doc, props.symbol.id, pin.id, axis === 'x' ? value : pin.x ?? 0, axis === 'y' ? value : pin.y ?? 0))
}

function commitLabel(event: Event): void {
  const label = selectedLabel.value
  if (!label) return
  const text = (event.target as HTMLInputElement).value
  emit('execute', (doc) => setSymbolLabelText(doc, props.symbol.id, label.id, text))
}

onMounted(() => window.addEventListener('paste', onPaste))
onUnmounted(() => window.removeEventListener('paste', onPaste))

defineExpose({ removeSelected, finishPolygon, cancelDraft, abandonGesture })
</script>

<template>
  <div class="symbol-editor" :data-symbol-id="symbol.id" :data-revision="symbol.revision ?? ''" :data-instances="instances" :data-pins="symbol.ports.map((pin) => (typeof pin.x === 'number' ? `free:${pin.x},${pin.y}` : `${pin.side}:${pin.t}`)).join('|')">
    <p>Symbol</p>
    <label>Name <input :value="symbol.name" @change="commitName" /></label>
    <label>Width <input :value="symbol.width" type="number" min="40" @change="commitSize('width', $event)" /></label>
    <label>Height <input :value="symbol.height" type="number" min="40" @change="commitSize('height', $event)" /></label>
    <div class="symbol-tools">
      <button type="button" :class="{ on: tool === 'select' }" @click="tool = 'select'">Select</button>
      <button type="button" :class="{ on: tool === 'rect' }" @click="tool = 'rect'">Rect</button>
      <button type="button" :class="{ on: tool === 'ellipse' }" @click="tool = 'ellipse'">Ellipse</button>
      <button type="button" :class="{ on: tool === 'line' }" @click="tool = 'line'">Line</button>
      <button type="button" :class="{ on: tool === 'polygon' }" @click="tool = 'polygon'">Polygon</button>
      <button type="button" :class="{ on: tool === 'text' }" @click="tool = 'text'">Text</button>
      <button type="button" :class="{ on: tool === 'pin' }" @click="tool = 'pin'">Pin</button>
      <button type="button" :class="{ on: tool === 'free' }" @click="tool = 'free'">Free pin</button>
      <button type="button" @click="pickImage('place')">Image</button>
    </div>
    <input ref="imageFile" class="file" type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp,.svg,.png,.jpg,.jpeg,.webp" @change="onImageFile" />
    <svg
      ref="svgEl"
      class="symbol-canvas"
      :viewBox="viewBox"
      :width="symbol.width + pad * 2"
      :height="symbol.height + pad * 2"
      :data-shapes="symbol.shapes.length"
      :data-labels="symbol.labels.length"
      :data-pin-count="symbol.ports.length"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @dragover="onDragOver"
      @drop="onDrop"
    >
      <rect class="symbol-sheet" x="0" y="0" :width="symbol.width" :height="symbol.height" />
      <SymbolFace
        :width="symbol.width"
        :height="symbol.height"
        :shapes="symbol.shapes"
        :labels="symbol.labels"
        :assets="assets"
        :pins="pins"
        :leads="leads"
        :selected-shape="selected?.kind === 'shape' ? selected.index : null"
        :selected-pin="selected?.kind === 'pin' ? selected.id : null"
        :selected-label="selected?.kind === 'label' ? selected.id : null"
      />
      <polyline v-if="draft" class="sym-draft" :points="draft.map((point) => `${point.x},${point.y}`).join(' ')" />
    </svg>
    <p class="hint">{{ hint }}</p>
    <p class="hint">{{ instances }} instances on the sheet. t runs along the side.</p>
    <template v-if="selectedPin">
      <label>Pin <input :value="selectedPin.name" @change="commitPinName" /></label>
      <label>
        Side
        <select :value="selectedPin.side" @change="commitPinSide">
          <option value="left">left</option>
          <option value="right">right</option>
          <option value="top">top</option>
          <option value="bottom">bottom</option>
        </select>
      </label>
      <label>Position <input :value="selectedPin.t" type="number" min="0" max="1" step="0.05" @change="commitPinT" /></label>
      <template v-if="typeof selectedPin.x === 'number'">
        <label>X <input :value="selectedPin.x" type="number" min="0" max="1" step="0.01" @change="commitFree('x', $event)" /></label>
        <label>Y <input :value="selectedPin.y" type="number" min="0" max="1" step="0.01" @change="commitFree('y', $event)" /></label>
      </template>
      <button v-if="typeof selectedPin.x === 'number'" type="button" @click="bindPin">Bind to side</button>
      <button v-else type="button" @click="releasePin">Free position</button>
    </template>
    <template v-else-if="selectedImage">
      <label>X <input :value="selectedImage.x" type="number" @change="commitImage('x', $event)" /></label>
      <label>Y <input :value="selectedImage.y" type="number" @change="commitImage('y', $event)" /></label>
      <label>Image width <input :value="selectedImage.width" type="number" min="8" @change="commitImage('width', $event)" /></label>
      <label>Image height <input :value="selectedImage.height" type="number" min="8" @change="commitImage('height', $event)" /></label>
      <label><input type="checkbox" :checked="selectedImage.lockAspect !== false" @change="commitAspect" /> Keep aspect</label>
      <button type="button" @click="pickImage('replace')">Replace image</button>
    </template>
    <label v-else-if="selectedLabel">Text <input :value="selectedLabel.text" @change="commitLabel" /></label>
    <label>
      Category
      <select :value="symbol.categoryId ?? 'cat_user'" @change="commitCategory">
        <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option>
      </select>
    </label>
    <button type="button" @click="emit('saveLibrary')">Save to library</button>
    <button type="button" @click="emit('publish')">Publish revision</button>
    <button type="button" @click="emit('duplicate')">Duplicate symbol</button>
    <button type="button" @click="emit('exportLibrary')">Export library</button>
    <button type="button" @click="emit('importLibrary')">Import library</button>
    <button type="button" @click="emit('place')">Place instance</button>
    <button type="button" @click="emit('close')">Close symbol</button>
  </div>
</template>
