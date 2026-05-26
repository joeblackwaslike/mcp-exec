---
sidebar_position: 4
description: "mcp-exec release history — what changed in each version"
---

# Changelog

All notable changes to mcp-exec are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## v1.0.0 — 2026-05-26

### Added

- **Token benchmark CI suite** (`npm run bench`): 7 scenarios covering Salesforce CRM, fan-out queries, stateful sessions, output trimming, error recovery, auth forwarding, and full-stack workflows — all under 5% exec / 10% full-stack token thresholds
- **Python MCP imports via HTTP bridge**: `from mcp.github import list_pull_requests` — auto-generated `mcp/` package injected into `PYTHONPATH`, dispatches through local HTTP bridge to real MCP clients
- **`mcp-exec prime [--local]`** CLI command: idempotently appends skill-activation rule to `CLAUDE.md`, raising tool invocation reliability from ~40% to 90–95%
- **`mcp-exec env` CLI**: full env allowlist management with `list`, `list --all`, `add`, `remove`, `show`, and `reset` subcommands, plus `--local` flag for project-scope vs user-scope config
- **Environment variable allowlist**: sandbox filters env vars by default; `sandbox.env.allow` in `~/.claude/settings.json` or `.claude/settings.json` controls what is forwarded. Default allowlist: `PATH`, `HOME`, `TMPDIR`, `TMP`, `TEMP`, `USER`, `USERNAME`, `LANG`, `LC_ALL`, `LC_CTYPE`, `NODE_PATH`, `SHELL`
- **Codex CLI support**: `AGENTS.md` agent instructions + `.codex-plugin/plugin.json` manifest for native Codex plugin registration
- **Gemini CLI support**: `GEMINI.md` with `@./skills/...` file references for automatic skill loading
- **OpenCode.ai support**: `.opencode/plugins/mcp-exec.js` bootstrap injection, skills auto-discovered, `SKILL.md` injected on first message
- **Full documentation site**: Guide, User Manual, Developer, and Reference sections covering installation, configuration, runtimes, CLI, security, and case studies
- **Skills rewritten to best-practices standard**: `using-mcp-exec` (when/why to use the sandbox) and `mcp-exec-dev-workflow` (API exploration and data-processing workflows for active development)
- **`agents/openai.yaml` metadata** per skill for Codex UI skill picker integration
- Competitive analysis and reproducible case study in docs

### Changed

- `install-skill` command renamed to `prime-skill` / `mcp-exec prime` — clearer intent, avoids collision with Claude Code's own install terminology
- Python runtime now supports MCP tool imports via HTTP bridge (previously limited to data-processing with third-party packages only)

---

## v0.3.0 — 2026-04-30

### Added

- **Python runtime** via `uv run --isolated`: stateless subprocess execution, PEP 723 inline dependency declarations (`# /// script` blocks), automatic package installation per invocation
- **`py-sdk-reference.md`** skill: reference guide for Python execution patterns, PEP 723 syntax, and data handoff between Node and Python runtimes
- **Explicit `session_id` parameter**: pass a named session ID to `exec()` to isolate state across parallel workflows; omit for implicit conversation-scoped sessions

---

## v0.2.0 — 2026-04-25

### Added

- **Generic MCP shim generator**: replaces hardcoded Gmail/GDrive shims; shims are now generated at runtime from the live tool catalog for any connected MCP server
- **`tools(query)` with lazy-loaded catalog**: full tool schemas are never loaded into context; `tools()` returns trimmed summaries only; substring AND semantic search supported
- **Unavailable server tracking**: servers that fail to connect are tracked with a reason string and surfaced in `tools()` output with `status: "unavailable"`
- **`ts-sdk-reference.md`** skill: reference guide for TypeScript/Node execution patterns, session management, and MCP tool call patterns

---

## v0.1.0 — 2026-04-19

### Added

- **Node.js runtime** with persistent `vm.Context` sessions: state (variables, imports, functions) persists across `exec()` calls within the same session via `globalThis`
- **Bash runtime**: stateless subprocess execution; each call is isolated
- **`exec(code, runtime)` tool**: only the return value or stdout enters the LLM context — intermediate MCP tool results, large fetched payloads, and loop state stay in the sandbox
- **Hardcoded Gmail/GDrive shims**: initial demo of MCP tool proxying via `import { listMessages } from 'mcp/gmail'`
- **`mcp-exec` MCP server** (stdio transport): registers `tools` and `exec` tools with Claude Code via standard MCP protocol
- **`.claude-plugin/plugin.json`** manifest: Claude Code plugin descriptor for one-command install
- **`install-skill` command**: appends skill-loader rule to `CLAUDE.md` for automatic skill activation
- **Implicit sessions** (conversation-scoped) + explicit `session_id` for parallel isolation
- **Sandbox config**: reads `sandbox` block from `~/.claude/settings.json` and `.claude/settings.json`; array fields merged; maps to internal `SandboxRuntimeConfig`

---

[v1.0.0]: https://github.com/joeblackwaslike/mcp-exec/compare/v0.3.0...v1.0.0
[v0.3.0]: https://github.com/joeblackwaslike/mcp-exec/compare/v0.2.0...v0.3.0
[v0.2.0]: https://github.com/joeblackwaslike/mcp-exec/compare/v0.1.0...v0.2.0
[v0.1.0]: https://github.com/joeblackwaslike/mcp-exec/releases/tag/v0.1.0
