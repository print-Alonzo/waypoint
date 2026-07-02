import type { Metadata } from 'next'
import { POIS } from '@/lib/data'
import AdminDashboard from '@/components/AdminDashboard'

export const metadata: Metadata = {
  title: 'Admin — Waypoint',
  robots: { index: false, follow: false },
}

export default function AdminPage() {
  // Local-only content tool. The write API refuses to run on Vercel (read-only
  // filesystem), and we hide the UI there too so it isn't exposed on the deployed
  // site. VERCEL is set in Vercel's build/runtime and absent locally.
  if (process.env.VERCEL) {
    return (
      <main className="mx-auto max-w-xl px-5 py-20 text-center">
        <h1 className="text-2xl font-bold">Admin runs locally</h1>
        <p className="mt-3 text-[var(--color-text-muted)]">
          This tool writes places into the dataset on disk, so it only works when
          Waypoint is running on your machine. Clone the repo, run{' '}
          <code className="rounded bg-[var(--color-bg-subtle)] px-1 py-0.5 text-sm">
            npm run dev
          </code>
          , and open <code className="rounded bg-[var(--color-bg-subtle)] px-1 py-0.5 text-sm">/admin</code>.
        </p>
      </main>
    )
  }

  return <AdminDashboard initialPois={POIS} />
}
