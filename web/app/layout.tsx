import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import ServiceWorkerRegister from '@/components/shared/ServiceWorkerRegister'
import SiteHeader from '@/components/shared/SiteHeader'
import SurveyPromptController from '@/components/validation/SurveyPromptController'
import SessionResetOnParam from '@/components/validation/SessionResetOnParam'

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
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <ServiceWorkerRegister />
        <SessionResetOnParam />
        <SurveyPromptController />
      </body>
    </html>
  )
}
