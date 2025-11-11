// AI Image Generation Configuration
// Configure your preferred AI service here

export interface AIConfig {
  service: 'gemini' | 'stability' | 'replicate' | 'dalle' | 'custom'
  apiKey: string
  endpoint?: string
  model?: string
}

// Configure your AI service here
export const AI_CONFIG: AIConfig = {
  service: (import.meta.env.VITE_AI_SERVICE || 'gemini') as any,
  apiKey: import.meta.env.VITE_AI_API_KEY || '', // API key from environment variable
  model: import.meta.env.VITE_AI_MODEL || 'gemini-2.0-flash-exp'
}

// Product image generation prompt template
export function buildProductImagePrompt(
  itemName: string,
  category: string,
  userImageContext?: string
): string {
  return `Professional product photography of ${itemName}, ${category} category, 
studio lighting, white background, high quality, detailed, commercial product shot, 
e-commerce ready, 4k resolution, centered composition${userImageContext ? `, ${userImageContext}` : ''}`
}

// Enhanced prompt with search context
export async function enhancePromptWithSearch(
  itemName: string,
  category: string
): Promise<string> {
  // You can integrate Google Custom Search API or similar here
  // For now, we'll add context-aware enhancements
  
  const contextEnhancements: Record<string, string> = {
    'Drinks': 'beverage, refreshing, clear glass bottle or can',
    'Food': 'appetizing, fresh ingredients, culinary presentation',
    'Electronics': 'modern, sleek design, technology',
    'Clothing': 'fashion, textile detail, wearable',
    'Books': 'book cover, readable title, publishing',
    'Toys': 'colorful, playful, child-friendly',
    'Tools': 'industrial, practical, metal finish',
    'Beauty': 'cosmetic, elegant packaging, skincare',
    'Sports': 'athletic, performance, sports equipment',
    'Home': 'household item, domestic use, practical design'
  }
  
  const categoryContext = contextEnhancements[category] || 'product'
  const basePrompt = buildProductImagePrompt(itemName, category)
  
  return `${basePrompt}, ${categoryContext}`
}

// API call interfaces for different services
export interface ImageGenerationResult {
  success: boolean
  imageUrl?: string
  imageData?: string // Base64 data URL
  error?: string
}

// Google Gemini API call (Nano Banana - Gemini 2.5 Flash Image)
async function generateWithGemini(prompt: string): Promise<ImageGenerationResult> {
  if (!AI_CONFIG.apiKey) {
    return { 
      success: false, 
      error: 'Gemini API key not configured. Get one from https://aistudio.google.com/apikey' 
    }
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.model}:generateContent?key=${AI_CONFIG.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 1,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
            responseMimeType: "image/jpeg"
          }
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      return { 
        success: false, 
        error: error.error?.message || `Gemini API error: ${response.status}` 
      }
    }

    const result = await response.json()
    
    // Gemini returns base64-encoded image in the response
    if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.inlineData) {
      const imageData = result.candidates[0].content.parts[0].inlineData
      const mimeType = imageData.mimeType || 'image/jpeg'
      const base64Data = imageData.data
      
      return { 
        success: true, 
        imageData: `data:${mimeType};base64,${base64Data}` 
      }
    }
    
    return { 
      success: false, 
      error: 'No image data in Gemini response' 
    }
  } catch (error) {
    return { 
      success: false, 
      error: `Gemini error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

// Stability AI API call
async function generateWithStability(prompt: string): Promise<ImageGenerationResult> {
  if (!AI_CONFIG.apiKey) {
    return { 
      success: false, 
      error: 'Stability AI API key not configured. Please add your API key to src/ai-config.ts' 
    }
  }

  try {
    const response = await fetch(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
        },
        body: JSON.stringify({
          text_prompts: [
            {
              text: prompt,
              weight: 1
            },
            {
              text: 'blurry, low quality, distorted, amateur, cluttered background',
              weight: -1
            }
          ],
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          samples: 1,
          steps: 30,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.message || 'Stability AI request failed' }
    }

    const result = await response.json()
    const imageData = result.artifacts[0].base64
    return { 
      success: true, 
      imageData: `data:image/png;base64,${imageData}` 
    }
  } catch (error) {
    return { 
      success: false, 
      error: `Stability AI error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

// Replicate API call
async function generateWithReplicate(prompt: string): Promise<ImageGenerationResult> {
  if (!AI_CONFIG.apiKey) {
    return { 
      success: false, 
      error: 'Replicate API key not configured. Please add your API key to src/ai-config.ts' 
    }
  }

  try {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${AI_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'stability-ai/sdxl:latest',
        input: {
          prompt: prompt,
          negative_prompt: 'blurry, low quality, distorted, amateur, cluttered background',
          width: 1024,
          height: 1024,
        }
      })
    })

    if (!response.ok) {
      return { success: false, error: 'Replicate API request failed' }
    }

    const prediction = await response.json()
    
    // Poll for completion
    let result = prediction
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 1000))
      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${result.id}`,
        {
          headers: { 'Authorization': `Token ${AI_CONFIG.apiKey}` }
        }
      )
      result = await pollResponse.json()
    }

    if (result.status === 'failed') {
      return { success: false, error: 'Image generation failed' }
    }

    return { 
      success: true, 
      imageUrl: result.output[0] 
    }
  } catch (error) {
    return { 
      success: false, 
      error: `Replicate error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

// DALL-E API call
async function generateWithDalle(prompt: string): Promise<ImageGenerationResult> {
  if (!AI_CONFIG.apiKey) {
    return { 
      success: false, 
      error: 'OpenAI API key not configured. Please add your API key to src/ai-config.ts' 
    }
  }

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      })
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error?.message || 'DALL-E request failed' }
    }

    const result = await response.json()
    return { 
      success: true, 
      imageUrl: result.data[0].url 
    }
  } catch (error) {
    return { 
      success: false, 
      error: `DALL-E error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

// Main function to generate product image
export async function generateProductImage(
  itemName: string,
  category: string,
  userImageReference?: string
): Promise<ImageGenerationResult> {
  // Build enhanced prompt
  const enhancedPrompt = await enhancePromptWithSearch(itemName, category)
  
  console.log('🎨 Generating product image with prompt:', enhancedPrompt)
  console.log('🍌 Using service:', AI_CONFIG.service)
  
  // Call appropriate AI service
  switch (AI_CONFIG.service) {
    case 'gemini':
      return await generateWithGemini(enhancedPrompt)
    case 'stability':
      return await generateWithStability(enhancedPrompt)
    case 'replicate':
      return await generateWithReplicate(enhancedPrompt)
    case 'dalle':
      return await generateWithDalle(enhancedPrompt)
    case 'custom':
      // For custom endpoints
      if (!AI_CONFIG.endpoint) {
        return { success: false, error: 'Custom endpoint not configured' }
      }
      // Implement custom API call here
      return { success: false, error: 'Custom service not implemented' }
    default:
      return { success: false, error: 'Unknown AI service configured' }
  }
}

// Convert image URL to base64 data URL (for external URLs from APIs like DALL-E)
export async function convertUrlToDataUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('Error converting URL to data URL:', error)
    throw error
  }
}

