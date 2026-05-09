---
description: Node.js, Bash, and Python runtimes — state models, packages, and use cases
---

# Runtimes

mcp-exec supports three runtimes. Choose based on whether you need MCP tool access, state persistence, or arbitrary Python packages.

| | Node.js | Bash | Python |
| --- | --- | --- | --- |
| State | Persistent (`globalThis`) | Stateless | Stateless |
| MCP access | Yes, via imports | No | No |
| Return value | IIFE return | stdout | stdout |
| Custom packages | 6 bundled | system tools | PEP 723 (any PyPI) |
| Best for | Orchestration | Pipelines | Data analysis |

---

## Node.js

**State:** Persistent within a session via `globalThis`. Data stored between calls is available in subsequent exec calls within the same conversation.

**MCP imports:** `import { tool } from 'mcp/server-name'`

**Bundled packages** (no install step needed): `zod`, `lodash-es`, `date-fns`, `csv-parse`, `cheerio`, `xlsx`

**Return value:** The last expression of the async IIFE body. Structured values (objects, arrays) are returned as-is.

**Best for:** MCP orchestration, multi-step workflows, stateful computation, anything that needs to call multiple MCP tools and aggregate results.

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
// → "Draft created — 23 invoices"
```

---

## Bash

**State:** Stateless. Every exec call spawns a fresh process — no environment carries over between calls.

**Return value:** stdout. Use `echo` or command output directly; the last thing written to stdout is what comes back.

**MCP access:** Not available. Bash cannot import MCP modules. Use Node to call MCP tools, then pass the data to Bash for processing via interpolation or temp files.

**Best for:** Unix pipelines, `jq`, `awk`, `grep`, `curl`, post-processing structured data that was fetched in a prior Node exec call.

```typescript
// Fetch data in Node, process in Bash
const { result: data } = await exec({
  runtime: "node",
  code: `
    import { getRevenueData } from 'mcp/crm';
    return await getRevenueData({ period: 'Q4' });
  `
});

exec({
  runtime: "bash",
  code: `echo '${JSON.stringify(data)}' | jq '[.[] | select(.amount > 1000)] | length'`
})
```

---

## Python

**State:** Stateless. `uv run --isolated` creates a fresh environment for every call — no installed packages persist between exec calls.

**Return value:** stdout. Use `print()` to emit your result; the full stdout is captured as `result`.

**MCP access:** Not available from Python. Pass data via temp files or environment variables set in the `runtime` config object.

**Dependencies:** Declare inline using [PEP 723](https://peps.python.org/pep-0723/) script headers. `uv` resolves and installs them at run time — no separate install step, no lockfile needed.

**Best for:** Data analysis with pandas/numpy, statistical computation, tasks that need arbitrary PyPI packages unavailable in Node.

```python
exec({
  "runtime": "python",
  "code": """
# /// script
# requires-python = ">=3.12"
# dependencies = ["pandas>=2.0", "numpy"]
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

### Passing data into Python

Since Python can't import MCP tools, the typical pattern is: fetch with Node, write to a temp file, analyze with Python.

```typescript
// Step 1 — fetch with Node
exec({ runtime: "node", code: `
  import { getRevenueData } from 'mcp/crm';
  import fs from 'fs';
  const data = await getRevenueData({ period: 'Q4' });
  fs.writeFileSync('/tmp/mcp-exec-revenue.json', JSON.stringify(data));
  return 'written';
`})

// Step 2 — analyze with Python
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

## Related

- [exec()](/manual/exec) — full parameter reference
- [Sessions](/manual/sessions) — how Node session state works across calls
- [Examples](/manual/examples) — complete workflows per runtime
