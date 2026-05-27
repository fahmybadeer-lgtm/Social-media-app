-- ============================================================
-- Migration: 001_initial_schema
-- Description: Initial database schema for Social Media
--              Management multi-tenant SaaS application
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- UTILITY: updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLE: profiles
-- One profile row per authenticated user, auto-created on
-- signup via trigger on auth.users.
-- ============================================================
CREATE TABLE public.profiles (
  id             UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id        UUID        UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      TEXT,
  avatar_url     TEXT,
  business_name  TEXT,
  website        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- TABLE: media_library
-- Stores metadata for every uploaded image or video asset.
-- ============================================================
CREATE TABLE public.media_library (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name         TEXT        NOT NULL,
  original_name     TEXT        NOT NULL,
  file_path         TEXT        NOT NULL,
  file_url          TEXT        NOT NULL,
  file_type         TEXT        NOT NULL CHECK (file_type IN ('image', 'video')),
  mime_type         TEXT        NOT NULL,
  file_size         BIGINT      NOT NULL,
  width             INTEGER,
  height            INTEGER,
  duration_seconds  NUMERIC(10, 3),
  storage_bucket    TEXT        NOT NULL,
  thumbnail_url     TEXT,
  tags              TEXT[]      NOT NULL DEFAULT '{}',
  is_processed      BOOLEAN     NOT NULL DEFAULT FALSE,
  metadata          JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_library_user_id              ON public.media_library(user_id);
CREATE INDEX idx_media_library_user_file_type_date  ON public.media_library(user_id, file_type, created_at DESC);

CREATE TRIGGER trg_media_library_updated_at
  BEFORE UPDATE ON public.media_library
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- TABLE: voice_profiles
-- Reusable tone/style profiles used during AI caption
-- generation.
-- ============================================================
CREATE TABLE public.voice_profiles (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_name      TEXT        NOT NULL,
  tone              TEXT        NOT NULL,
  style             TEXT        NOT NULL,
  example_captions  TEXT[]      NOT NULL DEFAULT '{}',
  is_default        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_voice_profiles_user_id ON public.voice_profiles(user_id);

CREATE TRIGGER trg_voice_profiles_updated_at
  BEFORE UPDATE ON public.voice_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- TABLE: posts
-- Core content unit. One post can target multiple platforms
-- and reference multiple media assets.
-- ============================================================
CREATE TABLE public.posts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT,
  caption          TEXT,
  hashtags         TEXT[]      NOT NULL DEFAULT '{}',
  platforms        TEXT[]      NOT NULL DEFAULT '{}'
                   CHECK (
                     platforms <@ ARRAY['facebook','instagram','tiktok','linkedin']::TEXT[]
                   ),
  media_ids        UUID[]      NOT NULL DEFAULT '{}',
  status           TEXT        NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  voice_profile_id UUID        REFERENCES public.voice_profiles(id) ON DELETE SET NULL,
  raw_concept      TEXT,
  metadata         JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_user_id ON public.posts(user_id);

CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- TABLE: scheduled_queue
-- Per-platform scheduling rows derived from a post. A single
-- post may produce one queue row per target platform.
-- ============================================================
CREATE TABLE public.scheduled_queue (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id        UUID        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  platform       TEXT        NOT NULL
                 CHECK (platform IN ('facebook', 'instagram', 'tiktok', 'linkedin')),
  scheduled_at   TIMESTAMPTZ NOT NULL,
  published_at   TIMESTAMPTZ,
  status         TEXT        NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('draft', 'scheduled', 'processing', 'published', 'failed')),
  error_message  TEXT,
  retry_count    INTEGER     NOT NULL DEFAULT 0,
  metadata       JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduled_queue_user_id              ON public.scheduled_queue(user_id);
CREATE INDEX idx_scheduled_queue_user_status_schedule ON public.scheduled_queue(user_id, status, scheduled_at);

CREATE TRIGGER trg_scheduled_queue_updated_at
  BEFORE UPDATE ON public.scheduled_queue
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- TABLE: social_tokens
-- OAuth access/refresh tokens per user per platform. The
-- unique constraint ensures only one active credential set
-- per platform per user (upsert-friendly).
-- ============================================================
CREATE TABLE public.social_tokens (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform            TEXT        NOT NULL
                      CHECK (platform IN ('facebook', 'instagram', 'tiktok', 'linkedin')),
  access_token        TEXT        NOT NULL,
  refresh_token       TEXT,
  token_expires_at    TIMESTAMPTZ,
  platform_user_id    TEXT,
  platform_username   TEXT,
  scope               TEXT,
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_social_tokens_user_platform UNIQUE (user_id, platform)
);

CREATE INDEX idx_social_tokens_user_id ON public.social_tokens(user_id);

CREATE TRIGGER trg_social_tokens_updated_at
  BEFORE UPDATE ON public.social_tokens
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- TABLE: video_jobs
-- Tracks asynchronous FFmpeg processing tasks such as trim,
-- crop, watermark, or combined full_process jobs.
-- ============================================================
CREATE TABLE public.video_jobs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_id       UUID        NOT NULL REFERENCES public.media_library(id) ON DELETE CASCADE,
  job_type       TEXT        NOT NULL
                 CHECK (job_type IN ('trim', 'crop', 'watermark', 'full_process')),
  status         TEXT        NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  input_path     TEXT        NOT NULL,
  output_path    TEXT,
  parameters     JSONB       NOT NULL DEFAULT '{}',
  error_message  TEXT,
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_video_jobs_user_id ON public.video_jobs(user_id);

CREATE TRIGGER trg_video_jobs_updated_at
  BEFORE UPDATE ON public.video_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- Every table is isolated by user_id = auth.uid() so that
-- each tenant can only access their own data.
-- ============================================================

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- media_library
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_library_select_own"
  ON public.media_library FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "media_library_insert_own"
  ON public.media_library FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "media_library_update_own"
  ON public.media_library FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "media_library_delete_own"
  ON public.media_library FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- voice_profiles
ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_profiles_select_own"
  ON public.voice_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "voice_profiles_insert_own"
  ON public.voice_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "voice_profiles_update_own"
  ON public.voice_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "voice_profiles_delete_own"
  ON public.voice_profiles FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- posts
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts_select_own"
  ON public.posts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "posts_insert_own"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "posts_update_own"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "posts_delete_own"
  ON public.posts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- scheduled_queue
ALTER TABLE public.scheduled_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_queue_select_own"
  ON public.scheduled_queue FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "scheduled_queue_insert_own"
  ON public.scheduled_queue FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "scheduled_queue_update_own"
  ON public.scheduled_queue FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "scheduled_queue_delete_own"
  ON public.scheduled_queue FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- social_tokens
ALTER TABLE public.social_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_tokens_select_own"
  ON public.social_tokens FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "social_tokens_insert_own"
  ON public.social_tokens FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "social_tokens_update_own"
  ON public.social_tokens FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "social_tokens_delete_own"
  ON public.social_tokens FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- video_jobs
ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_jobs_select_own"
  ON public.video_jobs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "video_jobs_insert_own"
  ON public.video_jobs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "video_jobs_update_own"
  ON public.video_jobs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "video_jobs_delete_own"
  ON public.video_jobs FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- TRIGGER: auto-create profile on user signup
-- Fires after INSERT on auth.users and creates a corresponding
-- profiles row for the new user.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
