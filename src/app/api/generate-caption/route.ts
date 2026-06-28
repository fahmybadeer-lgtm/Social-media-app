import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateCaption } from '@/lib/ai/caption';

const RAW_CONCEPT_MAX_LENGTH = 1000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    rawConcept?: unknown;
    platforms?: unknown;
    mediaUrl?: unknown;
    mediaType?: unknown;
    instructions?: unknown;
    businessContext?: unknown;
    voiceTone?: unknown;
    originalCaption?: unknown;
    enhanceRequest?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (
    body.rawConcept !== undefined &&
    (typeof body.rawConcept !== 'string' || body.rawConcept.trim().length > RAW_CONCEPT_MAX_LENGTH)
  ) {
    return NextResponse.json(
      { error: `"rawConcept" must be a string of ${RAW_CONCEPT_MAX_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  if (
    !Array.isArray(body.platforms) ||
    body.platforms.length === 0 ||
    !body.platforms.every((p) => typeof p === 'string' && p.trim())
  ) {
    return NextResponse.json(
      { error: '"platforms" is required and must be a non-empty array of strings.' },
      { status: 400 },
    );
  }

  const hasMediaUrl = typeof body.mediaUrl === 'string' && body.mediaUrl.trim();
  const hasRawConcept = typeof body.rawConcept === 'string' && body.rawConcept.trim();
  if (!hasMediaUrl && !hasRawConcept) {
    return NextResponse.json(
      { error: 'Provide either "rawConcept" or "mediaUrl".' },
      { status: 400 },
    );
  }

  const mediaUrl = hasMediaUrl ? (body.mediaUrl as string).trim() : undefined;
  const mediaType = body.mediaType === 'video' ? 'video' : 'image';
  const instructions = typeof body.instructions === 'string' && body.instructions.trim()
    ? body.instructions.trim() : undefined;
  const CNB_CONTEXT = 'CNB CUT Barbershop, Sterling VA. Website: www.cnbcut.com. Luxury barbershop, black and gold theme. Services: haircuts, skin fades, beard grooming, straight razor shaves, hot towel services, kids cuts, head shaves, camouflage color for gray hair, facial waxing. Amenities: complimentary beverage bar (soda, water, coffee, tea), luxury black and gold waiting area. When referencing a booking link or website, use www.cnbcut.com instead of "link in bio".';
  const businessContext = typeof body.businessContext === 'string' && body.businessContext.trim()
    ? body.businessContext.trim() : CNB_CONTEXT;
  const voiceTone = typeof body.voiceTone === 'string' && body.voiceTone.trim()
    ? body.voiceTone.trim() : undefined;
  const originalCaption = typeof body.originalCaption === 'string' && body.originalCaption.trim()
    ? body.originalCaption.trim() : undefined;
  const enhanceRequest = typeof body.enhanceRequest === 'string' && body.enhanceRequest.trim()
    ? body.enhanceRequest.trim() : undefined;

  let caption: string;
  try {
    caption = await generateCaption({
      rawConcept: hasRawConcept ? (body.rawConcept as string).trim() : undefined,
      platforms: body.platforms as string[],
      mediaUrl,
      mediaType,
      instructions,
      businessContext,
      voiceTone,
      originalCaption,
      enhanceRequest,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    console.error(`[generate-caption] ${message}`);
    return NextResponse.json({ error: `Caption generation failed: ${message}` }, { status: 500 });
  }

  return NextResponse.json({ caption }, { status: 200 });
}
