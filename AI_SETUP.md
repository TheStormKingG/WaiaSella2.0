# AI Product Image Generation Setup

## Overview

WaiaSella POS now supports AI-generated product images! When adding or editing items, you can check the "🎨 Generate AI Product Image" option to automatically create professional product photos using AI.

## Features

- **Smart Prompt Building**: Uses item name, category, and optional user image reference
- **Category-Aware**: Adds contextual enhancements based on product category
- **Multiple AI Services**: Supports Google Gemini ("Nano Banana"), Stability AI, Replicate, DALL-E, and custom endpoints
- **Graceful Fallbacks**: If generation fails, you can continue with your current image
- **Loading States**: Visual feedback during generation process

## Recommended: Google Gemini 2.5 Flash Image 🍌

**"Nano Banana"** (Gemini 2.5 Flash Image) is the recommended service because it's:
- ⚡ **Fast**: ~2-5 seconds generation time
- 💰 **Affordable**: Much cheaper than competitors
- 🎨 **High Quality**: Excellent product photography results
- 🔓 **Easy Setup**: Free API key from Google AI Studio

## Setup Instructions

### 1. Choose Your AI Service

Edit `src/ai-config.ts` and configure your preferred service:

```typescript
export const AI_CONFIG: AIConfig = {
  service: 'gemini', // Recommended! Options: 'gemini', 'stability', 'replicate', 'dalle', or 'custom'
  apiKey: 'YOUR_API_KEY_HERE',
  model: 'gemini-2.0-flash-exp' // Gemini 2.5 Flash Image
}
```

### 2. Get an API Key

#### Google Gemini (Recommended - "Nano Banana")
1. Visit https://aistudio.google.com/apikey
2. Sign in with your Google account
3. Click "Create API key"
4. Copy the key and add to `ai-config.ts`

**Pricing**: 
- Free tier: Generous quota for testing
- Paid: Very affordable pricing (typically $0.001-0.002 per image)

**Model**: `gemini-2.0-flash-exp` (Gemini 2.5 Flash Image)

#### Stability AI
1. Visit https://platform.stability.ai/
2. Create an account
3. Generate an API key from your dashboard
4. Add to `ai-config.ts`

**Pricing**: Pay-as-you-go, ~$0.004 per image

#### Replicate
1. Visit https://replicate.com/
2. Create an account
3. Get API token from https://replicate.com/account/api-tokens
4. Add to `ai-config.ts`

**Pricing**: Pay-as-you-go, varies by model

#### OpenAI DALL-E
1. Visit https://platform.openai.com/
2. Create an account
3. Generate API key
4. Set `service: 'dalle'` in config

**Pricing**: $0.040 - $0.080 per image depending on quality

### 3. Environment Variables (Optional, Recommended)

For better security, use environment variables instead of hardcoding API keys:

Create a `.env.local` file:
```env
VITE_AI_SERVICE=gemini
VITE_AI_API_KEY=your_gemini_api_key_here
VITE_AI_MODEL=gemini-2.0-flash-exp
```

Then update `src/ai-config.ts`:
```typescript
export const AI_CONFIG: AIConfig = {
  service: (import.meta.env.VITE_AI_SERVICE || 'gemini') as any,
  apiKey: import.meta.env.VITE_AI_API_KEY || '',
  model: import.meta.env.VITE_AI_MODEL || 'gemini-2.0-flash-exp'
}
```

### 4. Test the Integration

1. Run the app: `npm run dev`
2. Navigate to Inventory
3. Click the + button to add a new item
4. Fill in the item details (Name, Category, etc.)
5. Check "🎨 Generate AI Product Image"
6. Click Save
7. Watch as AI generates a professional product image!

## How It Works

1. **Prompt Enhancement**: The system builds a detailed prompt using:
   - Item name
   - Category context
   - User-uploaded image (optional reference)

2. **AI Generation**: Sends the prompt to your configured AI service

3. **Image Processing**: Converts the result to base64 data URL for storage

4. **Automatic Update**: The generated image replaces the preview and is saved with the item

## Customization

### Modify Prompt Template

Edit the `buildProductImagePrompt` function in `src/ai-config.ts`:

```typescript
export function buildProductImagePrompt(
  itemName: string,
  category: string,
  userImageContext?: string
): string {
  return `Your custom prompt template here: ${itemName}...`
}
```

### Add Category Contexts

Edit the `contextEnhancements` object in `enhancePromptWithSearch`:

```typescript
const contextEnhancements: Record<string, string> = {
  'YourCategory': 'your custom context terms',
  // ...
}
```

### Use Custom AI Service

1. Set `service: 'custom'` in config
2. Add your endpoint: `endpoint: 'https://your-api.com/generate'`
3. Implement the API call in the `custom` case of `generateProductImage`

## Troubleshooting

### API Key Not Working
- Verify the key is correct and has sufficient credits
- Check if the key has the required permissions
- Ensure you're using the correct service type

### Generation Taking Too Long
- Different services have different response times
- **Gemini ("Nano Banana")**: ~2-5 seconds ⚡ (Fastest!)
- Stability AI: ~3-10 seconds
- Replicate: ~5-20 seconds (varies by model)
- DALL-E: ~10-30 seconds

### CORS Errors
- Some APIs require server-side proxying
- Consider using serverless functions (Vercel, Netlify) for production

### Image Not Appearing
- Check browser console for errors
- Verify the base64 data URL is valid
- Ensure the AI service returned a valid image

## Example Workflow

```
User Action:
├─ Opens Add Item modal
├─ Enters "Water Bottle" as name
├─ Selects "Drinks" category
├─ Checks "Generate AI Image"
└─ Clicks Save

System Response:
├─ Shows loading overlay
├─ Builds prompt: "Professional product photography of Water Bottle, 
│   Drinks category, beverage, refreshing, clear glass bottle or can..."
├─ Calls Stability AI API
├─ Receives generated image
├─ Converts to base64
├─ Updates preview
├─ Saves item with AI-generated image
└─ Closes modal
```

## Notes

- **First Time Setup**: Configuration must be completed before the feature works
- **No API Key**: If no key is configured, the system will show an error message but won't crash
- **Fallback**: You can always upload/capture images manually
- **Cost**: Monitor your API usage to control costs
- **Quality**: AI-generated images are 1024x1024px, optimized for product display

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify your API key and service configuration
3. Test with a simple item first (e.g., "Red Apple" in "Produce")
4. Review the API provider's documentation for specific service issues

## Why "Nano Banana"? 🍌

"Nano Banana" is the informal/nickname for **Google's Gemini 2.5 Flash Image model**. The community gave it this fun name, and it's become quite popular!

### Accessing Gemini Image Generation

You can access it through:
1. **Google AI Studio** (easiest - get free API key)
2. **Vertex AI** (enterprise Google Cloud integration)
3. **OpenAI-compatible endpoints** (via third-party wrappers)

This implementation uses the official Google Gemini API for the best performance and reliability.

## Service Comparison

| Service | Speed | Cost | Quality | Setup |
|---------|-------|------|---------|-------|
| **Gemini 2.5 Flash** 🍌 | ⚡⚡⚡ Very Fast | 💰 Very Cheap | ⭐⭐⭐⭐ Excellent | ✅ Easy |
| Stability AI | ⚡⚡ Fast | 💰💰 Moderate | ⭐⭐⭐⭐⭐ Top | ✅ Easy |
| Replicate | ⚡ Variable | 💰💰 Moderate | ⭐⭐⭐⭐ Good | ✅ Easy |
| DALL-E 3 | ⚡ Slower | 💰💰💰 Expensive | ⭐⭐⭐⭐⭐ Top | ✅ Easy |

**Recommendation**: Start with Gemini ("Nano Banana") for the best balance of speed, cost, and quality!

