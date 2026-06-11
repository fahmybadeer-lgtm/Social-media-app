const GRAPH_API_VERSION = 'v20.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface InstagramPostResult {
  id: string;
}

export interface PublishToInstagramParams {
  caption: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  igUserId: string;
  accessToken: string;
}

async function createMediaContainer(
  igUserId: string,
  params: Record<string, string>,
  accessToken: string,
): Promise<string> {
  const res = await fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, access_token: accessToken }).toString(),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Instagram API error ${res.status}`);
  }
  if (!data.id) throw new Error('Instagram API returned no container ID');
  return data.id as string;
}

async function waitForContainer(
  containerId: string,
  accessToken: string,
  maxAttempts = 15,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(
      `${GRAPH_API_BASE}/${containerId}?fields=status_code,status&access_token=${accessToken}`,
    );
    const data = await res.json();
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') {
      throw new Error(`Instagram media processing failed: ${data.status ?? 'unknown error'}`);
    }
    // IN_PROGRESS or PUBLISHED — keep waiting
  }
  throw new Error('Instagram media processing timed out after 45 seconds.');
}

async function publishContainer(
  igUserId: string,
  creationId: string,
  accessToken: string,
): Promise<InstagramPostResult> {
  const res = await fetch(`${GRAPH_API_BASE}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: creationId, access_token: accessToken }).toString(),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Instagram publish error ${res.status}`);
  }
  if (!data.id) throw new Error('Instagram API returned no post ID');
  return { id: data.id as string };
}

export async function publishToInstagram(
  params: PublishToInstagramParams,
): Promise<InstagramPostResult> {
  const { caption, mediaUrl, mediaType, igUserId, accessToken } = params;

  let containerId: string;

  if (mediaType === 'video') {
    containerId = await createMediaContainer(
      igUserId,
      { video_url: mediaUrl, caption, media_type: 'REELS' },
      accessToken,
    );
  } else {
    containerId = await createMediaContainer(
      igUserId,
      { image_url: mediaUrl, caption },
      accessToken,
    );
  }

  // Wait for Instagram to finish processing the media before publishing
  await waitForContainer(containerId, accessToken);

  return publishContainer(igUserId, containerId, accessToken);
}

export function buildInstagramCaption(caption: string, hashtags: string[]): string {
  const hashtagLine = hashtags.map((t) => `#${t}`).join(' ');
  return [caption, hashtagLine].filter(Boolean).join('\n\n');
}
