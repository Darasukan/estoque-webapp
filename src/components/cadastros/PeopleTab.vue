<script setup>
import { ref } from 'vue'
import { usePeople } from '../../composables/usePeople.js'
import { useRoles } from '../../composables/useRoles.js'
import { useToast } from '../../composables/useToast.js'

const { people, addPerson, editPerson, togglePersonActive, deletePerson } = usePeople()
const { activeRoles } = useRoles()
const { success, error } = useToast()

const newPersonName = ref('')
const newPersonRole = ref('')
const addingPerson = ref(false)
const editingPersonId = ref(null)
const editPersonName = ref('')
const editPersonRole = ref('')

function startAddPerson() { addingPerson.value = true; newPersonName.value = ''; newPersonRole.value = '' }
function cancelAddPerson() { addingPerson.value = false }
async function confirmAddPerson() {
  const r = await addPerson(newPersonName.value, newPersonRole.value)
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
async function confirmEditPerson() {
  const r = await editPerson(editingPersonId.value, { name: editPersonName.value, role: editPersonRole.value })
  if (!r.ok) { error(r.error); return }
  success('Pessoa atualizada.')
  editingPersonId.value = null
}
function onDeletePerson(p) {
  if (!confirm(`Excluir "${p.name}"?`)) return
  deletePerson(p.id)
  success('Pessoa removida.')
}
</script>
<template>
<!-- ===== Pessoas ===== -->
  <div>
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
</template>
