# mcp-exec task runner

# Install dependencies
install:
    npm install

# Run in development mode
dev:
    npx tsx src/server.ts

# Run all tests
test:
    npx vitest run

# Run tests in watch mode
test-watch:
    npx vitest

# Build for distribution
build:
    npx tsc

# Run a single test file
test-file FILE:
    npx vitest run {{FILE}}
