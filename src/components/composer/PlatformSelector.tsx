'use client'

import { Check } from 'lucide-react'
import type { Platform } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatformSelectorProps {
  selectedPlatforms: Platform[]
  onChange: (platforms: Platform[]) => void
  connectedPlatforms?: Platform[]
}

// ---------------------------------------------------------------------------
// Platform metadata
// ---------------------------------------------------------------------------

interface PlatformMeta {
  id: Platform
  name: string
  tagline: string
  /** Tailwind border color class when selected */
  borderColor: string
  /** Tailwind ring color class when selected */
  ringColor: string
  /** Tailwind text color for the name */
  nameColor: string
  /** Tailwind bg for badge */
  badgeBg: string
  /** Tailwind text for badge */
  badgeText: string
  icon: React.ReactNode
}

// Inline SVG icons for each platform
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  )
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  )
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

const PLATFORMS: PlatformMeta[] = [
  {
    id: 'facebook',
    name: 'Facebook',
    tagline: 'Reach your audience',
    borderColor: 'border-blue-600',
    ringColor: 'ring-blue-600',
    nameColor: 'text-blue-400',
    badgeBg: 'bg-blue-600/20',
    badgeText: 'text-blue-300',
    icon: <FacebookIcon className="w-7 h-7 text-blue-400" />,
  },
  {
    id: 'instagram',
    name: 'Instagram',
    tagline: 'Share visual stories',
    borderColor: 'border-pink-500',
    ringColor: 'ring-pink-500',
    nameColor: 'text-pink-400',
    badgeBg: 'bg-pink-600/20',
    badgeText: 'text-pink-300',
    icon: (
      <span
        className="w-7 h-7 flex items-center justify-center rounded-lg"
        style={{
          background:
            'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
        }}
      >
        <InstagramIcon className="w-4 h-4 text-white" />
      </span>
    ),
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    tagline: 'Go viral with video',
    borderColor: 'border-white',
    ringColor: 'ring-white',
    nameColor: 'text-white',
    badgeBg: 'bg-white/10',
    badgeText: 'text-gray-200',
    icon: <TikTokIcon className="w-7 h-7 text-white" />,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    tagline: 'Grow professionally',
    borderColor: 'border-sky-500',
    ringColor: 'ring-sky-500',
    nameColor: 'text-sky-400',
    badgeBg: 'bg-sky-600/20',
    badgeText: 'text-sky-300',
    icon: <LinkedInIcon className="w-7 h-7 text-sky-400" />,
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlatformSelector({
  selectedPlatforms,
  onChange,
  connectedPlatforms = [],
}: PlatformSelectorProps) {
  function toggle(platform: Platform) {
    if (selectedPlatforms.includes(platform)) {
      onChange(selectedPlatforms.filter((p) => p !== platform))
    } else {
      onChange([...selectedPlatforms, platform])
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[#E5E5E5]">
        Target Platforms
      </label>

      <div className="grid grid-cols-2 gap-3">
        {PLATFORMS.map((platform) => {
          const isSelected = selectedPlatforms.includes(platform.id)

          const isConnected = connectedPlatforms.includes(platform.id)

          return (
            <button
              key={platform.id}
              type="button"
              onClick={() => toggle(platform.id)}
              aria-pressed={isSelected}
              className={[
                'relative flex items-center gap-3 rounded-xl border p-3.5',
                'text-left transition-all duration-150 focus-visible:outline-none',
                'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                isSelected
                  ? `${platform.borderColor} bg-[#111111] ${platform.ringColor} ring-1`
                  : 'border-[#1A1A1A] bg-[#0D0D0D] hover:border-[#C9A84C]/30 hover:bg-[#111111]',
              ].join(' ')}
            >
              {/* Platform icon */}
              <div className="shrink-0">{platform.icon}</div>

              {/* Name + tagline */}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${platform.nameColor}`}>
                  {platform.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-[#A0A0A0]">
                  {platform.tagline}
                </p>
              </div>

              {/* Selected checkmark */}
              {isSelected && (
                <span
                  className={[
                    'absolute right-2.5 top-2.5 flex h-5 w-5 shrink-0 items-center',
                    'justify-center rounded-full',
                    platform.badgeBg,
                  ].join(' ')}
                >
                  <Check
                    className={`h-3 w-3 ${platform.badgeText}`}
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                </span>
              )}

              {/* Connection status badge (bottom-right) */}
              {isConnected && (
                <span
                  className={[
                    'absolute bottom-2.5 right-2.5 rounded-full px-1.5 py-0.5',
                    'text-[10px] font-medium leading-none',
                    isSelected ? platform.badgeBg : 'bg-[#1A1A1A]',
                    isSelected ? platform.badgeText : 'text-[#A0A0A0]',
                  ].join(' ')}
                >
                  Connected
                </span>
              )}
            </button>
          )
        })}
      </div>

      {selectedPlatforms.length === 0 && (
        <p className="text-xs text-amber-400">
          Select at least one platform to publish.
        </p>
      )}

      {selectedPlatforms.length > 0 && (
        <p className="text-xs text-[#A0A0A0]">
          {selectedPlatforms.length} platform
          {selectedPlatforms.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  )
}
