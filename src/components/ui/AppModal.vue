<script setup>
import { ref } from 'vue'
import AppButton from './AppButton.vue'
import AppDialog from './AppDialog.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  ariaLabel: { type: String, default: 'Janela de diálogo' },
  confirmLoading: { type: Boolean, default: false },
  confirmDisabled: { type: Boolean, default: false },
  showActions: { type: Boolean, default: true },
  persistent: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'confirm'])

const inputValue = ref('')

function requestClose() {
  if (!props.persistent) emit('close')
}

defineExpose({ inputValue })
</script>

<template>
  <AppDialog
    :visible="visible"
    :aria-label="title || ariaLabel"
    :persistent="persistent"
    @close="requestClose"
  >
    <div class="ds-panel w-full max-w-md p-6">
        <h3 v-if="title" class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {{ title }}
        </h3>

        <slot :inputValue="inputValue" />

        <div v-if="showActions" class="flex justify-end gap-2 mt-5">
          <AppButton variant="secondary" :disabled="confirmLoading" @click="requestClose">
            Cancelar
          </AppButton>
          <AppButton variant="primary" :loading="confirmLoading" :disabled="confirmDisabled" @click="$emit('confirm')">
            <slot name="confirmLabel">Confirmar</slot>
          </AppButton>
        </div>
      </div>
  </AppDialog>
</template>
