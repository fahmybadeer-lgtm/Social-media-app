/**
 * POST /api/process-video
 *
 * Accepts a mediaId and VideoProcessingParams, creates a video_jobs record,
 * responds immediately with { jobId, status: 'pending' }, then runs the
 * actual FFmpeg processing asynchronously in a detached IIFE.
 *
 * NOTE: True background processing in a serverless/edge environment requires
 * a proper job queue (e.g. Inngest, BullMQ, Supabase Edge Functions).  The
 * detached async IIFE used here works in long-running Node.js processes (e.g.
 * `next start` or a custom server) but will be killed early by Vercel / AWS
 * Lambda once the response is sent.  Use a queue for production deployments.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processVideo, makeTempPath } from '@/lib/ffmpeg/processor';
import type {
  VideoProcessingParams as ProcessorParams,
} from '@/lib/ffmpeg/processor';
import type { VideoProcessingParams, MediaFile, VideoJob } from '@/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Downloads a file from a public URL to a local temp path.
 * Returns the local file path.
 */
async function downloadToTemp(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download file from "${url}": HTTP ${response.status} ${response.statusText}`,
    );
  }
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
}

/**
 * Safely removes a file, silently ignoring errors (e.g. file not found).
 */
function safeUnlink(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { mediaId?: unknown; params?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (typeof body.mediaId !== 'string' || !body.mediaId.trim()) {
    return NextResponse.json(
      { error: '"mediaId" is required and must be a non-empty string.' },
      { status: 400 },
    );
  }

  const mediaId = body.mediaId.trim();
  const params: VideoProcessingParams =
    body.params && typeof body.params === 'object'
      ? (body.params as VideoProcessingParams)
      : {};

  // ── Fetch and verify media ownership ─────────────────────────────────────
  const { data: mediaRecord, error: mediaFetchError } = await supabase
    .from('media_library')
    .select('*')
    .eq('id', mediaId)
    .eq('user_id', user.id)
    .single();

  if (mediaFetchError || !mediaRecord) {
    return NextResponse.json(
      { error: 'Media not found or access denied.' },
      { status: 404 },
    );
  }

  const media = mediaRecord as MediaFile;

  if (media.file_type !== 'video') {
    return NextResponse.json(
      { error: 'The specified media record is not a video.' },
      { status: 400 },
    );
  }

  // ── Create video_jobs record ──────────────────────────────────────────────
  const now = new Date().toISOString();

  const { data: jobRecord, error: jobInsertError } = await supabase
    .from('video_jobs')
    .insert({
      user_id: user.id,
      media_id: mediaId,
      job_type: 'full_process',
      status: 'pending',
      input_path: media.file_path,
      output_path: null,
      parameters: params,
      error_message: null,
      started_at: null,
      completed_at: null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (jobInsertError || !jobRecord) {
    return NextResponse.json(
      { error: `Failed to create processing job: ${jobInsertError?.message ?? 'unknown error'}` },
      { status: 500 },
    );
  }

  const job = jobRecord as VideoJob;

  // ── Respond immediately ───────────────────────────────────────────────────
  // The response is sent here; the async IIFE below continues running in the
  // background on long-lived Node processes.

  // ── Background processing (detached) ─────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  (async () => {
    const tempInputPath  = makeTempPath('input',  path.extname(media.file_name).slice(1) || 'mp4');
    const tempOutputPath = makeTempPath('output', params.outputFormat ?? 'mp4');

    try {
      // Mark job as processing
      await supabase
        .from('video_jobs')
        .update({ status: 'processing', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', job.id);

      // 1. Download source file from Supabase Storage to a temp path
      await downloadToTemp(media.file_url, tempInputPath);

      // 2. Run FFmpeg processing
      // Cast outputFormat to the stricter processor type — invalid values
      // will simply be ignored by the processor (it defaults to 'mp4').
      const processorParams: ProcessorParams = {
        ...params,
        outputFormat:
          params.outputFormat === 'mp4' || params.outputFormat === 'webm'
            ? params.outputFormat
            : 'mp4',
      };
      const result = await processVideo(tempInputPath, tempOutputPath, processorParams);

      // 3. Read the processed file and upload to 'processed-media' bucket
      const processedBuffer = fs.readFileSync(result.outputPath);
      const outputExt       = path.extname(result.outputPath).slice(1) || 'mp4';
      const storagePath     = `${user.id}/processed/${Date.now()}_${media.original_name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      const { error: uploadError } = await supabase.storage
        .from('processed-media')
        .upload(storagePath, processedBuffer, {
          contentType: `video/${outputExt}`,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Get public URL for the processed file
      const { data: publicUrlData } = supabase.storage
        .from('processed-media')
        .getPublicUrl(storagePath);

      const processedFileUrl = publicUrlData.publicUrl;

      // 4. Insert a new media_library record for the processed file
      const insertNow = new Date().toISOString();

      const { data: newMediaRecord, error: insertError } = await supabase
        .from('media_library')
        .insert({
          user_id:        user.id,
          file_name:      path.basename(storagePath),
          original_name:  media.original_name,
          file_path:      storagePath,
          file_url:       processedFileUrl,
          file_type:      'video',
          mime_type:      `video/${outputExt}`,
          file_size:      result.fileSize,
          width:          result.width,
          height:         result.height,
          duration_seconds: result.duration,
          storage_bucket: 'processed-media',
          thumbnail_url:  null,
          tags:           media.tags ?? [],
          is_processed:   true,
          metadata: {
            source_media_id: mediaId,
            processing_params: params,
            job_id: job.id,
          },
          created_at: insertNow,
          updated_at: insertNow,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`media_library insert failed: ${insertError.message}`);
      }

      // 5. Update job to completed
      await supabase
        .from('video_jobs')
        .update({
          status:       'completed',
          output_path:  storagePath,
          completed_at: new Date().toISOString(),
          updated_at:   new Date().toISOString(),
          metadata: {
            processed_media_id: (newMediaRecord as MediaFile).id,
            output_url:         processedFileUrl,
            duration:           result.duration,
            width:              result.width,
            height:             result.height,
            file_size:          result.fileSize,
          },
        } as Record<string, unknown>)
        .eq('id', job.id);

    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unknown processing error occurred.';

      console.error(`[process-video] Job ${job.id} failed: ${errorMessage}`);

      // 6. Mark job as failed with error detail
      await supabase
        .from('video_jobs')
        .update({
          status:        'failed',
          error_message: errorMessage,
          completed_at:  new Date().toISOString(),
          updated_at:    new Date().toISOString(),
        })
        .eq('id', job.id);

    } finally {
      // Clean up temp files regardless of success or failure
      safeUnlink(tempInputPath);
      safeUnlink(tempOutputPath);
    }
  })();

  return NextResponse.json({ jobId: job.id, status: 'pending' }, { status: 202 });
}
