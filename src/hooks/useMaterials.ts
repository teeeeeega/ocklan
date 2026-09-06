import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type MaterialRecord = {
  id: string
  client_id: string
  title: string
  description: string
  url: string
  file_path?: string
  material_type: string
  is_active: boolean
  created_at: string
}

type MaterialsData = {
  materials: MaterialRecord[]
  loading: boolean
  error: string | null
  refresh: () => void
  uploadFile: (file: File, targetClientId: string) => Promise<{ path: string; url: string } | null>
}

export function useMaterials(options: { clientId?: string; enabled?: boolean; activeOnly?: boolean } = {}): MaterialsData {
  const { clientId, enabled = true, activeOnly = false } = options
  const [materials, setMaterials] = useState<MaterialRecord[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let active = true
    if (!enabled || !clientId && options.clientId !== undefined) {
      setMaterials([])
      setLoading(false)
      return () => { active = false }
    }

    const load = async () => {
      setLoading(true)
      setError(null)
      let query = supabase.from('materials').select('id, client_id, title, description, url, material_type, is_active, created_at').order('created_at', { ascending: false })
      if (clientId) query = query.eq('client_id', clientId)
      if (activeOnly) query = query.eq('is_active', true)
      const result = await query
      if (!active) return
      if (result.error) {
        setError(`Non è stato possibile caricare i materiali: ${result.error.message}`)
        setMaterials([])
      } else {
        const resolved = await Promise.all((result.data ?? []).map(async (material) => {
          const item = material as MaterialRecord
          if (item.material_type !== 'FILE') return item
          const signed = await supabase.storage.from('coach-materials').createSignedUrl(item.url, 3600)
          return signed.data?.signedUrl ? { ...item, file_path: item.url, url: signed.data.signedUrl } : { ...item, file_path: item.url }
        }))
        setMaterials(resolved)
      }
      setLoading(false)
    }

    void load()
    return () => { active = false }
  }, [activeOnly, clientId, enabled, options.clientId, refreshToken])

  const uploadFile = async (file: File, targetClientId: string) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
    const path = `${targetClientId}/${crypto.randomUUID()}-${safeName}`
    const upload = await supabase.storage.from('coach-materials').upload(path, file, { upsert: false })
    if (upload.error) return null
    const signed = await supabase.storage.from('coach-materials').createSignedUrl(path, 3600)
    if (signed.error || !signed.data?.signedUrl) return null
    return { path, url: signed.data.signedUrl }
  }

  return { materials, loading, error, refresh: () => setRefreshToken((value) => value + 1), uploadFile }
}
