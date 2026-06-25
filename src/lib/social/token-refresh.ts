import { SupabaseClient } from '@supabase/supabase-js';
import { refreshTikTokToken } from './tiktok';

export async function getValidTikTokAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from('social_tokens')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .eq('platform', 'tiktok')
    .eq('is_active', true)
    .single();

  if (!tokenRow?.access_token) return null;

  // If expiry is known and token is good for 2+ more hours, use it as-is
  if (tokenRow.token_expires_at) {
    const expiresAt = new Date(tokenRow.token_expires_at);
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    if (expiresAt > twoHoursFromNow) {
      return tokenRow.access_token;
    }
  } else {
    // No expiry stored — assume it's still valid (old token before this feature)
    return tokenRow.access_token;
  }

  // Token expiring soon — refresh it
  if (!tokenRow.refresh_token) {
    console.warn('TikTok token expiring but no refresh_token stored');
    return tokenRow.access_token;
  }

  try {
    const refreshed = await refreshTikTokToken(tokenRow.refresh_token);
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

    await supabase
      .from('social_tokens')
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        token_expires_at: newExpiresAt,
      })
      .eq('user_id', userId)
      .eq('platform', 'tiktok');

    console.log('TikTok token refreshed successfully, expires:', newExpiresAt);
    return refreshed.access_token;
  } catch (err) {
    console.error('TikTok token refresh failed:', err);
    return tokenRow.access_token; // fall back to current token
  }
}
