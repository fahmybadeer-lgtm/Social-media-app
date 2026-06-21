const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

export interface TikTokPostResult {
  publish_id: string;
}

export interface PublishToTikTokParams {
  caption: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  accessToken: string;
}

export async function publishToTikTok(
  params: PublishToTikTokParams,
): Promise<TikTokPostResult> {
  const { caption, mediaUrl, mediaType, accessToken } = params;

  if (mediaType === 'video') {
    return publishTikTokVideo({ caption, mediaUrl, accessToken });
  }

  return publishTikTokPhoto({ caption, mediaUrl, accessToken });
}

async function publishTikTokVideo({
  caption,
  mediaUrl,
  accessToken,
}: {
  caption: string;
  mediaUrl: string;
  accessToken: string;
}): Promise<TikTokPostResult> {
  const initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
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
  mediaUrl,
  accessToken,
}: {
  caption: string;
  mediaUrl: string;
  accessToken: string;
}): Promise<TikTokPostResult> {
  const initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/content/init/`, {
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
        media_type: 'PHOTO',
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_cover_index: 0,
        photo_images: [mediaUrl],
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
