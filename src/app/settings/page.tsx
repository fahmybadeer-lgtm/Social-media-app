import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  // Load existing social tokens
  const { data: tokens } = await supabase
    .from('social_tokens')
    .select('platform, platform_username, is_active, updated_at')
    .eq('user_id', user.id);

  const connectedPlatforms: Record<string, { username: string | null; connectedAt: string }> = {};
  for (const t of tokens ?? []) {
    if (t.is_active) {
      connectedPlatforms[t.platform] = {
        username: t.platform_username,
        connectedAt: t.updated_at,
      };
    }
  }

  return <SettingsClient connectedPlatforms={connectedPlatforms} />;
}
