import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import ServiceWorkerRegister from '@/components/shared/ServiceWorkerRegister'
import SurveyPromptController from '@/components/validation/SurveyPromptController'

// Plus Jakarta Sans stands in for Airbnb's proprietary "Cereal" typeface.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Waypoint',
  description: 'Plan your day in Metro Manila',
  manifest: '/manifest.webmanifest',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plusJakartaSans.className}>
      <body className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
        <header className="sticky top-0 z-10 flex items-center justify-between bg-[var(--color-bg)] border-b border-[var(--color-border)] px-5 py-4">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-[var(--color-primary)]"
          >
            Waypoint
          </Link>
          <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
            Metro Manila
          </span>
        </header>
        <main className="flex-1">{children}</main>
        <ServiceWorkerRegister />
        <SurveyPromptController />
      </body>
    </html>
  )
}
