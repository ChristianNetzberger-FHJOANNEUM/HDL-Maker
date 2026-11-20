<script setup lang="ts">
import { computed } from 'vue'
import { useStudioStore } from '../stores/studio'

const studio = useStudioStore()

const lines = computed(() => studio.source?.text.split(/\r?\n/) ?? [])

function marked(lineNumber: number): boolean {
  const source = studio.source
  if (!source) return false
  return lineNumber >= source.start_line && lineNumber <= source.end_line
}
</script>

<template>
  <div class="source">
    <p v-if="!studio.source" class="empty">No source loaded.</p>
    <template v-else>
      <p v-if="studio.source.truncated" class="note">The file is shown only up to the display limit.</p>
      <pre><div
        v-for="(line, index) in lines"
        :key="index"
        class="line"
        :class="{ marked: marked(index + 1) }"
      ><span class="num">{{ index + 1 }}</span><span>{{ line || ' ' }}</span></div></pre>
    </template>
  </div>
</template>

<style scoped>
.source {
  height: 100%;
  overflow: auto;
  background: #fff;
}

.note,
.empty {
  margin: 0;
  padding: 8px 12px;
  color: #8a5a00;
  background: #fff8ee;
}

.empty {
  color: #5c6775;
  background: transparent;
}

pre {
  margin: 0;
  padding: 8px 0 16px;
  font-family: Consolas, "Cascadia Mono", monospace;
  font-size: 12px;
  line-height: 1.45;
}

.line {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  padding: 0 12px 0 0;
  white-space: pre;
}

.marked {
  background: #e5f0fa;
}

.num {
  color: #8b95a3;
  text-align: right;
  padding-right: 12px;
  user-select: none;
}
</style>
