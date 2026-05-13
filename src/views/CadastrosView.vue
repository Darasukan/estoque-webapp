<script setup>
import { ref, inject, watch } from 'vue'
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
  <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
    <nav class="flex gap-1 px-1 -mb-px">
      <button
        v-for="tab in [{ id: 'hierarquia', label: 'Hierarquia' }, { id: 'destinos', label: 'Destinos' }, { id: 'locais', label: 'Locais' }, { id: 'pessoas', label: 'Pessoas' }, { id: 'fornecedores', label: 'Fornecedores' }, { id: 'cargos', label: 'Cargos' }, { id: 'epis', label: 'EPIs' }, ...(isAdmin ? [{ id: 'operadores', label: 'Operadores' }] : [])]"
        :key="tab.id"
        class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
        :class="activeSubTab === tab.id
          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'"
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
