import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeCatalogImage, normalizeCatalogSuggestion } from '../server/utils/catalogSuggestion.js'

test('normalizes and deduplicates an image catalog suggestion', () => {
  assert.deepEqual(normalizeCatalogSuggestion({
    identified: true,
    industrialSupply: false,
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
    industrialSupply: false,
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

test('keeps bearings as one item directly under the subgroup', () => {
  const result = normalizeCatalogSuggestion({
    identified: true,
    group: 'Transmissão',
    category: 'Rolamentos',
    subcategory: 'Rolamento Rígido de Esferas',
    name: 'Rolamento Rígido de Esferas',
    unit: 'UN',
    attributes: [
      { name: 'Marca', value: 'NSK', readable: true },
      { name: 'Modelo', value: '6208ZZC3', readable: true }
    ]
  })

  assert.equal(result.subcategory, '')
  assert.equal(result.name, 'Rolamento')
  assert.deepEqual(result.attributes.map(attribute => attribute.name), ['Marca', 'Modelo'])
})

test('sends image and JSON schema to Gemini', async () => {
  let request
  const result = await analyzeCatalogImage({
    image: 'data:image/png;base64,AAAA',
    catalog: {
      hierarchy: ['EPIs > Luvas'],
      examples: [{
        path: 'Vedacoes > Aneis',
        name: 'O-ring',
        unit: 'UN',
        attributes: ['Diametro', 'Viton'],
        variationAttributes: ['Diametro', 'Viton'],
        variationExamples: [{ Diametro: '20mm', Viton: 'Sim' }]
      }]
    },
    apiKey: 'test-key',
    model: 'gemini-test',
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) }
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({
            identified: true,
            industrialSupply: true,
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
  assert.match(request.body.contents[0].parts[0].text, /deixe subcategory vazio/i)
  assert.match(request.body.contents[0].parts[0].text, /rolamentos ficam como grupo Transmissão/i)
  assert.match(request.body.contents[0].parts[0].text, /reutilize exatamente os nomes de atributos/i)
  assert.match(request.body.contents[0].parts[0].text, /Viton/i)
  assert.match(request.body.contents[0].parts[0].text, /Não tente estimar medidas pela foto/i)
  assert.match(request.body.contents[0].parts[0].text, /fora de suprimentos industriais/i)
  assert.equal(request.body.generationConfig.responseMimeType, 'application/json')
  assert.equal(request.body.generationConfig.responseJsonSchema.required.includes('group'), true)
  assert.equal(request.body.generationConfig.responseJsonSchema.required.includes('industrialSupply'), true)
  assert.equal(result.name, 'Luva nitrílica')
})
