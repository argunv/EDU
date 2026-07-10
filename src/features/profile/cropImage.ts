export type PixelCrop = {
  x: number
  y: number
  width: number
  height: number
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('Не удалось загрузить изображение')))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })
}

export async function cropImageToBlob(
  imageSrc: string,
  pixelCrop: PixelCrop,
  outputSize = 512,
  mimeType: 'image/jpeg' | 'image/webp' = 'image/jpeg',
): Promise<Blob> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas недоступен')

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Не удалось обработать изображение'))
          return
        }
        resolve(blob)
      },
      mimeType,
      0.92,
    )
  })
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Не удалось прочитать файл'))
    }
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsDataURL(file)
  })
}

export async function readClipboardImage(): Promise<File | null> {
  if (!navigator.clipboard?.read) return null
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type)
          const ext = type.split('/')[1] ?? 'png'
          return new File([blob], `clipboard.${ext}`, { type })
        }
      }
    }
  } catch {
    return null
  }
  return null
}
