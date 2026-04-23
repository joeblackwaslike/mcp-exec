<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg">
  <img alt="mcp-exec — reduce your token usage by as much as 99%" src="assets/logo-light.svg" width="420">
</picture>

[![npm version](https://img.shields.io/npm/v/mcp-exec?color=3fb950&label=npm)](https://www.npmjs.com/package/mcp-exec)
[![node](https://img.shields.io/badge/node-%E2%89%A520.12-lightgrey)](https://nodejs.org)
[![platform](https://img.shields.io/badge/platform-macOS%20%C2%B7%20Linux-lightgrey)](#requirements)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![works with](https://img.shields.io/badge/works%20with-Claude%20Code-ea580c)](https://claude.ai/code)

> **Implementation of** ["Code execution with MCP: building more efficient AI agents"](https://www.anthropic.com/engineering/code-execution-with-mcp) — Anthropic Engineering, Nov 2025. The canonical reference for this pattern.

<img src="assets/demo.gif" alt="mcp-exec demo — rate limit pain vs exec fix" width="100%">

[Install →](#installation) &nbsp;&nbsp; [How it works →](#how-it-works)

---

## 52,000 tokens → 50 tokens.

This isn't a compression trick. Intermediate data — raw API responses, filtered lists, full document bodies — never enters the context window at all. The sandbox is opaque to Claude by design.

---

## You've been here.

Mid-workflow. Claude's working. Three more tool calls to go. Then:

```text
✓ Searching QuickBooks... 847 invoices found (context: +14,200 tokens)
✓ Filtering overdue... 23 invoices (context: +8,100 tokens)
✓ Fetching customer details...

⚠  Claude AI Usage Limit Reached
   You've reached your usage limit and will be able to resume in 5 hours.
```

The tool calls worked. Claude ran out of room to think.

mcp-exec fixes this architecturally — intermediate data never touches context.

---

## Before / After

<img src="assets/infographic-before-after.svg" alt="Before and after token comparison" width="100%">

---

## How it works

mcp-exec adds two tools to Claude Code:

- **`tools(query)`** — searches your connected MCP servers and returns trimmed summaries. Full schemas never touch the context window.
- **`exec(code, runtime)`** — runs code in an OS-level sandbox. MCP servers are importable as modules. Only the final return value comes back.

<img src="assets/infographic-arch.svg" alt="Architecture diagram" width="100%">

**Runtimes:**

| Runtime | State | Use for |
|---------|-------|---------|
| `"node"` | Persistent (`globalThis`) | MCP orchestration, multi-step workflows |
| `"bash"` | Stateless | Unix pipelines, `jq`, `awk`, post-processing |
| `"python"` | Stateless (`uv run --isolated`) | Data analysis, pandas, arbitrary PyPI packages via PEP 723 |

---

## Token savings

<img src="assets/infographic-savings.svg" alt="Token savings by workflow type" width="100%">

---

## Scenarios

### Overdue invoice triage — 27,000 → 80 tokens

**Without mcp-exec:** 847 invoices returned raw (14k tokens), customer lookups add 8k more, rate limit mid-task.

**With mcp-exec:**

```typescript
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
      .join('\n');
    await createDraft({ to: 'sales@co.com', subject: 'Overdue invoices', body });
    return \`Draft created — \${overdue.length} invoices\`;
  `
})
// → "Draft created — 23 invoices"   tokens used: ~80
```

---

### Morning standup brief — 20,000 → 60 tokens

**Without mcp-exec:** 34 Linear tickets + 12 PRs with diffs + 200 Slack messages = 20k tokens before the meeting starts.

**With mcp-exec:**

```typescript
exec({
  runtime: "node",
  code: `
    import { getIssues } from 'mcp/linear';
    import { listPullRequests } from 'mcp/github';
    import { getMessages, postMessage } from 'mcp/slack';

    const [tickets, prs, msgs] = await Promise.all([
      getIssues({ assignee: 'me', status: 'in_progress' }),
      listPullRequests({ state: 'open', author: 'me' }),
      getMessages({ channel: '#team', since: 'yesterday' }),
    ]);

    await postMessage({
      channel: '#standup',
      text: [
        '🔴 Blocked: ' + tickets.filter(t => t.labels.includes('blocked')).length,
        '👀 PRs needing review: ' + prs.filter(pr => pr.reviewers.length === 0).length,
        '📣 Mentions: ' + msgs.filter(m => m.text.includes('@me')).length,
      ].join('\n'),
    });
    return 'Standup posted';
  `
})
// → "Standup posted"   tokens used: ~60
```

---

### Research loop — 40,000 → 55 tokens

**Without mcp-exec:** Three fetched pages = 40k tokens. Can't read more than 4 sources per session.

**With mcp-exec:**

```typescript
exec({
  runtime: "node",
  code: `
    import { search, fetch } from 'mcp/browser';
    import { createDoc } from 'mcp/gdrive';

    const results = await search({ query: 'best React patterns 2025' });

    // Fetch all 10 results in parallel — full HTML stays in sandbox
    const pages = await Promise.all(results.map(r => fetch({ url: r.url })));

    // Extract only what matters
    const insights = pages.flatMap(page =>
      page.headings.filter(h => h.level <= 2).map(h => h.text)
    );

    const doc = await createDoc({
      title: 'React Patterns 2025',
      content: insights.join('\n'),
    });
    return doc.url;
  `
})
// → "https://docs.google.com/document/d/..."   tokens used: ~55
```

---

### Stateful multi-step — data loaded once, queried many times

Session state persists across `exec()` calls in Node. Fetch once, slice differently without re-fetching.

```typescript
// Step 1 — load 100 PRs into session
exec({ runtime: "node", code: `
  import { listPullRequests } from 'mcp/github';
  globalThis.prs = await listPullRequests({ state: 'open', per_page: 100 });
  return globalThis.prs.length + ' PRs loaded';
`});
// → "100 PRs loaded"

// Step 2 — find stale (no re-fetch)
exec({ runtime: "node", code: `
  const stale = globalThis.prs.filter(pr => {
    const days = (Date.now() - new Date(pr.updated_at)) / 86400000;
    return days > 14;
  });
  return stale.map(pr => ({ number: pr.number, days: Math.floor((Date.now() - new Date(pr.updated_at)) / 86400000) }));
`});
// → [{number: 42, days: 21}, ...]
```

---

### Python — data analysis with pandas

```python
exec({
  "runtime": "python",
  "code": """
# /// script
# requires-python = ">=3.12"
# dependencies = ["pandas>=2.0"]
# ///
import json, sys, pandas as pd

data = json.loads(sys.argv[1]) if len(sys.argv) > 1 else []
df = pd.DataFrame(data)
summary = df.groupby('stage')['amount'].sum().sort_values(ascending=False)
print(summary.head(5).to_json())
"""
})
# → {"Closed Won": 12400000, "Negotiation": 4200000, ...}
```

---
