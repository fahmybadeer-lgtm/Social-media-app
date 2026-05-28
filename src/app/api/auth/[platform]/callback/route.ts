import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { OAUTH_CONFIGS, isValidOAuthPlatform } from '@/lib/oauth/config'
import { consumeStateCookie } from '@/lib/oauth/state'
import { upsertSocialToken } from '@/lib/oauth/tokens'

interface MetaTokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
}

interface TikTokTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  open_id: string
  scope: string
  display_name?: string
}

interface MetaUserResponse {
  id: string
  name: string
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
): Promise<NextResponse> {
  const { platform } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  if (!isValidOAuthPlatform(platform)) {
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_platform`)
  }

  const { searchParams } = new URL(request.url)

  // Check for OAuth error
  if (searchParams.get('error')) {
    return NextResponse.redirect(`${appUrl}/settings?error=oauth_denied`)
  }

  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')

  if (!code || !stateParam) {
    return NextResponse.redirect(`${appUrl}/settings?error=oauth_state_mismatch`)
  }

  // Consume and verify state cookie
  const statePayload = await consumeStateCookie(platform, stateParam)
  if (!statePayload) {
    return NextResponse.redirect(`${appUrl}/settings?error=oauth_state_mismatch`)
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.redirect(`${appUrl}/auth/login`)
  }

  const config = OAUTH_CONFIGS[platform]
  const clientId = process.env[config.clientIdEnvVar]!
  const clientSecret = process.env[config.clientSecretEnvVar]!
  const redirectUri = `${appUrl}/api/auth/${platform}/callback`

  try {
    let accessToken: string
    let refreshToken: string | null = null
    let tokenExpiresAt: string | null = null
    let platformUserId: string
    let platformUsername: string | null = null
    let scope: string | null = null

    if (platform === 'tiktok') {
      // TikTok token exchange
      const body = new URLSearchParams({
        client_key: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: statePayload.verifier ?? '',
      })

      const tokenRes = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })

      if (!tokenRes.ok) {
        throw new Error(`TikTok token exchange failed: ${tokenRes.statusText}`)
      }

      const tokenData = (await tokenRes.json()) as TikTokTokenResponse
      accessToken = tokenData.access_token
      refreshToken = tokenData.refresh_token ?? null
      platformUserId = tokenData.open_id
      platformUsername = tokenData.display_name ?? null
      scope = tokenData.scope ?? null

      if (tokenData.expires_in) {
        const expires = new Date(Date.now() + tokenData.expires_in * 1000)
        tokenExpiresAt = expires.toISOString()
      }
    } else {
      // Facebook / Instagram token exchange
      const tokenUrl = new URL(config.tokenUrl)
      tokenUrl.searchParams.set('client_id', clientId)
      tokenUrl.searchParams.set('client_secret', clientSecret)
      tokenUrl.searchParams.set('code', code)
      tokenUrl.searchParams.set('redirect_uri', redirectUri)
      tokenUrl.searchParams.set('grant_type', 'authorization_code')

      const tokenRes = await fetch(tokenUrl.toString())
      if (!tokenRes.ok) {
        throw new Error(`Meta token exchange failed: ${tokenRes.statusText}`)
      }

      const shortTokenData = (await tokenRes.json()) as MetaTokenResponse
      const shortToken = shortTokenData.access_token

      // Exchange for long-lived token
      const longTokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token')
      longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token')
      longTokenUrl.searchParams.set('client_id', clientId)
      longTokenUrl.searchParams.set('client_secret', clientSecret)
      longTokenUrl.searchParams.set('fb_exchange_token', shortToken)

      const longTokenRes = await fetch(longTokenUrl.toString())
      if (!longTokenRes.ok) {
        throw new Error(`Meta long-lived token exchange failed: ${longTokenRes.statusText}`)
      }

      const longTokenData = (await longTokenRes.json()) as MetaTokenResponse
      accessToken = longTokenData.access_token

      if (longTokenData.expires_in) {
        const expires = new Date(Date.now() + longTokenData.expires_in * 1000)
        tokenExpiresAt = expires.toISOString()
      }

      // Fetch user info
      const userInfoUrl = new URL('https://graph.facebook.com/v21.0/me')
      userInfoUrl.searchParams.set('fields', 'id,name')
      userInfoUrl.searchParams.set('access_token', accessToken)

      const userRes = await fetch(userInfoUrl.toString())
      if (!userRes.ok) {
        throw new Error(`Meta user info fetch failed: ${userRes.statusText}`)
      }

      const userData = (await userRes.json()) as MetaUserResponse
      platformUserId = userData.id
      platformUsername = userData.name
    }

    await upsertSocialToken(supabase, user.id, {
      platform,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: tokenExpiresAt,
      platform_user_id: platformUserId,
      platform_username: platformUsername,
      scope,
      is_active: true,
    })

    return NextResponse.redirect(`${appUrl}/settings?connected=${platform}`)
  } catch (err) {
    console.error(`[oauth/callback/${platform}]`, err)
    return NextResponse.redirect(`${appUrl}/settings?error=oauth_failed`)
  }
}
