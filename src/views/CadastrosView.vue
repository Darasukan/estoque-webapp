<script setup>
import { ref } from 'vue'
import EditHierarchyView from './EditHierarchyView.vue'
import { useDestinations } from '../composables/useDestinations.js'
import { usePeople } from '../composables/usePeople.js'
import { useLocations } from '../composables/useLocations.js'
import { useRoles } from '../composables/useRoles.js'
import { useToast } from '../composables/useToast.js'

const { destinations, addDestination, editDestination, toggleDestinationActive, deleteDestination } = useDestinations()
const { people, addPerson, editPerson, togglePersonActive, deletePerson } = usePeople()
const { locais, addLocal, editLocal, toggleLocalActive, deleteLocal } = useLocations()
const { roles, activeRoles, addRole, editRole, toggleRoleActive, deleteRole } = useRoles()
const { success, error } = useToast()

const activeSubTab = ref('hierarquia') // 'hierarquia' | 'destinos' | 'pessoas' | 'locais' | 'cargos'

// ===== Destinations CRUD state =====
const newDestName = ref('')
const newDestDesc = ref('')
const addingDest = ref(false)

const editingDestId = ref(null)
const editDestName = ref('')
const editDestDesc = ref('')

function startAddDest() { addingDest.value = true; newDestName.value = ''; newDestDesc.value = '' }
function cancelAddDest() { addingDest.value = false }
function confirmAddDest() {
  const r = addDestination(newDestName.value, newDestDesc.value)
  if (!r.ok) { error(r.error); return }
  success('Destino adicionado.')
  addingDest.value = false
}

function startEditDest(d) {
  editingDestId.value = d.id
  editDestName.value = d.name
  editDestDesc.value = d.description || ''
}
function cancelEditDest() { editingDestId.value = null }
function confirmEditDest() {
  const r = editDestination(editingDestId.value, { name: editDestName.value, description: editDestDesc.value })
  if (!r.ok) { error(r.error); return }
  success('Destino atualizado.')
  editingDestId.value = null
}

function onDeleteDest(d) {
  if (!confirm(`Excluir destino "${d.name}"?`)) return
  deleteDestination(d.id)
  success('Destino removido.')
}

// ===== Locais CRUD state =====
const newLocalName = ref('')
const newLocalDesc = ref('')
const addingLocal = ref(false)

const editingLocalId = ref(null)
const editLocalName = ref('')
const editLocalDesc = ref('')

function startAddLocal() { addingLocal.value = true; newLocalName.value = ''; newLocalDesc.value = '' }
function cancelAddLocal() { addingLocal.value = false }
function confirmAddLocal() {
  const r = addLocal(newLocalName.value, newLocalDesc.value)
  if (!r.ok) { error(r.error); return }
  success('Local adicionado.')
  addingLocal.value = false
}

function startEditLocal(l) {
  editingLocalId.value = l.id
  editLocalName.value = l.name
  editLocalDesc.value = l.description || ''
}
function cancelEditLocal() { editingLocalId.value = null }
function confirmEditLocal() {
  const r = editLocal(editingLocalId.value, { name: editLocalName.value, description: editLocalDesc.value })
  if (!r.ok) { error(r.error); return }
  success('Local atualizado.')
  editingLocalId.value = null
}

function onDeleteLocal(l) {
  if (!confirm(`Excluir local "${l.name}"?`)) return
  deleteLocal(l.id)
  success('Local removido.')
}

// ===== People CRUD state =====
const newPersonName = ref('')
const newPersonRole = ref('')
const addingPerson = ref(false)

const editingPersonId = ref(null)
const editPersonName = ref('')
const editPersonRole = ref('')

function startAddPerson() { addingPerson.value = true; newPersonName.value = ''; newPersonRole.value = '' }
function cancelAddPerson() { addingPerson.value = false }
function confirmAddPerson() {
  const r = addPerson(newPersonName.value, newPersonRole.value)
  if (!r.ok) { error(r.error); return }
  success('Pessoa adicionada.')
  addingPerson.value = false
}

function startEditPerson(p) {
  editingPersonId.value = p.id
  editPersonName.value = p.name
  editPersonRole.value = p.role || ''
}
function cancelEditPerson() { editingPersonId.value = null }
function confirmEditPerson() {
  const r = editPerson(editingPersonId.value, { name: editPersonName.value, role: editPersonRole.value })
  if (!r.ok) { error(r.error); return }
  success('Pessoa atualizada.')
  editingPersonId.value = null
}

function onDeletePerson(p) {
  if (!confirm(`Excluir "${p.name}"?`)) return
  deletePerson(p.id)
  success('Pessoa removida.')
}

// ===== Cargos CRUD state =====
const newRoleName = ref('')
const newRoleDesc = ref('')
const addingRole = ref(false)

const editingRoleId = ref(null)
const editRoleName = ref('')
const editRoleDesc = ref('')

function startAddRole() { addingRole.value = true; newRoleName.value = ''; newRoleDesc.value = '' }
function cancelAddRole() { addingRole.value = false }
function confirmAddRole() {
  const r = addRole(newRoleName.value, newRoleDesc.value)
  if (!r.ok) { error(r.error); return }
  success('Cargo adicionado.')
  addingRole.value = false
}

function startEditRole(r) {
  editingRoleId.value = r.id
  editRoleName.value = r.name
  editRoleDesc.value = r.description || ''
}
function cancelEditRole() { editingRoleId.value = null }
function confirmEditRole() {
  const r = editRole(editingRoleId.value, { name: editRoleName.value, description: editRoleDesc.value })
  if (!r.ok) { error(r.error); return }
  success('Cargo atualizado.')
  editingRoleId.value = null
}

function onDeleteRole(r) {
  if (!confirm(`Excluir cargo "${r.name}"?`)) return
  deleteRole(r.id)
  success('Cargo removido.')
}
</script>

<template>
  <!-- Sub-tab bar -->
  <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
    <nav class="flex gap-1 px-1 -mb-px">
      <button
        v-for="tab in [{ id: 'hierarquia', label: 'Hierarquia' }, { id: 'destinos', label: 'Destinos' }, { id: 'pessoas', label: 'Pessoas' }, { id: 'locais', label: 'Locais' }, { id: 'cargos', label: 'Cargos' }]"
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
  <div v-else-if="activeSubTab === 'destinos'">
    <div class="max-w-2xl">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-base font-semibold text-gray-800 dark:text-gray-100">Destinos</h2>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Locais cadastrados para saídas de estoque.</p>
        </div>
        <button
          v-if="!addingDest"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          @click="startAddDest"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Novo destino
        </button>
      </div>

      <!-- Add form -->
      <div v-if="addingDest" class="mb-4 rounded-xl border border-primary-300 dark:border-primary-700 bg-primary-50/40 dark:bg-primary-900/10 p-4 flex flex-col gap-3">
        <p class="text-xs font-semibold text-primary-600 dark:text-primary-400">Novo destino</p>
        <input
          v-model="newDestName"
          placeholder="Nome do destino (ex: Caldeiraria, Obra Centro...)"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
          autofocus
          @keydown.enter="confirmAddDest"
          @keydown.escape="cancelAddDest"
        />
        <input
          v-model="newDestDesc"
          placeholder="Descrição (opcional)"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
          @keydown.enter="confirmAddDest"
          @keydown.escape="cancelAddDest"
        />
        <div class="flex gap-2">
          <button class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors" @click="confirmAddDest">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            Salvar
          </button>
          <button class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" @click="cancelAddDest">Cancelar</button>
        </div>
      </div>

      <!-- Destinations table -->
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table v-if="destinations.length" class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
              <th class="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Nome</th>
              <th class="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Descrição</th>
              <th class="text-center px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider w-24">Status</th>
              <th class="px-4 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="d in destinations"
              :key="d.id"
              class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              :class="{ 'opacity-50': !d.active }"
            >
              <!-- Editing row -->
              <template v-if="editingDestId === d.id">
                <td class="px-4 py-2">
                  <input v-model="editDestName" class="w-full px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none" @keydown.enter="confirmEditDest" @keydown.escape="cancelEditDest" autofocus />
                </td>
                <td class="px-4 py-2">
                  <input v-model="editDestDesc" placeholder="Descrição..." class="w-full px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none" @keydown.enter="confirmEditDest" @keydown.escape="cancelEditDest" />
                </td>
                <td colspan="2" class="px-4 py-2">
                  <div class="flex items-center gap-1">
                    <button class="p-1 text-green-500 hover:text-green-600" title="Salvar" @click="confirmEditDest">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    </button>
                    <button class="p-1 text-gray-400 hover:text-gray-600" title="Cancelar" @click="cancelEditDest">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </td>
              </template>
              <!-- Display row -->
              <template v-else>
                <td class="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{{ d.name }}</td>
                <td class="px-4 py-3 text-gray-500 dark:text-gray-400">{{ d.description || '—' }}</td>
                <td class="px-4 py-3 text-center">
                  <button
                    class="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors"
                    :class="d.active
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
                    @click="toggleDestinationActive(d.id)"
                  >{{ d.active ? 'Ativo' : 'Inativo' }}</button>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-center gap-0.5">
                    <button class="p-1 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors" title="Editar" @click="startEditDest(d)">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                    </button>
                    <button class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Excluir" @click="onDeleteDest(d)">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
                    </button>
                  </div>
                </td>
              </template>
            </tr>
          </tbody>
        </table>

        <!-- Empty state -->
        <div v-else class="px-6 py-12 text-center text-gray-400 dark:text-gray-500">
          <svg class="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          <p class="text-sm">Nenhum destino cadastrado.</p>
          <p class="text-xs mt-1">Clique em <strong>Novo destino</strong> para adicionar.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== Pessoas ===== -->
  <div v-else-if="activeSubTab === 'pessoas'">
    <div class="max-w-2xl">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-base font-semibold text-gray-800 dark:text-gray-100">Pessoas</h2>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Colaboradores que retiram materiais do estoque.</p>
        </div>
        <button
          v-if="!addingPerson"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          @click="startAddPerson"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nova pessoa
        </button>
      </div>

      <!-- Add form -->
      <div v-if="addingPerson" class="mb-4 rounded-xl border border-primary-300 dark:border-primary-700 bg-primary-50/40 dark:bg-primary-900/10 p-4 flex flex-col gap-3">
        <p class="text-xs font-semibold text-primary-600 dark:text-primary-400">Nova pessoa</p>
        <input
          v-model="newPersonName"
          placeholder="Nome completo"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
          autofocus
          @keydown.enter="confirmAddPerson"
          @keydown.escape="cancelAddPerson"
        />
        <div v-if="activeRoles.length">
          <select
            v-model="newPersonRole"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
          >
            <option value="">— Sem cargo —</option>
            <option v-for="r in activeRoles" :key="r.id" :value="r.name">{{ r.name }}</option>
          </select>
        </div>
        <div v-else class="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          Nenhum cargo cadastrado. Adicione na aba <strong>Cargos</strong> para vincular.
        </div>
        <div class="flex gap-2">
          <button class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors" @click="confirmAddPerson">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            Salvar
          </button>
          <button class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" @click="cancelAddPerson">Cancelar</button>
        </div>
      </div>

      <!-- People table -->
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table v-if="people.length" class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
              <th class="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Nome</th>
              <th class="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Cargo</th>
              <th class="text-center px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider w-24">Status</th>
              <th class="px-4 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in people"
              :key="p.id"
              class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              :class="{ 'opacity-50': !p.active }"
            >
              <!-- Editing row -->
              <template v-if="editingPersonId === p.id">
                <td class="px-4 py-2">
                  <input v-model="editPersonName" class="w-full px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none" @keydown.enter="confirmEditPerson" @keydown.escape="cancelEditPerson" autofocus />
                </td>
                <td class="px-4 py-2">
                  <select v-if="activeRoles.length" v-model="editPersonRole" class="w-full px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none">
                    <option value="">— Sem cargo —</option>
                    <option v-for="r in activeRoles" :key="r.id" :value="r.name">{{ r.name }}</option>
                  </select>
                  <span v-else class="text-xs text-gray-400 dark:text-gray-500 italic">Sem cargos cadastrados</span>
                </td>
                <td colspan="2" class="px-4 py-2">
                  <div class="flex items-center gap-1">
                    <button class="p-1 text-green-500 hover:text-green-600" title="Salvar" @click="confirmEditPerson">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    </button>
                    <button class="p-1 text-gray-400 hover:text-gray-600" title="Cancelar" @click="cancelEditPerson">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </td>
              </template>
              <!-- Display row -->
              <template v-else>
                <td class="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{{ p.name }}</td>
                <td class="px-4 py-3 text-gray-500 dark:text-gray-400">{{ p.role || '—' }}</td>
                <td class="px-4 py-3 text-center">
                  <button
                    class="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors"
                    :class="p.active
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
                    @click="togglePersonActive(p.id)"
                  >{{ p.active ? 'Ativo' : 'Inativo' }}</button>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-center gap-0.5">
                    <button class="p-1 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors" title="Editar" @click="startEditPerson(p)">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                    </button>
                    <button class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Excluir" @click="onDeletePerson(p)">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
                    </button>
                  </div>
                </td>
              </template>
            </tr>
          </tbody>
        </table>

        <!-- Empty state -->
        <div v-else class="px-6 py-12 text-center text-gray-400 dark:text-gray-500">
          <svg class="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
          <p class="text-sm">Nenhuma pessoa cadastrada.</p>
          <p class="text-xs mt-1">Clique em <strong>Nova pessoa</strong> para adicionar.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== Locais ===== -->
  <div v-else-if="activeSubTab === 'locais'">
    <div class="max-w-2xl">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-base font-semibold text-gray-800 dark:text-gray-100">Locais</h2>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Endereços físicos de armazenamento (prateleiras, depósitos, etc.).</p>
        </div>
        <button
          v-if="!addingLocal"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          @click="startAddLocal"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Novo local
        </button>
      </div>

      <!-- Add form -->
      <div v-if="addingLocal" class="mb-4 rounded-xl border border-primary-300 dark:border-primary-700 bg-primary-50/40 dark:bg-primary-900/10 p-4 flex flex-col gap-3">
        <p class="text-xs font-semibold text-primary-600 dark:text-primary-400">Novo local</p>
        <input
          v-model="newLocalName"
          placeholder="Nome do local (ex: Prateleira 1, Depósito B, Armário 3...)"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
          autofocus
          @keydown.enter="confirmAddLocal"
          @keydown.escape="cancelAddLocal"
        />
        <input
          v-model="newLocalDesc"
          placeholder="Descrição / observação (opcional)"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
          @keydown.enter="confirmAddLocal"
          @keydown.escape="cancelAddLocal"
        />
        <div class="flex gap-2">
          <button class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors" @click="confirmAddLocal">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            Salvar
          </button>
          <button class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" @click="cancelAddLocal">Cancelar</button>
        </div>
      </div>

      <!-- Locais table -->
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table v-if="locais.length" class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
              <th class="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Nome</th>
              <th class="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Descrição</th>
              <th class="text-center px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider w-24">Status</th>
              <th class="px-4 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="l in locais"
              :key="l.id"
              class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              :class="{ 'opacity-50': !l.active }"
            >
              <!-- Editing row -->
              <template v-if="editingLocalId === l.id">
                <td class="px-4 py-2">
                  <input v-model="editLocalName" class="w-full px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none" @keydown.enter="confirmEditLocal" @keydown.escape="cancelEditLocal" autofocus />
                </td>
                <td class="px-4 py-2">
                  <input v-model="editLocalDesc" placeholder="Descrição..." class="w-full px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none" @keydown.enter="confirmEditLocal" @keydown.escape="cancelEditLocal" />
                </td>
                <td colspan="2" class="px-4 py-2">
                  <div class="flex items-center gap-1">
                    <button class="p-1 text-green-500 hover:text-green-600" title="Salvar" @click="confirmEditLocal">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    </button>
                    <button class="p-1 text-gray-400 hover:text-gray-600" title="Cancelar" @click="cancelEditLocal">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </td>
              </template>
              <!-- Display row -->
              <template v-else>
                <td class="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{{ l.name }}</td>
                <td class="px-4 py-3 text-gray-500 dark:text-gray-400">{{ l.description || '—' }}</td>
                <td class="px-4 py-3 text-center">
                  <button
                    class="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors"
                    :class="l.active
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
                    @click="toggleLocalActive(l.id)"
                  >{{ l.active ? 'Ativo' : 'Inativo' }}</button>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-center gap-0.5">
                    <button class="p-1 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors" title="Editar" @click="startEditLocal(l)">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                    </button>
                    <button class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Excluir" @click="onDeleteLocal(l)">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
                    </button>
                  </div>
                </td>
              </template>
            </tr>
          </tbody>
        </table>

        <!-- Empty state -->
        <div v-else class="px-6 py-12 text-center text-gray-400 dark:text-gray-500">
          <svg class="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          <p class="text-sm">Nenhum local cadastrado.</p>
          <p class="text-xs mt-1">Clique em <strong>Novo local</strong> para adicionar.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== Cargos ===== -->
  <div v-else-if="activeSubTab === 'cargos'">
    <div class="max-w-2xl">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-base font-semibold text-gray-800 dark:text-gray-100">Cargos</h2>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Cargos e funções disponíveis para vinculação às pessoas.</p>
        </div>
        <button
          v-if="!addingRole"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          @click="startAddRole"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Novo cargo
        </button>
      </div>

      <!-- Add form -->
      <div v-if="addingRole" class="mb-4 rounded-xl border border-primary-300 dark:border-primary-700 bg-primary-50/40 dark:bg-primary-900/10 p-4 flex flex-col gap-3">
        <p class="text-xs font-semibold text-primary-600 dark:text-primary-400">Novo cargo</p>
        <input
          v-model="newRoleName"
          placeholder="Nome do cargo (ex: Técnico, Supervisor, Almoxarife...)"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
          autofocus
          @keydown.enter="confirmAddRole"
          @keydown.escape="cancelAddRole"
        />
        <input
          v-model="newRoleDesc"
          placeholder="Descrição (opcional)"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
          @keydown.enter="confirmAddRole"
          @keydown.escape="cancelAddRole"
        />
        <div class="flex gap-2">
          <button class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors" @click="confirmAddRole">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            Salvar
          </button>
          <button class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" @click="cancelAddRole">Cancelar</button>
        </div>
      </div>

      <!-- Roles table -->
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table v-if="roles.length" class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
              <th class="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Cargo</th>
              <th class="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Descrição</th>
              <th class="text-center px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider w-24">Status</th>
              <th class="px-4 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in roles"
              :key="r.id"
              class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              :class="{ 'opacity-50': !r.active }"
            >
              <!-- Editing row -->
              <template v-if="editingRoleId === r.id">
                <td class="px-4 py-2">
                  <input v-model="editRoleName" class="w-full px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none" @keydown.enter="confirmEditRole" @keydown.escape="cancelEditRole" autofocus />
                </td>
                <td class="px-4 py-2">
                  <input v-model="editRoleDesc" placeholder="Descrição..." class="w-full px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none" @keydown.enter="confirmEditRole" @keydown.escape="cancelEditRole" />
                </td>
                <td colspan="2" class="px-4 py-2">
                  <div class="flex items-center gap-1">
                    <button class="p-1 text-green-500 hover:text-green-600" title="Salvar" @click="confirmEditRole">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    </button>
                    <button class="p-1 text-gray-400 hover:text-gray-600" title="Cancelar" @click="cancelEditRole">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </td>
              </template>
              <!-- Display row -->
              <template v-else>
                <td class="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{{ r.name }}</td>
                <td class="px-4 py-3 text-gray-500 dark:text-gray-400">{{ r.description || '—' }}</td>
                <td class="px-4 py-3 text-center">
                  <button
                    class="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors"
                    :class="r.active
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
                    @click="toggleRoleActive(r.id)"
                  >{{ r.active ? 'Ativo' : 'Inativo' }}</button>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-center gap-0.5">
                    <button class="p-1 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors" title="Editar" @click="startEditRole(r)">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                    </button>
                    <button class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Excluir" @click="onDeleteRole(r)">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
                    </button>
                  </div>
                </td>
              </template>
            </tr>
          </tbody>
        </table>

        <!-- Empty state -->
        <div v-else class="px-6 py-12 text-center text-gray-400 dark:text-gray-500">
          <svg class="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
          <p class="text-sm">Nenhum cargo cadastrado.</p>
          <p class="text-xs mt-1">Clique em <strong>Novo cargo</strong> para adicionar.</p>
        </div>
      </div>
    </div>
  </div>
</template>
