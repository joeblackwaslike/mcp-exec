---
description: Node.js, Bash, and Python runtimes — state models, packages, and use cases
---

# Runtimes

mcp-exec supports three runtimes. Choose based on whether you need MCP tool access, state persistence, or arbitrary Python packages.

| | Node.js | Bash | Python |
| --- | --- | --- | --- |
| State | Persistent (`globalThis`) | Stateless | Stateless |
| MCP access | Yes, via imports | No | Yes, via HTTP bridge |
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

**MCP access:** Available via HTTP bridge. Import tools with `from mcp.<server_name> import <tool_name>` — the sandbox auto-generates a local `mcp/` package and injects it into `PYTHONPATH`.

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

### MCP imports in Python

Python can import MCP tools the same way Node.js does, using the `mcp.<server>` import syntax:

```python
exec({
  "runtime": "python",
  "code": """
from mcp.github import list_pull_requests
from mcp.linear import search_issues

prs = list_pull_requests(state="open", repo="my-org/my-repo")
issues = search_issues(query="bug label:p0")

print(f"{len(prs)} open PRs, {len(issues)} P0 bugs")
"""
})
```

**How it works:** mcp-exec starts a local HTTP bridge alongside the Python process. At import time, the auto-generated `mcp/` package dispatches each function call to the bridge, which forwards it to the real MCP client and returns the result. The Python script never makes direct network calls — all MCP routing goes through the bridge.

**Limitations:** Python MCP calls are synchronous (no `await`). Concurrent fan-out requires `ThreadPoolExecutor` or similar. There is no session state — each exec call starts fresh.

### PEP 723 inline dependencies

Declare package requirements in a comment block at the top of the script. `uv` reads and installs them before running:

```python
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "pandas>=2.0",
#   "httpx",
#   "rich",
# ]
# ///

import pandas as pd
import httpx
from rich import print
```

No `requirements.txt`, no `pip install`, no lockfile — each exec call is self-contained.

### Node → Python data handoff

When you need to fetch data via MCP tools and then analyze it with Python, write the data to a temp file in Node and read it in Python:

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

### What Python cannot do

- **No session state:** `globalThis`, module-level variables, and imported modules don't persist between exec calls.
- **No concurrent sessions:** Python has no session ID concept — exec calls don't share state even with an explicit `session_id`.
- **No direct process access:** `subprocess`, `os.system`, etc. are subject to the same sandbox restrictions as other runtimes.

## Related

- [exec()](/manual/exec) — full parameter reference
- [Sessions](/manual/sessions) — how Node session state works across calls
- [Examples](/manual/examples) — complete workflows per runtime
