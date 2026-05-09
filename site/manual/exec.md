---
description: API reference for exec() — run code in an OS-level sandbox
---

# exec()

Run code in an OS-level sandbox. MCP servers are importable as modules inside Node. Only the final return value enters the context window — all intermediate data stays in the sandbox.

## Full signature

```typescript
exec({
  code: string,
  runtime:
    | "node"
    | "bash"
    | "python"
    | { type: "node" | "bash" | "python", timeout?: number, env?: Record<string, string> },
  session_id?: string,   // optional — for parallel isolation
})
// → Promise<ExecResult>
```

## Parameters

### `code` (required)

The source code to execute. For Node, this is treated as an async IIFE — the last expression is the return value. For Bash and Python, stdout is the return value.

### `runtime` (required)

Either a string shorthand or a config object:

```typescript
// String shorthand — uses default timeout and process environment
exec({ runtime: "node", code: `...` })
exec({ runtime: "bash", code: `...` })
exec({ runtime: "python", code: `...` })

// Config object — override timeout and/or inject env vars
exec({
  runtime: { type: "bash", timeout: 5000, env: { API_KEY: "..." } },
  code: `curl -H "Authorization: $API_KEY" https://api.example.com/data`
})
```

`timeout` is in milliseconds. The default varies by runtime (30 seconds for Node and Python, 10 seconds for Bash). Sandbox security policy is global — set in `settings.json`, not per-call.

### `session_id` (optional)

Provide an explicit session ID to isolate parallel workflows that shouldn't share Node `globalThis` state. When omitted, all Node exec calls within a conversation share one implicit session. Has no effect on Bash or Python (always stateless).

## Return value

```typescript
type ExecResult = {
  result: unknown          // IIFE return value (Node) or stdout (Bash/Python)
  stdout: string           // raw stdout
  stderr: string           // raw stderr
  exitCode: number         // 0 = success
  tool_calls: ToolCallRecord[]  // MCP calls made inside exec, for observability
}
```

`result` is the primary output. `stdout` and `stderr` are available for post-processing or debugging. `tool_calls` records every MCP tool invoked inside the sandbox — useful when `PreToolUse`/`PostToolUse` hooks won't fire (the sandbox is opaque to the Claude Code event system).

## Error handling

Runtime errors are returned as structured objects rather than thrown exceptions, so the agent can inspect and recover:

```typescript
const { result } = await exec({ runtime: "node", code: `...` });
if (typeof result === 'object' && result !== null && 'error' in result) {
  const { error, line, column } = result as { error: string; line: number; column: number };
  // handle or report
}
```

A non-zero `exitCode` signals failure for Bash and Python. For Node, check `result` for an error shape — unhandled promise rejections surface there rather than as a non-zero exit code.

## Timeout example

```typescript
exec({
  runtime: { type: "bash", timeout: 5000 },  // 5 second timeout
  code: `curl https://api.example.com/data | jq '.items | length'`
})
```

If the timeout is exceeded the process is terminated and `result` will contain a timeout error object.

## When NOT to use exec

- **Single-tool calls where the result is small** — if you want the output visible in context, call the tool directly instead
- **Raw output for the user** — when you need to display a full API response verbatim, exec's opacity works against you
- **Interactive confirmation steps** — when the user needs to approve intermediate results before the workflow continues, keep those steps in context

## Related

- [tools()](/manual/tools) — discover which tools are available before writing exec code
- [Runtimes](/manual/runtimes) — state models, bundled packages, and use cases per runtime
- [Sessions](/manual/sessions) — how implicit and explicit sessions work
- [Examples](/manual/examples) — real workflows with before/after token counts
