import { SupabaseClient } from '@supabase/supabase-js'
import type { SocialToken, Platform } from '@/types'

export async function upsertSocialToken(
  supabase: SupabaseClient,
  userId: string,
  data: Omit<SocialToken, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<void> {
  const { error } = await supabase
    .from('social_tokens')
    .upsert({ user_id: userId, ...data }, { onConflict: 'user_id,platform' })

  if (error) {
    throw new Error(`Failed to upsert social token: ${error.message}`)
  }
}

export async function getSocialTokens(
  supabase: SupabaseClient,
  userId: string
): Promise<SocialToken[]> {
  const { data, error } = await supabase
    .from('social_tokens')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to fetch social tokens: ${error.message}`)
  }

  return (data ?? []) as SocialToken[]
}

export async function deleteSocialToken(
  supabase: SupabaseClient,
  userId: string,
  platform: Platform
): Promise<void> {
  const { error } = await supabase
    .from('social_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('platform', platform)

  if (error) {
    throw new Error(`Failed to delete social token: ${error.message}`)
  }
}
