const UNITS = ['UN', 'PAR', 'CX', 'PCT', 'M', 'KG', 'L', 'RL', 'PC']

const suggestionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    identified: { type: 'boolean' },
    group: { type: 'string' },
    category: { type: 'string' },
    subcategory: { type: 'string' },
    name: { type: 'string' },
    unit: { type: 'string', enum: UNITS },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    attributes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          value: { type: 'string' },
          readable: { type: 'boolean' }
        },
        required: ['name', 'value', 'readable']
      }
    },
    observations: { type: 'array', items: { type: 'string' } }
  },
  required: ['identified', 'group', 'category', 'subcategory', 'name', 'unit', 'confidence', 'attributes', 'observations']
}

export function normalizeCatalogSuggestion(value) {
  const seen = new Set()
  const attributes = (Array.isArray(value?.attributes) ? value.attributes : [])
    .map(attribute => ({
      name: String(attribute?.name || '').trim(),
      value: String(attribute?.value || '').trim(),
      readable: Boolean(attribute?.readable)
    }))
    .filter(attribute => {
      const key = attribute.name.toLocaleLowerCase('pt-BR')
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })

  return {
    identified: Boolean(value?.identified),
    group: String(value?.group || '').trim(),
    category: String(value?.category || '').trim(),
    subcategory: String(value?.subcategory || '').trim(),
    name: String(value?.name || '').trim(),
    unit: UNITS.includes(value?.unit) ? value.unit : 'UN',
    confidence: Math.min(1, Math.max(0, Number(value?.confidence) || 0)),
    attributes,
    observations: (Array.isArray(value?.observations) ? value.observations : [])
      .map(note => String(note || '').trim())
      .filter(Boolean)
  }
}

export async function analyzeCatalogImage({ image, catalog, apiKey, model, fetchImpl = fetch }) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/is.exec(image)
  if (!match) throw new Error('Formato de imagem inválido.')

  const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: 'Você cataloga materiais de estoque industrial a partir de fotos. Responda somente no schema JSON solicitado.' }]
      },
      contents: [{
        role: 'user',
        parts: [
          {
            text: `Catálogo atual: ${JSON.stringify(catalog)}\n\nIdentifique o material principal e proponha o caminho completo: grupo, subgrupo (category), subnível opcional (subcategory), nome do item, unidade e atributos. Prefira grupos e subgrupos existentes quando forem semanticamente adequados; crie nomes novos somente quando necessário. Use como nome a família genérica do produto. Marca, modelo, medida, cor, potência, tensão, CA e demais especificações devem ser atributos. Inclua somente características úteis para diferenciar variações. Para atributo relevante mas ilegível, use valor vazio e readable=false. Não invente texto ou especificações. Se não houver material catalogável ou a imagem for ambígua, use identified=false, campos de hierarquia e nome vazios, e explique em observations.`
          },
          { inlineData: { mimeType: match[1], data: match[2] } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseJsonSchema: suggestionSchema
      }
    }),
    signal: AbortSignal.timeout(60_000)
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'A análise da imagem falhou.')
    error.status = response.status
    throw error
  }

  const text = data.candidates?.[0]?.content?.parts?.find(part => part.text)?.text
  if (!text) throw new Error('A IA não retornou uma sugestão válida.')
  return normalizeCatalogSuggestion(JSON.parse(text))
}
