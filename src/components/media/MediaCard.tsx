'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Eye, Pencil, Trash2, Play, Check, X, AlertTriangle } from 'lucide-react';
import { cn, formatFileSize, formatDuration } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import type { MediaFile } from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MediaCardProps {
  media: MediaFile;
  isSelected: boolean;
  /** Any card is currently selected (controls checkbox visibility) */
  anySelected?: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onPreview: (media: MediaFile) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function humanMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'JPEG',
    'image/jpg': 'JPEG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'image/webp': 'WebP',
    'image/svg+xml': 'SVG',
    'video/mp4': 'MP4',
    'video/mov': 'MOV',
    'video/quicktime': 'MOV',
    'video/webm': 'WebM',
    'video/avi': 'AVI',
    'video/x-msvideo': 'AVI',
  };
  return map[mime.toLowerCase()] ?? mime.split('/')[1]?.toUpperCase() ?? 'FILE';
}

// ---------------------------------------------------------------------------
// Delete confirmation popover (inline)
// ---------------------------------------------------------------------------

interface DeleteConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirm({ onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                 bg-[#111111] border border-red-500/30 rounded-xl shadow-xl
                 p-3 w-48 text-center"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm deletion"
    >
      {/* Arrow */}
      <div
        className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0
                   border-x-[6px] border-x-transparent
                   border-t-[6px] border-t-[#111111]"
        aria-hidden="true"
      />

      <div className="flex items-center justify-center gap-1.5 mb-2">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        <p className="text-xs font-medium text-white">Delete this file?</p>
      </div>
      <p className="text-xs text-[#A0A0A0] mb-3">This cannot be undone.</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-7 text-xs rounded-lg bg-[#1A1A1A] text-[#A0A0A0]
                     hover:bg-[#0D0D0D] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 h-7 text-xs rounded-lg bg-red-600 text-white
                     hover:bg-red-500 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MediaCard
// ---------------------------------------------------------------------------

export function MediaCard({
  media,
  isSelected,
  anySelected = false,
  onSelect,
  onDelete,
  onRename,
  onPreview,
}: MediaCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(media.original_name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const editInputRef = useRef<HTMLInputElement>(null);

  // Whether to show the checkbox (always when any card is selected, on hover otherwise)
  const showCheckbox = isSelected || anySelected || isHovered;

  // ── Rename helpers ────────────────────────────────────────────────────────

  const startEditing = useCallback(() => {
    setEditValue(media.original_name);
    setIsEditing(true);
    // Focus is handled via useEffect below
  }, [media.original_name]);

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== media.original_name) {
      onRename(media.id, trimmed);
    }
    setIsEditing(false);
  }, [editValue, media.id, media.original_name, onRename]);

  const cancelRename = useCallback(() => {
    setEditValue(media.original_name);
    setIsEditing(false);
  }, [media.original_name]);

  // Auto-focus the input when editing starts
  React.useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [isEditing]);

  // Close delete confirm when clicking outside
  React.useEffect(() => {
    if (!showDeleteConfirm) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-delete-confirm]')) {
        setShowDeleteConfirm(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDeleteConfirm]);

  // ── Thumbnail / preview ───────────────────────────────────────────────────

  const thumbSrc = media.thumbnail_url ?? (media.file_type === 'image' ? media.file_url : null);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-xl overflow-hidden',
        'bg-[#111111] border transition-all duration-200',
        isSelected
          ? 'border-[#C9A84C] ring-2 ring-[#C9A84C]/30'
          : 'border-[#1A1A1A] hover:border-[#C9A84C]/40'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (!showDeleteConfirm) setShowDeleteConfirm(false);
      }}
    >
      {/* ── Thumbnail area ──────────────────────────────────────────────── */}
      <div className="relative aspect-square bg-[#0D0D0D] overflow-hidden">
        {thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbSrc}
            alt={media.original_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          /* Fallback for unprocessed video / no thumbnail */
          <div className="w-full h-full flex items-center justify-center bg-[#0D0D0D]">
            <Play className="w-10 h-10 text-[#A0A0A0]" />
          </div>
        )}

        {/* Video play icon overlay */}
        {media.file_type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
              <Play className="w-5 h-5 text-white ml-0.5" />
            </div>
          </div>
        )}

        {/* Hover action overlay */}
        <div
          className={cn(
            'absolute inset-0 bg-black/50 flex items-center justify-center gap-2',
            'transition-opacity duration-200',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
          aria-hidden={!isHovered}
        >
          {/* Preview */}
          <button
            type="button"
            onClick={() => onPreview(media)}
            aria-label={`Preview ${media.original_name}`}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/80
                       text-white hover:bg-[#C9A84C] hover:text-black transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Rename */}
          <button
            type="button"
            onClick={startEditing}
            aria-label={`Rename ${media.original_name}`}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/80
                       text-white hover:bg-[#C9A84C] hover:text-black transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>

          {/* Delete */}
          <div className="relative" data-delete-confirm>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm((v) => !v)}
              aria-label={`Delete ${media.original_name}`}
              aria-expanded={showDeleteConfirm}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/80
                         text-white hover:bg-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {showDeleteConfirm && (
              <DeleteConfirm
                onConfirm={() => {
                  setShowDeleteConfirm(false);
                  onDelete(media.id);
                }}
                onCancel={() => setShowDeleteConfirm(false)}
              />
            )}
          </div>
        </div>

        {/* Checkbox – top-left */}
        <div
          className={cn(
            'absolute top-2 left-2 z-10 transition-opacity duration-150',
            showCheckbox ? 'opacity-100' : 'opacity-0'
          )}
        >
          <button
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            aria-label={`Select ${media.original_name}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(media.id);
            }}
            className={cn(
              'w-5 h-5 rounded-md border-2 flex items-center justify-center',
              'transition-colors duration-150',
              isSelected
                ? 'bg-[#C9A84C] border-[#C9A84C]'
                : 'bg-black/80 border-[#A0A0A0] hover:border-[#C9A84C]'
            )}
          >
            {isSelected && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
          </button>
        </div>

        {/* File type badge – top-right */}
        <div className="absolute top-2 right-2 z-10">
          <Badge variant="default" size="sm">
            {humanMime(media.mime_type)}
          </Badge>
        </div>
      </div>

      {/* ── Metadata area ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 p-3">
        {/* Name – inline edit */}
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              ref={editInputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') cancelRename();
              }}
              onBlur={commitRename}
              className="flex-1 min-w-0 bg-[#0D0D0D] border border-[#C9A84C] rounded-md
                         px-2 py-0.5 text-sm text-white focus:outline-none
                         focus:ring-1 focus:ring-[#C9A84C]"
              aria-label="Rename file"
            />
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); commitRename(); }}
              aria-label="Confirm rename"
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded
                         text-[#C9A84C] hover:bg-[#1A1A1A] transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); cancelRename(); }}
              aria-label="Cancel rename"
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded
                         text-[#A0A0A0] hover:bg-[#1A1A1A] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <p
            className="text-sm font-medium text-white truncate leading-tight cursor-default"
            title={media.original_name}
            onDoubleClick={startEditing}
          >
            {media.original_name}
          </p>
        )}

        {/* Size + duration */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#A0A0A0]">{formatFileSize(media.file_size)}</span>
          {media.file_type === 'video' && media.duration_seconds != null && (
            <>
              <span className="text-[#1A1A1A] text-xs">·</span>
              <span className="text-xs text-[#A0A0A0]">
                {formatDuration(media.duration_seconds)}
              </span>
            </>
          )}
          {/* Dimensions for images */}
          {media.file_type === 'image' && media.width && media.height && (
            <>
              <span className="text-[#1A1A1A] text-xs">·</span>
              <span className="text-xs text-[#A0A0A0]">
                {media.width}×{media.height}
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export default MediaCard;
