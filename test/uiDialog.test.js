import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve('src')

function vueFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(dir, entry.name)
    return entry.isDirectory() ? vueFiles(target) : entry.name.endsWith('.vue') ? [target] : []
  })
}

test('visible overlays use the native dialog contract', () => {
  const shell = fs.readFileSync(path.join(root, 'components/ui/AppDialog.vue'), 'utf8')

  assert.match(shell, /<dialog/)
  assert.match(shell, /\.showModal\(\)/)
  assert.match(shell, /@cancel\.prevent/)
  assert.match(shell, /aria-modal="true"/)

  const rawOverlays = vueFiles(root)
    .filter(file => !file.endsWith('AppDialog.vue') && !file.endsWith('VariationSheet.vue'))
    .filter(file => /fixed inset-0[^\r\n'"]*(?:bg-black|bg-gray-900)/.test(fs.readFileSync(file, 'utf8')))

  assert.deepEqual(rawOverlays, [])
})
