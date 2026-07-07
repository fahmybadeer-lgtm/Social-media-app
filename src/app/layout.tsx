import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import SidebarNav from '@/components/layout/SidebarNav'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'CNB CUT - Social Media Manager',
  description:
    'Create, schedule, and manage your social media posts across all platforms from one place.',
    icons: {
          apple: '/apple-touch-icon.png',
          icon: '/icon-512.png',
    },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-gray-950 text-white overflow-x-hidden">
        {/*
          Mobile: stack vertically (top bar above content, full width, no
          reserved sidebar column). Desktop (lg+): row layout, sidebar on
          the left at its fixed width, content filling the rest — this
          matches the original desktop behavior exactly.
        */}
        <div className="flex flex-col lg:flex-row h-full w-full overflow-x-hidden">
          {/* Sidebar */}
          <SidebarNav />

          {/* Main content area */}
          <main className="flex-1 w-full overflow-auto min-h-screen">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
