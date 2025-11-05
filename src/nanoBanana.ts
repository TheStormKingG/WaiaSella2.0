import { NANO_BANANA_CONFIG } from './config'

type EnhanceOptions = {
  imageDataUrl: string
  itemName: string
  category: string
}

const DEFAULT_API_ROOT = 'https://api.nanobanana.ai/v1'

function buildPrompt(itemName: string, category: string): string {
  const name = itemName.trim() || 'product'
  const cat = category.trim()
  const descriptors = [
    `Ultra realistic product photo of ${name}`,
    'studio lighting',
    'high-definition',
    'crisp details',
    'clean seamless background',
    'premium catalog photography',
  ]
  if (cat) {
    descriptors.splice(1, 0, `${cat.toLowerCase()} category focus`)
  }
  return descriptors.join(', ')
}

function extractBase64Payload(dataUrl: string): { mime: string; base64: string } | null {
  const [meta, payload] = dataUrl.split(',')
  if (!meta || !payload) return null
  const match = meta.match(/^data:(.*?);base64$/)
  if (!match) return null
  return { mime: match[1] || 'image/png', base64: payload }
}

function normaliseEndpoint(root: string | undefined): string {
  const base = (root || DEFAULT_API_ROOT).trim()
  return base.endsWith('/') ? base.slice(0, -1) : base
}

function coerceImageOutput(result: unknown, fallbackMime: string): string | null {
  const tryParse = (value: unknown): string | null => {
    if (!value || typeof value !== 'object') return null
    const candidate = (value as Record<string, unknown>).imageUrl
      || (value as Record<string, unknown>).image_url
      || (value as Record<string, unknown>).outputUrl
      || (value as Record<string, unknown>).output_url
      || (value as Record<string, unknown>).url
      || null
    if (typeof candidate === 'string') return candidate
    const base64 = (value as Record<string, unknown>).imageBase64
      || (value as Record<string, unknown>).image_base64
      || (value as Record<string, unknown>).base64
      || null
    if (typeof base64 === 'string' && base64.length > 100) {
      return `data:${fallbackMime};base64,${base64}`
    }
    return null
  }

  if (typeof result === 'string') {
    if (result.startsWith('http')) return result
    if (result.length > 100) return `data:${fallbackMime};base64,${result}`
    return null
  }

  if (Array.isArray(result)) {
    for (const item of result) {
      const parsed = coerceImageOutput(item, fallbackMime)
      if (parsed) return parsed
    }
    return null
  }

  if (result && typeof result === 'object') {
    const direct = tryParse(result)
    if (direct) return direct

    const keysToInspect = ['data', 'result', 'output', 'image', 'images', 'outputs'] as const
    for (const key of keysToInspect) {
      const nested = (result as Record<string, unknown>)[key]
      const parsed = coerceImageOutput(nested, fallbackMime)
      if (parsed) return parsed
    }
  }

  return null
}

export async function enhanceProductImage(options: EnhanceOptions): Promise<string | null> {
  const { imageDataUrl, itemName, category } = options
  if (!imageDataUrl.startsWith('data:')) return null

  const payload = extractBase64Payload(imageDataUrl)
  if (!payload) {
    console.warn('[Nano Banana] Could not parse provided image data URL.')
    return null
  }

  const apiKey = NANO_BANANA_CONFIG.apiKey
  if (!apiKey) {
    console.warn('[Nano Banana] API key not configured. Skipping enhancement.')
    return null
  }

  const apiRoot = normaliseEndpoint(NANO_BANANA_CONFIG.apiUrl)
  const endpoint = `${apiRoot}/image/enhance`

  const body: Record<string, unknown> = {
    image_base64: payload.base64,
    mode: 'product_cleanup',
    response_format: 'base64',
    prompt: buildPrompt(itemName, category),
    context: {
      itemName,
      category,
    },
  }

  if (NANO_BANANA_CONFIG.modelId) {
    body.model = NANO_BANANA_CONFIG.modelId
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Nano Banana request failed (${res.status}): ${text}`)
    }

    const result = await res.json().catch(() => null)
    const enhancedImage = coerceImageOutput(result, payload.mime)
    if (!enhancedImage) {
      console.warn('[Nano Banana] Enhancement response missing image payload.', result)
    }
    return enhancedImage
  } catch (error) {
    console.error('[Nano Banana] Failed to enhance image.', error)
    return null
  }
}

