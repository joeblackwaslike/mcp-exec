---
sidebar_position: 3
description: "result.tool_calls schema, stderr semantics, exit codes, debug logging, and testing strategies."
---

# Observability

## result.tool_calls

Every `exec` response includes a `tool_calls` array that records every downstream MCP tool call made inside the sandbox. This is the primary observability mechanism: it gives you the same per-tool visibility you'd get from native CC `PostToolUse` hooks, but scoped to the exec boundary.

### Schema

```typescript
interface ExecResult {
  result: unknown;              // primary output sent to Claude
  tool_calls: ToolCallRecord[];
  stderr?: string;              // included when exitCode !== 0
  exitCode?: number;            // included when exitCode !== 0
}

interface ToolCallRecord {
  server: string;               // MCP server key from mcp.json
  tool: string;                 // tool name on that server
  duration_ms: number;          // wall-clock time for the call
  error?: string;               // present if the call threw or timed out
}
```

`tool_calls` is always present, even if empty. An empty array means no downstream MCP tools were called during execution (e.g. a pure computation exec with no MCP imports).

### Reading tool_calls

The `exec` tool returns its response as serialized JSON text. In a `PostToolUse` hook or any code that receives the exec response, parse and access `tool_calls` like this:

```typescript
const response = JSON.parse(event.tool_result);

// All tool calls in order of invocation
const allCalls: ToolCallRecord[] = response.tool_calls;

// Filter by server
const githubCalls = allCalls.filter(tc => tc.server === 'github');

// Failed calls only
const errors = allCalls.filter(tc => tc.error != null);

// Total time spent in MCP calls
const totalMcpMs = allCalls.reduce((sum, tc) => sum + tc.duration_ms, 0);
```

### What tool_calls Contains

- **`server`** — the MCP server name as it appears in `.claude/mcp.json`. For example, if your config has `"github": { ... }`, `server` will be `"github"`.
- **`tool`** — the tool name as listed by that server's `listTools()` response. Matches what you'd pass to a native CC hook matcher.
- **`duration_ms`** — wall-clock time from when the bridge received the POST request to when the MCP client returned. Includes MCP server round-trip latency.
- **`error`** — the error message string if the MCP client threw or the call timed out. Absent when the call succeeded.

## stderr

The `stderr` field is included in the exec response only when `exitCode !== 0`. It contains the raw stderr output of the subprocess (Bash/Python) or error details from the Node vm.

**When stderr is populated:**
- **Node**: `console.warn()`, `console.error()`, `console.debug()` output is captured to stderr. Uncaught exceptions surface in `result` as `{ error, line, column }` JSON — stderr may also contain Node runtime warnings.
- **Bash**: anything the script writes to file descriptor 2. Shell error messages, command-not-found errors, and `set -e` failure output appear here.
- **Python**: `uv` startup errors, import errors, and uncaught exception tracebacks all appear in stderr. Python's `print(..., file=sys.stderr)` also goes here.

**stderr is not included in the response when `exitCode === 0`**, even if the subprocess wrote to stderr. This keeps the normal-case response compact. If you need stderr regardless, read it from a debug log or run in a test environment where you control the subprocess.

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success — result contains the output |
| `1` | Runtime error — Node exception, bash nonzero exit, Python unhandled exception |
| `124` | Timeout — SIGTERM was sent to the subprocess; for Python, SIGKILL follows 2 seconds later |
| `127` | Spawn failure — `uv` not found on PATH (Python only) |

When `exitCode !== 0`, the response JSON includes both `stderr` and `exitCode` fields alongside `result` and `tool_calls`. Check `exitCode` first when diagnosing exec failures.

## Debug Logging

mcp-exec writes diagnostic messages to stderr (its own stderr, i.e. the MCP server process stderr) prefixed with `[mcp-exec]`. These are not included in exec responses — they appear in the mcp-exec server logs.

Significant log events:

| Message prefix | Meaning |
|---|---|
| `[mcp-exec] Warning: no sandbox configuration found` | No `sandbox` block in either settings.json — running with srt default permissions |
| `[mcp-exec] Fatal: sandbox initialization failed: ...` | `SandboxManager.initialize()` threw — server exits with code 1 |
| `[mcp-exec] Fatal: failed to register loader hooks: ...` | ESM loader hook registration failed — server exits with code 1 |
| `[mcp-exec] Fatal: ...` (from main catch) | Unhandled error in startup sequence |

To capture these logs when running mcp-exec directly, redirect its stderr:

```sh
node dist/server.js 2>mcp-exec-debug.log
```

When mcp-exec is launched by Claude Code, its stderr is typically visible in CC's MCP server log panel.

## Asserting on tool_calls in Tests

Use `tool_calls` to write structured assertions about what MCP calls an exec workflow made, without relying on side effects or mock servers.

### Basic assertion pattern

```typescript
import { createExecDispatcher } from '../src/sandbox/index.js';
import { SessionManager } from '../src/sandbox/session.js';

// Set up with real or stub clients
const dispatcher = createExecDispatcher(sessions, mockClients, bridge, toolsByServer);

const result = await dispatcher({
  code: `
    import { searchEmails } from 'mcp/gmail';
    const emails = await searchEmails({ query: 'from:boss' });
    return emails.length;
  `,
  runtime: 'node',
});

// Functional assertion
expect(result.exitCode).toBe(0);
expect(result.result).toBe(5);

// Observability assertion
expect(result.tool_calls).toHaveLength(1);
expect(result.tool_calls[0].server).toBe('gmail');
expect(result.tool_calls[0].tool).toBe('searchEmails');
expect(result.tool_calls[0].error).toBeUndefined();
expect(result.tool_calls[0].duration_ms).toBeGreaterThan(0);
```

### Asserting on error cases

```typescript
const result = await dispatcher({
  code: `
    import { createIssue } from 'mcp/github';
    await createIssue({ title: '' });  // invalid args, throws
  `,
  runtime: 'node',
});

expect(result.exitCode).toBe(1);
expect(result.tool_calls[0].error).toMatch(/validation/i);
```

### Asserting on timeout

```typescript
const result = await dispatcher({
  code: `await new Promise(r => setTimeout(r, 99999))`,
  runtime: 'node',
  // pass runtime as config object to set timeout
});

// For bash/python, test timeout via { type: 'bash', timeout: 100 }
expect(result.exitCode).toBe(124);
```

### Sandbox config in tests

Set the `sandbox` block in a local `.claude/settings.json` within your test fixture directory to control network and filesystem access during tests. `resolveSandboxConfig()` reads `process.cwd()` for the project-scope file, so pointing your test runner at the fixture directory is sufficient.

For tests that shouldn't touch the real srt sandbox, set `NODE_ENV=test` or `SKIP_SANDBOX=1`:

```sh
NODE_ENV=test node --test dist/test/exec.test.js
```

When `SKIP_SANDBOX=1`, `SandboxManager.initialize()` is skipped entirely. Loader hooks are also skipped when `NODE_ENV=test`. Both flags are designed for CI environments where sandbox support may not be available.
