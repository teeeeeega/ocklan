import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type ClientProgramDetail = {
  id: string
  client_id: string
  title: string
  status: string
  starts_at: string | null
  ends_at: string | null
  goal: string | null
  service: { name: string } | null
}

export type ClientProgramExercise = {
  id: string
  program_id: string
  exercise_name: string
  position: number
  sets: number | null
  reps: string | null
  duration_seconds: number | null
  rest_seconds: number | null
  load: string | null
  notes: string | null
  video_url: string | null
}

export function useClientProgramDetail(programId: string | undefined, clientId: string | undefined) {
  const [program, setProgram] = useState<ClientProgramDetail | null>(null)
  const [exercises, setExercises] = useState<ClientProgramExercise[]>([])
  const [loading, setLoading] = useState(Boolean(programId && clientId))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!programId || !clientId) {
      setLoading(false)
      setProgram(null)
      setExercises([])
      return () => { active = false }
    }

    const load = async () => {
      setLoading(true)
      setError(null)
      const [programResult, exercisesResult] = await Promise.all([
        supabase.from('client_programs')
          .select('id, client_id, title, status, starts_at, ends_at, goal, service:services(name)')
          .eq('id', programId)
          .eq('client_id', clientId)
          .maybeSingle(),
        supabase.from('program_exercises')
          .select('id, program_id, exercise_name, position, sets, reps, duration_seconds, rest_seconds, load, notes, video_url')
          .eq('program_id', programId)
          .order('position', { ascending: true }),
      ])
      if (!active) return
      if (programResult.error || exercisesResult.error) {
        setProgram(null)
        setExercises([])
        setError('Non è stato possibile caricare il programma.')
      } else {
        const service = Array.isArray(programResult.data?.service) ? programResult.data.service[0] ?? null : programResult.data?.service ?? null
        setProgram(programResult.data ? { ...programResult.data, service } as ClientProgramDetail : null)
        setExercises((exercisesResult.data ?? []) as ClientProgramExercise[])
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [clientId, programId])

  return { program, exercises, loading, error }
}
