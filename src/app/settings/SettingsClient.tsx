'use client'

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { CheckCircle, XCircle, Loader2, Share2 } from 'lucide-react';

interface PlatformInfo {
  username: string | null;
  connectedAt: string;
}

interface Props {
  connectedPlatforms: Record<string, PlatformInfo>;
}

const PLATFORMS = [
  {
    id: 'facebook',
    label: 'Facebook',
    icon: <Share2 className="w-5 h-5" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
    connectUrl: '/api/auth/facebook',
    disconnectUrl: '/api/auth/facebook/disconnect',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    icon: <Share2 className="w-5 h-5" />,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10 border-pink-500/30',
    connectUrl: '/api/auth/instagram',
    disconnectUrl: '/api/auth/instagram/disconnect',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    icon: <Share2 className="w-5 h-5" />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/30',
    connectUrl: '/api/auth/tiktok',
    disconnectUrl: '/api/auth/tiktok/disconnect',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: <Share2 className="w-5 h-5" />,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10 border-sky-500/30',
    connectUrl: null, // coming soon
    disconnectUrl: null,
  },
];

function SettingsContent({ connectedPlatforms }: Props) {
  const searchParams = useSearchParams();
  const [connected, setConnected] = useState(connectedPlatforms);
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'facebook') {
      setToast({ type: 'success', message: 'Facebook page connected successfully!' });
      window.history.replaceState({}, '', '/settings');
    } else if (success === 'instagram') {
      setToast({ type: 'success', message: 'Instagram account connected successfully!' });
      window.history.replaceState({}, '', '/settings');
    } else if (success === 'tiktok') {
      setToast({ type: 'success', message: 'TikTok account connected successfully!' });
      window.history.replaceState({}, '', '/settings');
    } else if (error) {
      const messages: Record<string, string> = {
        facebook_denied: 'Facebook connection was cancelled.',
        facebook_token: 'Failed to get Facebook token. Try again.',
        facebook_pages: 'Could not access your Facebook pages.',
        facebook_page_not_found: 'CNB Cut page not found on your account.',
        facebook_save: 'Failed to save connection. Try again.',
        instagram_no_facebook: 'Connect Facebook first, then connect Instagram.',
        instagram_not_found: 'No Instagram Business account found on your Facebook page. Make sure your Instagram is linked to your CNB CUT Facebook page.',
        instagram_save: 'Failed to save Instagram connection. Try again.',
        tiktok_unauthorized: 'You must be logged in to connect TikTok.',
        tiktok_denied: 'TikTok connection was cancelled.',
        tiktok_token: 'Failed to get TikTok token. Try again.',
        tiktok_save: 'Failed to save TikTok connection. Try again.',
      };
      const detail = searchParams.get('detail');
      const baseMessage = messages[error] ?? 'Connection failed. Try again.';
      setToast({ type: 'error', message: detail ? `${baseMessage} (${decodeURIComponent(detail)})` : baseMessage });
      window.history.replaceState({}, '', '/settings');
    }
  }, [searchParams]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function handleDisconnect(platformId: string, disconnectUrl: string) {
    setLoading(platformId);
    try {
      const res = await fetch(disconnectUrl, { method: 'POST' });
      if (res.ok) {
        const updated = { ...connected };
        delete updated[platformId];
        setConnected(updated);
        setToast({ type: 'success', message: `${platformId} disconnected.` });
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 lg:p-10">
      {/* Toast */}
      {toast && (
        <div className={[
          'fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl max-w-sm',
          toast.type === 'success'
            ? 'border-green-500/40 bg-green-900/80 text-green-200'
            : 'border-red-500/40 bg-red-900/80 text-red-200',
        ].join(' ')}>
          {toast.type === 'success'
            ? <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            : <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
          <p className="text-sm">{toast.message}</p>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
        <p className="text-sm text-gray-400 mb-8">Connect your social accounts to start posting.</p>

        <div className="space-y-4">
          {PLATFORMS.map((platform) => {
            const isConnected = !!connected[platform.id];
            const info = connected[platform.id];
            const isLoading = loading === platform.id;

            return (
              <div
                key={platform.id}
                className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-5 py-4"
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${platform.bgColor} ${platform.color}`}>
                    {platform.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{platform.label}</p>
                    {isConnected && info ? (
                      <p className="text-xs text-green-400 mt-0.5">
                        Connected {info.username ? `as ${info.username}` : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-0.5">Not connected</p>
                    )}
                  </div>
                </div>

                <div>
                  {isConnected && platform.disconnectUrl ? (
                    <button
                      onClick={() => handleDisconnect(platform.id, platform.disconnectUrl!)}
                      disabled={isLoading}
                      className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Disconnect
                    </button>
                  ) : platform.connectUrl ? (
                    <a
                      href={platform.connectUrl}
                      className="flex items-center gap-2 rounded-lg bg-[#C9A84C] px-4 py-2 text-xs font-semibold text-black hover:bg-[#d4b35e] transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Connect
                    </a>
                  ) : (
                    <span className="rounded-lg border border-gray-700 px-4 py-2 text-xs text-gray-600">
                      Coming soon
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function SettingsClient(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <SettingsContent {...props} />
    </Suspense>
  );
}
