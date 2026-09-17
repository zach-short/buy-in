import { defineConfig } from 'vitest/config';

// formatDate/formatTime read the host timezone. Pin it so a test that passes here
// passes on any machine; without this the format suite is machine-dependent, which
// is worse than having no test at all.
process.env.TZ = 'America/New_York';

export default defineConfig({
  test: {
    include: ['packages/core/**/*.test.ts'],
    env: { TZ: 'America/New_York' },
  },
});
