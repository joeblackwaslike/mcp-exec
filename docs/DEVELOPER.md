# mcp-exec Developer Guide

Reference for plugin authors and contributors integrating with or extending mcp-exec.

---

## Sandbox execution model

When Claude calls the `exec` MCP tool, mcp-exec spawns a sandboxed subprocess (or
reuses a persistent session context) and runs the submitted code inside it. The sandbox
is an OS-level process boundary enforced by `@anthropic-ai/sandbox-runtime` (`srt`) —
the same sandbox Claude Code uses for its built-in bash tool.

This differs from native tool calls in one important way: **downstream MCP tool
invocations inside the sandbox happen within that subprocess**, not through Claude Code's
tool-use event system. From CC's perspective, only one tool was called: `exec`.

---

## What hooks see

Claude Code hooks fire on tool-use events that CC itself dispatches. The table below
shows which hook types are affected:

| Hook type | Trigger | Affected by mcp-exec? |
|---|---|---|
| `SessionStart` | CC conversation begins | No — fires normally |
| `pre-compact` | CC compacts conversation | No — fires normally |
| `PreToolUse` / `PostToolUse` on `exec` | The exec MCP tool call | No — fires normally |
| `PreToolUse` / `PostToolUse` on downstream tools (e.g. `github.listPRs`) | Downstream tool called via native CC | **Yes — does NOT fire when called inside exec** |

If your hook watches a downstream tool name (e.g. `PostToolUse` with matcher
`github.listPRs`), it will not receive events for calls made inside `exec`. The
sandbox is opaque to CC's hook dispatch.

### Plugin compatibility checker (v0.2, planned)

```sh
npx --package=@joeblackwaslike2/mcp-exec mcp-exec-check-plugins
```

Scans `~/.claude/settings.json` and `.claude/settings.json` for hooks that watch
downstream MCP tool names and prints a compatibility report identifying which hooks
will not fire inside exec.

---

## `result.tool_calls` schema

Every exec result includes a `tool_calls` array that records what happened inside the
sandbox. Use this to restore per-tool observability in plugins that cannot rely on
CC hook events.

```typescript
interface ExecResult {
  result: string           // the final output returned to Claude
  tool_calls: ToolCallRecord[]
}

interface ToolCallRecord {
  server: string           // MCP server name (matches key in CC's mcp.json)
  tool: string             // tool name on that server
  duration_ms: number      // wall-clock time for the tool call
  error?: string           // present only if the call threw or timed out
}
```

Example: a plugin that wants to log every GitHub tool call can read `tool_calls` from
the `PostToolUse` event on `exec` and filter for `server === "github"`.

---

## Caching implications

mcp-exec reduces system prompt size, which has a positive effect on CC's prefix cache:

- **Without mcp-exec:** all downstream server schemas load at startup — 40k+ tokens
  added to the system prompt. Any schema change (server update, new tool) invalidates
  the cache prefix.
- **With mcp-exec + CC Tool Search:** the system prompt contains only mcp-exec's
  2-tool schema (~100 tokens), which almost never changes. Cache hits are cheaper and
  more frequent.
- **Conversation length:** intermediate results stay out of conversation history,
  keeping per-turn context lean and extending how long a conversation can run before
  hitting limits.

---

## When to use mcp-exec vs direct tool calls

**Use mcp-exec (`exec`) when:**

- The workflow touches 3+ tools and intermediate results are large (lists, documents,
  search results)
- You want to keep intermediate data out of the context window entirely
- You need stateful computation across multiple tool calls (filtering, aggregating,
  transforming)
- You want cross-runtime composition (e.g. fetch with Node, post-process with bash/jq)

**Use direct tool calls when:**

- You need a single tool result and plan to reason over it directly
- The intermediate result is small and you want Claude to see it
- You need CC hook events to fire for every downstream tool call (e.g. for audit
  logging via hooks that cannot read `tool_calls` metadata)

---

## Testing guide

### Verifying exec output

The `result` field in the exec response is what Claude reads. In tests, assert on
`result` for functional correctness and on `tool_calls` for observability coverage.

### Verifying hook behavior

Because downstream tool hooks do not fire inside exec, test hook-dependent plugins by:

1. Calling the downstream tool directly (outside exec) to verify the hook path works
2. Calling via `exec` and asserting the plugin correctly falls back to reading
   `tool_calls` from the exec result

### Sandbox config in tests

Set the `sandbox` block in a local `.claude/settings.json` within your test fixture
directory to control network and filesystem access during tests. `resolveSandboxConfig()`
reads `process.cwd()` for the project-scope file, so pointing your test runner at the
fixture directory is sufficient.
