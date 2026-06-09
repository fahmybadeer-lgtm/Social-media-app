import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publishToFacebook, buildFacebookMessage } from '@/lib/social/facebook';

export async function GET(request: NextRequest): Promise<NextResponse> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

  let query = supabase
      .from('posts')
      .select('*, scheduled_queue(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
    const {
          caption,
          hashtags = [],
          platforms = [],
          scheduled_at,
          media_ids = [],
          status: requestedStatus = 'draft',
          publish_now = false,
    } = body;

  const status = publish_now ? 'processing' : requestedStatus;

  const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
              user_id: user.id,
              caption,
              hashtags,
              platforms,
              media_ids,
              scheduled_at: scheduled_at ?? null,
              status,
      })
      .select()
      .single();

  if (postError || !post) {
        return NextResponse.json({ error: postError?.message ?? 'Failed to create post' }, { status: 500 });
  }

  const queueItems = platforms.map((platform: string) => ({
        post_id: post.id,
        platform,
        status: publish_now ? 'processing' : 'scheduled',
        scheduled_at: scheduled_at ?? null,
  }));

  if (queueItems.length > 0) {
        const { error: queueError } = await supabase.from('scheduled_queue').insert(queueItems);
        if (queueError) return NextResponse.json({ error: queueError.message }, { status: 500 });
  }

  if (!publish_now) {
        return NextResponse.json(post);
  }

  let mediaUrl: string | undefined;
    let mediaType: 'image' | 'video' | undefined;

  if (media_ids.length > 0) {
        const { data: mediaRow } = await supabase
          .from('media_library')
          .select('file_url, file_type')
          .eq('id', media_ids[0])
          .single();
        if (mediaRow) {
                mediaUrl = mediaRow.file_url;
                mediaType = mediaRow.file_type as 'image' | 'video';
        }
  }

  if (platforms.includes('facebook')) {
        const pageId = process.env.FACEBOOK_PAGE_ID;
        const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

      if (!pageId || !accessToken) {
              await supabase
                .from('scheduled_queue')
                .update({ status: 'failed', error_message: 'Facebook credentials not configured.' })
                .eq('post_id', post.id)
                .eq('platform', 'facebook');
              return NextResponse.json({ error: 'Facebook not connected. Please check Settings.' }, { status: 400 });
      }

      try {
              const message = buildFacebookMessage(caption ?? '', hashtags);
              const result = await publishToFacebook({ message, mediaUrl, mediaType, pageId, accessToken });

          await supabase
                .from('scheduled_queue')
                .update({ status: 'published', metadata: { facebook_post_id: result.id } })
                .eq('post_id', post.id)
                .eq('platform', 'facebook');

          await supabase.from('posts').update({ status: 'published' }).eq('id', post.id);

          return NextResponse.json({ ...post, status: 'published', facebook_post_id: result.id });
      } catch (err) {
              const msg = err instanceof Error ? err.message : 'Unknown error';
              await supabase
                .from('scheduled_queue')
                .update({ status: 'failed', error_message: msg })
                .eq('post_id', post.id)
                .eq('platform', 'facebook');
              await supabase.from('posts').update({ status: 'failed' }).eq('id', post.id);
              return NextResponse.json({ error: msg }, { status: 502 });
      }
  }

  return NextResponse.json(post);
}
