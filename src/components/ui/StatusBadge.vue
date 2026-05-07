<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, required: true },
  label: { type: String, default: '' },
  domain: { type: String, default: 'default' },
  size: { type: String, default: 'sm' },
})

const resolvedLabel = computed(() => props.label || props.status)

const tone = computed(() => {
  if (props.domain === 'motor') {
    return {
      ativo: 'success',
      em_manutencao: 'warning',
      reserva: 'brand',
      inativo: 'neutral',
    }[props.status] || 'neutral'
  }

  return {
    entrada: 'success',
    saida: 'danger',
    aberto: 'brand',
    em_andamento: 'warning',
    finalizado: 'success',
    cancelado: 'neutral',
  }[props.status] || props.status || 'neutral'
})

const toneClasses = computed(() => ({
  brand: 'bg-blue-600 text-white',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-700 dark:text-white',
  warning: 'bg-amber-100 text-amber-900 dark:bg-amber-700 dark:text-white',
  danger: 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-white',
  neutral: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-100',
}[tone.value] || 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-100')
)

const sizeClasses = computed(() => ({
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
}[props.size] || 'px-2 py-0.5 text-[11px]')
)
</script>

<template>
  <span
    class="inline-flex items-center whitespace-nowrap rounded-full font-medium leading-none"
    :class="[toneClasses, sizeClasses]"
  >
    {{ resolvedLabel }}
  </span>
</template>
