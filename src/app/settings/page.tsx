import { redirect } from 'next/navigation'
import { Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSocialTokens } from '@/lib/oauth/tokens'
import AccountCard from './AccountCard'
import type { OAuthPlatform } from '@/lib/oauth/config'

// ---------------------------------------------------------------------------
// Platform metadata
// ---------------------------------------------------------------------------

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  )
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  )
}

interface PlatformDef {
  id: OAuthPlatform
  name: string
  icon: React.ReactNode
}

const PLATFORMS: PlatformDef[] = [
  {
    id: 'facebook',
    name: 'Facebook',
    icon: <FacebookIcon className="w-7 h-7 text-blue-400" />,
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: (
      <span
        className="w-7 h-7 flex items-center justify-center rounded-lg"
        style={{ background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)' }}
      >
        <InstagramIcon className="w-4 h-4 text-white" />
      </span>
    ),
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: <TikTokIcon className="w-7 h-7 text-white" />,
  },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const tokens = await getSocialTokens(supabase, user.id)

  const resolvedSearchParams = await searchParams
  const connectedParam = resolvedSearchParams['connected']
  const errorParam = resolvedSearchParams['error']

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-5 h-5 text-[#C9A84C]" />
            <h1 className="text-2xl font-bold text-white">Settings</h1>
          </div>
          <p className="text-sm text-[#A0A0A0]">Manage your social media account connections.</p>
        </div>

        {/* Status banners */}
        {connectedParam && typeof connectedParam === 'string' && (
          <div className="mb-6 rounded-xl border border-green-500/30 bg-green-900/20 px-4 py-3">
            <p className="text-sm text-green-400">
              Successfully connected{' '}
              <span className="font-semibold capitalize">{connectedParam}</span>.
            </p>
          </div>
        )}
        {errorParam && typeof errorParam === 'string' && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-3">
            <p className="text-sm text-red-400">
              {errorParam === 'oauth_denied'
                ? 'Authorization was denied. Please try again.'
                : errorParam === 'oauth_state_mismatch'
                ? 'Security check failed. Please try again.'
                : 'An error occurred during connection. Please try again.'}
            </p>
          </div>
        )}

        {/* Social connections section */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-[#E5E5E5]">Social Media Connections</h2>
          <div className="space-y-3">
            {PLATFORMS.map((p) => {
              const token = tokens.find((t) => t.platform === p.id)
              return (
                <AccountCard
                  key={p.id}
                  platform={p.id}
                  platformName={p.name}
                  icon={p.icon}
                  connectedUsername={token?.platform_username ?? null}
                  isActive={token?.is_active ?? false}
                />
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
