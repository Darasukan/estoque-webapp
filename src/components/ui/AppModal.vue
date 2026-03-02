<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

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
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="$emit('close')"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h3 class="text-lg font-semibold text-primary-700 dark:text-primary-400 mb-4">
          {{ title }}
        </h3>

        <slot :inputValue="inputValue" />

        <div class="flex justify-end gap-2 mt-5">
          <button
            class="px-4 py-2 text-sm rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            @click="$emit('close')"
          >
            Cancelar
          </button>
          <button
            class="px-4 py-2 text-sm rounded bg-primary-700 dark:bg-primary-600 text-white hover:bg-primary-800 dark:hover:bg-primary-500 transition-colors"
            @click="$emit('confirm')"
          >
            <slot name="confirmLabel">Confirmar</slot>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
