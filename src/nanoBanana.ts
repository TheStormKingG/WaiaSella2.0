import { NANO_BANANA_CONFIG } from './config'

type EnhanceProductImageInput = {
  /** The source image as a data URL, base64 string, or remote URL */
  image: string
  /** Product name provided by the user */
  itemName: string
  /** Product category provided by the user */
  category: string
}

export class NanoBananaError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message)
    this.name = 'NanoBananaError'
  }
}

const NEGATIVE_PROMPT = [
  'blurry',
  'low-resolution',
  'distorted',
  'unrealistic lighting',
  'text overlay',
  'watermark',
  'hands',
  'people',
  'background clutter',
].join(', ')

const DEFAULT_IMAGE_MIME = 'image/png'

export function isNanoBananaConfigured(): boolean {
  return Boolean(NANO_BANANA_CONFIG.apiKey && NANO_BANANA_CONFIG.apiUrl)
}

export async function enhanceProductImage({ image, itemName, category }: EnhanceProductImageInput): Promise<string> {
  if (!isNanoBananaConfigured()) {
    throw new NanoBananaError('Nano Banana is not configured')
  }

  const normalisedImage = await ensureDataUrl(image)
  const base64Image = extractBase64(normalisedImage)
  const prompt = buildPrompt(itemName, category)

  const endpoint = buildEndpoint('images/enhance')

  const body = {
    model: NANO_BANANA_CONFIG.model,
    input: {
      image: base64Image,
      prompt,
      negative_prompt: NEGATIVE_PROMPT,
      size: '1024x1024',
      output_format: 'png',
      upscale: true,
    },
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timeoutId = controller ? setTimeout(() => controller.abort(), 45_000) : null

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${NANO_BANANA_CONFIG.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller?.signal,
    })

    if (!response.ok) {
      const message = await safeReadError(response)
      throw new NanoBananaError(`Nano Banana request failed: ${response.status} ${response.statusText}`, message)
    }

    const payload = await response.json().catch((err) => {
      throw new NanoBananaError('Failed to parse Nano Banana response', err)
    })

    const enhancedImage = resolveImageFromPayload(payload)
    if (!enhancedImage) {
      throw new NanoBananaError('Nano Banana response did not contain an image', payload)
    }

    return normaliseImageOutput(enhancedImage)
  } finally {
    if (timeoutId != null) {
      clearTimeout(timeoutId)
    }
  }
}

function buildPrompt(itemName: string, category: string): string {
  const name = itemName.trim()
  const cat = category.trim()
  const subject = name && cat ? `${name} (${cat})` : name || cat || 'retail product'

  return [
    'Studio-quality, high-resolution product photo',
    `Subject: ${subject}`,
    'Clean white seamless background',
    'Photorealistic lighting and accurate colors',
    'Packaging perfectly centered, no props, no text',
  ].join('. ')
}

function buildEndpoint(path: string): string {
  const base = NANO_BANANA_CONFIG.apiUrl.replace(/\/$/, '')
  return `${base}/${path}`
}

async function ensureDataUrl(image: string): Promise<string> {
  if (!image) {
    throw new NanoBananaError('No image provided for enhancement')
  }

  if (image.startsWith('data:')) {
    return image
  }

  if (/^https?:\/\//i.test(image)) {
    try {
      const response = await fetch(image, { mode: 'cors' })
      if (!response.ok) {
        throw new NanoBananaError(`Failed to fetch source image: ${response.status}`)
      }
      const blob = await response.blob()
      return await blobToDataUrl(blob)
    } catch (err) {
      throw new NanoBananaError('Could not download remote image for enhancement', err)
    }
  }

  // Assume a raw base64 string
  return `data:${DEFAULT_IMAGE_MIME};base64,${image}`
}

function extractBase64(dataUrl: string): string {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/)
  if (!match) {
    throw new NanoBananaError('Invalid data URL provided to Nano Banana')
  }
  return match[2]
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Failed to convert blob to data URL'))
    reader.readAsDataURL(blob)
  })
}

async function safeReadError(response: Response): Promise<unknown> {
  try {
    const text = await response.text()
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  } catch {
    return null
  }
}

function resolveImageFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const anyPayload = payload as Record<string, unknown>

  const direct = readImageField(anyPayload)
  if (direct) return direct

  const data = anyPayload.data
  if (data) {
    if (typeof data === 'string') {
      const image = readImageField({ image: data })
      if (image) return image
    }

    if (Array.isArray(data)) {
      for (const entry of data) {
        if (entry && typeof entry === 'object') {
          const image = readImageField(entry as Record<string, unknown>)
          if (image) return image
        }
        if (typeof entry === 'string' && entry) {
          return entry
        }
      }
    }

    if (typeof data === 'object') {
      const image = readImageField(data as Record<string, unknown>)
      if (image) return image
    }
  }

  const output = anyPayload.output ?? anyPayload.outputs ?? anyPayload.result
  if (typeof output === 'string') {
    return output
  }
  if (Array.isArray(output)) {
    for (const entry of output) {
      if (typeof entry === 'string' && entry) {
        return entry
      }
      if (entry && typeof entry === 'object') {
        const image = readImageField(entry as Record<string, unknown>)
        if (image) return image
      }
    }
  }

  return null
}

function readImageField(source: Record<string, unknown>): string | null {
  const keys = ['image', 'image_base64', 'imageBase64', 'image_url', 'imageUrl', 'url']
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value) {
      return value
    }
  }
  return null
}

function normaliseImageOutput(image: string): string {
  if (image.startsWith('data:')) {
    return image
  }
  if (/^https?:\/\//i.test(image)) {
    return image
  }
  return `data:${DEFAULT_IMAGE_MIME};base64,${image}`
}

