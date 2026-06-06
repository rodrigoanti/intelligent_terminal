import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'electron/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@themes': path.resolve(__dirname, 'src/themes'),
      '@i18n': path.resolve(__dirname, 'src/i18n'),
      '@ai': path.resolve(__dirname, 'src/ai'),
    },
  },
})
