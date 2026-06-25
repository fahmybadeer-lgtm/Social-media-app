import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { publishToFacebook, buildFacebookMessage } from '@/lib/social/facebook';
import { publishToInstagram, buildInstagramCaption } from '@/lib/social/instagram';
import { publishToTikTok, buildTikTokCaption } from '@/lib/social/tiktok';

// Use service role key so cron can bypass RLS
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  // Verify this is called by Vercel cron (or manually with the secret)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceClient();
  const now = new Date().toISOString();

  // Find all queue items that are due and still scheduled
  const { data: dueItems, error: fetchError } = await supabase
    .from('scheduled_queue')
    .select(`
      *,
      posts (
        id, user_id, caption, hashtags, platforms, media_ids
      )
    `)
    .eq('status', 'scheduled')
    .lte('scheduled_at', now);

  if (fetchError) {
    console.error('Cron fetch error:', fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!dueItems || dueItems.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  console.log(`Cron: processing ${dueItems.length} due queue items`);

  const processed: string[] = [];
  const failed: string[] = [];

  for (const item of dueItems) {
    const post = item.posts as any;
    if (!post) continue;

    const { user_id, caption, hashtags = [], media_ids = [] } = post;

    // Mark as processing so we don't double-publish
    await supabase
      .from('scheduled_queue')
      .update({ status: 'processing' })
      .eq('id', item.id);

    // Get media if any
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

    // Get platform tokens for this user
    const { data: tokens } = await supabase
      .from('social_tokens')
      .select('platform, access_token, refresh_token, platform_user_id')
      .eq('user_id', user_id)
      .eq('is_active', true);

    const tokenMap: Record<string, any> = {};
    for (const t of tokens ?? []) tokenMap[t.platform] = t;

    try {
      if (item.platform === 'facebook') {
        const pageId = process.env.FACEBOOK_PAGE_ID!;
        const accessToken = tokenMap.facebook?.access_token ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN!;
        const message = buildFacebookMessage(caption ?? '', hashtags);
        const result = await publishToFacebook({ message, mediaUrl, mediaType, pageId, accessToken });
        await supabase.from('scheduled_queue')
          .update({ status: 'published', metadata: { facebook_post_id: result.id } })
          .eq('id', item.id);
        processed.push(`facebook:${item.id}`);
      }

      else if (item.platform === 'instagram') {
        const igUserId = tokenMap.instagram?.platform_user_id ?? process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID!;
        const accessToken = tokenMap.instagram?.access_token ?? tokenMap.facebook?.refresh_token;
        if (!igUserId || !accessToken || !mediaUrl) throw new Error('Missing Instagram token or media');
        const igCaption = buildInstagramCaption(caption ?? '', hashtags);
        const result = await publishToInstagram({ caption: igCaption, mediaUrl, mediaType: mediaType ?? 'image', igUserId, accessToken });
        await supabase.from('scheduled_queue')
          .update({ status: 'published', metadata: { instagram_post_id: result.id } })
          .eq('id', item.id);
        processed.push(`instagram:${item.id}`);
      }

      else if (item.platform === 'tiktok') {
        const ttToken = tokenMap.tiktok?.access_token;
        if (!ttToken || !mediaUrl) throw new Error('Missing TikTok token or media');
        const ttCaption = buildTikTokCaption(caption ?? '', hashtags);
        const result = await publishToTikTok({ caption: ttCaption, mediaUrl, mediaType: mediaType ?? 'video', accessToken: ttToken });
        await supabase.from('scheduled_queue')
          .update({ status: 'published', metadata: { tiktok_publish_id: result.publish_id } })
          .eq('id', item.id);
        processed.push(`tiktok:${item.id}`);
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Cron publish failed for ${item.platform}:`, msg);
      await supabase.from('scheduled_queue')
        .update({ status: 'failed', error_message: msg })
        .eq('id', item.id);
      failed.push(`${item.platform}:${item.id}`);
    }
  }

  // Update parent post status
  const postIds = [...new Set(dueItems.map((i: any) => i.post_id))];
  for (const postId of postIds) {
    const { data: qItems } = await supabase
      .from('scheduled_queue')
      .select('status')
      .eq('post_id', postId);

    const statuses = (qItems ?? []).map((q: any) => q.status);
    const allDone = statuses.every((s: string) => s === 'published' || s === 'failed');
    if (allDone) {
      const anyPublished = statuses.some((s: string) => s === 'published');
      await supabase.from('posts')
        .update({ status: anyPublished ? 'published' : 'failed' })
        .eq('id', postId);
    }
  }

  return NextResponse.json({ processed: processed.length, failed: failed.length, items: { processed, failed } });
}
// cron trigger Thu Jun 25 12:21:01 UTC 2026
