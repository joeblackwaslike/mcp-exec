---
sidebar_position: 1
description: "API reference for tools() — search MCP servers without loading full schemas into context"
---

# tools()

Search connected MCP servers and return trimmed summaries. Full JSON schemas never load into the context window.

## What it does

`tools()` queries the lazy-loaded tool catalog built from all connected MCP servers. Rather than surfacing full JSON schemas — which can run 40,000+ tokens at startup — it returns compact `{ server, name, description, signature }` records that let you identify the right tool with minimal context cost.

Schemas are loaded on demand, only for tools you actually invoke inside `exec()`.

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

- **Available tool** — `server`, `name`, `description`, and a compact `signature` showing parameter names and types.
- **Unavailable server** — when a registered server cannot be reached at query time, returns `status: 'unavailable'` with a `reason`.

## Search behavior

The query string is tokenized before matching:

- **Stop words removed** — common words (`the`, `a`, `for`, `in`, etc.) are stripped so they don't dilute results.
- **CamelCase splitting** — tool names are split on case boundaries before matching, so `listPullRequests` matches the query `"list pull requests"`.
- **Exact phrase** — wrap the query in double quotes (`'"pull request"'`) to require the full phrase in order.
- **Wildcard** — `"*"` returns all tools from all servers with no filtering.

Matches are scored across both `name` and `description` fields. Results are sorted by relevance score, highest first.

## Why it matters

Without `tools()`, every MCP server schema loads at Claude Code startup. A typical workspace with 5–10 connected servers lands at **~40,000 tokens** of schema before any work begins.

With `tools()`, exec's 2-tool schema is the only thing in context at startup — roughly **100 tokens**. You pull in descriptions only for servers you're about to use, and full schemas never load at all.

| | Without mcp-exec | With mcp-exec |
|---|---|---|
| Startup schema tokens | ~40,000 | ~100 |
| Per-query discovery | N/A | ~200–400 tokens |
| Full schema loaded | Always | Never |

## Example workflow

### Single-server discovery

```typescript
// Step 1 — discover what's available on a server
tools("github")
// → [
//     { server: "github", name: "listPullRequests", description: "List open PRs...", signature: "({ state, author, per_page })" },
//     { server: "github", name: "createIssue", description: "Open a new issue...", signature: "({ title, body, labels })" },
//     { server: "github", name: "mergePullRequest", description: "Merge a PR...", signature: "({ owner, repo, pull_number, merge_method })" },
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
// → [42, 57, 103]
```

### Multi-server discovery

When a workflow spans multiple servers, run a targeted `tools()` call for each domain before writing any exec code. This avoids guessing tool names and keeps discovery costs low.

```typescript
// Discover across three servers in one shot
tools("invoice overdue")
// → [
//     { server: "quickbooks", name: "searchInvoices", description: "Search invoices by status, customer, or date range", signature: "({ status, customer_id?, from?, to? })" },
//     { server: "quickbooks", name: "getInvoice", description: "Fetch a single invoice by ID", signature: "({ id })" },
//   ]

tools("customer contact email")
// → [
//     { server: "crm", name: "getCustomer", description: "Get customer record including contact info", signature: "({ id })" },
//     { server: "crm", name: "searchCustomers", description: "Search customers by name, email, or segment", signature: "({ query, segment? })" },
//   ]

tools("gmail draft send")
// → [
//     { server: "gmail", name: "createDraft", description: "Create a draft email", signature: "({ to, subject, body, cc? })" },
//     { server: "gmail", name: "sendDraft", description: "Send an existing draft", signature: "({ draft_id })" },
//   ]

// Now write exec code with confidence — no guessing
exec({
  runtime: "node",
  code: `
    import { searchInvoices, getInvoice } from 'mcp/quickbooks';
    import { getCustomer } from 'mcp/crm';
    import { createDraft } from 'mcp/gmail';

    const overdue = await searchInvoices({ status: 'overdue' });
    const details = await Promise.all(
      overdue.map(inv => Promise.all([
        getInvoice({ id: inv.id }),
        getCustomer({ id: inv.customerId })
      ]))
    );
    const body = details
      .map(([inv, cust]) => \`\${inv.amount} — \${cust.name}\`)
      .join('\\n');
    await createDraft({ to: 'sales@co.com', subject: 'Overdue invoices', body });
    return \`Draft created — \${overdue.length} invoices\`;
  `
})
// → "Draft created — 23 invoices"
```

## Related

- [exec()](/docs/manual/exec) — run the tools you discovered
- [Runtimes](/docs/manual/runtimes) — which runtime can import MCP tools (Node only for async, Python via HTTP bridge)
- [Sessions](/docs/manual/sessions) — how session state interacts with repeated `tools()` calls
