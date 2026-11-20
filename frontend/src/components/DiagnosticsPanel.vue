<script setup lang="ts">
import { computed } from 'vue'
import type { Diagnostic } from '../models/design'
import { useStudioStore } from '../stores/studio'

const studio = useStudioStore()

const rows = computed(() => {
  const library = studio.activeLibrary
  const report = library?.last_import?.diagnostics ?? []
  const units = library ? studio.unitsIn(library).flatMap((unit) => unit.diagnostics) : []
  return [...report, ...units]
})

function select(row: Diagnostic): void {
  if (row.unit_id) void studio.selectUnit(row.unit_id)
}
</script>

<template>
  <section class="diagnostics">
    <header>
      <h2>Diagnostics</h2>
      <span v-if="studio.activeLibrary">{{ studio.activeLibrary.name }}</span>
    </header>
    <p v-if="rows.length === 0" class="empty">No diagnostics for the current library.</p>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Code</th>
            <th>Location</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in rows"
            :key="`${row.code}-${row.path}-${row.line}-${index}`"
            :data-severity="row.severity"
            :class="{ clickable: Boolean(row.unit_id) }"
            @click="select(row)"
          >
            <td>{{ row.severity }}</td>
            <td class="mono">{{ row.code }}</td>
            <td class="mono">{{ row.path ?? '' }}<template v-if="row.line">:{{ row.line }}</template></td>
            <td>{{ row.message }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.diagnostics {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #fff;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 6px 12px;
  border-bottom: 1px solid #d0d5dd;
}

h2,
span,
.empty {
  margin: 0;
  font-size: 12px;
}

span,
.empty {
  color: #5c6775;
}

.empty {
  padding: 8px 12px;
}

.table-wrap {
  overflow: auto;
  min-height: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th,
td {
  padding: 4px 10px;
  border-bottom: 1px solid #eef1f4;
  text-align: left;
  vertical-align: top;
}

th {
  position: sticky;
  top: 0;
  background: #f7f8fa;
  color: #5c6775;
  font-weight: 600;
}

tr[data-severity='error'] td:first-child {
  color: #a12626;
}

tr[data-severity='warning'] td:first-child {
  color: #8a5a00;
}

.clickable {
  cursor: pointer;
}
</style>
