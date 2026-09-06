import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizePublicPageTheme, type PublicPageTheme, type SocialLinks } from './useCoachPage'

export type PublicCoachPage = {
  coach_id: string
  slug: string
  display_name: string
  occupation: string | null
  bio: string | null
  avatar_url: string | null
  theme: PublicPageTheme
  social_links: SocialLinks
}

export type PublicCoachService = {
  id: string
  name: string
  description: string
  price_cents: number
  billing_type: string
  duration_minutes: number
  sessions_count: number | null
}

function normalizeSocialLinks(value: unknown): SocialLinks {
  if (typeof value !== 'object' || value === null) return {}
  const source = value as Record<string, unknown>
  const result: SocialLinks = {}
  for (const key of ['instagram', 'tiktok', 'youtube', 'website'] as const) {
    if (typeof source[key] === 'string' && source[key]) result[key] = source[key] as string
  }
  return result
}

type State = {
  loading: boolean
  notFound: boolean
  error: string | null
  page: PublicCoachPage | null
  services: PublicCoachService[]
}

export function usePublicCoachPage(slug: string) {
  const [state, setState] = useState<State>({ loading: true, notFound: false, error: null, page: null, services: [] })

  useEffect(() => {
    let active = true
    const load = async () => {
      setState({ loading: true, notFound: false, error: null, page: null, services: [] })

      const pageResult = await supabase
        .from('coach_pages')
        .select('coach_id, slug, display_name, occupation, bio, avatar_url, social_links, theme')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle()

      if (!active) return

      if (pageResult.error) {
        setState({ loading: false, notFound: false, error: 'Non è stato possibile caricare questa pagina.', page: null, services: [] })
        return
      }

      if (!pageResult.data) {
        setState({ loading: false, notFound: true, error: null, page: null, services: [] })
        return
      }

      const raw = pageResult.data as Record<string, unknown>
      const page: PublicCoachPage = {
        coach_id: raw.coach_id as string,
        slug: raw.slug as string,
        display_name: raw.display_name as string,
        occupation: (raw.occupation as string | null) ?? null,
        bio: (raw.bio as string | null) ?? null,
        avatar_url: (raw.avatar_url as string | null) ?? null,
        theme: normalizePublicPageTheme(raw.theme as string | null | undefined),
        social_links: normalizeSocialLinks(raw.social_links),
      }

      const servicesResult = await supabase
        .from('services')
        .select('id, name, description, price_cents, billing_type, duration_minutes, sessions_count')
        .eq('coach_id', page.coach_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (!active) return

      if (servicesResult.error) {
        setState({ loading: false, notFound: false, error: null, page, services: [] })
        return
      }

      setState({ loading: false, notFound: false, error: null, page, services: (servicesResult.data ?? []) as PublicCoachService[] })
    }
    void load()
    return () => { active = false }
  }, [slug])

  return state
}
