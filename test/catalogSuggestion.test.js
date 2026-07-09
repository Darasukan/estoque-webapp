import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeCatalogImage, normalizeCatalogSuggestion } from '../server/utils/catalogSuggestion.js'

test('normalizes and deduplicates an image catalog suggestion', () => {
  assert.deepEqual(normalizeCatalogSuggestion({
    identified: true,
    group: ' EPIs ',
    category: ' Luvas ',
    subcategory: '',
    name: ' Luva nitrílica ',
    unit: 'INVALID',
    confidence: 2,
    attributes: [
      { name: ' Marca ', value: 'Volk', readable: true },
      { name: 'marca', value: 'Outra', readable: true },
      { name: 'Diâmetro', value: '8mm', readable: false },
      { name: '', value: 'ignorar', readable: true }
    ],
    observations: [' CA ilegível ', '']
  }), {
    identified: true,
    group: 'EPIs',
    category: 'Luvas',
    subcategory: '',
    name: 'Luva nitrílica',
    unit: 'UN',
    confidence: 1,
    attributes: [
      { name: 'Marca', value: 'Volk', readable: true },
      { name: 'Diâmetro', value: '', readable: false }
    ],
    observations: ['CA ilegível']
  })
})

test('sends image and JSON schema to Gemini', async () => {
  let request
  const result = await analyzeCatalogImage({
    image: 'data:image/png;base64,AAAA',
    catalog: { hierarchy: ['EPIs > Luvas'], examples: [] },
    apiKey: 'test-key',
    model: 'gemini-test',
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) }
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({
            identified: true,
            group: 'EPIs',
            category: 'Luvas',
            subcategory: '',
            name: 'Luva nitrílica',
            unit: 'PAR',
            confidence: 0.9,
            attributes: [],
            observations: []
          }) }] } }]
        })
      }
    }
  })

  assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent')
  assert.equal(request.options.headers['x-goog-api-key'], 'test-key')
  assert.equal(request.body.contents[0].parts[1].inlineData.data, 'AAAA')
  assert.match(request.body.contents[0].parts[0].text, /prioridade é descobrir a família\/nome genérico/i)
  assert.match(request.body.contents[0].parts[0].text, /Não tente estimar medidas pela foto/i)
  assert.equal(request.body.generationConfig.responseMimeType, 'application/json')
  assert.equal(request.body.generationConfig.responseJsonSchema.required.includes('group'), true)
  assert.equal(result.name, 'Luva nitrílica')
})
