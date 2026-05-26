---
sidebar_position: 4
description: "Node.js session state — implicit conversations, explicit isolation, and expiry"
---

# Sessions

Sessions govern how state persists between `exec()` calls. Only the Node.js runtime has session state — Bash and Python are always stateless.

## Implicit sessions

By default, all Node exec calls within a conversation share one implicit session. `globalThis` is your state container — anything you write there is readable in the next exec call without re-fetching.

```typescript
// Call 1 — load data into session
exec({ runtime: "node", code: `
  import { listPullRequests } from 'mcp/github';
  globalThis.prs = await listPullRequests({ state: 'open', per_page: 100 });
  return globalThis.prs.length + ' PRs loaded';
`})
// → "100 PRs loaded"

// Call 2 — use cached data, no re-fetch
exec({ runtime: "node", code: `
  const stale = globalThis.prs.filter(pr => {
    const days = (Date.now() - new Date(pr.updated_at)) / 86400000;
    return days > 14;
  });
  return stale.length + ' stale PRs';
`})
// → "7 stale PRs"
```

This matters because re-fetching a 100-item list on every exec call would cost tokens each time. Storing it in `globalThis` once and slicing it in subsequent calls keeps token consumption flat across the whole workflow.

## Explicit session isolation

Provide a `session_id` to run parallel workflows that must not share state. Each unique ID gets its own isolated `globalThis`.

```typescript
// Two independent analyses running in parallel
exec({ runtime: "node", session_id: "analysis-west", code: `
  import { getRevenueData } from 'mcp/crm';
  globalThis.data = await getRevenueData({ region: 'west', period: 'Q4' });
  return globalThis.data.length + ' records';
`})

exec({ runtime: "node", session_id: "analysis-east", code: `
  import { getRevenueData } from 'mcp/crm';
  globalThis.data = await getRevenueData({ region: 'east', period: 'Q4' });
  return globalThis.data.length + ' records';
`})

// Each session's globalThis.data is fully independent —
// "analysis-west" and "analysis-east" never see each other's data
```

Use explicit session IDs when you're fan-out orchestrating — e.g., running the same analysis against multiple accounts, regions, or environments simultaneously.

## Session lifecycle

### Expiry

Sessions expire after **10 minutes of idle time**. Re-entering after expiry starts a fresh session — `globalThis` is empty and any data previously stored there is gone.

If your workflow spans a long interactive session, re-fetch data if you're uncertain whether the session is still warm. A safe pattern is to check for the expected key before using it:

```typescript
exec({ runtime: "node", code: `
  if (!globalThis.prs) {
    import { listPullRequests } from 'mcp/github';
    globalThis.prs = await listPullRequests({ state: 'open', per_page: 100 });
  }
  return globalThis.prs.length + ' PRs available';
`})
```

### Capacity

Maximum **100 concurrent sessions**. When the limit is reached, the oldest idle session is evicted to make room. Active sessions — those with a call currently in flight — are never evicted.

## Bash and Python are always stateless

`session_id` has no effect on Bash or Python runtimes. Every Bash exec spawns a fresh subprocess; every Python exec runs `uv run --isolated` in a clean environment. Do not rely on file system state between Bash or Python calls unless you explicitly write to a known path.

## Data threading across runtimes

Because Bash and Python are stateless, the standard pattern for cross-runtime data passing is temp files written by Node and read by the downstream runtime.

```typescript
// Step 1 — fetch with Node, persist to disk
exec({ runtime: "node", code: `
  import { getRevenueData } from 'mcp/crm';
  import fs from 'fs';
  const data = await getRevenueData({ period: 'Q4' });
  fs.writeFileSync('/tmp/mcp-exec-revenue.json', JSON.stringify(data));
  return 'Data written — ' + data.length + ' rows';
`})
// → "Data written — 843 rows"

// Step 2 — analyze with Python (reads from disk)
exec({ runtime: "python", code: `
# /// script
# dependencies = ["pandas"]
# ///
import json, pandas as pd
data = json.load(open('/tmp/mcp-exec-revenue.json'))
df = pd.DataFrame(data)
print(df.groupby('region')['revenue'].sum().to_json())
`})
// → '{"East":1840000,"South":920000,"West":2100000}'
```

Use a consistent temp file naming convention (e.g., `/tmp/mcp-exec-<workflow>-<step>.json`) to avoid collisions across parallel workflows using explicit `session_id`.

## Related

- [Runtimes](/docs/manual/runtimes) — state models per runtime
- [exec()](/docs/manual/exec) — `session_id` parameter reference
- [Examples](/docs/manual/examples) — stateful multi-step workflow example
