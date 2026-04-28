<script setup>
import { reactive, ref, watch } from 'vue'
import { useLocations } from '../../composables/useLocations.js'
import { useToast } from '../../composables/useToast.js'

const { addLocal, editLocal, toggleLocalActive, deleteLocal, topLevelLocais, getChildren } = useLocations()
const { success, error } = useToast()

const collapsedLocais = reactive(new Set())
function toggleCollapseLocal(id) { collapsedLocais.has(id) ? collapsedLocais.delete(id) : collapsedLocais.add(id) }

watch(topLevelLocais, (parents, prevParents = []) => {
  const prevIds = new Set((prevParents || []).map(p => p.id))
  for (const p of parents) {
    if (!prevIds.has(p.id) && !collapsedLocais.has(p.id)) collapsedLocais.add(p.id)
  }
  const currentIds = new Set(parents.map(p => p.id))
  for (const id of [...collapsedLocais]) {
    if (!currentIds.has(id)) collapsedLocais.delete(id)
  }
}, { immediate: true })

const newLocalName = ref('')
const newLocalDesc = ref('')
const newLocalParentId = ref(null)
const addingLocal = ref(false)
const editingLocalId = ref(null)
const editLocalName = ref('')
const editLocalDesc = ref('')

function startAddLocal(parentId = null) { addingLocal.value = true; newLocalName.value = ''; newLocalDesc.value = ''; newLocalParentId.value = parentId }
function cancelAddLocal() { addingLocal.value = false; newLocalParentId.value = null }
async function confirmAddLocal() {
  const r = await addLocal(newLocalName.value, newLocalDesc.value, newLocalParentId.value)
  if (!r.ok) { error(r.error); return }
  success(newLocalParentId.value ? 'Sub-local adicionado.' : 'Local adicionado.')
  addingLocal.value = false
  newLocalParentId.value = null
}
function startEditLocal(l) {
  editingLocalId.value = l.id
  editLocalName.value = l.name
  editLocalDesc.value = l.description || ''
}
function cancelEditLocal() { editingLocalId.value = null }
async function confirmEditLocal() {
  const r = await editLocal(editingLocalId.value, { name: editLocalName.value, description: editLocalDesc.value })
  if (!r.ok) { error(r.error); return }
  success('Local atualizado.')
  editingLocalId.value = null
}
function onDeleteLocal(l) {
  const children = getChildren(l.id)
  const msg = children.length
    ? `Excluir local "${l.name}" e seus ${children.length} sub-local(is)?`
    : `Excluir local "${l.name}"?`
  if (!confirm(msg)) return
  deleteLocal(l.id)
  success('Local removido.')
}
</script>
<template>
<!-- ===== Locais ===== -->
  <div>
    <div class="max-w-2xl">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-base font-semibold text-gray-800 dark:text-gray-100">Locais</h2>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Endereços físicos de armazenamento (prateleiras, armários, etc.) com subdivisões.</p>
        </div>
        <button
          v-if="!addingLocal"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          @click="startAddLocal(null)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Novo local
        </button>
      </div>

      <!-- Add form -->
      <div v-if="addingLocal" class="mb-4 rounded-xl border border-primary-300 dark:border-primary-700 bg-primary-50/40 dark:bg-primary-900/10 p-4 flex flex-col gap-3">
        <p class="text-xs font-semibold text-primary-600 dark:text-primary-400">
          {{ newLocalParentId ? `Novo sub-local de "${topLevelLocais.find(l => l.id === newLocalParentId)?.name}"` : 'Novo local' }}
        </p>
        <input
          v-model="newLocalName"
          :placeholder="newLocalParentId ? 'Nome do sub-local (ex: Nível 1, Seção A, Gaveta 2...)' : 'Nome do local (ex: Prateleira 1, Armário 3...)'"
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
        <!-- Parent selector (only when adding top-level, allow optionally setting a parent) -->
        <div v-if="!newLocalParentId && topLevelLocais.length" class="flex items-center gap-2">
          <label class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Local pai (opcional):</label>
          <select
            v-model="newLocalParentId"
            class="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
          >
            <option :value="null">— Nenhum (local principal) —</option>
            <option v-for="p in topLevelLocais" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="flex gap-2">
          <button class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors" @click="confirmAddLocal">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            Salvar
          </button>
          <button class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" @click="cancelAddLocal">Cancelar</button>
        </div>
      </div>

      <!-- Locais hierarchical list -->
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <template v-if="topLevelLocais.length">
          <div v-for="parent in topLevelLocais" :key="parent.id">
            <!-- Parent row -->
            <div
              class="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              :class="{ 'opacity-50': !parent.active }"
            >
              <template v-if="editingLocalId === parent.id">
                <input v-model="editLocalName" class="flex-1 px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none" @keydown.enter="confirmEditLocal" @keydown.escape="cancelEditLocal" autofocus />
                <input v-model="editLocalDesc" placeholder="Descrição..." class="flex-1 px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none" @keydown.enter="confirmEditLocal" @keydown.escape="cancelEditLocal" />
                <button class="p-1 text-green-500 hover:text-green-600" title="Salvar" @click="confirmEditLocal">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                </button>
                <button class="p-1 text-gray-400 hover:text-gray-600" title="Cancelar" @click="cancelEditLocal">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </template>
              <template v-else>
                <!-- Collapse chevron -->
                <button
                  v-if="getChildren(parent.id).length"
                  class="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-transform"
                  :class="{ '-rotate-90': collapsedLocais.has(parent.id) }"
                  @click="toggleCollapseLocal(parent.id)"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                </button>
                <span v-else class="w-4.5"></span>
                <!-- Location icon -->
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                <div class="flex-1 min-w-0">
                  <span class="font-medium text-sm text-gray-800 dark:text-gray-100">{{ parent.name }}</span>
                  <span v-if="parent.description" class="ml-2 text-xs text-gray-400 dark:text-gray-500">{{ parent.description }}</span>
                  <span class="ml-2 text-[10px] text-gray-400 dark:text-gray-500">{{ getChildren(parent.id).length ? `(${getChildren(parent.id).length} sub)` : '' }}</span>
                </div>
                <button
                  class="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors flex-shrink-0"
                  :class="parent.active
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
                  @click="toggleLocalActive(parent.id)"
                >{{ parent.active ? 'Ativo' : 'Inativo' }}</button>
                <button class="p-1 text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors" title="Adicionar sub-local" @click="startAddLocal(parent.id)">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </button>
                <button class="p-1 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors" title="Editar" @click="startEditLocal(parent)">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                </button>
                <button class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Excluir" @click="onDeleteLocal(parent)">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
                </button>
              </template>
            </div>

            <!-- Children rows (collapsible, indented) -->
            <template v-if="!collapsedLocais.has(parent.id)">
            <div
              v-for="child in getChildren(parent.id)"
              :key="child.id"
              class="flex items-center gap-2 pl-10 pr-4 py-2.5 border-b border-gray-50 dark:border-gray-700/30 bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100/60 dark:hover:bg-gray-700/20 transition-colors"
              :class="{ 'opacity-50': !child.active }"
            >
              <template v-if="editingLocalId === child.id">
                <input v-model="editLocalName" class="flex-1 px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none" @keydown.enter="confirmEditLocal" @keydown.escape="cancelEditLocal" autofocus />
                <input v-model="editLocalDesc" placeholder="Descrição..." class="flex-1 px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none" @keydown.enter="confirmEditLocal" @keydown.escape="cancelEditLocal" />
                <button class="p-1 text-green-500 hover:text-green-600" title="Salvar" @click="confirmEditLocal">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                </button>
                <button class="p-1 text-gray-400 hover:text-gray-600" title="Cancelar" @click="cancelEditLocal">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </template>
              <template v-else>
                <!-- Sub-location indicator -->
                <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
                <div class="flex-1 min-w-0">
                  <span class="text-sm text-gray-700 dark:text-gray-200">{{ child.name }}</span>
                  <span v-if="child.description" class="ml-2 text-xs text-gray-400 dark:text-gray-500">{{ child.description }}</span>
                </div>
                <button
                  class="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors flex-shrink-0"
                  :class="child.active
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
                  @click="toggleLocalActive(child.id)"
                >{{ child.active ? 'Ativo' : 'Inativo' }}</button>
                <button class="p-1 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors" title="Editar" @click="startEditLocal(child)">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                </button>
                <button class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Excluir" @click="onDeleteLocal(child)">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
                </button>
              </template>
            </div>
            </template>
          </div>
        </template>

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
</template>
