const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

export interface TikTokPostResult {
  publish_id: string;
}

export interface PublishToTikTokParams {
  caption: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  /** Additional image URLs beyond mediaUrl — when present, a multi-photo post (up to 35 images) is created. */
  extraImageUrls?: string[];
  accessToken: string;
}

export async function publishToTikTok(
  params: PublishToTikTokParams,
): Promise<TikTokPostResult> {
  const { caption, mediaUrl, mediaType, extraImageUrls, accessToken } = params;

  if (mediaType === 'video') {
    return publishTikTokVideo({ caption, mediaUrl, accessToken });
  }

  const photoUrls = [mediaUrl, ...(extraImageUrls ?? [])];
  return publishTikTokPhoto({ caption, photoUrls, accessToken });
}

async function publishTikTokVideo({
  caption,
  mediaUrl,
  accessToken,
}: {
  caption: string;
  mediaUrl: string;
  accessToken: string;
}): Promise<TikTokPostResult> { const initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title: caption.slice(0, 2200),
        privacy_level: 'SELF_ONLY',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: mediaUrl,
      },
    }),
  });

  const initData = await initRes.json();

  if (!initRes.ok || initData.error?.code !== 'ok') {
    throw new Error(
      initData.error?.message ?? `TikTok video init error ${initRes.status}`,
    );
  }

  const publishId = initData.data?.publish_id;
  if (!publishId) throw new Error('TikTok API returned no publish_id');

  return { publish_id: publishId };
}

async function publishTikTokPhoto({
  caption,
  photoUrls,
  accessToken,
}: {
  caption: string;
  photoUrls: string[];
  accessToken: string;
}): Promise<TikTokPostResult> {
  // TikTok photo posts support up to 35 images per post.
  const images = photoUrls.slice(0, 35);

  const initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/content/init/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_mode: 'DIRECT_POST',
      media_type: 'PHOTO',
      post_info: {
        title: caption.slice(0, 90),
        description: caption.slice(0, 4000),
        privacy_level: 'SELF_ONLY',
        disable_comment: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_cover_index: 0,
        photo_images: images,
      },
    }),
  });

  const initData = await initRes.json();

  if (!initRes.ok || initData.error?.code !== 'ok') {
    throw new Error(
      initData.error?.message ?? `TikTok photo init error ${initRes.status}`,
    );
  }

  const publishId = initData.data?.publish_id;
  if (!publishId) throw new Error('TikTok API returned no publish_id');

  return { publish_id: publishId };
}

export function buildTikTokCaption(caption: string, hashtags: string[]): string {
  const hashtagLine = hashtags.map((t) => '#' + t).join(' ');
  return [caption, hashtagLine].filter(Boolean).join('\n\n');
}

export async function refreshTikTokToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(data.error_description ?? data.error ?? 'TikTok token refresh failed');
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_in: data.expires_in ?? 86400,
  };
}
