'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Image as ImageIcon,
  PenSquare,
  CalendarDays,
  BarChart2,
  Settings,
  Scissors,
  Menu,
  X,
} from 'lucide-react'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'
import { useShopLogo } from '@/hooks/useShopLogo'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <LayoutDashboard className="w-4.5 h-4.5" /> },
  { label: 'Media Library', href: '/media-library', icon: <ImageIcon className="w-4.5 h-4.5" /> },
  { label: 'Composer', href: '/composer', icon: <PenSquare className="w-4.5 h-4.5" /> },
  { label: 'Schedule', href: '/schedule', icon: <CalendarDays className="w-4.5 h-4.5" /> },
  { label: 'Analytics', href: '/analytics', icon: <BarChart2 className="w-4.5 h-4.5" /> },
  { label: 'Settings', href: '/settings', icon: <Settings className="w-4.5 h-4.5" /> },
]

// ---------------------------------------------------------------------------
// Logo — reads the shop's uploaded logo (Settings > Shop Logo) and displays
// it. Falls back to the scissors icon automatically if no logo has been
// uploaded yet, or if the image fails to load.
// ---------------------------------------------------------------------------
function Logo() {
  const { logoUrl } = useShopLogo()

  if (!logoUrl) {
    return (
      <div className="h-10 w-10 rounded-lg bg-[#C9A84C]/20 border border-[#C9A84C]/40 flex items-center justify-center flex-shrink-0">
        <Scissors className="w-5 h-5 text-[#C9A84C]" />
      </div>
    )
  }

  return (
    <div className="relative h-10 w-10 flex-shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt="CNB CUT logo"
        className="h-10 w-10 object-contain"
        onError={(e) => {
          const target = e.currentTarget
          target.style.display = 'none'
          const fallback = target.nextElementSibling as HTMLElement
          if (fallback) fallback.style.display = 'flex'
        }}
      />
      <div className="h-10 w-10 rounded-lg bg-[#C9A84C]/20 border border-[#C9A84C]/40 items-center justify-center hidden">
        <Scissors className="w-5 h-5 text-[#C9A84C]" />
      </div>
    </div>
  )
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <ul className="space-y-1" role="list">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href)
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={[
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]',
                active
                  ? 'bg-[#C9A84C]/10 text-[#C9A84C]'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              <span className={['flex-shrink-0', active ? 'text-[#C9A84C]' : 'text-gray-500'].join(' ')}>
                {item.icon}
              </span>
              {item.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#C9A84C]" />}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function UserFooter({ user }: { user: { email?: string | null } | null }) {
  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <div className="border-t border-gray-800 px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#C9A84C]/20 text-xs font-semibold text-[#C9A84C] uppercase">
          {user?.email ? user.email[0] : '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-gray-400">{user?.email ?? 'Not signed in'}</p>
          <p className="text-[10px] text-gray-600 mt-0.5">CNB CUT</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        className="mt-3 w-full text-left text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}

export default function SidebarNav() {
  const pathname = usePathname()
  const { user } = useSupabaseUser()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close the mobile drawer whenever the route changes (adjusting state
  // during render, per React's guidance, instead of inside an effect).
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    if (mobileOpen) setMobileOpen(false)
  }

  if (pathname.startsWith('/auth')) return null

  return (
    <>
      {/* Mobile top bar (below lg) */}
      <div className="lg:hidden w-full flex items-center justify-between gap-3 px-4 h-14 border-b border-gray-800 bg-gray-900 sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-sm font-bold text-[#C9A84C] tracking-widest">CNB CUT</span>
        </div>
        <button
          type="button"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer + backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={[
          'lg:hidden fixed top-0 left-0 z-50 h-screen w-72 max-w-[80%] flex flex-col bg-gray-900 border-r border-gray-800',
          'transition-transform duration-200 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        aria-label="Primary navigation"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <span className="text-base font-bold text-[#C9A84C] tracking-widest leading-none">CNB CUT</span>
              <p className="text-[10px] text-gray-500 mt-0.5 tracking-wider uppercase">Barber Shop</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </nav>
        <UserFooter user={user} />
      </aside>

      {/* Desktop sidebar (lg and up) */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col h-screen sticky top-0 bg-gray-900 border-r border-gray-800">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800">
          <Logo />
          <div>
            <span className="text-base font-bold text-[#C9A84C] tracking-widest leading-none">CNB CUT</span>
            <p className="text-[10px] text-gray-500 mt-0.5 tracking-wider uppercase">Barber Shop</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks pathname={pathname} />
        </nav>
        <UserFooter user={user} />
      </aside>
    </>
  )
}
