@./skills/using-mcp-exec/SKILL.md
@./skills/mcp-exec-dev-workflow/SKILL.md

# mcp-exec

This project provides the `mcp-exec` MCP server with two tools:

- **`tools(query)`** — search connected MCP servers for available tools; returns trimmed summaries without loading full schemas into context
- **`exec(code, runtime)`** — run code (`"node"`, `"bash"`, or `"python"`) in a sandbox; only the final output is returned to context

## When to use `using-mcp-exec`

Load the `using-mcp-exec` skill when you are about to:
- Call 2+ MCP tools in sequence where intermediate results don't need to stay in context
- Make a single MCP call that would return large results (record lists, API responses, search results)
- Do multi-step research, data aggregation, or schema processing
- Fan out across multiple sources and return a single summary

## When to use `mcp-exec-dev-workflow`

Load the `mcp-exec-dev-workflow` skill when doing research during active development:
- Fetching API docs or exploring unfamiliar endpoints
- Processing large API responses or aggregating data
- Even a single HTTP fetch returning thousands of tokens of docs — `exec()` can reduce it to a 200-token summary

## Import syntax (inside exec)

```typescript
import { toolName } from 'mcp/server-name';
```

Server names match keys in `.claude/mcp.json`.
