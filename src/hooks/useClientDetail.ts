import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type ClientDetailProfile = {
  id: string
  full_name: string
  avatar_url: string | null
  created_at: string
  role: 'CLIENT'
}

export type ClientDetailProgram = {
  id: string
  title: string
  status: string
  goal: string | null
  starts_at: string | null
  ends_at: string | null
  service: { name: string } | null
}

export type ClientDetailAppointment = {
  id: string
  service_id: string | null
  starts_at: string
  ends_at: string
  status: 'PENDING' | 'BOOKED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED'
  location: string | null
  meeting_url: string | null
  notes: string | null
  payment_method: string
  service: { name: string } | null
}

export type ClientDetailPackage = {
  id: string
  client_id: string
  service_id: string | null
  total_sessions: number
  used_sessions: number
  purchased_at: string
  starts_at: string | null
  expires_at: string | null
  status: string
  service: { name: string } | null
}

export type ClientNote = {
  id: string
  body: string
  created_at: string
}

type ClientDetailData = {
  profile: ClientDetailProfile | null
  programs: ClientDetailProgram[]
  appointments: ClientDetailAppointment[]
  packages: ClientDetailPackage[]
  notes: ClientNote[]
  loading: boolean
  error: string | null
  refresh: () => void
  updateProfile: (values: { full_name: string; avatar_url: string | null }) => Promise<string | null>
}

export function useClientDetail(clientId: string | undefined, enabled: boolean): ClientDetailData {
  const [data, setData] = useState<Omit<ClientDetailData, 'loading' | 'error' | 'refresh' | 'updateProfile'>>({
    profile: null,
    programs: [],
    appointments: [],
    packages: [],
    notes: [],
  })
  const [loading, setLoading] = useState(enabled && Boolean(clientId))
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [profileSaving, setProfileSaving] = useState(false)

  useEffect(() => {
    let active = true
    if (!enabled || !clientId) {
      setLoading(false)
      return () => {
        active = false
      }
    }

    const load = async () => {
      setLoading(true)
      setError(null)
      const [profileResult, programsResult, appointmentsResult, packagesResult, notesResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url, created_at, role').eq('id', clientId).eq('role', 'CLIENT').maybeSingle(),
        supabase.from('client_programs').select('id, title, status, goal, starts_at, ends_at, service:services(name)').eq('client_id', clientId).order('status', { ascending: true }).order('created_at', { ascending: false }),
        supabase.from('appointments').select('id, service_id, starts_at, ends_at, status, payment_method, meeting_url, location, notes, service:services(name)').eq('client_id', clientId).order('starts_at', { ascending: true }),
        supabase.from('packages').select('id, client_id, service_id, total_sessions, used_sessions, purchased_at, starts_at, expires_at, status, service:services(name)').eq('client_id', clientId).order('purchased_at', { ascending: false }),
        supabase.from('coach_notes').select('id, body, created_at').eq('client_id', clientId).order('created_at', { ascending: false }),
      ])

      if (!active) return
      const queryError = profileResult.error || programsResult.error || appointmentsResult.error || packagesResult.error || notesResult.error
      if (queryError) {
        setError(`Non è stato possibile caricare la scheda cliente: ${queryError.message}`)
        setData({ profile: null, programs: [], appointments: [], packages: [], notes: [] })
      } else {
        setData({
          profile: profileResult.data as ClientDetailProfile | null,
          programs: normalizeRows(programsResult.data ?? []) as ClientDetailProgram[],
          appointments: normalizeRows(appointmentsResult.data ?? []) as ClientDetailAppointment[],
          packages: normalizeRows(packagesResult.data ?? []) as ClientDetailPackage[],
          notes: notesResult.data ?? [],
        })
      }
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [clientId, enabled, refreshToken])

  const updateProfile = async (values: { full_name: string; avatar_url: string | null }) => {
    if (!clientId || profileSaving) return 'Cliente non disponibile.'
    if (!values.full_name.trim()) return 'Il nome è obbligatorio.'
    setProfileSaving(true)
    const result = await supabase.from('profiles').update({
      full_name: values.full_name.trim(),
      avatar_url: values.avatar_url?.trim() || null,
    }).eq('id', clientId).eq('role', 'CLIENT')
    setProfileSaving(false)
    if (result.error) return 'Non è stato possibile salvare i dati anagrafici.'
    setData((current) => current.profile ? {
      ...current,
      profile: { ...current.profile, full_name: values.full_name.trim(), avatar_url: values.avatar_url?.trim() || null },
    } : current)
    return null
  }

  return { ...data, loading, error, refresh: () => setRefreshToken((value) => value + 1), updateProfile }
}

function normalizeRows<T extends { service: unknown }>(rows: T[]) {
  return rows.map((row) => ({
    ...row,
    service: Array.isArray(row.service) ? row.service[0] ?? null : row.service,
  }))
}
