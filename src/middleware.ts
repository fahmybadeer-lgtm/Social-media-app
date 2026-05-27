import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require authentication
const PROTECTED_ROUTES = ['/media-library', '/composer', '/editor']

// Returns true when the pathname is one that requires a logged-in user
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

export async function middleware(request: NextRequest) {
  // Start with a pass-through response that we will augment with cookies.
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Persist refreshed cookies back onto the request so that any
          // downstream Server Component sees the new values.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Re-create the response so the browser also receives the cookies.
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not run any code between createServerClient and
  // supabase.auth.getUser(). Any logic here makes it very hard to debug
  // users being randomly logged out.
  //
  // IMPORTANT: Always use getUser() for authentication decisions.
  // getSession() is unverified and must not be used for access control.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Redirect unauthenticated users away from protected routes
  if (!user && isProtectedRoute(pathname)) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // IMPORTANT: You *must* return supabaseResponse as-is (or copy all of its
  // cookies to any new response you create). Failing to do so will cause
  // browsers and servers to fall out of sync and terminate sessions early.

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image  (image optimisation files)
     * - favicon.ico  (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
