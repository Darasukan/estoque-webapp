<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import AppButton from './AppButton.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' }
})

const emit = defineEmits(['close', 'confirm'])

const inputValue = ref('')

function handleKeydown(e) {
  if (!props.visible) return
  if (e.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))

defineExpose({ inputValue })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
      @click.self="$emit('close')"
    >
      <div class="ds-panel w-full max-w-md mx-4 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {{ title }}
        </h3>

        <slot :inputValue="inputValue" />

        <div class="flex justify-end gap-2 mt-5">
          <AppButton variant="secondary" @click="$emit('close')">
            Cancelar
          </AppButton>
          <AppButton variant="primary" @click="$emit('confirm')">
            <slot name="confirmLabel">Confirmar</slot>
          </AppButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
