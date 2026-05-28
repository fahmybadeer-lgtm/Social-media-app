import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { OAUTH_CONFIGS, isValidOAuthPlatform } from '@/lib/oauth/config'
import { generateOAuthState, setStateCookie } from '@/lib/oauth/state'

export async function GET(
  request: Request,
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

  const config = OAUTH_CONFIGS[platform]
  const clientId = process.env[config.clientIdEnvVar]
  const clientSecret = process.env[config.clientSecretEnvVar]

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: `Platform ${platform} is not configured` },
      { status: 500 }
    )
  }

  const { state, codeChallenge, cookieValue } = await generateOAuthState(config.pkce)
  await setStateCookie(platform, cookieValue)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const redirectUri = `${appUrl}/api/auth/${platform}/callback`

  const authUrl = new URL(config.authUrl)
  authUrl.searchParams.set(config.clientIdParam, clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', config.scopes.join(' '))
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('response_type', 'code')

  if (config.pkce && codeChallenge) {
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
  }

  return NextResponse.redirect(authUrl.toString())
}
