<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  documentType: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'update:documentType', 'change'])
const selectedType = computed(() => {
  if (['sem', 'nf', 'pedido'].includes(props.documentType)) return props.documentType
  if (/^PC\b/i.test(props.modelValue)) return 'pedido'
  return props.modelValue ? 'nf' : 'sem'
})
const prefix = computed(() => selectedType.value === 'nf' ? 'NF' : 'PC')
const number = computed({
  get: () => String(props.modelValue || '').replace(/^(NF(?:-e)?|PC)\s*/i, ''),
  set: value => emit('update:modelValue', String(value || '').trim() ? `${prefix.value} ${String(value).trim()}` : ''),
})

function changeType(event) {
  const type = event.target.value
  emit('update:documentType', type)
  emit('update:modelValue', type === 'sem' || !number.value ? '' : `${type === 'nf' ? 'NF' : 'PC'} ${number.value}`)
  emit('change')
}
</script>

<template>
  <div>
    <span class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Nº Documento</span>
    <div class="flex min-h-10 items-stretch overflow-hidden rounded-lg border border-gray-300 bg-white focus-within:border-primary-400 dark:border-gray-600 dark:bg-gray-800">
      <select :value="selectedType" :disabled="disabled" aria-label="Tipo de documento" class="border-r border-gray-200 bg-gray-50 px-2 text-xs font-semibold text-gray-700 outline-none disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200" @change="changeType">
        <option value="sem">Sem doc.</option>
        <option value="nf">NF-e</option>
        <option value="pedido">PC</option>
      </select>
      <input v-if="selectedType !== 'sem'" v-model="number" :disabled="disabled" type="text" :placeholder="selectedType === 'nf' ? 'Número da NF-e' : 'Número do pedido'" class="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-gray-900 outline-none disabled:opacity-60 dark:text-gray-100" @change="$emit('change')" />
      <span v-else class="flex flex-1 items-center px-3 text-xs italic text-gray-400 dark:text-gray-500">Sem documento</span>
    </div>
  </div>
</template>
