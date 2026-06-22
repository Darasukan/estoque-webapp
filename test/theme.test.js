import test from 'node:test'
import assert from 'node:assert/strict'
import { useTheme } from '../src/composables/useTheme.js'

test('industrial theme toggles light and dark', () => {
  const values = new Map()
  const classes = new Set()
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
        classList: {
          toggle: (name, active) => active ? classes.add(name) : classes.delete(name),
        },
      },
    },
  })

  const { toggleTheme } = useTheme()
  assert.equal(classes.has('dark'), true)

  toggleTheme()
  assert.equal(classes.has('dark'), false)
  assert.equal(values.get('theme'), 'light')
})
