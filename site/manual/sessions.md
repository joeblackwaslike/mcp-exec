---
description: Node.js session state — implicit conversations, explicit isolation, and expiry
---

# Sessions

Sessions govern how state persists between `exec()` calls. Only the Node.js runtime has session state — Bash and Python are always stateless.

## Implicit sessions

By default, all Node exec calls within a conversation share one implicit session. `globalThis` is your state container — anything you write there is readable in the next exec call without re-fetching.

```typescript
// Call 1 — load data
exec({ runtime: "node", code: `
  import { listPullRequests } from 'mcp/github';
  globalThis.prs = await listPullRequests({ state: 'open', per_page: 100 });
  return globalThis.prs.length + ' PRs loaded';
`})
// → "100 PRs loaded"

// Call 2 — use cached data (no re-fetch)
exec({ runtime: "node", code: `
  const stale = globalThis.prs.filter(pr => {
    const days = (Date.now() - new Date(pr.updated_at)) / 86400000;
    return days > 14;
  });
  return stale.length + ' stale PRs';
`})
// → "7 stale PRs"
```

## Explicit session isolation

Provide a `session_id` to run parallel workflows that must not share state. Each unique ID gets its own isolated `globalThis`.

```typescript
// Two independent analyses, running in parallel
exec({ runtime: "node", session_id: "analysis-a", code: `
  globalThis.data = [1, 2, 3];
  return globalThis.data.length;
`})

exec({ runtime: "node", session_id: "analysis-b", code: `
  globalThis.data = [10, 20, 30, 40];
  return globalThis.data.length;
`})

// Each session's globalThis.data is independent
```

Use explicit session IDs when you're fan-out orchestrating — e.g., running the same analysis against multiple accounts or environments simultaneously.

## Session expiry

Sessions expire after **10 minutes of idle time**. Re-entering after expiry starts a fresh session — `globalThis` is empty and any data previously stored is gone. If your workflow spans a long interactive session, re-fetch data if you're uncertain whether the session is still warm.

## Session limits

Maximum **100 concurrent sessions**. When the limit is reached, the oldest idle session is evicted to make room. Active sessions (one with a call in flight) are never evicted.

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
  return 'Data written';
`})

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
```

Use a consistent temp file naming convention (e.g., `/tmp/mcp-exec-<workflow>-<step>.json`) to avoid collisions across parallel workflows.

## Related

- [Runtimes](/manual/runtimes) — state models per runtime
- [exec()](/manual/exec) — `session_id` parameter reference
- [Examples](/manual/examples) — stateful multi-step workflow example
