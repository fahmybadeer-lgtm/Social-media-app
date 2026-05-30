'use client'

import { useState, useRef, type KeyboardEvent } from 'react'
import { X, Hash } from 'lucide-react'

interface HashtagInputProps {
  hashtags: string[]
  onChange: (hashtags: string[]) => void
}

const MAX_HASHTAGS = 30

function sanitizeTag(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/^#+/, '')          // strip leading #
    .replace(/\s+/g, '_')        // spaces → underscores
    .replace(/[^a-z0-9_]/g, '')  // remove non-alphanumeric except underscore
}

export default function HashtagInput({ hashtags, onChange }: HashtagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(raw: string) {
    const tag = sanitizeTag(raw)
    if (!tag) return

    if (hashtags.includes(tag)) {
      setError(`#${tag} is already added`)
      return
    }

    if (hashtags.length >= MAX_HASHTAGS) {
      setError(`Maximum ${MAX_HASHTAGS} hashtags allowed`)
      return
    }

    setError(null)
    onChange([...hashtags, tag])
    setInputValue('')
  }

  function removeTag(tag: string) {
    setError(null)
    onChange(hashtags.filter((h) => h !== tag))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && inputValue === '' && hashtags.length > 0) {
      removeTag(hashtags[hashtags.length - 1])
    }
  }

  function handleBlur() {
    if (inputValue.trim()) {
      addTag(inputValue)
    }
  }

  const remaining = MAX_HASHTAGS - hashtags.length

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-[#E5E5E5]">
          Hashtags
        </label>
        <span
          className={[
            'text-xs tabular-nums',
            remaining <= 5 ? 'text-amber-400' : 'text-[#A0A0A0]',
          ].join(' ')}
        >
          {hashtags.length}/{MAX_HASHTAGS}
        </span>
      </div>

      {/* Input + chips container */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={[
          'min-h-[44px] flex flex-wrap gap-1.5 rounded-lg border bg-[#0D0D0D] px-3 py-2 cursor-text',
          'transition-colors duration-150',
          error
            ? 'border-red-500 focus-within:border-red-500'
            : 'border-[#1A1A1A] focus-within:border-[#C9A84C]',
        ].join(' ')}
      >
        {/* Existing tags */}
        {hashtags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-[rgba(201,168,76,0.15)] border border-[#C9A84C]/40 px-2.5 py-0.5 text-xs font-medium text-[#C9A84C]"
          >
            <Hash className="w-2.5 h-2.5 text-[#C9A84C]" />
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeTag(tag)
              }}
              className="ml-0.5 rounded-full hover:text-black hover:bg-[#C9A84C] transition-colors"
              aria-label={`Remove #${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Input */}
        {remaining > 0 && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setError(null)
              // If the user types a comma, split on it
              const val = e.target.value
              if (val.includes(',')) {
                const parts = val.split(',')
                parts.slice(0, -1).forEach((p) => addTag(p))
                setInputValue(parts[parts.length - 1])
              } else {
                setInputValue(val)
              }
            }}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={hashtags.length === 0 ? 'Add hashtag and press Enter…' : ''}
            className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder-[#A0A0A0] outline-none"
          />
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {/* Helper text */}
      {!error && (
        <p className="text-xs text-[#A0A0A0]">
          Press <kbd className="rounded bg-[#1A1A1A] px-1 py-0.5 text-[10px] text-[#E5E5E5]">Enter</kbd> or{' '}
          <kbd className="rounded bg-[#1A1A1A] px-1 py-0.5 text-[10px] text-[#E5E5E5]">,</kbd> to add.
          Tags are auto-formatted to lowercase.
        </p>
      )}
    </div>
  )
}
