<script setup>
import { ref } from 'vue'
import { useAuth } from '../../composables/useAuth.js'
import AppButton from './AppButton.vue'

defineProps({ show: { type: Boolean, default: false } })
const emit = defineEmits(['close'])

const { login } = useAuth()
const user = ref('')
const pass = ref('')
const errorMsg = ref('')

function onSubmit() {
  errorMsg.value = ''
  if (!user.value.trim() || !pass.value) {
    errorMsg.value = 'Preencha usuário e senha.'
    return
  }
  login(user.value.trim(), pass.value).then(ok => {
    if (ok) {
      user.value = ''
      pass.value = ''
      errorMsg.value = ''
      emit('close')
    } else {
      errorMsg.value = 'Usuário ou senha incorretos.'
    }
  })
}

function onCancel() {
  user.value = ''
  pass.value = ''
  errorMsg.value = ''
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
      @click.self="onCancel"
      @keydown.escape="onCancel"
    >
      <div class="ds-panel w-full max-w-sm mx-4 p-6" @click.stop>
        <div class="mb-5 flex justify-center">
          <img
            src="/local-brand/logo.jpg"
            alt="Colorindo Beneficiamento Textil"
            class="max-h-28 w-auto rounded-lg bg-white object-contain p-2"
            @error="$event.currentTarget.style.display = 'none'"
          />
        </div>

        <!-- Header -->
        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
            <svg class="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">Entrar</h3>
            <p class="text-xs text-gray-400 dark:text-gray-500">Acesso administrativo</p>
          </div>
        </div>

        <form @submit.prevent="onSubmit" class="space-y-4">
          <!-- Usuário -->
          <div>
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Usuário</label>
            <input
              v-model="user"
              type="text"
              autocomplete="username"
              class="ds-input"
              placeholder="Usuário"
            />
          </div>

          <!-- Senha -->
          <div>
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Senha</label>
            <input
              v-model="pass"
              type="password"
              autocomplete="current-password"
              class="ds-input"
              placeholder="Senha"
            />
          </div>

          <!-- Erro -->
          <p v-if="errorMsg" class="text-xs text-red-500 dark:text-red-400 font-medium">{{ errorMsg }}</p>

          <!-- Ações -->
          <div class="flex justify-end gap-2 pt-2">
            <AppButton
              type="button"
              variant="secondary"
              @click="onCancel"
            >Cancelar</AppButton>
            <AppButton
              type="submit"
              variant="primary"
            >Entrar</AppButton>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
