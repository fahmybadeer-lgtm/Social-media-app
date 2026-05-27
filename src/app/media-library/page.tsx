import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SidebarNav } from '@/components/ui/SidebarNav';
import { MediaLibraryGrid } from '@/components/media/MediaLibraryGrid';

// ---------------------------------------------------------------------------
// Page metadata
// ---------------------------------------------------------------------------

export const metadata = {
  title: 'Media Library | SocialFlow',
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
  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Sidebar navigation */}
      <SidebarNav />

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
      </main>
    </div>
  );
}
