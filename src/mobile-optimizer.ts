// Mobile Optimization - Detect device and adjust processing

export function isMobileDevice(): boolean {
  // Check if running on mobile device
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

export function isLowMemoryDevice(): boolean {
  // Check if device has limited memory
  // @ts-ignore - navigator.deviceMemory is experimental
  const deviceMemory = navigator.deviceMemory
  
  if (deviceMemory && deviceMemory < 4) {
    console.log(`⚠️  Low memory device detected: ${deviceMemory}GB RAM`)
    return true
  }
  
  // Fallback: assume mobile devices might have low memory
  if (isMobileDevice()) {
    console.log('📱 Mobile device detected - using lightweight processing')
    return true
  }
  
  return false
}

export function shouldUseLightweightProcessing(): boolean {
  const useLightweight = isLowMemoryDevice()
  
  if (useLightweight) {
    console.log('🔋 Using lightweight processing mode for mobile/low-memory devices')
  } else {
    console.log('💪 Using full processing mode for desktop')
  }
  
  return useLightweight
}

// Lightweight product name extraction (no OCR, just AI)
export async function extractProductNameLightweight(imageDataUrl: string): Promise<string | null> {
  console.log('🔋 Lightweight extraction (skipping OCR to save memory)...')
  
  try {
    // Use only AI image understanding (much lighter than OCR)
    const response = await fetch(
      'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large',
      {
        method: 'POST',
        body: await fetch(imageDataUrl).then(r => r.blob())
      }
    )
    
    if (response.ok) {
      const result = await response.json()
      if (result && result[0]?.generated_text) {
        const productName = result[0].generated_text
        console.log('✅ Product identified:', productName)
        return productName
      }
    }
  } catch (error) {
    console.error('❌ Lightweight extraction failed:', error)
  }
  
  return null
}

