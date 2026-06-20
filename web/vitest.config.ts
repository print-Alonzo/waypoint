import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

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
