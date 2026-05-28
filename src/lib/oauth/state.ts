import { cookies } from 'next/headers'

function base64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function randomBase64url(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength))
  return base64url(bytes.buffer)
}

async function sha256Base64url(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return base64url(digest)
}

export async function generateOAuthState(pkce: boolean): Promise<{
  state: string
  codeChallenge?: string
  cookieValue: string
}> {
  const nonce = randomBase64url(32)

  if (pkce) {
    const verifier = randomBase64url(32)
    const codeChallenge = await sha256Base64url(verifier)
    const payload = { nonce, verifier }
    const cookieValue = base64url(new TextEncoder().encode(JSON.stringify(payload)).buffer)
    const state = base64url(new TextEncoder().encode(JSON.stringify({ nonce })).buffer)
    return { state, codeChallenge, cookieValue }
  }

  const payload = { nonce }
  const cookieValue = base64url(new TextEncoder().encode(JSON.stringify(payload)).buffer)
  const state = cookieValue
  return { state, cookieValue }
}

export async function setStateCookie(platform: string, cookieValue: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(`oauth_state_${platform}`, cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
}

export async function consumeStateCookie(
  platform: string,
  stateParam: string
): Promise<{ nonce: string; verifier?: string } | null> {
  const cookieStore = await cookies()
  const cookieName = `oauth_state_${platform}`
  const cookieValue = cookieStore.get(cookieName)?.value

  if (!cookieValue) return null

  // Delete the cookie (consume it)
  cookieStore.delete(cookieName)

  try {
    const decoded = atob(cookieValue.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(decoded) as { nonce: string; verifier?: string }

    // For non-PKCE: state param equals cookieValue
    // For PKCE: state param only contains nonce (without verifier)
    if (!payload.verifier) {
      // Non-PKCE: stateParam should equal cookieValue
      if (stateParam !== cookieValue) return null
    } else {
      // PKCE: stateParam is base64url({ nonce })
      const statePayloadDecoded = atob(stateParam.replace(/-/g, '+').replace(/_/g, '/'))
      const statePayload = JSON.parse(statePayloadDecoded) as { nonce: string }
      if (statePayload.nonce !== payload.nonce) return null
    }

    return payload
  } catch {
    return null
  }
}
