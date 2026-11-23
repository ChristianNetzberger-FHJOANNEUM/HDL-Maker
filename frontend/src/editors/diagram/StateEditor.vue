<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { EditableState, EditableTextBox, EditableTransition } from '../../models/editable'
import { useStudioStore } from '../../stores/studio'
import { mapX, mapY, sourceDelta } from './geometry'
import { fitZoomFor, readableTextBox, usePaneWidth } from './textLayout'

const studio = useStudioStore()
const { viewport, fitView } = useVueFlow({ id: 'state-editor' })
const pane = usePaneWidth()
const fittedFor = ref('')
const dragStart = ref<{ id: string; x: number; y: number } | null>(null)
const resize = ref<{ id: string; cx: number; cy: number; width: number; height: number } | null>(null)

const diagram = computed(() => (studio.editable?.kind === 'state' ? studio.editable : null))
const states = computed(() => diagram.value?.states ?? [])
const transitions = computed(() => diagram.value?.transitions ?? [])
const textBoxes = computed(() => diagram.value?.text_boxes ?? [])
const selectedState = computed(() => {
  if (studio.selection?.kind !== 'state') return null
  return states.value.find((item) => item.id === studio.selection?.id) ?? null
})
const selectedTransition = computed(() => {
  if (studio.selection?.kind !== 'transition') return null
  return transitions.value.find((item) => item.id === studio.selection?.id) ?? null
})

const graph = computed(() => {
  const doc = diagram.value
  if (!doc) return { nodes: [] }
  const frame = doc.frame
  const projectX = (value: number) => mapX(frame.origin_x, frame.scale, value)
  const projectY = (value: number) => mapY(frame.origin_y, frame.scale, value)
  const screenX = states.value.flatMap((state) => [projectX(state.x), projectX(state.x + state.width)])
  const screenY = states.value.flatMap((state) => [projectY(state.y), projectY(state.y - state.height)])
  for (const transition of transitions.value) {
    for (const point of transition.points) {
      screenX.push(projectX(point.x))
      screenY.push(projectY(point.y))
    }
  }
  for (const box of textBoxes.value) {
    screenX.push(projectX(box.x), projectX(box.x + box.width))
    screenY.push(projectY(box.y), projectY(box.y - box.height))
  }
  const left = screenX.length ? Math.min(...screenX) : 0
  const top = screenY.length ? Math.min(...screenY) : 0
  const width = Math.max((screenX.length ? Math.max(...screenX) : 1) - left, 1)
  const height = Math.max((screenY.length ? Math.max(...screenY) : 1) - top, 1)
  const routes = transitions.value
    .filter((transition) => transition.points.length >= 2)
    .map((transition) =>
      transition.points.map((point) => `${projectX(point.x) - left},${projectY(point.y) - top}`).join(' '),
    )
  const fitZoom = fitZoomFor(pane.width.value, width)
  const nodes = [
    {
      id: 'routes',
      type: 'routes',
      position: { x: left, y: top },
      draggable: false,
      selectable: false,
      zIndex: 0,
      data: { routes, width, height },
      style: { width: `${width}px`, height: `${height}px` },
    },
    ...states.value.map((state) => ({
      id: state.id,
      type: 'state',
      position: { x: projectX(state.x), y: projectY(state.y) },
      draggable: true,
      zIndex: 1,
      data: { title: state.name },
      style: { width: `${Math.max(state.width * frame.scale, 2)}px`, height: `${Math.max(state.height * frame.scale, 2)}px` },
    })),
    ...textBoxes.value.map((box) => {
      const readable = readableTextBox(
        textOf(box.id),
        box.width * frame.scale,
        box.height * frame.scale,
        fitZoom,
        studio.stateTextPx,
      )
      return {
        id: box.id,
        type: 'text',
        position: { x: projectX(box.x), y: projectY(box.y) },
        draggable: true,
        zIndex: 2,
        data: { role: box.role, fontSize: readable.fontSize, lineHeight: readable.lineHeight },
        style: { width: `${readable.width}px`, height: `${readable.height}px` },
      }
    }),
  ]
  return { nodes }
})

function onDragStart(event: { node: { id: string; position: { x: number; y: number } } }): void {
  if (event.node.id === 'routes') return
  dragStart.value = { id: event.node.id, x: event.node.position.x, y: event.node.position.y }
}

function onDragStop(event: { node: { id: string; position: { x: number; y: number } } }): void {
  const doc = diagram.value
  const start = dragStart.value
  dragStart.value = null
  if (!doc || !start || start.id !== event.node.id) return
  const delta = sourceDelta(doc.frame.scale, event.node.position.x - start.x, event.node.position.y - start.y)
  if (delta.dx === 0 && delta.dy === 0) return
  const box = textBoxes.value.find((item) => item.id === start.id)
  studio.commit()
  if (box) {
    box.x += delta.dx
    box.y += delta.dy
    return
  }
  moveState(start.id, delta.dx, delta.dy)
}

function moveState(id: string, dx: number, dy: number): void {
  const state = states.value.find((item) => item.id === id)
  if (!state) return
  state.x += dx
  state.y += dy
  for (const transition of transitions.value) {
    const atStart = transition.start_state_id === id
    const atEnd = transition.end_state_id === id
    if (!atStart && !atEnd) continue
    if (atStart && atEnd) {
      for (const point of transition.points) {
        point.x += dx
        point.y += dy
      }
      continue
    }
    const point = atStart ? transition.points[0] : transition.points[transition.points.length - 1]
    if (!point) continue
    point.x += dx
    point.y += dy
  }
}

function onNodeClick(event: { node: { id: string } }): void {
  if (event.node.id === 'routes') return
  if (textBoxes.value.some((item) => item.id === event.node.id)) {
    studio.selection = { kind: 'text', id: event.node.id }
    return
  }
  if (states.value.some((item) => item.id === event.node.id)) {
    studio.selection = { kind: 'state', id: event.node.id }
  }
}

function textOf(id: string): string {
  const box = textBoxes.value.find((item) => item.id === id)
  const owner = box ? ownerOf(box.owner_id) : null
  if (!box || !owner) return ''
  return readField(owner, box.role) ?? ''
}

function setText(id: string, value: string): void {
  const box = textBoxes.value.find((item) => item.id === id)
  const owner = box ? ownerOf(box.owner_id) : null
  if (!box || !owner) return
  writeField(owner, box.role, value.trim() ? value : null)
}

function ownerOf(id: string): EditableState | EditableTransition | null {
  return states.value.find((item) => item.id === id) ?? transitions.value.find((item) => item.id === id) ?? null
}

function readField(owner: EditableState | EditableTransition, role: EditableTextBox['role']): string | null {
  if (role === 'entry') return 'entry_actions' in owner ? owner.entry_actions : null
  if (role === 'during') return 'during_actions' in owner ? owner.during_actions : null
  if (role === 'exit') return 'exit_actions' in owner ? owner.exit_actions : null
  if (role === 'condition') return 'condition' in owner ? owner.condition : null
  return 'actions' in owner ? owner.actions : null
}

function writeField(owner: EditableState | EditableTransition, role: EditableTextBox['role'], value: string | null): void {
  if (role === 'entry' && 'entry_actions' in owner) owner.entry_actions = value
  else if (role === 'during' && 'during_actions' in owner) owner.during_actions = value
  else if (role === 'exit' && 'exit_actions' in owner) owner.exit_actions = value
  else if (role === 'condition' && 'condition' in owner) owner.condition = value
  else if (role === 'actions' && 'actions' in owner) owner.actions = value
}

function startResize(id: string, event: PointerEvent): void {
  const box = textBoxes.value.find((item) => item.id === id)
  const doc = diagram.value
  if (!box || !doc) return
  studio.commit()
  const shown = readableTextBox(
    textOf(id),
    box.width * doc.frame.scale,
    box.height * doc.frame.scale,
    fitZoomFor(pane.width.value, 1100),
    studio.stateTextPx,
  )
  resize.value = {
    id,
    cx: event.clientX,
    cy: event.clientY,
    width: Math.max(box.width, Math.round(shown.width / doc.frame.scale)),
    height: Math.max(box.height, Math.round(shown.height / doc.frame.scale)),
  }
  window.addEventListener('pointermove', onResize)
  window.addEventListener('pointerup', endResize)
}

function onResize(event: PointerEvent): void {
  const start = resize.value
  const doc = diagram.value
  const box = start ? textBoxes.value.find((item) => item.id === start.id) : null
  if (!start || !doc || !box) return
  const zoom = viewport.value.zoom || 1
  const delta = sourceDelta(doc.frame.scale, (event.clientX - start.cx) / zoom, (event.clientY - start.cy) / zoom)
  box.width = Math.max(start.width + delta.dx, 400)
  box.height = Math.max(start.height - delta.dy, 400)
}

function endResize(): void {
  resize.value = null
  window.removeEventListener('pointermove', onResize)
  window.removeEventListener('pointerup', endResize)
}

onBeforeUnmount(endResize)

watch(
  () => [diagram.value?.id ?? '', pane.width.value] as const,
  async ([id, width]) => {
    if (!id || width < 200 || fittedFor.value === id) return
    fittedFor.value = id
    await nextTick()
    await fitView({ padding: 0.12 })
  },
)

function selectTransition(id: string): void {
  studio.selection = { kind: 'transition', id }
}

function write(item: EditableState | EditableTransition, key: 'name' | 'entry_actions' | 'during_actions' | 'exit_actions' | 'condition' | 'actions' | 'priority', value: string): void {
  const text = value.trim() ? value : null
  if (key === 'name') {
    ;(item as EditableState).name = value
    return
  }
  ;(item as unknown as Record<string, string | null>)[key] = text
}

function stateName(id: string | null): string {
  if (!id) return 'anchor'
  return states.value.find((item) => item.id === id)?.name || 'unnamed'
}

function transitionLabel(transition: EditableTransition): string {
  return transition.condition || `${stateName(transition.start_state_id)} → ${stateName(transition.end_state_id)}`
}
</script>

<template>
  <div class="state-editor">
    <div class="toolbar">
      <button type="button" @click="studio.saveEditable()">Save</button>
      <button type="button" :disabled="!studio.canUndo" @click="studio.undo()">Undo</button>
      <button type="button" :disabled="!studio.canRedo" @click="studio.redo()">Redo</button>
      <span>{{ states.length }} states · {{ transitions.length }} transitions · {{ textBoxes.length }} text boxes</span>
    </div>
    <div class="body">
      <div :ref="pane.bind" class="canvas-host">
      <VueFlow
        v-if="diagram"
        id="state-editor"
        class="canvas"
        :nodes="graph.nodes"
        :edges="[]"
        :nodes-connectable="false"
        :fit-view-on-init="true"
        :min-zoom="0.05"
        :max-zoom="4"
        @node-drag-start="onDragStart"
        @node-drag-stop="onDragStop"
        @node-click="onNodeClick"
      >
        <template #node-state="{ data }">
          <div class="state">{{ data.title }}</div>
        </template>
        <template #node-text="{ id, data }">
          <div class="text-box">
            <textarea
              class="nodrag nopan nowheel"
              :style="{ fontSize: `${data.fontSize}px`, lineHeight: `${data.lineHeight}px` }"
              :value="textOf(id)"
              spellcheck="false"
              @focus="studio.beginChange()"
              @blur="studio.endChange()"
              @input="setText(id, ($event.target as HTMLTextAreaElement).value)"
            />
            <span class="resize nodrag nopan" @pointerdown.stop="startResize(id, $event)" />
          </div>
        </template>
        <template #node-routes="{ data }">
          <svg class="routes" :width="data.width" :height="data.height">
            <polyline v-for="(points, index) in data.routes" :key="index" :points="points" />
          </svg>
        </template>
        <Background />
        <Controls :show-interactive="false" />
      </VueFlow>
      </div>
      <aside class="inspector">
        <label v-if="selectedState">
          Name
          <input
            :value="selectedState.name"
            @focus="studio.beginChange()"
            @blur="studio.endChange()"
            @input="write(selectedState, 'name', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label v-if="selectedState">
          Entry
          <textarea
            :value="selectedState.entry_actions ?? ''"
            @focus="studio.beginChange()"
            @blur="studio.endChange()"
            @input="write(selectedState, 'entry_actions', ($event.target as HTMLTextAreaElement).value)"
          />
        </label>
        <label v-if="selectedState">
          During
          <textarea
            :value="selectedState.during_actions ?? ''"
            @focus="studio.beginChange()"
            @blur="studio.endChange()"
            @input="write(selectedState, 'during_actions', ($event.target as HTMLTextAreaElement).value)"
          />
        </label>
        <label v-if="selectedState">
          Exit
          <textarea
            :value="selectedState.exit_actions ?? ''"
            @focus="studio.beginChange()"
            @blur="studio.endChange()"
            @input="write(selectedState, 'exit_actions', ($event.target as HTMLTextAreaElement).value)"
          />
        </label>
        <p v-if="selectedState && selectedState.encoding" class="meta">Encoding {{ selectedState.encoding }}</p>
        <p v-if="selectedState && selectedState.wait_text" class="meta">{{ selectedState.wait_text }}</p>
        <label v-if="selectedTransition">
          Condition
          <textarea
            :value="selectedTransition.condition ?? ''"
            @focus="studio.beginChange()"
            @blur="studio.endChange()"
            @input="write(selectedTransition, 'condition', ($event.target as HTMLTextAreaElement).value)"
          />
        </label>
        <label v-if="selectedTransition">
          Actions
          <textarea
            :value="selectedTransition.actions ?? ''"
            @focus="studio.beginChange()"
            @blur="studio.endChange()"
            @input="write(selectedTransition, 'actions', ($event.target as HTMLTextAreaElement).value)"
          />
        </label>
        <label v-if="selectedTransition">
          Priority
          <input
            :value="selectedTransition.priority ?? ''"
            @focus="studio.beginChange()"
            @blur="studio.endChange()"
            @input="write(selectedTransition, 'priority', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <p class="meta">Transitions</p>
        <button
          v-for="transition in transitions"
          :key="transition.id"
          type="button"
          class="jump"
          @click="selectTransition(transition.id)"
        >
          {{ transitionLabel(transition) }}
        </button>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.state-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  font-size: 12px;
}

.body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.canvas-host {
  flex: 1;
  min-width: 0;
}

.canvas {
  width: 100%;
  height: 100%;
  background: #f4f6f8;
}

.canvas :deep(.vue-flow__node-text),
.canvas :deep(.vue-flow__node-state) {
  padding: 0;
  border: none;
  background: transparent;
}

.inspector {
  width: 240px;
  overflow: auto;
  padding: 8px 12px 16px;
  border-left: 1px solid #d5dbe3;
  background: #fff;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 8px 0;
  font-size: 12px;
  color: #3d4754;
}

input,
textarea {
  font: inherit;
  color: #16324f;
}

textarea {
  min-height: 52px;
  resize: vertical;
}

.meta {
  margin: 8px 0 4px;
  color: #5c6775;
  font-size: 12px;
}

.jump {
  display: block;
  width: 100%;
  margin: 0 0 4px;
  text-align: left;
  font-size: 11px;
}

.state {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  border: 1px solid #0b5cab;
  border-radius: 50%;
  background: rgba(229, 240, 250, 0.94);
  color: #16324f;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 11px;
  overflow: hidden;
  padding: 4px;
}

.routes {
  overflow: visible;
  pointer-events: none;
}

.routes polyline {
  fill: none;
  stroke: #3d4754;
  stroke-width: 1.5;
}

.text-box {
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  border: 1px solid #5c6775;
  background: rgba(255, 255, 255, 0.94);
}

.text-box textarea {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  border: 0;
  margin: 0;
  padding: 4px 6px;
  resize: none;
  overflow: hidden;
  background: transparent;
  color: #16324f;
  font-family: Consolas, 'Courier New', monospace;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  min-height: 0;
}

.resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 10px;
  height: 10px;
  background: #0b5cab;
  cursor: nwse-resize;
}
</style>
