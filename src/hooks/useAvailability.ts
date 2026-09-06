import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type AvailableSlot = {
  starts_at: string
  ends_at: string
}

export function useAvailability(serviceId: string, date: string) {
  const [slots, setSlots] = useState<AvailableSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let active = true
    if (!serviceId || !date) {
      setSlots([])
      setLoading(false)
      setError(null)
      return () => { active = false }
    }
    const load = async () => {
      setLoading(true)
      setError(null)
      const result = await supabase.rpc('get_available_slots', {
        p_service_id: serviceId,
        p_date: date,
      })
      if (!active) return
      if (result.error) {
        setSlots([])
        setError('Non è stato possibile caricare gli orari disponibili.')
      } else {
        setSlots((result.data ?? []) as AvailableSlot[])
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [date, refreshToken, serviceId])

  return { slots, loading, error, refresh: () => setRefreshToken((value) => value + 1) }
}
