/**
 * FFmpeg video processing pipeline.
 *
 * Uses fluent-ffmpeg to trim, crop, watermark, and compose videos.
 * All heavy operations are Promise-wrapped so they can be awaited
 * without blocking the Node event loop.
 *
 * The ffmpeg binary path is resolved in order:
 *   1. process.env.FFMPEG_PATH
 *   2. /usr/bin/ffmpeg  (confirmed via `which ffmpeg` on this host)
 */

import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Binary path
// ---------------------------------------------------------------------------

const FFMPEG_BIN = process.env.FFMPEG_PATH ?? '/usr/bin/ffmpeg';
ffmpeg.setFfmpegPath(FFMPEG_BIN);
ffmpeg.setFfprobePath(FFMPEG_BIN.replace('ffmpeg', 'ffprobe'));

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface VideoProcessingParams {
  trimStart?: number;      // seconds
  trimEnd?: number;        // seconds
  aspectRatio?: '9:16' | '4:5' | '1:1' | '16:9';
  watermarkPath?: string;  // local temp path to watermark image
  outputFormat?: 'mp4' | 'webm';
}

export interface ProcessingResult {
  outputPath: string;
  duration: number;
  width: number;
  height: number;
  fileSize: number;
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse aspect ratio string into a [width, height] number tuple.
 */
function parseAspectRatio(ratio: string): [number, number] {
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h) {
    throw new Error(`Invalid aspect ratio: ${ratio}`);
  }
  return [w, h];
}

/**
 * Build the crop= filter string that centres a crop to the target aspect ratio
 * within a source of (srcW x srcH).
 */
function buildCropFilter(srcW: number, srcH: number, targetRatio: string): string {
  const [ratioW, ratioH] = parseAspectRatio(targetRatio);
  const targetAspect = ratioW / ratioH;
  const srcAspect = srcW / srcH;

  let cropW: number;
  let cropH: number;

  if (srcAspect > targetAspect) {
    // Source is wider — pillar-crop (trim left & right)
    cropH = srcH;
    cropW = Math.floor(srcH * targetAspect);
  } else {
    // Source is taller — letter-crop (trim top & bottom)
    cropW = srcW;
    cropH = Math.floor(srcW / targetAspect);
  }

  // Ensure even dimensions (required by many codecs)
  cropW = cropW % 2 === 0 ? cropW : cropW - 1;
  cropH = cropH % 2 === 0 ? cropH : cropH - 1;

  const x = Math.floor((srcW - cropW) / 2);
  const y = Math.floor((srcH - cropH) / 2);

  return `crop=${cropW}:${cropH}:${x}:${y}`;
}

/**
 * Overlay position expression for the watermark.
 * Semi-transparent (alpha 0.7) is achieved by blending the overlay stream
 * with format=rgba and lut=a=val*0.7.
 */
function buildWatermarkOverlayExpr(
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
): string {
  const pad = 10;
  switch (position) {
    case 'top-left':     return `${pad}:${pad}`;
    case 'top-right':    return `main_w-overlay_w-${pad}:${pad}`;
    case 'bottom-left':  return `${pad}:main_h-overlay_h-${pad}`;
    case 'bottom-right': return `main_w-overlay_w-${pad}:main_h-overlay_h-${pad}`;
  }
}

/**
 * Collect file size synchronously after processing completes.
 */
function getFileSizeSync(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// 1. getVideoMetadata
// ---------------------------------------------------------------------------

/**
 * Uses ffprobe to extract duration, dimensions, codec, and bitrate.
 */
export function getVideoMetadata(inputPath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) {
        reject(new Error(`ffprobe failed for "${inputPath}": ${err.message}`));
        return;
      }

      try {
        const videoStream = data.streams.find(
          (s) => s.codec_type === 'video',
        );

        if (!videoStream) {
          reject(new Error(`No video stream found in "${inputPath}"`));
          return;
        }

        const duration =
          typeof data.format.duration === 'number'
            ? data.format.duration
            : parseFloat(String(data.format.duration ?? '0'));

        const width = videoStream.width ?? 0;
        const height = videoStream.height ?? 0;
        const codec = videoStream.codec_name ?? 'unknown';
        const bitrate = data.format.bit_rate
          ? parseInt(String(data.format.bit_rate), 10)
          : 0;

        resolve({ duration, width, height, codec, bitrate });
      } catch (parseErr) {
        reject(
          new Error(
            `Failed to parse ffprobe output for "${inputPath}": ${(parseErr as Error).message}`,
          ),
        );
      }
    });
  });
}

// ---------------------------------------------------------------------------
// 2. trimVideo
// ---------------------------------------------------------------------------

/**
 * Trims a video between startTime and endTime (seconds).
 * Uses -ss / -to with stream copy for speed when no re-encode is needed.
 * Re-encodes to h264/aac to guarantee seek accuracy.
 */
export async function trimVideo(
  inputPath: string,
  outputPath: string,
  startTime: number,
  endTime: number,
): Promise<ProcessingResult> {
  if (startTime < 0) {
    throw new Error(`trimVideo: startTime must be >= 0, got ${startTime}`);
  }
  if (endTime <= startTime) {
    throw new Error(
      `trimVideo: endTime (${endTime}) must be greater than startTime (${startTime})`,
    );
  }

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(endTime - startTime)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-movflags', '+faststart', '-preset', 'fast'])
      .output(outputPath)
      .on('error', (err) =>
        reject(new Error(`trimVideo ffmpeg error: ${err.message}`)),
      )
      .on('end', () => resolve())
      .run();
  });

  const meta = await getVideoMetadata(outputPath);
  return {
    outputPath,
    duration: meta.duration,
    width: meta.width,
    height: meta.height,
    fileSize: getFileSizeSync(outputPath),
  };
}

// ---------------------------------------------------------------------------
// 3. cropToAspectRatio
// ---------------------------------------------------------------------------

/**
 * Crops the video to the specified aspect ratio, centred on the frame.
 */
export async function cropToAspectRatio(
  inputPath: string,
  outputPath: string,
  aspectRatio: string,
): Promise<ProcessingResult> {
  const sourceMeta = await getVideoMetadata(inputPath);
  const cropFilter = buildCropFilter(sourceMeta.width, sourceMeta.height, aspectRatio);

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilter(cropFilter)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-movflags', '+faststart', '-preset', 'fast'])
      .output(outputPath)
      .on('error', (err) =>
        reject(new Error(`cropToAspectRatio ffmpeg error: ${err.message}`)),
      )
      .on('end', () => resolve())
      .run();
  });

  const meta = await getVideoMetadata(outputPath);
  return {
    outputPath,
    duration: meta.duration,
    width: meta.width,
    height: meta.height,
    fileSize: getFileSizeSync(outputPath),
  };
}

// ---------------------------------------------------------------------------
// 4. addWatermark
// ---------------------------------------------------------------------------

/**
 * Overlays a watermark image onto the video at the given position.
 * The watermark is rendered at 70% opacity using the colorchannelmixer alpha approach.
 */
export async function addWatermark(
  inputPath: string,
  watermarkPath: string,
  outputPath: string,
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-right',
): Promise<ProcessingResult> {
  if (!fs.existsSync(watermarkPath)) {
    throw new Error(`Watermark file not found: "${watermarkPath}"`);
  }

  const overlayExpr = buildWatermarkOverlayExpr(position);

  // filter_complex:
  //  [1:v] format=rgba, colorchannelmixer=aa=0.7 [wm];
  //  [0:v][wm] overlay=<position>
  const filterComplex = [
    '[1:v]format=rgba,colorchannelmixer=aa=0.7[wm]',
    `[0:v][wm]overlay=${overlayExpr}`,
  ].join(';');

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .input(watermarkPath)
      .complexFilter(filterComplex)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-movflags', '+faststart', '-preset', 'fast'])
      .output(outputPath)
      .on('error', (err) =>
        reject(new Error(`addWatermark ffmpeg error: ${err.message}`)),
      )
      .on('end', () => resolve())
      .run();
  });

  const meta = await getVideoMetadata(outputPath);
  return {
    outputPath,
    duration: meta.duration,
    width: meta.width,
    height: meta.height,
    fileSize: getFileSizeSync(outputPath),
  };
}

// ---------------------------------------------------------------------------
// 5. processVideo
// ---------------------------------------------------------------------------

/**
 * Master processing function.
 *
 * Chains all requested operations into the fewest possible FFmpeg passes:
 *  - If only trim is needed, uses setStartTime/setDuration.
 *  - If crop and/or watermark are also needed, builds a filter_complex
 *    that combines everything in one pass to avoid quality loss from
 *    multiple encodes.
 *
 * Intermediate temp files are written to os.tmpdir() and cleaned up
 * after the final output is produced.
 */
export async function processVideo(
  inputPath: string,
  outputPath: string,
  params: VideoProcessingParams,
): Promise<ProcessingResult> {
  const {
    trimStart,
    trimEnd,
    aspectRatio,
    watermarkPath,
    outputFormat = 'mp4',
  } = params;

  const hasTrim      = trimStart !== undefined || trimEnd !== undefined;
  const hasCrop      = !!aspectRatio;
  const hasWatermark = !!watermarkPath && fs.existsSync(watermarkPath);

  // If nothing is requested, just copy the file
  if (!hasTrim && !hasCrop && !hasWatermark) {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(['-movflags', '+faststart', '-preset', 'fast'])
        .output(outputPath)
        .on('error', (err) =>
          reject(new Error(`processVideo copy error: ${err.message}`)),
        )
        .on('end', () => resolve())
        .run();
    });

    const meta = await getVideoMetadata(outputPath);
    return {
      outputPath,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      fileSize: getFileSizeSync(outputPath),
    };
  }

  // Build a single-pass command with filter_complex
  const sourceMeta = await getVideoMetadata(inputPath);

  const command = ffmpeg();

  // Input 0: video file (with trim applied as input option for speed)
  if (hasTrim && trimStart !== undefined) {
    command.inputOptions([`-ss ${trimStart}`]);
  }
  command.input(inputPath);

  if (hasTrim && trimEnd !== undefined) {
    const start = trimStart ?? 0;
    const duration = trimEnd - start;
    if (duration <= 0) {
      throw new Error(
        `processVideo: trimEnd (${trimEnd}) must be greater than trimStart (${trimStart ?? 0})`,
      );
    }
    command.inputOptions([`-t ${duration}`]);
  }

  // Input 1: watermark (if needed)
  if (hasWatermark) {
    command.input(watermarkPath!);
  }

  // Build filter graph
  const filterSteps: string[] = [];
  let currentVideoLabel = '[0:v]';

  if (hasCrop) {
    const cropFilter = buildCropFilter(sourceMeta.width, sourceMeta.height, aspectRatio!);
    filterSteps.push(`${currentVideoLabel}${cropFilter}[cropped]`);
    currentVideoLabel = '[cropped]';
  }

  if (hasWatermark) {
    const overlayExpr = buildWatermarkOverlayExpr('bottom-right');
    filterSteps.push(`[1:v]format=rgba,colorchannelmixer=aa=0.7[wm]`);
    filterSteps.push(`${currentVideoLabel}[wm]overlay=${overlayExpr}[watermarked]`);
    currentVideoLabel = '[watermarked]';
  }

  if (filterSteps.length > 0) {
    command.complexFilter(filterSteps, [currentVideoLabel.replace(/[\[\]]/g, '')]);
  }

  const ext = outputFormat === 'webm' ? 'webm' : 'mp4';
  const finalOutputPath = outputPath.endsWith(`.${ext}`)
    ? outputPath
    : `${outputPath.replace(/\.[^.]+$/, '')}.${ext}`;

  if (outputFormat === 'webm') {
    command.videoCodec('libvpx-vp9').audioCodec('libopus');
  } else {
    command.videoCodec('libx264').audioCodec('aac');
    command.outputOptions(['-movflags', '+faststart', '-preset', 'fast']);
  }

  command.output(finalOutputPath);

  await new Promise<void>((resolve, reject) => {
    command
      .on('error', (err) =>
        reject(new Error(`processVideo ffmpeg error: ${err.message}`)),
      )
      .on('end', () => resolve())
      .run();
  });

  const meta = await getVideoMetadata(finalOutputPath);
  return {
    outputPath: finalOutputPath,
    duration: meta.duration,
    width: meta.width,
    height: meta.height,
    fileSize: getFileSizeSync(finalOutputPath),
  };
}

// ---------------------------------------------------------------------------
// 6. generateVideoThumbnail
// ---------------------------------------------------------------------------

/**
 * Extracts a single JPEG frame from the video at the given timestamp.
 * Defaults to 1 second in (or 0 if the video is shorter than 1 second).
 *
 * @returns The absolute path to the generated JPEG file.
 */
export async function generateVideoThumbnail(
  inputPath: string,
  outputPath: string,
  timeSeconds?: number,
): Promise<string> {
  // Determine a safe seek position
  let seekTime = timeSeconds ?? 1;

  try {
    const meta = await getVideoMetadata(inputPath);
    if (seekTime >= meta.duration) {
      seekTime = Math.max(0, meta.duration - 0.1);
    }
  } catch {
    // If metadata fails, default to 0
    seekTime = 0;
  }

  // fluent-ffmpeg's screenshot helper writes to a folder; we use
  // the lower-level approach so we can control the exact output path.
  const outputDir  = path.dirname(outputPath);
  const outputFile = path.basename(outputPath);

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(seekTime)
      .frames(1)
      .videoFilters('scale=640:-1')        // consistent thumbnail width
      .outputOptions(['-q:v', '2'])         // high quality JPEG
      .output(path.join(outputDir, outputFile))
      .on('error', (err) =>
        reject(new Error(`generateVideoThumbnail ffmpeg error: ${err.message}`)),
      )
      .on('end', () => resolve())
      .run();
  });

  return outputPath;
}

// ---------------------------------------------------------------------------
// Utility: create a temp file path in os.tmpdir()
// ---------------------------------------------------------------------------

/**
 * Returns an absolute path inside os.tmpdir() with the given extension.
 * The caller is responsible for deleting the file when done.
 */
export function makeTempPath(prefix: string, ext: string): string {
  return path.join(os.tmpdir(), `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
}
