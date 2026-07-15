import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ScheduleView from '@/components/schedule/ScheduleView';

// ---------------------------------------------------------------------------
// Page metadata
// ---------------------------------------------------------------------------

export const metadata = {
  title: 'Schedule | CNB CUT',
  description: 'See every upcoming, published, and failed post across all platforms.',
};

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default async function SchedulePage() {
  // Auth guard — same pattern as Media Library.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Sidebar is rendered once, site-wide, by the root layout.
  return (
    <div className="flex flex-col min-w-0 min-h-screen bg-gray-950">
      {/* Page header */}
      <header className="flex items-center gap-4 px-6 h-16 border-b border-gray-800 bg-gray-950 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white leading-tight">Schedule</h1>
          <p className="text-xs text-gray-500 leading-tight mt-0.5">
            Everything upcoming, published, and failed across your platforms
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <ScheduleView />
      </div>
    </div>
  );
}
