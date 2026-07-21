'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Interest, WillingToPay, PricingModel } from '@/lib/validation/validate'
import { track } from '@/lib/validation/track'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const inputClass =
  'w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 text-base ' +
  'focus:outline-none focus:border-[var(--color-text)] focus:ring-1 focus:ring-[var(--color-text)]'

const PRICING_MODEL_OPTIONS: { value: PricingModel; label: string }[] = [
  { value: 'one-time', label: 'One-time purchase' },
  { value: 'monthly', label: 'Monthly subscription' },
  { value: 'per-trip', label: 'Per-trip fee' },
  { value: 'freemium', label: 'Free, with a paid upgrade' },
  { value: 'free-ads', label: 'Free, supported by ads' },
]

// Reusable pill-button group for the 3-option interest / willingness-to-pay
// questions — same "active = coral fill" pattern as PoiSwipeDeck's category Chip.
function PillGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: { value: T; label: string }[]
  value: T | null
  onChange: (v: T) => void
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              value === o.value
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                : 'border-[var(--color-border)] bg-white text-[var(--color-text)] hover:border-[var(--color-text)]'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function PriceField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      <p className="mb-1.5 text-xs text-[var(--color-text-muted)]">{hint}</p>
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--color-text-muted)]">₱</span>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  )
}

function isValidPrice(v: string): boolean {
  const n = Number(v)
  return v.trim() !== '' && Number.isFinite(n) && n >= 0
}

export default function FeedbackView() {
  const router = useRouter()

  useEffect(() => {
    void track('feedback_opened')
  }, [])

  const [interest, setInterest] = useState<Interest | null>(null)
  const [willingToPay, setWillingToPay] = useState<WillingToPay | null>(null)
  const [tooCheap, setTooCheap] = useState('')
  const [goodValue, setGoodValue] = useState('')
  const [gettingExpensive, setGettingExpensive] = useState('')
  const [tooExpensive, setTooExpensive] = useState('')
  const [pricingModel, setPricingModel] = useState<PricingModel | ''>('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle')

  const pricesValid =
    isValidPrice(tooCheap) &&
    isValidPrice(goodValue) &&
    isValidPrice(gettingExpensive) &&
    isValidPrice(tooExpensive)
  const emailValid = EMAIL_RE.test(email.trim())
  const canSubmit =
    interest !== null &&
    willingToPay !== null &&
    pricesValid &&
    pricingModel !== '' &&
    emailValid &&
    consent &&
    status !== 'submitting'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setStatus('submitting')
    const { ok } = await track('submitted', {
      interest,
      willingToPay,
      vanWestendorp: {
        tooCheap: Number(tooCheap),
        goodValue: Number(goodValue),
        gettingExpensive: Number(gettingExpensive),
        tooExpensive: Number(tooExpensive),
      },
      pricingModel,
      email: email.trim(),
      consent,
    })
    if (ok) {
      router.push('/thanks')
    } else {
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Tell us what you think</h1>
      <p className="mt-2 text-[var(--color-text-muted)]">
        A few quick questions — this helps us decide what to build next.
      </p>

      <div className="mt-8">
        <PillGroup
          legend="Would you use Waypoint to plan a real trip?"
          options={[
            { value: 'definitely', label: 'Definitely' },
            { value: 'maybe', label: 'Maybe' },
            { value: 'no', label: 'No' },
          ]}
          value={interest}
          onChange={setInterest}
        />
      </div>

      <div className="mt-7">
        <PillGroup
          legend="Would you pay for it?"
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'maybe', label: 'Maybe' },
            { value: 'no', label: 'No' },
          ]}
          value={willingToPay}
          onChange={setWillingToPay}
        />
      </div>

      <div className="mt-9 mb-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Pricing
        </span>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>

      <p className="text-sm text-[var(--color-text-muted)]">
        Thinking about a price for Waypoint, in Philippine pesos (₱) — prices usually run from
        low to high across the four questions below.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PriceField
          id="too-cheap"
          label="Too cheap"
          hint="So cheap you'd doubt its quality"
          value={tooCheap}
          onChange={setTooCheap}
        />
        <PriceField
          id="good-value"
          label="A bargain"
          hint="Good value for what you'd get"
          value={goodValue}
          onChange={setGoodValue}
        />
        <PriceField
          id="getting-expensive"
          label="Getting pricey"
          hint="Starting to feel expensive, but you'd still consider it"
          value={gettingExpensive}
          onChange={setGettingExpensive}
        />
        <PriceField
          id="too-expensive"
          label="Too expensive"
          hint="So expensive you wouldn't consider it"
          value={tooExpensive}
          onChange={setTooExpensive}
        />
      </div>

      <div className="mt-7">
        <label htmlFor="pricing-model" className="mb-1.5 block text-sm font-semibold">
          Which pricing model would you prefer?
        </label>
        <select
          id="pricing-model"
          className={inputClass}
          value={pricingModel}
          onChange={(e) => setPricingModel(e.target.value as PricingModel)}
        >
          <option value="" disabled>
            Choose one
          </option>
          {PRICING_MODEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-9 mb-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Stay in the loop
        </span>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <label className="mt-3 flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>We&apos;ll only email you when Waypoint launches — no spam.</span>
      </label>

      {status === 'error' && (
        <p className="mt-4 text-sm font-semibold text-[var(--color-flag-error-text)]" role="alert">
          Something went wrong sending your answers. Please try again.
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className={
          canSubmit
            ? 'mt-8 w-full rounded-lg bg-[var(--color-primary)] px-5 py-3.5 text-base font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)]'
            : 'mt-8 w-full cursor-not-allowed rounded-lg bg-[var(--color-bg-subtle)] px-5 py-3.5 text-base font-semibold text-[var(--color-text-muted)]'
        }
      >
        {status === 'submitting' ? 'Sending…' : 'Submit'}
      </button>
    </form>
  )
}
