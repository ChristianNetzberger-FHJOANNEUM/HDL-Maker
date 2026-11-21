<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ParseStatus, Port } from '../models/design'
import { newDiagramId } from '../models/editable'
import { splitEndpoint } from '../editors/diagram/nets'
import { describedWidth } from '../editors/diagram/validate'
import { useStudioStore } from '../stores/studio'

const studio = useStudioStore()

const selectedInstance = computed(() => {
  if (studio.selection?.kind !== 'instance') return null
  return studio.editable?.instances.find((item) => item.id === studio.selection?.id) ?? null
})

const selectedBlock = computed(() => {
  if (studio.selection?.kind !== 'embedded') return null
  return studio.editable?.embedded_blocks.find((item) => item.id === studio.selection?.id) ?? null
})

const selectedWire = computed(() => {
  if (studio.selection?.kind !== 'wire') return null
  return studio.editable?.wires.find((item) => item.id === studio.selection?.id) ?? null
})

const selectedNet = computed(() => {
  const netId = selectedWire.value?.net_id
  if (!netId) return null
  return studio.editable?.nets.find((item) => item.id === netId) ?? null
})

const selectedDiagramPort = computed(() => {
  if (studio.selection?.kind !== 'port') return null
  return studio.editable?.diagram_ports.find((item) => item.id === studio.selection?.id) ?? null
})

const portName = ref('')
const portDirection = ref<'in' | 'out' | 'inout' | 'buffer' | 'linkage'>('in')
const portType = ref('std_logic')
const portRange = ref('')
const portDefault = ref('')
const genericName = ref('')
const genericType = ref('')
const genericDefault = ref('')

const statusText: Record<ParseStatus, string> = {
  parsed: 'Interface read',
  partial: 'Interface incomplete',
  skipped: 'Listed only',
  unsupported: 'Not read',
}

function addInterfacePort(): void {
  const doc = studio.editable
  const name = portName.value.trim()
  if (!doc || !name) return
  studio.commit()
  const described = describedWidth(blank(portType.value), blank(portRange.value))
  const outgoing = portDirection.value === 'out' || portDirection.value === 'buffer'
  doc.diagram_ports.push({
    id: newDiagramId('port'),
    name,
    direction: portDirection.value,
    type_text: blank(portType.value),
    range_text: blank(portRange.value),
    width: described.width,
    width_status: described.width_status,
    default_text: blank(portDefault.value),
    hds_object: null,
    x: doc.frame.origin_x + (outgoing ? 28000 : 0),
    y: doc.frame.origin_y - doc.diagram_ports.length * 4000,
    box_width: 6400,
    box_height: 1600,
  })
  portName.value = ''
  portDefault.value = ''
}

function refreshPortWidth(): void {
  const port = selectedDiagramPort.value
  if (!port) return
  const described = describedWidth(port.type_text, port.range_text)
  port.width = described.width
  port.width_status = described.width_status
}

function addDesignGeneric(): void {
  const doc = studio.editable
  const name = genericName.value.trim()
  if (!doc || !name) return
  studio.commit()
  doc.generics.push({
    id: newDiagramId('gen'),
    name,
    type_text: blank(genericType.value),
    default_text: blank(genericDefault.value),
  })
  genericName.value = ''
  genericType.value = ''
  genericDefault.value = ''
}

function removeGeneric(id: string): void {
  const doc = studio.editable
  if (!doc) return
  studio.commit()
  doc.generics = doc.generics.filter((item) => item.id !== id)
}

function setSlice(event: Event): void {
  const wire = selectedWire.value
  const doc = studio.editable
  if (!wire || !doc) return
  const text = (event.target as HTMLInputElement).value.trim()
  wire.slice_text = text || null
  const start = wire.start
  if (!start?.port_id) return
  const endpoint = doc.nets
    .find((net) => net.id === wire.net_id)
    ?.endpoints.find((item) => item.kind === start.kind && item.owner_id === start.owner_id && item.port_id === start.port_id)
  if (endpoint) endpoint.slice_text = wire.slice_text
}

function split(which: 'start' | 'end'): void {
  const doc = studio.editable
  const wire = selectedWire.value
  if (!doc || !wire) return
  const end = which === 'start' ? wire.start : wire.end
  if (!end?.port_id || (end.kind !== 'instance' && end.kind !== 'diagram_port')) {
    studio.error = 'This end is not an HDL port.'
    return
  }
  const net = doc.nets.find((item) => item.id === wire.net_id)
  if (!net || net.endpoints.length < 2) {
    studio.error = 'This net has nothing to split.'
    return
  }
  studio.commit()
  studio.error = splitEndpoint(doc, wire.id, which) ?? ''
  if (!doc.wires.some((item) => item.id === wire.id)) studio.selection = null
}

function blank(value: string): string | null {
  const text = value.trim()
  return text || null
}

function widthText(port: Port): string {
  if (port.width_status === 'literal' || port.width_status === 'scalar') {
    return port.width === null ? port.width_status : String(port.width)
  }
  if (port.width_status === 'not_applicable') return 'n/a'
  return 'unresolved'
}
</script>

<template>
  <aside class="properties">
    <h2>Properties</h2>
    <template v-if="studio.editing && studio.editable">
      <p class="note">{{ studio.dirty ? 'Unsaved changes' : 'Saved in the workspace' }}</p>
      <dl>
        <div>
          <dt>Design</dt>
          <dd class="mono">{{ studio.editable.provenance.origin === 'created' ? 'New design' : studio.editable.provenance.source_path }}</dd>
        </div>
        <div v-if="studio.editable.provenance.source_diagram_id">
          <dt>Imported reference</dt>
          <dd class="mono">{{ studio.editable.provenance.source_diagram_id }}</dd>
        </div>
      </dl>
      <label>
        Entity name
        <input v-model="studio.editable.entity_name" @focus="studio.beginChange()" @blur="studio.endChange()" />
      </label>
      <p class="note">Top-level ports are the interface of this design.</p>
      <h3>Generics</h3>
      <div v-for="generic in studio.editable.generics" :key="generic.id" class="generic">
        <span class="mono">{{ generic.name }}</span>
        <input v-model="generic.type_text" placeholder="type" @focus="studio.beginChange()" @blur="studio.endChange()" />
        <input v-model="generic.default_text" placeholder="default" @focus="studio.beginChange()" @blur="studio.endChange()" />
        <button type="button" @click="removeGeneric(generic.id)">Remove</button>
      </div>
      <label>
        Generic name
        <input v-model="genericName" />
      </label>
      <label>
        Generic type
        <input v-model="genericType" />
      </label>
      <label>
        Generic default
        <input v-model="genericDefault" />
      </label>
      <button type="button" :disabled="!genericName.trim()" @click="addDesignGeneric">Add generic</button>
      <h3>Top-level port</h3>
      <label>
        Name
        <input v-model="portName" />
      </label>
      <label>
        Direction
        <select v-model="portDirection">
          <option value="in">in</option>
          <option value="out">out</option>
          <option value="inout">inout</option>
          <option value="buffer">buffer</option>
          <option value="linkage">linkage</option>
        </select>
      </label>
      <label>
        Type
        <input v-model="portType" />
      </label>
      <label>
        Range
        <input v-model="portRange" placeholder="(7 downto 0)" />
      </label>
      <label>
        Default
        <input v-model="portDefault" />
      </label>
      <button type="button" :disabled="!portName.trim()" @click="addInterfacePort">Add port</button>
      <label v-if="selectedDiagramPort">
        Port name
        <input v-model="selectedDiagramPort.name" @focus="studio.beginChange()" @blur="studio.endChange()" />
      </label>
      <label v-if="selectedDiagramPort">
        Port type
        <input v-model="selectedDiagramPort.type_text" @focus="studio.beginChange()" @blur="refreshPortWidth(); studio.endChange()" />
      </label>
      <label v-if="selectedDiagramPort">
        Port range
        <input v-model="selectedDiagramPort.range_text" @focus="studio.beginChange()" @blur="refreshPortWidth(); studio.endChange()" />
      </label>
      <label v-if="selectedDiagramPort">
        Port default
        <input v-model="selectedDiagramPort.default_text" @focus="studio.beginChange()" @blur="studio.endChange()" />
      </label>
      <p v-if="selectedDiagramPort" class="note">
        Width {{ selectedDiagramPort.width_status }}{{ selectedDiagramPort.width === null ? '' : ` ${selectedDiagramPort.width}` }}
      </p>
      <label v-if="selectedInstance">
        Instance name
        <input v-model="selectedInstance.name" @focus="studio.beginChange()" @blur="studio.endChange()" />
      </label>
      <p v-if="selectedInstance" class="note">
        {{ selectedInstance.component_library ? selectedInstance.component_library + '.' : '' }}{{ selectedInstance.component_name }}
        <span v-if="selectedInstance.child_diagram_id"> · design {{ selectedInstance.child_diagram_id }}</span>
      </p>
      <label v-for="(generic, index) in selectedInstance?.generics ?? []" :key="`${generic.name}-${index}`">
        Map {{ generic.name }}
        <input v-model="generic.value" @focus="studio.beginChange()" @blur="studio.endChange()" />
      </label>
      <label v-if="selectedNet">
        Net name
        <input v-model="selectedNet.name" @focus="studio.beginChange()" @blur="studio.endChange()" />
      </label>
      <label v-if="selectedWire">
        Slice or expression
        <input :value="selectedWire.slice_text ?? ''" @focus="studio.beginChange()" @change="setSlice" @blur="studio.endChange()" />
      </label>
      <div v-if="selectedWire" class="actions">
        <button type="button" @click="split('start')">Split start onto a new net</button>
        <button type="button" @click="split('end')">Split end onto a new net</button>
      </div>
      <label v-if="selectedBlock">
        HDL text
        <textarea v-model="selectedBlock.text" rows="8" spellcheck="false" @focus="studio.beginChange()" @blur="studio.endChange()" />
      </label>
      <p class="empty">{{ studio.editable.preserved_records.length }} preserved records stay on the document.</p>
    </template>
    <template v-else-if="studio.tab === 'diagram' && studio.selectedDiagram">
      <dl>
        <div>
          <dt>Diagram</dt>
          <dd class="mono">{{ studio.selectedDiagram.source_path }}</dd>
        </div>
        <div>
          <dt>View</dt>
          <dd>{{ studio.selectedDiagram.view }}</dd>
        </div>
        <div v-if="studio.selectedDiagram.entity_name">
          <dt>Entity</dt>
          <dd class="mono">{{ studio.selectedDiagram.entity_name }}</dd>
        </div>
        <div v-if="studio.selectedDiagram.architecture_name">
          <dt>Architecture</dt>
          <dd class="mono">{{ studio.selectedDiagram.architecture_name }}</dd>
        </div>
        <div v-if="studio.selectedDiagram.machine_name">
          <dt>Machine</dt>
          <dd class="mono">{{ studio.selectedDiagram.machine_name }}</dd>
        </div>
        <div>
          <dt>Instances</dt>
          <dd>{{ studio.selectedDiagram.instances.length }}</dd>
        </div>
        <div>
          <dt>Preserved records</dt>
          <dd>{{ studio.selectedDiagram.preserved_records.length }}</dd>
        </div>
        <div v-for="block in studio.selectedDiagram.embedded_blocks" :key="block.id">
          <dt>{{ block.name }}</dt>
          <dd class="mono">{{ block.text }}</dd>
        </div>
      </dl>
      <h3>VHDL comparison</h3>
      <ul v-if="studio.selectedDiagram.vhdl_check.length">
        <li v-for="item in studio.selectedDiagram.vhdl_check" :key="item.code + item.message">
          {{ item.severity }} {{ item.message }}
        </li>
      </ul>
      <p v-else class="empty">No structural VHDL comparison for this view.</p>
    </template>
    <p v-else-if="!studio.selectedUnit" class="empty">Select a design unit.</p>
    <template v-else>
      <dl>
        <div>
          <dt>Name</dt>
          <dd class="mono">{{ studio.selectedUnit.name }}</dd>
        </div>
        <div>
          <dt>Kind</dt>
          <dd>{{ studio.selectedUnit.kind }}</dd>
        </div>
        <div>
          <dt>Language</dt>
          <dd>{{ studio.selectedUnit.language }}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{{ statusText[studio.selectedUnit.parse_status] }}</dd>
        </div>
        <div v-if="studio.selectedUnit.parent_name">
          <dt>Parent</dt>
          <dd class="mono">{{ studio.selectedUnit.parent_name }}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd class="mono">
            {{ studio.selectedUnit.source.path }}:{{ studio.selectedUnit.source.start_line }}-{{
              studio.selectedUnit.source.end_line
            }}
          </dd>
        </div>
      </dl>

      <h3>Dependencies</h3>
      <ul v-if="studio.selectedUnit.dependencies.length">
        <li v-for="item in studio.selectedUnit.dependencies" :key="item" class="mono">{{ item }}</li>
      </ul>
      <p v-else class="empty">None recorded before this unit.</p>

      <h3>Generics</h3>
      <table v-if="studio.selectedUnit.generics.length">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Default</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="generic in studio.selectedUnit.generics" :key="generic.id">
            <td class="mono">{{ generic.name }}</td>
            <td class="mono">{{ generic.type_text ?? generic.generic_kind }}</td>
            <td class="mono">{{ generic.default_text ?? '' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">No generics.</p>

      <h3>Ports</h3>
      <table v-if="studio.selectedUnit.ports.length">
        <thead>
          <tr>
            <th>Name</th>
            <th>Mode</th>
            <th>Type</th>
            <th>Width</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="port in studio.selectedUnit.ports" :key="port.id">
            <td class="mono">{{ port.name }}</td>
            <td>{{ port.direction ?? 'unresolved' }}</td>
            <td class="mono">{{ port.type_text }}</td>
            <td>{{ widthText(port) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">No ports on this unit.</p>
    </template>
  </aside>
</template>

<style scoped>
.properties {
  height: 100%;
  overflow: auto;
  padding: 12px;
}

h2,
h3 {
  margin: 0 0 8px;
  font-size: 13px;
}

h3 {
  margin-top: 14px;
}

dl {
  display: grid;
  gap: 6px;
  margin: 0;
}

dl div {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px;
}

dt {
  color: #5c6775;
}

dd,
p,
li {
  margin: 0;
}

dd {
  overflow-wrap: anywhere;
}

ul {
  margin: 0;
  padding-left: 18px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th,
td {
  border-bottom: 1px solid #e1e5eb;
  padding: 4px 4px 4px 0;
  text-align: left;
  vertical-align: top;
}

.empty,
.note {
  color: #5c6775;
}

label {
  display: grid;
  gap: 4px;
  margin-top: 10px;
  font-size: 12px;
}

input,
textarea,
select {
  width: 100%;
  font: inherit;
}

.generic,
.actions {
  display: grid;
  gap: 4px;
  margin-top: 8px;
}

button {
  font: inherit;
}
</style>
