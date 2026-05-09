---
description: How mcp-exec's sandbox execution model works — subprocess isolation, session lifetime, and MCP shim generation
---

# Architecture

## Sandbox execution model

When Claude calls the `exec` MCP tool, mcp-exec spawns a sandboxed subprocess (or reuses a persistent session context) and runs the submitted code inside it. The sandbox is an OS-level process boundary enforced by `@anthropic-ai/sandbox-runtime` (`srt`) — the same sandbox Claude Code uses for its built-in bash tool.

This differs from native tool calls in one important way: **downstream MCP tool invocations inside the sandbox happen within that subprocess**, not through Claude Code's tool-use event system. From CC's perspective, only one tool was called: `exec`.

## Startup flow

When the mcp-exec server starts, it executes the following sequence:

1. Read `SandboxRuntimeConfig` from `.claude/settings.json` files (project-scope, then user-scope)
2. Connect all downstream MCP clients from `mcp.json`
3. Build tool catalog (summaries only, not full schemas)
4. Register ESM loader hooks for generated shims
5. Create `SessionManager` for Node state
6. Listen for `exec` and `tools` tool calls

## Key design decisions

**Sessions** — Implicit by default; all `exec` calls within a conversation share one session context. Pass an explicit `session_id` only when you need parallel isolation (e.g. two concurrent workflows that must not share `globalThis` state). Note that `globalThis.*` persistence is Node-only — Bash and Python runtimes are stateless.

**Thenable chaining** — `exec()` returns a real `Promise<ExecResult>`, not a custom thenable. Use standard `.then()` chaining. The agent uses `execResult.stdout` to thread raw output between runtimes explicitly; there is no auto-piping.

**Runtime param** — accepts a string shorthand (`"node"`, `"bash"`, `"python"`) or a config object:

```typescript
{ type: "node", timeout?: number, env?: Record<string, string> }
```

Sandbox policy (network domains, filesystem access) is global and configured in `settings.json` only — it is not per-call configurable.

## Project structure

```text
src/
  server.ts              ← MCP server entry, registers tools/exec
  catalog/
    index.ts             ← lazy-loaded tool catalog, substring AND semantic search
  sandbox/
    index.ts             ← exec dispatcher → ExecResult interface
    config.ts            ← reads CC settings.json files, maps to SandboxRuntimeConfig
    session.ts           ← SessionManager for Node state
    runtimes/
      node.ts
      bash.ts
      python.ts
  loader/
    hooks.js             ← ESM loader hooks for MCP shim generation
skills/
  SKILL.md
  ts-sdk-reference.md
  py-sdk-reference.md
  examples/
docs/
  prds/
```
