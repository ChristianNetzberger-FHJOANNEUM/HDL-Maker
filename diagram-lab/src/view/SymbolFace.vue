<script setup lang="ts">
import { computed } from 'vue'
import { assetDataUrl } from '../core/assets'
import type { ImageAsset, Point, PortSide, SymbolLabel, SymbolShape } from '../core/document'
import { fitSymbolShapes } from '../core/geometry'

export type FacePin = {
  id: string
  name: string
  side: PortSide
  x: number
  y: number
  missing?: boolean
  free?: boolean
  /** Guided pin (A2-P1) — radial pins use interior label anchor when set. */
  guided?: boolean
  /** Presentation-only label position (block/symbol local); horizontal text anchor is always middle. */
  labelX?: number
  labelY?: number
}

export type FaceLead = { x1: number; y1: number; x2: number; y2: number }

const props = defineProps<{
  width: number
  height: number
  shapes: SymbolShape[]
  labels: SymbolLabel[]
  pins: FacePin[]
  /** Derived radial connection leads (A2-P1) — not nets. */
  leads?: FaceLead[]
  assets?: ImageAsset[]
  /** Symbol definition size. When set, shapes are mapped into `width` and `height`. */
  symbolWidth?: number
  symbolHeight?: number
  selectedShape?: number | null
  selectedPin?: string | null
  selectedLabel?: string | null
  hit?: boolean
  /** When set, a pin pointer starts a sheet gesture instead of a palette drag. */
  interactivePins?: boolean
  hitRadius?: number
  /** Visible pin radius in the same units as `width`. The hit circle stays separate. */
  markRadius?: number
  /**
   * A single rectangular body is drawn on the instance outline.
   * Pin names sit inside that outline. The symbol definition is not changed.
   */
  flushBody?: boolean
  /** P1: when false, pin name glyphs are omitted; marks stay. Default true. */
  showPortNames?: boolean
  /**
   * P3 instance fill for closed shapes (rect / ellipse / polygon).
   * `null` = explicit transparent; `undefined` = CSS default (typically none).
   */
  bodyFill?: string | null
  /** P3 instance stroke for closed shapes. `undefined` = CSS default. */
  bodyStroke?: string
}>()

const emit = defineEmits<{
  portDown: [id: string, event: PointerEvent]
}>()

function onPinDown(pin: FacePin, event: PointerEvent): void {
  if (!props.interactivePins) return
  event.stopPropagation()
  event.preventDefault()
  emit('portDown', pin.id, event)
}

const drawn = computed(() => {
  const body = props.flushBody && props.shapes.length === 1 && props.shapes[0].kind === 'rect' ? props.shapes[0] : null
  if (body) {
    return {
      shapes: [{ ...body, x: 0, y: 0, width: props.width, height: props.height }],
      labels: props.labels.map((label) => ({
        ...label,
        x: body.width > 0 ? ((label.x - body.x) / body.width) * props.width : label.x,
        y: body.height > 0 ? ((label.y - body.y) / body.height) * props.height : label.y,
      })),
    }
  }
  if (!props.symbolWidth || !props.symbolHeight) return { shapes: props.shapes, labels: props.labels }
  return fitSymbolShapes(props.shapes, props.labels, props.symbolWidth, props.symbolHeight, props.width, props.height)
})

function pointsAttr(points: Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ')
}

function hrefFor(assetId: string): string | null {
  const asset = props.assets?.find((item) => item.id === assetId)
  return asset ? assetDataUrl(asset) : null
}

/** Inline style beats `.sym-shape { fill: none }` (presentation attrs lose to CSS). */
const closedPaintStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.bodyFill === null) style.fill = 'none'
  else if (typeof props.bodyFill === 'string') style.fill = props.bodyFill
  if (typeof props.bodyStroke === 'string') style.stroke = props.bodyStroke
  return Object.keys(style).length > 0 ? style : undefined
})

function nameAt(pin: FacePin): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  if (pin.guided && typeof pin.labelX === 'number' && typeof pin.labelY === 'number') {
    return { x: pin.labelX, y: pin.labelY + 3, anchor: 'middle' }
  }
  if (pin.free || pin.guided) return { x: pin.x, y: pin.y - 8, anchor: 'middle' }
  if (props.flushBody) {
    if (pin.side === 'left') return { x: pin.x + 8, y: pin.y + 3, anchor: 'start' }
    if (pin.side === 'right') return { x: pin.x - 8, y: pin.y + 3, anchor: 'end' }
    if (pin.side === 'top') return { x: pin.x, y: pin.y + 14, anchor: 'middle' }
    return { x: pin.x, y: pin.y - 6, anchor: 'middle' }
  }
  if (pin.side === 'left') return { x: pin.x - 6, y: pin.y + 3, anchor: 'end' }
  if (pin.side === 'right') return { x: pin.x + 6, y: pin.y + 3, anchor: 'start' }
  if (pin.side === 'top') return { x: pin.x, y: pin.y - 8, anchor: 'middle' }
  return { x: pin.x, y: pin.y + 14, anchor: 'middle' }
}
</script>

<template>
  <g class="symbol-face">
    <rect v-if="hit" class="symbol-hit" x="0" y="0" :width="width" :height="height" />
    <template v-for="(shape, index) in drawn.shapes" :key="index">
      <rect
        v-if="shape.kind === 'rect'"
        class="sym-shape"
        :class="{ selected: selectedShape === index }"
        :x="shape.x"
        :y="shape.y"
        :width="shape.width"
        :height="shape.height"
        :rx="shape.rx ?? 0"
        :ry="shape.rx ?? 0"
        :style="closedPaintStyle"
      />
      <ellipse
        v-else-if="shape.kind === 'ellipse'"
        class="sym-shape"
        :class="{ selected: selectedShape === index }"
        :cx="shape.x + shape.width / 2"
        :cy="shape.y + shape.height / 2"
        :rx="Math.abs(shape.width) / 2"
        :ry="Math.abs(shape.height) / 2"
        :style="closedPaintStyle"
      />
      <line
        v-else-if="shape.kind === 'line'"
        class="sym-shape"
        :class="{ selected: selectedShape === index }"
        :x1="shape.x1"
        :y1="shape.y1"
        :x2="shape.x2"
        :y2="shape.y2"
      />
      <polygon
        v-else-if="shape.kind === 'polygon'"
        class="sym-shape"
        :class="{ selected: selectedShape === index }"
        :points="pointsAttr(shape.points)"
        :style="closedPaintStyle"
      />
      <template v-else-if="shape.kind === 'image'">
        <image
          v-if="hrefFor(shape.assetId)"
          class="sym-image"
          :href="hrefFor(shape.assetId) ?? undefined"
          :x="shape.x"
          :y="shape.y"
          :width="shape.width"
          :height="shape.height"
          :preserveAspectRatio="shape.lockAspect === false ? 'none' : 'xMidYMid meet'"
        />
        <rect v-else class="sym-missing" :x="shape.x" :y="shape.y" :width="shape.width" :height="shape.height" />
        <rect v-if="selectedShape === index" class="sym-shape selected" :x="shape.x" :y="shape.y" :width="shape.width" :height="shape.height" />
      </template>
      <text v-else class="sym-label" :x="shape.x" :y="shape.y">{{ shape.text }}</text>
    </template>
    <!-- A2-P1: derived radial leads (not nets); paint with symbol stroke. -->
    <line
      v-for="(lead, index) in leads ?? []"
      :key="`lead-${index}`"
      class="sym-shape sym-lead"
      :x1="lead.x1"
      :y1="lead.y1"
      :x2="lead.x2"
      :y2="lead.y2"
      :style="closedPaintStyle"
    />
    <text
      v-for="label in drawn.labels"
      :key="label.id"
      class="sym-label"
      :class="{ selected: selectedLabel === label.id }"
      :x="label.x"
      :y="label.y"
    >{{ label.text }}</text>
    <g
      v-for="pin in pins"
      :key="pin.id"
      class="sym-pin"
      :class="{ selected: selectedPin === pin.id, missing: pin.missing, live: interactivePins }"
      :data-port="pin.id"
      @pointerdown="onPinDown(pin, $event)"
      @click.stop
      @dblclick.stop
    >
      <circle v-if="interactivePins" class="sym-pin-hit" :cx="pin.x" :cy="pin.y" :r="hitRadius ?? 8" />
      <circle class="sym-pin-mark" :cx="pin.x" :cy="pin.y" :r="markRadius ?? 4" />
      <text
        v-if="showPortNames !== false"
        :x="nameAt(pin).x"
        :y="nameAt(pin).y"
        :text-anchor="nameAt(pin).anchor"
      >{{ pin.name }}</text>
    </g>
  </g>
</template>
