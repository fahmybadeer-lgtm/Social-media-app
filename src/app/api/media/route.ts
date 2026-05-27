import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { MediaFile } from '@/types';

// ---------------------------------------------------------------------------
// GET /api/media
// Returns all media_library rows belonging to the authenticated user.
// Optional query param: ?type=image|video
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Optional type filter
  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get('type');

  let query = supabase
    .from('media_library')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (typeParam === 'image' || typeParam === 'video') {
    query = query.eq('file_type', typeParam);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: `Failed to fetch media: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ media: (data ?? []) as MediaFile[] });
}

// ---------------------------------------------------------------------------
// DELETE /api/media
// Body: { id: string }
// Verifies ownership, deletes from storage, then deletes the DB record.
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { id } = body;

  if (!id || typeof id !== 'string') {
    return NextResponse.json(
      { error: 'Missing or invalid "id" field in request body.' },
      { status: 400 }
    );
  }

  // Fetch the record to verify ownership and get storage path
  const { data: mediaRecord, error: fetchError } = await supabase
    .from('media_library')
    .select('id, user_id, file_path, storage_bucket')
    .eq('id', id)
    .single();

  if (fetchError || !mediaRecord) {
    return NextResponse.json({ error: 'Media not found.' }, { status: 404 });
  }

  // Strict ownership check
  if (mediaRecord.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Delete from Supabase Storage
  const { error: storageError } = await supabase.storage
    .from(mediaRecord.storage_bucket as string)
    .remove([mediaRecord.file_path as string]);

  if (storageError) {
    // Log but do not abort — the storage object may already be gone.
    console.error(
      `[media/DELETE] Storage removal failed for "${mediaRecord.file_path}": ${storageError.message}`
    );
  }

  // Delete the DB record
  const { error: deleteError } = await supabase
    .from('media_library')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id); // belt-and-suspenders ownership guard

  if (deleteError) {
    return NextResponse.json(
      { error: `Failed to delete media record: ${deleteError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
