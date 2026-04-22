---
name: mcp-exec Dev Workflow
description: Load when building a TypeScript project and about to fetch API docs, process large API responses, run multi-step research, or aggregate data from multiple sources during development
version: 0.3.0
---

# mcp-exec Dev Workflow

Use this skill when actively building a project and needing to do research, explore APIs, or process data. It keeps large intermediate results out of the context window so you stay focused on the work.

## The decision rule

**Call the tool directly** when:
- You need a single small result
- You want to reason about the raw output
- You want CC hooks to fire for that tool call

**Use `exec()`** when:
- The workflow touches 2+ tools
- Intermediate results are large (API docs, search results, lists of records)
- You need to filter, transform, or aggregate before returning

## The research workflow pattern

```
fetch → filter/transform → return clean summary
```

Example: fetching eBay API docs returns 8,000 tokens of spec. With `exec()` you return a 200-token summary of the relevant endpoints. The intermediate 8,000 tokens never touch the context window.

```typescript
exec({ runtime: "node", code: `
  // fetch the full spec — stays in sandbox
  const resp = await fetch('https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search');
  const html = await resp.text();

  // extract what matters
  const params = html.match(/query parameter.*?<\/tr>/gs)
    ?.map(row => row.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean)
    .slice(0, 10);

  return params?.join('\n') ?? 'no params found';
`})
// → "q (string) — keyword search\nlimit (integer) — max results\n..."
// 200 tokens, not 8,000
```

## Common dev task recipes

### API exploration — summarize a response shape

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

## Project setup

1. **Install the plugin** via Claude Code's plugin system — auto-wires the MCP server into your conversation
2. **Run `/install-skill`** to append the mcp-exec skill to your project's `CLAUDE.md`
3. **Add a `sandbox` block** to `.claude/settings.json` listing the domains your MCP servers and `fetch` calls need:

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

Without a `sandbox` block, all outbound network is blocked by default. You must explicitly list every domain.

## When NOT to use exec()

- Single tool call where you want the result in context to reason over directly
- When a CC `PreToolUse`/`PostToolUse` hook must fire for that specific downstream tool call
- Interactive debugging where the user needs to see intermediate state
- Simple stdout/stderr from a local process (use the Bash tool directly)

## Reference

Full API reference, session state, and cross-runtime threading patterns:
- `../using-mcp-exec/ts-sdk-reference.md` — Node.js patterns
- `../using-mcp-exec/py-sdk-reference.md` — Python patterns
