# mcp-exec

Claude Code plugin + MCP server that proxies downstream MCP servers through a sandboxed execution layer, keeping intermediate results out of the context window.

## Plugin Development

When working on or developing this plugin (modifying hooks, commands, skills, or plugin.json), load these before making any structural changes:

- `plugin-dev@claude-plugins-official` — canonical directory layout, manifest spec, hook wiring format, command frontmatter rules
- `skill-creator@claude-plugins-official` — skill description quality, progressive disclosure, trigger reliability, writing style

Also consult `docs/architecture/` for design context:

TODO: [write docs/architecture/{files}.md and list each here with description after prd finalized]

## Project overview

`mcp-exec` exposes two tools to Claude Code:
- `tools(query)` — searches connected MCP servers, returns trimmed summaries
- `exec(code, runtime)` — runs code in an OS-level sandbox, returns only final output

Goal: reduce per-workflow token consumption by 80–95% on multi-tool tasks.

## Plugin structure

Distributed as a Claude Code plugin (`plugin.json` at root). Registers:

- The `mcp-exec` MCP server (auto-added to user's MCP config on install)
- Skills in `skills/` (SKILL.md + SDK references + examples)
- `install-skill` command for appending the skill loader to CLAUDE.md

## Stack

- TypeScript / Node.js
- `@anthropic-ai/sandbox-runtime` (`srt`) for OS-level sandboxing
- MCP SDK for server/client communication
- `uv` for Python runtime (v0.3+)

## File layout

```
src/
  server.ts              ← MCP server entry, registers tools/exec
  catalog/
    index.ts             ← lazy-loaded tool catalog, substring AND search
  sandbox/
    index.ts             ← exec({ runtime, code }) → ExecResult interface
    config.ts            ← reads CC settings.json files, maps to SandboxRuntimeConfig
    runtimes/
      node.ts
      bash.ts
      python.ts          ← v0.3+
skills/
  SKILL.md
  ts-sdk-reference.md
  py-sdk-reference.md    ← v0.3+
  examples/
docs/
  prds/
```

## Key design decisions

- **Sandbox config**: read `sandbox` block from `~/.claude/settings.json` + `.claude/settings.json`, merge arrays, map to `SandboxRuntimeConfig`. ~30 lines. Do not replicate CC's full config parser.
- **MCP server hosts**: read from `.claude/mcp.json` at startup; server hostnames merged into `allowedDomains`.
- **Sessions**: implicit by default (shared within a conversation); explicit `session_id` only for parallel isolation. `globalThis.*` persistence is Node-only — Bash/Python are stateless.
- **Thenable chaining**: `exec()` returns a real `Promise<ExecResult>` — standard `.then()`, no auto-piping. Agent uses `execResult.stdout` to thread raw output between runtimes explicitly.
- **Runtime param**: string shorthand (`"node"`, `"bash"`, `"python"`) or config object (`{ type: "node", timeout?: number, env?: Record<string,string> }`). Sandbox policy is global (settings.json only) — not per-call configurable.

## Development milestones

- **v0.1**: Node + Bash runtimes, hardcoded Gmail/GDrive shims, `tools` + `exec`, implicit sessions, thenable chaining, `install-skill` CLI
- **v0.2**: Generic MCP shim generator, `tools(query)` with lazy catalog, `ts-sdk-reference.md`
- **v0.3**: Python runtime via `uv run --isolated`, `py-sdk-reference.md`
- **v1.0**: Token benchmark CI suite, state persistence, telemetry

## Constraints

- Zero changes to Claude Code itself — pure MCP config
- No hosted/cloud product — local-first only
- No vendor lock-in or credential system assumptions
- Auth via env vars present in the shell environment (`.env`, direnv, secrets manager)
