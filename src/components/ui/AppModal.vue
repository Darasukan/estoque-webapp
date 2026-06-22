<script setup>
import { nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import AppButton from './AppButton.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  confirmLoading: { type: Boolean, default: false },
  confirmDisabled: { type: Boolean, default: false },
  showActions: { type: Boolean, default: true },
  persistent: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'confirm'])

const inputValue = ref('')
const dialogRef = ref(null)
const titleId = `app-modal-${useId()}`

async function syncDialog(visible) {
  await nextTick()
  const dialog = dialogRef.value
  if (!dialog) return
  if (visible && !dialog.open) dialog.showModal()
  if (!visible && dialog.open) dialog.close()
}

function requestClose() {
  if (!props.persistent) emit('close')
}

watch(() => props.visible, syncDialog)
onMounted(() => syncDialog(props.visible))
onUnmounted(() => dialogRef.value?.close())

defineExpose({ inputValue })
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogRef"
      class="fixed inset-0 z-50 m-0 h-screen w-screen max-w-none bg-transparent p-0 backdrop:bg-black/85"
      aria-modal="true"
      :aria-labelledby="titleId"
      @cancel.prevent="requestClose"
    >
      <div class="flex min-h-full items-center justify-center p-4" @click.self="requestClose">
      <div class="ds-panel w-full max-w-md p-6">
        <h3 :id="titleId" class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
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
      </div>
    </dialog>
  </Teleport>
</template>
