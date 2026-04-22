---
name: Using mcp-exec
description: Load when using the exec() or tools() MCP tools from mcp-exec — writing sandboxed code, discovering MCP tools, threading data between runtimes
version: 0.3.0
---

# mcp-exec

Load this skill when using the `tools` or `exec` MCP tools from mcp-exec.

## What mcp-exec does

`mcp-exec` keeps intermediate MCP tool call results out of your context window.
Instead of calling MCP tools directly, you write short scripts that import MCP
servers as code modules and run them in a sandboxed environment. Only the final
output returns to you.

## Discovering tools

```typescript
// List all available tools
tools("*")

// Search for specific tools
tools("search emails")
tools("github pull request")
tools("drive create document")
```

Returns trimmed summaries: `{ server, name, description, signature }`.
Full schemas are never loaded into context.

## Import syntax

```typescript
// Import tools from any connected MCP server
import { searchEmails, sendEmail } from 'mcp/gmail';
import { searchFiles, createDocument } from 'mcp/gdrive';
```

Imports are resolved at runtime — the server names match keys in `.claude/mcp.json`.

## exec() basics

```typescript
// Node.js (default): return value becomes the result
exec({
  runtime: "node",
  code: `
    import { searchEmails } from 'mcp/gmail';
    const emails = await searchEmails({ query: 'from:boss subject:urgent' });
    return emails.length + ' urgent emails';
  `
})

// Bash: stdout becomes the result
exec({
  runtime: "bash",
  code: "echo 'hello world' | tr '[:lower:]' '[:upper:]'"
})
```

## Session state (Node only)

Variables stored on `globalThis` persist across exec() calls in the same conversation.
Bash is stateless — use explicit data threading for cross-runtime state.

```typescript
// Call 1 — fetch and store
exec({ runtime: "node", code: `
  import { searchEmails } from 'mcp/gmail';
  globalThis.emails = await searchEmails({ query: 'is:unread' });
  return globalThis.emails.length + ' emails fetched';
`});

// Call 2 — use stored state (same session)
exec({ runtime: "node", code: `
  const urgent = globalThis.emails.filter(e => e.subject.includes('URGENT'));
  return urgent.map(e => e.subject);
`});
```

## Cross-runtime data threading

Bash cannot access Node session globals. Thread data explicitly via `result.stdout`.

```typescript
const nodeResult = await exec({ runtime: "node", code: `
  import { searchFiles } from 'mcp/gdrive';
  return JSON.stringify(await searchFiles({ query: 'Q4 report' }));
`});

const filtered = await exec({
  runtime: "bash",
  code: `echo '${nodeResult.result}' | jq '[.[] | select(.mimeType == "application/pdf") | .name]'`
});
```

## Error handling

Errors are returned as `{ error, line, column }` in the result field.
Line numbers are relative to your code (preamble offset already subtracted).

```typescript
const result = await exec({ runtime: "node", code: `...` });
if (typeof result.result === 'object' && 'error' in result.result) {
  // Retry with fixed code
}
```

## When NOT to use mcp-exec

- Simple single-tool calls where the result is small and you want it in context
- When you need to display raw API output to the user verbatim
