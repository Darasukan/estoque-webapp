const UNITS = ['UN', 'PAR', 'CX', 'PCT', 'M', 'KG', 'L', 'RL', 'PC']

const suggestionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    identified: { type: 'boolean' },
    industrialSupply: { type: 'boolean' },
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
  required: ['identified', 'industrialSupply', 'group', 'category', 'subcategory', 'name', 'unit', 'confidence', 'attributes', 'observations']
}

function taxonomyKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function singularTaxonomyKey(value) {
  return taxonomyKey(value).replace(/s$/, '')
}

export function normalizeCatalogSuggestion(value) {
  const seen = new Set()
  const attributes = (Array.isArray(value?.attributes) ? value.attributes : [])
    .map(attribute => ({
      name: String(attribute?.name || '').trim(),
      value: attribute?.readable === false ? '' : String(attribute?.value || '').trim(),
      readable: Boolean(attribute?.readable)
    }))
    .filter(attribute => {
      const key = attribute.name.toLocaleLowerCase('pt-BR')
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })

  const category = String(value?.category || '').trim()
  let subcategory = String(value?.subcategory || '').trim()
  let name = String(value?.name || '').trim()
  const isBearing = singularTaxonomyKey(category) === 'rolamento' && taxonomyKey(name).startsWith('rolamento')
  if (isBearing) {
    subcategory = ''
    name = 'Rolamento'
  } else if (subcategory && [category, name].some(candidate => singularTaxonomyKey(candidate) === singularTaxonomyKey(subcategory))) {
    subcategory = ''
  }

  return {
    identified: Boolean(value?.identified),
    industrialSupply: value?.industrialSupply !== false,
    group: String(value?.group || '').trim(),
    category,
    subcategory,
    name,
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
        parts: [{ text: 'Você identifica e cataloga produtos e materiais a partir de fotos. Responda somente no schema JSON solicitado.' }]
      },
      contents: [{
        role: 'user',
        parts: [
          {
            text: `Catálogo atual: ${JSON.stringify(catalog)}\n\nIdentifique o produto ou material principal e proponha o caminho completo: grupo, subgrupo (category), subnível opcional (subcategory), nome do item, unidade e atributos. O item pode ficar diretamente no subgrupo: deixe subcategory vazio sempre que o subgrupo já classificar o produto; nunca crie subnível para repetir o subgrupo ou o nome do item, nem para guardar marca, modelo ou especificação. Exemplo obrigatório: rolamentos ficam como grupo Transmissão, subgrupo Rolamentos, subcategory vazio e item Rolamento; marca e número do modelo pertencem aos atributos da variação. Mesmo que o produto pareça doméstico, pessoal, comercial ou fora de suprimentos industriais, identifique-o normalmente, use identified=true, marque industrialSupply=false e inclua o motivo em observations; essa classificação nunca deve impedir o cadastro. Use identified=false somente quando não houver um produto identificável ou a imagem for ambígua. A prioridade é descobrir a família/nome genérico do item; os atributos são opcionais e servem apenas como ajuda. Prefira grupos, subgrupos e nomes de item existentes quando forem semanticamente adequados; crie nomes novos somente quando necessário. Quando o item existir no catálogo, reutilize exatamente os nomes de atributos já listados em attributes, variationAttributes e variationExamples; não crie sinônimos. Exemplo: se o item usa o atributo Viton com valor Sim/Não, retorne Viton, não Material de Vedação. Use como nome a família genérica do produto. Marca, modelo, medida, cor, potência, tensão, CA e demais especificações devem ser atributos, nunca parte do nome do item. Não tente estimar medidas pela foto: diâmetro, peso, tamanho, rosca, tensão e valores exatos só devem ter value preenchido quando estiverem legíveis no rótulo, embalagem, gravação ou forem visualmente inequívocos. Para atributo relevante mas ilegível/incerto, mantenha o atributo, use value vazio e readable=false. Não invente texto ou especificações.`
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
