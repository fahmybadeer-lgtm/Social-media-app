import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const GRAPH_API = 'https://graph.facebook.com/v20.0';

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    const { data: fbToken } = await supabase
        .from('social_tokens')
        .select('access_token, refresh_token')
        .eq('user_id', user.id)
        .eq('platform', 'facebook')
        .eq('is_active', true)
        .single();

    if (!fbToken) {
        return NextResponse.redirect(`${appUrl}/settings?error=instagram_no_facebook`);
    }

    const pageId = process.env.FACEBOOK_PAGE_ID!;
    const pageAccessToken = fbToken.access_token;
    const userAccessToken = fbToken.refresh_token ?? fbToken.access_token;

    // Try both instagram_business_account (professional) and connected_instagram_account (personal/linked)
    const igRes = await fetch(
        `${GRAPH_API}/${pageId}?fields=instagram_business_account,connected_instagram_account&access_token=${pageAccessToken}`
    );
    const igData = await igRes.json();
    const igAccountId =
        igData.instagram_business_account?.id ??
        igData.connected_instagram_account?.id;

    if (!igAccountId) {
        return NextResponse.redirect(`${appUrl}/settings?error=instagram_not_found`);
    }

    const igUserRes = await fetch(
        `${GRAPH_API}/${igAccountId}?fields=username&access_token=${userAccessToken}`
    );
    const igUserData = await igUserRes.json();

    const { error: dbError } = await supabase.from('social_tokens').upsert({
        user_id: user.id,
        platform: 'instagram',
        access_token: userAccessToken,
        platform_user_id: igAccountId,
        platform_username: igUserData.username ?? null,
        scope: 'instagram_content_publish',
        is_active: true,
    }, { onConflict: 'user_id,platform' });

    if (dbError) {
        return NextResponse.redirect(`${appUrl}/settings?error=instagram_save`);
    }

    return NextResponse.redirect(`${appUrl}/settings?success=instagram`);
}
