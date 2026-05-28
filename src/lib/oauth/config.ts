export type OAuthPlatform = 'facebook' | 'instagram' | 'tiktok'

export interface PlatformOAuthConfig {
  authUrl: string
  tokenUrl: string
  scopes: string[]
  clientIdEnvVar: string
  clientSecretEnvVar: string
  pkce: boolean
  clientIdParam: string
}

export const OAUTH_CONFIGS: Record<OAuthPlatform, PlatformOAuthConfig> = {
  facebook: {
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    scopes: ['public_profile', 'email', 'pages_manage_posts', 'pages_show_list'],
    clientIdEnvVar: 'FACEBOOK_APP_ID',
    clientSecretEnvVar: 'FACEBOOK_APP_SECRET',
    pkce: false,
    clientIdParam: 'client_id',
  },
  instagram: {
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'],
    clientIdEnvVar: 'FACEBOOK_APP_ID',
    clientSecretEnvVar: 'FACEBOOK_APP_SECRET',
    pkce: false,
    clientIdParam: 'client_id',
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['user.info.basic', 'video.publish'],
    clientIdEnvVar: 'TIKTOK_CLIENT_KEY',
    clientSecretEnvVar: 'TIKTOK_CLIENT_SECRET',
    pkce: true,
    clientIdParam: 'client_key',
  },
}

export const VALID_PLATFORMS: OAuthPlatform[] = ['facebook', 'instagram', 'tiktok']

export function isValidOAuthPlatform(platform: string): platform is OAuthPlatform {
  return VALID_PLATFORMS.includes(platform as OAuthPlatform)
}
