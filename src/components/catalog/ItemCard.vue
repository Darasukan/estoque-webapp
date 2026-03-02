<script setup>
defineProps({
  item: { type: Object, required: true }
})

const emit = defineEmits(['click'])
</script>

<template>
  <button
    class="w-20 text-center group cursor-pointer"
    @click="emit('click', item)"
  >
    <!-- Icon -->
    <div class="w-[70px] h-[70px] mx-auto mb-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 flex items-center justify-center rounded group-hover:border-primary-400 dark:group-hover:border-primary-500 group-hover:shadow-md transition-all">
      <svg class="w-7 h-7 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    </div>
    <!-- Name -->
    <span class="text-[11px] leading-tight text-gray-700 dark:text-gray-300">
      {{ item.name }}
    </span>
  </button>
</template>
