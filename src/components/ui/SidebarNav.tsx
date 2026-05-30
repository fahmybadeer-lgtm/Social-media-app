'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  ImagePlay,
  PenSquare,
  CalendarDays,
  BarChart2,
  Settings,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Nav configuration
// ---------------------------------------------------------------------------

const PRIMARY_NAV: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: <LayoutGrid className="w-4.5 h-4.5" />,
  },
  {
    label: 'Media Library',
    href: '/media-library',
    icon: <ImagePlay className="w-4.5 h-4.5" />,
  },
  {
    label: 'Composer',
    href: '/composer',
    icon: <PenSquare className="w-4.5 h-4.5" />,
  },
  {
    label: 'Schedule',
    href: '/schedule',
    icon: <CalendarDays className="w-4.5 h-4.5" />,
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: <BarChart2 className="w-4.5 h-4.5" />,
  },
];

const SECONDARY_NAV: NavItem[] = [
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="w-4.5 h-4.5" />,
  },
];

// ---------------------------------------------------------------------------
// NavLink
// ---------------------------------------------------------------------------

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive =
    item.href === '/'
      ? pathname === '/'
      : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium',
        'transition-colors duration-150',
        isActive
          ? 'bg-[#C9A84C]/10 text-[#C9A84C]'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <span
        className={cn(
          'shrink-0 w-4 h-4',
          isActive ? 'text-[#C9A84C]' : 'text-gray-500'
        )}
      >
        {item.icon}
      </span>
      <span className="truncate">{item.label}</span>
      {isActive && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#C9A84C] shrink-0" />
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// SidebarNav
// ---------------------------------------------------------------------------

export function SidebarNav() {
  return (
    <aside
      className="flex flex-col w-60 shrink-0 bg-gray-900 border-r border-gray-800
                 min-h-screen sticky top-0 h-screen overflow-y-auto"
      aria-label="Primary navigation"
    >
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-gray-800 shrink-0">
        <div
          className="w-8 h-8 rounded-lg bg-[#C9A84C] flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <Sparkles className="w-4 h-4 text-black" />
        </div>
        <span className="text-base font-semibold text-white tracking-tight">
          SocialFlow
        </span>
      </div>

      {/* ── Primary nav ──────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* ── Secondary nav ────────────────────────────────────────────────── */}
      <div className="px-3 pb-4 flex flex-col gap-0.5 border-t border-gray-800 pt-4 shrink-0">
        {SECONDARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        {/* Sign out – not a real route, handled client-side */}
        <button
          type="button"
          className="flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium
                     text-gray-400 hover:text-white hover:bg-gray-800
                     transition-colors duration-150 w-full text-left"
          onClick={() => {
            // Navigation handled by parent / auth provider
            window.location.href = '/auth/login';
          }}
        >
          <LogOut className="w-4 h-4 text-gray-500 shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

export default SidebarNav;
