import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

// Plus Jakarta Sans stands in for Airbnb's proprietary "Cereal" typeface.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Waypoint',
  description: 'Plan your day in Metro Manila',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plusJakartaSans.className}>
      <body className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
        <header className="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[var(--color-border)] px-5 py-4">
          <span className="text-xl font-bold tracking-tight text-[var(--color-primary)]">
            Waypoint
          </span>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  )
}
