/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    env: { TZ: 'UTC' },
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      include: ['src/api/billing.ts', 'src/api/screening.ts', 'src/api/tcm.ts'],
      reporter: ['text', 'lcov'],
      thresholds: {
        'src/api/billing.ts':   { branches: 100, functions: 100, lines: 100 },
        'src/api/screening.ts': { branches: 100, functions: 100, lines: 100 },
        'src/api/tcm.ts':       { branches: 100, functions: 100, lines: 100 },
      },
    },
  },
})
