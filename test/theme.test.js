import test from 'node:test'
import assert from 'node:assert/strict'
import { useTheme } from '../src/composables/useTheme.js'
import { themesFromNames } from '../server/utils/themes.js'

test('themes are discovered from CSS filenames', () => {
  assert.deepEqual(themesFromNames(['glass.css', 'README.md', 'industrial.css', '../bad.css']), [
    { id: 'industrial', name: 'Industrial' },
    { id: 'glass', name: 'Glass' },
  ])
})

test('theme picker loads discovered themes and toggles light and dark', async () => {
  const values = new Map()
  const classes = new Set()
  let themeLink = null
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      documentElement: {
        dataset: {},
        classList: {
          toggle: (name, active) => active ? classes.add(name) : classes.delete(name),
          remove: (...names) => names.forEach(name => classes.delete(name)),
        },
      },
      getElementById: () => themeLink,
      createElement: () => ({ dataset: {} }),
      head: { append: link => { themeLink = link } },
    },
  })
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async () => ({
      status: 200,
      ok: true,
      json: async () => [
        { id: 'industrial', name: 'Industrial' },
        { id: 'discord', name: 'Discord' },
        { id: 'vercel', name: 'Vercel' },
        { id: 'glass', name: 'Glass' },
      ],
    }),
  })

  const { toggleTheme, cycleStyle } = useTheme()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(classes.has('dark'), true)
  assert.equal(themeLink.href, '/themes/industrial.css')

  toggleTheme()
  assert.equal(classes.has('dark'), false)
  assert.equal(values.get('theme'), 'light')

  cycleStyle()
  assert.equal(themeLink.href, '/themes/discord.css')
  cycleStyle()
  cycleStyle()
  assert.equal(themeLink.href, '/themes/glass.css')
})
