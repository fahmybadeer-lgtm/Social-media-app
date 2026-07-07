'use client';

import React, { useCallback, useRef, useState } from 'react';
import { CloudUpload, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface LogoUploadZoneProps {
  logoUrl: string | null;
  /** Called after a successful upload or removal with the new logo URL (or null). */
  onChanged: (newLogoUrl: string | null) => void;
}

export function LogoUploadZone({ logoUrl, onChanged }: LogoUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Please upload a PNG or JPG image.');
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError('Logo file must be 5MB or smaller.');
        return;
      }

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/settings/logo', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error ?? 'Upload failed. Try again.');
          return;
        }
        onChanged(data.logo_url ?? null);
      } catch {
        setError('Upload failed. Try again.');
      } finally {
        setIsUploading(false);
      }
    },
    [onChanged]
  );

  const handleRemove = useCallback(async () => {
    setError(null);
    setIsRemoving(true);
    try {
      const res = await fetch('/api/settings/logo', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to remove logo.');
        return;
      }
      onChanged(null);
    } catch {
      setError('Failed to remove logo.');
    } finally {
      setIsRemoving(false);
    }
  }, [onChanged]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      e.target.value = '';
    },
    [uploadFile]
  );

  const busy = isUploading || isRemoving;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-white">Shop Logo</p>
          <p className="text-xs text-gray-500 mt-0.5">Shown in the sidebar across the whole app.</p>
        </div>
        {logoUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {isRemoving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            Remove
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={handleInputChange}
        aria-label="Logo file picker"
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload shop logo – drag file here or click to browse"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !busy) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          'relative flex flex-col items-center justify-center gap-3',
          'rounded-xl border-2 border-dashed py-8 px-6 cursor-pointer',
          'transition-colors duration-200 select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950',
          isDragOver
            ? 'border-[#C9A84C] bg-[#C9A84C]/5'
            : 'border-gray-700 bg-gray-900/50 hover:border-gray-600 hover:bg-gray-900',
          busy && 'pointer-events-none opacity-60'
        )}
      >
        {logoUrl ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-20 w-20 rounded-lg bg-gray-800 flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="Current shop logo" className="h-full w-full object-contain" />
            </div>
            <p className="text-xs text-gray-500">
              {isUploading ? 'Uploading new logo…' : 'Click or drop a new image to replace'}
            </p>
          </div>
        ) : (
          <>
            <div
              className={cn(
                'flex items-center justify-center w-14 h-14 rounded-full transition-colors duration-200',
                isDragOver ? 'bg-[#C9A84C]/20' : 'bg-gray-800'
              )}
            >
              {isUploading ? (
                <Loader2 className="w-7 h-7 text-[#C9A84C] animate-spin" />
              ) : (
                <CloudUpload
                  className={cn(
                    'w-7 h-7 transition-colors duration-200',
                    isDragOver ? 'text-[#C9A84C]' : 'text-gray-400'
                  )}
                />
              )}
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-sm font-medium text-white">
                {isDragOver ? 'Drop to upload' : isUploading ? 'Uploading…' : 'Drag your logo here or click to browse'}
              </p>
              <p className="text-xs text-gray-500">PNG or JPG &bull; Up to 5MB</p>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-red-400 mt-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export default LogoUploadZone;
