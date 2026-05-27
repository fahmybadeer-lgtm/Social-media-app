import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { MediaFile } from '@/types';

// ---------------------------------------------------------------------------
// PATCH /api/media/[id]
// Body: { original_name?: string; tags?: string[] }
// Updates allowed fields on a media_library record. Verifies ownership.
// Returns the updated record.
// ---------------------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing media ID.' }, { status: 400 });
  }

  // Parse and validate the request body
  let body: { original_name?: unknown; tags?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // Build the update payload — only allow specific fields
  const updates: Partial<Pick<MediaFile, 'original_name' | 'tags' | 'updated_at'>> = {
    updated_at: new Date().toISOString(),
  };

  if (body.original_name !== undefined) {
    if (typeof body.original_name !== 'string' || body.original_name.trim() === '') {
      return NextResponse.json(
        { error: '"original_name" must be a non-empty string.' },
        { status: 400 }
      );
    }
    updates.original_name = body.original_name.trim();
  }

  if (body.tags !== undefined) {
    if (
      !Array.isArray(body.tags) ||
      !body.tags.every((t) => typeof t === 'string')
    ) {
      return NextResponse.json(
        { error: '"tags" must be an array of strings.' },
        { status: 400 }
      );
    }
    updates.tags = body.tags as string[];
  }

  // Reject requests with nothing to update (only updated_at would change)
  if (Object.keys(updates).length === 1) {
    return NextResponse.json(
      { error: 'No valid fields provided to update.' },
      { status: 400 }
    );
  }

  // Verify the record exists and belongs to the authenticated user
  const { data: existing, error: fetchError } = await supabase
    .from('media_library')
    .select('id, user_id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Media not found.' }, { status: 404 });
  }

  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Perform the update
  const { data: updatedRecord, error: updateError } = await supabase
    .from('media_library')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id) // belt-and-suspenders ownership guard
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update media: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ media: updatedRecord as MediaFile });
}
