import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export type CoachClient = {
  id: string
  full_name: string
  avatar_url: string | null
  created_at: string
  programCount: number
}

export type CoachProgram = {
  id: string
  client_id: string
  title: string
  status: string
  goal: string | null
  starts_at: string | null
  ends_at: string | null
  client: { full_name: string } | null
  service: { name: string } | null
}

type CoachDashboardData = {
  clients: CoachClient[]
  programs: CoachProgram[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useCoachDashboardData(enabled: boolean): CoachDashboardData {
  const { coachId } = useAuth()
  const [data, setData] = useState<Omit<CoachDashboardData, 'loading' | 'error' | 'refresh'>>({
    clients: [],
    programs: [],
  })
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let active = true
    if (!enabled) {
      setLoading(false)
      return () => {
        active = false
      }
    }

    const load = async () => {
      setLoading(true)
      setError(null)

      if (!coachId) {
        setData({ clients: [], programs: [] })
        setLoading(false)
        return
      }

      const { data: relationships, error: relError } = await supabase
        .from('coach_clients')
        .select('client_id')
        .eq('coach_id', coachId)
        .eq('status', 'ACTIVE')

      if (!active) return
      if (relError || !relationships?.length) {
        if (relError) setError(`Non è stato possibile caricare i dati del gestionale: ${relError.message}`)
        setData({ clients: [], programs: [] })
        setLoading(false)
        return
      }

      const clientIds = relationships.map((r) => r.client_id)

      const [clientsResult, programsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, created_at')
          .in('id', clientIds)
          .eq('role', 'CLIENT')
          .order('created_at', { ascending: false }),
        supabase
          .from('client_programs')
          .select('id, client_id, title, status, goal, starts_at, ends_at, client:profiles!client_programs_client_id_fkey(full_name), service:services(name)')
          .eq('coach_id', coachId)
          .order('starts_at', { ascending: true, nullsFirst: false }),
      ])

      if (!active) return
      const queryError = clientsResult.error || programsResult.error
      if (queryError) {
        setError(`Non è stato possibile caricare i dati del gestionale: ${queryError.message}`)
        setData({ clients: [], programs: [] })
      } else {
        const programs = (programsResult.data ?? []).map((program) => ({
          ...program,
          client: normalizeRelation(program.client),
          service: normalizeRelation(program.service),
        })) as CoachProgram[]
        const programCounts = programs.reduce<Record<string, number>>((counts, program) => {
          counts[program.client_id] = (counts[program.client_id] ?? 0) + 1
          return counts
        }, {})
        setData({
          clients: (clientsResult.data ?? []).map((client) => ({
            ...client,
            programCount: programCounts[client.id] ?? 0,
          })) as CoachClient[],
          programs,
        })
      }
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [enabled, refreshToken, coachId])

  return { ...data, loading, error, refresh: () => setRefreshToken((value) => value + 1) }
}

function normalizeRelation<T>(relation: T | T[] | null) {
  return Array.isArray(relation) ? relation[0] ?? null : relation
}
