# PRD: `mcp-exec` — Code Execution MCP Plugin for Claude Code

**Status:** Draft v7
**Last updated:** 2026-04-19

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

- Reduce per-workflow token consumption by ~99%+ when used with CC Tool Search
  (mcp-exec alone: ~23–77% depending on intermediate result sizes)
- Allow Claude Code to access arbitrarily many downstream tools without context bloat
- Zero changes to Claude Code itself — pure MCP configuration
- Zero extra config for individual developer setups — reads the same user and project
  `settings.json` files Claude Code uses
- Shareable, general-purpose: no vendor lock-in, no credential system assumptions

## Non-goals

- Replacing direct tool calls for simple single-tool tasks
- A hosted/cloud product (local-first, runs on the dev machine)
- Support for non-MCP tool protocols in v1

---

## Architecture

> **MCP tool interface** (JSON-RPC primitives only):
>
> - `tools({ query: string }) → ToolSummary[]`
> - `exec({ code: string, runtime: "node" | "bash" | "python", session_id?: string }) → { result: string, tool_calls: ToolCallRecord[] }`
>
> `ToolCallRecord`: `{ server: string, tool: string, duration_ms: number, error?: string }`
>
> The `runtime` parameter is a string shorthand only at the MCP layer. `new Node({...})`
> is a sandbox-injected global available inside code strings, not an MCP parameter.

### Components

**1. `mcp-exec` server** — the MCP server registered with Claude Code. Exposes two tools:

- `tools(query: string)` — searches connected MCP servers and returns matching tools.
  Pass `"*"` to return all tools. Otherwise the query is split on whitespace and each
  token is matched case-insensitively against `name` and `description` (AND logic —
  all tokens must appear). Returns trimmed summaries: `name`, `description`, one-line
  signature.
- `exec(code: string, runtime: "node" | "bash" | "python", session_id?: string)` —
  executes submitted code in the sandbox and returns `{ result, tool_calls }`. The
  `runtime` parameter accepts string shorthands only at the MCP layer.

**2. Tool catalog** — in-process index of downstream MCP server schemas, loaded lazily
per server on first `tools` call. Full schemas are never bulk-sent to the model;
only trimmed summaries are returned.

**3. Execution sandbox** — powered by `@anthropic-ai/sandbox-runtime` (`srt`), the same
sandbox Anthropic uses internally for Claude Code's bash tool. Uses OS-level primitives:
`sandbox-exec` (macOS Seatbelt) on macOS, `bubblewrap` on Linux/WSL2. All restrictions
apply to every child process spawned by agent code — not just the top-level process.

**4. Runtime abstraction layer** — each runtime is a configured object that knows how
to spawn its subprocess. Runtimes accept a string shorthand (`"node"`, `"bash"`,
`"python"`) for default config, or an instantiated object for custom settings inside
code strings:

```typescript
// string shorthand at the MCP layer — default sandbox config
exec({ runtime: "node", code: `...` })

// configured instance — used inside code strings as a sandbox-injected global
const node = new Node({ sandbox: { network: ['api.github.com'] } });
exec({ runtime: node, code: `...` })
```

```
sandbox/
  index.ts              ← interface: exec({ runtime, code }) → ExecResult
  runtimes/
    node.ts             ← Node.js subprocess runner (v0.1+)
    bash.ts             ← Bash subprocess runner (v0.1+)
    python.ts           ← Python subprocess runner (v0.3+)
```

The sandbox layer (srt) wraps whichever subprocess is spawned. Adding a runtime is a
new spawn wrapper — no changes to the sandbox or catalog layers.

### Import resolution

mcp-exec uses Node.js module loader hooks via `module.register()` to intercept
`import { github } from 'mcp/github'` inside sandbox code strings. The `resolve` hook
matches `mcp/*` specifiers; the `load` hook returns dynamically generated source that
wraps the MCP client connection mcp-exec maintains for that server. No files on disk.
Stable API since Node 18.6, refined in 20.6+.

mcp-exec spawns subprocesses with `--import` pointing to a loader registration file.
Each exported name corresponds to a tool on that server; calling it invokes the tool
via the MCP client.

- v0.1: loader returns static generated source for hardcoded servers
- v0.2+: loader dynamically generates source from the lazily-loaded tool catalog

### Thenable chaining

mcp-exec injects an `exec` global into every sandbox environment. Code that Claude
writes can use `exec({...}).then({...})` to chain cross-runtime steps; `await` resolves
to the final output, which is returned as the MCP tool result.

`exec()` returns a thenable `ExecResult`. Chained `.then()` calls pipe the previous
result's stdout into the next call's stdin. The chain is a real Promise — `await`
resolves to the final output.

```typescript
// fetch PRs with node, trim output with bash
await exec({ runtime: "node", code: `
  import { github } from 'mcp/github';
  return await github.listPRs({ state: 'open' });
`}).then({ runtime: "bash", code: "jq '[.[] | {title, url}]' | head -5" });
```

This enables the agent to compose MCP orchestration (node/python) with unix-style
post-processing (bash) in a single logical chain. Each step runs in the sandbox.

### Implicit sessions

Calls within a conversation share an implicit session by default — no `session_id`
required. The agent only needs explicit session IDs when it wants isolated parallel
sessions. Sessions are cleaned up after a configurable idle timeout (default: 10 min).

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

Enterprise or managed scopes (MDM, registry, plist delivery) are not read. If your
team enforces sandbox policy through those channels, add a local `sandbox` block to
`.claude/settings.json` or `~/.claude/settings.json` to replicate the relevant
settings for `mcp-exec`.

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

export function resolveSandboxConfig(): SandboxRuntimeConfig {
  const user = readSandboxBlock(join(homedir(), '.claude', 'settings.json'))
  const project = readSandboxBlock(join(process.cwd(), '.claude', 'settings.json'))

  return {
    network: {
      allowedDomains: mergeArrays(
        user.network?.allowedDomains,
        project.network?.allowedDomains,
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

### No sandbox config found

If neither settings file exists or neither contains a `sandbox` block, `mcp-exec` emits
a startup warning:

```
[mcp-exec] No sandbox block found in ~/.claude/settings.json or .claude/settings.json.
Network access will be blocked by default (srt's own policy). To configure sandbox
permissions, see: https://docs.anthropic.com/claude-code/sandbox
```

SRT's own default (block all outbound network) applies. mcp-exec does not add fallback
defaults — the user must opt in to network access explicitly.

### Schema drift risk

The only fragility is if Anthropic renames fields inside the `sandbox` block of
`settings.json`. This would be a breaking change to CC's own config format — unlikely
and semver-significant if it happened. The mapping function is the only code that would
need updating, and it's isolated in one file. This is an acceptable tradeoff given that
the alternative (duplicating CC's full multi-scope config parser) would be far more
brittle and require tracking every internal parsing edge case CC handles.

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

// .claude/mcp.json — after adding mcp-exec (additive — existing servers stay)
{ "servers": ["gmail", "gdrive", "github", "salesforce", "jira", "slack", "mcp-exec"] }
```

mcp-exec is additive. Downstream servers remain registered with CC and are still
callable directly. mcp-exec adds two tools (`tools`, `exec`) for multi-step workflows.

### Token comparison

Representative multi-tool workflow (gmail search → gdrive create → slack post):

```
Baseline (no mcp-exec, CC Tool Search off):
  schemas loaded at startup           →  40,000 tokens
  gmail.search result in context      →   8,000 tokens
  gdrive.create result in context     →   3,000 tokens
  slack.post result in context        →   1,000 tokens
  ─────────────────────────────────────────────────────
  Total                               →  52,000 tokens

CC Tool Search only (no mcp-exec):
  schemas loaded on-demand (3 tools)  →       0 tokens
  gmail.search result in context      →   8,000 tokens
  gdrive.create result in context     →   3,000 tokens
  slack.post result in context        →   1,000 tokens
  ─────────────────────────────────────────────────────
  Total                               →  12,000 tokens   (~77% reduction)

mcp-exec + CC Tool Search (recommended):
  schemas loaded on-demand            →       0 tokens
  exec(full workflow)                 →      50 tokens
  ─────────────────────────────────────────────────────
  Total                               →      50 tokens   (~99.9% reduction)
```

**Companion feature:** CC's built-in MCP Tool Search (v2.1.7+, Sonnet 4+ / Opus 4+)
eliminates schema loading tokens automatically by loading only the 3–5 tools Claude
actually needs on demand, rather than all schemas upfront. mcp-exec eliminates
intermediate result tokens. Used together they reduce per-workflow token cost by ~99%+.
Tool Search is on by default; disable with `{ "enable_tool_search": false }` in CC
settings if needed.

### Prefix caching benefit

mcp-exec dramatically improves CC's prefix cache hit rate. With servers registered
directly, the system prompt includes 40k+ tokens of MCP schemas — any schema change
invalidates the cache. With mcp-exec + Tool Search, the system prompt contains only
mcp-exec's 2-tool schema (~100 tokens), which almost never changes. Cache prefixes
are smaller, more stable, and cheaper per hit. Intermediate results also stay out of
conversation history, keeping per-turn context lean and extending how long a
conversation can run before hitting limits.

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

`SKILL.md` required sections: how to use `tools(query)` to discover available tools,
import syntax (`import { toolName } from 'mcp/server-name'`), thenable chaining
patterns with examples, session usage (implicit vs explicit `session_id`), error
handling (`{ error, line, column }` and retry patterns), when NOT to use mcp-exec
(simple single-tool calls).

SDK reference files are pre-processed: changelogs, deprecated APIs, and verbose prose
stripped. What remains: types, method signatures, concise usage examples.

---

## Auth

The sandbox inherits the full process environment. Any credentials already present in
the shell that starts Claude Code (via `.env` files, direnv, a secrets manager, or
direct `export`) are available to code running inside the sandbox. No configuration
required.

**Note:** All env vars present at process start are in scope for the session lifetime —
not just those belonging to a specific server. Per-invocation scoping (forwarding only
the env vars relevant to a specific import) would require static analysis of import
statements and is deferred to a future hardening pass. This is a known limitation.

---

## Session persistence

Calls within a conversation share an implicit session by default. Variables, imports,
and in-memory state persist across calls. Explicit `session_id` is only needed for
isolated parallel sessions. Sessions are cleaned up after a configurable idle timeout
(default: 10 minutes).

### Implicit session identity

- **stdio transport (common case):** CC spawns one mcp-exec process per conversation.
  One process = one implicit session. Natural per-conversation isolation, nothing to
  configure.
- **HTTP/SSE transport (future):** one implicit session per persistent client connection;
  connection lifetime ≈ conversation lifetime.

With stdio, each new CC conversation gets a fresh implicit session automatically. With
HTTP transports, use explicit `session_id` for strict isolation between branches or
parallel workflows.

### Explicit session_id

The full explicit session surface:

- **Named sessions** — `session_id: "research-phase"` creates or resumes a named session
  across calls
- **Parallel sessions** — multiple active session_ids simultaneously; independent state,
  no bleed between them
- **Forking pattern** — start a new session_id to branch from a clean slate without
  affecting the current session
- **Checkpointing** — session state persists to disk; survives sandbox restarts (v1.0)
- **Expiry** — configurable idle timeout; expired session returns
  `{ error: "session_expired", session_id }` so Claude can restart or re-hydrate

### Session internals

Each session is a persistent Node.js `vm.Context` kept alive between `exec` calls for
the session's lifetime. `globalThis` in that context survives across calls — this is how
`globalThis.prs` set in call 1 is available in call 2. The sandbox subprocess for each
call runs inside this persistent context.

```typescript
// call 1 — fetch and store
await exec({ runtime: "node", code: `
  import { github } from 'mcp/github';
  globalThis.prs = await github.listPRs({ state: 'open' });
  return globalThis.prs.length + ' PRs fetched';
`});

// call 2 — use stored state
await exec({ runtime: "node", code: `
  const flagged = globalThis.prs.filter(pr => pr.labels.includes('needs-review'));
  return flagged.map(pr => pr.url);
`});

// chained — single expression, fetch + trim
await exec({ runtime: "node", code: `
  import { github } from 'mcp/github';
  return await github.listPRs({ state: 'open' });
`}).then({ runtime: "bash", code: "jq '[.[] | select(.labels[] == \"needs-review\") | .url]'" });
```

---

## Plugin and hook compatibility

CC hooks fire on tool-use events visible to the host CC process. When downstream tools
are called inside `exec`, those calls happen within the sandbox subprocess and do not
generate CC tool-use events. Specifically:

- **Lifecycle hooks** (`SessionStart`, `pre-compact`, `PostToolUse` on `exec` itself):
  fire normally — they are tied to conversation/session events or to the `exec` tool
  call, not to downstream tool names.
- **`PreToolUse`/`PostToolUse` hooks watching downstream tool names** (e.g.
  `github.listPRs`): do NOT fire when those tools are called inside an `exec` sandbox.
  The sandbox is opaque to the host CC event system.

mcp-exec surfaces a `tool_calls` array in every exec result to restore per-tool
observability for plugins:

```typescript
// exec result shape
{ result: string, tool_calls: ToolCallRecord[] }

// ToolCallRecord
{ server: string, tool: string, duration_ms: number, error?: string }
```

Plugin authors: see [`docs/DEVELOPER.md`](../DEVELOPER.md) for compatibility guidance,
the `tool_calls` schema, and the planned plugin compatibility checker (`v0.2`).

---

## Milestones

### v0.1 — proof of concept

- `mcp-exec` MCP server in TypeScript (Node.js)
- Hardcoded support for 2–3 MCP servers (Gmail, GDrive)
- `srt` sandbox integration via `resolveSandboxConfig()` — pure pass-through of CC
  sandbox settings; startup warning emitted if no sandbox block found
- Runtime abstraction: `Node` and `Bash` runtimes; string shorthand (`"node"`, `"bash"`)
  and configured instance (`new Node({ ... })`) both supported
- `tools` + `exec` tools; implicit sessions (no `session_id` required by default)
- Thenable chaining: `exec({...}).then({...})` pipes stdout between calls
- SKILL.md + `install-skill` CLI command
- Manual token count comparison vs baseline

### v0.2 — dynamic catalog + TS SDK reference

- Generic MCP client shim generator (any MCP-compliant server)
- `tools(query)` with whitespace-split AND substring matching over lazily-loaded catalog
- `ts-sdk-reference.md` in skills — pre-processed TypeScript MCP SDK docs
- Structured error surfacing: exceptions → `{ error, line, column }` to Claude
- `npx mcp-exec check-plugins` — scans `~/.claude/settings.json` hooks, identifies
  ones watching downstream MCP tool names, prints compatibility report

### v0.3 — Python support + SDK reference

- `python.ts` runner added to runtime abstraction layer
- Python sandbox via `uv run --isolated`, wrapped by `srt`
- `py-sdk-reference.md` in skills — pre-processed Python MCP SDK docs
- Configurable resource limits (CPU, memory, timeout) per session

### v1.0 — token benchmarks + production hardening

Token savings test suite run in CI. Two test modes:

- **mcp-exec only:** assert intermediate results (bytes returned to context) are < 5%
  of the pre-mcp-exec baseline. Achievable without Tool Search.
- **Full stack (mcp-exec + Tool Search enabled):** assert total per-workflow tokens
  are < 10% of the pre-mcp-exec baseline.

CI reports per-test token delta; regressions fail the build.

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
| Sandbox config source? | Reads `sandbox` block from `~/.claude/settings.json` and `.claude/settings.json`; maps to `SandboxRuntimeConfig`. Pure pass-through — no additions. |
| Network allowlist maintenance? | None — network policy inherited verbatim from CC sandbox settings. Users who have configured CC's sandbox already have what they need. |
| Downstream servers stay registered with CC? | Yes — mcp-exec is additive. Downstream servers remain in CC's MCP config and are callable directly. |
| Schema visibility to Claude? | On-demand via `tools(query)` — full schemas are never bulk-sent; only trimmed summaries are returned. |
| Runtime abstraction? | Yes — Node.js + Bash in v0.1, Python added in v0.3. String shorthand or configured instance. |
| Persistent sessions? | Yes — implicit by default (stdio = one process = one session), explicit `session_id` for named/parallel/forked sessions. |
| `runtime` vs `language`? | `runtime` — selecting an execution environment, not a programming language. `"node"` not `"typescript"`. |
| Thenable chaining? | Yes — `exec({...}).then({...})` pipes stdout; genuinely thenable so `await` resolves to final output |
| Auth flow? | Full process env inherited by sandbox — no config required. All env vars are in scope for the session lifetime (per-invocation scoping deferred). |
| Code bugs in sandbox? | Caught, returned as `{ error, line, column }`; Claude retries inline |
| Per-invocation credential scoping? | Deferred. Full process env inherited by sandbox. All declared server env vars are in scope for the session. Documented as known limitation. |
| Import resolution mechanism? | Node.js `module.register()` loader hooks (`resolve` + `load`). Intercepts `mcp/*` specifiers, returns dynamically generated source. No files on disk. |
