'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send, Save, CheckCircle, AlertCircle, PenSquare } from 'lucide-react'
import MediaSelector from '@/components/composer/MediaSelector'
import AICaptionGenerator from '@/components/composer/AICaptionGenerator'
import HashtagInput from '@/components/composer/HashtagInput'
import PlatformSelector from '@/components/composer/PlatformSelector'
import ScheduleSelector from '@/components/composer/ScheduleSelector'
import PostPreview from '@/components/composer/PostPreview'
import { useMediaLibrary } from '@/hooks/useMediaLibrary'
import type { Platform, PostStatus, MediaFile } from '@/types'

// ---------------------------------------------------------------------------
// Composer state
// ---------------------------------------------------------------------------

interface ComposerFormState {
  title: string
  caption: string
  hashtags: string[]
  platforms: Platform[]
  selectedMediaIds: string[]
  status: PostStatus
  scheduledAt: string | null
  rawConcept: string
}

const INITIAL_STATE: ComposerFormState = {
  title: '',
  caption: '',
  hashtags: [],
  platforms: [],
  selectedMediaIds: [],
  status: 'draft',
  scheduledAt: null,
  rawConcept: '',
}

// Platform char limits for caption counter
const CAPTION_LIMITS: Record<Platform, number> = {
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  facebook: 63206,
}

function getEffectiveLimit(platforms: Platform[]): number | null {
  if (platforms.length === 0) return null
  return Math.min(...platforms.map((p) => CAPTION_LIMITS[p]))
}

// ---------------------------------------------------------------------------
// Toast component
// ---------------------------------------------------------------------------

function Toast({
  type,
  message,
  onDismiss,
}: {
  type: 'success' | 'error'
  message: string
  onDismiss: () => void
}) {
  return (
    <div
      className={[
        'fixed top-4 right-4 z-50 flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl max-w-sm',
        type === 'success'
          ? 'border-green-500/40 bg-green-900/80 text-green-200'
          : 'border-red-500/40 bg-red-900/80 text-red-200',
      ].join(' ')}
    >
      {type === 'success' ? (
        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
      )}
      <p className="text-sm flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="text-current/60 hover:text-current transition-colors ml-1"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ComposerPage() {
  const router = useRouter()
  const { media, loading: mediaLoading } = useMediaLibrary()

  const [form, setForm] = useState<ComposerFormState>(INITIAL_STATE)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(id)
  }, [toast])

  // Redirect to media library if media loading is done and library is empty
  useEffect(() => {
    if (!mediaLoading && media.length === 0) {
      // We don't force redirect — we show inline empty state instead
      // If you want hard redirect, uncomment:
      // router.push('/media-library')
    }
  }, [mediaLoading, media.length, router])

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const selectedMediaList: MediaFile[] = useMemo(
    () =>
      form.selectedMediaIds
        .map((id) => media.find((m) => m.id === id))
        .filter(Boolean) as MediaFile[],
    [form.selectedMediaIds, media]
  )
  const selectedMedia: MediaFile | null = selectedMediaList[0] ?? null

  const captionLimit = getEffectiveLimit(form.platforms)
  const captionLength = form.caption.length
  const captionOverLimit = captionLimit !== null && captionLength > captionLimit

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function patch<K extends keyof ComposerFormState>(key: K, value: ComposerFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    setForm(INITIAL_STATE)
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit(overrideStatus?: PostStatus) {
    const submitStatus = overrideStatus ?? form.status
    setIsSaving(true)

    try {
      const payload = {
        title: form.title || null,
        caption: form.caption || null,
        hashtags: form.hashtags,
        platforms: form.platforms,
        media_ids: form.selectedMediaIds,
        status: submitStatus,
        ...(submitStatus === 'published' ? { publish_now: true } : {}),
        ...(form.scheduledAt ? { scheduled_at: form.scheduledAt } : {}),
        metadata: {},
      }

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `Server error ${res.status}`)
      }

      const platformNames = form.platforms
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' & ')
      const successMsg =
        submitStatus === 'published'
          ? `Post published to ${platformNames}!`
          : submitStatus === 'scheduled'
          ? `Post scheduled for ${platformNames}!`
          : 'Draft saved successfully!'

      setToast({ type: 'success', message: successMsg })
      resetForm()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save post'
      setToast({ type: 'error', message: msg })
    } finally {
      setIsSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const canSubmit =
    !isSaving &&
    form.platforms.length > 0 &&
    (form.caption.trim().length > 0 || form.hashtags.length > 0 || form.selectedMediaIds.length > 0) &&
    !captionOverLimit

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}

      <div className="min-h-screen bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

          {/* Page header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <PenSquare className="w-5 h-5 text-indigo-400" />
              <h1 className="text-2xl font-bold text-white">Create Post</h1>
            </div>
            <p className="text-sm text-gray-400">
              Compose and schedule content for your social platforms
            </p>
          </div>

          {/* Two-column layout */}
          <div className="flex flex-col lg:flex-row gap-6">

            {/* ----------------------------------------------------------------
                Left column — composer form (60%)
            ---------------------------------------------------------------- */}
            <div className="flex-1 lg:max-w-[60%] space-y-5">

              {/* Title (optional) */}
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-2">
                <label htmlFor="post-title" className="block text-sm font-medium text-gray-300">
                  Post Title{' '}
                  <span className="text-gray-500 font-normal">(internal only, optional)</span>
                </label>
                <input
                  id="post-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => patch('title', e.target.value)}
                  placeholder="e.g. Summer sale announcement"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Media selector */}
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                {mediaLoading ? (
                  <div className="flex items-center gap-2 py-6 justify-center text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading media library…</span>
                  </div>
                ) : (
                  <MediaSelector
                    selectedMediaIds={form.selectedMediaIds}
                    onSelect={(ids) => patch('selectedMediaIds', ids)}
                    media={media as MediaFile[]}
                  />
                )}
              </div>

              {/* Caption textarea */}
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="caption" className="block text-sm font-medium text-gray-300">
                    Caption
                  </label>
                  <span
                    className={[
                      'text-xs tabular-nums',
                      captionOverLimit
                        ? 'text-red-400 font-medium'
                        : captionLimit !== null && captionLength > captionLimit * 0.9
                        ? 'text-amber-400'
                        : 'text-gray-500',
                    ].join(' ')}
                  >
                    {captionLength}
                    {captionLimit !== null && ` / ${captionLimit.toLocaleString()}`}
                  </span>
                </div>
                <textarea
                  id="caption"
                  value={form.caption}
                  onChange={(e) => patch('caption', e.target.value)}
                  rows={5}
                  placeholder="Write your caption here, or use the AI generator below…"
                  className={[
                    'w-full resize-none rounded-lg border bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors',
                    captionOverLimit ? 'border-red-500 focus:border-red-500' : 'border-gray-700 focus:border-indigo-500',
                  ].join(' ')}
                />
                {captionOverLimit && (
                  <p className="text-xs text-red-400">
                    Caption exceeds the limit for the selected platforms. Please shorten it.
                  </p>
                )}
              </div>

              {/* AI caption generator */}
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                <AICaptionGenerator
                  onCaptionGenerated={(caption) => patch('caption', caption)}
                  platforms={form.platforms}
                  selectedMedia={selectedMedia}
                />
              </div>

              {/* Hashtag input */}
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                <HashtagInput
                  hashtags={form.hashtags}
                  onChange={(hashtags) => patch('hashtags', hashtags)}
                />
              </div>

              {/* Platform selector */}
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                <PlatformSelector
                  selectedPlatforms={form.platforms}
                  onChange={(platforms) => patch('platforms', platforms)}
                />
              </div>

              {/* Schedule selector */}
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                <ScheduleSelector
                  status={form.status as 'draft' | 'scheduled'}
                  scheduledAt={form.scheduledAt}
                  onChange={(status, scheduledAt) => {
                    patch('status', status)
                    patch('scheduledAt', scheduledAt)
                  }}
                />
              </div>

              {/* Submit buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pb-8">
                <button
                  type="button"
                  onClick={() => handleSubmit('draft')}
                  disabled={isSaving || form.platforms.length === 0}
                  className={[
                    'flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-700 px-5 py-3 text-sm font-medium transition-all',
                    isSaving || form.platforms.length === 0
                      ? 'cursor-not-allowed text-gray-500'
                      : 'text-gray-300 hover:border-gray-600 hover:bg-gray-800 hover:text-white',
                  ].join(' ')}
                >
                  {isSaving && form.status === 'draft' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Draft
                </button>

                <button
                  type="button"
                  onClick={() =>
                    form.status === 'scheduled'
                      ? handleSubmit('scheduled')
                      : handleSubmit('published')
                  }
                  disabled={!canSubmit}
                  className={[
                    'flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all',
                    !canSubmit
                      ? 'cursor-not-allowed bg-gray-700 text-gray-500'
                      : 'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 shadow-lg shadow-indigo-900/30',
          ].join(' ')}
                >
                  {isSaving && form.status !== 'draft' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {form.status === 'scheduled' ? 'Schedule Post' : 'Publish Now'}
                </button>
              </div>

              {/* Validation hint */}
              {!canSubmit && !isSaving && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-900/20 px-3 py-2.5 -mt-2 mb-6">
                  <p className="text-xs text-amber-400">
                    {form.platforms.length === 0
                      ? 'Select at least one platform to continue.'
                      : captionOverLimit
                      ? 'Shorten your caption to match platform limits.'
                      : 'Add a caption, hashtag, or select media before publishing.'}
                  </p>
                </div>
              )}
            </div>

            {/* ----------------------------------------------------------------
                Right column — live preview (40%)
            ---------------------------------------------------------------- */}
            <div className="lg:w-[40%] lg:max-w-[40%]">
              <div className="lg:sticky lg:top-6">
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                  <h2 className="text-sm font-semibold text-gray-300 mb-4">Live Preview</h2>
                  <PostPreview
                    caption={form.caption}
                    hashtags={form.hashtags}
                    selectedMedia={selectedMediaList}
                    platforms={form.platforms.length > 0 ? form.platforms : ['instagram']}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
