<script setup>
import { useToast } from '../../composables/useToast.js'

const { toasts } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-5 right-5 z-[9999] flex max-w-[min(36rem,calc(100vw-2.5rem))] flex-col gap-2">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="rounded-lg border px-4 py-3 text-sm font-medium shadow-lg transition-all duration-300"
          :class="{
            'border-emerald-500/25 bg-emerald-600 text-white dark:border-emerald-500/40 dark:bg-emerald-950 dark:text-emerald-100': toast.type === 'success',
            'border-red-500/25 bg-red-600 text-white dark:border-red-500/40 dark:bg-red-950 dark:text-red-100': toast.type === 'error'
          }"
        >
          <div class="flex items-center gap-3">
            <span class="min-w-0 flex-1">{{ toast.message }}</span>
            <button
              v-if="toast.action"
              type="button"
              class="rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/30"
              @click="toast.action.onClick"
            >
              {{ toast.action.label }}
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active { animation: slideIn 0.3s ease; }
.toast-leave-active { animation: slideIn 0.3s ease reverse; }
@keyframes slideIn {
  from { opacity: 0; transform: translateX(40px); }
  to { opacity: 1; transform: translateX(0); }
}
</style>
