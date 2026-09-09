import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type SocialLinks = {
  instagram?: string
  tiktok?: string
  youtube?: string
  website?: string
}

export type AdditionalLink = {
  title: string
  url: string
}

export const PUBLIC_PAGE_THEMES = ['obsidian', 'pure', 'sand', 'forest'] as const
export type PublicPageTheme = typeof PUBLIC_PAGE_THEMES[number]

export function normalizePublicPageTheme(theme: string | null | undefined): PublicPageTheme {
  if (theme === 'pure' || theme === 'light') return 'pure'
  if (theme === 'sand' || theme === 'forest') return theme
  return 'obsidian'
}

export type CoachPageRecord = {
  id: string
  coach_id: string
  slug: string
  display_name: string
  occupation: string | null
  bio: string | null
  avatar_url: string | null
  cover_url: string | null
  primary_color: string | null
  theme: PublicPageTheme
  cta_label: string | null
  cta_action: string | null
  social_links: SocialLinks
  additional_links: AdditionalLink[]
  is_published: boolean
  created_at: string
  updated_at: string
}

export type CoachPageInput = {
  slug: string
  display_name: string
  occupation: string
  bio: string
  avatar_url: string
  cover_url?: string
  primary_color?: string
  cta_label?: string
  cta_action?: string
  social_links: SocialLinks
  additional_links?: AdditionalLink[]
  is_published: boolean
  theme?: PublicPageTheme
}

const SELECT_COLUMNS = 'id, coach_id, slug, display_name, occupation, bio, avatar_url, cover_url, primary_color, theme, cta_label, cta_action, social_links, additional_links, is_published, created_at, updated_at'

function normalizeAdditionalLinks(value: unknown): AdditionalLink[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is { title?: unknown; url?: unknown } => typeof item === 'object' && item !== null)
    .map((item) => ({ title: typeof item.title === 'string' ? item.title : '', url: typeof item.url === 'string' ? item.url : '' }))
    .filter((item) => item.title || item.url)
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

function toRecord(raw: Record<string, unknown>): CoachPageRecord {
  return {
    id: raw.id as string,
    coach_id: raw.coach_id as string,
    slug: raw.slug as string,
    display_name: raw.display_name as string,
    occupation: (raw.occupation as string | null) ?? null,
    bio: (raw.bio as string | null) ?? null,
    avatar_url: (raw.avatar_url as string | null) ?? null,
    cover_url: (raw.cover_url as string | null) ?? null,
    primary_color: (raw.primary_color as string | null) ?? null,
    theme: normalizePublicPageTheme(raw.theme as string | null | undefined),
    cta_label: (raw.cta_label as string | null) ?? null,
    cta_action: (raw.cta_action as string | null) ?? null,
    social_links: normalizeSocialLinks(raw.social_links),
    additional_links: normalizeAdditionalLinks(raw.additional_links),
    is_published: Boolean(raw.is_published),
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
  }
}

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/

export const RESERVED_SLUGS = ['login', 'register', 'dashboard', 'area-clienti', 'profilo', 'contatti', 'api', 'admin', 'settings', 'onboarding']

export function validateSlug(slug: string): string | null {
  if (!slug) return 'Lo slug è obbligatorio.'
  if (!SLUG_PATTERN.test(slug)) return 'Lo slug può contenere solo lettere minuscole, numeri e trattini, senza iniziare o finire con un trattino (3-50 caratteri).'
  if (RESERVED_SLUGS.includes(slug)) return 'Questo slug è riservato al sito e non può essere utilizzato.'
  return null
}

function readableError(message: string | undefined) {
  if (!message) return 'Non è stato possibile salvare la pagina.'
  if (message.includes('coach_pages_slug_format')) return 'Lo slug non rispetta il formato consentito.'
  if (message.includes('coach_pages_slug_not_reserved')) return 'Questo slug è riservato e non può essere utilizzato.'
  if (message.includes('coach_pages_slug_key') || message.toLowerCase().includes('duplicate') && message.includes('slug')) return 'Questo slug è già in uso da un altro coach.'
  if (message.includes('INVALID_COACH')) return 'Solo un account COACH può avere una pagina pubblica.'
  return 'Non è stato possibile salvare la pagina.'
}

export function useCoachPage(enabled: boolean, coachId: string | null) {
  const [page, setPage] = useState<CoachPageRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [resolvedKey, setResolvedKey] = useState<string | null>(null)

  const fetchKey = enabled && coachId ? `${coachId}:${refreshToken}` : null

  useEffect(() => {
    let active = true
    if (!fetchKey || !coachId) {
      setPage(null)
      setError(null)
      return () => { active = false }
    }
    const load = async () => {
      setError(null)
      const result = await supabase.from('coach_pages').select(SELECT_COLUMNS).eq('coach_id', coachId).maybeSingle()
      if (!active) return
      if (result.error) {
        setError('Non è stato possibile caricare la pagina pubblica.')
        setPage(null)
      } else {
        setPage(result.data ? toRecord(result.data as Record<string, unknown>) : null)
      }
      setResolvedKey(fetchKey)
    }
    void load()
    return () => { active = false }
  }, [coachId, fetchKey])

  // Derived, not stateful: stays true during the enabled false→true transition
  // render too, so consumers never observe a stale "loaded" with page === null.
  const loading = fetchKey !== null && resolvedKey !== fetchKey

  const save = async (input: CoachPageInput): Promise<{ error: string | null }> => {
    if (!coachId) return { error: 'Coach non disponibile. Effettua nuovamente l’accesso.' }
    const slugError = validateSlug(input.slug)
    if (slugError) return { error: slugError }
    if (!input.display_name.trim()) return { error: 'Il nome visualizzato è obbligatorio.' }

    const payload = {
      slug: input.slug,
      display_name: input.display_name.trim(),
      occupation: input.occupation.trim() || null,
      bio: input.bio.trim() || null,
      avatar_url: input.avatar_url.trim() || null,
      cover_url: input.cover_url?.trim() || null,
      primary_color: input.primary_color?.trim() || null,
      cta_label: input.cta_label?.trim() || null,
      cta_action: input.cta_action?.trim() || null,
      social_links: input.social_links,
      additional_links: input.additional_links ?? [],
      is_published: input.is_published,
      ...(input.theme ? { theme: input.theme } : !page ? { theme: 'obsidian' } : {}),
    }

    const result = page
      ? await supabase.from('coach_pages').update(payload).eq('id', page.id).select(SELECT_COLUMNS).single()
      : await supabase.from('coach_pages').insert({ coach_id: coachId, ...payload }).select(SELECT_COLUMNS).single()

    if (result.error) return { error: readableError(result.error.message) }
    setPage(toRecord(result.data as Record<string, unknown>))
    return { error: null }
  }

  const saveTheme = async (theme: PublicPageTheme): Promise<{ error: string | null }> => {
    if (!page) return { error: 'Crea prima la tua pagina pubblica.' }
    const result = await supabase.from('coach_pages').update({ theme }).eq('id', page.id).select(SELECT_COLUMNS).single()
    if (result.error) return { error: readableError(result.error.message) }
    setPage(toRecord(result.data as Record<string, unknown>))
    return { error: null }
  }

  const uploadAvatar = async (file: File): Promise<{ url: string | null; error: string | null }> => {
    if (!coachId) return { url: null, error: 'Coach non disponibile. Effettua nuovamente l’accesso.' }
    if (!file.type.startsWith('image/')) return { url: null, error: 'Seleziona un’immagine valida.' }
    if (file.size > 5 * 1024 * 1024) return { url: null, error: 'L’immagine deve essere più piccola di 5 MB.' }

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${coachId}/avatar-${Date.now()}.${extension}`
    const upload = await supabase.storage.from('coach-avatars').upload(path, file, { upsert: false, contentType: file.type })
    if (upload.error) return { url: null, error: 'Non è stato possibile caricare l’immagine.' }

    const { data } = supabase.storage.from('coach-avatars').getPublicUrl(path)
    const previousPath = page?.avatar_url ? extractStoragePath(page.avatar_url) : null
    if (previousPath) await supabase.storage.from('coach-avatars').remove([previousPath])

    return { url: data.publicUrl, error: null }
  }

  const uploadCover = async (file: File): Promise<{ url: string | null; error: string | null }> => {
    if (!coachId) return { url: null, error: 'Coach non disponibile. Effettua nuovamente l\u2019accesso.' }
    if (!file.type.startsWith('image/')) return { url: null, error: 'Seleziona un\u2019immagine valida.' }
    if (file.size > 5 * 1024 * 1024) return { url: null, error: 'L\u2019immagine deve essere pi\u00f9 piccola di 5 MB.' }

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${coachId}/cover-${Date.now()}.${extension}`
    const upload = await supabase.storage.from('coach-avatars').upload(path, file, { upsert: false, contentType: file.type })
    if (upload.error) return { url: null, error: 'Non \u00e8 stato possibile caricare l\u2019immagine.' }

    const { data } = supabase.storage.from('coach-avatars').getPublicUrl(path)
    const previousPath = page?.cover_url ? extractStoragePath(page.cover_url) : null
    if (previousPath) await supabase.storage.from('coach-avatars').remove([previousPath])

    return { url: data.publicUrl, error: null }
  }

  return { page, loading, error, save, saveTheme, uploadAvatar, uploadCover, refresh: () => setRefreshToken((value) => value + 1) }
}

function extractStoragePath(publicUrl: string): string | null {
  const marker = '/coach-avatars/'
  const index = publicUrl.indexOf(marker)
  if (index === -1) return null
  return publicUrl.slice(index + marker.length)
}
