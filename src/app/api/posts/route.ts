import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publishToFacebook, buildFacebookMessage } from '@/lib/social/facebook';
import { publishToInstagram, buildInstagramCaption } from '@/lib/social/instagram';
import { publishToTikTok, buildTikTokCaption } from '@/lib/social/tiktok';
import { getValidTikTokAccessToken } from '@/lib/social/token-refresh';
import { resolvePostMedia } from '@/lib/social/media-resolver';

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

  if (!publish_now) {
        return NextResponse.json(post);
  }

  const { mediaUrl, mediaType, extraImageUrls } = await resolvePostMedia(supabase, media_ids);

  const { data: tokenRow } = await supabase
      .from('social_tokens')
      .select('access_token, refresh_token')
      .eq('user_id', user.id)
      .eq('platform', 'facebook')
      .eq('is_active', true)
      .single();

  const { data: igTokenRow } = await supabase
      .from('social_tokens')
      .select('access_token, platform_user_id')
      .eq('user_id', user.id)
      .eq('platform', 'instagram')
      .eq('is_active', true)
      .single();

  const pageAccessToken = tokenRow?.access_token ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const igUserId = igTokenRow?.platform_user_id ?? process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    const igAccessToken = igTokenRow?.access_token ?? tokenRow?.refresh_token ?? tokenRow?.access_token;

  const ttToken = platforms.includes('tiktok')
      ? await getValidTikTokAccessToken(supabase, user.id)
      : null;



  const results: Record<string, unknown> = {};
    let anySuccess = false;
    let lastError: string | null = null;

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
                          const result = await publishToFacebook({ message, mediaUrl, mediaType, extraImageUrls, pageId, accessToken: pageAccessToken });
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

  if (platforms.includes('instagram')) {
        if (!igUserId || !igAccessToken) {
                await supabase.from('scheduled_queue')
                  .update({ status: 'failed', error_message: 'Instagram not connected. Go to Settings to connect Instagram.' })
                  .eq('post_id', post.id).eq('platform', 'instagram');
                lastError = 'Instagram not connected. Go to Settings to connect Instagram.';
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
                                      extraImageUrls,
                                      igUserId,
                                      accessToken: igAccessToken,
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


  if (platforms.includes('tiktok')) {
        
        if (!ttToken) {
                await supabase.from('scheduled_queue')
                  .update({ status: 'failed', error_message: 'TikTok not connected. Go to Settings to connect TikTok.' })
                  .eq('post_id', post.id).eq('platform', 'tiktok');
                lastError = 'TikTok not connected. Go to Settings to connect TikTok.';
        } else if (!mediaUrl) {
                await supabase.from('scheduled_queue')
                  .update({ status: 'failed', error_message: 'TikTok requires a photo or video.' })
                  .eq('post_id', post.id).eq('platform', 'tiktok');
                lastError = 'TikTok requires a photo or video. Please select media to post to TikTok.';
        } else {
                try {
                          const ttCaption = buildTikTokCaption(caption ?? '', hashtags);
                          const result = await publishToTikTok({
                                      caption: ttCaption,
                                      mediaUrl,
                                      mediaType: mediaType ?? 'video',
                                      extraImageUrls,
                                      accessToken: ttToken,
                          });
                          await supabase.from('scheduled_queue')
                            .update({ status: 'published', metadata: { tiktok_publish_id: result.publish_id } })
                            .eq('post_id', post.id).eq('platform', 'tiktok');
                          results.tiktok = result;
                          anySuccess = true;
                } catch (err) {
                          const msg = err instanceof Error ? err.message : 'Unknown error';
                          await supabase.from('scheduled_queue')
                            .update({ status: 'failed', error_message: msg })
                            .eq('post_id', post.id).eq('platform', 'tiktok');
                          lastError = msg;
                }
        }
  }

  const finalStatus = anySuccess ? 'published' : 'failed';
    await supabase.from('posts').update({ status: finalStatus }).eq('id', post.id);

  if (!anySuccess && lastError) {
        return NextResponse.json({ error: lastError }, { status: 502 });
  }

  return NextResponse.json({ ...post, status: finalStatus, ...results });
}
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publishToFacebook, buildFacebookMessage } from '@/lib/social/facebook';
import { publishToInstagram, buildInstagramCaption } from '@/lib/social/instagram';
import { publishToTikTok, buildTikTokCaption } from '@/lib/social/tiktok';
import { getValidTikTokAccessToken } from '@/lib/social/token-refresh';

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

  if (!publish_now) {
        return NextResponse.json(post);
  }

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

  const { data: tokenRow } = await supabase
      .from('social_tokens')
      .select('access_token, refresh_token')
      .eq('user_id', user.id)
      .eq('platform', 'facebook')
      .eq('is_active', true)
      .single();

  const { data: igTokenRow } = await supabase
      .from('social_tokens')
      .select('access_token, platform_user_id')
      .eq('user_id', user.id)
      .eq('platform', 'instagram')
      .eq('is_active', true)
      .single();

  const pageAccessToken = tokenRow?.access_token ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const igUserId = igTokenRow?.platform_user_id ?? process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    const igAccessToken = igTokenRow?.access_token ?? tokenRow?.refresh_token ?? tokenRow?.access_token;

  const ttToken = platforms.includes('tiktok')
      ? await getValidTikTokAccessToken(supabase, user.id)
      : null;



  const results: Record<string, unknown> = {};
    let anySuccess = false;
    let lastError: string | null = null;

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

  if (platforms.includes('instagram')) {
        if (!igUserId || !igAccessToken) {
                await supabase.from('scheduled_queue')
                  .update({ status: 'failed', error_message: 'Instagram not connected. Go to Settings to connect Instagram.' })
                  .eq('post_id', post.id).eq('platform', 'instagram');
                lastError = 'Instagram not connected. Go to Settings to connect Instagram.';
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
                                      accessToken: igAccessToken,
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


  if (platforms.includes('tiktok')) {
        
        if (!ttToken) {
                await supabase.from('scheduled_queue')
                  .update({ status: 'failed', error_message: 'TikTok not connected. Go to Settings to connect TikTok.' })
                  .eq('post_id', post.id).eq('platform', 'tiktok');
                lastError = 'TikTok not connected. Go to Settings to connect TikTok.';
        } else if (!mediaUrl) {
                await supabase.from('scheduled_queue')
                  .update({ status: 'failed', error_message: 'TikTok requires a video.' })
                  .eq('post_id', post.id).eq('platform', 'tiktok');
                lastError = 'TikTok requires a video. Please upload a video to post to TikTok.';
        } else if (mediaType === 'image') {
                await supabase.from('scheduled_queue')
                  .update({ status: 'failed', error_message: 'TikTok only supports video posts. Please upload a video.' })
                  .eq('post_id', post.id).eq('platform', 'tiktok');
                lastError = 'TikTok only supports video posts — Facebook and Instagram got your image. Upload a video to post to TikTok.';
        } else {
                try {
                          const ttCaption = buildTikTokCaption(caption ?? '', hashtags);
                          const result = await publishToTikTok({
                                      caption: ttCaption,
                                      mediaUrl,
                                      mediaType: mediaType ?? 'video',
                                      accessToken: ttToken,
                          });
                          await supabase.from('scheduled_queue')
                            .update({ status: 'published', metadata: { tiktok_publish_id: result.publish_id } })
                            .eq('post_id', post.id).eq('platform', 'tiktok');
                          results.tiktok = result;
                          anySuccess = true;
                } catch (err) {
                          const msg = err instanceof Error ? err.message : 'Unknown error';
                          await supabase.from('scheduled_queue')
                            .update({ status: 'failed', error_message: msg })
                            .eq('post_id', post.id).eq('platform', 'tiktok');
                          lastError = msg;
                }
        }
  }

  const finalStatus = anySuccess ? 'published' : 'failed';
    await supabase.from('posts').update({ status: finalStatus }).eq('id', post.id);

  if (!anySuccess && lastError) {
        return NextResponse.json({ error: lastError }, { status: 502 });
  }

  return NextResponse.json({ ...post, status: finalStatus, ...results });
}
