# PRD: `mcp-exec` — Code Execution MCP Plugin for Claude Code

**Status:** Draft v5
**Last updated:** 2026-04

---

## Problem

When Claude Code is connected to many MCP servers, intermediate results from tool calls
pass back and forth through the context window. For workflows touching 10+ tools, this
burns 50k–150k tokens per workflow — increasing cost, latency, and exhausting context
faster.

## Solution

A single MCP server (`mcp-exec`) that acts as a proxy layer. Instead of Claude calling
individual tools directly, it writes short scripts that import MCP servers as code modules
and runs them in an isolated sandbox. Only the final output returns to the model.
Intermediate data — large result sets, filtered rows, fetched documents — never enters
the context window.

---

## Goals

- Reduce per-workflow token consumption by 80–95% on multi-tool tasks
- Allow Claude Code to access arbitrarily many downstream tools without context bloat
- Zero changes to Claude Code itself — pure MCP configuration
- OS-level sandbox reusing the user's existing CC sandbox settings — zero extra config
  for users who already have CC sandboxing set up
- Shareable, general-purpose: no vendor lock-in, no credential system assumptions

## Non-goals

- Replacing direct tool calls for simple single-tool tasks
- A hosted/cloud product (local-first, runs on the dev machine)
- Support for non-MCP tool protocols in v1

---

## Architecture

### Components

**1. `mcp-exec` server** — the MCP server registered with Claude Code. Exposes two tools:

- `list_tools(query?: string)` — returns matching tools from connected MCP servers.
  Returns trimmed summaries: `name`, `description`, one-line signature.
- `run_code(code: string, language: "typescript" | "python", session_id?: string)` —
  executes submitted code in the sandbox and returns the final result.

**2. Tool catalog** — in-process index of downstream MCP server schemas, loaded lazily
per server on first `list_tools` call. Full schemas are never bulk-sent to the model;
only trimmed summaries are returned.

**3. Execution sandbox** — powered by `@anthropic-ai/sandbox-runtime` (`srt`), the same
sandbox Anthropic uses internally for Claude Code's bash tool. Uses OS-level primitives:
`sandbox-exec` (macOS Seatbelt) on macOS, `bubblewrap` on Linux/WSL2. All restrictions
apply to every child process spawned by agent code — not just the top-level process.

**4. Runtime abstraction layer** — thin interface over subprocess spawning, structured
to accommodate Node.js now and Python in v0.3:

```
sandbox/
  index.ts              ← interface: execute(code, language, session) → result
  runtimes/
    node.ts             ← Node.js subprocess runner (v0.1+)
    python.ts           ← Python subprocess runner (v0.3+)
  runner-template.ts    ← shim harness, shared across runtimes
```

The sandbox layer (srt) wraps whichever subprocess is spawned. Adding Python is a new
`python.ts` spawn wrapper — no changes to the sandbox or catalog layers.

---

## Sandbox configuration

### How srt config works

`@anthropic-ai/sandbox-runtime` exposes `SandboxManager` and `SandboxRuntimeConfig`:

```typescript
import { SandboxManager, type SandboxRuntimeConfig } from '@anthropic-ai/sandbox-runtime'

const config: SandboxRuntimeConfig = {
  network: {
    allowedDomains: ['api.github.com', 'gmail.googleapis.com'],
  },
  filesystem: {
    allowWrite: ['~/.mcp-exec/sessions', '/tmp'],
    denyRead: ['~/.ssh', '~/.aws'],
  },
}

await SandboxManager.initialize(config)
const sandboxedCmd = await SandboxManager.wrapWithSandbox('node runner.js')
```

This is `srt`'s own config format. CC's `settings.json` uses a different (but parallel)
schema. The CC settings parser itself — including scope merging, path prefix resolution,
managed/MDM handling — lives in the closed-source CC binary and is not exported from
any public package. There is nothing to import.

### What mcp-exec does instead

At startup, `mcp-exec` reads two JSON files:

- `~/.claude/settings.json` (user scope)
- `.claude/settings.json` (project scope, if present)

It extracts the `sandbox` key from each and merges them using the same array-union
semantics CC uses: arrays concatenate, they don't replace. It then maps the result to
`SandboxRuntimeConfig` and passes it to `SandboxManager.initialize()`.

This is intentionally minimal: two JSON reads, one array merge, one schema mapping.
About 30 lines of code. The CC config complexity that's being deliberately avoided
(managed settings, MDM/plist/registry delivery, enterprise scope overrides,
`allowManagedReadPathsOnly` flags) is all irrelevant for an open source tool targeting
individual developers. The two files `mcp-exec` reads are the only ones that matter
for that audience.

```typescript
// sandbox/config.ts — the entire config resolution logic

import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { SandboxRuntimeConfig } from '@anthropic-ai/sandbox-runtime'

interface CcSandboxBlock {
  network?: { allowedDomains?: string[] }
  filesystem?: {
    allowWrite?: string[]
    denyRead?: string[]
    denyWrite?: string[]
    allowRead?: string[]
  }
}

function readSandboxBlock(path: string): CcSandboxBlock {
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'))
    return (raw?.sandbox as CcSandboxBlock) ?? {}
  } catch {
    return {}
  }
}

function mergeArrays(...arrays: (string[] | undefined)[]): string[] {
  return [...new Set(arrays.flat().filter((x): x is string => x != null))]
}

export function resolveSandboxConfig(
  mcpServerUrls: string[],
): SandboxRuntimeConfig {
  const user = readSandboxBlock(join(homedir(), '.claude', 'settings.json'))
  const project = readSandboxBlock(join(process.cwd(), '.claude', 'settings.json'))

  // extract hostnames from declared MCP server URLs
  const mcpHosts = mcpServerUrls.flatMap(url => {
    try { return [new URL(url).host] } catch { return [] }
  })

  return {
    network: {
      allowedDomains: mergeArrays(
        user.network?.allowedDomains,
        project.network?.allowedDomains,
        mcpHosts,
        ['localhost', '127.0.0.1'],
      ),
    },
    filesystem: {
      allowWrite: mergeArrays(
        user.filesystem?.allowWrite,
        project.filesystem?.allowWrite,
        ['~/.mcp-exec/sessions'],
      ),
      denyRead: mergeArrays(
        user.filesystem?.denyRead,
        project.filesystem?.denyRead,
      ),
      denyWrite: mergeArrays(
        user.filesystem?.denyWrite,
        project.filesystem?.denyWrite,
      ),
      allowRead: mergeArrays(
        user.filesystem?.allowRead,
        project.filesystem?.allowRead,
      ),
    },
  }
}
```

### Schema drift risk

The only fragility is if Anthropic renames fields inside the `sandbox` block of
`settings.json`. This would be a breaking change to CC's own config format — unlikely
and semver-significant if it happened. The mapping function is the only code that would
need updating, and it's isolated in one file. This is an acceptable tradeoff given that
the alternative (duplicating CC's full multi-scope config parser) would be far more
brittle and require tracking every internal parsing edge case CC handles.

### Fallback for users without CC sandbox config

If neither settings file exists or neither contains a `sandbox` block, `mcp-exec` uses
safe defaults:

- Write access: `~/.mcp-exec/sessions` only
- Read access: current working directory
- Network: `localhost` + auto-extracted MCP server hosts only

No sandbox config is required — the tool is secure out of the box.

### Security model

`srt` enforces restrictions at the OS level, inherited by all child processes. This
closes the Node.js `require('http')` bypass that language-level global patching cannot
address. All outbound HTTP/HTTPS is routed through a localhost proxy outside the sandbox;
the proxy enforces `allowedDomains` and blocks everything else.

Known limitations inherited from srt (same as CC's sandbox):

- Network filtering operates at the domain level; traffic content is not inspected.
  Allowing broad domains like `github.com` carries data exfiltration risk.
- `allowUnixSockets` can grant access to powerful system services (e.g. Docker socket).
- Linux `enableWeakerNestedSandbox` mode weakens isolation; only use when additional
  isolation is enforced at the container layer.

---

## User flow

```jsonc
// .claude/mcp.json — before mcp-exec
{ "servers": ["gmail", "gdrive", "github", "salesforce", "jira", "slack"] }

// .claude/mcp.json — after mcp-exec
{ "servers": ["mcp-exec"] }
// downstream servers declared in mcp-exec.config.json
```

Token comparison for a representative multi-tool workflow:

```
Before mcp-exec:
  schemas loaded at startup           →  40,000 tokens
  gmail.search result in context      →   8,000 tokens
  gdrive.create result in context     →   3,000 tokens
  slack.post result in context        →   1,000 tokens
  ─────────────────────────────────────────────────────
  Total                               →  52,000 tokens

After mcp-exec:
  list_tools("email search")          →     200 tokens
  run_code(full workflow)             →      50 tokens
  ─────────────────────────────────────────────────────
  Total                               →     250 tokens

Reduction: ~99.5%
```

---

## Skill file integration

`mcp-exec` ships a `skills/` directory as the agent's complete reference.

### One-command install

```sh
npx mcp-exec install-skill          # appends to ~/.claude/CLAUDE.md
npx mcp-exec install-skill --local  # appends to ./CLAUDE.md
```

Appends:

```markdown
## Important

Load the `using-mcp-exec` skill always. Better to load and not need it than to need
it and not have it.
```

### Skill directory

```
skills/
  SKILL.md               # usage guide, import syntax, patterns, error handling
  ts-sdk-reference.md    # TypeScript MCP SDK — optimized for LLM consumption
  py-sdk-reference.md    # Python MCP SDK — optimized for LLM consumption (v0.3+)
  examples/
    search-filter-aggregate.ts
    multi-service-fanout.ts
    stateful-checkpoint.ts
```

SDK reference files are pre-processed: changelogs, deprecated APIs, and verbose prose
stripped. What remains: types, method signatures, concise usage examples.

---

## Auth

Tokens are passed to shims via environment variables inherited from the host process.
The sandbox receives a filtered env — only keys matching each server's declared prefix:

```jsonc
{
  "servers": [
    { "name": "github", "url": "...", "env": ["GITHUB_TOKEN"] }
  ]
}
```

Credential-system-agnostic: `.env` files, direnv, any secrets manager.

---

## Session persistence

`run_code` calls sharing a `session_id` share a Node.js worker context. Variables,
imports, and in-memory state persist across calls within a session. Sessions are cleaned
up after a configurable idle timeout (default: 10 minutes).

```typescript
// call 1 — fetch and store
await run_code(`
  import { github } from 'mcp/github';
  globalThis.prs = await github.listPRs({ state: 'open' });
`, { session_id: "review-session" });

// call 2 — state is still there
await run_code(`
  const flagged = globalThis.prs.filter(pr => pr.labels.includes('needs-review'));
  return flagged.map(pr => pr.url);
`, { session_id: "review-session" });
```

---

## Milestones

### v0.1 — proof of concept

- `mcp-exec` MCP server in TypeScript (Node.js)
- Hardcoded support for 2–3 MCP servers (Gmail, GDrive)
- `srt` sandbox integration via `resolveSandboxConfig()` reading CC settings files
- Auto-merge of MCP server hostnames into `allowedDomains`
- Safe fallback defaults when no CC sandbox config is present
- Runtime abstraction in place; Node.js runner only
- `list_tools` + `run_code` tools; session persistence via `session_id`
- SKILL.md + `install-skill` CLI command
- Manual token count comparison vs baseline

### v0.2 — dynamic catalog + TS SDK reference

- Generic MCP client shim generator (any MCP-compliant server)
- `mcp-exec.config.json` schema with env key forwarding
- `list_tools(query)` with fuzzy search over lazily-loaded catalog
- `ts-sdk-reference.md` in skills — pre-processed TypeScript MCP SDK docs
- Structured error surfacing: exceptions → `{ error, line, column }` to Claude

### v0.3 — Python support + SDK reference

- `python.ts` runner added to runtime abstraction layer
- Python sandbox via `uv run --isolated`, wrapped by `srt`
- `py-sdk-reference.md` in skills — pre-processed Python MCP SDK docs
- Configurable resource limits (CPU, memory, timeout) per session

### v1.0 — token benchmarks + production hardening

Token savings test suite run in CI. Each test asserts `tokens_after / tokens_before
< 0.10` (≥90% reduction). CI reports per-test token delta; regressions fail the build.

| Test case | Source |
|---|---|
| Salesforce search → filter → summarize | Article primary example |
| Multi-service fan-out (email + calendar + slack) | Article |
| Stateful multi-call session | Article |
| Large result trimming (10k row dataset → 5 rows) | Gap fill |
| Error recovery and retry | Gap fill |
| Auth credential forwarding across services | Gap fill |

Additional:

- State persistence to temp dir (checkpoint files survive sandbox restart)
- Per-workflow token usage telemetry written to local log
- `lazy` schema loading as opt-in config flag for 50+ server setups

---

## Open questions resolved

| Question | Decision |
|---|---|
| Import CC config parser? | Not possible — it's in the closed-source CC binary. Not needed either: two JSON reads + array merge + schema mapping is ~30 lines and covers the relevant scope for this audience. |
| Sandbox implementation? | `@anthropic-ai/sandbox-runtime` (srt) |
| Sandbox config source? | Reads `sandbox` block from `~/.claude/settings.json` and `.claude/settings.json`; maps to `SandboxRuntimeConfig`; MCP server hosts auto-merged |
| Network allowlist maintenance? | None — auto-derived from `mcp-exec.config.json` server URLs at startup |
| Hide downstream servers? | No — schema overhead negligible vs workflow savings |
| Runtime abstraction? | Yes — Node.js in v0.1, Python added in v0.3 as second runner |
| Persistent sessions? | Yes — opt-in via `session_id`, 10-min idle cleanup |
| Auth flow? | Env vars forwarded per declared key list; credential-system-agnostic |
| Code bugs in sandbox? | Caught, returned as `{ error, line, column }`; Claude retries inline |