<script setup>
import { computed } from 'vue'

const props = defineProps({
  item: { type: Object, default: null },
  variation: { type: Object, default: null },
  tags: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false },
})

const rows = computed(() => {
  if (props.tags.length) {
    return props.tags
      .map(tag => ({ key: tag.key, value: tag.value }))
      .filter(tag => tag.key && String(tag.value || '').trim())
  }

  const ordered = []
  const used = new Set()
  for (const key of props.item?.attributes || []) {
    const value = props.variation?.values?.[key]
    if (!String(value || '').trim()) continue
    ordered.push({ key, value })
    used.add(key)
  }

  for (const [key, value] of Object.entries(props.variation?.values || {})) {
    if (used.has(key) || !String(value || '').trim()) continue
    ordered.push({ key, value })
    used.add(key)
  }

  for (const [key, value] of Object.entries(props.variation?.extras || {})) {
    if (!String(value || '').trim()) continue
    ordered.push({ key, value })
  }

  return ordered
})
</script>

<template>
  <div v-if="rows.length" class="flex flex-wrap gap-1.5">
    <span
      v-for="row in rows"
      :key="`${row.key}:${row.value}`"
      class="inline-flex min-w-0 max-w-full items-center overflow-hidden rounded-md border border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
      :class="compact ? 'text-[11px]' : 'text-xs'"
    >
      <span class="bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-300">{{ row.key }}</span>
      <span class="truncate px-1.5 py-0.5">{{ row.value }}</span>
    </span>
  </div>
  <span v-else class="text-xs text-gray-400 dark:text-gray-500">Sem atributos</span>
</template>
