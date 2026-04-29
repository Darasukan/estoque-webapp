<script setup>
defineProps({
  title: { type: String, default: 'Nenhum registro encontrado.' },
  text: { type: String, default: '' },
})
</script>

<template>
  <div class="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/70 px-4 py-8 text-center dark:border-white/[0.08] dark:bg-white/[0.02]">
    <slot name="icon">
      <div class="mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-500">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.008v.008H3.75V6.75Zm0 5.25h.008v.008H3.75V12Zm0 5.25h.008v.008H3.75v-.008Z" />
        </svg>
      </div>
    </slot>
    <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ title }}</p>
    <p v-if="text" class="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">{{ text }}</p>
    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </div>
</template>
