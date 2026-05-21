---
name: using-mcp-exec
description: Use when discovering available MCP tools or when any MCP tool call would return large results you want to keep out of the context window — including single-tool calls
---

# using-mcp-exec

Core principle: Keep large MCP results out of context — filter and return only what you need.

## Decision rule

**Call the tool directly** when:
- The result is small and you want to reason over the raw output
- You want a CC `PreToolUse`/`PostToolUse` hook to fire for that specific call
- Interactive debugging where the user needs to see intermediate state

**Use `exec()`** when:
- The result would be large (record lists, API responses, file contents, search results)
- You want to filter, transform, or summarize before returning
- The workflow touches 2+ tools and intermediate results should stay out of context
- A single tool call returns more than you need — extract just the relevant fields

The single-tool case matters: one MCP call returning 200 records costs 8,000 tokens if it hits context; `exec()` can reduce it to a 50-token summary.

## Discovering tools

```typescript
// List all available tools
tools("*")

// Search for specific tools
tools("search emails")
tools("github pull request")
tools("drive create document")
```

Returns trimmed summaries: `{ server, name, description, signature }`. Full schemas never enter context.

## Import syntax

```typescript
import { searchEmails, sendEmail } from 'mcp/gmail';
import { searchFiles, createDocument } from 'mcp/gdrive';
```

Server names match keys in `.claude/mcp.json`. Imports are resolved at runtime.

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

// Python (stateless, uv-isolated): stdout is the result. No MCP imports — data processing only.
exec({
  runtime: "python",
  code: `
# /// script
# dependencies = ["pandas"]
# ///
import pandas as pd, json

with open('/tmp/mcp-exec-data.json') as f:
    rows = json.load(f)

df = pd.DataFrame(rows)
print(df.groupby('category')['value'].mean().round(2).to_json())
`
})
```

## Session state (Node only)

Variables on `globalThis` persist across `exec()` calls in the same conversation. Bash and Python are stateless — thread data explicitly.

```typescript
// Call 1 — fetch and store
exec({ runtime: "node", code: `
  import { searchEmails } from 'mcp/gmail';
  globalThis.emails = await searchEmails({ query: 'is:unread' });
  return globalThis.emails.length + ' emails fetched';
`});

// Call 2 — same session, state persists
exec({ runtime: "node", code: `
  const urgent = globalThis.emails.filter(e => e.subject.includes('URGENT'));
  return urgent.map(e => e.subject);
`});
```

## Cross-runtime data threading

Bash cannot access Node session globals. Thread data via temp files for large payloads.

```typescript
// Step 1 (node): fetch and write to temp file
const nodeResult = await exec({ runtime: "node", code: `
  import { searchFiles } from 'mcp/gdrive';
  import { writeFileSync } from 'fs';
  const files = await searchFiles({ query: 'Q4 report' });
  writeFileSync('/tmp/mcp-exec-result.json', JSON.stringify(files));
  return files.length + ' files written';
`});

// Step 2 (bash): read from temp file — never interpolate JSON into shell strings
const filtered = await exec({
  runtime: "bash",
  code: `jq '[.[] | select(.mimeType == "application/pdf") | .name]' /tmp/mcp-exec-result.json`
});
```

## Error handling

Errors return as `{ error, line, column }`. Line numbers are relative to your code.

```typescript
const result = await exec({ runtime: "node", code: `...` });
if (typeof result.result === 'object' && 'error' in result.result) {
  // Retry with fixed code
}
```

## Red flags

| Thought | Reality |
|---|---|
| "It's just one tool call, not worth the overhead." | If the response is large, `exec()` saves context even for a single call. |
| "I'll call the tool directly and filter afterwards." | Tokens spent on large responses can't be unspent. Filter inside `exec()`. |
| "The result is probably small." | Check the tool signature with `tools(query)` first, then decide. |
| "I need to see the raw output." | Only true if you need to reason over it. If you just need a subset, filter in exec(). |

## When NOT to use exec()

- Single tool call where the result is small and you need to reason over the raw output
- When a CC `PreToolUse`/`PostToolUse` hook must fire for that specific call
- Interactive debugging where the user needs to see intermediate state
- Simple local shell operations (use Bash tool directly)

## Reference

Full API, session state, bundled packages, and cross-runtime patterns:
- `ts-sdk-reference.md` — Node.js runtime
- `py-sdk-reference.md` — Python runtime
