import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AvailableSlot } from './useAvailability'

export function useBooking() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const book = async (serviceId: string, slot: AvailableSlot) => {
    if (loading) return false
    setLoading(true)
    setError(null)
    setSuccess(false)
    const [{ data: { user } }, { data: service }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('services').select('coach_id').eq('id', serviceId).maybeSingle(),
    ])
    console.debug('[booking] create_appointment request', {
      service_id: serviceId,
      coach_id: service?.coach_id ?? null,
      client_id: user?.id ?? null,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
    })
    const relationshipResult = await supabase.rpc('ensure_coach_client_relationship', {
      p_service_id: serviceId,
    })
    if (relationshipResult.error) {
      setLoading(false)
      console.error('[booking] ensure_coach_client_relationship failed', {
        service_id: serviceId,
        coach_id: service?.coach_id ?? null,
        client_id: user?.id ?? null,
        code: relationshipResult.error.code,
        message: relationshipResult.error.message,
        details: relationshipResult.error.details,
        hint: relationshipResult.error.hint,
      })
      const message = relationshipResult.error.message
      if (message.includes('AUTH_REQUIRED')) setError('Devi accedere per prenotare un appuntamento.')
      else if (message.includes('NOT_AUTHORIZED')) setError('Devi essere registrato come cliente per prenotare.')
      else if (message.includes('COACH_RELATION_NOT_ACTIVE')) setError('La tua relazione con questo coach non è attiva.')
      else if (message.includes('SERVICE_UNAVAILABLE')) setError('Questo servizio non è più disponibile.')
      else setError('Non è stato possibile verificare la relazione con il coach. Riprova.')
      return false
    }
    const result = await supabase.rpc('create_appointment', {
      p_service_id: serviceId,
      p_starts_at: slot.starts_at,
      p_ends_at: slot.ends_at,
    })
    setLoading(false)
    if (result.error) {
      console.error('[booking] create_appointment failed', {
        service_id: serviceId,
        coach_id: service?.coach_id ?? null,
        client_id: user?.id ?? null,
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
      })
      const message = result.error.message
      if (message.includes('SLOT_OCCUPIED')) setError('Questo orario è stato appena prenotato. Scegli un altro slot.')
      else if (message.includes('AUTH_REQUIRED')) setError('Devi accedere per prenotare un appuntamento.')
      else if (message.includes('SERVICE_UNAVAILABLE')) setError('Questo servizio non è più disponibile.')
      else if (message.includes('INVALID_DURATION')) setError('La durata del servizio non è valida.')
      else if (message.includes('OUTSIDE_AVAILABILITY')) setError('Questo orario non rientra nella disponibilità.')
      else if (message.includes('BLOCKED_TIME')) setError('Questo orario non è disponibile.')
      else if (message.includes('PAST_TIME')) setError('Non puoi prenotare un orario passato.')
      else setError('Non è stato possibile confermare la prenotazione. Riprova.')
      return false
    }
    setSuccess(true)
    return true
  }

  return { book, loading, error, success, clearError: () => setError(null) }
}
