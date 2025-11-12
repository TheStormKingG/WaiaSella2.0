// AI Image Generation Configuration
// Configure your preferred AI service here

export interface AIConfig {
  service: 'pollinations' | 'huggingface' | 'stability' | 'replicate' | 'dalle' | 'custom'
  apiKey: string
  endpoint?: string
  model?: string
}

// Configure your AI service here
export const AI_CONFIG: AIConfig = {
  service: (import.meta.env.VITE_AI_SERVICE || 'pollinations') as any,
  apiKey: import.meta.env.VITE_AI_API_KEY || 'none', // No API key needed for free services!
  model: import.meta.env.VITE_AI_MODEL || 'flux'
}

// Product image generation prompt template (enhanced with detailed label info)
export function buildProductImagePrompt(
  itemName: string,
  category: string,
  userImageContext?: string,
  extractedName?: string,
  brandName?: string,
  allLabelText?: string[]
): string {
  // Use the extracted name if available (more specific than user input)
  const productName = extractedName || itemName
  
  // Build label context from all extracted text
  let labelContext = ''
  if (brandName || allLabelText?.length) {
    const labelElements: string[] = []
    if (brandName) labelElements.push(`brand: "${brandName}"`)
    if (allLabelText && allLabelText.length > 0) {
      const labelText = allLabelText.slice(0, 3).join(', ') // Top 3 text elements
      labelElements.push(`label text: "${labelText}"`)
    }
    labelContext = `, ${labelElements.join(', ')}`
  }
  
  // Build a detailed prompt that emphasizes accurate labeling
  return `Professional product photography of ${productName}, ${category} category, 
CRITICAL: product packaging must display accurate brand label with "${brandName || productName}" prominently visible,
product label must show clear, readable text matching the actual product${labelContext},
studio lighting, white background, high quality, detailed, commercial product shot, 
e-commerce ready, crisp focus on label text, centered composition, 
brand name and product information clearly visible and legible on packaging, 4k resolution${userImageContext ? `, visual reference: ${userImageContext}` : ''}`
}

// Enhanced prompt with search context
export async function enhancePromptWithSearch(
  itemName: string,
  category: string,
  extractedName?: string
): Promise<string> {
  // You can integrate Google Custom Search API or similar here
  // For now, we'll add context-aware enhancements with emphasis on labeling
  
  const contextEnhancements: Record<string, string> = {
    'Drinks': 'beverage bottle or can with brand label clearly visible, refreshing product shot',
    'Food': 'packaged food product with brand name and product label visible, appetizing presentation',
    'Electronics': 'electronic device with brand logo visible, modern product photography',
    'Clothing': 'clothing item with visible brand tag or label, fashion photography',
    'Books': 'book with title and author clearly readable on cover',
    'Toys': 'toy with brand name and product packaging visible',
    'Tools': 'tool with brand marking visible, industrial product shot',
    'Beauty': 'beauty product with label and brand name clearly visible, cosmetic packaging',
    'Sports': 'sports equipment with brand logo visible, athletic gear photography',
    'Home': 'household item with brand label visible, product packaging',
    'Personal Care': 'personal care product with clear brand label, packaging visible',
    'Groceries': 'grocery product with packaging label clearly readable',
    'Snacks': 'snack package with brand name prominently displayed',
    'Produce': 'fresh produce with any visible branding or label'
  }
  
  const categoryContext = contextEnhancements[category] || 'product with visible brand label'
  const productName = extractedName || itemName
  
  // Emphasize accurate labeling in the prompt
  return `Professional product photography of ${productName}, ${categoryContext}, 
ensure product label shows "${productName}" text clearly and accurately, 
studio lighting, white background, high quality, product label in sharp focus, 
commercial e-commerce product shot, 4k resolution, centered composition`
}

// API call interfaces for different services
export interface ImageGenerationResult {
  success: boolean
  imageUrl?: string
  imageData?: string // Base64 data URL
  error?: string
}

// Pollinations.ai - Completely FREE, no API key needed!
async function generateWithPollinations(prompt: string): Promise<ImageGenerationResult> {
  try {
    // Pollinations uses a simple URL-based API - completely free!
    const encodedPrompt = encodeURIComponent(prompt)
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&enhance=true`
    
    console.log('🌸 Generating with Pollinations.ai (FREE):', prompt)
    
    // Fetch the image
    const response = await fetch(imageUrl)
    if (!response.ok) {
      return { 
        success: false, 
        error: `Pollinations API error: ${response.status}` 
      }
    }
    
    // Convert to base64
    const blob = await response.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        resolve({
          success: true,
          imageData: reader.result as string
        })
      }
      reader.onerror = () => {
        resolve({
          success: false,
          error: 'Failed to convert image to base64'
        })
      }
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    return { 
      success: false, 
      error: `Pollinations error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

// Hugging Face Inference API - FREE tier available!
async function generateWithHuggingFace(prompt: string): Promise<ImageGenerationResult> {
  const apiKey = AI_CONFIG.apiKey
  
  // Hugging Face has a free tier - just need to sign up for a token
  if (!apiKey || apiKey === 'none') {
    return { 
      success: false, 
      error: 'Hugging Face requires a free API token. Get one at https://huggingface.co/settings/tokens' 
    }
  }

  try {
    // Using Stable Diffusion XL on Hugging Face (free!)
    const model = AI_CONFIG.model || 'stabilityai/stable-diffusion-xl-base-1.0'
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            negative_prompt: 'blurry, low quality, distorted, amateur, cluttered background',
            num_inference_steps: 30,
            guidance_scale: 7.5
          }
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return { 
        success: false, 
        error: `Hugging Face error: ${error}` 
      }
    }

    const blob = await response.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        resolve({
          success: true,
          imageData: reader.result as string
        })
      }
      reader.onerror = () => {
        resolve({
          success: false,
          error: 'Failed to convert image'
        })
      }
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    return { 
      success: false, 
      error: `Hugging Face error: ${error instanceof Error ? error.message : 'Unknown error'}` 
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

// Analyze uploaded image to extract product name/label using OCR
export async function analyzeImageForProductName(imageDataUrl: string): Promise<string | null> {
  try {
    console.log('🔍 Analyzing uploaded image for product labels...')
    
    // Use Hugging Face's free image-to-text model (BLIP)
    const response = await fetch(
      'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: imageDataUrl.split(',')[1] // Send base64 without prefix
        })
      }
    )
    
    if (response.ok) {
      const result = await response.json()
      if (result && result[0]?.generated_text) {
        const caption = result[0].generated_text
        console.log('📝 Extracted from image:', caption)
        return caption
      }
    }
    
    // Fallback: Try OCR with a simple approach
    // This will be handled by Tesseract.js in the main.ts file
    return null
  } catch (error) {
    console.error('Error analyzing image:', error)
    return null
  }
}

// Main function to generate product image (enhanced with detailed label info)
export async function generateProductImage(
  itemName: string,
  category: string,
  userImageReference?: string,
  extractedName?: string,
  brandName?: string,
  allLabelText?: string[]
): Promise<ImageGenerationResult> {
  // Prefer extracted name (more accurate) over user input
  const accurateProductName = extractedName || itemName
  
  // Build enhanced prompt with emphasis on accurate labeling
  const enhancedPrompt = await enhancePromptWithSearch(accurateProductName, category, extractedName)
  
  if (extractedName) {
    console.log('🔍 Extracted product name from uploaded image:', extractedName)
    if (brandName) {
      console.log('🏷️  Brand identified:', brandName)
    }
    if (allLabelText && allLabelText.length > 0) {
      console.log('📝 All label text found:', allLabelText.join(', '))
    }
    console.log('🎨 Generating professional version WITH accurate branded label')
  }
  
  console.log('🖼️  Using detailed prompt with complete label information')
  console.log('🍌 Using service:', AI_CONFIG.service)
  console.log('   Available services: pollinations, huggingface, stability, replicate, dalle')
  
  // Validate service is set
  if (!AI_CONFIG.service) {
    console.error('❌ No AI service configured! Defaulting to pollinations...')
    return await generateWithPollinations(enhancedPrompt)
  }
  
  // Call appropriate AI service
  const service = AI_CONFIG.service.toLowerCase().trim()
  console.log('   Using service (normalized):', service)
  
  switch (service) {
    case 'pollinations':
      return await generateWithPollinations(enhancedPrompt)
    case 'huggingface':
      return await generateWithHuggingFace(enhancedPrompt)
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
      console.error(`❌ Unknown service: "${service}". Falling back to pollinations...`)
      return await generateWithPollinations(enhancedPrompt)
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

