const GRAPH_API_VERSION = 'v20.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface FacebookPostResult {
  id: string;
}

export interface PublishToFacebookParams {
  message: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  pageId: string;
  accessToken: string;
}

async function getPageAccessToken(userToken: string, pageId: string): Promise<string> {const envPageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
if (envPageToken) return envPageToken;
  const res = await fetch(`${GRAPH_API_BASE}/me/accounts?access_token=${userToken}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const page = data.data?.find((p: {id: string; access_token: string}) => p.id === pageId);
  if (page) return page.access_token;
  return userToken;
}

async function graphPost(
  endpoint: string,
  params: Record<string, string>,
): Promise<FacebookPostResult> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });

  const data = (await res.json()) as {
    id?: string;
    post_id?: string;
    error?: { message?: string; code?: number; type?: string };
  };

  if (!res.ok || data.error) {
    throw new Error(
      data.error?.message ?? `Facebook Graph API error ${res.status}`,
    );
  }

  const id = data.id ?? data.post_id;
  if (!id) {
    throw new Error('Facebook API returned no post ID');
  }

  return { id };
}

export async function publishToFacebook(
  params: PublishToFacebookParams,
): Promise<FacebookPostResult> {
  const { message, mediaUrl, mediaType, pageId, accessToken } = params;
  
  const pageToken = await getPageAccessToken(accessToken, pageId);

  if (mediaUrl && mediaType === 'image') {
    return graphPost(`${GRAPH_API_BASE}/${pageId}/photos`, {
      url: mediaUrl,
      caption: message,
      access_token: pageToken,
    });
  }

  if (mediaUrl && mediaType === 'video') {
    return graphPost(`${GRAPH_API_BASE}/${pageId}/videos`, {
      file_url: mediaUrl,
      description: message,
      access_token: pageToken,
    });
  }

  return graphPost(`${GRAPH_API_BASE}/${pageId}/feed`, {
    message,
    access_token: pageToken,
  });
}

export function buildFacebookMessage(
  caption: string,
  hashtags: string[],
): string {
  const hashtagLine = hashtags.map((t) => `#${t}`).join(' ');
  return [caption, hashtagLine].filter(Boolean).join('\n\n');
}
