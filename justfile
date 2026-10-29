# mcp-exec task runner

# Install dependencies
install:
    pnpm install

# Run in development mode
dev:
    bun src/server.ts

# Run all tests
test:
    bunx vitest run

# Run tests in watch mode
test-watch:
    bunx vitest

# Build for distribution
build:
    bunx tsc

# Run a single test file
test-file FILE:
    bunx vitest run {{FILE}}

# Build then run smoke tests against the built binary (run before every release)
smoke:
    pnpm build
    node scripts/smoke-test.mjs
