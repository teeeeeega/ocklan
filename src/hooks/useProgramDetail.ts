import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type ProgramDetail = {
  id: string
  client_id: string
  title: string
  status: string
  goal: string | null
  starts_at: string | null
  ends_at: string | null
  service: { name: string } | null
}

export type ProgramExercise = {
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
  created_at: string
}

type ExerciseInput = Omit<ProgramExercise, 'id' | 'program_id' | 'position' | 'created_at'>

export function useProgramDetail(programId: string | undefined, clientId: string | undefined, enabled: boolean) {
  const [program, setProgram] = useState<ProgramDetail | null>(null)
  const [exercises, setExercises] = useState<ProgramExercise[]>([])
  const [loading, setLoading] = useState(enabled && Boolean(programId && clientId))
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let active = true
    if (!enabled || !programId || !clientId) {
      setLoading(false)
      return () => { active = false }
    }

    const load = async () => {
      setLoading(true)
      setError(null)
      const [programResult, exercisesResult] = await Promise.all([
        supabase.from('client_programs')
          .select('id, client_id, title, status, goal, starts_at, ends_at, service:services(name)')
          .eq('id', programId)
          .eq('client_id', clientId)
          .maybeSingle(),
        supabase.from('program_exercises')
          .select('id, program_id, exercise_name, position, sets, reps, duration_seconds, rest_seconds, load, notes, video_url, created_at')
          .eq('program_id', programId)
          .order('position', { ascending: true }),
      ])

      if (!active) return
      if (programResult.error || exercisesResult.error) {
        setProgram(null)
        setExercises([])
        setError('Non è stato possibile caricare il dettaglio del programma.')
      } else {
        const service = Array.isArray(programResult.data?.service) ? programResult.data.service[0] ?? null : programResult.data?.service ?? null
        setProgram(programResult.data ? { ...programResult.data, service } as ProgramDetail : null)
        setExercises(exercisesResult.data ?? [])
      }
      setLoading(false)
    }

    void load()
    return () => { active = false }
  }, [clientId, enabled, programId, refreshToken])

  const refresh = () => setRefreshToken((value) => value + 1)

  const updateExercise = async (exerciseId: string, input: ExerciseInput) => {
    const result = await supabase.from('program_exercises').update(input).eq('id', exerciseId).eq('program_id', programId ?? '')
    if (result.error) return result.error
    refresh()
    return null
  }

  const deleteExercise = async (exerciseId: string) => {
    const result = await supabase.from('program_exercises').delete().eq('id', exerciseId).eq('program_id', programId ?? '')
    if (result.error) return result.error
    refresh()
    return null
  }

  const moveExercise = async (exerciseId: string, direction: 'up' | 'down') => {
    if (!programId) return new Error('Programma non disponibile.')
    const currentIndex = exercises.findIndex((exercise) => exercise.id === exerciseId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= exercises.length) return null

    const reordered = [...exercises]
    const [moved] = reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    const temporaryBase = Math.max(...reordered.map((exercise) => exercise.position), reordered.length) + 1000

    for (const [index, exercise] of reordered.entries()) {
      const result = await supabase.from('program_exercises').update({ position: temporaryBase + index }).eq('id', exercise.id).eq('program_id', programId)
      if (result.error) {
        refresh()
        return result.error
      }
    }
    for (const [index, exercise] of reordered.entries()) {
      const result = await supabase.from('program_exercises').update({ position: index + 1 }).eq('id', exercise.id).eq('program_id', programId)
      if (result.error) {
        refresh()
        return result.error
      }
    }
    refresh()
    return null
  }

  return { program, exercises, loading, error, refresh, updateExercise, deleteExercise, moveExercise }
}
