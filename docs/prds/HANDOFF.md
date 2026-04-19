# Handoff: PRD v6 → v7 Update

## What this is

Update `docs/prds/001-mcp-exec.md` from Draft v6 to v7, and create `docs/DEVELOPER.md`.
The full plan is at `/Users/joeblack/.claude/plans/i-ve-had-another-model-ethereal-hellman.md` — read it first.

The PRD version bump (Status/date) is already done. Everything else is not.

---

## Key decisions made in conversation (not fully in PRD yet)

**F1 — Sandbox config is pure pass-through**
- Remove `mcpHosts` extraction and `['localhost', '127.0.0.1']` forced additions from `resolveSandboxConfig()`
- Remove the `mcpServerUrls` parameter from the function entirely
- Replace "Fallback for users without CC sandbox config" section with: emit a startup warning + link to CC sandbox docs; SRT's own default (block all) applies; mcp-exec adds nothing
- Update resolved-questions row "Network allowlist maintenance?" to: "None — inherited verbatim from CC sandbox settings"

**F2 — MCP interface vs sandbox-injected API**
- Add a "MCP tool interface" callout box at top of Architecture with concrete JSON-RPC signatures (all primitives):
  - `tools({ query: string }) → ToolSummary[]`
  - `exec({ code: string, runtime: "node"|"bash"|"python", session_id?: string }) → { result: string, tool_calls: ToolCallRecord[] }`
- Clarify `runtime` in the MCP call is string-only; `new Node({...})` is a sandbox-injected global used inside code strings
- Add framing sentence before thenable chaining example: "mcp-exec injects an `exec` global into every sandbox environment. Code Claude writes can use `exec({...}).then({...})` to chain cross-runtime steps; `await` resolves to the final output returned as the MCP tool result."

**F3 — Session identity model**
- stdio transport: one mcp-exec process per CC conversation = one implicit session, natural isolation
- HTTP/SSE (future): one per persistent connection
- Document the full explicit session_id surface: named sessions, parallel sessions, forking pattern, checkpointing, expiry with `{ error: "session_expired", session_id }`

**F4 — Narrow "zero extra config" claim**
- Goal bullet: "Zero extra config for individual developer setups — reads the same user and project `settings.json` files Claude Code uses."
- Add note: enterprise/managed scopes (MDM, registry, plist) not read; add local sandbox block to settings.json to bridge

**F5 — Credential scoping limitation**
- Add note to Auth section: all declared env keys for all servers are in sandbox env for the session lifetime; per-invocation scoping deferred
- Add row to resolved-questions table

**F6 — Server visibility + token comparison**
- Downstream servers stay registered with CC; mcp-exec is ADDITIVE
- Update user flow diagram: show mcp-exec added alongside existing servers, not replacing them
- Replace single token table with three-scenario table:
  - Baseline: 40k schemas + 12k intermediate = 52k
  - CC Tool Search only: 0 schemas + 12k intermediate = 12k (~77%)
  - mcp-exec + Tool Search: 0 schemas + 50 result = 50 (~99.9%)
- Add "Companion feature" note: CC Tool Search (v2.1.7+, Sonnet 4+/Opus 4+) eliminates schema tokens; mcp-exec eliminates intermediate result tokens; together ~99%+; opt-out via `{ "enable_tool_search": false }`
- Update Goals bullet from "80–95%" to "~99%+ with CC Tool Search; 23–77% standalone"
- Update resolved-questions "Hide downstream servers?" row — split into two rows: CC registration (no, additive) and schema visibility to Claude (on-demand via tools())

**N1 — Prefix caching benefit (new positive callout)**
- Add to token savings section: mcp-exec + Tool Search reduces system prompt to ~100 tokens (vs 40k+), dramatically improving prefix cache stability and hit rate; intermediate results stay out of history, extending conversation length

**N2 — Plugin/hook compatibility (new section + new file)**
- Add brief section to PRD: hooks watching specific downstream tools won't fire inside exec sandbox; `tool_calls` metadata in exec result restores observability; see DEVELOPER.md
- Create `docs/DEVELOPER.md` with sections: sandbox execution model, what hooks see, `result.tool_calls` schema `[{ server, tool, args?, duration_ms, error? }]`, plugin scanning CLI (v0.2), caching implications, when not to use mcp-exec, testing guide

**G1 — Import resolution (never landed from Apr 18 session)**
- Add "Import resolution" subsection to Architecture:
  - Custom Node.js module loader hooks via `module.register()` — the importlib equivalent
  - `resolve` + `load` hooks intercept `import { github } from 'mcp/github'`
  - Resolves to virtual URL, returns dynamically generated source; no files on disk
  - Stable since Node 18.6, refined in 20.6+
  - mcp-exec spawns subprocesses with `--import` pointing to loader registration file
  - v0.1: static generated source for hardcoded servers; v0.2+: dynamic from catalog

**G2 — Session state persistence mechanism**
- Add "Session internals" note to Session persistence section:
  - Each session is a persistent Node.js vm.Context kept alive between exec calls
  - `globalThis` survives across calls (how `globalThis.prs` from call 1 is in call 2)
  - Sandbox subprocess for each call runs inside this persistent context

**G3 — exec return value schema**
- MCP tool returns: `{ result: string, tool_calls: ToolCallRecord[] }`
- `ToolCallRecord`: `{ server: string, tool: string, duration_ms: number, error?: string }`
- `result` = what Claude reads; `tool_calls` = metadata for hooks/plugins

**G4 — mcp-exec.config.json role**
- Now env var forwarding ONLY (not server declaration — servers come from CC's MCP config)
- mcp-exec reads CC's `~/.claude/mcp.json` and `.claude/mcp.json`, filters out itself, connects to the rest
- Config format: `{ "github": { "env": ["GITHUB_TOKEN"] }, "gmail": { "env": ["GMAIL_CLIENT_ID"] } }`
- Update Auth section and all config examples

**G5 — @anthropic-ai/sandbox-runtime**
- User is confident it exists; implementing agent must `npm show @anthropic-ai/sandbox-runtime` as first action
- If 404: halt and surface to user; do not proceed with fallback

**G6 — v0.1 milestone cleanup**
- Remove stale bullets: "Auto-merge of MCP server hostnames into allowedDomains" and "Safe fallback defaults"
- Replace with: `resolveSandboxConfig()` as pure pass-through; startup warning if no sandbox block found

**G7 — Naming**
- Use `exec` everywhere; remove any remaining `run({...})` in examples

**G8 — Config format for stdio servers**
- Already handled by G4; no URL needed in mcp-exec.config.json

**G9 — SKILL.md skeleton**
- Add to PRD skill file section: required content = tools() discovery, import syntax, thenable chaining patterns, session usage, error handling, when NOT to use

**G10 — CI token benchmark**
- v1.0 milestone: split into two test modes
  - mcp-exec only: assert intermediate results < 5% of baseline
  - full stack (with Tool Search): assert total < 10% of baseline

---

## Verification checklist (run after editing)

1. No `mcpServerUrls` parameter in `resolveSandboxConfig()`
2. No `mcpHosts` or `['localhost', '127.0.0.1']` in the config code block
3. MCP tool interface callout exists with all-primitive signatures
4. `exec` return type is `{ result, tool_calls }` not bare string
5. Thenable chaining example has framing sentence about sandbox-injected global
6. User flow `.claude/mcp.json` shows additive install
7. Token table has three scenarios
8. Goals bullet says ~99%+ with Tool Search footnote
9. Session section defines stdio = one process = one session
10. Auth section has credential scoping limitation note
11. `docs/DEVELOPER.md` exists with section headers
12. v0.1 milestone has no stale F1 bullets
13. resolved-questions table has no contradictions
