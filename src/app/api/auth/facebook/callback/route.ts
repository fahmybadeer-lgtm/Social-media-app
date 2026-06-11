import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const GRAPH_API = 'https://graph.facebook.com/v20.0';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const error = searchParams.get('error');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error) {
    return NextResponse.redirect(`${appUrl}/settings?error=facebook_denied`);
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${appUrl}/settings?error=facebook_invalid`);
  }

  const appId = process.env.FACEBOOK_APP_ID!;
  const appSecret = process.env.FACEBOOK_APP_SECRET!;
  const redirectUri = `${appUrl}/api/auth/facebook/callback`;

  // Step 1 — exchange code for short-lived user token
  const tokenRes = await fetch(
    `${GRAPH_API}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
  );
  const tokenData = await tokenRes.json();

  if (tokenData.error) {
    return NextResponse.redirect(`${appUrl}/settings?error=facebook_token`);
  }

  const shortLivedToken: string = tokenData.access_token;

  // Step 2 — exchange for long-lived user token (60 days)
  const longRes = await fetch(
    `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`
  );
  const longData = await longRes.json();

  if (longData.error) {
    return NextResponse.redirect(`${appUrl}/settings?error=facebook_longtoken`);
  }

  const longLivedUserToken: string = longData.access_token;

  // Step 3 — get the CNB Cut Page token (never expires)
  const pageId = process.env.FACEBOOK_PAGE_ID!;
  const accountsRes = await fetch(
    `${GRAPH_API}/me/accounts?access_token=${longLivedUserToken}`
  );
  const accountsData = await accountsRes.json();

  if (accountsData.error) {
    return NextResponse.redirect(`${appUrl}/settings?error=facebook_pages`);
  }

  const page = accountsData.data?.find(
    (p: { id: string; access_token: string; name: string }) => p.id === pageId
  );

  if (!page) {
    return NextResponse.redirect(`${appUrl}/settings?error=facebook_page_not_found`);
  }

  const pageAccessToken: string = page.access_token;

  // Step 4 — get user info
  const meRes = await fetch(`${GRAPH_API}/me?fields=id,name&access_token=${longLivedUserToken}`);
  const meData = await meRes.json();

  // Step 5 — save to Supabase social_tokens
  // access_token = Page Access Token (for Facebook posting)
  // refresh_token = Long-lived User Token (for Instagram posting)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${appUrl}/settings?error=facebook_auth`);
  }

  const { error: dbError } = await supabase
    .from('social_tokens')
    .upsert({
      user_id: user.id,
      platform: 'facebook',
      access_token: pageAccessToken,
      refresh_token: longLivedUserToken,
      platform_user_id: meData.id ?? null,
      platform_username: page.name ?? meData.name ?? null,
      scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_content_publish',
      is_active: true,
    }, { onConflict: 'user_id,platform' });

  if (dbError) {
    return NextResponse.redirect(`${appUrl}/settings?error=facebook_save`);
  }

  return NextResponse.redirect(`${appUrl}/settings?success=facebook`);
}
