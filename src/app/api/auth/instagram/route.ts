import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const GRAPH_API = 'https://graph.facebook.com/v20.0';

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    // Get the Facebook token stored during Facebook connect
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

    // Use the known Instagram Business Account ID from env vars
    // This bypasses the need to discover it through the Facebook Page API
    const igAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

    if (!igAccountId) {
        return NextResponse.redirect(`${appUrl}/settings?error=instagram_not_found`);
    }

    const userAccessToken = fbToken.refresh_token ?? fbToken.access_token;

    // Get the Instagram username
    const igUserRes = await fetch(
        `${GRAPH_API}/${igAccountId}?fields=username&access_token=${userAccessToken}`
    );
    const igUserData = await igUserRes.json();

    const { error: dbError } = await supabase.from('social_tokens').upsert({
        user_id: user.id,
        platform: 'instagram',
        access_token: userAccessToken,
        platform_user_id: igAccountId,
        platform_username: igUserData.username ?? 'cnbcut',
        scope: 'instagram_content_publish',
        is_active: true,
    }, { onConflict: 'user_id,platform' });

    if (dbError) {
        return NextResponse.redirect(`${appUrl}/settings?error=instagram_save`);
    }

    return NextResponse.redirect(`${appUrl}/settings?success=instagram`);
}
