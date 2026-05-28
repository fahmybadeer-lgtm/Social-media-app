'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OAuthPlatform } from '@/lib/oauth/config'

interface AccountCardProps {
  platform: OAuthPlatform
  platformName: string
  icon: React.ReactNode
  connectedUsername: string | null
  isActive: boolean
}

export default function AccountCard({
  platform,
  platformName,
  icon,
  connectedUsername,
  isActive,
}: AccountCardProps) {
  const router = useRouter()
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const isConnected = connectedUsername !== null && isActive

  async function handleDisconnect() {
    setIsDisconnecting(true)
    try {
      const res = await fetch(`/api/social/disconnect/${platform}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error('Failed to disconnect')
      }
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-4">
        <div className="shrink-0">{icon}</div>
        <div>
          <p className="text-sm font-semibold text-white">{platformName}</p>
          {isConnected ? (
            <p className="mt-0.5 text-xs text-gray-400">{connectedUsername}</p>
          ) : (
            <p className="mt-0.5 text-xs text-gray-500">Not connected</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isConnected && (
          <span className="rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-medium text-green-400">
            Connected
          </span>
        )}
        {isConnected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-red-500/50 hover:bg-red-900/20 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : (
          <a
            href={`/api/auth/${platform}`}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
          >
            Connect
          </a>
        )}
      </div>
    </div>
  )
}
