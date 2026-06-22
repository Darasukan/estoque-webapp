export const PROD_RESET_CONFIRMATION = 'APAGAR_PRODUCAO'

export function isProductionEnv(envFile) {
  return String(envFile || '').replaceAll('\\', '/').split('/').at(-1) === '.env.prod'
}

export function seedMutationAllowed(envFile, explicitlyEnabled = false) {
  if (isProductionEnv(envFile)) return false
  const name = String(envFile || '').replaceAll('\\', '/').split('/').at(-1)
  return name === '.env.dev' || explicitlyEnabled === true
}

export function assertResetAllowed({ mode, envFile, confirmation }) {
  if (mode !== 'reset' || !isProductionEnv(envFile)) return
  if (confirmation === PROD_RESET_CONFIRMATION) return
  throw new Error(
    `Reset de produção bloqueado. Execute novamente com --confirm=${PROD_RESET_CONFIRMATION}.`
  )
}
