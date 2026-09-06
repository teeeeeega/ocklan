import { createClient } from '@supabase/supabase-js'

const configuredUrl = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!configuredUrl || !publishableKey) {
  throw new Error('Configurazione Supabase mancante: verifica VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.')
}

const supabaseUrl = configuredUrl.replace(/\/rest\/v1\/?$/, '')

export const supabase = createClient(supabaseUrl, publishableKey)
