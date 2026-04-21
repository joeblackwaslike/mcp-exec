# TypeScript MCP SDK Reference for mcp-exec

> Pre-processed reference for writing Node.js code inside `exec()` calls.
> This covers what you need inside the sandbox — not how to build MCP servers.

---

## Importing downstream tools

Inside `exec({ runtime: "node", code: ... })`, import downstream MCP tools using the
`mcp/` virtual module prefix. mcp-exec generates the named exports automatically from
each server's tool list.

```typescript
// Named imports — use these
import { listPullRequests, createIssue } from 'mcp/github';
import { searchFiles, getFile } from 'mcp/gdrive';

// Call them like async functions
const prs = await listPullRequests({ state: 'open' });
return JSON.stringify(prs);
```

Every generated export is `async` and forwards params directly to `callTool`. There is
no schema enforcement at the import layer — validation happens server-side.

---

## What the shim does under the hood

```typescript
// mcp-exec generates this for each tool:
export async function listPullRequests(params) {
  return globalThis.__mcpClients['github'].callTool('listPullRequests', params);
}
```

`globalThis.__mcpClients` is set by the SessionManager before your code runs. You do
not need to manage client connections — they are established at server startup.

---

## callTool return shape

`callTool` returns the raw MCP response. Most servers return structured content:

```typescript
// Common shape — check server docs for exact format
{
  content: [
    { type: 'text', text: '...' }  // Most common
    | { type: 'image', data: '...', mimeType: 'image/png' }
    | { type: 'resource', resource: { uri: '...', text: '...' } }
  ],
  isError?: boolean
}

// Some servers return plain objects directly — depends on server implementation
```

When in doubt, `JSON.stringify(result)` and return it — Claude will parse the output.

---

## Tool listing at runtime

To discover what tools a server exposes from inside `exec`:

```typescript
// Not needed in most cases — use tools() MCP tool before exec instead
// But available if you need it:
const catalog = globalThis.__mcpClients['github'];
// catalog.callTool is the only method you need
```

Use the `tools(query)` MCP tool before writing `exec` code to discover available tools
and their signatures. Do not call `listTools()` inside exec — it's unnecessary overhead.

---

## Unavailable servers

If a server failed to connect at startup, importing it throws immediately:

```typescript
import { something } from 'mcp/slack';
// throws: Error: Server 'slack' is unavailable: ENOENT: slack-mcp not found
```

Check `tools('*')` first — unavailable servers appear as `{ server, status: 'unavailable', reason }`.

---

## Patterns

### Store and reuse across calls (implicit session)
```typescript
// call 1
import { listPullRequests } from 'mcp/github';
globalThis.prs = await listPullRequests({ state: 'open' });
return `${globalThis.prs.length} PRs fetched`;

// call 2 — same implicit session, state persists
const flagged = globalThis.prs.filter(pr => pr.labels.includes('needs-review'));
return JSON.stringify(flagged.map(pr => pr.url));
```

### Fan-out across multiple servers
```typescript
import { searchEmails } from 'mcp/gmail';
import { searchFiles } from 'mcp/gdrive';

const [emails, files] = await Promise.all([
  searchEmails({ query: 'budget 2025' }),
  searchFiles({ query: 'budget 2025' }),
]);
return JSON.stringify({ emails, files });
```

### Thread data to Bash for post-processing
```typescript
// exec 1 (node) — fetch and return raw JSON
import { listPullRequests } from 'mcp/github';
return JSON.stringify(await listPullRequests({ state: 'open' }));

// exec 2 (bash) — use nodeResult.stdout
// exec({ runtime: 'bash', code: `echo '${nodeResult.stdout}' | jq '[.[] | select(.draft == false) | .url]'` })
```

### Error handling
Errors from `callTool` propagate as thrown exceptions — they are caught by mcp-exec
and returned as `{ error, line, column }` in the `result` field. Claude can read the
error and retry with corrected code. You do not need explicit try-catch unless you want
to handle partial failures within a single exec call.

---

## exec result shape

```typescript
// What mcp-exec returns to Claude after exec():
{
  result: string | unknown,   // IIFE return value (Node) — stringify complex objects
  tool_calls: [               // Per-tool observability
    { server: string, tool: string, duration_ms: number, error?: string }
  ]
}

// On runtime error:
{
  result: '{"error":"message","line":1,"column":5}',
  tool_calls: []
}
```

---

## Session behavior

- **Implicit session** (default): all `exec` calls in a conversation share state via `globalThis`
- **Explicit session**: pass `session_id` to isolate parallel workflows
- **Bash/Python**: stateless — no `globalThis` persistence, thread data explicitly via `result.stdout`
- **Session idle timeout**: 10 minutes (configurable)
