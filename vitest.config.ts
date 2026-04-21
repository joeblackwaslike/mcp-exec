import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        // server.ts is a process entry point tested via subprocess integration test —
        // v8 coverage profiler cannot instrument a child process.
        'src/server.ts',
      ],
    },
  },
});
