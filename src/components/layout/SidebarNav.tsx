'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Image, PenSquare, Settings, Zap } from 'lucide-react'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: <LayoutDashboard className="w-4.5 h-4.5" />,
  },
  {
    label: 'Media Library',
    href: '/media-library',
    icon: <Image className="w-4.5 h-4.5" />,
  },
  {
    label: 'Composer',
    href: '/composer',
    icon: <PenSquare className="w-4.5 h-4.5" />,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="w-4.5 h-4.5" />,
  },
]

export default function SidebarNav() {
  const pathname = usePathname()
  const { user } = useSupabaseUser()

  // Hide sidebar on auth pages
  if (pathname.startsWith('/auth')) {
    return null
  }

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col h-screen sticky top-0 bg-black border-r border-[#1A1A1A]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[#1A1A1A]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C9A84C] shadow-lg shadow-[#C9A84C]/20">
          <Zap className="w-4.5 h-4.5 text-black fill-black" />
        </div>
        <span className="text-lg font-bold text-[#C9A84C] tracking-tight">
          SocialStudio
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1" role="list">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={[
                    'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                    active
                      ? 'bg-[rgba(201,168,76,0.15)] text-[#C9A84C]'
                      : 'text-[#A0A0A0] hover:bg-[#111111] hover:text-[#E5E5E5]',
                  ].join(' ')}
                  aria-current={active ? 'page' : undefined}
                >
                  {/* Gold left border accent for active item */}
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#C9A84C] rounded-full" />
                  )}
                  <span
                    className={[
                      'flex-shrink-0',
                      active ? 'text-[#C9A84C]' : 'text-[#A0A0A0]',
                    ].join(' ')}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#C9A84C]" />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User info at bottom */}
      <div className="border-t border-[#1A1A1A] px-4 py-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#C9A84C] text-xs font-semibold text-black uppercase">
            {user?.email ? user.email[0] : '?'}
          </div>
          {/* Email */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-[#A0A0A0]">
              {user?.email ?? 'Not signed in'}
            </p>
            <p className="text-[10px] text-[#A0A0A0]/50 mt-0.5">Free plan</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
