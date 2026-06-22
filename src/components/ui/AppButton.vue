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
  primary: 'ds-button-primary',
  secondary: 'ds-button-secondary',
  ghost: 'ds-button-ghost',
  danger: 'ds-button-danger',
  dangerSolid: 'ds-button-danger-solid',
  warning: 'ds-button-warning',
  success: 'ds-button-success',
}[props.variant] || 'ds-button-secondary')
)

const sizeClasses = computed(() => ({
  xs: 'ds-button-xs',
  sm: 'ds-button-sm',
  md: 'ds-button-md',
  lg: 'ds-button-lg',
  icon: 'ds-button-icon',
}[props.size] || 'ds-button-md')
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="ds-button inline-flex items-center justify-center gap-2 active:scale-[0.97] motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50"
    :class="[variantClasses, sizeClasses]"
  >
    <slot name="icon" />
    <span v-if="loading">Carregando...</span>
    <slot v-else />
  </button>
</template>
