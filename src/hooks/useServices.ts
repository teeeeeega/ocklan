import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type ServiceRecord = {
  id: string
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

export function useServices(enabled: boolean, activeOnly = false) {
  const [services, setServices] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let active = true
    if (!enabled) return () => { active = false }
    const load = async () => {
      setLoading(true)
      let query = supabase.from('services').select('id, name, description, price_cents, billing_type, duration_minutes, sessions_count, pathway_days, requires_intro_call, appointment_type, is_active, created_at')
      if (activeOnly) query = query.eq('is_active', true)
      const result = await query.order('created_at', { ascending: false })
      if (!active) return
      if (result.error) setError('Non è stato possibile caricare i servizi.')
      else {
        setError(null)
        setServices(result.data ?? [])
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [activeOnly, enabled, refreshToken])

  return { services, loading, error, refresh: () => setRefreshToken((value) => value + 1) }
}
