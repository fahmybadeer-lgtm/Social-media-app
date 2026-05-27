'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  Download,
  PenSquare,
  FileImage,
  FileVideo,
  Calendar,
  Ruler,
  Clock,
  HardDrive,
} from 'lucide-react';
import { cn, formatFileSize, formatDuration } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { MediaFile } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaPreviewModalProps {
  media: MediaFile | null;
  isOpen: boolean;
  onClose: () => void;
  onUseInComposer: (media: MediaFile) => void;
}

// ---------------------------------------------------------------------------
// Metadata row helper
// ---------------------------------------------------------------------------

interface MetaRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function MetaRow({ icon, label, value }: MetaRowProps) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-800 last:border-0">
      <span className="shrink-0 w-4 h-4 text-gray-500">{icon}</span>
      <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
      <span className="text-sm text-white break-all">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date formatter (avoids date-fns just for this one usage)
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MediaPreviewModal({
  media,
  isOpen,
  onClose,
  onUseInComposer,
}: MediaPreviewModalProps) {
  // Guard – nothing to render without media
  if (!media) return null;

  const isVideo = media.file_type === 'video';
  const isImage = media.file_type === 'image';

  const hasDimensions = media.width && media.height;
  const hasDuration = isVideo && media.duration_seconds != null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm
                     data-[state=open]:animate-in data-[state=closed]:animate-out
                     data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
        />

        {/* Panel */}
        <Dialog.Content
          className={cn(
            'fixed z-50 inset-0 flex items-center justify-center p-4 sm:p-6',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95'
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div
            className="relative flex flex-col lg:flex-row w-full max-w-5xl
                       max-h-[90vh] overflow-hidden
                       bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl"
          >
            {/* ── Close button ──────────────────────────────────────────── */}
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close preview"
                className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center
                           rounded-full bg-gray-800/80 text-gray-400
                           hover:bg-gray-700 hover:text-white
                           transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>

            {/* ── Media preview pane ────────────────────────────────────── */}
            <div
              className="relative flex items-center justify-center
                         bg-gray-950 lg:flex-1 min-h-48 lg:min-h-0
                         overflow-hidden rounded-t-2xl lg:rounded-l-2xl lg:rounded-tr-none"
            >
              {isImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media.file_url}
                  alt={media.original_name}
                  className="max-w-full max-h-[55vh] lg:max-h-[85vh] object-contain"
                />
              )}

              {isVideo && (
                <video
                  src={media.file_url}
                  controls
                  poster={media.thumbnail_url ?? undefined}
                  className="max-w-full max-h-[55vh] lg:max-h-[85vh] object-contain"
                  aria-label={`Video: ${media.original_name}`}
                >
                  Your browser does not support the video tag.
                </video>
              )}

              {/* File type icon badge */}
              <div className="absolute top-3 left-3">
                {isImage ? (
                  <Badge variant="default" size="sm">
                    <FileImage className="w-3 h-3 mr-1 inline-block" />
                    Image
                  </Badge>
                ) : (
                  <Badge variant="default" size="sm">
                    <FileVideo className="w-3 h-3 mr-1 inline-block" />
                    Video
                  </Badge>
                )}
              </div>
            </div>

            {/* ── Sidebar: metadata + actions ───────────────────────────── */}
            <div
              className="flex flex-col w-full lg:w-80 xl:w-96 shrink-0
                         border-t border-gray-800 lg:border-t-0 lg:border-l
                         overflow-y-auto"
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-4 border-b border-gray-800">
                <Dialog.Title
                  className="text-base font-semibold text-white break-all leading-snug pr-8"
                >
                  {media.original_name}
                </Dialog.Title>
                <p className="text-xs text-gray-500 mt-1 font-mono">
                  {media.mime_type}
                </p>
              </div>

              {/* Metadata list */}
              <div className="px-5 py-3 flex-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Details
                </p>

                <MetaRow
                  icon={<HardDrive className="w-4 h-4" />}
                  label="File size"
                  value={formatFileSize(media.file_size)}
                />

                {hasDimensions && (
                  <MetaRow
                    icon={<Ruler className="w-4 h-4" />}
                    label="Dimensions"
                    value={`${media.width} × ${media.height} px`}
                  />
                )}

                {hasDuration && (
                  <MetaRow
                    icon={<Clock className="w-4 h-4" />}
                    label="Duration"
                    value={formatDuration(media.duration_seconds!)}
                  />
                )}

                <MetaRow
                  icon={<Calendar className="w-4 h-4" />}
                  label="Uploaded"
                  value={formatDate(media.created_at)}
                />

                {/* Tags */}
                {media.tags && media.tags.length > 0 && (
                  <div className="py-2.5 border-b border-gray-800">
                    <p className="text-xs text-gray-500 mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {media.tags.map((tag) => (
                        <Badge key={tag} variant="default" size="sm">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="px-5 pb-5 pt-3 flex flex-col gap-2 border-t border-gray-800">
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<PenSquare className="w-4 h-4" />}
                  onClick={() => {
                    onUseInComposer(media);
                    onClose();
                  }}
                  className="w-full"
                >
                  Use in Composer
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = media.file_url;
                    a.download = media.original_name;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    a.click();
                  }}
                  className="w-full"
                >
                  Download
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default MediaPreviewModal;
