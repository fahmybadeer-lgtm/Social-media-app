import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Zap, Image, PenSquare, Calendar, ArrowRight, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Feature list for the landing hero
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: <Image className="w-5 h-5 text-indigo-400" />,
    title: 'Media Library',
    description: 'Upload and organise all your images and videos in one place.',
  },
  {
    icon: <PenSquare className="w-5 h-5 text-pink-400" />,
    title: 'AI Caption Generator',
    description: 'Turn a short concept into a polished caption with one click.',
  },
  {
    icon: <Calendar className="w-5 h-5 text-sky-400" />,
    title: 'Schedule & Publish',
    description: 'Schedule posts to Facebook, Instagram, TikTok, and LinkedIn.',
  },
]

const PLAN_FEATURES = [
  'Up to 5 social accounts',
  'AI caption generation',
  'Media library (5 GB)',
  'Post scheduling',
  'Analytics dashboard',
]

// ---------------------------------------------------------------------------
// Page — server component with auth check
// ---------------------------------------------------------------------------

export default async function HomePage() {
  // If the user is already signed in, send them straight to the app
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/media-library')
  }

  // --------------------------------------------------------------------------
  // Landing page (unauthenticated)
  // --------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ------------------------------------------------------------------ */}
      {/* Navbar */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b border-gray-800 bg-gray-900/70 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="text-lg font-bold text-indigo-400 tracking-tight">
              SocialStudio
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/30"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        {/* Background glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl"
        >
          <div
            className="relative left-1/2 -translate-x-1/2 aspect-[1155/678] w-[72rem] bg-gradient-to-tr from-indigo-900 to-purple-900 opacity-20"
            style={{ clipPath: 'ellipse(50% 40% at 50% 0%)' }}
          />
        </div>

        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-600/10 px-4 py-1.5">
            <Zap className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400" />
            <span className="text-xs font-medium text-indigo-300">
              CNB CUT Barbershop Social Media Manager
            </span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl leading-tight">
            Welcome to{' '}
            <span className="text-indigo-400">CNB CUT</span>
          </h1>

          <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Create, schedule, and publish stunning content across all your social
            platforms from a single, beautiful dashboard. Powered by AI.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/40"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auth/login"
              className="flex items-center gap-2 rounded-xl border border-gray-700 px-8 py-3.5 text-base font-medium text-gray-300 hover:border-gray-600 hover:bg-gray-800 hover:text-white transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Feature cards */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-16 sm:py-20 border-t border-gray-800">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-white mb-10">
            Everything you need to grow on social media
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-800">
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold text-white">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Pricing / CTA */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-16 sm:py-20 border-t border-gray-800">
        <div className="mx-auto max-w-md px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">
            Start for free today
          </h2>
          <p className="text-sm text-gray-400 mb-8">
            No credit card required. Cancel any time.
          </p>

          <div className="rounded-2xl border border-indigo-500/30 bg-gray-900 p-8 text-left space-y-5">
            <div>
              <span className="text-4xl font-extrabold text-white">$0</span>
              <span className="ml-1 text-sm text-gray-400">/ month</span>
            </div>
            <ul className="space-y-3">
              {PLAN_FEATURES.map((feat) => (
                <li key={feat} className="flex items-center gap-3 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  {feat}
                </li>
              ))}
            </ul>
            <Link
              href="/auth/signup"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/30 mt-2"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t border-gray-800 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600">
              <Zap className="w-3 h-3 text-white fill-white" />
            </div>
            <span className="text-sm font-semibold text-indigo-400">CNB CUT</span>
          </div>
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} SocialStudio. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
