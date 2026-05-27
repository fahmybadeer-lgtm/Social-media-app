import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Post, ScheduledQueueItem } from '@/types';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const VALID_POST_STATUSES = ['draft', 'scheduled', 'published', 'failed'] as const;
type PostStatus = (typeof VALID_POST_STATUSES)[number];

// Queue rows accept the same universe of statuses as Post, plus 'processing'.
const VALID_QUEUE_STATUSES = [
  'draft',
  'scheduled',
  'processing',
  'published',
  'failed',
] as const;
type QueueStatus = (typeof VALID_QUEUE_STATUSES)[number];

/**
 * Maps a post status to the corresponding initial queue status.
 * 'processing' is an internal-only queue state that is never set from post
 * status changes, so it falls through to the post's own value when applicable.
 */
function postStatusToQueueStatus(postStatus: PostStatus): QueueStatus {
  switch (postStatus) {
    case 'scheduled':
      return 'scheduled';
    case 'published':
      return 'published';
    case 'failed':
      return 'failed';
    default:
      return 'draft';
  }
}

// ---------------------------------------------------------------------------
// GET /api/posts/[id]
// Returns a single post with its scheduled_queue items. Verifies ownership.
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing post ID.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('posts')
    .select('*, scheduled_queue(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    // Distinguish between not-found and a real DB error.
    if (error?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }
    return NextResponse.json(
      { error: `Failed to fetch post: ${error?.message ?? 'Unknown error'}` },
      { status: 500 }
    );
  }

  // Ownership is already enforced by the .eq('user_id', user.id) filter, but
  // double-check to guard against unexpected DB behaviour.
  if (data.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    post: data as Post & { scheduled_queue: ScheduledQueueItem[] },
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/posts/[id]
// Accepts any subset of updatable post fields.
// If status changes to 'scheduled', all queue items for this post are updated
// to 'scheduled' as well.
// Returns the updated post (with queue items).
// ---------------------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing post ID.' }, { status: 400 });
  }

  let body: {
    caption?: unknown;
    title?: unknown;
    hashtags?: unknown;
    platforms?: unknown;
    media_ids?: unknown;
    status?: unknown;
    raw_concept?: unknown;
    voice_profile_id?: unknown;
    metadata?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // ----- Field-by-field validation -----

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.caption !== undefined) {
    if (typeof body.caption !== 'string' || body.caption.trim() === '') {
      return NextResponse.json(
        { error: '"caption" must be a non-empty string.' },
        { status: 400 }
      );
    }
    updates.caption = body.caption.trim();
  }

  if (body.title !== undefined) {
    if (typeof body.title !== 'string') {
      return NextResponse.json(
        { error: '"title" must be a string.' },
        { status: 400 }
      );
    }
    updates.title = body.title.trim();
  }

  if (body.hashtags !== undefined) {
    if (
      !Array.isArray(body.hashtags) ||
      !body.hashtags.every((h) => typeof h === 'string')
    ) {
      return NextResponse.json(
        { error: '"hashtags" must be an array of strings.' },
        { status: 400 }
      );
    }
    updates.hashtags = body.hashtags as string[];
  }

  if (body.platforms !== undefined) {
    if (
      !Array.isArray(body.platforms) ||
      body.platforms.length === 0 ||
      !body.platforms.every((p) => typeof p === 'string')
    ) {
      return NextResponse.json(
        { error: '"platforms" must be a non-empty array of strings.' },
        { status: 400 }
      );
    }
    updates.platforms = body.platforms as string[];
  }

  if (body.media_ids !== undefined) {
    if (
      !Array.isArray(body.media_ids) ||
      !body.media_ids.every((m) => typeof m === 'string')
    ) {
      return NextResponse.json(
        { error: '"media_ids" must be an array of strings.' },
        { status: 400 }
      );
    }
    updates.media_ids = body.media_ids as string[];
  }

  let incomingStatus: PostStatus | undefined;
  if (body.status !== undefined) {
    if (!VALID_POST_STATUSES.includes(body.status as PostStatus)) {
      return NextResponse.json(
        {
          error: `"status" must be one of: ${VALID_POST_STATUSES.join(', ')}.`,
        },
        { status: 400 }
      );
    }
    incomingStatus = body.status as PostStatus;
    updates.status = incomingStatus;
  }

  if (body.raw_concept !== undefined) {
    if (typeof body.raw_concept !== 'string') {
      return NextResponse.json(
        { error: '"raw_concept" must be a string.' },
        { status: 400 }
      );
    }
    updates.raw_concept = body.raw_concept;
  }

  if (body.voice_profile_id !== undefined) {
    if (typeof body.voice_profile_id !== 'string') {
      return NextResponse.json(
        { error: '"voice_profile_id" must be a string.' },
        { status: 400 }
      );
    }
    updates.voice_profile_id = body.voice_profile_id;
  }

  if (body.metadata !== undefined) {
    if (
      typeof body.metadata !== 'object' ||
      body.metadata === null ||
      Array.isArray(body.metadata)
    ) {
      return NextResponse.json(
        { error: '"metadata" must be a JSON object.' },
        { status: 400 }
      );
    }
    updates.metadata = body.metadata as Record<string, unknown>;
  }

  // Reject no-op requests (only updated_at would change)
  if (Object.keys(updates).length === 1) {
    return NextResponse.json(
      { error: 'No valid fields provided to update.' },
      { status: 400 }
    );
  }

  // ----- Verify the post exists and belongs to this user -----

  const { data: existing, error: fetchError } = await supabase
    .from('posts')
    .select('id, user_id, status')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    if (fetchError?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }
    return NextResponse.json(
      { error: `Failed to fetch post: ${fetchError?.message ?? 'Unknown error'}` },
      { status: 500 }
    );
  }

  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ----- Update the post -----

  const { data: updatedPost, error: updateError } = await supabase
    .from('posts')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id) // belt-and-suspenders ownership guard
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update post: ${updateError.message}` },
      { status: 500 }
    );
  }

  // ----- Propagate status change to queue items -----
  //
  // When the post status changes (to any value), synchronise all queue rows
  // that are not already in a terminal/in-progress state. Specifically:
  //   - If the new post status is 'scheduled', move draft queue items to 'scheduled'.
  //   - For any other status transition, mirror the status on all queue rows
  //     that are not 'processing' (which is managed by the worker).

  if (incomingStatus !== undefined) {
    const targetQueueStatus = postStatusToQueueStatus(incomingStatus);

    // Update all queue rows for this post that are not currently 'processing'.
    const { error: queueUpdateError } = await supabase
      .from('scheduled_queue')
      .update({
        status: targetQueueStatus,
        updated_at: updates.updated_at as string,
      })
      .eq('post_id', id)
      .eq('user_id', user.id)
      .neq('status', 'processing');

    if (queueUpdateError) {
      // Non-fatal: the post itself was updated; surface a warning but don't
      // roll back the post update.
      console.error(
        `[posts/[id]/PATCH] Failed to sync queue items for post ${id}: ${queueUpdateError.message}`
      );
    }
  }

  // ----- Return the updated post with refreshed queue items -----

  const { data: finalData, error: refetchError } = await supabase
    .from('posts')
    .select('*, scheduled_queue(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (refetchError || !finalData) {
    // The update succeeded; return what we already have without queue items.
    return NextResponse.json({ post: updatedPost as Post });
  }

  return NextResponse.json({
    post: finalData as Post & { scheduled_queue: ScheduledQueueItem[] },
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/posts/[id]
// Deletes all scheduled_queue items for the post, then deletes the post itself.
// Verifies ownership before any mutation.
// Returns { success: true }
// ---------------------------------------------------------------------------
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing post ID.' }, { status: 400 });
  }

  // Verify ownership before any destructive operation.
  const { data: existing, error: fetchError } = await supabase
    .from('posts')
    .select('id, user_id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    if (fetchError?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }
    return NextResponse.json(
      { error: `Failed to fetch post: ${fetchError?.message ?? 'Unknown error'}` },
      { status: 500 }
    );
  }

  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Delete all scheduled_queue rows for this post first (FK dependency).
  // The user_id guard is belt-and-suspenders; post_id is sufficient after the
  // ownership check above.
  const { error: queueDeleteError } = await supabase
    .from('scheduled_queue')
    .delete()
    .eq('post_id', id)
    .eq('user_id', user.id);

  if (queueDeleteError) {
    return NextResponse.json(
      {
        error: `Failed to delete queue items for post: ${queueDeleteError.message}`,
      },
      { status: 500 }
    );
  }

  // Delete the post itself.
  const { error: postDeleteError } = await supabase
    .from('posts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id); // belt-and-suspenders ownership guard

  if (postDeleteError) {
    return NextResponse.json(
      { error: `Failed to delete post: ${postDeleteError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
