import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const GRAPH_API = 'https://graph.facebook.com/v20.0';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: fbToken } = await supabase
    .from('social_tokens')
    .select('access_token, refresh_token')
    .eq('user_id', user.id)
    .eq('platform', 'facebook')
    .eq('is_active', true)
    .single();

  if (!fbToken) {
    return NextResponse.json({ error: 'No Facebook token found' });
  }

  const pageId = process.env.FACEBOOK_PAGE_ID;
  const pageAccessToken = fbToken.access_token;

  // Try both fields
  const res1 = await fetch(
    `${GRAPH_API}/${pageId}?fields=instagram_business_account,connected_instagram_account,name&access_token=${pageAccessToken}`
  );
  const data1 = await res1.json();

  // Also try getting accounts list
  const res2 = await fetch(
    `${GRAPH_API}/me/accounts?access_token=${fbToken.refresh_token ?? fbToken.access_token}`
  );
  const data2 = await res2.json();

  return NextResponse.json({
    pageId,
    pageQuery: data1,
    myAccounts: data2,
    tokenPreview: pageAccessToken?.substring(0, 20) + '...',
  });
}
