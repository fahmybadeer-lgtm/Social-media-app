'use client'

import { useState } from 'react'
import { Sparkles, Loader2, RefreshCw, Check, AlertCircle } from 'lucide-react'
import type { Platform } from '@/types'

interface AICaptionGeneratorProps {
  onCaptionGenerated: (caption: string) => void
  platforms: Platform[]
}

// Character limits per platform
const PLATFORM_LIMITS: Record<Platform, number> = {
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  facebook: 63206,
}

function getCharacterLimit(platforms: Platform[]): number {
  if (platforms.length === 0) return 2200
  return Math.min(...platforms.map((p) => PLATFORM_LIMITS[p]))
}

function getPlatformWarnings(caption: string, platforms: Platform[]): string[] {
  return platforms
    .filter((p) => caption.length > PLATFORM_LIMITS[p])
    .map(
      (p) =>
        `${p.charAt(0).toUpperCase() + p.slice(1)} limit is ${PLATFORM_LIMITS[p].toLocaleString()} characters`
    )
}

type GenerateState = 'idle' | 'loading' | 'success' | 'error'

export default function AICaptionGenerator({
  onCaptionGenerated,
  platforms,
}: AICaptionGeneratorProps) {
  const [rawConcept, setRawConcept] = useState('')
  const [generatedCaption, setGeneratedCaption] = useState('')
  const [state, setState] = useState<GenerateState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [accepted, setAccepted] = useState(false)

  const charLimit = getCharacterLimit(platforms)
  const captionLength = generatedCaption.length
  const warnings = getPlatformWarnings(generatedCaption, platforms)
  const overLimit = captionLength > charLimit

  async function generate() {
    if (!rawConcept.trim() || platforms.length === 0) return

    setState('loading')
    setErrorMessage('')
    setAccepted(false)

    try {
      const res = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawConcept: rawConcept.trim(), platforms }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const data = (await res.json()) as { caption: string }
      setGeneratedCaption(data.caption ?? '')
      setState('success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setErrorMessage(msg)
      setState('error')
    }
  }

  function handleUseCaption() {
    onCaptionGenerated(generatedCaption)
    setAccepted(true)
  }

  return (
    <div className="rounded-xl border border-[#1A1A1A] bg-[#0D0D0D] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(201,168,76,0.15)]">
          <Sparkles className="w-4 h-4 text-[#C9A84C]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">AI Caption Generator</h3>
          <p className="text-xs text-gray-500">Generate a caption from a concept</p>
        </div>
      </div>

      {/* Raw concept input */}
      <div className="space-y-1.5">
        <label htmlFor="raw-concept" className="text-xs font-medium text-[#A0A0A0]">
          Your idea or concept
        </label>
        <textarea
          id="raw-concept"
          value={rawConcept}
          onChange={(e) => setRawConcept(e.target.value)}
          placeholder="Describe your business, product, or idea in a few words…"
          rows={3}
          className="w-full resize-none rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2.5 text-sm text-white placeholder-[#A0A0A0] focus:border-[#C9A84C] focus:outline-none transition-colors"
        />
      </div>

      {/* Platform hint */}
      {platforms.length === 0 && (
        <p className="text-xs text-amber-400">
          Select at least one platform above before generating a caption.
        </p>
      )}

      {/* Generate button */}
      <button
        type="button"
        onClick={generate}
        disabled={!rawConcept.trim() || platforms.length === 0 || state === 'loading'}
        className={[
          'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2 focus-visible:ring-offset-black',
          !rawConcept.trim() || platforms.length === 0 || state === 'loading'
            ? 'cursor-not-allowed bg-[#1A1A1A] text-[#A0A0A0]'
            : 'bg-[#C9A84C] text-black hover:bg-[#E8C96A] active:bg-[#A07830]',
        ].join(' ')}
      >
        {state === 'loading' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate Caption
          </>
        )}
      </button>

      {/* Error state */}
      {state === 'error' && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-300">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={generate}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-300 hover:bg-red-800/40 transition-colors flex-shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}

      {/* Generated caption preview */}
      {state === 'success' && generatedCaption && (
        <div className="space-y-2.5">
          <div className="rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] p-3 space-y-2">
            {/* Caption text */}
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
              {generatedCaption}
            </p>

            {/* Character count bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500">Character count</span>
                <span
                  className={[
                    'text-[10px] tabular-nums font-medium',
                    overLimit ? 'text-red-400' : captionLength > charLimit * 0.9 ? 'text-amber-400' : 'text-gray-400',
                  ].join(' ')}
                >
                  {captionLength.toLocaleString()} / {charLimit.toLocaleString()}
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-[#1A1A1A] overflow-hidden">
                <div
                  className={[
                    'h-full rounded-full transition-all duration-300',
                    overLimit
                      ? 'bg-red-500'
                      : captionLength > charLimit * 0.9
                      ? 'bg-amber-500'
                      : 'bg-[#C9A84C]',
                  ].join(' ')}
                  style={{ width: `${Math.min(100, (captionLength / charLimit) * 100)}%` }}
                />
              </div>
            </div>

            {/* Platform-specific warnings */}
            {warnings.length > 0 && (
              <div className="space-y-1">
                {warnings.map((w) => (
                  <p key={w} className="flex items-center gap-1.5 text-[11px] text-amber-400">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Action row */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUseCaption}
              disabled={accepted}
              className={[
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                accepted
                  ? 'bg-green-700/40 text-green-300 cursor-default'
                  : 'bg-[#C9A84C] text-black hover:bg-[#E8C96A]',
              ].join(' ')}
            >
              {accepted ? (
                <>
                  <Check className="w-4 h-4" />
                  Caption Applied
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Use This Caption
                </>
              )}
            </button>
            <button
              type="button"
              onClick={generate}
              className="flex items-center gap-1.5 rounded-lg border border-[#1A1A1A] px-3 py-2 text-sm text-[#A0A0A0] hover:border-[#C9A84C]/40 hover:text-[#E5E5E5] transition-colors"
              title="Regenerate"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
