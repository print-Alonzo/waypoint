// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import ServiceWorkerRegister from '@/components/shared/ServiceWorkerRegister'

function installServiceWorkerStub() {
  const register = vi.fn().mockResolvedValue(undefined)
  const unregister = vi.fn().mockResolvedValue(undefined)
  const getRegistrations = vi.fn().mockResolvedValue([{ unregister }])
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { register, getRegistrations },
    configurable: true,
  })
  return { register, unregister, getRegistrations }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  // @ts-expect-error - cleaning up the test-only stub
  delete navigator.serviceWorker
})

describe('ServiceWorkerRegister', () => {
  it('renders nothing', () => {
    installServiceWorkerStub()
    const { container } = render(<ServiceWorkerRegister />)
    expect(container).toBeEmptyDOMElement()
  })

  it('registers the worker in production (offline flag is on by default)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { register } = installServiceWorkerStub()
    render(<ServiceWorkerRegister />)
    await Promise.resolve()
    expect(register).toHaveBeenCalledWith('/sw.js')
  })

  it('unregisters any existing worker outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const { register, unregister, getRegistrations } = installServiceWorkerStub()
    render(<ServiceWorkerRegister />)
    await Promise.resolve()
    await Promise.resolve()
    expect(register).not.toHaveBeenCalled()
    expect(getRegistrations).toHaveBeenCalled()
    expect(unregister).toHaveBeenCalled()
  })

  it('does nothing when the browser has no serviceWorker support', () => {
    // @ts-expect-error - simulating an unsupported browser
    delete navigator.serviceWorker
    expect(() => render(<ServiceWorkerRegister />)).not.toThrow()
  })
})
