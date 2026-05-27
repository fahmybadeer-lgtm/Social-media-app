/**
 * GET /api/process-video/status/[jobId]
 *
 * Returns the current state of a video processing job.
 * Verifies the job belongs to the authenticated user before returning.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { VideoJob } from '@/types';

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const supabase = await createClient();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Resolve dynamic route param ───────────────────────────────────────────
  const { jobId } = await params;

  if (!jobId || typeof jobId !== 'string' || !jobId.trim()) {
    return NextResponse.json(
      { error: 'Missing or invalid job ID.' },
      { status: 400 },
    );
  }

  // ── Fetch job record ──────────────────────────────────────────────────────
  const { data: jobRecord, error: fetchError } = await supabase
    .from('video_jobs')
    .select('*')
    .eq('id', jobId.trim())
    .single();

  if (fetchError || !jobRecord) {
    return NextResponse.json(
      { error: 'Job not found.' },
      { status: 404 },
    );
  }

  // ── Ownership check ───────────────────────────────────────────────────────
  // Treat a mis-owned record identically to "not found" to avoid leaking IDs.
  if ((jobRecord as VideoJob).user_id !== user.id) {
    return NextResponse.json(
      { error: 'Job not found.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ job: jobRecord as VideoJob });
}
