import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

// ---------------------------------------------------------------------------
// Page metadata
// ---------------------------------------------------------------------------

export const metadata = {
  title: 'Analytics | CNB CUT',
  description: 'Activity overview across your posts and platforms.',
};

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default async function AnalyticsPage() {
  // Auth guard — same pattern as Media Library / Schedule.
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
          <h1 className="text-lg font-semibold text-white leading-tight">Analytics</h1>
          <p className="text-xs text-gray-500 leading-tight mt-0.5">
            Activity across your posts — not platform engagement data (yet)
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <AnalyticsDashboard />
      </div>
    </div>
  );
}
