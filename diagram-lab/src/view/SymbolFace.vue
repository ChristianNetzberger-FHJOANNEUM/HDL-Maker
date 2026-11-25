<script setup lang="ts">
import { assetDataUrl } from '../core/assets'
import type { ImageAsset, Point, PortSide, SymbolLabel, SymbolShape } from '../core/document'

export type FacePin = {
  id: string
  name: string
  side: PortSide
  x: number
  y: number
  missing?: boolean
  free?: boolean
}

const props = defineProps<{
  width: number
  height: number
  shapes: SymbolShape[]
  labels: SymbolLabel[]
  pins: FacePin[]
  assets?: ImageAsset[]
  selectedShape?: number | null
  selectedPin?: string | null
  selectedLabel?: string | null
  hit?: boolean
}>()

function pointsAttr(points: Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ')
}

function hrefFor(assetId: string): string | null {
  const asset = props.assets?.find((item) => item.id === assetId)
  return asset ? assetDataUrl(asset) : null
}

function nameAt(pin: FacePin): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  if (pin.free) return { x: pin.x, y: pin.y - 8, anchor: 'middle' }
  if (pin.side === 'left') return { x: pin.x - 6, y: pin.y + 3, anchor: 'end' }
  if (pin.side === 'right') return { x: pin.x + 6, y: pin.y + 3, anchor: 'start' }
  if (pin.side === 'top') return { x: pin.x, y: pin.y - 8, anchor: 'middle' }
  return { x: pin.x, y: pin.y + 14, anchor: 'middle' }
}
</script>

<template>
  <g class="symbol-face">
    <rect v-if="hit" class="symbol-hit" x="0" y="0" :width="width" :height="height" />
    <template v-for="(shape, index) in shapes" :key="index">
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
      />
      <ellipse
        v-else-if="shape.kind === 'ellipse'"
        class="sym-shape"
        :class="{ selected: selectedShape === index }"
        :cx="shape.x + shape.width / 2"
        :cy="shape.y + shape.height / 2"
        :rx="Math.abs(shape.width) / 2"
        :ry="Math.abs(shape.height) / 2"
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
    <text
      v-for="label in labels"
      :key="label.id"
      class="sym-label"
      :class="{ selected: selectedLabel === label.id }"
      :x="label.x"
      :y="label.y"
    >{{ label.text }}</text>
    <g v-for="pin in pins" :key="pin.id" class="sym-pin" :class="{ selected: selectedPin === pin.id, missing: pin.missing }">
      <circle :cx="pin.x" :cy="pin.y" r="4" />
      <text :x="nameAt(pin).x" :y="nameAt(pin).y" :text-anchor="nameAt(pin).anchor">{{ pin.name }}</text>
    </g>
  </g>
</template>
