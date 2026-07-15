'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CalendarClock,
  PenSquare,
} from 'lucide-react'
import { usePosts, type Post, type ScheduledQueueItem, type Platform } from '@/hooks/usePosts'

// ---------------------------------------------------------------------------
// Platform display helpers (colors match PlatformSelector in the Composer)
// ---------------------------------------------------------------------------

const PLATFORM_META: Record<Platform, { label: string; textColor: string; badgeBg: string }> = {
  facebook: { label: 'Facebook', textColor: 'text-blue-300', badgeBg: 'bg-blue-600/15 border-blue-600/30' },
  instagram: { label: 'Instagram', textColor: 'text-pink-300', badgeBg: 'bg-pink-600/15 border-pink-600/30' },
  tiktok: { label: 'TikTok', textColor: 'text-gray-100', badgeBg: 'bg-white/10 border-white/20' },
  linkedin: { label: 'LinkedIn', textColor: 'text-blue-200', badgeBg: 'bg-blue-400/15 border-blue-400/30' },
}

function PlatformBadge({ platform }: { platform: Platform }) {
  const meta = PLATFORM_META[platform]
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${meta.badgeBg} ${meta.textColor}`}
    >
      {meta.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// A flattened, post-aware queue row
// ---------------------------------------------------------------------------

interface QueueRow extends ScheduledQueueItem {
  postTitle: string
  postCaption: string
}

function flattenQueue(posts: Post[]): QueueRow[] {
  const rows: QueueRow[] = []
  for (const post of posts) {
    for (const item of post.scheduled_queue) {
      rows.push({
        ...item,
        postTitle: post.title ?? 'Untitled post',
        postCaption: post.caption ?? '',
      })
    }
  }
  return rows
}

function dateGroupLabel(iso: string): string {
  try {
    const d = parseISO(iso)
    if (isToday(d)) return 'Today'
    if (isTomorrow(d)) return 'Tomorrow'
    return format(d, 'EEEE, MMMM d')
  } catch {
    return 'Unknown date'
  }
}

// ---------------------------------------------------------------------------
// Row card
// ---------------------------------------------------------------------------

function QueueRowCard({ row }: { row: QueueRow }) {
  const time = (() => {
    try {
      return format(parseISO(row.scheduled_at), 'h:mm a')
    } catch {
      return ''
    }
  })()

  const statusMeta: Record<string, { icon: React.ReactNode; text: string; color: string }> = {
    scheduled: { icon: <Clock className="w-3.5 h-3.5" />, text: 'Scheduled', color: 'text-sky-300' },
    processing: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, text: 'Processing', color: 'text-amber-300' },
    published: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, text: 'Published', color: 'text-emerald-300' },
    failed: { icon: <AlertTriangle className="w-3.5 h-3.5" />, text: 'Failed', color: 'text-red-400' },
    draft: { icon: <PenSquare className="w-3.5 h-3.5" />, text: 'Draft', color: 'text-gray-400' },
  }
  const status = statusMeta[row.status] ?? statusMeta.draft

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <PlatformBadge platform={row.platform} />
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${status.color}`}>
            {status.icon}
            {status.text}
          </span>
          <span className="text-xs text-gray-500">{time}</span>
        </div>
        <p className="text-sm font-medium text-white truncate">{row.postTitle}</p>
        {row.postCaption && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{row.postCaption}</p>
        )}
        {row.status === 'failed' && row.error_message && (
          <p className="text-xs text-red-400 mt-1.5">{row.error_message}</p>
        )}
      </div>
      <Link
        href="/composer"
        className="shrink-0 text-xs font-medium text-gray-400 hover:text-white transition-colors"
      >
        Open
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export default function ScheduleView() {
  const { posts, loading, error } = usePosts()

  const { upcomingByDate, published, failed } = useMemo(() => {
    const rows = flattenQueue(posts)

    const upcoming = rows
      .filter((r) => r.status === 'scheduled' || r.status === 'processing')
      .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))

    const groups = new Map<string, QueueRow[]>()
    for (const row of upcoming) {
      const label = dateGroupLabel(row.scheduled_at)
      if (!groups.has(label)) groups.set(label, [])
      groups.get(label)!.push(row)
    }

    const publishedRows = rows
      .filter((r) => r.status === 'published')
      .sort((a, b) => (b.published_at ?? b.scheduled_at ?? '').localeCompare(a.published_at ?? a.scheduled_at ?? ''))
      .slice(0, 20)

    const failedRows = rows
      .filter((r) => r.status === 'failed')
      .sort((a, b) => (b.scheduled_at ?? '').localeCompare(a.scheduled_at ?? ''))

    return { upcomingByDate: groups, published: publishedRows, failed: failedRows }
  }, [posts])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading schedule…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">
        Couldn&apos;t load your schedule: {error.message}
      </div>
    )
  }

  const hasNothing = upcomingByDate.size === 0 && published.length === 0 && failed.length === 0

  if (hasNothing) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-800 py-20 text-center">
        <CalendarClock className="w-8 h-8 text-gray-600 mb-3" />
        <p className="text-sm font-medium text-gray-300">Nothing scheduled yet</p>
        <p className="text-xs text-gray-500 mt-1 mb-4 max-w-xs">
          Posts you schedule from the Composer will show up here, grouped by date.
        </p>
        <Link
          href="/composer"
          className="rounded-lg bg-[#C9A84C] px-4 py-2 text-xs font-semibold text-gray-950 hover:bg-[#dab868] transition-colors"
        >
          Create a post
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-10 max-w-3xl">
      {/* Failed — surfaced first since these need attention */}
      {failed.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-300 mb-3">
            <AlertTriangle className="w-4 h-4" />
            Needs attention ({failed.length})
          </h2>
          <div className="space-y-2">
            {failed.map((row) => (
              <QueueRowCard key={row.id} row={row} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming, grouped by date */}
      {upcomingByDate.size > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white mb-3">Upcoming</h2>
          <div className="space-y-6">
            {Array.from(upcomingByDate.entries()).map(([label, rows]) => (
              <div key={label}>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  {label}
                </p>
                <div className="space-y-2">
                  {rows.map((row) => (
                    <QueueRowCard key={row.id} row={row} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recently published */}
      {published.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white mb-3">Recently published</h2>
          <div className="space-y-2">
            {published.map((row) => (
              <QueueRowCard key={row.id} row={row} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
