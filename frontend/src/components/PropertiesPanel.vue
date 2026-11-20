<script setup lang="ts">
import type { ParseStatus, Port } from '../models/design'
import { useStudioStore } from '../stores/studio'

const studio = useStudioStore()

const statusText: Record<ParseStatus, string> = {
  parsed: 'Interface read',
  partial: 'Interface incomplete',
  skipped: 'Listed only',
  unsupported: 'Not read',
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
    <p v-if="!studio.selectedUnit" class="empty">Select a design unit.</p>
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

.empty {
  color: #5c6775;
}
</style>
