import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function response(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return response({ error: 'Metodo non consentito.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Configurazione server Supabase incompleta.')
    return response({ error: 'Servizio temporaneamente non disponibile.' }, 500)
  }

  // --- 1. JWT validation ---
  const authorization = request.headers.get('Authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return response({ error: 'Autenticazione richiesta.' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser(token)
  if (userError || !userData.user) return response({ error: 'Sessione non valida.' }, 401)

  // --- 2. Derive user_id from auth.uid() — never from the request body ---
  const userId = userData.user.id

  // --- 3. RPC: atomic data cleanup ---
  const { error: rpcError } = await userClient.rpc('delete_account_data', { p_user_id: userId })
  if (rpcError) {
    console.error('RPC delete_account_data fallita:', rpcError.message)
    return response({ error: 'Impossibile completare la cancellazione dei dati.' }, 500)
  }

  // --- 4. Auth delete (only after RPC success) ---
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
  if (deleteError) {
    console.error('auth.admin.deleteUser fallito:', deleteError.message)
    return response({ error: 'Impossibile eliminare l\'utente. Puoi riprovare.', retryable: true }, 500)
  }

  // --- 5. Success: auth user deleted → profiles cascade-deleted ---
  return response({ success: true }, 200)
})
