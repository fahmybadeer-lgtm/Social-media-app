// ============================================================
// Primitive / union types
// ============================================================

/** Social platforms supported by the application. */
export type Platform = 'facebook' | 'instagram' | 'tiktok' | 'linkedin';

/** Uploaded asset types stored in the media library. */
export type MediaType = 'image' | 'video';

/** Lifecycle status of a composed post. */
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

/** Lifecycle status of a video processing job. */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Lifecycle status of a scheduled queue item. */
export type QueueStatus = 'draft' | 'scheduled' | 'processing' | 'published' | 'failed';

/** Standard social-media aspect ratios used during video cropping. */
export type AspectRatio = '9:16' | '4:5' | '1:1' | '16:9';

// ============================================================
// Entity interfaces — mirror the Supabase database schema
// ============================================================

/**
 * Represents a row in public.profiles.
 * One profile per authenticated user, auto-created on signup.
 */
export interface Profile {
  /** UUID — primary key, also references auth.users(id). */
  id: string;
  /** UUID — foreign key to auth.users(id), used in all RLS policies. */
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  business_name: string | null;
  website: string | null;
  /** Public URL of the uploaded shop logo shown in the sidebar, or null if none uploaded. */
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Represents a row in public.media_library.
 * Stores metadata for every uploaded image or video asset.
 */
export interface MediaFile {
  /** UUID primary key. */
  id: string;
  /** Owning user UUID — used by RLS. */
  user_id: string;
  /** Storage-safe filename (uuid + original extension). */
  file_name: string;
  /** Original filename as provided by the user. */
  original_name: string;
  /** Full path within the storage bucket, e.g. `{user_id}/{file_name}`. */
  file_path: string;
  /** Public URL to the asset in Supabase Storage. */
  file_url: string;
  /** Whether this is an image or video asset. */
  file_type: MediaType;
  /** MIME type, e.g. `image/jpeg` or `video/mp4`. */
  mime_type: string;
  /** File size in bytes. */
  file_size: number;
  /** Pixel width (images and videos). */
  width: number | null;
  /** Pixel height (images and videos). */
  height: number | null;
  /** Video duration in seconds (null for images). */
  duration_seconds: number | null;
  /** Name of the Supabase Storage bucket containing this asset. */
  storage_bucket: string;
  /** URL of the generated thumbnail (videos only). */
  thumbnail_url: string | null;
  /** User-defined tags for search and filtering. */
  tags: string[];
  /** Whether the asset has been through the FFmpeg processing pipeline. */
  is_processed: boolean;
  /** Arbitrary extra metadata (EXIF, codec info, etc.). */
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Represents a row in public.voice_profiles.
 * Reusable tone/style definitions used during AI caption generation.
 */
export interface VoiceProfile {
  /** UUID primary key. */
  id: string;
  /** Owning user UUID — used by RLS. */
  user_id: string;
  /** Human-readable name, e.g. "Professional LinkedIn". */
  profile_name: string;
  /** Tonal descriptor, e.g. "authoritative", "playful", "empathetic". */
  tone: string;
  /** Stylistic descriptor, e.g. "conversational", "formal", "storytelling". */
  style: string;
  /** Sample captions used as few-shot examples in the AI prompt. */
  example_captions: string[];
  /** Whether this profile is the default for new posts. */
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Represents a row in public.posts.
 * Core content unit — may target multiple platforms and reference
 * multiple media assets.
 */
export interface Post {
  /** UUID primary key. */
  id: string;
  /** Owning user UUID — used by RLS. */
  user_id: string;
  /** Optional internal title for the post (not published). */
  title: string | null;
  /** The finished caption text to be published. */
  caption: string | null;
  /** Hashtags to append to the caption. */
  hashtags: string[];
  /** Target platforms for this post. */
  platforms: Platform[];
  /** UUIDs of media_library rows attached to this post. */
  media_ids: string[];
  /** Current lifecycle status. */
  status: PostStatus;
  /** FK to voice_profiles — the profile used for AI generation. */
  voice_profile_id: string | null;
  /** Raw concept or brief entered by the user before AI generation. */
  raw_concept: string | null;
  /** Arbitrary extra data (platform-specific options, A/B variants, etc.). */
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Represents a row in public.scheduled_queue.
 * A single Post may produce one ScheduledQueueItem per target platform.
 */
export interface ScheduledQueueItem {
  /** UUID primary key. */
  id: string;
  /** Owning user UUID — used by RLS. */
  user_id: string;
  /** FK to posts(id). */
  post_id: string;
  /** The specific platform this queue item targets. */
  platform: Platform;
  /** When the post is scheduled to be published (UTC). */
  scheduled_at: string;
  /** When the post was actually published (UTC). Null until published. */
  published_at: string | null;
  /** Current status in the publishing lifecycle. */
  status: QueueStatus;
  /** Error detail when status is 'failed'. */
  error_message: string | null;
  /** Number of publish attempts made. */
  retry_count: number;
  /** Platform-specific publish options or response data. */
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Represents a row in public.social_tokens.
 * Stores OAuth access/refresh tokens per user per platform.
 * Unique constraint on (user_id, platform) makes upserts safe.
 */
export interface SocialToken {
  /** UUID primary key. */
  id: string;
  /** Owning user UUID — used by RLS. */
  user_id: string;
  /** The platform this token authenticates against. */
  platform: Platform;
  /** OAuth access token (encrypted at rest by Supabase). */
  access_token: string;
  /** OAuth refresh token (null if platform does not issue one). */
  refresh_token: string | null;
  /** UTC timestamp when the access_token expires. */
  token_expires_at: string | null;
  /** Numeric or string user ID on the third-party platform. */
  platform_user_id: string | null;
  /** Display username / handle on the third-party platform. */
  platform_username: string | null;
  /** Space-separated OAuth scopes granted. */
  scope: string | null;
  /** Whether this connection is currently active and usable. */
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Represents a row in public.video_jobs.
 * Tracks an asynchronous FFmpeg processing task.
 */
export interface VideoJob {
  /** UUID primary key. */
  id: string;
  /** Owning user UUID — used by RLS. */
  user_id: string;
  /** FK to media_library(id) — the source asset being processed. */
  media_id: string;
  /** Type of processing operation requested. */
  job_type: 'trim' | 'crop' | 'watermark' | 'full_process';
  /** Current processing status. */
  status: JobStatus;
  /** Storage path of the input file passed to FFmpeg. */
  input_path: string;
  /** Storage path of the FFmpeg output file (null until completed). */
  output_path: string | null;
  /** Processing parameters — see VideoProcessingParams. */
  parameters: VideoProcessingParams;
  /** Error detail when status is 'failed'. */
  error_message: string | null;
  /** UTC timestamp when FFmpeg processing began. */
  started_at: string | null;
  /** UTC timestamp when FFmpeg processing finished (success or failure). */
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Operation / request / state interfaces
// ============================================================

/**
 * Parameters that control FFmpeg video processing.
 * Stored as JSONB in video_jobs.parameters.
 */
export interface VideoProcessingParams {
  /** Trim start time in seconds. */
  trimStart?: number;
  /** Trim end time in seconds. */
  trimEnd?: number;
  /** Target aspect ratio for cropping. */
  aspectRatio?: AspectRatio;
  /** Storage path to a watermark image overlay. */
  watermarkPath?: string;
  /** FFmpeg output format string, e.g. 'mp4', 'webm'. */
  outputFormat?: string;
}

/**
 * Tracks the upload progress of a single file in the MediaUploader UI.
 */
export interface UploadProgress {
  /** The original File object from the browser File API. */
  file: File;
  /** Upload progress percentage, 0–100. */
  progress: number;
  /** Current upload status. */
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
  /** Error message if status is 'error'. */
  error?: string;
}

/**
 * Full state managed by the Post Composer.
 * Drives the composer UI and is serialised into a Post on save.
 */
export interface ComposerState {
  /** Optional internal title shown only in the dashboard. */
  title: string;
  /** The finished caption text (may be AI-generated or hand-written). */
  caption: string;
  /** Hashtags to attach (without the leading #). */
  hashtags: string[];
  /** Target platforms selected by the user. */
  platforms: Platform[];
  /** Media asset IDs attached to this post. */
  mediaIds: string[];
  /** Lifecycle status of the draft. */
  status: PostStatus;
  /** Voice profile selected for AI generation. */
  voiceProfileId: string | null;
  /** Raw idea or brief entered before AI generation. */
  rawConcept: string;
  /** Per-platform scheduled time (platform -> ISO 8601 string). */
  scheduledTimes: Partial<Record<Platform, string>>;
  /** Whether an AI caption generation request is in flight. */
  isGeneratingCaption: boolean;
  /** True while the save / schedule API call is pending. */
  isSaving: boolean;
  /** Most recent save/publish error message, if any. */
  saveError: string | null;
}

// ============================================================
// Supabase generated-types pattern
// ============================================================

/**
 * Mirrors the shape produced by `supabase gen types typescript`.
 * Replace the inner Row / Insert / Update types with the generated
 * output once you run `supabase gen types typescript --project-id <id>`.
 *
 * Usage with the Supabase client:
 *   import { createClient } from '@supabase/supabase-js'
 *   import type { Database } from '@/types'
 *   const supabase = createClient<Database>(url, key)
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Profile, 'id' | 'user_id'>>;
      };
      media_library: {
        Row: MediaFile;
        Insert: Omit<MediaFile, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<MediaFile, 'id' | 'user_id'>>;
      };
      voice_profiles: {
        Row: VoiceProfile;
        Insert: Omit<VoiceProfile, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<VoiceProfile, 'id' | 'user_id'>>;
      };
      posts: {
        Row: Post;
        Insert: Omit<Post, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Post, 'id' | 'user_id'>>;
      };
      scheduled_queue: {
        Row: ScheduledQueueItem;
        Insert: Omit<ScheduledQueueItem, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ScheduledQueueItem, 'id' | 'user_id'>>;
      };
      social_tokens: {
        Row: SocialToken;
        Insert: Omit<SocialToken, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<SocialToken, 'id' | 'user_id'>>;
      };
      video_jobs: {
        Row: VideoJob;
        Insert: Omit<VideoJob, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<VideoJob, 'id' | 'user_id'>>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
