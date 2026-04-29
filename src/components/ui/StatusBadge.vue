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
  brand: 'border-primary-500/25 bg-primary-500/10 text-primary-700 dark:text-primary-300',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  danger: 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300',
  neutral: 'border-gray-300 bg-gray-100 text-gray-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300',
}[tone.value] || 'border-gray-300 bg-gray-100 text-gray-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300')
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
    class="inline-flex items-center whitespace-nowrap rounded-full border font-medium leading-none"
    :class="[toneClasses, sizeClasses]"
  >
    {{ resolvedLabel }}
  </span>
</template>
