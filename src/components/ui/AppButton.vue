<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: { type: String, default: 'secondary' },
  size: { type: String, default: 'md' },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})

const variantClasses = computed(() => ({
  primary: 'border-blue-700 bg-blue-600 text-white hover:bg-blue-700 hover:border-blue-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] dark:border-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500',
  secondary: 'border-gray-300 bg-gray-100 text-gray-800 hover:bg-gray-200 dark:border-white/[0.12] dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700',
  ghost: 'border-transparent bg-transparent text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
  danger: 'border-red-300 bg-red-100 text-red-800 hover:bg-red-200 dark:border-red-500/25 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900',
  dangerSolid: 'border-red-600 bg-red-600 text-white hover:bg-red-500',
  warning: 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-500/25 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900',
  success: 'border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:border-emerald-500/25 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900',
}[props.variant] || 'border-gray-300 bg-gray-100 text-gray-800 hover:bg-gray-200 dark:border-white/[0.12] dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700')
)

const sizeClasses = computed(() => ({
  xs: 'h-7 px-2.5 text-xs',
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-10 px-4 text-sm',
  icon: 'h-9 w-9 p-0',
}[props.size] || 'h-9 px-3.5 text-sm')
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center gap-2 rounded-md border font-medium transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
    :class="[variantClasses, sizeClasses]"
  >
    <slot name="icon" />
    <span v-if="loading">Carregando...</span>
    <slot v-else />
  </button>
</template>
