import { createApp } from 'vue'
import './style.css'
import './ui-system.css'
import App from './App.vue'
import { loadVisualStyle } from './composables/useTheme.js'

loadVisualStyle(localStorage.getItem('visual-style'))

createApp(App).mount('#app')
