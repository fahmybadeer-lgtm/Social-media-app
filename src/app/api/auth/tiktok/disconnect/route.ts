import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('social_tokens')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('platform', 'tiktok');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
