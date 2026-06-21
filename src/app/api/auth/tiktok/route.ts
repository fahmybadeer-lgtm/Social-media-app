import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY!;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const redirectUri = `${appUrl}/api/auth/tiktok/callback`;

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store code_verifier in Supabase — no cookies, no cross-site issues
  await supabase
    .from('social_tokens')
    .upsert(
      {
        user_id: user.id,
        platform: 'tiktok_pkce',
        access_token: codeVerifier,
        is_active: false,
      },
      { onConflict: 'user_id,platform' }
    );

  const scopes = encodeURIComponent('user.info.basic,video.publish,video.upload');

  const authUrl =
    `https://www.tiktok.com/v2/auth/authorize/` +
    `?client_key=${clientKey}` +
    `&scope=${scopes}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=cnbcut` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;

  return NextResponse.redirect(authUrl);
}
