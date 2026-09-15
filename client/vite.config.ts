/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// v8 coverage instrumentation slows down jsdom-heavy tests enough to flake against the default
// 5s test timeout on this machine -- give them headroom under `test:coverage` only, so the
// plain `test` run keeps the default timeout instead of masking a genuinely hanging test.
const isCoverageRun = process.argv.includes('--coverage');

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    ...(isCoverageRun ? { testTimeout: 15_000 } : {}),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
    },
  },
});
