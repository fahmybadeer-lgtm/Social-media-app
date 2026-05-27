import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ---------------------------------------------------------------------------
// Tailwind class merging
// ---------------------------------------------------------------------------

/**
 * Merge Tailwind CSS classes without conflicts.
 * Combines clsx (conditional class logic) with tailwind-merge (deduplication).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

/**
 * Convert a raw byte count into a human-readable string.
 * Uses binary prefixes (1 KB = 1024 bytes).
 *
 * @example
 *   formatFileSize(1536)       // "1.50 KB"
 *   formatFileSize(1048576)    // "1.00 MB"
 *   formatFileSize(1073741824) // "1.00 GB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`

  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(2)} KB`

  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(2)} MB`

  const gb = mb / 1024
  return `${gb.toFixed(2)} GB`
}

/**
 * Convert a duration in whole seconds to a MM:SS display string.
 *
 * @example
 *   formatDuration(90)  // "1:30"
 *   formatDuration(605) // "10:05"
 */
export function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Derive a simple file-type category from a MIME type string.
 * Returns null for unrecognised / unsupported MIME types.
 *
 * @example
 *   getFileType('image/jpeg') // 'image'
 *   getFileType('video/mp4')  // 'video'
 *   getFileType('text/plain') // null
 */
export function getFileType(mimeType: string): 'image' | 'video' | null {
  if (!mimeType) return null
  const lower = mimeType.toLowerCase()
  if (lower.startsWith('image/')) return 'image'
  if (lower.startsWith('video/')) return 'video'
  return null
}

// ---------------------------------------------------------------------------
// Storage / URL helpers
// ---------------------------------------------------------------------------

/**
 * Return a thumbnail URL by appending Supabase Storage transform parameters
 * to a public file URL.  Uses 400 × 400 by default.
 *
 * @example
 *   generateThumbnailUrl('https://…/public/media/image.jpg')
 *   // 'https://…/public/media/image.jpg?width=400&height=400'
 */
export function generateThumbnailUrl(fileUrl: string): string {
  if (!fileUrl) return fileUrl
  const separator = fileUrl.includes('?') ? '&' : '?'
  return `${fileUrl}${separator}width=400&height=400`
}

// ---------------------------------------------------------------------------
// Platform helpers
// ---------------------------------------------------------------------------

type Platform = 'facebook' | 'instagram' | 'tiktok' | 'linkedin'

const PLATFORM_COLORS: Record<Platform, string> = {
  facebook: 'blue-600',
  instagram: 'pink-500',
  tiktok: 'black',
  linkedin: 'blue-700',
}

/**
 * Return the Tailwind colour suffix for a given social-media platform.
 * Falls back to 'gray-500' for unknown platforms.
 *
 * @example
 *   getPlatformColor('facebook')  // 'blue-600'
 *   getPlatformColor('tiktok')    // 'black'
 */
export function getPlatformColor(platform: string): string {
  return PLATFORM_COLORS[platform.toLowerCase() as Platform] ?? 'gray-500'
}

/**
 * Return the icon identifier (string name) that matches a social platform.
 * The name corresponds to the Lucide icon library naming convention.
 *
 * @example
 *   getPlatformIcon('instagram') // 'Instagram'
 *   getPlatformIcon('linkedin')  // 'Linkedin'
 */
export function getPlatformIcon(platform: string): string {
  const icons: Record<Platform, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    tiktok: 'Music2',   // Lucide does not ship a TikTok icon; Music2 is the common stand-in
    linkedin: 'Linkedin',
  }
  return icons[platform.toLowerCase() as Platform] ?? 'Globe'
}

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

/**
 * Sanitise a filename by:
 *   1. Converting to lowercase
 *   2. Replacing whitespace with hyphens
 *   3. Stripping any character that is not alphanumeric, a hyphen, or a dot
 *   4. Collapsing consecutive hyphens into one
 *
 * @example
 *   sanitizeFileName('My Photo (2024).jpg') // 'my-photo-2024.jpg'
 *   sanitizeFileName('  hello world  ')     // 'hello-world'
 */
export function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')            // spaces → hyphens
    .replace(/[^a-z0-9.\-]/g, '')   // strip special chars (keep dots for extensions)
    .replace(/-{2,}/g, '-')          // collapse consecutive hyphens
}
