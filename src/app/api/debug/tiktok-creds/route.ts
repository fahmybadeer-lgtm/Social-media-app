import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.TIKTOK_CLIENT_KEY ?? 'NOT_SET';
  const secret = process.env.TIKTOK_CLIENT_SECRET ?? 'NOT_SET';

  const mask = (s: string) =>
    s.length > 8 ? `${s.slice(0, 5)}...${s.slice(-4)} (len=${s.length})` : `TOO_SHORT(${s.length})`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const testRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: key,
      client_secret: secret,
      code: 'test_code_dummy',
      grant_type: 'authorization_code',
      redirect_uri: `${appUrl}/api/auth/tiktok/callback`,
    }),
  });
  const testData = await testRes.json();

  return NextResponse.json({
    client_key: mask(key),
    client_secret: mask(secret),
    tiktok_response: testData,
  });
}
