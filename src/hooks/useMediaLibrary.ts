'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaItem {
  id: string
  user_id: string
  file_name: string
  original_name: string
  file_path: string
  file_url: string
  file_type: 'image' | 'video'
  mime_type: string
  file_size: number
  width: number | null
  height: number | null
  duration_seconds: number | null
  storage_bucket: string
  thumbnail_url: string | null
  tags: string[]
  is_processed: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface UseMediaLibraryResult {
  media: MediaItem[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  deleteMedia: (id: string) => Promise<void>
  renameMedia: (id: string, newName: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches, deletes, and renames items in the authenticated user's media
 * library.  All database queries are strictly scoped to the current user id.
 */
export function useMediaLibrary(): UseMediaLibraryResult {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Resolve the current authenticated user or throw. */
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

  const fetchMedia = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const userId = await getAuthenticatedUserId()
      const supabase = createClient()

      const { data, error: queryError } = await supabase
        .from('media_library')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (queryError) throw new Error(queryError.message)

      setMedia((data as MediaItem[]) ?? [])
    } catch (err: unknown) {
      const wrapped = err instanceof Error ? err : new Error(String(err))
      setError(wrapped)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount.
  useEffect(() => {
    void fetchMedia()
  }, [fetchMedia])

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  /**
   * Delete a media item.  First removes the file from Supabase Storage, then
   * deletes the database row.  Verifies ownership before any operation.
   */
  const deleteMedia = useCallback(
    async (id: string): Promise<void> => {
      const userId = await getAuthenticatedUserId()
      const supabase = createClient()

      // Fetch the record first to obtain storage details, and confirm ownership.
      const { data: record, error: fetchError } = await supabase
        .from('media_library')
        .select('id, user_id, file_path, storage_bucket')
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (fetchError || !record) {
        throw new Error(
          fetchError?.message ?? 'Media item not found or access denied'
        )
      }

      // Remove from Supabase Storage.
      const { error: storageError } = await supabase.storage
        .from(record.storage_bucket as string)
        .remove([record.file_path as string])

      if (storageError) {
        // Log but do not abort – the storage object may already be gone.
        console.warn('Storage deletion warning:', storageError.message)
      }

      // Delete the database record (strict user scope).
      const { error: deleteError } = await supabase
        .from('media_library')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (deleteError) throw new Error(deleteError.message)

      // Optimistically update local state.
      setMedia((prev) => prev.filter((item) => item.id !== id))
    },
    []
  )

  // -------------------------------------------------------------------------
  // Rename
  // -------------------------------------------------------------------------

  /**
   * Update the human-readable name of a media item.
   * Only the `original_name` column is modified; the physical file is untouched.
   */
  const renameMedia = useCallback(
    async (id: string, newName: string): Promise<void> => {
      const trimmed = newName.trim()
      if (!trimmed) throw new Error('New name must not be empty')

      const userId = await getAuthenticatedUserId()
      const supabase = createClient()

      const { data: updated, error: updateError } = await supabase
        .from('media_library')
        .update({ original_name: trimmed })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (updateError) throw new Error(updateError.message)

      // Optimistically patch local state.
      setMedia((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, original_name: (updated as MediaItem).original_name }
            : item
        )
      )
    },
    []
  )

  // -------------------------------------------------------------------------

  return {
    media,
    loading,
    error,
    refetch: fetchMedia,
    deleteMedia,
    renameMedia,
  }
}
