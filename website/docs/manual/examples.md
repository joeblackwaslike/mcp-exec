---
sidebar_position: 5
description: "Real-world examples showing token savings across common AI agent workflows"
---

# Examples

Five complete workflows showing what mcp-exec saves in practice. Each example includes the before/after token count and the exact exec call that replaces a bloated in-context approach.

---

## Overdue invoice triage — 27,000 → 80 tokens

**Use case:** Pull every overdue QuickBooks invoice, look up the customer contact for each, and create a single Gmail draft summarizing the list — all without loading raw invoice data into context.

**Without mcp-exec:** QuickBooks returns 847 raw invoices (+14,200 tokens). Customer lookups for each overdue invoice add another 8,000+ tokens. Claude hits the usage limit before the draft is sent.

**With mcp-exec:** The entire fetch-filter-lookup-draft pipeline runs inside the sandbox. Only the final confirmation string enters context.

```typescript
exec({
  runtime: "node",
  code: `
    import { searchInvoices, getInvoice } from 'mcp/quickbooks';
    import { getCustomer } from 'mcp/crm';
    import { createDraft } from 'mcp/gmail';

    // Fetch all overdue invoices
    const overdue = await searchInvoices({ status: 'overdue' });

    // Parallel lookup: full invoice + customer record
    const details = await Promise.all(
      overdue.map(inv => Promise.all([
        getInvoice({ id: inv.id }),
        getCustomer({ id: inv.customerId })
      ]))
    );

    // Compose draft body
    const body = details
      .map(([inv, cust]) => \`\${inv.invoiceNumber} — \${cust.name} — $\${inv.amount} due \${inv.dueDate}\`)
      .join('\\n');

    await createDraft({
      to: 'sales@co.com',
      subject: \`Overdue invoices (\${overdue.length})\`,
      body,
    });

    return \`Draft created — \${overdue.length} invoices\`;
  `
})
// → "Draft created — 23 invoices"   tokens used: ~80
```

---

## Morning standup brief — 20,000 → 60 tokens

**Use case:** Pull in-progress Linear tickets, open PRs, and overnight Slack mentions, then post a standup summary to `#standup` — all in one exec call.

**Without mcp-exec:** 34 Linear tickets + 12 PRs with diffs + 200 Slack messages = 20,000 tokens before the meeting starts. The standup post never gets written.

**With mcp-exec:** All three sources are fetched in parallel, summarized to counts, and posted to Slack — 60 tokens total.

```typescript
exec({
  runtime: "node",
  code: `
    import { getIssues } from 'mcp/linear';
    import { listPullRequests } from 'mcp/github';
    import { getMessages, postMessage } from 'mcp/slack';

    // Fan out to three servers in parallel
    const [tickets, prs, msgs] = await Promise.all([
      getIssues({ assignee: 'me', status: 'in_progress' }),
      listPullRequests({ state: 'open', author: 'me' }),
      getMessages({ channel: '#team', since: 'yesterday' }),
    ]);

    const blocked     = tickets.filter(t => t.labels.includes('blocked')).length;
    const needsReview = prs.filter(pr => pr.reviewers.length === 0).length;
    const mentions    = msgs.filter(m => m.text.includes('@me')).length;

    await postMessage({
      channel: '#standup',
      text: [
        \`Blocked: \${blocked}\`,
        \`PRs needing review: \${needsReview}\`,
        \`Mentions overnight: \${mentions}\`,
      ].join('\\n'),
    });

    return 'Standup posted';
  `
})
// → "Standup posted"   tokens used: ~60
```

---

## Research loop — 40,000 → 55 tokens

**Use case:** Search the web for a topic, fetch all 10 result pages in parallel, extract only the headings, and write them to a Google Doc for later reading — without any raw HTML entering context.

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

    // Extract only H1 and H2 headings from each page
    const insights = pages.flatMap(page =>
      page.headings.filter(h => h.level <= 2).map(h => h.text)
    );

    const doc = await createDoc({
      title: 'React Patterns 2025',
      content: insights.join('\\n'),
    });

    return doc.url;
  `
})
// → "https://docs.google.com/document/d/1BxiMVs..."   tokens used: ~55
```

---

## Stateful multi-step — load once, query many times

**Use case:** Load a large dataset into Node session state once, then slice it differently across multiple exec calls without re-hitting the API.

**Without mcp-exec:** Each question about the PR list re-fetches 100 PRs and loads them into context. Four questions = four fetches = context window full.

**With mcp-exec:** Load once into `globalThis`, query as many times as needed. The data lives in the sandbox between calls.

```typescript
// Step 1 — load 100 PRs into session state
exec({ runtime: "node", code: `
  import { listPullRequests } from 'mcp/github';
  globalThis.prs = await listPullRequests({ state: 'open', per_page: 100 });
  return globalThis.prs.length + ' PRs loaded';
`})
// → "100 PRs loaded"

// Step 2 — find stale PRs (no re-fetch)
exec({ runtime: "node", code: `
  const stale = globalThis.prs.filter(pr => {
    const days = (Date.now() - new Date(pr.updated_at)) / 86400000;
    return days > 14;
  });
  return stale.map(pr => ({
    number: pr.number,
    title: pr.title,
    days: Math.floor((Date.now() - new Date(pr.updated_at)) / 86400000),
  }));
`})
// → [{ number: 42, title: "chore: update deps", days: 21 }, { number: 57, title: "fix: null check", days: 18 }, ...]

// Step 3 — find PRs from a specific author (same session, no re-fetch)
exec({ runtime: "node", code: `
  const mine = globalThis.prs.filter(pr => pr.author.login === 'jsmith');
  return mine.map(pr => pr.number);
`})
// → [42, 103, 117]
```

---

## Python data analysis with pandas

**Use case:** Fetch CRM pipeline data via MCP, then analyze it with pandas — keeping thousands of raw rows out of context and returning only a 5-row summary.

**Without mcp-exec:** Raw CRM data (thousands of rows) loads into context so Claude can analyze it. Any moderately-sized dataset exhausts the token budget before the analysis is done.

**With mcp-exec:** Data is fetched in Node, written to a temp file, then analyzed by a PEP 723-declared Python script. Only the final summary enters context.

```typescript
// Step 1 — fetch pipeline data with Node
exec({ runtime: "node", code: `
  import { getPipelineDeals } from 'mcp/crm';
  import fs from 'fs';
  const deals = await getPipelineDeals({ owner: 'all', status: 'open' });
  fs.writeFileSync('/tmp/mcp-exec-pipeline.json', JSON.stringify(deals));
  return 'Written — ' + deals.length + ' deals';
`})
// → "Written — 1243 deals"
```

```python
# Step 2 — analyze with Python
exec({
  "runtime": "python",
  "code": """
# /// script
# requires-python = ">=3.12"
# dependencies = ["pandas>=2.0"]
# ///
import json, pandas as pd

data = json.load(open('/tmp/mcp-exec-pipeline.json'))
df = pd.DataFrame(data)
summary = df.groupby('stage')['amount'].sum().sort_values(ascending=False)
print(summary.head(5).to_json())
"""
})
# → '{"Closed Won":12400000,"Negotiation":4200000,"Proposal":2100000,"Qualification":980000,"Prospecting":430000}'
```

For the complete Node → Python handoff pattern, see [Sessions — data threading across runtimes](/docs/manual/sessions#data-threading-across-runtimes).

---

## Reproducible case study

The numbers above are real. The [case study](/docs/reference/case-study) page has full reproduction instructions, token logging commands, and expected output for the PR staleness nudge workflow — **43,800 tokens → 90 tokens** on a live GitHub + Slack run.

## Related

- [tools()](/docs/manual/tools) — discover available tools before writing exec code
- [exec()](/docs/manual/exec) — full API reference
- [Runtimes](/docs/manual/runtimes) — when to use Node vs Bash vs Python
- [Sessions](/docs/manual/sessions) — stateful multi-step patterns
