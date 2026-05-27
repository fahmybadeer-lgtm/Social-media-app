'use client';

/**
 * VideoEditor
 *
 * A modal panel for trimming, cropping, and watermarking a video asset.
 * Submits a processing job via POST /api/process-video, then polls
 * GET /api/process-video/status/{jobId} every 2 seconds until the job
 * reaches a terminal state (completed | failed).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Loader2, CheckCircle, AlertCircle, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MediaFile, VideoProcessingParams } from '@/types';

// ---------------------------------------------------------------------------
// VideoJob (minimal shape needed by the component)
// ---------------------------------------------------------------------------

interface VideoJob {
  id: string;
  status: string;
  error_message?: string | null;
  output_path?: string | null;
  // The processed media record is embedded in the job metadata by the route
  metadata?: {
    processed_media_id?: string;
    output_url?: string;
    duration?: number;
    width?: number;
    height?: number;
    file_size?: number;
  } | null;
}

// ---------------------------------------------------------------------------
// AspectRatio card data
// ---------------------------------------------------------------------------

interface RatioOption {
  value: VideoProcessingParams['aspectRatio'];
  label: string;
  sublabel: string;
  /** CSS width:height expressed as a ratio for the preview rectangle. */
  previewStyle: React.CSSProperties;
}

const RATIO_OPTIONS: RatioOption[] = [
  {
    value: '9:16',
    label: '9:16',
    sublabel: 'Reels / TikTok',
    previewStyle: { width: 18, height: 32 },
  },
  {
    value: '4:5',
    label: '4:5',
    sublabel: 'Instagram',
    previewStyle: { width: 24, height: 30 },
  },
  {
    value: '1:1',
    label: '1:1',
    sublabel: 'Square',
    previewStyle: { width: 28, height: 28 },
  },
  {
    value: '16:9',
    label: '16:9',
    sublabel: 'Landscape',
    previewStyle: { width: 32, height: 18 },
  },
];

type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const WATERMARK_POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: 'top-left',     label: 'Top Left' },
  { value: 'top-right',    label: 'Top Right' },
  { value: 'bottom-left',  label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VideoEditorProps {
  media: MediaFile | null;
  onProcessed: (newMedia: MediaFile) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Section heading helper
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
      {children}
    </h3>
  );
}

// ---------------------------------------------------------------------------
// VideoEditor
// ---------------------------------------------------------------------------

export function VideoEditor({ media, onProcessed, onClose }: VideoEditorProps) {
  // ── Trim state ─────────────────────────────────────────────────────────────
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd]     = useState<number>(
    media?.duration_seconds ?? 0,
  );
  const [trimEnabled, setTrimEnabled] = useState(false);

  // ── Aspect ratio state ────────────────────────────────────────────────────
  const [selectedRatio, setSelectedRatio] = useState<
    VideoProcessingParams['aspectRatio'] | null
  >(null);

  // ── Watermark state ───────────────────────────────────────────────────────
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>('bottom-right');

  // ── Processing state ──────────────────────────────────────────────────────
  type ProcessingState = 'idle' | 'submitting' | 'polling' | 'completed' | 'failed';
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [statusMessage, setStatusMessage]     = useState<string>('');
  const [currentJobId, setCurrentJobId]       = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef        = useRef<HTMLVideoElement>(null);

  // ── Clean up polling on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // ── Sync trimEnd when media changes ───────────────────────────────────────
  useEffect(() => {
    if (media?.duration_seconds) {
      setTrimEnd(media.duration_seconds);
    }
  }, [media?.duration_seconds]);

  // ── Computed duration preview ─────────────────────────────────────────────
  const selectedDuration = trimEnabled
    ? Math.max(0, trimEnd - trimStart)
    : (media?.duration_seconds ?? 0);

  // ── Poll job status ────────────────────────────────────────────────────────
  const startPolling = useCallback((jobId: string) => {
    setCurrentJobId(jobId);
    setProcessingState('polling');
    setStatusMessage('Processing your video...');

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/process-video/status/${jobId}`);
        const data = (await res.json()) as { job?: VideoJob; error?: string };

        if (!res.ok || !data.job) {
          setProcessingState('failed');
          setStatusMessage(data.error ?? 'Failed to fetch job status.');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          return;
        }

        const job = data.job;

        if (job.status === 'completed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setProcessingState('completed');
          setStatusMessage('Your video has been processed successfully.');

          // Build a partial MediaFile from job metadata so the parent can
          // refresh without a separate fetch.  The parent should ideally
          // re-query /api/media to get the full record; we pass a minimal
          // representation here as a convenience.
          if (job.metadata?.processed_media_id && job.output_path) {
            const synthetic: MediaFile = {
              id:               job.metadata.processed_media_id,
              user_id:          media?.user_id ?? '',
              file_name:        job.output_path.split('/').pop() ?? job.output_path,
              original_name:    media?.original_name ?? '',
              file_path:        job.output_path,
              file_url:         job.metadata.output_url ?? '',
              file_type:        'video',
              mime_type:        'video/mp4',
              file_size:        job.metadata.file_size ?? 0,
              width:            job.metadata.width ?? null,
              height:           job.metadata.height ?? null,
              duration_seconds: job.metadata.duration ?? null,
              storage_bucket:   'processed-media',
              thumbnail_url:    null,
              tags:             [],
              is_processed:     true,
              metadata:         {},
              created_at:       new Date().toISOString(),
              updated_at:       new Date().toISOString(),
            };
            onProcessed(synthetic);
          }
        } else if (job.status === 'failed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setProcessingState('failed');
          setStatusMessage(job.error_message ?? 'Processing failed for an unknown reason.');
        }
        // 'pending' | 'processing' — keep polling
      } catch {
        // Network hiccup — keep polling rather than aborting
      }
    }, 2000);
  }, [media, onProcessed]);

  // ── Submit job ─────────────────────────────────────────────────────────────
  const handleProcess = useCallback(async () => {
    if (!media) return;

    setProcessingState('submitting');
    setStatusMessage('Submitting processing job...');

    const params: VideoProcessingParams = {};

    if (trimEnabled) {
      params.trimStart = trimStart;
      params.trimEnd   = trimEnd;
    }

    if (selectedRatio) {
      params.aspectRatio = selectedRatio;
    }

    // The watermark image is assumed to be stored in the user's profile /
    // settings and resolved server-side; the client only sends position.
    // When watermark is enabled we signal intent via a sentinel path; the
    // server resolves the actual watermark file from the user's profile.
    if (watermarkEnabled) {
      params.watermarkPath = `__user_watermark__:${watermarkPosition}`;
    }

    try {
      const res  = await fetch('/api/process-video', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mediaId: media.id, params }),
      });

      const data = (await res.json()) as { jobId?: string; status?: string; error?: string };

      if (!res.ok || !data.jobId) {
        setProcessingState('failed');
        setStatusMessage(data.error ?? 'Failed to submit processing job.');
        return;
      }

      startPolling(data.jobId);
    } catch {
      setProcessingState('failed');
      setStatusMessage('A network error occurred while submitting the job.');
    }
  }, [
    media,
    trimEnabled,
    trimStart,
    trimEnd,
    selectedRatio,
    watermarkEnabled,
    watermarkPosition,
    startPolling,
  ]);

  // ── Early return if no media ───────────────────────────────────────────────
  if (!media) return null;

  const duration      = media.duration_seconds ?? 0;
  const isProcessing  = processingState === 'submitting' || processingState === 'polling';
  const isTerminal    = processingState === 'completed' || processingState === 'failed';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit video: ${media.original_name}`}
    >
      {/* Panel */}
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-gray-950 border border-gray-800 shadow-2xl overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Film className="w-5 h-5 text-indigo-400 shrink-0" />
            <h2
              className="text-base font-semibold text-white truncate"
              title={media.original_name}
            >
              {media.original_name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor"
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                       text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Left — Video preview */}
          <div className="flex flex-col items-center justify-center w-1/2 bg-black shrink-0 p-4">
            <video
              ref={videoRef}
              src={media.file_url}
              controls
              playsInline
              className="max-w-full max-h-full rounded-lg object-contain"
              style={{ maxHeight: 'calc(92vh - 120px)' }}
            >
              Your browser does not support the video element.
            </video>
          </div>

          {/* Right — Controls */}
          <div className="flex flex-col w-1/2 overflow-y-auto border-l border-gray-800">
            <div className="flex flex-col gap-6 p-6">

              {/* ── Trim ─────────────────────────────────────────────────── */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <SectionHeading>Trim</SectionHeading>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={trimEnabled}
                    onClick={() => setTrimEnabled((v) => !v)}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                      trimEnabled ? 'bg-indigo-600' : 'bg-gray-700',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                        trimEnabled ? 'translate-x-4' : 'translate-x-1',
                      )}
                    />
                  </button>
                </div>

                <div
                  className={cn(
                    'grid grid-cols-2 gap-3 transition-opacity',
                    !trimEnabled && 'opacity-40 pointer-events-none',
                  )}
                >
                  {/* Start time */}
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="trim-start"
                      className="text-xs text-gray-400"
                    >
                      Start time (s)
                    </label>
                    <input
                      id="trim-start"
                      type="number"
                      min={0}
                      max={Math.max(0, trimEnd - 0.1)}
                      step={0.1}
                      value={trimStart}
                      onChange={(e) =>
                        setTrimStart(Math.max(0, parseFloat(e.target.value) || 0))
                      }
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                                 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500
                                 focus:border-transparent"
                    />
                  </div>

                  {/* End time */}
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="trim-end"
                      className="text-xs text-gray-400"
                    >
                      End time (s)
                    </label>
                    <input
                      id="trim-end"
                      type="number"
                      min={Math.max(0, trimStart + 0.1)}
                      max={duration || undefined}
                      step={0.1}
                      value={trimEnd}
                      onChange={(e) =>
                        setTrimEnd(parseFloat(e.target.value) || 0)
                      }
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                                 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500
                                 focus:border-transparent"
                    />
                  </div>
                </div>

                {trimEnabled && (
                  <p className="mt-2 text-xs text-gray-500">
                    {selectedDuration.toFixed(1)} seconds selected
                  </p>
                )}
              </section>

              {/* ── Aspect Ratio ──────────────────────────────────────────── */}
              <section>
                <SectionHeading>Aspect Ratio</SectionHeading>
                <div className="grid grid-cols-4 gap-2">
                  {RATIO_OPTIONS.map((option) => {
                    const isActive = selectedRatio === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setSelectedRatio(isActive ? null : option.value ?? null)
                        }
                        aria-pressed={isActive}
                        className={cn(
                          'flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-xl border',
                          'text-center transition-all duration-150',
                          isActive
                            ? 'border-indigo-500 bg-indigo-950 text-indigo-300 ring-1 ring-indigo-500/50'
                            : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-300',
                        )}
                      >
                        {/* Visual rectangle preview */}
                        <div
                          className={cn(
                            'rounded-sm border-2',
                            isActive ? 'border-indigo-400' : 'border-current',
                          )}
                          style={option.previewStyle}
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-xs font-semibold leading-none">
                            {option.label}
                          </p>
                          <p className="text-[10px] leading-none mt-0.5 opacity-70">
                            {option.sublabel}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedRatio === null && (
                  <p className="mt-2 text-xs text-gray-600">
                    No crop — original ratio will be preserved.
                  </p>
                )}
              </section>

              {/* ── Branding / Watermark ──────────────────────────────────── */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <SectionHeading>Branding</SectionHeading>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={watermarkEnabled}
                    onClick={() => setWatermarkEnabled((v) => !v)}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                      watermarkEnabled ? 'bg-indigo-600' : 'bg-gray-700',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                        watermarkEnabled ? 'translate-x-4' : 'translate-x-1',
                      )}
                    />
                  </button>
                </div>

                <div
                  className={cn(
                    'flex flex-col gap-3 transition-opacity',
                    !watermarkEnabled && 'opacity-40 pointer-events-none',
                  )}
                >
                  {/* Position dropdown */}
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="watermark-position"
                      className="text-xs text-gray-400"
                    >
                      Watermark position
                    </label>
                    <select
                      id="watermark-position"
                      value={watermarkPosition}
                      onChange={(e) =>
                        setWatermarkPosition(e.target.value as WatermarkPosition)
                      }
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                                 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500
                                 focus:border-transparent appearance-none cursor-pointer"
                    >
                      {WATERMARK_POSITIONS.map((pos) => (
                        <option key={pos.value} value={pos.value}>
                          {pos.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Info note */}
                  <p className="text-xs text-gray-500 leading-relaxed">
                    The watermark image from your Settings will be used.
                  </p>
                </div>
              </section>

            </div>

            {/* ── Sticky bottom — Process button + status ───────────────── */}
            <div className="mt-auto px-6 pb-6 pt-4 border-t border-gray-800/60 bg-gray-950 shrink-0">

              {/* Status feedback */}
              {isTerminal && (
                <div
                  className={cn(
                    'flex items-start gap-2.5 rounded-lg px-4 py-3 mb-4 text-sm',
                    processingState === 'completed'
                      ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                      : 'bg-red-950 border border-red-700 text-red-300',
                  )}
                  role="status"
                  aria-live="polite"
                >
                  {processingState === 'completed' ? (
                    <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  )}
                  <span>{statusMessage}</span>
                </div>
              )}

              {/* Processing indicator */}
              {isProcessing && (
                <div
                  className="flex items-center gap-2.5 rounded-lg px-4 py-3 mb-4
                             bg-indigo-950 border border-indigo-700 text-indigo-300 text-sm"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {/* Process button */}
              <button
                type="button"
                onClick={handleProcess}
                disabled={isProcessing || processingState === 'completed'}
                className={cn(
                  'w-full h-11 rounded-xl font-medium text-sm transition-all duration-150',
                  'flex items-center justify-center gap-2',
                  isProcessing || processingState === 'completed'
                    ? 'bg-indigo-800 text-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700',
                )}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : processingState === 'completed' ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Processed
                  </>
                ) : (
                  'Process Video'
                )}
              </button>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoEditor;
