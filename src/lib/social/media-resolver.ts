import type { SupabaseClient } from '@supabase/supabase-js';

export interface ResolvedMedia {
  /** Primary media URL — first item in media_ids. */
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  /** Additional image URLs when the post has 2+ images selected (multi-photo/carousel post). */
  extraImageUrls?: string[];
}

/**
 * Resolves a post's media_ids into a primary media item plus any extra image
 * URLs for multi-photo (Facebook), carousel (Instagram), or photo-mode (TikTok) posts.
 *
 * Multiple items are only treated as a multi-image post when every selected
 * item is an image — a single video always wins and extras are ignored.
 */
export async function resolvePostMedia(
  supabase: SupabaseClient,
  mediaIds: string[],
): Promise<ResolvedMedia> {
  if (!mediaIds || mediaIds.length === 0) return {};

  const { data: rows } = await supabase
    .from('media_library')
    .select('id, file_url, file_type')
    .in('id', mediaIds);

  if (!rows || rows.length === 0) return {};

  // Preserve the order the user selected them in.
  const ordered = mediaIds
    .map((id) => rows.find((r: { id: string }) => r.id === id))
    .filter(Boolean) as { id: string; file_url: string; file_type: string }[];

  if (ordered.length === 0) return {};

  const first = ordered[0];
  const mediaUrl = first.file_url;
  const mediaType = first.file_type as 'image' | 'video';

  if (mediaType === 'image' && ordered.length > 1) {
    const allImages = ordered.every((r) => r.file_type === 'image');
    if (allImages) {
      return {
        mediaUrl,
        mediaType,
        extraImageUrls: ordered.slice(1).map((r) => r.file_url),
      };
    }
  }

  return { mediaUrl, mediaType };
}
