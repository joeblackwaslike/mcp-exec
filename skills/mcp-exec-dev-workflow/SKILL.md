---
name: mcp-exec-dev-workflow
description: Use when doing research or data work during development — fetching API docs, exploring endpoints, processing API responses, or aggregating data — and you want intermediate results kept out of context
---

# mcp-exec Dev Workflow

Core principle: fetch → filter/transform → return clean summary. Every intermediate step stays in the sandbox.

## Decision rule

**Call the tool or fetch directly** when:
- The result is small and you need to reason over the raw output
- You want CC hooks to fire for that specific call

**Use `exec()`** when:
- The response would be large (API docs, search results, record lists)
- You need to filter, transform, or aggregate before returning
- Even a single fetch returns more than you need — extract just the relevant part

The key insight: a single HTTP fetch returning 8,000 tokens of API docs can be reduced to a 200-token summary. The 7,800 tokens never enter context.

## The research workflow pattern

```
fetch → filter/transform → return clean summary
```

```typescript
exec({ runtime: "node", code: `
  const resp = await fetch('https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search');
  const html = await resp.text();
  const params = html.match(/query parameter.*?<\/tr>/gs)
    ?.map(row => row.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean).slice(0, 10);
  return params?.join('\n') ?? 'no params found';
`})
// → 200 tokens returned, not 8,000
```

## Common dev task recipes

### API exploration — summarize response shape

```typescript
exec({ runtime: "node", code: `
  const resp = await fetch('https://api.example.com/v1/items/sample-id', {
    headers: { Authorization: 'Bearer ' + process.env.API_KEY }
  });
  const data = await resp.json();
  const shape = (obj, depth = 0) => {
    if (depth > 2) return typeof obj;
    if (Array.isArray(obj)) return [shape(obj[0], depth + 1)];
    if (typeof obj === 'object' && obj) return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, shape(v, depth + 1)])
    );
    return typeof obj;
  };
  return JSON.stringify(shape(data), null, 2);
`})
```

### Multi-source fan-out — merge results from multiple APIs

```typescript
exec({ runtime: "node", code: `
  const [source1, source2] = await Promise.all([
    fetch('https://api.source1.com/search?q=query').then(r => r.json()),
    fetch('https://api.source2.com/search?q=query').then(r => r.json()),
  ]);
  const merged = [
    ...source1.items.map(i => ({ source: 'source1', price: i.price })),
    ...source2.results.map(i => ({ source: 'source2', price: i.salePrice })),
  ].sort((a, b) => a.price - b.price);
  const median = merged[Math.floor(merged.length / 2)].price;
  return { median, count: merged.length, range: [merged[0].price, merged.at(-1).price] };
`})
```

### Schema diffing — compare two environment responses

```typescript
exec({ runtime: "node", code: `
  const [prod, staging] = await Promise.all([
    fetch('https://api.prod.example.com/schema').then(r => r.json()),
    fetch('https://api.staging.example.com/schema').then(r => r.json()),
  ]);
  const prodKeys = new Set(Object.keys(prod.properties ?? {}));
  const stagingKeys = new Set(Object.keys(staging.properties ?? {}));
  return {
    onlyInProd: [...prodKeys].filter(k => !stagingKeys.has(k)),
    onlyInStaging: [...stagingKeys].filter(k => !prodKeys.has(k)),
  };
`})
```

### Large dataset processing — fetch with Node, analyze with Python

```typescript
// Step 1 (node): fetch records, write to temp file
exec({ runtime: "node", code: `
  import { writeFileSync } from 'fs';
  const resp = await fetch('https://api.example.com/records?limit=5000');
  const rows = await resp.json();
  writeFileSync('/tmp/mcp-exec-rows.json', JSON.stringify(rows));
  return rows.length + ' rows written to /tmp/mcp-exec-rows.json';
`})

// Step 2 (python): analyze with pandas, return summary
exec({ runtime: "python", code: `
# /// script
# dependencies = ["pandas"]
# ///
import pandas as pd, json

with open('/tmp/mcp-exec-rows.json') as f:
    data = json.load(f)

df = pd.DataFrame(data)
summary = df.groupby('category')['price'].agg(['mean', 'count']).round(2)
print(summary.to_json())
`})
```

## Red flags

| Thought | Reality |
|---|---|
| "This is just one fetch, not worth the overhead." | A single fetch returning docs or records is exactly the case `exec()` is designed for. |
| "I'll skim the large response myself." | You can't unspend the tokens. Filter before returning. |
| "The API docs are probably short." | They never are. Always fetch through `exec()`. |
| "I only need to filter once." | Filter in the sandbox, return the clean result. |

## Project setup

1. Install plugin via Claude Code's plugin system — auto-wires the MCP server
2. Run `/mcp-exec-prime-skill` to append the skill activation to your project's `CLAUDE.md`
3. Add a `sandbox` block to `.claude/settings.json` listing domains your fetch calls need:

```json
{
  "sandbox": {
    "network": {
      "allowedDomains": [
        "api.github.com",
        "api.example.com"
      ]
    }
  }
}
```

Without a `sandbox` block, all outbound network is blocked by default.

## When NOT to use exec()

- Single call where the result is small and you want the raw output in context
- When a CC `PreToolUse`/`PostToolUse` hook must fire for that specific call
- Interactive debugging where the user needs to see intermediate state
- Simple local shell operations (use Bash tool directly)

## Reference

Full API reference, session state, and cross-runtime threading patterns:
- `../using-mcp-exec/ts-sdk-reference.md` — Node.js patterns
- `../using-mcp-exec/py-sdk-reference.md` — Python patterns
