'use client'

import React from 'react'
import Link from 'next/link'

type Props = { children: React.ReactNode }
type State = { hasError: boolean }

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Result page error', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-2xl px-5 py-16 text-center">
          <p className="text-lg font-semibold">
            Something went wrong. Go back and try again.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block font-semibold text-[var(--color-primary)] underline underline-offset-2"
          >
            Back to start
          </Link>
        </div>
      )
    }
    return this.props.children
  }
}
