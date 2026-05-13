<script setup>
import { computed, ref } from 'vue'
import { useRoles } from '../../composables/useRoles.js'
import { useToast } from '../../composables/useToast.js'

const { roles, addRole, editRole, toggleRoleActive, deleteRole } = useRoles()
const { success, error } = useToast()

const newRoleName = ref('')
const newRoleDesc = ref('')
const addingRole = ref(false)
const editingRoleId = ref(null)
const editRoleName = ref('')
const editRoleDesc = ref('')
const roleSaving = ref(false)

const canAddRole = computed(() => newRoleName.value.trim().length > 0 && !roleSaving.value)
const canEditRole = computed(() => editRoleName.value.trim().length > 0 && !roleSaving.value)

function startAddRole() { addingRole.value = true; newRoleName.value = ''; newRoleDesc.value = '' }
function cancelAddRole() { addingRole.value = false }
async function confirmAddRole() {
  if (!canAddRole.value) return
  roleSaving.value = true
  try {
    const r = await addRole(newRoleName.value, newRoleDesc.value)
    if (!r.ok) { error(r.error); return }
    success('Cargo adicionado.')
    addingRole.value = false
  } finally {
    roleSaving.value = false
  }
}
function startEditRole(r) {
  editingRoleId.value = r.id
  editRoleName.value = r.name
  editRoleDesc.value = r.description || ''
}
function cancelEditRole() { editingRoleId.value = null }
async function confirmEditRole() {
  if (!canEditRole.value) return
  roleSaving.value = true
  try {
    const r = await editRole(editingRoleId.value, { name: editRoleName.value, description: editRoleDesc.value })
    if (!r.ok) { error(r.error); return }
    success('Cargo atualizado.')
    editingRoleId.value = null
  } finally {
    roleSaving.value = false
  }
}
async function onDeleteRole(r) {
  if (!confirm(`Excluir cargo "${r.name}"?`)) return
  try {
    const result = await deleteRole(r.id)
    if (result?.ok === false) { error(result.error); return }
    success('Cargo removido.')
  } catch (e) {
    error(e.message)
  }
}
</script>
<template>
<!-- ===== Cargos ===== -->
  <div>
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
        <p v-if="!newRoleName.trim()" class="text-xs text-amber-600 dark:text-amber-400">Informe o nome do cargo.</p>
        <div class="flex gap-2">
          <button
            class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canAddRole"
            @click="confirmAddRole"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            {{ roleSaving ? 'Salvando...' : 'Salvar' }}
          </button>
          <button class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" :disabled="roleSaving" @click="cancelAddRole">Cancelar</button>
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
                    <button class="p-1 text-green-500 hover:text-green-600 disabled:opacity-40 disabled:cursor-not-allowed" title="Salvar" :disabled="!canEditRole" @click="confirmEditRole">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    </button>
                    <button class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed" title="Cancelar" :disabled="roleSaving" @click="cancelEditRole">
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
