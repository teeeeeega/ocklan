import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type ContactRequest = {
  id: string
  name: string
  email: string
  message: string
  created_at: string
}

export function useContactRequests(enabled: boolean) {
  const [requests, setRequests] = useState<ContactRequest[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!enabled) {
      setRequests([])
      setLoading(false)
      return () => { active = false }
    }
    const load = async () => {
      setLoading(true)
      const result = await supabase.from('contact_requests').select('id, name, email, message, created_at').order('created_at', { ascending: false })
      if (!active) return
      if (result.error) {
        setError('Non è stato possibile caricare le richieste di contatto.')
        setRequests([])
      } else {
        setError(null)
        setRequests(result.data ?? [])
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [enabled])

  return { requests, loading, error }
}
