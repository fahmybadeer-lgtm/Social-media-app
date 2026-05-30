'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  CloudUpload,
  X,
  FileImage,
  FileVideo,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { cn, formatFileSize } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadProgressItem {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

export interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  onUpload: () => void;
  uploadProgress: UploadProgressItem[];
  isUploading: boolean;
}

// ---------------------------------------------------------------------------
// Helper: file icon by MIME type
// ---------------------------------------------------------------------------

function FileTypeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith('video/')) {
    return <FileVideo className={cn('text-[#C9A84C]', className)} />;
  }
  return <FileImage className={cn('text-[#C9A84C]', className)} />;
}

// ---------------------------------------------------------------------------
// Sub-component: queued file row
// ---------------------------------------------------------------------------

interface QueuedFileRowProps {
  file: File;
  progressItem?: UploadProgressItem;
  onRemove: (name: string) => void;
  isUploading: boolean;
}

function QueuedFileRow({ file, progressItem, onRemove, isUploading }: QueuedFileRowProps) {
  const status = progressItem?.status ?? 'pending';
  const progress = progressItem?.progress ?? 0;

  return (
    <li className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg bg-[#111111] border border-[#1A1A1A]">
      {/* Top row */}
      <div className="flex items-center gap-2.5 min-w-0">
        <FileTypeIcon mimeType={file.type} className="w-4 h-4 shrink-0" />

        {/* File info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate leading-tight">{file.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{formatFileSize(file.size)}</p>
        </div>

        {/* Status icon / remove button */}
        <div className="shrink-0 flex items-center gap-1.5">
          {status === 'done' && (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-label="Upload complete" />
          )}
          {status === 'error' && (
            <AlertCircle className="w-4 h-4 text-red-400" aria-label="Upload error" />
          )}
          {status === 'uploading' && (
            <Loader2 className="w-4 h-4 text-[#C9A84C] animate-spin" aria-label="Uploading" />
          )}
          {!isUploading && status !== 'done' && (
            <button
              type="button"
              onClick={() => onRemove(file.name)}
              aria-label={`Remove ${file.name}`}
              className="p-0.5 rounded text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar (visible during upload) */}
      {(status === 'uploading' || status === 'done') && (
        <div className="w-full h-1 rounded-full bg-[#1A1A1A] overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              status === 'done' ? 'bg-emerald-500' : 'bg-[#C9A84C]'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Error message */}
      {status === 'error' && progressItem?.error && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {progressItem.error}
        </p>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const MAX_FILES = 30;

export function UploadZone({
  onFilesSelected,
  onUpload,
  uploadProgress,
  isUploading,
}: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [limitError, setLimitError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── File validation & merging ─────────────────────────────────────────────

  const addFiles = useCallback(
    (incoming: File[]) => {
      setLimitError(null);

      setQueuedFiles((prev) => {
        // De-duplicate by name
        const existingNames = new Set(prev.map((f) => f.name));
        const fresh = incoming.filter((f) => !existingNames.has(f.name));
        const merged = [...prev, ...fresh];

        if (merged.length > MAX_FILES) {
          setLimitError(`You can upload at most ${MAX_FILES} files at once.`);
          const trimmed = merged.slice(0, MAX_FILES);
          onFilesSelected(trimmed);
          return trimmed;
        }

        onFilesSelected(merged);
        return merged;
      });
    },
    [onFilesSelected]
  );

  const removeFile = useCallback((name: string) => {
    setQueuedFiles((prev) => {
      const next = prev.filter((f) => f.name !== name);
      return next;
    });
  }, []);

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only leave when exiting the zone entirely (not entering a child element)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const dropped = Array.from(e.dataTransfer.files).filter(
        (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
      );
      if (dropped.length > 0) addFiles(dropped);
    },
    [addFiles]
  );

  // ── Input change ──────────────────────────────────────────────────────────

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      if (selected.length > 0) addFiles(selected);
      // Reset so the same files can be re-selected if needed
      e.target.value = '';
    },
    [addFiles]
  );

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasFiles = queuedFiles.length > 0;
  const allDone =
    hasFiles &&
    uploadProgress.length > 0 &&
    uploadProgress.every((p) => p.status === 'done' || p.status === 'error');

  // Build a lookup map for quick access during render
  const progressMap = new Map(uploadProgress.map((p) => [p.fileName, p]));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleInputChange}
        aria-label="File picker"
      />

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload zone – drag files here or click to browse"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          'relative flex flex-col items-center justify-center gap-3',
          'rounded-xl border-2 border-dashed py-10 px-6 cursor-pointer',
          'transition-colors duration-200 select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2 focus-visible:ring-offset-black',
          isDragOver
            ? 'border-[#C9A84C] bg-[rgba(201,168,76,0.05)]'
            : 'border-[#1A1A1A] bg-[#111111] hover:border-[#C9A84C]/40 hover:bg-[#0D0D0D]',
          isUploading && 'pointer-events-none opacity-60'
        )}
      >
        {/* Icon */}
        <div
          className={cn(
            'flex items-center justify-center w-14 h-14 rounded-full',
            'transition-colors duration-200',
            isDragOver ? 'bg-[rgba(201,168,76,0.2)]' : 'bg-[#1A1A1A]'
          )}
        >
          <CloudUpload
            className={cn(
              'w-7 h-7 transition-colors duration-200',
              isDragOver ? 'text-[#C9A84C]' : 'text-[#A0A0A0]'
            )}
          />
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm font-medium text-white">
            {isDragOver ? 'Drop files to upload' : 'Drag files here or click to browse'}
          </p>
          <p className="text-xs text-[#A0A0A0]">
            Supports images and videos &bull; Up to {MAX_FILES} files
          </p>
        </div>
      </div>

      {/* Limit error */}
      {limitError && (
        <p className="flex items-center gap-1.5 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {limitError}
        </p>
      )}

      {/* Queued file list */}
      {hasFiles && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#E5E5E5]">
              {isUploading ? 'Uploading' : 'Ready to upload'}{' '}
              <span className="text-[#C9A84C]">{queuedFiles.length}</span>{' '}
              {queuedFiles.length === 1 ? 'file' : 'files'}
            </h3>
            {!isUploading && !allDone && (
              <button
                type="button"
                onClick={() => setQueuedFiles([])}
                className="text-xs text-[#A0A0A0] hover:text-white transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {queuedFiles.map((file) => (
              <QueuedFileRow
                key={file.name}
                file={file}
                progressItem={progressMap.get(file.name)}
                onRemove={removeFile}
                isUploading={isUploading}
              />
            ))}
          </ul>

          {/* Upload button */}
          {!allDone && (
            <Button
              variant="primary"
              size="md"
              loading={isUploading}
              disabled={isUploading || queuedFiles.length === 0}
              onClick={(e) => {
                e.stopPropagation();
                onUpload();
              }}
              leftIcon={!isUploading ? <CloudUpload className="w-4 h-4" /> : undefined}
              className="w-full sm:w-auto self-start"
            >
              {isUploading
                ? 'Uploading…'
                : `Upload ${queuedFiles.length} ${queuedFiles.length === 1 ? 'File' : 'Files'}`}
            </Button>
          )}

          {/* All done summary */}
          {allDone && (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                All files processed.{' '}
                <button
                  type="button"
                  onClick={() => setQueuedFiles([])}
                  className="underline hover:no-underline transition-all"
                >
                  Clear queue
                </button>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default UploadZone;
