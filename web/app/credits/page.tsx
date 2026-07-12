import Link from 'next/link'
import type { Metadata } from 'next'
import { POIS } from '@/lib/poi/data'
import PhotoCredits from '@/components/PhotoCredits'

export const metadata: Metadata = {
  title: 'Photo credits — Waypoint',
}

export default function CreditsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Photo credits</h1>
      <p className="mt-2 text-[var(--color-text-muted)]">
        Landmark photos are used under their respective Creative Commons / public-domain licenses,
        sourced from Wikimedia Commons. Thanks to the photographers below.
      </p>
      <div className="mt-6">
        <PhotoCredits pois={POIS} />
      </div>
      <div className="mt-8">
        <Link
          href="/"
          className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  )
}
