import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Shop logo upload / removal.
//
// Reuses the existing `media-library` storage bucket (no new bucket or
// storage policies required) under a fixed, per-user path so re-uploading
// always overwrites the same file: {user_id}/logo/logo.{ext}
// ---------------------------------------------------------------------------

const STORAGE_BUCKET = 'media-library';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const ACCEPTED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

function logoPath(userId: string, ext: string): string {
  return `${userId}/logo/logo.${ext}`;
}

async function getAuthedUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { user, error };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { user, error: authError } = await getAuthedUser(supabase);

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
  }

  const extension = ACCEPTED_TYPES[file.type];
  if (!extension) {
    return NextResponse.json(
      { success: false, error: 'Only PNG or JPG images are allowed.' },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { success: false, error: 'Logo file must be 5MB or smaller.' },
      { status: 400 }
    );
  }

  let fileBuffer: ArrayBuffer;
  try {
    fileBuffer = await file.arrayBuffer();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to read file contents.' },
      { status: 400 }
    );
  }

  // Clean up any previously stored logo (any accepted extension) so a user
  // who switches from a .png to a .jpg (or vice versa) never leaves an
  // orphaned file behind.
  await supabase.storage
    .from(STORAGE_BUCKET)
    .remove(Object.values(ACCEPTED_TYPES).map((ext) => logoPath(user.id, ext)));

  const storagePath = logoPath(user.id, extension);

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { success: false, error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

  // Cache-bust so the sidebar and Settings preview pick up the new image
  // immediately instead of showing a browser-cached copy at the same URL.
  const logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ logo_url: logoUrl })
    .eq('user_id', user.id);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: `Failed to save logo: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, logo_url: logoUrl }, { status: 200 });
}

export async function DELETE(): Promise<NextResponse> {
  const supabase = await createClient();
  const { user, error: authError } = await getAuthedUser(supabase);

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await supabase.storage
    .from(STORAGE_BUCKET)
    .remove(Object.values(ACCEPTED_TYPES).map((ext) => logoPath(user.id, ext)));

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ logo_url: null })
    .eq('user_id', user.id);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: `Failed to remove logo: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
