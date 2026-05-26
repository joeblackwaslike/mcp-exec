---
sidebar_position: 2
description: "API reference for exec() — run code in an OS-level sandbox with MCP tool access"
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
exec({ runtime: "node",   code: `...` })
exec({ runtime: "bash",   code: `...` })
exec({ runtime: "python", code: `...` })

// Config object — override timeout and/or inject env vars
exec({
  runtime: { type: "bash", timeout: 5000, env: { API_KEY: "secret" } },
  code: `curl -H "Authorization: Bearer $API_KEY" https://api.example.com/data`
})
```

`timeout` is in milliseconds. Defaults: 30 000 ms for Node and Python, 10 000 ms for Bash. If the timeout is exceeded the process is terminated and `result` contains a timeout error object.

Sandbox security policy is global — configured in `settings.json`, not per-call. The `env` override only injects additional environment variables; it does not replace or restrict the sandbox policy.

### `session_id` (optional)

Provide an explicit session ID to isolate parallel workflows that should not share Node `globalThis` state. When omitted, all Node exec calls within a conversation share one implicit session. Has no effect on Bash or Python — those runtimes are always stateless.

See [Sessions](/docs/manual/sessions) for full lifecycle details.

## Return value

```typescript
type ExecResult = {
  result: unknown           // IIFE return value (Node) or stdout string (Bash/Python)
  stdout: string            // raw stdout
  stderr: string            // raw stderr
  exitCode: number          // 0 = success
  tool_calls: ToolCallRecord[]
}

type ToolCallRecord = {
  server: string            // MCP server name, e.g. "github"
  tool: string              // tool name, e.g. "listPullRequests"
  duration_ms: number       // wall-clock time for this call
  error?: string            // present only if the call failed
}
```

`result` is the primary output. `stdout` and `stderr` are available for post-processing or debugging. `tool_calls` records every MCP tool invoked inside the sandbox — useful when `PreToolUse`/`PostToolUse` hooks won't fire (the sandbox is opaque to the Claude Code event system).

### What "result" means per runtime

| Runtime | `result` value |
|---|---|
| `node` | The last expression of the async IIFE body. Objects and arrays are returned as-is. |
| `bash` | Full stdout as a string. |
| `python` | Full stdout as a string. Use `print()` to emit output. |

## Error handling

Runtime errors surface as structured objects rather than thrown exceptions, so the agent can inspect and recover:

```typescript
const { result, exitCode, stderr } = await exec({ runtime: "node", code: `...` });

// Node — check result shape for unhandled rejections
if (typeof result === 'object' && result !== null && 'error' in result) {
  const { error, line, column } = result as { error: string; line: number; column: number };
  // inspect or report
}

// Bash / Python — check exitCode
if (exitCode !== 0) {
  console.error('Process failed:', stderr);
}
```

For Bash and Python, a non-zero `exitCode` signals failure. For Node, unhandled promise rejections surface in `result` rather than as a non-zero exit code.

## Examples

### Node — MCP tool orchestration

```typescript
exec({
  runtime: "node",
  code: `
    import { listPullRequests } from 'mcp/github';
    import { postMessage } from 'mcp/slack';

    const prs = await listPullRequests({ state: 'open', per_page: 50 });
    const unreviewed = prs.filter(pr => pr.reviewers.length === 0);

    await postMessage({
      channel: '#eng',
      text: \`\${unreviewed.length} PRs waiting for a reviewer\`,
    });

    return { total: prs.length, unreviewed: unreviewed.length };
  `
})
// → { result: { total: 50, unreviewed: 12 }, exitCode: 0, tool_calls: [...] }
```

### Bash — pipeline with timeout

```typescript
exec({
  runtime: { type: "bash", timeout: 5000 },
  code: `curl -s https://api.example.com/data | jq '[.items[] | select(.active == true)] | length'`
})
// → { result: "7\n", stdout: "7\n", exitCode: 0, tool_calls: [] }
```

### Python — inline deps with PEP 723

```python
exec({
  "runtime": "python",
  "code": """
# /// script
# requires-python = ">=3.12"
# dependencies = ["pandas>=2.0", "numpy"]
# ///
import json, pandas as pd

data = [
  {"region": "West",  "revenue": 420000},
  {"region": "East",  "revenue": 380000},
  {"region": "South", "revenue": 210000},
]
df = pd.DataFrame(data)
print(df.groupby('region')['revenue'].sum().sort_values(ascending=False).to_json())
"""
})
# → { result: '{"West":420000,"East":380000,"South":210000}', exitCode: 0, tool_calls: [] }
```

### Config object — injecting env vars

```typescript
exec({
  runtime: { type: "bash", timeout: 10000, env: { REPO: "my-org/my-repo" } },
  code: `gh pr list --repo "$REPO" --state open --json number,title | jq length`
})
// → { result: "14\n", exitCode: 0 }
```

## When NOT to use exec

- **Single-tool calls where the result is small** — if you want the output visible in context, call the tool directly.
- **Raw output for the user** — when you need to display a full API response verbatim, exec's opacity works against you.
- **Interactive confirmation steps** — when the user needs to approve intermediate results before the workflow continues, keep those steps in context.

## Related

- [tools()](/docs/manual/tools) — discover which tools are available before writing exec code
- [Runtimes](/docs/manual/runtimes) — state models, bundled packages, and use cases per runtime
- [Sessions](/docs/manual/sessions) — how implicit and explicit sessions work
- [Examples](/docs/manual/examples) — real workflows with before/after token counts
