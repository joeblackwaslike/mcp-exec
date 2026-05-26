# mcp-exec — Agent Instructions

## MCP Server

This project registers the `mcp-exec` MCP server. It exposes two tools:

- **`tools(query)`** — search connected MCP servers, returns trimmed tool summaries (`{ server, name, description, signature }`). Never loads full schemas into context.
- **`exec(code, runtime)`** — run code in a sandboxed environment; only the final output is returned. Runtimes: `"node"`, `"bash"`, `"python"`.

The server is already configured at `[mcp_servers.mcp-exec]` in your Codex config.

## Skills

Two skills are available via skill links (`~/.codex/skill-links.json`):

- **`using-mcp-exec`** — discover MCP tools and run sandboxed workflows
- **`mcp-exec-dev-workflow`** — research and data work during development (fetch docs, explore APIs, aggregate results)

Use the `skill` tool to load them: `skill("using-mcp-exec")` or `skill("mcp-exec-dev-workflow")`.

## When to activate `using-mcp-exec`

- You are about to call 2+ MCP tools in sequence and intermediate results don't need to stay in context
- A single MCP tool call would return large results (record lists, API responses, search results)
- Multi-step research, data aggregation, or schema processing
- Fanning out across multiple sources to return a single summary

## When to activate `mcp-exec-dev-workflow`

- Fetching API docs or exploring unfamiliar endpoints during active development
- Processing large API responses or aggregating data in a dev research workflow
- Even a single fetch returning 8,000+ tokens of docs — exec() can reduce it to a 200-token summary

## Import syntax (inside exec)

```typescript
import { toolName } from 'mcp/server-name';
```

Server names match keys in `.claude/mcp.json` or your Codex MCP config.

## Documentation

Full docs: **https://joeblackwaslike.github.io/mcp-exec/**

- [Guide](https://joeblackwaslike.github.io/mcp-exec/docs/guide/introduction) — Introduction, Installation, Getting Started, Configuration, CLI, Security
- [User Manual](https://joeblackwaslike.github.io/mcp-exec/docs/manual/tools) — tools(), exec(), Runtimes, Sessions, Examples
- [Developer](https://joeblackwaslike.github.io/mcp-exec/docs/developer/architecture) — Architecture, Plugin Compatibility, Observability, Codex Sandboxing
- [Reference](https://joeblackwaslike.github.io/mcp-exec/docs/reference/competitive-analysis) — Competitive Analysis, Case Study, Projects Featured In, Changelog

Codex-specific sandboxing: [Developer → Codex Sandboxing](https://joeblackwaslike.github.io/mcp-exec/docs/developer/codex-sandboxing)

## Stack

TypeScript / Node.js. See `CLAUDE.md` for full project context and architecture details.
