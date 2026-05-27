'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Loader2, Zap, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Google SVG icon
// ---------------------------------------------------------------------------

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Password strength helper
// ---------------------------------------------------------------------------

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' }
  if (score === 2) return { score, label: 'Fair', color: 'bg-amber-500' }
  if (score === 3) return { score, label: 'Good', color: 'bg-yellow-400' }
  return { score, label: 'Strong', color: 'bg-green-500' }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const strength = password ? passwordStrength(password) : null

  // --------------------------------------------------------------------------
  // Email / password sign-up
  // --------------------------------------------------------------------------

  async function handleSignUp(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      setConfirmed(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // --------------------------------------------------------------------------
  // Google OAuth
  // --------------------------------------------------------------------------

  async function handleGoogleSignUp() {
    setError(null)
    setGoogleLoading(true)

    try {
      const supabase = createClient()
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (oauthError) {
        setError(oauthError.message)
        setGoogleLoading(false)
      }
    } catch {
      setError('Failed to initiate Google sign-up.')
      setGoogleLoading(false)
    }
  }

  // --------------------------------------------------------------------------
  // Success state
  // --------------------------------------------------------------------------

  if (confirmed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 py-12">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-900/40 border border-green-500/40">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Check your email</h2>
              <p className="mt-2 text-sm text-gray-400">
                We&apos;ve sent a confirmation link to{' '}
                <span className="font-medium text-indigo-400">{email}</span>.
                Click the link to confirm your account and start using SocialStudio.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 px-6 py-5 text-sm text-gray-500 space-y-1">
            <p>Didn&apos;t receive the email? Check your spam folder.</p>
          </div>

          <p className="text-sm text-gray-500">
            Already confirmed?{' '}
            <Link
              href="/auth/login"
              className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // Sign-up form
  // --------------------------------------------------------------------------

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 py-12">
      <div className="w-full max-w-md space-y-8">

        {/* Logo */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-900/50">
            <Zap className="w-6 h-6 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-indigo-400 tracking-tight">
              SocialStudio
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Create your free account
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 px-8 py-8 shadow-2xl space-y-6">

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 pr-10 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Strength meter */}
              {strength && (
                <div className="space-y-1">
                  <div className="flex gap-1 h-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={[
                          'flex-1 rounded-full transition-colors duration-300',
                          i <= strength.score ? strength.color : 'bg-gray-700',
                        ].join(' ')}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    Password strength:{' '}
                    <span
                      className={
                        strength.score <= 1
                          ? 'text-red-400'
                          : strength.score === 2
                          ? 'text-amber-400'
                          : strength.score === 3
                          ? 'text-yellow-400'
                          : 'text-green-400'
                      }
                    >
                      {strength.label}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className={[
                'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150',
                loading || !email || !password
                  ? 'cursor-not-allowed bg-gray-700 text-gray-400'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 shadow-lg shadow-indigo-900/30',
              ].join(' ')}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-gray-900 px-3 text-xs text-gray-500">
                or continue with
              </span>
            </div>
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={googleLoading}
            className={[
              'flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-150',
              googleLoading
                ? 'cursor-not-allowed border-gray-700 text-gray-500'
                : 'border-gray-700 text-gray-300 hover:border-gray-600 hover:bg-gray-800 hover:text-white',
            ].join(' ')}
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          {/* Terms note */}
          <p className="text-center text-xs text-gray-600">
            By creating an account you agree to our{' '}
            <span className="text-gray-500">Terms of Service</span> and{' '}
            <span className="text-gray-500">Privacy Policy</span>.
          </p>

          {/* Sign in link */}
          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link
              href="/auth/login"
              className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
