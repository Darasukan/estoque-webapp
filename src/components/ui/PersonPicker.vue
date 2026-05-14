<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePeople } from '../../composables/usePeople.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Buscar pessoa...' },
  invalid: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'select', 'clear', 'commit'])

const { activePeople } = usePeople()
const search = ref(props.modelValue || '')
const open = ref(false)
const inputEl = ref(null)
const rootEl = ref(null)
const pickerId = `person-${Math.random().toString(36).slice(2)}`

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

const filteredPeople = computed(() => {
  const q = normalizeText(search.value)
  if (!q) return activePeople.value
  return activePeople.value.filter(person =>
    normalizeText(person.name).includes(q) ||
    normalizeText(person.role).includes(q)
  )
})

const selectedPerson = computed(() =>
  activePeople.value.find(person => normalizeText(person.name) === normalizeText(props.modelValue)) || null
)

function openPicker() {
  window.dispatchEvent(new CustomEvent('app-picker-open', { detail: pickerId }))
  open.value = true
}

function handleOtherPickerOpen(event) {
  if (event.detail !== pickerId) open.value = false
}

function handlePointerDownOutside(event) {
  if (!open.value) return
  if (rootEl.value?.contains(event.target)) return
  open.value = false
}

onMounted(() => {
  window.addEventListener('app-picker-open', handleOtherPickerOpen)
  document.addEventListener('pointerdown', handlePointerDownOutside, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('app-picker-open', handleOtherPickerOpen)
  document.removeEventListener('pointerdown', handlePointerDownOutside, true)
})

watch(() => props.modelValue, value => {
  search.value = value || ''
})

function selectPerson(person) {
  search.value = person.name
  emit('update:modelValue', person.name)
  emit('select', person)
  open.value = false
}

function handleInput() {
  openPicker()
  emit('update:modelValue', search.value)
}

function handleEnter() {
  if (filteredPeople.value.length === 1) selectPerson(filteredPeople.value[0])
  emit('commit')
}

function clearSelection() {
  search.value = ''
  emit('update:modelValue', '')
  emit('clear')
  open.value = true
}

function focus() {
  inputEl.value?.focus?.()
}

defineExpose({ focus })
</script>

<template>
  <div ref="rootEl" class="relative" :class="open ? 'z-50' : 'z-0'">
    <input
      ref="inputEl"
      v-model="search"
      type="search"
      autocomplete="off"
      :placeholder="placeholder"
      class="relative z-40 w-full border bg-white text-gray-900 outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
      :class="[
        compact ? 'min-h-10 rounded-none border-0 px-3 py-2 text-sm dark:bg-gray-900' : 'rounded-lg px-3 py-2 text-sm',
        invalid ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500 dark:border-amber-700' : 'border-gray-300 focus:border-transparent dark:border-gray-600'
      ]"
      @input="handleInput"
      @focus="openPicker"
      @keydown.enter.prevent="handleEnter"
      @keydown.escape.stop="open = false"
    />
    <button
      v-if="modelValue && !open"
      type="button"
      class="absolute right-2 top-1/2 z-40 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      title="Limpar pessoa"
      @click.stop="clearSelection"
    >
      <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-40 max-h-56 overflow-auto rounded-lg border border-gray-300 bg-white text-sm text-gray-900 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
    >
      <button
        v-for="person in filteredPeople"
        :key="person.id"
        type="button"
        class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        :class="selectedPerson?.id === person.id ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300' : ''"
        @mousedown.prevent="selectPerson(person)"
      >
        <span class="min-w-0 truncate font-medium">{{ person.name }}</span>
        <span v-if="person.role" class="shrink-0 text-xs text-gray-500 dark:text-gray-400">{{ person.role }}</span>
      </button>
      <p v-if="!filteredPeople.length" class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
        Nenhuma pessoa cadastrada encontrada.
      </p>
    </div>
  </div>
</template>
