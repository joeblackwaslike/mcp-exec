---
description: The problem mcp-exec solves, how it works architecturally, and when to use it.
---

# What is mcp-exec?

## You've been here

Mid-workflow. Claude's working. Three more tool calls to go. Then:

```text
✓ Searching QuickBooks... 847 invoices found (context: +14,200 tokens)
✓ Filtering overdue... 23 invoices (context: +8,100 tokens)
✓ Fetching customer details...

⚠  Claude AI Usage Limit Reached
   You've reached your usage limit and will be able to resume in 5 hours.
```

The tool calls worked. Claude ran out of room to think.

This isn't a fluke — it's a structural problem. Every intermediate result from every tool call flows directly into the context window. By the time Claude is halfway through a real workflow, the context is packed with raw API responses that Claude already processed and no longer needs. The model hits its limit not because the task was too hard, but because the conversation got too long.

mcp-exec fixes this architecturally: intermediate data never touches context.

## Two root causes of token bloat

**Schema bloat** — Every MCP server loads its full tool schemas at startup. A single server with 20 tools can add 40,000 tokens before Claude makes a single call. With multiple servers connected, you can exhaust a meaningful fraction of the context window just by opening a session.

**Result bloat** — Raw API responses are verbose by nature. A search returning 847 invoices doesn't return 847 numbers — it returns 847 objects with IDs, timestamps, metadata, line items, and audit fields. A single call that fetches emails, PRs, or document bodies can flood 10,000–20,000 tokens into context. Chained tool calls multiply this rapidly.

## The solution

mcp-exec adds two tools to Claude Code:

**`tools(query)`** — searches your connected MCP servers and returns trimmed summaries. A description, a name, and a signature. Full schemas never touch the context window. Discovering what tools are available costs tens of tokens instead of tens of thousands.

**`exec(code, runtime)`** — runs code in an OS-level sandbox. MCP servers are importable as modules inside the sandbox. Multiple tool calls, data processing, filtering, and aggregation happen entirely inside the sandbox — only the final return value comes back to Claude.

The sandbox is opaque to Claude by design. Claude sees the input (the code it sent) and the output (the final return value). Everything in between — the raw API responses, the intermediate arrays, the filtered lists, the fetched document bodies — stays inside the sandbox and is discarded when the call completes.

### Runtimes

| Runtime | State | Use for |
|---------|-------|---------|
| `"node"` | Persistent (`globalThis`) | MCP orchestration, multi-step workflows |
| `"bash"` | Stateless | Unix pipelines, `jq`, `awk`, post-processing |
| `"python"` | Stateless (`uv run --isolated`) | Data analysis, pandas, arbitrary PyPI packages via PEP 723 |

## Before / After

**Without mcp-exec**, a workflow that fetches invoices, filters by status, looks up customer details, and drafts an email might look like this in the context window:

1. `searchInvoices()` → 847 invoice objects → ~14,200 tokens added
2. Claude filters in-context → filtered list displayed → ~2,000 tokens
3. `getCustomer()` × 23 calls → 23 customer records → ~8,100 tokens added
4. `createDraft()` → draft confirmation → ~400 tokens

Total: ~25,000 tokens. And that's before Claude writes a word of the final response.

**With mcp-exec**, the same workflow looks like this:

1. `exec({ runtime: "node", code: "..." })` → all four steps happen in the sandbox → `"Draft created — 23 invoices"` → ~80 tokens added

Total: ~80 tokens. The 847 invoice objects, the 23 customer records, and all the intermediate filtering never appear in context.

The 99% reduction in the headline isn't a compression trick. The data was simply never there.

## When NOT to use mcp-exec

mcp-exec is the right tool for multi-step workflows with large intermediate data. It's not always the right tool:

- **Single-tool calls where the result is small and you want it visible in context** — if you're fetching one record and you want Claude to reason about its contents directly, keep it in context.
- **When you need to display raw API output verbatim to the user** — if the goal is to show the user a list of items, put that list in context where it can be rendered.
- **Interactive tool calls where the user needs to confirm intermediate results** — if the workflow requires human review at each step, the sandbox's opacity works against you. Keep those calls visible.

Use exec for orchestration. Use direct tool calls for display and confirmation.

## Next steps

- [Install mcp-exec →](/guide/installation)
- [Run your first exec() call →](/guide/getting-started)
