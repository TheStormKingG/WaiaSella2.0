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

// Enhanced product search using image
export async function searchProductByImage(imageDataUrl: string): Promise<ProductSearchResult | null> {
  try {
    console.log('🔎 Searching for similar product images online...')
    
    // Use Google Lens-style reverse image search via SerpAPI (free tier) or similar
    // For now, we'll use the AI caption as a search query
    const aiCaption = await analyzeImageWithAI(imageDataUrl)
    if (!aiCaption) {
      return null
    }
    
    // Search for product information
    // This would ideally use Google Custom Search API or similar
    // For now, we'll enhance with the caption
    return {
      brandName: extractBrandName(aiCaption),
      productName: aiCaption,
      fullDescription: aiCaption,
      confidence: 0.8
    }
  } catch (error) {
    console.error('Product search error:', error)
    return null
  }
}

export interface ProductSearchResult {
  brandName: string | null
  productName: string
  fullDescription: string
  confidence: number
}

// Extract brand name from text
function extractBrandName(text: string): string | null {
  // Common brand patterns
  const brandPatterns = [
    // Coca-Cola, Pepsi, etc.
    /\b(coca[\s-]?cola|pepsi|sprite|fanta|mountain dew|dr\.?\s*pepper)\b/i,
    // Food brands
    /\b(heinz|kellogg'?s|nestle|kraft|lay'?s|doritos|cheetos|pringles)\b/i,
    // Beauty/Personal care
    /\b(pantene|dove|nivea|l'oreal|garnier|head & shoulders|axe)\b/i,
    // Household
    /\b(tide|downy|lysol|clorox|windex|dawn)\b/i,
    // Electronics
    /\b(apple|samsung|sony|lg|dell|hp|lenovo)\b/i,
  ]
  
  for (const pattern of brandPatterns) {
    const match = text.match(pattern)
    if (match) {
      return match[1]
    }
  }
  
  return null
}

// Enhanced combined analysis: OCR all text + AI + search
export async function analyzeProductImage(imageDataUrl: string): Promise<string | null> {
  console.log('🔍 Starting comprehensive product analysis...')
  
  // Step 1: Get ALL text from label using OCR
  console.log('📖 Extracting all text from label...')
  const ocrResult = await analyzeImageWithOCR(imageDataUrl)
  console.log('📝 All text found on label:', ocrResult.extractedText)
  
  // Step 2: Get AI understanding of the product
  console.log('🤖 Getting AI product identification...')
  const aiResult = await analyzeImageWithAI(imageDataUrl)
  console.log('🎯 AI identified product as:', aiResult)
  
  // Step 3: Search for similar products online
  console.log('🔎 Searching for similar products...')
  const searchResult = await searchProductByImage(imageDataUrl)
  
  // Step 4: Combine all information for best result
  const combinedInfo = combineProductInformation(
    ocrResult.extractedText,
    aiResult,
    searchResult
  )
  
  console.log('✅ Final product identification:', combinedInfo)
  return combinedInfo
}

// Combine OCR, AI, and search results for best product name
function combineProductInformation(
  ocrText: string,
  aiCaption: string | null,
  searchResult: ProductSearchResult | null
): string {
  // Priority: Search result > AI caption > OCR text
  
  if (searchResult && searchResult.confidence > 0.7) {
    // Use search result with brand + product name
    if (searchResult.brandName) {
      return `${searchResult.brandName} ${searchResult.productName}`.trim()
    }
    return searchResult.fullDescription
  }
  
  if (aiCaption) {
    // Enhance AI caption with OCR brand names if found
    const brandFromOCR = extractBrandName(ocrText)
    if (brandFromOCR && !aiCaption.toLowerCase().includes(brandFromOCR.toLowerCase())) {
      return `${brandFromOCR} ${aiCaption}`.trim()
    }
    return aiCaption
  }
  
  // Fallback to OCR text
  if (ocrText && ocrText.length > 2) {
    return ocrText.split('\n')[0] // Use first line as product name
  }
  
  return ''
}

// Extract likely product name from OCR text (enhanced)
function extractProductName(text: string): string | null {
  if (!text || text.length < 2) return null
  
  // Clean up the text
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  if (lines.length === 0) return null
  
  // Step 1: Look for brand names in the text
  const brandName = extractBrandName(text)
  
  // Step 2: Find the longest reasonable line (likely product name)
  const candidates = lines
    .filter(line => line.length >= 3 && line.length <= 50)
    .filter(line => /^[a-zA-Z0-9\s\-'&.]+$/.test(line)) // Only alphanumeric and common punctuation
  
  if (candidates.length === 0) return null
  
  // Sort by length and pick the longest (likely the product name)
  candidates.sort((a, b) => b.length - a.length)
  
  const productNameCandidate = candidates[0]
  
  // Step 3: Combine brand + product if both found
  if (brandName && productNameCandidate && !productNameCandidate.toLowerCase().includes(brandName.toLowerCase())) {
    return `${brandName} ${productNameCandidate}`.trim()
  }
  
  // Return the best candidate
  return productNameCandidate || null
}

// Get all text from label (comprehensive extraction)
export function getAllLabelText(text: string): string[] {
  if (!text) return []
  
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => /^[a-zA-Z0-9\s\-'&.,!]+$/.test(line)) // Valid text
}

// Parse label information into structured data
export interface LabelInformation {
  brandName: string | null
  productName: string | null
  allText: string[]
  rawText: string
}

export function parseLabelInformation(ocrText: string, aiCaption?: string | null): LabelInformation {
  const allText = getAllLabelText(ocrText)
  const brandName = extractBrandName(ocrText)
  let productName = extractProductName(ocrText)
  
  // Enhance with AI caption if available
  if (aiCaption && !productName) {
    productName = aiCaption
  } else if (aiCaption && brandName && !aiCaption.toLowerCase().includes(brandName.toLowerCase())) {
    productName = `${brandName} ${aiCaption}`.trim()
  } else if (aiCaption) {
    productName = aiCaption
  }
  
  return {
    brandName,
    productName,
    allText,
    rawText: ocrText
  }
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

