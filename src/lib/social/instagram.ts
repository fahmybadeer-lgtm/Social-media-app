const GRAPH_API_VERSION = 'v20.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface InstagramPostResult {
  id: string;
}

export interface PublishToInstagramParams {
  caption: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  /** Additional image URLs beyond mediaUrl — when present (1+), a carousel post is created. */
  extraImageUrls?: string[];
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

async function publishCarousel(
  igUserId: string,
  caption: string,
  imageUrls: string[],
  accessToken: string,
): Promise<InstagramPostResult> {
  // Instagram carousels require 2-10 items.
  const items = imageUrls.slice(0, 10);

  // Step 1: create a carousel-item container for each image.
  const childIds = await Promise.all(
    items.map((url) =>
      createMediaContainer(igUserId, { image_url: url, is_carousel_item: 'true' }, accessToken),
    ),
  );

  // Step 2: create the parent carousel container referencing all children.
  const parentId = await createMediaContainer(
    igUserId,
    { media_type: 'CAROUSEL', children: childIds.join(','), caption },
    accessToken,
  );

  // Step 3: publish.
  return publishContainer(igUserId, parentId, accessToken);
}

export async function publishToInstagram(
  params: PublishToInstagramParams,
): Promise<InstagramPostResult> {
  const { caption, mediaUrl, mediaType, extraImageUrls, igUserId, accessToken } = params;

  if (mediaType === 'image' && extraImageUrls && extraImageUrls.length > 0) {
    return publishCarousel(igUserId, caption, [mediaUrl, ...extraImageUrls], accessToken);
  }

  if (mediaType === 'video') {
    const containerId = await createMediaContainer(
      igUserId,
      { video_url: mediaUrl, caption, media_type: 'REELS' },
      accessToken,
    );
    await waitForVideoContainer(containerId, accessToken);
    return publishContainer(igUserId, containerId, accessToken);
  }

  // For images: create container, wait for processing, then publish
  const containerId = await createMediaContainer(
    igUserId,
    { image_url: mediaUrl, caption },
    accessToken,
  );
  // Poll until container is ready (images are usually fast but can be slow)
  await waitForVideoContainer(containerId, accessToken, 10);
  return publishContainer(igUserId, containerId, accessToken);
}

export function buildInstagramCaption(caption: string, hashtags: string[]): string {
  const hashtagLine = hashtags.map((t) => `#${t}`).join(' ');
  return [caption, hashtagLine].filter(Boolean).join('\n\n');
}
