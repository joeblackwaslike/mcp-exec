# mcp-exec Project Overview

**Purpose**: MCP server for sandboxed code execution with context window reduction. Exposes `tools(query)` and `exec(code, runtime)` to Claude Code.

**Tech Stack**:
- TypeScript + Node.js (ES modules)
- vitest for testing (with vitest run / vitest watch)
- @anthropic-ai/sandbox-runtime for OS-level sandboxing
- @modelcontextprotocol/sdk for MCP
- Node.js 20.12+

**Code Style**:
- ESM imports with .js extensions
- Type hints everywhere, including type aliases for complex types
- Docstrings on functions (one-liner where appropriate)
- No comments in code unless essential
- vm.Context for session management
- Structured error handling with typed error objects

**Project Structure**:
```
src/
  types.ts              ← ExecResult, ToolSummary, RuntimeParam, ToolCallRecord
  sandbox/
    index.ts            ← exec dispatcher (Task 8 - CURRENT)
    index.test.ts       ← exec dispatcher tests (Task 8 - CURRENT)
    session.ts          ← SessionManager class (already exists)
    session.test.ts     ← session tests
    config.ts           ← reads sandbox config from settings.json
    config.test.ts      ← config tests
    runtimes/
      node.ts           ← runInNode(code, context, opts)
      node.test.ts      ← node runtime tests
      bash.ts           ← runInBash(code, opts)
      bash.test.ts      ← bash runtime tests
```

**Key Type Interfaces**:
- ExecResult: { result: unknown, stdout: string, stderr: string, exitCode: number, tool_calls: ToolCallRecord[] }
- RuntimeParam: 'node' | 'bash' | { type: 'node' | 'bash'; timeout?: number; env?: Record<string, string> }
- SessionManager: getOrCreate(sessionId?, mcpClients?) → vm.Context
