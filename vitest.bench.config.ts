import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks',
    include: ['src/benchmarks/**/*.bench.ts'],
    setupFiles: ['src/benchmarks/setup.ts'],
  },
});
