import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidOAuthPlatform } from '@/lib/oauth/config'
import { deleteSocialToken } from '@/lib/oauth/tokens'
import type { Platform } from '@/types'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> }
): Promise<NextResponse> {
  const { platform } = await params

  if (!isValidOAuthPlatform(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await deleteSocialToken(supabase, user.id, platform as Platform)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to disconnect'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
