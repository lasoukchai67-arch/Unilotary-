import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Run tests in a timezone that is NOT Asia/Vientiane so date conversion code
// cannot accidentally rely on the machine's local zone.
process.env.TZ = 'America/New_York';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
