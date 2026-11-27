<script setup lang="ts">
import { computed } from 'vue'
import type { BlockStyle, ImageAsset, Port, SymbolLabel, SymbolShape } from '../core/document'
import type { FormattedTextResult } from '../core/formattedTextRender'
import type { MathRenderResult } from '../core/mathRender'
import { portsOnSide } from '../core/geometry'
import { RESIZE_HANDLES, type ResizeHandle } from '../core/edit'
import SymbolFace, { type FaceLead, type FacePin } from './SymbolFace.vue'

const props = defineProps<{
  blockId: string
  name: string
  width: number
  height: number
  ports: Array<Port & { top?: number; left?: number; missing?: boolean; guided?: boolean }>
  /** Derived radial connection leads (A2-P1). */
  leads?: FaceLead[]
  shapes: SymbolShape[] | null
  labels: SymbolLabel[]
  assets: ImageAsset[]
  selected: boolean
  handles: boolean
  zoom: number
  symbolWidth?: number
  symbolHeight?: number
  portsLive?: boolean
  selectedPort?: string | null
  /** P1: omit/true draws the instance name; false hides the glyph only. */
  showName?: boolean
  /** P1: omit/true draws port name glyphs; false keeps pin marks. */
  showPortNames?: boolean
  /** P2: centred multiline caption; independent of `name`. */
  displayText?: string | null
  /** A2-P3a: plain vs LaTeX for `displayText`. */
  displayTextFormat?: 'plain' | 'latex' | 'markdown'
  /** Runtime MathJax SVG for LaTeX display text (not persisted). */
  displayMath?: MathRenderResult | null
  /** Runtime formatted SVG for Markdown (A2-P4). */
  displayFormatted?: FormattedTextResult | null
  /** P2: omit/true draws display text when set; false hides it. */
  showDisplayText?: boolean
  /** P3a: offset from block centre in diagram units; omit/0 = centred. */
  displayTextOffsetX?: number
  displayTextOffsetY?: number
  /** P3: optional instance appearance overrides. */
  appearance?: BlockStyle | null
}>()

const emit = defineEmits<{
  nudge: [id: string, dx: number, dy: number]
  context: [id: string, event: MouseEvent]
  resizeStart: [id: string, handle: ResizeHandle, event: PointerEvent]
  resizeMove: [event: PointerEvent]
  resizeEnd: []
  resizeCancel: []
  portDown: [blockId: string, portId: string, event: PointerEvent]
  displayTextDown: [blockId: string, event: PointerEvent]
}>()

const handleLayout: Record<ResizeHandle, { x: string; y: string; cursor: string }> = {
  nw: { x: '0%', y: '0%', cursor: 'nwse-resize' },
  n: { x: '50%', y: '0%', cursor: 'ns-resize' },
  ne: { x: '100%', y: '0%', cursor: 'nesw-resize' },
  w: { x: '0%', y: '50%', cursor: 'ew-resize' },
  e: { x: '100%', y: '50%', cursor: 'ew-resize' },
  sw: { x: '0%', y: '100%', cursor: 'nesw-resize' },
  s: { x: '50%', y: '100%', cursor: 'ns-resize' },
  se: { x: '100%', y: '100%', cursor: 'nwse-resize' },
}

const handlePx = computed(() => {
  const zoom = props.zoom > 0 ? props.zoom : 1
  return 12 / zoom
})

const markPx = computed(() => {
  const zoom = props.zoom > 0 ? props.zoom : 1
  return 3.5 / zoom
})

const hitPx = computed(() => Math.max(handlePx.value, 8) * 2)

const displayFormat = computed(() => props.displayTextFormat ?? 'plain')

const hasDisplayContent = computed(() => {
  const text = props.displayText
  if (!text || props.showDisplayText === false) return false
  if (displayFormat.value === 'latex' || displayFormat.value === 'markdown') return text.trim().length > 0
  return true
})

const displayLines = computed(() => {
  const text = props.displayText
  if (!text || props.showDisplayText === false || displayFormat.value !== 'plain') return []
  return text.split('\n')
})

const appearance = computed(() => props.appearance ?? null)

/** Closed-shape fill for SymbolFace: null = explicit transparent; undefined = default. */
const bodyFill = computed((): string | null | undefined => {
  const style = appearance.value
  if (!style) return undefined
  if (style.fillTransparent) return null
  if (typeof style.fill === 'string' && style.fill.length > 0) return style.fill
  return undefined
})

const bodyStroke = computed(() => {
  const stroke = appearance.value?.stroke
  return typeof stroke === 'string' && stroke.length > 0 ? stroke : undefined
})

const displayColor = computed(() => {
  const text = appearance.value?.text
  return typeof text === 'string' && text.length > 0 ? text : undefined
})

/** P3a: centre + optional offset; (0,0) keeps P2 automatic centring. */
const displayStyle = computed(() => {
  const ox = props.displayTextOffsetX ?? 0
  const oy = props.displayTextOffsetY ?? 0
  const css: Record<string, string> = {
    transform: `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`,
  }
  if (displayColor.value) css.color = displayColor.value
  return css
})

/**
 * Blocks without a symbol (Boundary, and plain blocks that gained ports) draw through SymbolFace.
 * One flush rectangle puts the pin names inside the outline, the same way a functional rectangle does.
 */
const drawnShapes = computed((): SymbolShape[] | null => {
  if (props.shapes) return props.shapes
  if (props.ports.length === 0) return null
  return [{ kind: 'rect', x: 0, y: 0, width: props.width, height: props.height, rx: 4 }]
})

/** Plain CSS box (no SymbolFace): background / border from P3. */
const plainBoxStyle = computed(() => {
  if (drawnShapes.value !== null) return {}
  const style = appearance.value
  if (!style) return {}
  const css: Record<string, string> = {}
  if (style.fillTransparent) css.background = 'transparent'
  else if (typeof style.fill === 'string' && style.fill.length > 0) css.background = style.fill
  if (typeof style.stroke === 'string' && style.stroke.length > 0) css.borderColor = style.stroke
  return css
})

const flushBody = computed(() => drawnShapes.value?.length === 1 && drawnShapes.value[0].kind === 'rect' && props.ports.length > 0)

const symbolPins = computed<FacePin[]>(() =>
  props.ports.map((port) => ({
    id: port.id,
    name: port.name,
    side: port.side,
    x: port.left ?? (port.side === 'left' ? 0 : props.width),
    y: port.top ?? 0,
    missing: port.missing,
    free: typeof port.x === 'number' && typeof port.y === 'number',
    guided: Boolean(port.guided),
  })),
)

function top(port: Port & { top?: number }): number {
  if (typeof port.top === 'number') return port.top
  const side = portsOnSide(props.ports, port.blockId, port.side)
  const index = side.findIndex((item) => item.id === port.id)
  return (props.height * (index + 1)) / (side.length + 1)
}

function onContext(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  emit('context', props.blockId, event)
}

function onHandleDown(handle: ResizeHandle, event: PointerEvent): void {
  event.stopPropagation()
  event.preventDefault()
  emit('resizeStart', props.blockId, handle, event)
  try {
    ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
  } catch {
    // The window listener still receives the drag when capture is unavailable.
  }
}

function onHandleMove(event: PointerEvent): void {
  const target = event.currentTarget as Element
  if (!target.hasPointerCapture?.(event.pointerId)) return
  emit('resizeMove', event)
}

function onHandleUp(event: PointerEvent): void {
  event.stopPropagation()
  emit('resizeEnd')
}

function onHandleCancel(event: PointerEvent): void {
  event.stopPropagation()
  emit('resizeCancel')
}

function onHandleLostCapture(): void {
  // Parent ignores this when the gesture already committed or cancelled (close latch).
  emit('resizeCancel')
}

function onPortDown(portId: string, event: PointerEvent): void {
  event.stopPropagation()
  event.preventDefault()
  emit('portDown', props.blockId, portId, event)
}

/** Selected-only: nodrag/nopan + stop so Vue Flow does not start a block drag (P3a). */
function onDisplayTextDown(event: PointerEvent): void {
  if (!props.selected || !hasDisplayContent.value) return
  if (event.button !== 0) return
  event.stopPropagation()
  event.preventDefault()
  emit('displayTextDown', props.blockId, event)
}

function onKey(event: KeyboardEvent): void {
  const step = 20
  if (event.key === 'ArrowRight') emit('nudge', props.blockId, step, 0)
  else if (event.key === 'ArrowLeft') emit('nudge', props.blockId, -step, 0)
  else if (event.key === 'ArrowDown') emit('nudge', props.blockId, 0, step)
  else if (event.key === 'ArrowUp') emit('nudge', props.blockId, 0, -step)
  else return
  event.preventDefault()
}
</script>

<template>
  <div
    class="block"
    :class="{ selected, symbol: drawnShapes !== null }"
    role="group"
    tabindex="0"
    :aria-label="name"
    :style="{ width: `${width}px`, height: `${height}px`, '--port-mark': `${markPx * 2}px`, ...plainBoxStyle }"
    @contextmenu="onContext"
    @keydown="onKey"
  >
    <button v-show="showName !== false" type="button" class="block-name">{{ name }}</button>
    <div
      v-if="hasDisplayContent"
      class="block-display nodrag nopan"
      :class="{ movable: selected, math: displayFormat === 'latex', formatted: displayFormat === 'markdown' }"
      aria-hidden="true"
      :style="displayStyle"
      @pointerdown="onDisplayTextDown"
    >
      <template v-if="displayFormat === 'latex'">
        <div
          v-if="displayMath?.ok"
          class="block-display-math"
          v-html="displayMath.svg"
        />
        <span v-else class="block-display-line block-display-math-fallback">{{ displayText }}</span>
      </template>
      <template v-else-if="displayFormat === 'markdown'">
        <div
          v-if="displayFormatted?.ok"
          class="block-display-formatted"
          v-html="displayFormatted.svg"
        />
        <span v-else class="block-display-line block-display-math-fallback">{{ displayText }}</span>
      </template>
      <template v-else>
        <span v-for="(line, index) in displayLines" :key="index" class="block-display-line">{{ line.length ? line : '\u00a0' }}</span>
      </template>
    </div>
    <svg v-if="drawnShapes" class="symbol-node" :viewBox="`0 0 ${width} ${height}`" :width="width" :height="height">
      <SymbolFace
        :width="width"
        :height="height"
        :symbol-width="symbolWidth"
        :symbol-height="symbolHeight"
        :shapes="drawnShapes"
        :labels="labels"
        :assets="assets"
        :pins="symbolPins"
        :leads="leads ?? []"
        hit
        :interactive-pins="portsLive"
        :hit-radius="Math.max(handlePx, 8)"
        :mark-radius="markPx"
        :flush-body="flushBody"
        :selected-pin="selectedPort"
        :show-port-names="showPortNames !== false"
        :body-fill="bodyFill"
        :body-stroke="bodyStroke"
        @port-down="onPortDown"
      />
    </svg>
    <button
      v-for="handle in handles ? RESIZE_HANDLES : []"
      :key="handle"
      type="button"
      class="resize-handle nodrag nopan"
      :data-resize="handle"
      :style="{
        left: handleLayout[handle].x,
        top: handleLayout[handle].y,
        width: `${handlePx}px`,
        height: `${handlePx}px`,
        cursor: handleLayout[handle].cursor,
      }"
      :aria-label="handle"
      @pointerdown="onHandleDown(handle, $event)"
      @pointermove="onHandleMove"
      @pointerup="onHandleUp"
      @pointercancel="onHandleCancel"
      @lostpointercapture="onHandleLostCapture"
      @dblclick.stop
      @click.stop
    />
    <button
      v-for="port in drawnShapes ? [] : ports"
      :key="port.id"
      type="button"
      class="port nodrag nopan"
      :class="{ selected: port.id === selectedPort }"
      :data-port="port.id"
      :aria-label="port.name"
      :title="port.name"
      :style="{ left: `${port.left ?? 0}px`, top: `${port.top ?? top(port)}px`, width: `${hitPx}px`, height: `${hitPx}px` }"
      @pointerdown="onPortDown(port.id, $event)"
      @click.stop
      @dblclick.stop
    />
  </div>
</template>
