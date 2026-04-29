<script setup>
defineProps({
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  forId: { type: String, default: '' },
})
</script>

<template>
  <label class="block">
    <span v-if="label" class="ds-label">{{ label }}</span>
    <slot />
    <span v-if="error" class="mt-1 block text-xs text-red-600 dark:text-red-300">{{ error }}</span>
    <span v-else-if="hint" class="mt-1 block text-xs text-gray-500 dark:text-gray-400">{{ hint }}</span>
  </label>
</template>
