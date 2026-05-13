<script setup>
import { computed, ref, inject, watch } from 'vue'
import EditHierarchyView from './EditHierarchyView.vue'
import DestinationsTab from '../components/cadastros/DestinationsTab.vue'
import LocationsTab from '../components/cadastros/LocationsTab.vue'
import PeopleTab from '../components/cadastros/PeopleTab.vue'
import SuppliersTab from '../components/cadastros/SuppliersTab.vue'
import RolesTab from '../components/cadastros/RolesTab.vue'
import EpisTab from '../components/cadastros/EpisTab.vue'
import UsersTab from '../components/cadastros/UsersTab.vue'

const isAdmin = inject('isAdmin')
const props = defineProps({
  initialTab: { type: String, default: 'hierarquia' },
})
const emit = defineEmits(['quick-movement', 'update:tab'])

const validTabs = ['hierarquia', 'destinos', 'locais', 'pessoas', 'fornecedores', 'cargos', 'epis', 'operadores']
const activeSubTab = ref(validTabs.includes(props.initialTab) ? props.initialTab : 'hierarquia')
const cadastroTabs = computed(() => [
  { id: 'hierarquia', label: 'Hierarquia' },
  { id: 'destinos', label: 'Destinos' },
  { id: 'locais', label: 'Locais' },
  { id: 'pessoas', label: 'Pessoas' },
  { id: 'fornecedores', label: 'Fornecedores' },
  { id: 'cargos', label: 'Cargos' },
  { id: 'epis', label: 'EPIs' },
  ...(isAdmin.value ? [{ id: 'operadores', label: 'Operadores' }] : []),
])

watch(() => props.initialTab, tab => {
  if (validTabs.includes(tab)) activeSubTab.value = tab
})

watch(activeSubTab, tab => {
  emit('update:tab', tab)
})

watch(isAdmin, admin => {
  if (!admin && activeSubTab.value === 'operadores') activeSubTab.value = 'hierarquia'
}, { immediate: true })
</script>

<template>
  <!-- Sub-tab bar -->
  <div class="mb-6 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
    <nav class="flex min-w-max gap-1">
      <button
        v-for="tab in cadastroTabs"
        :key="tab.id"
        type="button"
        class="rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors whitespace-nowrap"
        :class="activeSubTab === tab.id
          ? 'bg-primary-600 text-white shadow-sm'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'"
        @click="activeSubTab = tab.id"
      >{{ tab.label }}</button>
    </nav>
  </div>

  <!-- Hierarquia -->
  <EditHierarchyView v-if="activeSubTab === 'hierarquia'" />

  <!-- ===== Destinos ===== -->
  <DestinationsTab v-else-if="activeSubTab === 'destinos'" />

  <!-- ===== Pessoas ===== -->
  <PeopleTab v-else-if="activeSubTab === 'pessoas'" />

  <!-- ===== Fornecedores ===== -->
  <SuppliersTab v-else-if="activeSubTab === 'fornecedores'" />

  <!-- ===== Locais ===== -->
  <LocationsTab v-else-if="activeSubTab === 'locais'" />

  <!-- ===== Cargos ===== -->
  <RolesTab v-else-if="activeSubTab === 'cargos'" />

  <!-- ===== EPIs ===== -->
  <EpisTab v-else-if="activeSubTab === 'epis'" @quick-movement="emit('quick-movement', $event)" />

  <!-- ===== Operadores ===== -->
  <UsersTab v-else-if="activeSubTab === 'operadores'" />
</template>
