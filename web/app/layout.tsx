import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600'],
})

export const metadata: Metadata = {
  title: 'Waypoint',
  description: 'Plan your day in Metro Manila',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plusJakartaSans.className}>
      <body className="min-h-screen flex flex-col">
        <header className="px-4 py-3 border-b border-[var(--color-border)]">
          <span className="text-base font-semibold text-[#0D9488]">Waypoint</span>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  )
}
