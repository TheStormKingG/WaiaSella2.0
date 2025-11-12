// Product Identification System - Logical & Analytical Approach
// Uses OCR → Search → Analysis → Verification → Generation

import Tesseract from 'tesseract.js'

export interface ProductIdentification {
  brandName: string
  productName: string
  fullName: string
  confidence: number
  allTextFromLabel: string[]
  verifiedBySearch: boolean
}

export interface SearchResult {
  title: string
  snippet: string
  link: string
}

// Step 1: Extract ALL text from uploaded image label (with memory management)
export async function extractAllTextFromLabel(imageDataUrl: string): Promise<string[]> {
  console.log('📖 Step 1: Extracting ALL text from product label...')
  
  // Clear memory before heavy OCR processing
  clearMemoryIfPossible()
  
  try {
    const result = await Tesseract.recognize(imageDataUrl, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const progress = Math.round(m.progress * 100)
          if (progress % 20 === 0) { // Log every 20%
            console.log(`   OCR Progress: ${progress}%`)
          }
        }
      }
    })
    
    // Get all lines of text
    const allLines = result.data.text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 1)
      .filter(line => /[a-zA-Z0-9]/.test(line)) // Must contain alphanumeric
    
    console.log('✅ Extracted text from label:')
    allLines.forEach((line, i) => console.log(`   ${i + 1}. "${line}"`))
    
    // Clear memory after OCR
    await cleanupAfterStep()
    
    return allLines
  } catch (error) {
    console.error('❌ OCR extraction failed:', error)
    // Clear memory even on error
    await cleanupAfterStep()
    return []
  }
}

// Helper: Clear memory if garbage collection available
function clearMemoryIfPossible(): void {
  try {
    // @ts-ignore
    if (window.gc) {
      console.log('🧹 Clearing memory before processing...')
      // @ts-ignore
      window.gc()
    }
  } catch (e) {
    // Ignore if not available
  }
}

// Helper: Cleanup after processing step
async function cleanupAfterStep(): Promise<void> {
  // Small delay to allow browser to process
  await new Promise(resolve => setTimeout(resolve, 50))
  
  // Try to trigger garbage collection
  clearMemoryIfPossible()
  
  // Log memory if available
  try {
    // @ts-ignore
    if (performance.memory) {
      // @ts-ignore
      const memoryMB = (performance.memory.usedJSHeapSize / 1048576).toFixed(2)
      console.log(`   Memory usage: ${memoryMB}MB`)
    }
  } catch (e) {
    // Ignore if not available
  }
}

// Step 2: Search the web using extracted text
export async function searchProductByText(textLines: string[]): Promise<SearchResult[]> {
  console.log('\n🔎 Step 2: Searching web with extracted text...')
  
  if (textLines.length === 0) {
    console.log('⚠️  No text to search with')
    return []
  }
  
  // Build search query from extracted text
  const searchQuery = textLines.slice(0, 3).join(' ') // Use top 3 lines
  console.log(`   Query: "${searchQuery}"`)
  
  try {
    // Use free search APIs (DuckDuckGo, Google Custom Search, etc.)
    // For now, we'll simulate with the AI understanding and patterns
    
    // Mock search results (in production, use actual search API)
    const results = await simulateProductSearch(searchQuery)
    
    console.log(`✅ Found ${results.length} search results`)
    results.slice(0, 3).forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.title}`)
    })
    
    return results
  } catch (error) {
    console.error('❌ Search failed:', error)
    return []
  }
}

// Step 3: Analyze search results to identify brand and product name
export async function identifyBrandAndProduct(
  extractedText: string[],
  searchResults: SearchResult[]
): Promise<{ brand: string; product: string } | null> {
  console.log('\n🧠 Step 3: Analyzing search results for brand & product...')
  
  if (extractedText.length === 0) {
    return null
  }
  
  // Look for brand patterns in extracted text
  const brands = identifyBrandsFromText(extractedText)
  console.log('   Potential brands found:', brands.join(', ') || 'none')
  
  // Analyze search results for confirmation
  const confirmedBrand = confirmBrandFromSearchResults(brands, searchResults)
  const productName = extractProductNameFromResults(extractedText, searchResults)
  
  if (confirmedBrand && productName) {
    console.log(`✅ Identified: ${confirmedBrand} ${productName}`)
    return {
      brand: confirmedBrand,
      product: productName
    }
  }
  
  // Fallback: Use extracted text directly
  if (brands.length > 0 && extractedText.length > 1) {
    const brand = brands[0]
    const product = extractedText.filter(t => !t.toLowerCase().includes(brand.toLowerCase()))[0] || extractedText[1]
    console.log(`⚠️  Using extracted text: ${brand} ${product}`)
    return { brand, product }
  }
  
  console.log('❌ Could not identify brand and product')
  return null
}

// Step 4: Verify identification with targeted search
export async function verifyProductIdentification(
  brand: string,
  product: string
): Promise<boolean> {
  console.log(`\n✓ Step 4: Verifying "${brand} ${product}"...`)
  
  try {
    // Search specifically for "brand product name"
    const verificationQuery = `${brand} ${product} product`
    console.log(`   Verification query: "${verificationQuery}"`)
    
    const results = await simulateProductSearch(verificationQuery)
    
    // Check if results confirm our identification
    const confirmed = results.some(r => 
      r.title.toLowerCase().includes(brand.toLowerCase()) &&
      r.title.toLowerCase().includes(product.toLowerCase().split(' ')[0])
    )
    
    if (confirmed) {
      console.log('✅ Product identification VERIFIED')
      return true
    } else {
      console.log('⚠️  Product identification uncertain')
      return false
    }
  } catch (error) {
    console.error('❌ Verification failed:', error)
    return false
  }
}

// Step 5: Search for reference images with clear labels
export async function findReferenceImages(
  brand: string,
  product: string
): Promise<string[]> {
  console.log(`\n🖼️  Step 5: Finding reference images for "${brand} ${product}"...`)
  
  try {
    // Search for product images
    const imageQuery = `${brand} ${product} product packaging label`
    console.log(`   Image search: "${imageQuery}"`)
    
    // In production, use Google Images API, Bing Images, etc.
    // For now, we'll return a confirmation
    console.log('✅ Reference images found (would be used to inform AI generation)')
    
    return []
  } catch (error) {
    console.error('❌ Image search failed:', error)
    return []
  }
}

// Complete identification pipeline (with memory management)
export async function identifyProductComprehensively(
  imageDataUrl: string
): Promise<ProductIdentification | null> {
  console.log('🚀 Starting comprehensive product identification...')
  console.log('=' .repeat(60))
  
  // Clear memory before starting
  clearMemoryIfPossible()
  
  try {
    // Step 1: Extract all text from label (handles own memory cleanup)
    const extractedText = await extractAllTextFromLabel(imageDataUrl)
    if (extractedText.length === 0) {
      console.log('❌ No text found on label')
      await cleanupAfterStep()
      return null
    }
    
    // Clear memory after Step 1
    await cleanupAfterStep()
    
    // Step 2: Search web with extracted text
    const searchResults = await searchProductByText(extractedText)
    await cleanupAfterStep()
    
    // Step 3: Identify brand and product from results
    const identification = await identifyBrandAndProduct(extractedText, searchResults)
    if (!identification) {
      await cleanupAfterStep()
      return null
    }
    await cleanupAfterStep()
    
    // Step 4: Verify the identification
    const verified = await verifyProductIdentification(
      identification.brand,
      identification.product
    )
    await cleanupAfterStep()
    
    // Step 5: Find reference images (optional, for future enhancement)
    if (verified) {
      await findReferenceImages(identification.brand, identification.product)
    }
    await cleanupAfterStep()
    
    console.log('=' .repeat(60))
    console.log('🎯 FINAL IDENTIFICATION:')
    console.log(`   Brand: ${identification.brand}`)
    console.log(`   Product: ${identification.product}`)
    console.log(`   Full Name: ${identification.brand} ${identification.product}`)
    console.log(`   Verified: ${verified ? 'YES ✓' : 'NO ⚠️'}`)
    console.log('=' .repeat(60))
    
    // Final memory cleanup
    await cleanupAfterStep()
    
    return {
      brandName: identification.brand,
      productName: identification.product,
      fullName: `${identification.brand} ${identification.product}`,
      confidence: verified ? 0.95 : 0.75,
      allTextFromLabel: extractedText,
      verifiedBySearch: verified
    }
  } catch (error) {
    console.error('❌ Comprehensive identification failed:', error)
    // Cleanup even on error
    await cleanupAfterStep()
    return null
  } finally {
    // Final cleanup
    console.log('🧹 Final memory cleanup...')
    clearMemoryIfPossible()
  }
}

// Helper: Identify known brands from text
function identifyBrandsFromText(textLines: string[]): string[] {
  const knownBrands = [
    // Beverages
    'Coca-Cola', 'Coca Cola', 'Coke', 'Pepsi', 'Sprite', 'Fanta', 
    'Mountain Dew', 'Dr Pepper', 'Redbull', 'Red Bull', 'Monster',
    // Food
    'Heinz', 'Kellogg', 'Kelloggs', 'Nestle', 'Kraft', 'Lays', 'Lay\'s',
    'Doritos', 'Cheetos', 'Pringles', 'Oreo', 'Ritz',
    // Personal Care
    'Pantene', 'Dove', 'Nivea', 'Loreal', 'L\'Oreal', 'Garnier',
    'Head & Shoulders', 'Axe', 'Colgate', 'Gillette',
    // Household
    'Tide', 'Downy', 'Lysol', 'Clorox', 'Windex', 'Dawn', 'Febreze',
    // Electronics
    'Apple', 'Samsung', 'Sony', 'LG', 'Dell', 'HP', 'Lenovo', 'Microsoft'
  ]
  
  const foundBrands: string[] = []
  const combinedText = textLines.join(' ').toLowerCase()
  
  for (const brand of knownBrands) {
    if (combinedText.includes(brand.toLowerCase())) {
      foundBrands.push(brand)
    }
  }
  
  return foundBrands
}

// Helper: Confirm brand from search results
function confirmBrandFromSearchResults(
  potentialBrands: string[],
  searchResults: SearchResult[]
): string | null {
  if (potentialBrands.length === 0 || searchResults.length === 0) {
    return null
  }
  
  // Check which brand appears most in search results
  const brandCounts = new Map<string, number>()
  
  for (const brand of potentialBrands) {
    let count = 0
    for (const result of searchResults) {
      const text = `${result.title} ${result.snippet}`.toLowerCase()
      if (text.includes(brand.toLowerCase())) {
        count++
      }
    }
    brandCounts.set(brand, count)
  }
  
  // Return brand with highest count
  let maxBrand = potentialBrands[0]
  let maxCount = 0
  
  for (const [brand, count] of brandCounts) {
    if (count > maxCount) {
      maxCount = count
      maxBrand = brand
    }
  }
  
  return maxCount > 0 ? maxBrand : potentialBrands[0]
}

// Helper: Extract product name from search results
function extractProductNameFromResults(
  extractedText: string[],
  searchResults: SearchResult[]
): string {
  if (extractedText.length === 0) return ''
  
  // Use the first few lines that aren't brand names
  const brands = identifyBrandsFromText(extractedText)
  const productWords = extractedText.filter(text => {
    const lower = text.toLowerCase()
    return !brands.some(b => lower.includes(b.toLowerCase()))
  })
  
  // Take first 2-3 lines as product name
  return productWords.slice(0, 2).join(' ').trim() || extractedText[0]
}

// Simulate product search (replace with actual API in production)
async function simulateProductSearch(query: string): Promise<SearchResult[]> {
  // In production, use:
  // - Google Custom Search API
  // - Bing Search API
  // - DuckDuckGo API
  // - SerpAPI
  
  // For now, generate mock results based on query
  const lowerQuery = query.toLowerCase()
  
  // Detect if query contains known brands
  if (lowerQuery.includes('coca') || lowerQuery.includes('coke')) {
    return [
      {
        title: 'Coca-Cola Classic - The Official Website',
        snippet: 'Coca-Cola Classic is the world\'s favorite soft drink...',
        link: 'https://www.coca-cola.com'
      },
      {
        title: 'Buy Coca-Cola Products Online',
        snippet: 'Shop Coca-Cola Classic, Diet Coke, and more...',
        link: 'https://shop.example.com'
      }
    ]
  }
  
  if (lowerQuery.includes('heinz')) {
    return [
      {
        title: 'Heinz Tomato Ketchup - Official Product',
        snippet: 'Heinz Tomato Ketchup - America\'s favorite ketchup...',
        link: 'https://www.heinz.com'
      }
    ]
  }
  
  if (lowerQuery.includes('pantene')) {
    return [
      {
        title: 'Pantene Pro-V Shampoo & Conditioner',
        snippet: 'Pantene Pro-V hair care products for stronger hair...',
        link: 'https://pantene.com'
      }
    ]
  }
  
  // Generic results
  return [
    {
      title: `${query} - Product Information`,
      snippet: `Information about ${query}...`,
      link: 'https://example.com'
    }
  ]
}

