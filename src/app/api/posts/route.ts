import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publishToFacebook, buildFacebookMessage } from '@/lib/social/facebook';
import { publishToInstagram, buildInstagramCaption } from '@/lib/social/instagram';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  let query = supabase
    .from('posts')
    .select('*, scheduled_queue(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    caption,
    hashtags = [],
    platforms = [],
    scheduled_at,
    media_ids = [],
    status: requestedStatus = 'draft',
    publish_now = false,
  } = body;

  const status = publish_now ? 'processing' : requestedStatus;

  // Insert post record
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      caption,
      hashtags,
      platforms,
      media_ids,
      scheduled_at: scheduled_at ?? null,
      status,
    })
    .select()
    .single();

  if (postError || !post) {
    return NextResponse.json({ error: postError?.message ?? 'Failed to create post' }, { status: 500 });
  }

  // Insert queue items
  const queueItems = platforms.map((platform: string) => ({
    post_id: post.id,
    platform,
    status: publish_now ? 'processing' : 'scheduled',
    scheduled_at: scheduled_at ?? null,
  }));

  if (queueItems.length > 0) {
    const { error: queueError } = await supabase.from('scheduled_queue').insert(queueItems);
    if (queueError) return NextResponse.json({ error: queueError.message }, { status: 500 });
  }

  // If not publishing now, return draft/scheduled post
  if (!publish_now) {
    return NextResponse.json(post);
  }

  // --- Publishing flow ---

  // 1. Resolve media URL
  let mediaUrl: string | undefined;
  let mediaType: 'image' | 'video' | undefined;
  if (media_ids.length > 0) {
    const { data: mediaRow } = await supabase
      .from('media_library')
      .select('file_url, file_type')
      .eq('id', media_ids[0])
      .single();
    if (mediaRow) {
      mediaUrl = mediaRow.file_url;
      mediaType = mediaRow.file_type as 'image' | 'video';
    }
  }

  // 2. Fetch stored Facebook/Instagram tokens from Supabase
  const { data: tokenRow } = await supabase
    .from('social_tokens')
    .select('access_token, refresh_token')
    .eq('user_id', user.id)
    .eq('platform', 'facebook')
    .eq('is_active', true)
    .single();

  // Page Access Token for Facebook
  const pageAccessToken = tokenRow?.access_token ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  // User Access Token for Instagram (stored in refresh_token column)
  const userAccessToken = tokenRow?.refresh_token ?? tokenRow?.access_token ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  const results: Record<string, unknown> = {};
  let anySuccess = false;
  let lastError: string | null = null;

  // 3. Facebook
  if (platforms.includes('facebook')) {
    const pageId = process.env.FACEBOOK_PAGE_ID;
    if (!pageId || !pageAccessToken) {
      await supabase.from('scheduled_queue')
        .update({ status: 'failed', error_message: 'Facebook not connected' })
        .eq('post_id', post.id).eq('platform', 'facebook');
      lastError = 'Facebook not connected. Go to Settings to connect your page.';
    } else {
      try {
        const message = buildFacebookMessage(caption ?? '', hashtags);
        const result = await publishToFacebook({ message, mediaUrl, mediaType, pageId, accessToken: pageAccessToken });
        await supabase.from('scheduled_queue')
          .update({ status: 'published', metadata: { facebook_post_id: result.id } })
          .eq('post_id', post.id).eq('platform', 'facebook');
        results.facebook = result;
        anySuccess = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        await supabase.from('scheduled_queue')
          .update({ status: 'failed', error_message: msg })
          .eq('post_id', post.id).eq('platform', 'facebook');
        lastError = msg;
      }
    }
  }

  // 4. Instagram
  if (platforms.includes('instagram')) {
    const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    if (!igUserId || !userAccessToken) {
      await supabase.from('scheduled_queue')
        .update({ status: 'failed', error_message: 'Instagram not connected. Connect Facebook in Settings.' })
        .eq('post_id', post.id).eq('platform', 'instagram');
      lastError = 'Instagram not connected. Connect Facebook in Settings.';
    } else if (!mediaUrl) {
      await supabase.from('scheduled_queue')
        .update({ status: 'failed', error_message: 'Instagram requires an image.' })
        .eq('post_id', post.id).eq('platform', 'instagram');
      lastError = 'Instagram requires an image. Please select a photo before posting.';
    } else {
      try {
        const igCaption = buildInstagramCaption(caption ?? '', hashtags);
        const result = await publishToInstagram({
          caption: igCaption,
          mediaUrl,
          mediaType: mediaType ?? 'image',
          igUserId,
          accessToken: userAccessToken,
        });
        await supabase.from('scheduled_queue')
          .update({ status: 'published', metadata: { instagram_post_id: result.id } })
          .eq('post_id', post.id).eq('platform', 'instagram');
        results.instagram = result;
        anySuccess = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        await supabase.from('scheduled_queue')
          .update({ status: 'failed', error_message: msg })
          .eq('post_id', post.id).eq('platform', 'instagram');
        lastError = msg;
      }
    }
  }

  // 5. Update post final status
  const finalStatus = anySuccess ? 'published' : 'failed';
  await supabase.from('posts').update({ status: finalStatus }).eq('id', post.id);

  if (!anySuccess && lastError) {
    return NextResponse.json({ error: lastError }, { status: 502 });
  }

  return NextResponse.json({ ...post, status: finalStatus, ...results });
}
