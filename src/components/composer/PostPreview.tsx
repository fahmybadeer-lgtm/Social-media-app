'use client'

import { useState } from 'react'
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ThumbsUp, Share2, Play } from 'lucide-react'
import type { Platform, MediaFile } from '@/types'

interface PostPreviewProps {
  caption: string
  hashtags: string[]
  selectedMedia: MediaFile | null
  platforms: Platform[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHashtags(hashtags: string[]): string {
  return hashtags.map((h) => `#${h}`).join(' ')
}

// ---------------------------------------------------------------------------
// Platform tab bar
// ---------------------------------------------------------------------------

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
}

// ---------------------------------------------------------------------------
// Media element
// ---------------------------------------------------------------------------

function MediaElement({
  media,
  className,
}: {
  media: MediaFile | null
  className?: string
}) {
  if (!media) {
    return (
      <div
        className={[
          'flex items-center justify-center bg-gray-800 text-gray-600',
          className ?? '',
        ].join(' ')}
      >
        <svg
          className="w-10 h-10 opacity-40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    )
  }

  const src = media.thumbnail_url ?? media.file_url

  if (media.file_type === 'video') {
    return (
      <div className={['relative bg-black', className ?? ''].join(' ')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Video thumbnail"
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
        </div>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Post media"
      className={['object-cover', className ?? ''].join(' ')}
    />
  )
}

// ---------------------------------------------------------------------------
// Platform previews
// ---------------------------------------------------------------------------

function InstagramPreview({
  caption,
  hashtags,
  media,
}: {
  caption: string
  hashtags: string[]
  media: MediaFile | null
}) {
  return (
    <div className="flex flex-col bg-black text-white text-[11px]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-[11px]">yourbusiness</p>
        </div>
        <MoreHorizontal className="w-4 h-4 text-gray-400" />
      </div>

      {/* Square media */}
      <MediaElement media={media} className="w-full aspect-square" />

      {/* Action row */}
      <div className="flex items-center gap-3 px-3 py-2">
        <Heart className="w-5 h-5" />
        <MessageCircle className="w-5 h-5" />
        <Send className="w-5 h-5" />
        <Bookmark className="w-5 h-5 ml-auto" />
      </div>

      {/* Caption */}
      <div className="px-3 pb-2 space-y-1">
        <p className="font-semibold text-[11px]">yourbusiness</p>
        {caption ? (
          <p className="text-[11px] text-gray-200 leading-relaxed line-clamp-3">
            {caption}
          </p>
        ) : (
          <p className="text-[11px] text-gray-500 italic">
            Your caption will appear here…
          </p>
        )}
        {hashtags.length > 0 && (
          <p className="text-[10px] text-blue-400 leading-relaxed line-clamp-2">
            {formatHashtags(hashtags)}
          </p>
        )}
      </div>
    </div>
  )
}

function TikTokPreview({
  caption,
  hashtags,
  media,
}: {
  caption: string
  hashtags: string[]
  media: MediaFile | null
}) {
  return (
    <div className="relative flex flex-col bg-black text-white overflow-hidden aspect-[9/16]">
      {/* Full-bleed video */}
      <MediaElement media={media} className="absolute inset-0 w-full h-full" />

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

      {/* Right-side action bar */}
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-4 z-10">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-white" />
        <div className="flex flex-col items-center gap-0.5">
          <Heart className="w-5 h-5" />
          <span className="text-[9px]">12.4K</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <MessageCircle className="w-5 h-5" />
          <span className="text-[9px]">843</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Share2 className="w-5 h-5" />
          <span className="text-[9px]">Share</span>
        </div>
      </div>

      {/* Bottom caption */}
      <div className="absolute bottom-4 left-2 right-10 z-10 space-y-1.5">
        <p className="font-bold text-[11px]">@yourbusiness</p>
        {caption ? (
          <p className="text-[11px] text-gray-100 leading-snug line-clamp-2">
            {caption}
          </p>
        ) : (
          <p className="text-[11px] text-gray-400 italic">
            Caption will appear here…
          </p>
        )}
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hashtags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-block bg-white/20 rounded-full px-2 py-0.5 text-[9px] text-white"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FacebookPreview({
  caption,
  hashtags,
  media,
}: {
  caption: string
  hashtags: string[]
  media: MediaFile | null
}) {
  return (
    <div className="flex flex-col bg-[#1c1e21] text-white text-[11px] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
          YB
        </div>
        <div className="flex-1">
          <p className="font-semibold text-[11px]">Your Business</p>
          <p className="text-[10px] text-gray-400">Just now · Public</p>
        </div>
        <MoreHorizontal className="w-4 h-4 text-gray-400" />
      </div>

      {/* Caption above media */}
      <div className="px-3 pb-2">
        {caption ? (
          <p className="text-[11px] text-gray-200 leading-relaxed line-clamp-3">
            {caption}
          </p>
        ) : (
          <p className="text-[11px] text-gray-500 italic">
            Your caption will appear here…
          </p>
        )}
        {hashtags.length > 0 && (
          <p className="mt-1 text-[10px] text-blue-400 leading-relaxed line-clamp-1">
            {formatHashtags(hashtags)}
          </p>
        )}
      </div>

      {/* Wide media (16:9) */}
      <MediaElement media={media} className="w-full aspect-video" />

      {/* Reaction counts */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-700/50">
        <div className="flex items-center gap-1 text-gray-400">
          <span className="text-[10px]">👍 ❤️ 😮</span>
          <span className="text-[10px]">1.2K</span>
        </div>
        <span className="text-[10px] text-gray-500">48 comments</span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-around px-2 py-1.5 border-t border-gray-700/50">
        {(['Like', 'Comment', 'Share'] as const).map((action) => (
          <button
            key={action}
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded text-gray-400 hover:bg-gray-700/40 text-[10px]"
          >
            <ThumbsUp className="w-3 h-3" />
            {action}
          </button>
        ))}
      </div>
    </div>
  )
}

function LinkedInPreview({
  caption,
  hashtags,
  media,
}: {
  caption: string
  hashtags: string[]
  media: MediaFile | null
}) {
  return (
    <div className="flex flex-col bg-[#1b1f23] text-white text-[11px] rounded-lg overflow-hidden border border-gray-700">
      {/* Header */}
      <div className="flex items-start gap-2 px-3 py-3">
        <div className="w-9 h-9 rounded-full bg-sky-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          YB
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[11px]">Your Business</p>
          <p className="text-[10px] text-gray-400">CEO &amp; Founder · 500+ followers</p>
          <p className="text-[10px] text-gray-500">Just now · 🌐</p>
        </div>
        <MoreHorizontal className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>

      {/* Professional caption */}
      <div className="px-3 pb-2">
        {caption ? (
          <p className="text-[11px] text-gray-200 leading-relaxed line-clamp-4">
            {caption}
          </p>
        ) : (
          <p className="text-[11px] text-gray-500 italic">
            Your caption will appear here…
          </p>
        )}
        {hashtags.length > 0 && (
          <p className="mt-1.5 text-[10px] text-sky-400 leading-relaxed line-clamp-2">
            {formatHashtags(hashtags)}
          </p>
        )}
      </div>

      {/* Media */}
      {media && (
        <MediaElement media={media} className="w-full aspect-video" />
      )}

      {/* Stats */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-700/50 text-[10px] text-gray-500">
        <span>👍 ❤️ 💡 · 342 reactions</span>
        <span>28 comments · 14 reposts</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-around px-2 py-1 border-t border-gray-700/50">
        {(['Like', 'Comment', 'Repost', 'Send'] as const).map((action) => (
          <button
            key={action}
            type="button"
            className="flex items-center gap-1 px-1.5 py-1 rounded text-gray-400 hover:bg-gray-700/40 text-[10px]"
          >
            <ThumbsUp className="w-3 h-3" />
            {action}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PostPreview({
  caption,
  hashtags,
  selectedMedia,
  platforms,
}: PostPreviewProps) {
  const availablePlatforms = platforms.length > 0 ? platforms : (['instagram'] as Platform[])
  const [activePlatform, setActivePlatform] = useState<Platform>(availablePlatforms[0])

  // If the active platform is deselected, fall back to the first available
  const displayPlatform = availablePlatforms.includes(activePlatform)
    ? activePlatform
    : availablePlatforms[0]

  function renderPreview() {
    switch (displayPlatform) {
      case 'instagram':
        return (
          <InstagramPreview
            caption={caption}
            hashtags={hashtags}
            media={selectedMedia}
          />
        )
      case 'tiktok':
        return (
          <TikTokPreview
            caption={caption}
            hashtags={hashtags}
            media={selectedMedia}
          />
        )
      case 'facebook':
        return (
          <FacebookPreview
            caption={caption}
            hashtags={hashtags}
            media={selectedMedia}
          />
        )
      case 'linkedin':
        return (
          <LinkedInPreview
            caption={caption}
            hashtags={hashtags}
            media={selectedMedia}
          />
        )
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Platform tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-800/60 p-1 border border-gray-700 self-stretch">
        {availablePlatforms.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setActivePlatform(p)}
            className={[
              'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-all duration-150',
              displayPlatform === p
                ? 'bg-indigo-600 text-white shadow'
                : 'text-gray-400 hover:text-gray-200',
            ].join(' ')}
          >
            {PLATFORM_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Phone frame */}
      <div className="w-[220px] flex-shrink-0">
        {/* Phone shell */}
        <div className="relative rounded-[2rem] border-4 border-gray-700 bg-gray-900 shadow-2xl overflow-hidden">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-gray-700 rounded-b-xl z-10" />

          {/* Screen content */}
          <div className="mt-4 overflow-hidden rounded-b-[1.5rem] min-h-[380px] overflow-y-auto">
            {renderPreview()}
          </div>

          {/* Home indicator bar */}
          <div className="flex justify-center py-2 bg-black">
            <div className="w-14 h-1 bg-gray-600 rounded-full" />
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center">
        Live preview — actual appearance may vary
      </p>
    </div>
  )
}
