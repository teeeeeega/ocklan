import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type ClientProgram = {
  id: string
  title: string
  status: string
  starts_at: string | null
  ends_at: string | null
  goal: string | null
  service: { name: string } | null
}

export type ClientAppointment = {
  id: string
  starts_at: string
  ends_at: string
  status: string
  payment_method: string
  location: string | null
  meeting_url: string | null
  notes: string | null
  service: { name: string } | null
}

export type ClientPackage = {
  id: string
  total_sessions: number
  used_sessions: number
  purchased_at: string
  starts_at: string | null
  expires_at: string | null
  status: string
  service: { name: string } | null
}

type ClientAreaData = {
  program: ClientProgram | null
  programs: ClientProgram[]
  appointments: ClientAppointment[]
  packages: ClientPackage[]
  loading: boolean
  error: string | null
  refresh: () => void
}

function formatQueryError(error: { message: string }) {
  return `Non è stato possibile caricare i dati dell'area clienti: ${error.message}`
}

export function useClientAreaData(clientId: string | undefined): ClientAreaData {
  const [data, setData] = useState<Omit<ClientAreaData, 'loading' | 'error' | 'refresh'>>({
    program: null,
    programs: [],
    appointments: [],
    packages: [],
  })
  const [loading, setLoading] = useState(Boolean(clientId))
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let active = true

    if (!clientId) {
      setData({ program: null, programs: [], appointments: [], packages: [] })
      setLoading(false)
      setError(null)
      return () => {
        active = false
      }
    }

    const load = async () => {
      setLoading(true)
      setError(null)

      const [programResult, appointmentsResult, packagesResult] = await Promise.all([
        supabase
          .from('client_programs')
          .select('id, title, status, starts_at, ends_at, goal, service:services(name)')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('appointments')
          .select('id, starts_at, ends_at, status, payment_method, location, meeting_url, notes, service:services(name)')
          .eq('client_id', clientId)
          .order('starts_at', { ascending: true }),
        supabase
          .from('packages')
          .select('id, total_sessions, used_sessions, purchased_at, starts_at, expires_at, status, service:services(name)')
          .eq('client_id', clientId)
          .order('purchased_at', { ascending: false }),
      ])

      if (!active) return

      const queryError = programResult.error || appointmentsResult.error || packagesResult.error
      if (queryError) {
        setError(formatQueryError(queryError))
        setData({ program: null, programs: [], appointments: [], packages: [] })
      } else {
        const programs = (programResult.data ?? []).map((item) => ({
          ...item,
          service: normalizeService(item.service),
        })) as ClientProgram[]
        setData({
          program: programs[0] ?? null,
          programs,
          appointments: (appointmentsResult.data ?? []).map((item) => ({
            ...item,
            service: normalizeService(item.service),
          })) as ClientAppointment[],
          packages: (packagesResult.data ?? []).map((item) => ({
            ...item,
            service: normalizeService(item.service),
          })) as ClientPackage[],
        })
      }
      setLoading(false)
    }

    function normalizeService(service: { name: string } | { name: string }[] | null) {
      return Array.isArray(service) ? service[0] ?? null : service
    }

    void load()

    return () => {
      active = false
    }
  }, [clientId, refreshToken])

  return { ...data, loading, error, refresh: () => setRefreshToken((value) => value + 1) }
}
