// Image Analysis Module - Extract product names and text from images
import Tesseract from 'tesseract.js'

export interface ImageAnalysisResult {
  extractedText: string
  productName: string | null
  confidence: number
}

// Analyze image using OCR to extract text/labels
export async function analyzeImageWithOCR(imageDataUrl: string): Promise<ImageAnalysisResult> {
  try {
    console.log('🔍 Starting OCR analysis...')
    
    const result = await Tesseract.recognize(imageDataUrl, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`)
        }
      }
    })
    
    const extractedText = result.data.text.trim()
    console.log('📝 Extracted text:', extractedText)
    
    // Try to identify the product name from extracted text
    const productName = extractProductName(extractedText)
    
    return {
      extractedText,
      productName,
      confidence: result.data.confidence
    }
  } catch (error) {
    console.error('OCR error:', error)
    return {
      extractedText: '',
      productName: null,
      confidence: 0
    }
  }
}

// Use free Hugging Face model for image captioning
export async function analyzeImageWithAI(imageDataUrl: string): Promise<string | null> {
  try {
    console.log('🤖 Analyzing image with AI...')
    
    // Remove data URL prefix to get base64
    const base64Data = imageDataUrl.split(',')[1]
    
    // Convert base64 to blob for API
    const response = await fetch(
      'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large',
      {
        method: 'POST',
        body: base64Data,
      }
    )
    
    if (!response.ok) {
      console.log('AI analysis unavailable, will use OCR fallback')
      return null
    }
    
    const result = await response.json()
    if (result && result[0]?.generated_text) {
      const caption = result[0].generated_text
      console.log('🎯 AI identified:', caption)
      return caption
    }
    
    return null
  } catch (error) {
    console.error('AI analysis error:', error)
    return null
  }
}

// Combined analysis: Try AI first, fallback to OCR
export async function analyzeProductImage(imageDataUrl: string): Promise<string | null> {
  // Try AI captioning first (faster, better for products)
  const aiResult = await analyzeImageWithAI(imageDataUrl)
  if (aiResult) {
    return aiResult
  }
  
  // Fallback to OCR for text extraction
  console.log('📖 Falling back to OCR...')
  const ocrResult = await analyzeImageWithOCR(imageDataUrl)
  
  if (ocrResult.productName && ocrResult.confidence > 60) {
    return ocrResult.productName
  }
  
  // Return extracted text if no product name found
  if (ocrResult.extractedText && ocrResult.extractedText.length > 2) {
    return ocrResult.extractedText
  }
  
  return null
}

// Extract likely product name from OCR text
function extractProductName(text: string): string | null {
  if (!text || text.length < 2) return null
  
  // Clean up the text
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  if (lines.length === 0) return null
  
  // Heuristics to find product name:
  // 1. Usually the largest/most prominent text
  // 2. Often at the top or center
  // 3. Typically the longest single word or short phrase
  
  // Find the longest reasonable line (not too long, not too short)
  const candidates = lines
    .filter(line => line.length >= 3 && line.length <= 50)
    .filter(line => /^[a-zA-Z0-9\s\-'&.]+$/.test(line)) // Only alphanumeric and common punctuation
  
  if (candidates.length === 0) return null
  
  // Sort by length and pick the longest (likely the product name)
  candidates.sort((a, b) => b.length - a.length)
  
  // Return the most likely product name
  return candidates[0] || null
}

// Helper: Suggest product name based on analysis
export function suggestProductName(
  userEnteredName: string,
  extractedName: string | null
): string {
  if (!extractedName) return userEnteredName
  if (!userEnteredName) return extractedName
  
  // If user entered a generic name and we extracted something specific, prefer extracted
  const genericNames = ['product', 'item', 'test', 'new', 'untitled']
  if (genericNames.some(g => userEnteredName.toLowerCase().includes(g))) {
    return extractedName
  }
  
  // Otherwise keep user's name
  return userEnteredName
}

// Helper: Combine names for better AI prompt
export function combineProductNames(
  userEnteredName: string,
  extractedName: string | null
): string {
  if (!extractedName) return userEnteredName
  if (!userEnteredName) return extractedName
  
  // If names are similar, just use one
  const similarity = calculateSimilarity(
    userEnteredName.toLowerCase(),
    extractedName.toLowerCase()
  )
  
  if (similarity > 0.7) {
    return userEnteredName // They're similar, use user's version
  }
  
  // Combine them for better AI understanding
  return `${userEnteredName} (${extractedName})`
}

// Calculate string similarity (0 to 1)
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

// Levenshtein distance algorithm
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

