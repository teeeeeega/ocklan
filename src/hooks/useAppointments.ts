import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type AppointmentUpdate = {
  starts_at: string
  ends_at: string
  status: 'PENDING' | 'BOOKED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED'
  location: string | null
  meeting_url: string | null
  notes: string | null
  payment_method: string
}

export type CoachCalendarAppointment = {
  id: string
  client_id: string
  service_id: string | null
  starts_at: string
  ends_at: string
  status: 'PENDING' | 'BOOKED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED'
  location: string | null
  meeting_url: string | null
  notes: string | null
  payment_method: string
  client: { full_name: string } | null
  service: { name: string } | null
}

function normalizeRelation<T>(relation: T | T[] | null) {
  return Array.isArray(relation) ? relation[0] ?? null : relation
}

export function useCoachCalendarAppointments(enabled: boolean, startsAt: string, endsAt: string) {
  const [appointments, setAppointments] = useState<CoachCalendarAppointment[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let active = true
    if (!enabled) {
      setAppointments([])
      setLoading(false)
      return () => { active = false }
    }

    const load = async () => {
      setLoading(true)
      setError(null)
      const result = await supabase
        .from('appointments')
        .select('id, client_id, service_id, starts_at, ends_at, status, payment_method, meeting_url, location, notes, client:profiles!appointments_client_id_fkey(full_name), service:services(name)')
        .lt('starts_at', endsAt)
        .gte('ends_at', startsAt)
        .order('starts_at', { ascending: true })
      if (!active) return
      if (result.error) {
        setAppointments([])
        setError('Non è stato possibile caricare gli appuntamenti del calendario.')
      } else {
        setAppointments((result.data ?? []).map((appointment) => ({
          ...appointment,
          client: normalizeRelation(appointment.client),
          service: normalizeRelation(appointment.service),
        })) as CoachCalendarAppointment[])
      }
      setLoading(false)
    }

    void load()
    return () => { active = false }
  }, [enabled, endsAt, refreshToken, startsAt])

  return { appointments, loading, error, refresh: () => setRefreshToken((value) => value + 1) }
}

export async function updateAppointment(id: string, payload: AppointmentUpdate) {
  return supabase.from('appointments').update(payload).eq('id', id)
}
