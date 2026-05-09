---
description: Real-world examples showing token savings across common AI agent workflows
---

# Examples

Five complete workflows showing what mcp-exec saves in practice. Each example includes the before/after token count and the exact exec call that replaces it.

---

## Overdue invoice triage — 27,000 → 80 tokens

**Without mcp-exec:** QuickBooks returns 847 raw invoices (+14,200 tokens). Customer lookups for each overdue invoice add another 8,000+ tokens. Claude hits the usage limit before the draft is sent.

**With mcp-exec:** The entire fetch-filter-lookup-draft pipeline runs inside the sandbox. Only the final confirmation string enters context.

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

## Morning standup brief — 20,000 → 60 tokens

**Without mcp-exec:** 34 Linear tickets + 12 PRs with diffs + 200 Slack messages = 20,000 tokens before the meeting starts. The standup post never gets written.

**With mcp-exec:** All three sources are fetched in parallel, summarized to counts, and posted to Slack — 60 tokens total.

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

## Research loop — 40,000 → 55 tokens

**Without mcp-exec:** Three fetched pages average 13,000 tokens each. Four sources exhausts the context budget. Research stalls.

**With mcp-exec:** All 10 search results are fetched in parallel inside the sandbox. Full HTML bodies never enter context — only the extracted headings do, written directly to a Google Doc.

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

## Stateful multi-step — data loaded once, queried many times

Session state persists across `exec()` calls in Node. Fetch once, slice differently across multiple calls without re-hitting the API.

**Without mcp-exec:** Each question about the PR list re-fetches 100 PRs and loads them into context. Four questions = four fetches = context window full.

**With mcp-exec:** Load once into `globalThis`, query as many times as needed.

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

## Python data analysis with pandas

**Without mcp-exec:** Raw CRM data (thousands of rows) loads into context so Claude can analyze it. Any moderately-sized dataset exhausts the token budget before the analysis is done.

**With mcp-exec:** Data is fetched in Node, written to a temp file, then analyzed by a PEP 723-declared Python script. Only the final summary enters context.

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

For the full Node → Python handoff pattern (writing data to a temp file), see [Sessions — data threading across runtimes](/manual/sessions#data-threading-across-runtimes).

---

## Reproducible case study

The numbers above are real. The [case study](/case-study) page has full reproduction instructions, token logging commands, and expected output for the PR staleness nudge workflow — **43,800 tokens → 90 tokens** on a live GitHub + Slack run.

## Related

- [tools()](/manual/tools) — discover available tools before writing exec code
- [exec()](/manual/exec) — full API reference
- [Runtimes](/manual/runtimes) — when to use Node vs Bash vs Python
- [Sessions](/manual/sessions) — stateful multi-step patterns
