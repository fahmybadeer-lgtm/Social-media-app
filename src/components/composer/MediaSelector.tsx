'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Upload, Check, ImageIcon, Video, X } from 'lucide-react'
import type { MediaFile } from '@/types'

const MAX_IMAGES = 10

interface MediaSelectorProps {
  selectedMediaIds: string[]
  onSelect: (mediaIds: string[]) => void
  media: MediaFile[]
}

function MediaThumbnail({
  item,
  isSelected,
  order,
  onSelect,
}: {
  item: MediaFile
  isSelected: boolean
  order: number | null
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
          ? 'border-indigo-500 ring-2 ring-indigo-500/50'
          : 'border-transparent hover:border-gray-600',
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
        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
          {item.file_type === 'video' ? (
            <Video className="w-6 h-6 text-gray-500" />
          ) : (
            <ImageIcon className="w-6 h-6 text-gray-500" />
          )}
        </div>
      )}

      {/* Hover overlay */}
      <div
        className={[
          'absolute inset-0 transition-opacity duration-150',
          isSelected ? 'bg-indigo-600/20' : 'bg-black/0 group-hover:bg-black/30',
        ].join(' ')}
      />

      {/* Selected checkmark / order badge */}
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-indigo-600 flex items-center justify-center shadow">
          {order !== null && order > 0 ? (
            <span className="text-[10px] font-semibold text-white leading-none">
              {order}
            </span>
          ) : (
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          )}
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
  selectedMediaIds,
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

  const selectedItems = useMemo(
    () => selectedMediaIds.map((id) => media.find((m) => m.id === id)).filter(Boolean) as MediaFile[],
    [selectedMediaIds, media]
  )
  const hasVideoSelected = selectedItems.some((m) => m.file_type === 'video')

  function toggleSelect(item: MediaFile) {
    const alreadySelected = selectedMediaIds.includes(item.id)

    if (alreadySelected) {
      onSelect(selectedMediaIds.filter((id) => id !== item.id))
      return
    }

    if (item.file_type === 'video') {
      // Videos are single-select — picking one replaces the whole selection.
      onSelect([item.id])
      return
    }

    // Picking an image while a video is selected starts a fresh image selection.
    const base = hasVideoSelected ? [] : selectedMediaIds
    if (base.length >= MAX_IMAGES) return
    onSelect([...base, item.id])
  }

  function removeSelected(id: string) {
    onSelect(selectedMediaIds.filter((mid) => mid !== id))
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-300">
          Browse Library
        </label>
        <Link
          href="/media-library"
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload New
        </Link>
      </div>

      {/* Helper text */}
      <p className="text-[11px] text-gray-500">
        Select up to {MAX_IMAGES} photos for a multi-image post, or one video.
      </p>

      {/* Selected items summary */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-indigo-500/40 bg-indigo-600/10 p-2">
          {selectedItems.map((item, i) => (
            <div
              key={item.id}
              className="relative flex items-center gap-2 rounded-md bg-gray-900/60 pl-1.5 pr-2 py-1.5"
            >
              {(item.thumbnail_url ?? item.file_url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnail_url ?? item.file_url}
                  alt={item.original_name}
                  className="w-7 h-7 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded bg-gray-700 flex items-center justify-center flex-shrink-0">
                  {item.file_type === 'video' ? (
                    <Video className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
                  )}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-indigo-300 truncate max-w-[90px]">
                  {selectedItems.length > 1 ? `${i + 1}. ` : ''}
                  {item.original_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeSelected(item.id)}
                className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
                aria-label="Deselect media"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search media…"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex rounded-lg border border-gray-700 bg-gray-800 overflow-hidden text-xs">
          {(['all', 'image', 'video'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setTypeFilter(filter)}
              className={[
                'px-2.5 py-2 font-medium capitalize transition-colors',
                typeFilter === filter
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-gray-200',
              ].join(' ')}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
        {filtered.map((item) => {
          const idx = selectedMediaIds.indexOf(item.id)
          return (
            <MediaThumbnail
              key={item.id}
              item={item}
              isSelected={idx !== -1}
              order={selectedItems.length > 1 ? idx + 1 : null}
              onSelect={() => toggleSelect(item)}
            />
          )
        })}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-xs text-gray-500 py-6">
            No media found.
          </p>
        )}
      </div>
    </div>
  )
}
