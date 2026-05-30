'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Upload, Check, ImageIcon, Video, X } from 'lucide-react'
import type { MediaFile } from '@/types'

interface MediaSelectorProps {
  selectedMediaId: string | null
  onSelect: (mediaId: string | null) => void
  media: MediaFile[]
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function MediaThumbnail({
  item,
  isSelected,
  onSelect,
}: {
  item: MediaFile
  isSelected: boolean
  onSelect: () => void
}) {
  const thumbSrc = item.thumbnail_url ?? item.file_url

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'group relative aspect-square rounded-lg overflow-hidden border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900',
        isSelected
          ? 'border-[#C9A84C] ring-2 ring-[#C9A84C]/50'
          : 'border-transparent hover:border-[#C9A84C]/40',
      ].join(' ')}
      title={item.original_name}
    >
      {/* Thumbnail image */}
      {thumbSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbSrc}
          alt={item.original_name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-[#0D0D0D] flex items-center justify-center">
          {item.file_type === 'video' ? (
            <Video className="w-6 h-6 text-[#A0A0A0]" />
          ) : (
            <ImageIcon className="w-6 h-6 text-[#A0A0A0]" />
          )}
        </div>
      )}

      {/* Hover overlay */}
      <div
        className={[
          'absolute inset-0 transition-opacity duration-150',
          isSelected ? 'bg-[rgba(201,168,76,0.2)]' : 'bg-black/0 group-hover:bg-black/30',
        ].join(' ')}
      />

      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#C9A84C] flex items-center justify-center shadow">
          <Check className="w-3 h-3 text-black" strokeWidth={3} />
        </div>
      )}

      {/* Video badge */}
      {item.file_type === 'video' && (
        <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 flex items-center gap-0.5">
          <Video className="w-2.5 h-2.5 text-white" />
          {item.duration_seconds != null && (
            <span className="text-[9px] text-white">
              {Math.floor(item.duration_seconds / 60)}:{String(Math.floor(item.duration_seconds % 60)).padStart(2, '0')}
            </span>
          )}
        </div>
      )}
    </button>
  )
}

export default function MediaSelector({
  selectedMediaId,
  onSelect,
  media,
}: MediaSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all')

  const filtered = useMemo(() => {
    let result = media
    if (typeFilter !== 'all') {
      result = result.filter((m) => m.file_type === typeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (m) =>
          m.original_name.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    return result
  }, [media, typeFilter, searchQuery])

  const selectedItem = media.find((m) => m.id === selectedMediaId) ?? null

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-[#E5E5E5]">
          Browse Library
        </label>
        <Link
          href="/media-library"
          className="flex items-center gap-1.5 rounded-lg bg-[#C9A84C] px-3 py-1.5 text-xs font-medium text-black hover:bg-[#E8C96A] transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload New
        </Link>
      </div>

      {/* Selected item summary */}
      {selectedItem && (
        <div className="flex items-center gap-2 rounded-lg border border-[#C9A84C]/40 bg-[rgba(201,168,76,0.1)] px-3 py-2">
          {(selectedItem.thumbnail_url ?? selectedItem.file_url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedItem.thumbnail_url ?? selectedItem.file_url}
              alt={selectedItem.original_name}
              className="w-8 h-8 rounded object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded bg-[#1A1A1A] flex items-center justify-center flex-shrink-0">
              {selectedItem.file_type === 'video' ? (
                <Video className="w-4 h-4 text-[#A0A0A0]" />
              ) : (
                <ImageIcon className="w-4 h-4 text-[#A0A0A0]" />
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#C9A84C] truncate">
              {selectedItem.original_name}
            </p>
            <p className="text-[10px] text-[#A0A0A0]">
              {selectedItem.file_type} · {formatFileSize(selectedItem.file_size)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-[#A0A0A0] hover:text-white transition-colors flex-shrink-0"
            aria-label="Deselect media"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A0A0A0] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search media…"
            className="w-full rounded-lg border border-[#1A1A1A] bg-[#0D0D0D] pl-8 pr-3 py-2 text-sm text-white placeholder-[#A0A0A0] focus:border-[#C9A84C] focus:outline-none transition-colors"
          />
        </div>
        <div className="flex rounded-lg border border-[#1A1A1A] bg-[#0D0D0D] overflow-hidden text-xs">
          {(['all', 'image', 'video'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setTypeFilter(filter)}
              className={[
                'px-2.5 py-2 font-medium capitalize transition-colors',
                typeFilter === filter
                  ? 'bg-[#C9A84C] text-black'
                  : 'text-[#A0A0A0] hover:text-[#E5E5E5]',
              ].join(' ')}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="max-h-64 overflow-y-auto rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] p-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            {media.length === 0 ? (
              <>
                <ImageIcon className="w-10 h-10 text-[#A0A0A0] mb-3" />
                <p className="text-sm font-medium text-[#A0A0A0]">
                  No media in your library
                </p>
                <p className="text-xs text-[#A0A0A0]/60 mt-1 mb-4">
                  Upload images or videos to get started
                </p>
                <Link
                  href="/media-library"
                  className="flex items-center gap-1.5 rounded-lg bg-[#C9A84C] px-4 py-2 text-xs font-medium text-black hover:bg-[#E8C96A] transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Go to Media Library
                </Link>
              </>
            ) : (
              <>
                <Search className="w-8 h-8 text-[#A0A0A0] mb-2" />
                <p className="text-sm text-[#A0A0A0]">
                  No results for &ldquo;{searchQuery}&rdquo;
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {filtered.map((item) => (
              <MediaThumbnail
                key={item.id}
                item={item}
                isSelected={selectedMediaId === item.id}
                onSelect={() =>
                  onSelect(selectedMediaId === item.id ? null : item.id)
                }
              />
            ))}
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-[#A0A0A0]">
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
          {selectedMediaId ? ' · 1 selected' : ''}
        </p>
      )}
    </div>
  )
}
