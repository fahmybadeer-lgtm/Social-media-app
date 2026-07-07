import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MediaLibraryGrid } from '@/components/media/MediaLibraryGrid';

// ---------------------------------------------------------------------------
// Page metadata
// ---------------------------------------------------------------------------

export const metadata = {
  title: 'Media Library | CNB CUT',
  description: 'Upload and manage your images and videos for social media posts.',
};

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default async function MediaLibraryPage() {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // Sidebar is rendered once, site-wide, by the root layout.
  return (
    <div className="flex flex-col min-w-0 min-h-screen bg-gray-950">
      {/* Page header */}
      <header className="flex items-center gap-4 px-6 h-16 border-b border-gray-800 bg-gray-950 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white leading-tight">
            Media Library
          </h1>
          <p className="text-xs text-gray-500 leading-tight mt-0.5">
            Upload and manage your content
          </p>
        </div>
      </header>

      {/* Grid content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <MediaLibraryGrid userId={user.id} />
      </div>
    </div>
  );
}
