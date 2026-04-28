<script setup>
import { ref } from 'vue'
import { useUsers } from '../../composables/useUsers.js'
import { useToast } from '../../composables/useToast.js'

const { users, addUser, editUser, toggleUserActive, removeUser } = useUsers()
const { success, error } = useToast()

const newUserName = ref('')
const newUserPin = ref('')
const newUserRole = ref('operador')
const addingUser = ref(false)
const editingUserId = ref(null)
const editUserName = ref('')
const editUserPin = ref('')
const editUserRole = ref('operador')

function startAddUser() { addingUser.value = true; newUserName.value = ''; newUserPin.value = ''; newUserRole.value = 'operador' }
function cancelAddUser() { addingUser.value = false }
async function confirmAddUser() {
  if (!newUserName.value.trim() || !newUserPin.value.trim()) { error('Nome e senha são obrigatórios.'); return }
  const r = await addUser(newUserName.value.trim(), newUserPin.value, newUserRole.value)
  if (!r.ok) { error(r.error); return }
  success('Operador adicionado.')
  addingUser.value = false
}
function startEditUser(u) {
  editingUserId.value = u.id
  editUserName.value = u.name
  editUserPin.value = ''
  editUserRole.value = u.role
}
function cancelEditUser() { editingUserId.value = null }
async function confirmEditUser() {
  const changes = {}
  if (editingUserId.value !== 'user_admin') {
    changes.name = editUserName.value
    changes.role = editUserRole.value
  }
  if (editUserPin.value.trim()) changes.pin = editUserPin.value
  const r = await editUser(editingUserId.value, changes)
  if (!r.ok) { error(r.error); return }
  success('Operador atualizado.')
  editingUserId.value = null
}
async function onToggleUserActive(u) {
  const r = await toggleUserActive(u.id)
  if (!r.ok) { error(r.error); return }
  success(u.active ? 'Operador desativado.' : 'Operador ativado.')
}
async function onDeleteUser(u) {
  if (!confirm(`Excluir operador "${u.name}"?`)) return
  const r = await removeUser(u.id)
  if (!r.ok) { error(r.error); return }
  success('Operador removido.')
}
</script>
<template>
<!-- ===== Operadores ===== -->
  <div>
    <div class="max-w-2xl">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-base font-semibold text-gray-800 dark:text-gray-100">Operadores</h2>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Usuários do sistema com nome e senha, definidos pelo administrador.</p>
        </div>
        <button
          v-if="!addingUser"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          @click="startAddUser"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Novo operador
        </button>
      </div>

      <!-- Add form -->
      <div v-if="addingUser" class="mb-4 rounded-xl border border-primary-300 dark:border-primary-700 bg-primary-50/40 dark:bg-primary-900/10 p-4 flex flex-col gap-3">
        <p class="text-xs font-semibold text-primary-600 dark:text-primary-400">Novo operador</p>
        <input
          v-model="newUserName"
          placeholder="Nome do operador"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
          autofocus
          @keydown.escape="cancelAddUser"
        />
        <input
          v-model="newUserPin"
          type="password"
          placeholder="Senha"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
          @keydown.enter="confirmAddUser"
          @keydown.escape="cancelAddUser"
        />
        <select
          v-model="newUserRole"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
        >
          <option value="operador">Operador</option>
          <option value="admin">Administrador</option>
          <option value="visitante">Visitante</option>
        </select>
        <div class="flex gap-2">
          <button class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors" @click="confirmAddUser">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            Salvar
          </button>
          <button class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" @click="cancelAddUser">Cancelar</button>
        </div>
      </div>

      <!-- Users table -->
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table v-if="users.length" class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
              <th class="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Nome</th>
              <th class="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Papel</th>
              <th class="text-center px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider w-24">Status</th>
              <th class="px-4 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="u in users"
              :key="u.id"
              class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              :class="{ 'opacity-50': !u.active }"
            >
              <!-- Editing row -->
              <template v-if="editingUserId === u.id">
                <td class="px-4 py-2">
                  <input v-if="u.id !== 'user_admin'" v-model="editUserName" class="w-full px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none" @keydown.enter="confirmEditUser" @keydown.escape="cancelEditUser" autofocus />
                  <span v-else class="text-sm text-gray-500 dark:text-gray-400 italic">{{ u.name }}</span>
                </td>
                <td class="px-4 py-2">
                  <div class="flex flex-col gap-1">
                    <select v-if="u.id !== 'user_admin'" v-model="editUserRole" class="w-full px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none">
                      <option value="operador">Operador</option>
                      <option value="admin">Administrador</option>
                      <option value="visitante">Visitante</option>
                    </select>
                    <span v-else class="text-xs text-gray-400 dark:text-gray-500 italic">Admin (fixo)</span>
                    <input v-model="editUserPin" type="password" placeholder="Nova senha (deixe vazio para manter)" class="w-full px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none" @keydown.enter="confirmEditUser" @keydown.escape="cancelEditUser" />
                  </div>
                </td>
                <td colspan="2" class="px-4 py-2">
                  <div class="flex items-center gap-1">
                    <button class="p-1 text-green-500 hover:text-green-600" title="Salvar" @click="confirmEditUser">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    </button>
                    <button class="p-1 text-gray-400 hover:text-gray-600" title="Cancelar" @click="cancelEditUser">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </td>
              </template>
              <!-- Display row -->
              <template v-else>
                <td class="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{{ u.name }}</td>
                <td class="px-4 py-3 text-gray-500 dark:text-gray-400">
                  <span
                    class="px-2 py-0.5 rounded-full text-[11px] font-medium"
                    :class="{
                      'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400': u.role === 'admin',
                      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400': u.role === 'operador',
                      'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400': u.role === 'visitante'
                    }"
                  >{{ u.role === 'admin' ? 'Admin' : u.role === 'operador' ? 'Operador' : 'Visitante' }}</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <button
                    v-if="u.id !== 'user_admin'"
                    class="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors"
                    :class="u.active
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
                    @click="onToggleUserActive(u)"
                  >{{ u.active ? 'Ativo' : 'Inativo' }}</button>
                  <span v-else class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Ativo</span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-center gap-0.5">
                    <button class="p-1 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors" title="Editar" @click="startEditUser(u)">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                    </button>
                    <button v-if="u.id !== 'user_admin'" class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Excluir" @click="onDeleteUser(u)">
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
          <p class="text-sm">Nenhum operador cadastrado.</p>
          <p class="text-xs mt-1">Clique em <strong>Novo operador</strong> para adicionar.</p>
        </div>
      </div>
    </div>
  </div>
</template>
