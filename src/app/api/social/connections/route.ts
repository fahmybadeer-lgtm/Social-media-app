import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSocialTokens } from '@/lib/oauth/tokens'

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tokens = await getSocialTokens(supabase, user.id)
    const connections = tokens.map(({ platform, platform_username, is_active }) => ({
      platform,
      platform_username,
      is_active,
    }))
    return NextResponse.json(connections)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch connections'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
