---
sidebar_position: 2
description: "Which CC hooks fire, which don't, and how to restore per-tool observability using result.tool_calls."
---

# Plugin Compatibility

## The Core Issue

Claude Code hooks fire on tool-use events that CC itself dispatches. When downstream MCP tool calls happen inside `exec()`, they happen inside the sandbox subprocess — invisible to CC's hook dispatch system. From CC's perspective, only one tool was called: `exec`.

Any hook watching a downstream tool name (e.g. a `PostToolUse` matcher for `github__listPRs`) will not receive events for calls made inside `exec`. The sandbox is opaque to CC's hook dispatcher.

## Hook Compatibility Matrix

| Hook type | Trigger | Fires inside exec? |
|---|---|---|
| `SessionStart` | CC conversation begins | Yes — fires normally, unaffected |
| `pre-compact` | CC compacts the conversation | Yes — fires normally, unaffected |
| `PreToolUse` on `exec` | The exec MCP tool call itself | Yes — fires normally |
| `PostToolUse` on `exec` | The exec MCP tool call itself | Yes — fires normally, result contains `tool_calls` |
| `PreToolUse` on downstream tools | e.g. `github__listPRs` via native CC | **No — does NOT fire when called inside exec** |
| `PostToolUse` on downstream tools | e.g. `github__listPRs` via native CC | **No — does NOT fire when called inside exec** |

The pattern: hooks on `exec` itself work. Hooks on tools called _by_ exec don't.

## Restoring Observability via result.tool_calls

Every `exec` response includes a `tool_calls` array recording what happened inside the sandbox. This is the primary mechanism for plugins to restore per-tool observability without requiring CC hook events for downstream calls.

### Schema

```typescript
interface ExecResult {
  result: unknown;         // final output sent to Claude
  tool_calls: ToolCallRecord[];
  stderr?: string;         // present when exitCode !== 0
  exitCode?: number;       // present when exitCode !== 0
}

interface ToolCallRecord {
  server: string;          // MCP server name — matches the key in mcp.json
  tool: string;            // tool name on that server
  duration_ms: number;     // wall-clock time for the tool call
  error?: string;          // present only if the call threw or timed out
}
```

### Reading tool_calls in a PostToolUse Hook

A `PostToolUse` hook on `exec` receives the full exec response in its event payload. The `tool_calls` array is in the parsed JSON result:

```typescript
// hooks/exec-observer.ts
export async function postToolUse(event: PostToolUseEvent) {
  if (event.tool_name !== 'exec') return;

  const result = JSON.parse(event.tool_result);
  const toolCalls: ToolCallRecord[] = result.tool_calls ?? [];

  for (const call of toolCalls) {
    console.log(`[${call.server}] ${call.tool} — ${call.duration_ms}ms${call.error ? ` ERROR: ${call.error}` : ''}`);
  }
}
```

### Filtering for a Specific Server

If your plugin only cares about one downstream server, filter by `server`:

```typescript
const githubCalls = result.tool_calls.filter(tc => tc.server === 'github');
const failedCalls = result.tool_calls.filter(tc => tc.error != null);
```

The `server` field matches the key in `.claude/mcp.json` — the same string you'd use in a native hook matcher.

### Logging All Tool Calls

To replicate what a per-tool `PostToolUse` hook would do for every downstream tool, emit one log entry per `tool_calls` record:

```typescript
for (const call of result.tool_calls) {
  await auditLog.write({
    event: 'tool_call',
    server: call.server,
    tool: call.tool,
    duration_ms: call.duration_ms,
    error: call.error ?? null,
    exec_session: event.session_id,
    timestamp: Date.now(),
  });
}
```

This gives complete per-tool audit coverage even though no individual downstream tool hook fired.

## Writing Hooks That Work Alongside mcp-exec

If you maintain a CC plugin with hooks on downstream MCP tools, follow this pattern to handle both native calls and exec-proxied calls correctly:

```typescript
// Works for direct CC tool calls
export async function postToolUse(event: PostToolUseEvent) {
  if (event.tool_name === 'exec') {
    // exec path — read tool_calls from the result
    const result = JSON.parse(event.tool_result);
    handleToolCalls(result.tool_calls ?? []);
    return;
  }

  // Native path — handle the single tool call directly
  handleToolCall({
    server: event.server_name,
    tool: event.tool_name,
    duration_ms: event.duration_ms,
    error: event.error,
  });
}
```

This dual-path pattern ensures your hook handles both cases without needing to know in advance whether the user is running workflows through mcp-exec or making direct tool calls.

## Caching Implications

mcp-exec's two-tool schema has a significant effect on CC's prefix cache.

**Without mcp-exec** — all downstream server schemas are loaded at startup and added to the system prompt. On a typical installation with 5–10 MCP servers this is 40,000+ tokens. Any schema change (server update, new tool added, description edited) invalidates the entire cache prefix for every conversation.

**With mcp-exec** — the system prompt contains only mcp-exec's 2-tool schema (~100 tokens). That schema almost never changes. Cache hits are cheaper and more frequent.

**Conversation length** — intermediate results stay out of conversation history, keeping per-turn context lean and extending how long a conversation can run before hitting context limits. This is the primary token-saving mechanism: not just system prompt size, but also the absence of large tool results (search results, document content, API responses) from the conversation turns.

Practical impact: a workflow that fetches 50 emails, filters them, and summarizes them might produce 30,000 tokens of intermediate data. With exec, none of that enters the conversation context. Without exec, it all does.

## Plugin Compatibility Checker (planned v0.2)

A CLI command is planned that will scan your settings files and identify hooks that are affected by mcp-exec:

```sh
npx --package=@joeblackwaslike/mcp-exec mcp-exec-check-plugins
```

It will report:
- Which hooks watch downstream tool names that will not fire inside exec
- Suggested `tool_calls` filter patterns for each affected hook
- Whether any hooks watch `exec` itself (these are fine)

Until v0.2 ships, audit your hooks manually against the compatibility matrix above.
