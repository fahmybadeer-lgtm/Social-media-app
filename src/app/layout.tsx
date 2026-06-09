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
      <body className="h-full bg-gray-950 text-white">
        <div className="flex h-full">
          {/* Sidebar */}
          <SidebarNav />

          {/* Main content area */}
          <main className="flex-1 overflow-auto min-h-screen">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
