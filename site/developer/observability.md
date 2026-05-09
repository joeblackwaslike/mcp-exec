---
description: The tool_calls schema for exec result observability and caching implications
---

# Observability

## `tool_calls` schema

Every exec result includes a `tool_calls` array that records what happened inside the sandbox. Use this to restore per-tool observability in plugins that cannot rely on CC hook events.

```typescript
interface ExecResult {
  result: string             // the final output returned to Claude
  tool_calls: ToolCallRecord[]
}

interface ToolCallRecord {
  server: string             // MCP server name (matches key in CC's mcp.json)
  tool: string               // tool name on that server
  duration_ms: number        // wall-clock time for the tool call
  error?: string             // present only if the call threw or timed out
}
```

## Usage example

A plugin that logs every GitHub tool call from the `PostToolUse` event on `exec`:

```typescript
// In PostToolUse handler for the exec tool:
const result = JSON.parse(execResult.output);
const githubCalls = result.tool_calls.filter(tc => tc.server === "github");
for (const call of githubCalls) {
  logger.info({ tool: call.tool, duration: call.duration_ms, error: call.error });
}
```

## Caching implications

mcp-exec reduces system prompt size, which has a positive effect on CC's prefix cache:

**Without mcp-exec** — all downstream server schemas load at startup, adding 40k+ tokens to the system prompt. Any schema change (server update, new tool) invalidates the cache prefix.

**With mcp-exec + CC Tool Search** — the system prompt contains only mcp-exec's 2-tool schema (~100 tokens), which almost never changes. Cache hits are cheaper and more frequent.

**Conversation length** — intermediate results stay out of conversation history, keeping per-turn context lean and extending how long a conversation can run before hitting limits.

## Testing guide

### Verifying exec output

The `result` field in the exec response is what Claude reads. In tests:

- Assert on `result` for functional correctness
- Assert on `tool_calls` for observability coverage

### Verifying hook behavior

Because downstream tool hooks do not fire inside `exec`, test hook-dependent plugins by:

1. Calling the downstream tool directly (outside `exec`) to verify the hook path works
2. Calling via `exec` and asserting the plugin correctly falls back to reading `tool_calls` from the exec result

### Sandbox config in tests

Set the `sandbox` block in a local `.claude/settings.json` within your test fixture directory to control network and filesystem access during tests. `resolveSandboxConfig()` reads `process.cwd()` for the project-scope file, so pointing your test runner at the fixture directory is sufficient.
