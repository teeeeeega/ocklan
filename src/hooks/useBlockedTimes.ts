import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export type BlockedTime = {
  id: string
  starts_at: string
  ends_at: string
  reason: string | null
}

export function useBlockedTimes(enabled: boolean) {
  const { coachId } = useAuth()
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([])
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
      if (!coachId) {
        setBlockedTimes([])
        setLoading(false)
        return
      }
      const result = await supabase.from('blocked_times').select('id, starts_at, ends_at, reason').eq('coach_id', coachId).gte('ends_at', new Date().toISOString()).order('starts_at', { ascending: true })
      if (!active) return
      if (result.error) {
        setError('Non è stato possibile caricare i periodi non disponibili.')
        setBlockedTimes([])
      } else {
        setBlockedTimes((result.data ?? []) as BlockedTime[])
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [enabled, refreshToken, coachId])

  const create = (startsAt: string, endsAt: string, reason: string) =>
    coachId
      ? supabase.from('blocked_times').insert({ coach_id: coachId, starts_at: startsAt, ends_at: endsAt, reason: reason.trim() || null })
      : Promise.resolve({ data: null, error: new Error('Coach non disponibile.') })

  const remove = (id: string) => coachId
    ? supabase.from('blocked_times').delete().eq('id', id).eq('coach_id', coachId)
    : Promise.resolve({ data: null, error: new Error('Coach non disponibile.') })

  return { blockedTimes, loading, error, create, remove, refresh: () => setRefreshToken((value) => value + 1) }
}
