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
    throw new Error(data.error?.message ?? `Instagram container error ${res.status}: ${JSON.stringify(data)}`);
  }
  if (!data.id) throw new Error('Instagram API returned no container ID');
  return data.id as string;
}

async function waitForVideoContainer(
  containerId: string,
  accessToken: string,
  maxAttempts = 8,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await fetch(
      `${GRAPH_API_BASE}/${containerId}?fields=status_code,status&access_token=${accessToken}`,
    );
    const data = await res.json();
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') {
      throw new Error(`Instagram video processing failed: ${data.status ?? 'unknown error'}`);
    }
  }
  throw new Error('Instagram video processing timed out.');
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
    throw new Error(data.error?.message ?? `Instagram publish error ${res.status}: ${JSON.stringify(data)}`);
  }
  if (!data.id) throw new Error('Instagram API returned no post ID');
  return { id: data.id as string };
}

export async function publishToInstagram(
  params: PublishToInstagramParams,
): Promise<InstagramPostResult> {
  const { caption, mediaUrl, mediaType, igUserId, accessToken } = params;

  if (mediaType === 'video') {
    const containerId = await createMediaContainer(
      igUserId,
      { video_url: mediaUrl, caption, media_type: 'REELS' },
      accessToken,
    );
    await waitForVideoContainer(containerId, accessToken);
    return publishContainer(igUserId, containerId, accessToken);
  }

  // For images: create container then publish immediately
  // Instagram processes images synchronously during container creation
  const containerId = await createMediaContainer(
    igUserId,
    { image_url: mediaUrl, caption },
    accessToken,
  );
  return publishContainer(igUserId, containerId, accessToken);
}

export function buildInstagramCaption(caption: string, hashtags: string[]): string {
  const hashtagLine = hashtags.map((t) => `#${t}`).join(' ');
  return [caption, hashtagLine].filter(Boolean).join('\n\n');
}
