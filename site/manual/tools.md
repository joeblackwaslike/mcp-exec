---
description: API reference for tools() — search MCP servers without loading full schemas into context
---

# tools()

Search connected MCP servers and return trimmed summaries. Full JSON schemas never load into the context window.

## What it does

`tools()` queries the lazy-loaded tool catalog built from all connected MCP servers. Rather than surfacing full JSON schemas (which can run 40,000+ tokens at startup), it returns compact `{ server, name, description, signature }` records that let you identify the right tool with minimal context cost.

Schemas are loaded on demand — only for tools you actually invoke inside `exec()`.

## Syntax

```typescript
tools("*")                    // all tools across all connected servers
tools("search emails")        // substring match across name + description
tools('"pull request"')       // exact phrase match
```

## Return type

```typescript
type CatalogEntry =
  | { server: string; name: string; description: string; signature: string }
  | { server: string; status: 'unavailable'; reason: string }
```

Each entry is one of:

- **Available tool** — `server`, `name`, `description`, and a compact `signature` showing parameter names and types
- **Unavailable server** — when a registered server cannot be reached at query time, returns `status: 'unavailable'` with a `reason`

## Search behavior

The query string is tokenized before matching:

- **Stop words removed** — common words (`the`, `a`, `for`, `in`, etc.) are stripped so they don't dilute results
- **CamelCase splitting** — tool names are split on case boundaries before matching, so `listPullRequests` matches the query `"list pull requests"`
- **Exact phrase** — wrap the query in double quotes (`'"pull request"'`) to require the full phrase in order
- **Wildcard** — `"*"` returns all tools from all servers with no filtering

Matches are scored across both `name` and `description` fields. Results are sorted by relevance score, highest first.

## Why it matters

Without `tools()`, every MCP server schema loads at Claude Code startup. A typical workspace with 5–10 connected servers lands at **~40,000 tokens** of schema before any work begins.

With `tools()`, exec's 2-tool schema is the only thing in context at startup — roughly **100 tokens**. You pull in descriptions only for servers you're about to use, and full schemas never load at all.

| | Without mcp-exec | With mcp-exec |
| --- | --- | --- |
| Startup schema tokens | ~40,000 | ~100 |
| Per-query discovery | N/A | ~200–400 tokens |
| Full schema loaded | Always | Never |

## Example workflow

```typescript
// Step 1 — discover what's available
tools("github")
// → [
//     { server: "github", name: "listPullRequests", description: "List open PRs...", signature: "({ state, author, per_page })" },
//     { server: "github", name: "createIssue", description: "Open a new issue...", signature: "({ title, body, labels })" },
//     ...
//   ]

// Step 2 — use what you need inside exec
exec({
  runtime: "node",
  code: `
    import { listPullRequests } from 'mcp/github';
    const prs = await listPullRequests({ state: 'open', per_page: 50 });
    return prs.filter(pr => pr.reviewers.length === 0).map(pr => pr.number);
  `
})
```

## Related

- [exec()](/manual/exec) — run the tools you discovered
- [Runtimes](/manual/runtimes) — which runtime can import MCP tools (Node only)
- [Sessions](/manual/sessions) — how session state interacts with repeated `tools()` calls
