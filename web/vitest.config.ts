import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Node 25+ ships an experimental, on-by-default Web Storage API whose globalThis.localStorage
// is a non-functional stub unless --localstorage-file is set. It shadows jsdom's real
// localStorage in jsdom-environment test files (Vitest's global allowlist predates this Node
// API). Disable it so jsdom's Storage implementation is used instead.
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --no-experimental-webstorage`.trim()

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    // Mirror tsconfig "@/*" -> web root so component tests resolve internal imports.
    alias: { '@': root },
  },
  test: {
    // Default env stays node so the pure lib tests run unchanged.
    // .tsx component tests opt into jsdom via a `// @vitest-environment jsdom` docblock.
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
