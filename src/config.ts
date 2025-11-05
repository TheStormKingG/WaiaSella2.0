// Supabase configuration
export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL || '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
}

// Nano Banana image enhancement configuration
export const NANO_BANANA_CONFIG = {
  apiUrl: import.meta.env.VITE_NANO_BANANA_API_URL || 'https://api.nanobanana.ai/v1',
  apiKey: import.meta.env.VITE_NANO_BANANA_API_KEY || '',
  model: import.meta.env.VITE_NANO_BANANA_MODEL || 'product-cleanup',
}

