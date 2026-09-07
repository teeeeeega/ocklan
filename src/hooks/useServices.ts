import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export type ServiceRecord = {
  id: string
  coach_id: string | null
  name: string
  description: string
  price_cents: number
  billing_type: string
  duration_minutes: number
  sessions_count: number | null
  pathway_days: number | null
  requires_intro_call: boolean
  appointment_type: string | null
  is_active: boolean
  created_at: string
}

const SERVICE_COLUMNS = 'id, coach_id, name, description, price_cents, billing_type, duration_minutes, sessions_count, pathway_days, requires_intro_call, appointment_type, is_active, created_at'

export function useServices(enabled: boolean, activeOnly = false, coachScoped = false, filterCoachId?: string | null) {
  const { coachId } = useAuth()
  const [services, setServices] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let active = true
    if (!enabled) {
      setLoading(false)
      setServices([])
      setError(null)
      return () => { active = false }
    }
    if (coachScoped && !coachId) {
      setLoading(false)
      setServices([])
      setError(null)
      return () => { active = false }
    }
    const load = async () => {
      setLoading(true)
      let query = supabase.from('services').select(SERVICE_COLUMNS)
      const effectiveCoachId = filterCoachId ?? (coachScoped ? coachId : null)
      if (effectiveCoachId) query = query.eq('coach_id', effectiveCoachId)
      if (activeOnly) query = query.eq('is_active', true)
      const result = await query.order('created_at', { ascending: false })
      if (!active) return
      if (result.error) {
        setError('Non è stato possibile caricare i servizi.')
        setServices([])
      } else {
        setError(null)
        const rows = (result.data ?? []) as ServiceRecord[]
        setServices(effectiveCoachId ? rows.filter((row) => row.coach_id === effectiveCoachId) : rows)
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [activeOnly, coachId, coachScoped, enabled, filterCoachId, refreshToken])

  return { services, loading, error, refresh: () => setRefreshToken((value) => value + 1) }
}
