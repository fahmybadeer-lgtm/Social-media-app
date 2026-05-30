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
    <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col h-screen sticky top-0 bg-gray-900 border-r border-gray-800">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C9A84C]">
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
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900',
                    active
                      ? 'bg-[#C9A84C]/10 text-[#C9A84C]'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200',
                  ].join(' ')}
                  aria-current={active ? 'page' : undefined}
                >
                  <span
                    className={[
                      'flex-shrink-0',
                      active ? 'text-[#C9A84C]' : 'text-gray-500',
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
      <div className="border-t border-gray-800 px-4 py-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#C9A84C]/20 text-xs font-semibold text-[#C9A84C] uppercase">
            {user?.email ? user.email[0] : '?'}
          </div>
          {/* Email */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-gray-400">
              {user?.email ?? 'Not signed in'}
            </p>
            <p className="text-[10px] text-gray-600 mt-0.5">Free plan</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
