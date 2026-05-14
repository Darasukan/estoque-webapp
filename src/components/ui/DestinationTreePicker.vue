<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDestinations } from '../../composables/useDestinations.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Buscar destino...' },
  linkedIds: { type: Array, default: () => [] },
  allowOther: { type: Boolean, default: false },
  otherLabel: { type: String, default: 'Outro (digitar)...' },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'select', 'other', 'clear'])

const { groupedDestinations, getDestFullName } = useDestinations()
const search = ref('')
const open = ref(false)
const expandedGroups = ref(new Set())
const inputEl = ref(null)
const rootEl = ref(null)
const pickerId = `destination-${Math.random().toString(36).slice(2)}`

function normalizeText(value) {
  return String(value || '')
    .replace(/[›»]/g, '>')
    .trim()
    .toLowerCase()
}

const selectedPath = computed(() => props.modelValue ? getDestFullName(props.modelValue) : '')

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

watch(() => props.modelValue, (id, oldId) => {
  if (id && id !== oldId) {
    search.value = selectedPath.value
    return
  }
  if (!id && !open.value) search.value = ''
}, { immediate: true })

const filteredGroups = computed(() => {
  const q = normalizeText(search.value)
  return groupedDestinations.value
    .map(group => {
      const parentPath = getDestFullName(group.parent.id)
      const parentMatches = !q || normalizeText(`${parentPath} ${group.parent.description || ''}`).includes(q)
      const children = !q || parentMatches
        ? group.children
        : group.children.filter(child =>
          normalizeText(`${getDestFullName(child.id)} ${child.description || ''}`).includes(q)
        )
      if (!parentMatches && !children.length) return null
      return { parent: group.parent, children, parentMatches }
    })
    .filter(Boolean)
})

const filteredCount = computed(() =>
  filteredGroups.value.reduce((sum, group) => sum + (group.parentMatches ? 1 : 0) + group.children.length, 0)
)

const filteredResults = computed(() =>
  filteredGroups.value.flatMap(group => [
    ...(group.parentMatches ? [group.parent] : []),
    ...group.children,
  ])
)

function selectedParentId() {
  if (!props.modelValue) return ''
  for (const group of groupedDestinations.value) {
    if (group.parent.id === props.modelValue) return group.parent.id
    if (group.children.some(child => child.id === props.modelValue)) return group.parent.id
  }
  return ''
}

function isGroupOpen(group) {
  return Boolean(search.value.trim()) ||
    expandedGroups.value.has(group.parent.id) ||
    selectedParentId() === group.parent.id
}

function toggleGroup(groupId) {
  const next = new Set(expandedGroups.value)
  if (next.has(groupId)) next.delete(groupId)
  else next.add(groupId)
  expandedGroups.value = next
}

function selectDestination(destination) {
  const path = getDestFullName(destination.id)
  emit('update:modelValue', destination.id)
  emit('select', { destination, fullName: path })
  search.value = path
  open.value = false
}

function clearSelection() {
  emit('update:modelValue', '')
  emit('clear')
  search.value = ''
  openPicker()
}

function handleInput() {
  openPicker()
  if (props.modelValue && search.value !== selectedPath.value) {
    emit('update:modelValue', '')
    emit('clear')
  }
}

function handleEnter() {
  if (filteredResults.value.length !== 1) return
  selectDestination(filteredResults.value[0])
}

function chooseOther() {
  emit('update:modelValue', '')
  emit('other')
  search.value = ''
  open.value = false
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
      :placeholder="placeholder"
      autocomplete="off"
      class="relative z-40 w-full border border-gray-300 bg-white text-sm text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      :class="compact ? 'min-h-10 rounded-none border-0 px-3 py-2 dark:bg-gray-900' : 'rounded-lg px-3 py-2.5'"
      @input="handleInput"
      @focus="openPicker"
      @keydown.enter.prevent="handleEnter"
      @keydown.escape.stop="open = false"
    />
    <button
      v-if="modelValue && !open"
      type="button"
      class="absolute right-2 top-1/2 z-40 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      title="Limpar destino"
      @click.stop="clearSelection"
    >
      <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-40 max-h-60 overflow-auto rounded-lg border border-gray-300 bg-white text-sm text-gray-900 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
    >
      <p v-if="search && !filteredCount" class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">Nenhum destino encontrado.</p>

      <div v-for="group in filteredGroups" :key="group.parent.id" class="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
        <div class="flex items-center">
          <button
            type="button"
            class="flex h-9 w-9 shrink-0 items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            :class="group.children.length ? 'cursor-pointer' : 'cursor-default opacity-40'"
            :disabled="!group.children.length"
            :title="isGroupOpen(group) ? 'Recolher subníveis' : 'Abrir subníveis'"
            @click="toggleGroup(group.parent.id)"
          >
            <svg class="h-4 w-4 transition-transform" :class="isGroupOpen(group) ? 'rotate-90' : ''" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <button
            v-if="group.parentMatches"
            type="button"
            class="min-w-0 flex-1 px-2 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            :class="modelValue === group.parent.id ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300' : ''"
            @click="selectDestination(group.parent)"
          >
            <span class="flex items-center gap-2 truncate font-medium">
              <span class="truncate">{{ group.parent.name }}</span>
              <span v-if="linkedIds.includes(group.parent.id)" class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Vinculado</span>
            </span>
            <span v-if="group.children.length" class="block text-[11px] text-gray-500 dark:text-gray-400">{{ group.children.length }} subnível(is)</span>
          </button>
          <div v-else class="min-w-0 flex-1 px-2 py-2">
            <span class="block truncate text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ group.parent.name }}</span>
          </div>
        </div>

        <div v-if="group.children.length && isGroupOpen(group)" class="bg-gray-50 dark:bg-gray-950/50">
          <button
            v-for="child in group.children"
            :key="child.id"
            type="button"
            class="flex w-full items-center gap-2 px-9 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            :class="modelValue === child.id ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300' : ''"
            @click="selectDestination(child)"
          >
            <span class="h-px w-3 bg-gray-300 dark:bg-gray-700"></span>
            <span class="min-w-0 truncate">{{ child.name }}</span>
            <span v-if="linkedIds.includes(child.id)" class="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Vinculado</span>
          </button>
        </div>
      </div>

      <template v-if="allowOther">
        <div class="mx-2 my-1 border-t border-gray-100 dark:border-gray-700"></div>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-500 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800 cursor-pointer"
          @click="chooseOther"
        >
          <svg class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
          </svg>
          {{ otherLabel }}
        </button>
      </template>
    </div>
  </div>
</template>
