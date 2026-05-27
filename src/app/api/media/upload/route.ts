import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import type { MediaFile } from '@/types';

const MAX_FILES = 30;
const STORAGE_BUCKET = 'media-library';

function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function getFileType(mimeType: string): 'image' | 'video' | null {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  // Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Invalid form data' },
      { status: 400 }
    );
  }

  // Collect all files from the form (field name: "files" or any name)
  const fileEntries: File[] = [];
  for (const [, value] of formData.entries()) {
    if (value instanceof File) {
      fileEntries.push(value);
    }
  }

  if (fileEntries.length === 0) {
    return NextResponse.json(
      { error: 'No files provided' },
      { status: 400 }
    );
  }

  if (fileEntries.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Too many files. Maximum allowed is ${MAX_FILES}.` },
      { status: 400 }
    );
  }

  const uploadedFiles: MediaFile[] = [];
  const errors: { file: string; error: string }[] = [];

  for (const file of fileEntries) {
    const mimeType = file.type;
    const fileType = getFileType(mimeType);

    // Validate mime type
    if (!fileType) {
      errors.push({
        file: file.name,
        error: `Unsupported file type "${mimeType}". Only image/* and video/* are allowed.`,
      });
      continue;
    }

    const extension = getExtension(file.name);
    const uniqueId = uuidv4();
    const storagePath = `${user.id}/${uniqueId}${extension ? '.' + extension : ''}`;

    // Convert File to ArrayBuffer for upload
    let fileBuffer: ArrayBuffer;
    try {
      fileBuffer = await file.arrayBuffer();
    } catch {
      errors.push({ file: file.name, error: 'Failed to read file contents.' });
      continue;
    }

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      errors.push({
        file: file.name,
        error: `Storage upload failed: ${uploadError.message}`,
      });
      continue;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    const fileUrl = publicUrlData.publicUrl;

    // Build the DB record
    const now = new Date().toISOString();
    const mediaRecord: Omit<
      MediaFile,
      'id' | 'created_at' | 'updated_at' | 'width' | 'height' | 'duration_seconds' | 'thumbnail_url'
    > = {
      user_id: user.id,
      file_name: `${uniqueId}${extension ? '.' + extension : ''}`,
      original_name: file.name,
      file_path: storagePath,
      file_url: fileUrl,
      file_type: fileType,
      mime_type: mimeType,
      file_size: file.size,
      storage_bucket: STORAGE_BUCKET,
      tags: [],
      is_processed: false,
      metadata: {},
    };

    // Insert into media_library table
    const { data: insertedRecord, error: insertError } = await supabase
      .from('media_library')
      .insert({
        ...mediaRecord,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      // Attempt to clean up the uploaded file from storage on DB insert failure
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);

      errors.push({
        file: file.name,
        error: `Database insert failed: ${insertError.message}`,
      });
      continue;
    }

    uploadedFiles.push(insertedRecord as MediaFile);
  }

  // If every file failed, return 500
  if (uploadedFiles.length === 0 && errors.length > 0) {
    return NextResponse.json(
      { success: false, files: [], errors },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      files: uploadedFiles,
      ...(errors.length > 0 ? { errors } : {}),
    },
    { status: 201 }
  );
}
