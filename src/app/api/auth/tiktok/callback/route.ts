import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (!user) {
    return NextResponse.redirect(`${appUrl}/settings?error=tiktok_unauthorized`);
  }

  if (errorParam || !code || !state) {
    return NextResponse.redirect(`${appUrl}/settings?error=tiktok_denied`);
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY!;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET!;
  const redirectUri = `${appUrl}/api/auth/tiktok/callback`;

  console.log('TikTok token exchange: client_key prefix =', clientKey?.slice(0, 8));

  // No PKCE — simple authorization_code exchange
  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    const errDetail = encodeURIComponent(
      tokenData.error_description ?? tokenData.error ?? 'unknown'
    );
    console.error('TikTok token error:', JSON.stringify(tokenData));
    return NextResponse.redirect(
      `${appUrl}/settings?error=tiktok_token&detail=${errDetail}`
    );
  }

  const { access_token, refresh_token, open_id, scope, expires_in } = tokenData;

  // Get display name
  let displayName = open_id;
  try {
    const userRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=display_name',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const userData = await userRes.json();
    displayName = userData.data?.user?.display_name ?? open_id;
  } catch (_) {}

  // Save to Supabase
  const { error: dbError } = await supabase.from('social_tokens').upsert(
    {
      user_id: user.id,
      platform: 'tiktok',
      access_token,
      refresh_token: refresh_token ?? null,
      token_expires_at: expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null,
      platform_user_id: open_id,
      platform_username: displayName,
      scope: scope ?? 'video.publish',
      is_active: true,
    },
    { onConflict: 'user_id,platform' }
  );

  if (dbError) {
    console.error('TikTok Supabase save error:', dbError);
    return NextResponse.redirect(`${appUrl}/settings?error=tiktok_save`);
  }

  return NextResponse.redirect(`${appUrl}/settings?success=tiktok`);
}
