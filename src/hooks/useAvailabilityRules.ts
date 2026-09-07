import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export type AvailabilityRule = {
  id: string
  weekday: number
  starts_at: string
  ends_at: string
  slot_minutes: number
  is_active: boolean
}

export function useAvailabilityRules(enabled: boolean) {
  const { coachId } = useAuth()
  const [rules, setRules] = useState<AvailabilityRule[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let active = true
    if (!enabled) {
      setLoading(false)
      return () => { active = false }
    }
    const load = async () => {
      setLoading(true)
      setError(null)
      const query = supabase.from('availability_rules').select('id, weekday, starts_at, ends_at, slot_minutes, is_active').order('weekday', { ascending: true })
      const result = coachId ? await query.eq('coach_id', coachId) : await query
      if (!active) return
      if (result.error) {
        setError('Non è stato possibile caricare le disponibilità.')
        setRules([])
      } else {
        setRules((result.data ?? []) as AvailabilityRule[])
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [enabled, refreshToken])

  const save = async (rule: { id?: string; weekday: number; starts_at: string; ends_at: string; slot_minutes: number; is_active: boolean }) => {
    if (!coachId) return { data: null, error: new Error('Coach non disponibile.') }
    if (rule.id) {
      return supabase.from('availability_rules').update({
        starts_at: rule.starts_at,
        ends_at: rule.ends_at,
        slot_minutes: rule.slot_minutes,
        is_active: rule.is_active,
      }).eq('id', rule.id).eq('coach_id', coachId)
    }
    return supabase.from('availability_rules').insert({ ...rule, coach_id: coachId })
  }

  return { rules, loading, error, save, refresh: () => setRefreshToken((value) => value + 1) }
}
