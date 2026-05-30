import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publishToFacebook, buildFacebookMessage } from '@/lib/social/facebook';
import type { Post, ScheduledQueueItem } from '@/types';

// ---------------------------------------------------------------------------
// GET /api/posts
// Returns all posts for the authenticated user with their scheduled_queue
// items joined. Supports optional ?status=draft|scheduled|published|failed
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status');

  const validStatuses = ['draft', 'scheduled', 'published', 'failed'] as const;
  type PostStatus = (typeof validStatuses)[number];

  // Build posts query
  let postsQuery = supabase
    .from('posts')
    .select('*, scheduled_queue(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (statusParam) {
    if (!validStatuses.includes(statusParam as PostStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status filter. Must be one of: ${validStatuses.join(', ')}`,
        },
        { status: 400 }
      );
    }
    postsQuery = postsQuery.eq('status', statusParam);
  }

  const { data, error } = await postsQuery;

  if (error) {
    return NextResponse.json(
      { error: `Failed to fetch posts: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ posts: (data ?? []) as (Post & { scheduled_queue: ScheduledQueueItem[] })[] });
}

// ---------------------------------------------------------------------------
// POST /api/posts
// Body: {
//   caption: string;
//   hashtags?: string[];
//   platforms: string[];
//   media_ids?: string[];
//   status?: 'draft' | 'scheduled' | 'published' | 'failed';
//   scheduled_at?: string;   // ISO-8601 datetime (used for queue rows)
//   raw_concept?: string;
//   voice_profile_id?: string;
//   title?: string;
//   publish_now?: boolean;   // when true, immediately posts to configured platforms
// }
// Creates the post then creates one scheduled_queue row per platform.
// When publish_now is true, also calls the Facebook Graph API and updates
// the queue row with the result (published / failed).
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    caption?: unknown;
    hashtags?: unknown;
    platforms?: unknown;
    media_ids?: unknown;
    status?: unknown;
    scheduled_at?: unknown;
    raw_concept?: unknown;
    voice_profile_id?: unknown;
    title?: unknown;
    publish_now?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // --- Validate required fields ---
  if (typeof body.caption !== 'string' || body.caption.trim() === '') {
    return NextResponse.json(
      { error: '"caption" is required and must be a non-empty string.' },
      { status: 400 }
    );
  }

  if (
    !Array.isArray(body.platforms) ||
    body.platforms.length === 0 ||
    !body.platforms.every((p) => typeof p === 'string')
  ) {
    return NextResponse.json(
      { error: '"platforms" is required and must be a non-empty array of strings.' },
      { status: 400 }
    );
  }

  // --- Validate optional fields ---
  const validStatuses = ['draft', 'scheduled', 'published', 'failed'] as const;
  type PostStatus = (typeof validStatuses)[number];

  const postStatus: PostStatus =
    body.status && validStatuses.includes(body.status as PostStatus)
      ? (body.status as PostStatus)
      : 'draft';

  if (
    body.hashtags !== undefined &&
    (!Array.isArray(body.hashtags) ||
      !body.hashtags.every((h) => typeof h === 'string'))
  ) {
    return NextResponse.json(
      { error: '"hashtags" must be an array of strings.' },
      { status: 400 }
    );
  }

  if (
    body.media_ids !== undefined &&
    (!Array.isArray(body.media_ids) ||
      !body.media_ids.every((m) => typeof m === 'string'))
  ) {
    return NextResponse.json(
      { error: '"media_ids" must be an array of strings.' },
      { status: 400 }
    );
  }

  if (
    body.scheduled_at !== undefined &&
    typeof body.scheduled_at !== 'string'
  ) {
    return NextResponse.json(
      { error: '"scheduled_at" must be a string (ISO-8601 datetime).' },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  // --- Insert the post ---
  const postInsertPayload = {
    user_id: user.id,
    caption: (body.caption as string).trim(),
    hashtags: Array.isArray(body.hashtags) ? (body.hashtags as string[]) : [],
    platforms: body.platforms as string[],
    media_ids: Array.isArray(body.media_ids) ? (body.media_ids as string[]) : [],
    status: postStatus,
    ...(body.title !== undefined && typeof body.title === 'string'
      ? { title: body.title.trim() }
      : {}),
    ...(body.raw_concept !== undefined && typeof body.raw_concept === 'string'
      ? { raw_concept: body.raw_concept }
      : {}),
    ...(body.voice_profile_id !== undefined &&
    typeof body.voice_profile_id === 'string'
      ? { voice_profile_id: body.voice_profile_id }
      : {}),
    metadata: {},
    created_at: now,
    updated_at: now,
  };

  const { data: newPost, error: postError } = await supabase
    .from('posts')
    .insert(postInsertPayload)
    .select()
    .single();

  if (postError) {
    return NextResponse.json(
      { error: `Failed to create post: ${postError.message}` },
      { status: 500 }
    );
  }

  const post = newPost as Post;

  // --- Create one scheduled_queue row per platform ---
  const platforms = body.platforms as string[];
  const publishNow = body.publish_now === true;

  // Default to now so the scheduled_queue NOT NULL constraint is always satisfied.
  const scheduledAt =
    typeof body.scheduled_at === 'string' ? body.scheduled_at : now;

  type QueueStatus = ScheduledQueueItem['status'];
  const queueStatus: QueueStatus =
    postStatus === 'scheduled'
      ? 'scheduled'
      : postStatus === 'failed'
      ? 'failed'
      : 'draft';

  const queueInsertRows = platforms.map((platform) => ({
    user_id: user.id,
    post_id: post.id,
    platform,
    // facebook items go to 'processing' when publishing immediately;
    // other platforms stay 'scheduled' until their integration is built.
    status: publishNow
      ? platform === 'facebook'
        ? ('processing' as const)
        : ('scheduled' as const)
      : queueStatus,
    scheduled_at: scheduledAt,
    retry_count: 0,
    metadata: {},
    created_at: now,
    updated_at: now,
  }));

  const { data: queueItems, error: queueError } = await supabase
    .from('scheduled_queue')
    .insert(queueInsertRows)
    .select();

  if (queueError) {
    console.error(
      `[posts/POST] Failed to create queue items for post ${post.id}: ${queueError.message}`
    );
    return NextResponse.json(
      {
        post,
        queue_items: [],
        warning: `Post created but queue items could not be inserted: ${queueError.message}`,
      },
      { status: 201 }
    );
  }

  const insertedQueueItems = (queueItems ?? []) as ScheduledQueueItem[];

  // --- Publish to Facebook immediately when requested ---
  if (!publishNow) {
    return NextResponse.json(
      { post, queue_items: insertedQueueItems },
      { status: 201 }
    );
  }

  const fbPageId = process.env.FACEBOOK_PAGE_ID;
  const fbAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  // Look up media URL for the first attached asset, if any
  const mediaIds = Array.isArray(body.media_ids) ? (body.media_ids as string[]) : [];
  let mediaUrl: string | undefined;
  let mediaType: 'image' | 'video' | undefined;

  if (mediaIds.length > 0) {
    const { data: mediaRows } = await supabase
      .from('media_library')
      .select('file_url, file_type')
      .in('id', mediaIds)
      .limit(1);

    if (mediaRows && mediaRows.length > 0) {
      const first = mediaRows[0] as { file_url: string; file_type: string };
      mediaUrl = first.file_url;
      mediaType = first.file_type as 'image' | 'video';
    }
  }

  const message = buildFacebookMessage(
    (body.caption as string).trim(),
    Array.isArray(body.hashtags) ? (body.hashtags as string[]) : [],
  );

  // Attempt to publish each facebook queue item
  let fbPublishError: string | undefined;

  for (const item of insertedQueueItems) {
    if (item.platform !== 'facebook') continue;

    if (!fbPageId || !fbAccessToken) {
      const errMsg =
        'FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN is not configured on the server.';
      await supabase
        .from('scheduled_queue')
        .update({ status: 'failed', error_message: errMsg, updated_at: new Date().toISOString() })
        .eq('id', item.id);
      fbPublishError = errMsg;
      continue;
    }

    try {
      const result = await publishToFacebook({
        message,
        mediaUrl,
        mediaType,
        pageId: fbPageId,
        accessToken: fbAccessToken,
      });

      await supabase
        .from('scheduled_queue')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          metadata: { facebook_post_id: result.id },
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      await supabase
        .from('scheduled_queue')
        .update({ status: 'failed', error_message: errMsg, updated_at: new Date().toISOString() })
        .eq('id', item.id);
      fbPublishError = errMsg;
    }
  }

  // If Facebook publishing failed, mark the post as failed and return an error
  if (fbPublishError) {
    await supabase
      .from('posts')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', post.id);

    return NextResponse.json(
      {
        post: { ...post, status: 'failed' },
        queue_items: insertedQueueItems,
        error: `Failed to publish to Facebook: ${fbPublishError}`,
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { post, queue_items: insertedQueueItems, published: true },
    { status: 201 }
  );
}
