'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed'
export type Platform = 'facebook' | 'instagram' | 'tiktok' | 'linkedin'
export type QueueStatus =
  | 'draft'
  | 'scheduled'
  | 'processing'
  | 'published'
  | 'failed'

export interface ScheduledQueueItem {
  id: string
  user_id: string
  post_id: string
  platform: Platform
  scheduled_at: string
  published_at: string | null
  status: QueueStatus
  error_message: string | null
  retry_count: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Post {
  id: string
  user_id: string
  title: string | null
  caption: string | null
  hashtags: string[]
  platforms: Platform[]
  media_ids: string[]
  status: PostStatus
  voice_profile_id: string | null
  raw_concept: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  /** Populated client-side from the scheduled_queue table. */
  scheduled_queue: ScheduledQueueItem[]
}

// ---------------------------------------------------------------------------
// Input shapes for mutations
// ---------------------------------------------------------------------------

export interface CreatePostData {
  title?: string
  caption?: string
  hashtags?: string[]
  platforms: Platform[]
  media_ids?: string[]
  status?: PostStatus
  voice_profile_id?: string
  raw_concept?: string
  metadata?: Record<string, unknown>
  /**
   * Per-platform schedule.  If a platform appears in `platforms` but is
   * missing from this map, `scheduled_at` defaults to now.
   */
  platformSchedules?: Partial<Record<Platform, string>>
}

export type UpdatePostData = Partial<
  Omit<CreatePostData, 'platforms' | 'platformSchedules'>
> & {
  platforms?: Platform[]
  status?: PostStatus
}

// ---------------------------------------------------------------------------
// Hook result
// ---------------------------------------------------------------------------

interface UsePostsResult {
  posts: Post[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  createPost: (data: CreatePostData) => Promise<Post>
  updatePost: (id: string, data: UpdatePostData) => Promise<Post>
  deletePost: (id: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the authenticated user's posts.  Each post is fetched together with
 * its associated `scheduled_queue` rows so consumers always have a complete
 * picture of scheduling state.
 */
export function usePosts(): UsePostsResult {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  // -------------------------------------------------------------------------
  // Auth helper
  // -------------------------------------------------------------------------

  async function getAuthenticatedUserId(): Promise<string> {
    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.getUser()
    if (authError || !data.user) {
      throw new Error(authError?.message ?? 'User is not authenticated')
    }
    return data.user.id
  }

  // -------------------------------------------------------------------------
  // Fetch
  // -------------------------------------------------------------------------

  const fetchPosts = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const userId = await getAuthenticatedUserId()
      const supabase = createClient()

      // Fetch posts
      const { data: postRows, error: postError } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (postError) throw new Error(postError.message)

      const rawPosts = (postRows ?? []) as Omit<Post, 'scheduled_queue'>[]

      if (rawPosts.length === 0) {
        setPosts([])
        return
      }

      // Fetch scheduled_queue rows for all fetched posts in a single query
      const postIds = rawPosts.map((p) => p.id)

      const { data: queueRows, error: queueError } = await supabase
        .from('scheduled_queue')
        .select('*')
        .eq('user_id', userId)
        .in('post_id', postIds)
        .order('scheduled_at', { ascending: true })

      if (queueError) throw new Error(queueError.message)

      const queueByPostId = ((queueRows ?? []) as ScheduledQueueItem[]).reduce<
        Record<string, ScheduledQueueItem[]>
      >((acc, item) => {
        if (!acc[item.post_id]) acc[item.post_id] = []
        acc[item.post_id].push(item)
        return acc
      }, {})

      const combined: Post[] = rawPosts.map((post) => ({
        ...post,
        scheduled_queue: queueByPostId[post.id] ?? [],
      }))

      setPosts(combined)
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount.
  useEffect(() => {
    void fetchPosts()
  }, [fetchPosts])

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  /**
   * Insert a new post row, then create one `scheduled_queue` entry per
   * platform listed in `data.platforms`.
   */
  const createPost = useCallback(
    async (data: CreatePostData): Promise<Post> => {
      const userId = await getAuthenticatedUserId()
      const supabase = createClient()

      const now = new Date().toISOString()

      // 1. Insert the post
      const postInsert = {
        user_id: userId,
        title: data.title ?? null,
        caption: data.caption ?? null,
        hashtags: data.hashtags ?? [],
        platforms: data.platforms,
        media_ids: data.media_ids ?? [],
        status: data.status ?? 'draft',
        voice_profile_id: data.voice_profile_id ?? null,
        raw_concept: data.raw_concept ?? null,
        metadata: data.metadata ?? {},
      }

      const { data: createdPost, error: postError } = await supabase
        .from('posts')
        .insert(postInsert)
        .select()
        .single()

      if (postError || !createdPost) {
        throw new Error(postError?.message ?? 'Failed to create post')
      }

      const post = createdPost as Omit<Post, 'scheduled_queue'>

      // 2. Create scheduled_queue rows for each platform
      const queueInserts = data.platforms.map((platform) => ({
        user_id: userId,
        post_id: post.id,
        platform,
        scheduled_at: data.platformSchedules?.[platform] ?? now,
        status: (data.status === 'scheduled' ? 'scheduled' : 'draft') as QueueStatus,
        metadata: {},
      }))

      let queueItems: ScheduledQueueItem[] = []

      if (queueInserts.length > 0) {
        const { data: createdQueue, error: queueError } = await supabase
          .from('scheduled_queue')
          .insert(queueInserts)
          .select()

        if (queueError) {
          // Queue creation failed – surface the error but still return the post
          console.error('Failed to create queue items:', queueError.message)
        } else {
          queueItems = (createdQueue ?? []) as ScheduledQueueItem[]
        }
      }

      const fullPost: Post = { ...post, scheduled_queue: queueItems }

      // Update local state optimistically
      setPosts((prev) => [fullPost, ...prev])

      return fullPost
    },
    []
  )

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  /**
   * Patch an existing post row.  The `scheduled_queue` is not modified here;
   * callers that need to reschedule should handle queue rows separately.
   */
  const updatePost = useCallback(
    async (id: string, data: UpdatePostData): Promise<Post> => {
      const userId = await getAuthenticatedUserId()
      const supabase = createClient()

      // Build a clean update payload (omit undefined values)
      const updatePayload: Record<string, unknown> = {}
      if (data.title !== undefined) updatePayload.title = data.title
      if (data.caption !== undefined) updatePayload.caption = data.caption
      if (data.hashtags !== undefined) updatePayload.hashtags = data.hashtags
      if (data.platforms !== undefined) updatePayload.platforms = data.platforms
      if (data.media_ids !== undefined) updatePayload.media_ids = data.media_ids
      if (data.status !== undefined) updatePayload.status = data.status
      if (data.voice_profile_id !== undefined)
        updatePayload.voice_profile_id = data.voice_profile_id
      if (data.raw_concept !== undefined)
        updatePayload.raw_concept = data.raw_concept
      if (data.metadata !== undefined) updatePayload.metadata = data.metadata

      const { data: updatedRow, error: updateError } = await supabase
        .from('posts')
        .update(updatePayload)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (updateError || !updatedRow) {
        throw new Error(updateError?.message ?? 'Failed to update post')
      }

      const updatedPost = updatedRow as Omit<Post, 'scheduled_queue'>

      // Fetch the latest queue state for this post
      const { data: queueRows, error: queueError } = await supabase
        .from('scheduled_queue')
        .select('*')
        .eq('post_id', id)
        .eq('user_id', userId)
        .order('scheduled_at', { ascending: true })

      if (queueError) {
        console.warn('Could not refresh queue items:', queueError.message)
      }

      const queueItems = (queueRows ?? []) as ScheduledQueueItem[]
      const fullPost: Post = { ...updatedPost, scheduled_queue: queueItems }

      // Update local state
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? fullPost : p))
      )

      return fullPost
    },
    []
  )

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  /**
   * Delete a post by id.  Related `scheduled_queue` rows are removed
   * automatically by the ON DELETE CASCADE constraint defined in the schema.
   */
  const deletePost = useCallback(async (id: string): Promise<void> => {
    const userId = await getAuthenticatedUserId()
    const supabase = createClient()

    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (deleteError) throw new Error(deleteError.message)

    // Optimistically remove from local state
    setPosts((prev) => prev.filter((p) => p.id !== id))
  }, [])

  // -------------------------------------------------------------------------

  return {
    posts,
    loading,
    error,
    refetch: fetchPosts,
    createPost,
    updatePost,
    deletePost,
  }
}
