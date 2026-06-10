'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, Loader2, RefreshCw, Check, AlertCircle, Pencil, X } from 'lucide-react'
import type { Platform, MediaFile } from '@/types'

interface AICaptionGeneratorProps {
  onCaptionGenerated: (caption: string) => void
  platforms: Platform[]
  selectedMedia?: MediaFile | null
}

type GenerateState = 'idle' | 'loading' | 'success' | 'error'

export default function AICaptionGenerator({
  onCaptionGenerated,
  platforms,
  selectedMedia,
}: AICaptionGeneratorProps) {
  const [generatedCaption, setGeneratedCaption] = useState('')
  const [editedCaption, setEditedCaption] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [extraContext, setExtraContext] = useState('')
  const [showContext, setShowContext] = useState(false)
  const [state, setState] = useState<GenerateState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [accepted, setAccepted] = useState(false)

  const prevMediaId = useRef<string | null>(null)

  // Auto-generate when a new image is selected
  useEffect(() => {
    const currentId = selectedMedia?.id ?? null
    if (currentId && currentId !== prevMediaId.current) {
      prevMediaId.current = currentId
      if (platforms.length > 0) {
        generate(false)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMedia?.id])

  async function generate(isRegenerate = false) {
    if (!selectedMedia && !extraContext.trim()) return
    if (platforms.length === 0) {
      setState('error')
      setErrorMessage('Select at least one platform before generating.')
      return
    }

    setState('loading')
    setErrorMessage('')
    setAccepted(false)
    setIsEditing(false)

    try {
      const body: Record<string, unknown> = { platforms }

      if (selectedMedia?.file_url && selectedMedia.file_type === 'image') {
        body.mediaUrl = selectedMedia.file_url
        body.mediaType = 'image'
      }

      if (extraContext.trim()) body.rawConcept = extraContext.trim()
      if (isRegenerate && instructions.trim()) body.instructions = instructions.trim()

      const res = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const data = (await res.json()) as { caption: string }
      const caption = data.caption ?? ''
      setGeneratedCaption(caption)
      setEditedCaption(caption)
      setState('success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setErrorMessage(msg)
      setState('error')
    }
  }

  function handleUseCaption() {
    const finalCaption = isEditing ? editedCaption : generatedCaption
    onCaptionGenerated(finalCaption)
    setAccepted(true)
    setIsEditing(false)
  }

  function handleEdit() {
    setEditedCaption(generatedCaption)
    setIsEditing(true)
    setAccepted(false)
  }

  function handleCancelEdit() {
    setIsEditing(false)
    setEditedCaption(generatedCaption)
  }

  const canGenerate = (!!selectedMedia || extraContext.trim().length > 0) && platforms.length > 0

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/20">
          <Sparkles className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">AI Caption Generator</h3>
          <p className="text-xs text-gray-500">
            {selectedMedia ? 'Reads your image and writes a caption' : 'Upload an image to auto-generate a caption'}
          </p>
        </div>
      </div>

      {/* Status when no media and idle */}
      {!selectedMedia && state === 'idle' && (
        <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/50 px-3 py-4 text-center">
          <p className="text-xs text-gray-500">Select an image above and a caption will be generated automatically.</p>
          <button
            type="button"
            onClick={() => setShowContext(!showContext)}
            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {showContext ? 'Hide' : 'Or type a concept manually'}
          </button>
        </div>
      )}

      {/* Manual concept input */}
      {(showContext || (!selectedMedia && extraContext.length > 0)) && (
        <div className="space-y-1.5">
          <label htmlFor="extra-context" className="text-xs font-medium text-gray-400">
            Concept or context <span className="text-gray-600">(optional if image is selected)</span>
          </label>
          <textarea
            id="extra-context"
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            placeholder="e.g. Fresh fade special this weekend at CNB CUT…"
            rows={2}
            className="w-full resize-none rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none transition-colors"
          />
        </div>
      )}

      {/* Platform warning */}
      {platforms.length === 0 && (
        <p className="text-xs text-amber-400">Select at least one platform above to generate a caption.</p>
      )}

      {/* Manual generate button — only when no image */}
      {!selectedMedia && (
        <button
          type="button"
          onClick={() => generate(false)}
          disabled={!canGenerate || state === 'loading'}
          className={[
            'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
            !canGenerate || state === 'loading'
              ? 'cursor-not-allowed bg-gray-700 text-gray-400'
              : 'bg-indigo-600 text-white hover:bg-indigo-500',
          ].join(' ')}
        >
          {state === 'loading' ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
          ) : (
            <><Sparkles className="w-4 h-4" />Generate Caption</>
          )}
        </button>
      )}

      {/* Loading state for auto-generate */}
      {state === 'loading' && selectedMedia && (
        <div className="flex items-center gap-2.5 rounded-lg border border-indigo-500/20 bg-indigo-900/10 px-3 py-3">
          <Loader2 className="w-4 h-4 text-indigo-400 animate-spin flex-shrink-0" />
          <p className="text-xs text-indigo-300">Analyzing your image and writing a caption…</p>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300 flex-1">{errorMessage}</p>
          <button type="button" onClick={() => generate(false)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-300 hover:bg-red-800/40 transition-colors flex-shrink-0">
            <RefreshCw className="w-3 h-3" />Retry
          </button>
        </div>
      )}

      {/* Generated caption */}
      {state === 'success' && (
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
            {isEditing ? (
              <textarea
                value={editedCaption}
                onChange={(e) => setEditedCaption(e.target.value)}
                rows={4}
                autoFocus
                className="w-full resize-none bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
              />
            ) : (
              <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{generatedCaption}</p>
            )}
          </div>

          {/* Instructions for regeneration */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400">
              Instructions for regeneration <span className="text-gray-600">(optional)</span>
            </label>
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder='e.g. "make it funny", "more professional", "add hashtags"'
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUseCaption}
              disabled={accepted}
              className={[
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                accepted ? 'bg-green-700/40 text-green-300 cursor-default' : 'bg-indigo-600 text-white hover:bg-indigo-500',
              ].join(' ')}
            >
              <Check className="w-4 h-4" />
              {accepted ? 'Caption Applied' : 'Use This Caption'}
            </button>

            {isEditing ? (
              <>
                <button type="button" onClick={handleUseCaption}
                  className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-sm text-white hover:bg-green-600 transition-colors" title="Save edit">
                  <Check className="w-4 h-4" />
                </button>
                <button type="button" onClick={handleCancelEdit}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors" title="Cancel edit">
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button type="button" onClick={handleEdit}
                className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-400 hover:border-gray-600 hover:text-gray-200 transition-colors" title="Edit caption">
                <Pencil className="w-4 h-4" />
              </button>
            )}

            <button type="button" onClick={() => generate(true)} disabled={state === 'loading'}
              className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-400 hover:border-gray-600 hover:text-gray-200 transition-colors disabled:opacity-50" title="Regenerate">
              <RefreshCw className={`w-4 h-4 ${state === 'loading' ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
