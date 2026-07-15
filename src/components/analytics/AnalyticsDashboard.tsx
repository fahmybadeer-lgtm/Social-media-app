'use client'

import { useMemo } from 'react'
import { Loader2, FileText, Clock, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { usePosts, type Platform, type PostStatus } from '@/hooks/usePosts'

// ---------------------------------------------------------------------------
// Static display config
// ---------------------------------------------------------------------------

const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
}

const STATUS_CARD_META: Record<
  PostStatus,
  { label: string; icon: React.ReactNode; color: string }
> = {
  draft: { label: 'Drafts', icon: <FileText className="w-4 h-4" />, color: 'text-gray-300' },
  scheduled: { label: 'Scheduled', icon: <Clock className="w-4 h-4" />, color: 'text-sky-300' },
  published: { label: 'Published', icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-300' },
  failed: { label: 'Failed', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-400' },
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className={`flex items-center gap-2 text-xs font-medium ${color}`}>
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-500">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

export default function AnalyticsDashboard() {
  const { posts, loading, error } = usePosts()

  const stats = useMemo(() => {
    const byPostStatus: Record<PostStatus, number> = {
      draft: 0,
      scheduled: 0,
      published: 0,
      failed: 0,
    }

    const byPlatform: Record<Platform, { total: number; published: number; failed: number }> = {
      facebook: { total: 0, published: 0, failed: 0 },
      instagram: { total: 0, published: 0, failed: 0 },
      tiktok: { total: 0, published: 0, failed: 0 },
      linkedin: { total: 0, published: 0, failed: 0 },
    }

    let queuePublished = 0
    let queueFailed = 0

    for (const post of posts) {
      byPostStatus[post.status] = (byPostStatus[post.status] ?? 0) + 1

      for (const item of post.scheduled_queue) {
        const bucket = byPlatform[item.platform]
        bucket.total += 1
        if (item.status === 'published') {
          bucket.published += 1
          queuePublished += 1
        }
        if (item.status === 'failed') {
          bucket.failed += 1
          queueFailed += 1
        }
      }
    }

    const terminal = queuePublished + queueFailed
    const successRate = terminal > 0 ? Math.round((queuePublished / terminal) * 100) : null

    const recent = [...posts]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 6)

    const maxPlatformTotal = Math.max(1, ...Object.values(byPlatform).map((p) => p.total))

    return { byPostStatus, byPlatform, successRate, recent, maxPlatformTotal, totalPosts: posts.length }
  }, [posts])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading analytics…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">
        Couldn&apos;t load analytics: {error.message}
      </div>
    )
  }

  if (stats.totalPosts === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-800 py-20 text-center">
        <FileText className="w-8 h-8 text-gray-600 mb-3" />
        <p className="text-sm font-medium text-gray-300">No activity yet</p>
        <p className="text-xs text-gray-500 mt-1 max-w-xs">
          Once you create posts, activity and platform breakdowns will show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Info banner — sets expectations, this is internal activity, not FB/IG insights */}
      <div className="flex items-start gap-2.5 rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3 text-xs text-gray-400">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-gray-500" />
        <p>
          This shows activity from posts you&apos;ve created in SocialStudio (counts, status, success rate).
          It does not yet include real engagement data (views, likes, reach) from Facebook, Instagram, or TikTok.
        </p>
      </div>

      {/* Status cards */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-3">Posts by status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.keys(STATUS_CARD_META) as PostStatus[]).map((status) => (
            <StatCard
              key={status}
              label={STATUS_CARD_META[status].label}
              value={stats.byPostStatus[status]}
              icon={STATUS_CARD_META[status].icon}
              color={STATUS_CARD_META[status].color}
            />
          ))}
        </div>
      </section>

      {/* Success rate + platform breakdown */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Publish success rate</h2>
          {stats.successRate === null ? (
            <p className="text-sm text-gray-500">No published or failed posts yet.</p>
          ) : (
            <>
              <p className="text-3xl font-bold text-white">{stats.successRate}%</p>
              <p className="text-xs text-gray-500 mt-1">
                Based on posts that finished processing (published or failed)
              </p>
            </>
          )}
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white mb-1">Posts by platform</h2>
          {(Object.keys(PLATFORM_LABEL) as Platform[]).map((platform) => (
            <Bar
              key={platform}
              label={PLATFORM_LABEL[platform]}
              value={stats.byPlatform[platform].total}
              max={stats.maxPlatformTotal}
              color="bg-[#C9A84C]"
            />
          ))}
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-3">Recent activity</h2>
        <div className="space-y-2">
          {stats.recent.map((post) => {
            const meta = STATUS_CARD_META[post.status]
            return (
              <div
                key={post.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {post.title || post.caption || 'Untitled post'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {post.platforms.map((p) => PLATFORM_LABEL[p]).join(', ') || 'No platforms'}
                  </p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-medium ${meta.color}`}>
                  {meta.icon}
                  {meta.label}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
