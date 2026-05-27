/**
 * POST /api/generate-caption
 *
 * Generates a platform-tailored social media caption using Claude.
 *
 * Request body:
 *   {
 *     rawConcept:       string;   // required — the idea/brief, max 1000 chars
 *     platforms:        string[]; // required — e.g. ['instagram', 'linkedin']
 *     businessContext?: string;   // optional brand/industry context
 *     voiceTone?:       string;   // optional tone descriptor
 *   }
 *
 * Response:
 *   { caption: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateCaption } from '@/lib/ai/caption';

const RAW_CONCEPT_MAX_LENGTH = 1000;

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
  let body: {
    rawConcept?: unknown;
    platforms?: unknown;
    businessContext?: unknown;
    voiceTone?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // ── Validate rawConcept ───────────────────────────────────────────────────
  if (typeof body.rawConcept !== 'string' || !body.rawConcept.trim()) {
    return NextResponse.json(
      { error: '"rawConcept" is required and must be a non-empty string.' },
      { status: 400 },
    );
  }

  if (body.rawConcept.trim().length > RAW_CONCEPT_MAX_LENGTH) {
    return NextResponse.json(
      {
        error: `"rawConcept" must be ${RAW_CONCEPT_MAX_LENGTH} characters or fewer. Received ${body.rawConcept.trim().length} characters.`,
      },
      { status: 400 },
    );
  }

  // ── Validate platforms ────────────────────────────────────────────────────
  if (
    !Array.isArray(body.platforms) ||
    body.platforms.length === 0 ||
    !body.platforms.every((p) => typeof p === 'string' && p.trim())
  ) {
    return NextResponse.json(
      {
        error:
          '"platforms" is required and must be a non-empty array of non-empty strings.',
      },
      { status: 400 },
    );
  }

  // ── Optional fields ───────────────────────────────────────────────────────
  const businessContext =
    typeof body.businessContext === 'string' && body.businessContext.trim()
      ? body.businessContext.trim()
      : undefined;

  const voiceTone =
    typeof body.voiceTone === 'string' && body.voiceTone.trim()
      ? body.voiceTone.trim()
      : undefined;

  // ── Generate caption ──────────────────────────────────────────────────────
  let caption: string;

  try {
    caption = await generateCaption({
      rawConcept:      body.rawConcept.trim(),
      platforms:       body.platforms as string[],
      businessContext,
      voiceTone,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.';

    console.error(`[generate-caption] Caption generation failed: ${message}`);

    // Distinguish between client-facing API errors and internal failures
    if (message.includes('Anthropic API error')) {
      return NextResponse.json(
        { error: `Caption generation failed: ${message}` },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: `Caption generation failed: ${message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ caption }, { status: 200 });
}
