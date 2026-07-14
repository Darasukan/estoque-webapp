function imageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler a imagem.'))
    }
    image.src = url
  })
}

function canvasToJpeg(canvas, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
}

export async function compressImageFile(file, {
  maxBytes = 6 * 1024 * 1024,
  maxEdge = 1800,
  minEdge = 900,
  alwaysJpeg = false,
} = {}) {
  if (!alwaysJpeg && file.size <= maxBytes) return file

  const image = await imageFromBlob(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível reduzir a imagem.')

  const sourceEdge = Math.max(image.width, image.height)
  let targetEdge = Math.min(maxEdge, sourceEdge)

  while (targetEdge >= Math.min(minEdge, sourceEdge)) {
    const scale = Math.min(1, targetEdge / sourceEdge)
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    for (let quality = 0.84; quality >= 0.4; quality -= 0.1) {
      const blob = await canvasToJpeg(canvas, quality)
      if (blob && blob.size <= maxBytes) return blob
    }

    if (targetEdge === sourceEdge && sourceEdge < minEdge) break
    targetEdge = Math.round(targetEdge * 0.82)
  }

  throw new Error(`Não foi possível reduzir a imagem para menos de ${Math.round(maxBytes / 1024 / 1024 * 10) / 10} MB.`)
}

export function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(file)
  })
}
