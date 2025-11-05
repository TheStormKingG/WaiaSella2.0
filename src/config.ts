// Supabase configuration
export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL || '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
}

export const NANO_BANANA_CONFIG = {
  apiUrl: import.meta.env.VITE_NANO_BANANA_API_URL || '',
  apiKey: import.meta.env.VITE_NANO_BANANA_API_KEY || '',
  modelId: import.meta.env.VITE_NANO_BANANA_MODEL_ID || '',
}

