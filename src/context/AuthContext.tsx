import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type UserRole = 'CLIENT' | 'COACH'

export type Profile = {
  id: string
  full_name: string
  role: UserRole
  avatar_url: string | null
  created_at: string
}

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  coachId: string | null
  loading: boolean
  profileError: string | null
  authError: string | null
  login: (email: string, password: string) => Promise<{ error: AuthError | null }>
  register: (fullName: string, email: string, password: string, intent?: { role: 'COACH' } | { role: 'CLIENT'; coachSlug?: string }) => Promise<{ error: AuthError | null; needsConfirmation: boolean }>
  updateProfile: (values: { full_name: string; avatar_url: string | null }) => Promise<{ error: Error | null }>
  deleteAccount: () => Promise<{ error: Error | null }>
  logout: () => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readableError(error: unknown) {
  return error instanceof Error ? error.message : 'Impossibile recuperare il profilo.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  const loadProfile = async (user: User | null) => {
    if (!user) {
      setProfile(null)
      setProfileError(null)
      return
    }

    const { data, error } = await supabase.from('profiles').select('id, full_name, role, avatar_url, created_at').eq('id', user.id).single()
    if (error) {
      setProfile(null)
      setProfileError(readableError(error))
      return
    }

    setProfile(data as Profile)
    setProfileError(null)
  }

  useEffect(() => {
    let mounted = true

    const applySession = async (nextSession: Session | null) => {
      setSession(nextSession)
      await loadProfile(nextSession?.user ?? null)
      if (mounted) setLoading(false)
    }

    // onAuthStateChange fires immediately with INITIAL_SESSION, so it covers
    // both the first load and every subsequent auth change. `loading` stays
    // true until session AND profile are resolved.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      void applySession(nextSession)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    coachId: profile?.role === 'COACH' ? profile.id : null,
    loading,
    profileError,
    authError,
    login: async (email, password) => {
      setAuthError(null)
      const result = await supabase.auth.signInWithPassword({ email, password })
      if (result.error) setAuthError(result.error.message)
      return { error: result.error }
    },
    register: async (fullName, email, password, intent) => {
      setAuthError(null)
      const data: Record<string, string> = { full_name: fullName.trim() }
      // The DB trigger (handle_new_user) is the source of truth for the role;
      // it only honors a strict whitelist and validates the coach slug server-side.
      if (intent?.role === 'COACH') data.requested_role = 'coach'
      else {
        data.requested_role = 'client'
        if (intent && 'coachSlug' in intent && intent.coachSlug) data.coach_slug = intent.coachSlug
      }
      const result = await supabase.auth.signUp({ email, password, options: { data, emailRedirectTo: window.location.origin } })
      if (result.error) setAuthError(result.error.message)
      return { error: result.error, needsConfirmation: !result.error && !result.data.session }
    },
    updateProfile: async (values) => {
      if (!session?.user) return { error: new Error('Sessione non disponibile.') }
      const fullName = values.full_name.trim()
      if (!fullName) return { error: new Error('Il nome è obbligatorio.') }
      const result = await supabase.from('profiles').update({
        full_name: fullName,
        avatar_url: values.avatar_url?.trim() || null,
      }).eq('id', session.user.id)
      if (result.error) return { error: result.error }
      setProfile((current) => current ? { ...current, full_name: fullName, avatar_url: values.avatar_url?.trim() || null } : current)
      return { error: null }
    },
    deleteAccount: async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      const token = currentSession?.access_token
      if (!token) return { error: new Error('Sessione non disponibile.') }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '')
      if (!supabaseUrl) return { error: new Error('Configurazione Supabase mancante.') }

      const response = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '' },
      })

      const body = await response.json().catch(() => null)
      if (!response.ok) {
        const message = body?.error ?? 'Impossibile eliminare l\'account.'
        return { error: new Error(message) }
      }

      return { error: null }
    },
    logout: async () => {
      const result = await supabase.auth.signOut()
      if (result.error) setAuthError(result.error.message)
      return { error: result.error }
    },
  }), [authError, loading, profile, profileError, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve essere usato dentro AuthProvider.')
  return context
}
