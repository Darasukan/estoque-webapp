<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  ariaLabel: { type: String, required: true },
  align: { type: String, default: 'center' },
  persistent: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])
const dialogRef = ref(null)

async function syncDialog(visible) {
  await nextTick()
  if (visible && !dialogRef.value?.open) dialogRef.value?.showModal()
  if (!visible && dialogRef.value?.open) dialogRef.value.close()
}

function requestClose() {
  if (!props.persistent) emit('close')
}

watch(() => props.visible, syncDialog)
onMounted(() => syncDialog(props.visible))
onUnmounted(() => dialogRef.value?.close())
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogRef"
      class="fixed inset-0 z-50 m-0 h-screen w-screen max-w-none bg-transparent p-0 backdrop:bg-black/55"
      aria-modal="true"
      :aria-label="ariaLabel"
      @cancel.prevent="requestClose"
    >
      <div
        class="flex min-h-full justify-center overflow-y-auto"
        :class="align === 'top' ? 'items-start p-4 pt-[12vh]' : (align === 'start' ? 'items-start p-3 sm:p-6' : 'items-center p-4')"
        @mousedown.self="requestClose"
      >
        <slot />
      </div>
    </dialog>
  </Teleport>
</template>
