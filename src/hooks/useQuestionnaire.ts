import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Questionnaire = {
  id: string
  client_id: string
  answers: Record<string, unknown>
  injury_notes: string | null
  submitted_at: string | null
  updated_at: string
}

export function useQuestionnaire(clientId: string | undefined, enabled = true) {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null)
  const [loading, setLoading] = useState(enabled && Boolean(clientId))
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let active = true
    if (!enabled || !clientId) {
      setLoading(false)
      return () => { active = false }
    }
    const load = async () => {
      setLoading(true)
      setError(null)
      const result = await supabase.from('questionnaires')
        .select('id, client_id, answers, injury_notes, submitted_at, updated_at')
        .eq('client_id', clientId)
        .maybeSingle()
      if (!active) return
      if (result.error) {
        setError('Non è stato possibile caricare il questionario.')
        setQuestionnaire(null)
      } else {
        setQuestionnaire(result.data as Questionnaire | null)
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [clientId, enabled, refreshToken])

  const save = async (answers: Record<string, unknown>, injuryNotes: string) => {
    if (!clientId) return new Error('Cliente non disponibile.')
    const { data: relationship, error: relationshipError } = await supabase
      .from('coach_clients')
      .select('coach_id')
      .eq('client_id', clientId)
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle()
    if (relationshipError) return relationshipError
    if (!relationship?.coach_id) return new Error('Non hai ancora un coach associato. Contatta il tuo coach prima di salvare il questionario.')
    const result = await supabase.from('questionnaires').upsert({
      client_id: clientId,
      coach_id: relationship.coach_id,
      answers,
      injury_notes: injuryNotes.trim() || null,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' })
    if (result.error) return result.error
    setRefreshToken((value) => value + 1)
    return null
  }

  return { questionnaire, loading, error, refresh: () => setRefreshToken((value) => value + 1), save }
}
