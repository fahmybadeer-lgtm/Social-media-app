'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Shared "logo changed" signal.
//
// The Settings page and the sidebar both need to reflect a new logo the
// moment it's uploaded or removed, without prop drilling or a context
// provider. A simple window event does the job: Settings broadcasts after a
// successful upload/remove, and every mounted useShopLogo() instance
// re-fetches when it hears it.
// ---------------------------------------------------------------------------

export const LOGO_UPDATED_EVENT = 'cnbcut:logo-updated'

export function broadcastLogoUpdated() {
  window.dispatchEvent(new Event(LOGO_UPDATED_EVENT))
}

interface UseShopLogoResult {
  logoUrl: string | null
  loading: boolean
}

export function useShopLogo(): UseShopLogoResult {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLogoUrl(null)
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('logo_url')
      .eq('user_id', user.id)
      .single()

    setLogoUrl((data as { logo_url: string | null } | null)?.logo_url ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    // Fetch-on-mount, matching the same pattern already used by
    // useMediaLibrary.ts elsewhere in this codebase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetch()
    window.addEventListener(LOGO_UPDATED_EVENT, refetch)
    return () => window.removeEventListener(LOGO_UPDATED_EVENT, refetch)
  }, [refetch])

  return { logoUrl, loading }
}
