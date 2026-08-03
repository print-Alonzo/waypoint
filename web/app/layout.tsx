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

// Absolute origin for og:image and other URL-based metadata fields. Set here
// on the root layout so EVERY route inherits it — app/opengraph-image.tsx
// applies site-wide, so scoping this to the landing page alone leaves the
// other routes resolving against localhost at build time.
// NEXT_PUBLIC_SITE_URL wins; on Vercel fall back to the stable production
// domain (not VERCEL_URL, which is per-deployment); locally, the dev server.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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
