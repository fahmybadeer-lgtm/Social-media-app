# System Architecture — Social Media Management SaaS

## 1. System Overview

This application is a **multi-tenant SaaS** platform that allows individual users (tenants) to manage their social media presence across Facebook, Instagram, TikTok, and LinkedIn from a single dashboard. Each tenant's data is fully isolated from every other tenant at the database layer via PostgreSQL Row Level Security (RLS).

Core capabilities:
- Upload images and videos to a personal media library backed by Supabase Storage
- Compose posts with AI-generated captions (Anthropic Claude) using reusable voice profiles
- Schedule posts per platform with a visual calendar queue
- Process videos (trim, crop, watermark, re-encode) via a server-side FFmpeg pipeline
- Store and refresh per-platform OAuth tokens to publish on the user's behalf

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Next.js 16 (App Router) + React 19 | SSR, RSC, file-system routing |
| **Language** | TypeScript 5 | Strict mode throughout |
| **Styling** | Tailwind CSS v4 | CSS-first configuration via `@theme` |
| **Backend** | Next.js API Routes (Route Handlers) | `/src/app/api/**` |
| **Database** | PostgreSQL via Supabase | Managed Postgres with extensions |
| **Auth** | Supabase Auth | Email/password + OAuth providers |
| **Storage** | Supabase Storage | Two buckets: `media-library`, `processed-media` |
| **Video Processing** | FFmpeg via `fluent-ffmpeg` | Runs in Node.js Route Handler, `external` package |
| **AI** | Anthropic Claude API (`@anthropic-ai/sdk`) | Caption generation, hashtag suggestions |
| **ORM / Query** | Supabase JS SDK v2 (`@supabase/ssr`) | Typed client generated from DB schema |
| **Deployment** | Vercel (recommended) | Edge middleware, serverless functions |

---

## 3. Directory Structure

```
Social-media-app/
├── .env.example                        # Environment variable template
├── next.config.ts                      # Next.js configuration (images, external packages)
├── tailwind.config.ts                  # Tailwind v4 theme tokens
├── tsconfig.json
├── package.json
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql      # Full DB schema, RLS, triggers, indexes
│
├── docs/
│   └── architecture.md                 # This document
│
├── public/
│   └── ...                             # Static assets
│
└── src/
    ├── middleware.ts                    # Supabase session refresh on every request
    │
    ├── types/
    │   └── index.ts                    # All shared TypeScript interfaces and types
    │
    ├── lib/
    │   └── supabase/
    │       ├── client.ts               # Browser Supabase client (createBrowserClient)
    │       └── server.ts               # Server Supabase client (createServerClient + cookies)
    │
    ├── app/
    │   ├── layout.tsx                  # Root layout — font, theme provider
    │   ├── page.tsx                    # Marketing / landing page
    │   ├── globals.css                 # Tailwind base + CSS custom properties
    │   │
    │   ├── (auth)/
    │   │   ├── login/page.tsx
    │   │   ├── signup/page.tsx
    │   │   └── callback/route.ts       # OAuth exchange + session cookie
    │   │
    │   ├── (dashboard)/
    │   │   ├── layout.tsx              # Sidebar, nav, auth guard
    │   │   ├── dashboard/page.tsx      # Overview metrics
    │   │   ├── media/
    │   │   │   ├── page.tsx            # Media library grid
    │   │   │   └── [id]/page.tsx       # Asset detail / edit
    │   │   ├── composer/
    │   │   │   └── page.tsx            # Post composer with AI caption
    │   │   ├── scheduler/
    │   │   │   └── page.tsx            # Calendar / queue view
    │   │   ├── voice-profiles/
    │   │   │   └── page.tsx            # Manage voice/tone profiles
    │   │   └── settings/
    │   │       ├── page.tsx            # General settings
    │   │       └── connections/page.tsx # OAuth token management
    │   │
    │   └── api/
    │       ├── media/
    │       │   ├── upload/route.ts     # POST: sign upload URL or direct upload
    │       │   └── [id]/route.ts       # GET / PATCH / DELETE single asset
    │       ├── posts/
    │       │   ├── route.ts            # GET list, POST create
    │       │   └── [id]/route.ts       # GET, PATCH, DELETE
    │       ├── scheduler/
    │       │   ├── route.ts            # GET queue, POST schedule post
    │       │   └── [id]/route.ts       # PATCH / DELETE queue item
    │       ├── ai/
    │       │   └── caption/route.ts    # POST: generate caption via Anthropic
    │       ├── video/
    │       │   ├── process/route.ts    # POST: enqueue FFmpeg job
    │       │   └── jobs/[id]/route.ts  # GET job status
    │       └── auth/
    │           └── callback/route.ts   # Supabase PKCE callback
    │
    └── components/
        ├── ui/                         # Primitive design-system components
        ├── media/                      # MediaCard, MediaUploader, MediaGrid
        ├── composer/                   # CaptionEditor, HashtagPicker, PlatformSelector
        ├── scheduler/                  # CalendarView, QueueList, ScheduleModal
        └── layout/                     # Sidebar, TopNav, UserMenu
```

---

## 4. Database Entity Relationship Description

### Tables and Relationships

```
auth.users  (managed by Supabase)
    │
    ├──< profiles           1:1   Each user gets exactly one profile row
    │                             (auto-created via trigger on auth.users INSERT)
    │
    ├──< media_library       1:N   A user owns many media assets
    │         │
    │         └──< video_jobs     1:N   Each media asset may have many processing jobs
    │
    ├──< voice_profiles      1:N   A user can define multiple tone/style profiles
    │
    ├──< posts               1:N   A user creates many posts
    │         │   references voice_profiles(id)  (optional)
    │         │   media_ids UUID[]  (soft array FK to media_library — no hard FK)
    │         │
    │         └──< scheduled_queue  1:N  Each post produces one queue row per platform
    │
    ├──< scheduled_queue     1:N   (also directly owned by user for fast RLS)
    │
    └──< social_tokens       1:N   One row per platform per user (unique constraint)
```

### Key Design Decisions

- `posts.media_ids` is stored as `UUID[]` rather than a join table to keep the composer query simple and avoid extra joins when loading a post draft.
- `posts.platforms` uses a `CHECK (platforms <@ ARRAY[...])` constraint to validate all elements without a foreign key to an enum table.
- `social_tokens` has a `UNIQUE (user_id, platform)` constraint to make OAuth upserts safe.
- `profiles.id` and `profiles.user_id` both reference `auth.users(id)`. `id` makes `profiles` act as an extension of `auth.users`; `user_id` provides the standard tenant FK used by all RLS policies.

---

## 5. Multi-Tenancy Security Model

### Row Level Security (RLS)

Every application table has RLS **enabled**. All four CRUD policies follow the same pattern:

```sql
-- SELECT
USING (user_id = auth.uid())

-- INSERT
WITH CHECK (user_id = auth.uid())

-- UPDATE
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())

-- DELETE
USING (user_id = auth.uid())
```

`auth.uid()` is a Supabase built-in that reads the JWT sub claim from the current Postgres session. The Supabase JS SDK injects the session JWT automatically on every request, so the database enforces isolation without any application-layer filtering.

### Service Role Bypass

The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and is used **only** on the server side in API routes that need to act on behalf of a user (e.g., the video processing worker updating a `video_jobs` row after FFmpeg completes). It is never exposed to the client.

### Middleware Session Refresh

`src/middleware.ts` uses `@supabase/ssr` to:
1. Read the session cookie on every incoming request.
2. Silently refresh the access token if it is expired.
3. Write the updated cookie back in the response headers.

This ensures SSR pages and Route Handlers always have a valid session without forcing users to re-login.

---

## 6. Media Upload Flow

```
Client (browser)
    │
    │  1. User selects file(s) in MediaUploader component
    │
    ▼
POST /api/media/upload
    │  2. Route Handler authenticates request (server Supabase client)
    │  3. Validates MIME type and file size
    │  4. Generates a unique file_name  (uuid + original extension)
    │  5. Calls supabase.storage.from('media-library')
    │         .upload(file_path, fileBuffer, { contentType })
    │
    ▼
Supabase Storage  (media-library bucket)
    │  6. File stored at  {user_id}/{file_name}
    │  7. Public URL returned by SDK
    │
    ▼
POST /api/media/upload  (continued)
    │  8. INSERT row into media_library with metadata
    │         (file_url, file_path, file_type, mime_type,
    │          file_size, width/height for images)
    │  9. For videos: enqueue a video_jobs row with job_type='full_process'
    │
    ▼
Client
    10. Receives { mediaFile: MediaFile } JSON response
    11. UploadProgress state updated to 'complete'
    12. Media grid refreshes via router.refresh() or SWR revalidation
```

---

## 7. Video Processing Pipeline

```
Client
    │
    │  1. User triggers processing (trim/crop/watermark) from media detail page
    │
    ▼
POST /api/video/process
    │  2. Validates VideoProcessingParams
    │  3. INSERTs video_jobs row  { status: 'pending', parameters: {...} }
    │  4. Returns { jobId } immediately (non-blocking)
    │
    ▼
POST /api/video/process  (background execution, same handler)
    │  5. Downloads source file from Supabase Storage to /tmp/{job_id}_input.*
    │  6. Builds fluent-ffmpeg command chain from parameters:
    │       - trimStart / trimEnd  → .setStartTime() / .duration()
    │       - aspectRatio          → .videoFilters('crop=...')
    │       - watermarkPath        → .input(watermark).complexFilter(overlay)
    │       - outputFormat         → .toFormat()
    │  7. Updates video_jobs  { status: 'processing', started_at: NOW() }
    │
    ▼
FFmpeg (fluent-ffmpeg, runs in Node.js process)
    │  8. Writes output to /tmp/{job_id}_output.*
    │
    ▼
POST /api/video/process  (FFmpeg .on('end') callback)
    │  9.  Uploads output file to Supabase Storage  (processed-media bucket)
    │  10. UPDATEs video_jobs  { status: 'completed', output_path, completed_at }
    │  11. UPDATEs media_library  { is_processed: true, thumbnail_url, file_url (processed) }
    │  12. Cleans up /tmp files
    │
    ▼
Client
    GET /api/video/jobs/{id}  — polls for status or uses Supabase Realtime subscription
    13. On 'completed': refreshes media detail view with processed asset
    14. On 'failed':    surfaces error_message to user
```

---

## 8. AI Caption Generation Flow

```
Client  (Composer page)
    │
    │  1. User fills in raw_concept (brief idea) and selects a VoiceProfile
    │
    ▼
POST /api/ai/caption
    │  2. Route Handler reads voice_profile from DB for tone/style/examples
    │  3. Builds structured prompt:
    │       System: "You are a social media copywriter. Tone: {tone}. Style: {style}."
    │       User:   "Write a caption for: {raw_concept}
    │                Platform: {platform}
    │                Example captions: {example_captions.join('\n')}"
    │  4. Calls Anthropic SDK:
    │       anthropic.messages.create({
    │         model: 'claude-opus-4-5',
    │         max_tokens: 1024,
    │         messages: [{ role: 'user', content: prompt }]
    │       })
    │
    ▼
Anthropic Claude API
    │  5. Returns caption text + suggested hashtags
    │
    ▼
POST /api/ai/caption  (continued)
    │  6. Parses response (caption body, hashtag array)
    │  7. Returns { caption: string, hashtags: string[] }
    │
    ▼
Client
    8. Populates ComposerState.caption and ComposerState.hashtags
    9. User can edit before saving or scheduling
```

---

## 9. Authentication Flow

```
Client
    │
    │  1. User submits login form (email + password) or clicks OAuth provider button
    │
    ▼
Supabase Auth  (hosted auth server)
    │  2. Issues JWT access_token (1 hour) + refresh_token (long-lived)
    │  3. For OAuth: redirects to /api/auth/callback?code=...
    │
    ▼
/api/auth/callback/route.ts
    │  4. Exchanges auth code for session via
    │       supabase.auth.exchangeCodeForSession(code)
    │  5. @supabase/ssr writes session cookies (HttpOnly, SameSite=Lax)
    │  6. Redirects to /dashboard
    │
    ▼
src/middleware.ts  (runs on every request matching the matcher)
    │  7. createServerClient reads cookies from request
    │  8. Calls supabase.auth.getUser() — validates JWT server-side
    │  9. If token expired: supabase.auth.refreshSession() + writes new cookie
    │  10. If no session on a protected route: redirect to /login
    │
    ▼
Server Component / Route Handler
    11. createServerClient provides authenticated Supabase client
    12. All DB queries automatically scoped by RLS to auth.uid()
    13. service-role client used only for privileged operations
```

---

## 10. API Routes Inventory

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/callback` | Supabase PKCE code exchange |
| `GET` | `/api/media` | List authenticated user's media assets |
| `POST` | `/api/media/upload` | Upload file to Storage + create DB record |
| `GET` | `/api/media/[id]` | Fetch single media asset |
| `PATCH` | `/api/media/[id]` | Update media metadata (tags, name) |
| `DELETE` | `/api/media/[id]` | Delete asset from Storage + DB |
| `GET` | `/api/posts` | List posts (filterable by status, platform) |
| `POST` | `/api/posts` | Create new post draft |
| `GET` | `/api/posts/[id]` | Fetch single post |
| `PATCH` | `/api/posts/[id]` | Update post (caption, status, schedule) |
| `DELETE` | `/api/posts/[id]` | Delete post + its queue entries |
| `GET` | `/api/scheduler` | List scheduled queue (filterable by date range) |
| `POST` | `/api/scheduler` | Add post to schedule queue |
| `PATCH` | `/api/scheduler/[id]` | Reschedule or cancel queue item |
| `DELETE` | `/api/scheduler/[id]` | Remove item from queue |
| `POST` | `/api/ai/caption` | Generate caption via Anthropic Claude |
| `POST` | `/api/video/process` | Enqueue FFmpeg video processing job |
| `GET` | `/api/video/jobs/[id]` | Poll video job status |

---

## 11. Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key for browser client (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key — server only, bypasses RLS |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude caption generation |
| `NEXT_PUBLIC_APP_URL` | Yes | Full base URL of the deployed app (used for OAuth redirects) |
| `NEXT_PUBLIC_STORAGE_BUCKET` | Yes | Name of the primary media upload bucket (`media-library`) |
| `NEXT_PUBLIC_PROCESSED_BUCKET` | Yes | Name of the processed video output bucket (`processed-media`) |

> **Security notes:**
> - Variables prefixed `NEXT_PUBLIC_` are embedded in the client bundle. Never prefix secrets with `NEXT_PUBLIC_`.
> - `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` must only be accessed in Server Components, Route Handlers, and middleware — never in client components.
> - Add `.env.local` to `.gitignore`. Commit only `.env.example` with placeholder values.
