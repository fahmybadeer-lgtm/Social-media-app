import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSocialTokens } from '@/lib/oauth/tokens'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const tokens = await getSocialTokens(supabase, user.id)

  const connectedPlatforms = Object.fromEntries(
    tokens
      .filter((t) => t.is_active)
      .map((t) => [
        t.platform,
        {
          username: t.platform_username ?? null,
          connectedAt: t.created_at,
        },
      ])
  )

  return <SettingsClient connectedPlatforms={connectedPlatforms} />
}
