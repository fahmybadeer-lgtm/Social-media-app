'use client'

import { useEffect, useState } from 'react'
import { type User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface UseSupabaseUserResult {
  user: User | null
  loading: boolean
  error: Error | null
}

/**
 * React hook that keeps an up-to-date reference to the currently authenticated
 * Supabase user.  Subscribes to auth-state changes and cleans up on unmount.
 *
 * @returns { user, loading, error }
 */
export function useSupabaseUser(): UseSupabaseUserResult {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Fetch the current session immediately so the UI does not flash an
    // unauthenticated state on first render.
    supabase.auth
      .getUser()
      .then(({ data, error: getError }) => {
        if (getError) {
          setError(new Error(getError.message))
        } else {
          setUser(data.user ?? null)
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        setLoading(false)
      })

    // Subscribe to subsequent auth events (sign-in, sign-out, token refresh …)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
      setError(null)
    })

    // Clean up the listener when the component unmounts.
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading, error }
}
