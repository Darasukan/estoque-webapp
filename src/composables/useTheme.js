import { computed, ref, watch } from 'vue'
import * as api from '../services/api.js'

const safeStyle = style => /^[a-z0-9][a-z0-9_-]*$/i.test(style || '') ? style.toLowerCase() : 'industrial'

export function loadVisualStyle(style) {
  const selected = safeStyle(style)
  const root = document.documentElement
  root.dataset && (root.dataset.visualStyle = selected)
  root.classList.remove?.('discord-style', 'vercel-style')

  let link = document.getElementById?.('app-theme')
  if (!link && document.createElement) {
    link = Object.assign(document.createElement('link'), { id: 'app-theme', rel: 'stylesheet' })
    document.head?.append(link)
  }
  if (link && link.dataset.theme !== selected) {
    link.dataset.theme = selected
    link.href = `/themes/${selected}.css`
  }
  return selected
}

export function useTheme() {
  const isDark = ref(true)
  const visualStyle = ref('industrial')
  const styles = ref([{ id: 'industrial', name: 'Industrial' }])
  const visualStyleName = computed(() =>
    styles.value.find(style => style.id === visualStyle.value)?.name || visualStyle.value
  )

  async function loadStyles() {
    try {
      const found = await api.getThemes()
      if (!Array.isArray(found) || !found.length) return
      styles.value = found
      if (found.some(style => style.id === visualStyle.value)) return
      visualStyle.value = found.find(style => style.id === 'industrial')?.id || found[0].id
      localStorage.setItem('visual-style', visualStyle.value)
      applyTheme()
    } catch {}
  }

  // Load preference from localStorage or system
  function init() {
    const saved = localStorage.getItem('theme')
    const savedStyle = localStorage.getItem('visual-style')
    if (saved) {
      isDark.value = saved === 'dark'
    } else {
      isDark.value = true
    }
    visualStyle.value = safeStyle(savedStyle)
    applyTheme()
    loadStyles()
  }

  function applyTheme() {
    document.documentElement.classList.toggle('dark', isDark.value)
    loadVisualStyle(visualStyle.value)
  }

  function toggleTheme() {
    isDark.value = !isDark.value
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    applyTheme()
  }

  function cycleStyle() {
    const index = styles.value.findIndex(style => style.id === visualStyle.value)
    visualStyle.value = styles.value[(index + 1) % styles.value.length].id
    localStorage.setItem('visual-style', visualStyle.value)
    applyTheme()
  }

  watch([isDark, visualStyle], applyTheme)
  init()

  return { isDark, toggleTheme, visualStyleName, cycleStyle }
}
