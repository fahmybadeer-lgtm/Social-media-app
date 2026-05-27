'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  CloudUpload,
  Trash2,
  LayoutGrid,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { UploadZone, type UploadProgressItem } from '@/components/media/UploadZone';
import { MediaCard } from '@/components/media/MediaCard';
import { MediaPreviewModal } from '@/components/media/MediaPreviewModal';
import { useMediaLibrary, type MediaItem } from '@/hooks/useMediaLibrary';
import type { MediaFile } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaLibraryGridProps {
  /** Provided for type safety; all queries are handled via useMediaLibrary. */
  userId: string;
}

type FilterTab = 'all' | 'images' | 'videos';
type SortOption = 'newest' | 'oldest' | 'name';

// ---------------------------------------------------------------------------
// Adapters: MediaItem (hook) ↔ MediaFile (components/types)
// ---------------------------------------------------------------------------

function toMediaFile(item: MediaItem): MediaFile {
  return {
    id: item.id,
    user_id: item.user_id,
    file_name: item.file_name,
    original_name: item.original_name,
    file_path: item.file_path,
    file_url: item.file_url,
    file_type: item.file_type,
    mime_type: item.mime_type,
    file_size: item.file_size,
    width: item.width,
    height: item.height,
    duration_seconds: item.duration_seconds,
    storage_bucket: item.storage_bucket,
    thumbnail_url: item.thumbnail_url,
    tags: item.tags,
    is_processed: item.is_processed,
    metadata: item.metadata,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden bg-gray-900 border border-gray-800 animate-pulse">
      {/* Thumbnail placeholder */}
      <div className="aspect-square bg-gray-800" />
      {/* Text placeholder */}
      <div className="p-3 flex flex-col gap-2">
        <div className="h-3.5 bg-gray-800 rounded w-3/4" />
        <div className="h-3 bg-gray-800 rounded w-1/2" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  filter: FilterTab;
}

function EmptyState({ filter }: EmptyStateProps) {
  const messages: Record<FilterTab, { title: string; sub: string }> = {
    all: {
      title: 'No files yet',
      sub: 'Upload images or videos using the zone above to get started.',
    },
    images: {
      title: 'No images found',
      sub: "You haven't uploaded any images yet.",
    },
    videos: {
      title: 'No videos found',
      sub: "You haven't uploaded any videos yet.",
    },
  };

  const { title, sub } = messages[filter];

  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center">
        <LayoutGrid className="w-8 h-8 text-gray-600" />
      </div>
      <div>
        <p className="text-base font-medium text-white">{title}</p>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">{sub}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter tab button
// ---------------------------------------------------------------------------

interface TabButtonProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}

function TabButton({ label, count, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium',
        'transition-colors duration-150',
        active
          ? 'bg-indigo-600 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn(
            'text-xs rounded-full px-1.5 py-0.5 leading-none font-medium',
            active ? 'bg-indigo-500/60 text-indigo-100' : 'bg-gray-700 text-gray-400'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MediaLibraryGrid({ userId: _userId }: MediaLibraryGridProps) {
  const { media, loading, error, refetch, deleteMedia, renameMedia } = useMediaLibrary();

  // ── Upload state ──────────────────────────────────────────────────────────
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Filters / sort ────────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  // ── Preview modal ─────────────────────────────────────────────────────────
  const [previewMedia, setPreviewMedia] = useState<MediaFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // ── Bulk delete state ─────────────────────────────────────────────────────
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  // ── Derived data ──────────────────────────────────────────────────────────

  const filteredAndSorted = useMemo(() => {
    let items = [...media];

    // Filter
    if (activeFilter === 'images') items = items.filter((m) => m.file_type === 'image');
    if (activeFilter === 'videos') items = items.filter((m) => m.file_type === 'video');

    // Sort
    items.sort((a, b) => {
      if (sortOption === 'newest')
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortOption === 'oldest')
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortOption === 'name')
        return a.original_name.localeCompare(b.original_name);
      return 0;
    });

    return items;
  }, [media, activeFilter, sortOption]);

  const imageCount = useMemo(() => media.filter((m) => m.file_type === 'image').length, [media]);
  const videoCount = useMemo(() => media.filter((m) => m.file_type === 'video').length, [media]);

  // ── Selection handlers ────────────────────────────────────────────────────

  const handleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredAndSorted.map((m) => m.id)));
  }, [filteredAndSorted]);

  // ── Upload handlers ───────────────────────────────────────────────────────

  const handleFilesSelected = useCallback((files: File[]) => {
    setQueuedFiles(files);
  }, []);

  const handleUpload = useCallback(async () => {
    if (queuedFiles.length === 0) return;
    setIsUploading(true);

    // Initialise progress state for each file
    setUploadProgress(
      queuedFiles.map((f) => ({ fileName: f.name, progress: 0, status: 'pending' }))
    );

    for (const file of queuedFiles) {
      // Mark as uploading
      setUploadProgress((prev) =>
        prev.map((p) =>
          p.fileName === file.name ? { ...p, status: 'uploading', progress: 0 } : p
        )
      );

      try {
        const formData = new FormData();
        formData.append('file', file);

        // Use XHR so we can track upload progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setUploadProgress((prev) =>
                prev.map((p) =>
                  p.fileName === file.name ? { ...p, progress: pct } : p
                )
              );
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              let errMsg = 'Upload failed';
              try {
                const body = JSON.parse(xhr.responseText) as { error?: string };
                if (body.error) errMsg = body.error;
              } catch { /* ignore */ }
              reject(new Error(errMsg));
            }
          });

          xhr.addEventListener('error', () => reject(new Error('Network error')));
          xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

          xhr.open('POST', '/api/media/upload');
          xhr.send(formData);
        });

        // Mark done
        setUploadProgress((prev) =>
          prev.map((p) =>
            p.fileName === file.name ? { ...p, status: 'done', progress: 100 } : p
          )
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setUploadProgress((prev) =>
          prev.map((p) =>
            p.fileName === file.name ? { ...p, status: 'error', error: msg } : p
          )
        );
      }
    }

    setIsUploading(false);
    // Refresh library to show newly uploaded files
    await refetch();
  }, [queuedFiles, refetch]);

  // ── Delete handlers ───────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteMedia(id);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } catch (err: unknown) {
        console.error('Delete failed:', err);
      }
    },
    [deleteMedia]
  );

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(
      `Delete ${selectedIds.size} selected ${selectedIds.size === 1 ? 'file' : 'files'}? This cannot be undone.`
    );
    if (!confirmed) return;

    setBulkDeleteError(null);
    setIsBulkDeleting(true);

    const ids = Array.from(selectedIds);
    const errors: string[] = [];

    for (const id of ids) {
      try {
        await deleteMedia(id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${id}: ${msg}`);
      }
    }

    setIsBulkDeleting(false);
    setSelectedIds(new Set());

    if (errors.length > 0) {
      setBulkDeleteError(`${errors.length} file(s) could not be deleted.`);
    }
  }, [selectedIds, deleteMedia]);

  // ── Rename handler ────────────────────────────────────────────────────────

  const handleRename = useCallback(
    async (id: string, newName: string) => {
      try {
        await renameMedia(id, newName);
      } catch (err: unknown) {
        console.error('Rename failed:', err);
      }
    },
    [renameMedia]
  );

  // ── Preview handlers ──────────────────────────────────────────────────────

  const handlePreview = useCallback((mf: MediaFile) => {
    setPreviewMedia(mf);
    setIsPreviewOpen(true);
  }, []);

  const handleUseInComposer = useCallback((mf: MediaFile) => {
    // Placeholder – parent page/router can intercept via deep link or state management
    console.info('[MediaLibraryGrid] Use in composer:', mf.id);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* ── Upload zone ─────────────────────────────────────────────────── */}
      <UploadZone
        onFilesSelected={handleFilesSelected}
        onUpload={handleUpload}
        uploadProgress={uploadProgress}
        isUploading={isUploading}
      />

      {/* ── Error banner ────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl
                        bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm flex-1">{error.message}</p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      {/* ── Bulk delete error ────────────────────────────────────────────── */}
      {bulkDeleteError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl
                        bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm flex-1">{bulkDeleteError}</p>
          <button
            type="button"
            onClick={() => setBulkDeleteError(null)}
            className="text-xs text-red-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Toolbar: filters + sort ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-900 border border-gray-800 w-fit">
          <TabButton
            label="All"
            count={media.length}
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <TabButton
            label="Images"
            count={imageCount}
            active={activeFilter === 'images'}
            onClick={() => setActiveFilter('images')}
          />
          <TabButton
            label="Videos"
            count={videoCount}
            active={activeFilter === 'videos'}
            onClick={() => setActiveFilter('videos')}
          />
        </div>

        {/* Sort select */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="media-sort"
            className="text-xs text-gray-500 shrink-0"
          >
            Sort:
          </label>
          <select
            id="media-sort"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="h-8 rounded-lg px-2 pr-7 text-sm bg-gray-900 border border-gray-800
                       text-white focus:outline-none focus:ring-1 focus:ring-indigo-500
                       cursor-pointer appearance-none"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* ── Bulk actions bar ─────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-3
                     rounded-xl bg-indigo-600/10 border border-indigo-500/30"
        >
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-indigo-300">
              {selectedIds.size} {selectedIds.size === 1 ? 'file' : 'files'} selected
            </p>
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-indigo-400 hover:text-white transition-colors underline"
            >
              Select all {filteredAndSorted.length}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Clear
            </button>
            <Button
              variant="danger"
              size="sm"
              loading={isBulkDeleting}
              leftIcon={!isBulkDeleting ? <Trash2 className="w-3.5 h-3.5" /> : undefined}
              onClick={() => void handleBulkDelete()}
            >
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      {loading ? (
        /* Skeleton state */
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4"
          aria-label="Loading media library"
          aria-busy="true"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div
          className={cn(
            'grid gap-4',
            filteredAndSorted.length === 0
              ? 'grid-cols-1'
              : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5'
          )}
          role="list"
          aria-label="Media library"
        >
          {filteredAndSorted.length === 0 ? (
            <EmptyState filter={activeFilter} />
          ) : (
            filteredAndSorted.map((item) => (
              <div key={item.id} role="listitem">
                <MediaCard
                  media={toMediaFile(item)}
                  isSelected={selectedIds.has(item.id)}
                  anySelected={selectedIds.size > 0}
                  onSelect={handleSelect}
                  onDelete={(id) => void handleDelete(id)}
                  onRename={(id, name) => void handleRename(id, name)}
                  onPreview={handlePreview}
                />
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Upload prompt below empty grid ──────────────────────────────── */}
      {!loading && filteredAndSorted.length === 0 && activeFilter === 'all' && (
        <div className="flex justify-center pt-2">
          <Button
            variant="primary"
            size="md"
            leftIcon={<CloudUpload className="w-4 h-4" />}
            onClick={() => {
              // Scroll up to the upload zone
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Upload Your First File
          </Button>
        </div>
      )}

      {/* ── Preview modal ─────────────────────────────────────────────────── */}
      <MediaPreviewModal
        media={previewMedia}
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewMedia(null);
        }}
        onUseInComposer={handleUseInComposer}
      />
    </div>
  );
}

export default MediaLibraryGrid;
