import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type CreateClientPayload = {
  email?: unknown
  full_name?: unknown
}

function response(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
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

  const authorization = request.headers.get('Authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return response({ error: 'Autenticazione richiesta.' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser(token)
  if (userError || !userData.user) return response({ error: 'Sessione non valida.' }, 401)

  const { data: coachProfile, error: coachError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (coachError) {
    console.error('Errore nel controllo del ruolo coach:', coachError.message)
    return response({ error: 'Impossibile verificare i permessi.' }, 500)
  }

  if (coachProfile.role !== 'COACH') {
    return response({ error: 'Accesso non autorizzato.' }, 403)
  }

  let payload: CreateClientPayload
  try {
    payload = await request.json() as CreateClientPayload
  } catch {
    return response({ error: 'Il corpo della richiesta non è valido.' }, 400)
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  const fullName = typeof payload.full_name === 'string' ? payload.full_name.trim() : ''

  if (!isValidEmail(email)) return response({ error: 'Inserisci un indirizzo email valido.' }, 400)
  if (fullName.length < 2 || fullName.length > 120) return response({ error: 'Inserisci un nome valido.' }, 400)

  const { data: invitedUser, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  })

  if (inviteError) {
    if (inviteError.message.toLowerCase().includes('already') || inviteError.status === 422) {
      return response({ error: 'Esiste già un account con questa email.' }, 409)
    }
    console.error('Errore nella creazione dell account cliente:', inviteError.message)
    return response({ error: 'Impossibile creare il cliente.' }, 500)
  }

  if (!invitedUser.user) return response({ error: 'Impossibile creare il cliente.' }, 500)

  const { data: clientProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, full_name, role, avatar_url, created_at')
    .eq('id', invitedUser.user.id)
    .single()

  if (profileError || !clientProfile || clientProfile.role !== 'CLIENT') {
    console.error('Profilo cliente non creato correttamente.')
    const { error: rollbackError } = await adminClient.auth.admin.deleteUser(invitedUser.user.id)
    if (rollbackError) console.error('Rollback utente fallito:', rollbackError.message)
    return response({ error: 'Impossibile completare la creazione del profilo.' }, 500)
  }

  return response({ client: clientProfile }, 201)
})
