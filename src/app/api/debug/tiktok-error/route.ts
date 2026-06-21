import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Try token exchange with a dummy code to see the error structure
  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey ?? 'missing',
      client_secret: clientSecret ?? 'missing',
      code: 'test_code',
      grant_type: 'authorization_code',
      redirect_uri: `${appUrl}/api/auth/tiktok/callback`,
      code_verifier: 'test_verifier',
    }),
  });

  const data = await tokenRes.json();
  return NextResponse.json({
    status: tokenRes.status,
    client_key_set: !!clientKey,
    client_key_prefix: clientKey?.slice(0, 8),
    response: data,
  });
}
