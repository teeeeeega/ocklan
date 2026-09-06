import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export const paymentStatuses = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const
export type PaymentStatus = typeof paymentStatuses[number]

export type PaymentRecord = {
  id: string
  client_id: string
  service_id: string | null
  appointment_id: string | null
  amount_cents: number
  status: PaymentStatus
  provider: string | null
  provider_reference: string | null
  created_at: string
  client: { full_name: string } | null
  service: { name: string } | null
  appointment: {
    starts_at: string
    ends_at: string
    service: { name: string } | null
  } | null
}

export function usePayments(options: { clientId?: string; enabled?: boolean } = {}) {
  const { clientId, enabled = true } = options
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let active = true
    if (!enabled) {
      setPayments([])
      setLoading(false)
      return () => { active = false }
    }

    const load = async () => {
      setLoading(true)
      setError(null)
      let query = supabase
        .from('payments')
        .select('id, client_id, service_id, appointment_id, amount_cents, status, provider, provider_reference, created_at, client:profiles!payments_client_id_fkey(full_name), service:services(name), appointment:appointments!payments_appointment_id_fkey(starts_at, ends_at, service:services(name))')
        .order('created_at', { ascending: false })
      if (clientId) query = query.eq('client_id', clientId)
      const result = await query
      if (!active) return
      if (result.error) {
        setError(`Non è stato possibile caricare i pagamenti: ${result.error.message}`)
        setPayments([])
      } else {
        setPayments((result.data ?? []).map((payment) => ({
          ...payment,
          client: normalizeRelation(payment.client),
          service: normalizeRelation(payment.service),
          appointment: normalizeRelation(payment.appointment),
        })) as PaymentRecord[])
      }
      setLoading(false)
    }

    void load()
    return () => { active = false }
  }, [clientId, enabled, refreshToken])

  return { payments, loading, error, refresh: () => setRefreshToken((value) => value + 1) }
}

function normalizeRelation<T>(relation: T | T[] | null) {
  return Array.isArray(relation) ? relation[0] ?? null : relation
}
