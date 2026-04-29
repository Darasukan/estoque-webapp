<script setup>
import AppButton from './AppButton.vue'

defineProps({
  message: { type: String, default: 'Confirmar esta acao?' },
  confirmLabel: { type: String, default: 'Sim' },
  cancelLabel: { type: String, default: 'Nao' },
})

defineEmits(['confirm', 'cancel'])
</script>

<template>
  <div class="inline-flex flex-wrap items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1.5">
    <span class="text-xs font-medium text-red-700 dark:text-red-300">{{ message }}</span>
    <AppButton variant="dangerSolid" size="xs" @click="$emit('confirm')">{{ confirmLabel }}</AppButton>
    <AppButton variant="ghost" size="xs" @click="$emit('cancel')">{{ cancelLabel }}</AppButton>
  </div>
</template>
