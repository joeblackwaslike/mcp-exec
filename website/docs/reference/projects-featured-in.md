---
sidebar_position: 3
description: "Projects, tools, and communities where mcp-exec is used, referenced, or closely related"
---

# Projects & Ecosystem

A reference for the projects mcp-exec is built on, the related tools in the same space, and the broader ecosystem it participates in.

---

## Built On

These are the direct dependencies and foundational projects that mcp-exec is built on top of.

### `@anthropic-ai/sandbox-runtime`

The OS-level sandboxing library at the core of mcp-exec's `exec()` tool. Uses macOS Seatbelt (`sandbox-exec`) and Linux bubblewrap for kernel-enforced process isolation — no Docker daemon required, sub-millisecond startup.

mcp-exec reads the `sandbox` block from `~/.claude/settings.json` and maps it to `SandboxRuntimeConfig` to control network policy, allowed domains, and environment variable forwarding.

### Model Context Protocol SDK

mcp-exec is a standard MCP server that registers `tools` and `exec` as MCP tools over stdio transport. It connects to downstream MCP servers as a client, proxying tool calls from within the sandbox.

- [modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk)
- [MCP specification](https://modelcontextprotocol.io)

### `uv` (Python runtime)

The Python runtime uses `uv run --isolated` to execute Python code in a fresh virtual environment per invocation, with automatic package installation from PEP 723 inline dependency declarations. No pre-installed packages or environment contamination between runs.

- [astral-sh/uv](https://github.com/astral-sh/uv)

---

## Inspired By

### `olaservo/code-execution-with-mcp`

An Anthropic engineer's reference implementation demonstrating the "code execution with MCP" pattern. Showed 98.7% token reduction (150K → 2K tokens) in a controlled benchmark. Uses `@anthropic-ai/sandbox-runtime` — the same library mcp-exec is built on.

This demo is the canonical proof-of-concept that inspired mcp-exec's architecture. It is an experimental demo, not a production package; mcp-exec is the production implementation of the same pattern.

- [GitHub: olaservo/code-execution-with-mcp](https://github.com/olaservo/code-execution-with-mcp)

### Anthropic's Code Execution with MCP Blog Post

The architectural pattern — write code that calls MCP tools, run it in a sandbox, return only the final result — was introduced by Anthropic as a first-class strategy for context-efficient agent workflows. mcp-exec implements this pattern as an installable Claude Code plugin.

---

## Related Projects

These projects occupy the same problem space. See the [Competitive Analysis](/docs/reference/competitive-analysis) for a detailed comparison.

### Direct Prior Art: Code Execution Over MCP

| Project | Language | Approach | Notes |
|---|---|---|---|
| [elusznik/mcp-server-code-execution-mode](https://github.com/elusznik/mcp-server-code-execution-mode) | Python | `run_python` tool, two-stage lazy discovery | Closest existing project; Python-only, Docker required |
| [mhingston/conduit](https://github.com/mhingston/conduit) | TypeScript/Python | Code execution substrate, `tools.*` SDK injection | HTTP upstream only, no stdio MCP server support |
| [zbowling/mcpcodeserver](https://github.com/zbowling/mcpcodeserver) | TypeScript | N child MCP servers → `generate_and_execute_code` | Language-level isolation only, no OS sandbox |

### MCP Aggregators and Proxies

These tools solve schema bloat (startup token cost) but do not suppress tool call results. They are complements to mcp-exec, not replacements.

| Project | Stars | Approach |
|---|---|---|
| [MCPProxy / mcpproxy-go](https://github.com/pathintegral-institute/mcpproxy-go) | ~179 | BM25 tool search, desktop app, Go |
| [IBM ContextForge](https://github.com/IBM/context-forge) | 3,523 | TOON format schema compression, enterprise K8s |
| [atlassian/mcp-compressor](https://github.com/atlassian/mcp-compressor) | see GitHub | Schema compression — use alongside mcp-exec for both problems |
| [eznix86/mcp-gateway](https://github.com/eznix86/mcp-gateway) | 21 | BM25 + regex tool search, TypeScript, lightweight |
| [metatool-ai/metamcp](https://github.com/metatool-ai/metamcp) | 2,205 | MCP aggregator with tool filtering |

:::tip Using mcp-compressor with mcp-exec
`atlassian/mcp-compressor` reduces schema bloat at startup. mcp-exec reduces result bloat per tool call. They solve different halves of the context rot problem and can be used together.
:::

---

## Ecosystem

### Claude Code Plugin Marketplace

mcp-exec is distributed through a self-hosted plugin marketplace. The Claude Code plugin system allows MCP servers, skills, and commands to be bundled and installed with a single command.

- [joeblackwaslike/agent-marketplace](https://github.com/joeblackwaslike/agent-marketplace) — the marketplace hosting mcp-exec

Install mcp-exec from the marketplace:

```bash
claude plugin marketplace add joeblackwaslike/agent-marketplace
claude plugin install mcp-exec
```

### Official Anthropic Plugin Marketplace

The official Anthropic plugin marketplace registry:

- [anthropic/agent-marketplace](https://github.com/anthropic/agent-marketplace) — official Claude Code plugin registry

### MCP Servers

The reference MCP server implementations used in examples and benchmarks throughout this documentation:

- [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) — official reference MCP server implementations (GitHub, Slack, Filesystem, Playwright, and others)

---

## Supported Agents

mcp-exec ships agent-specific integration files for each of the following:

| Agent | Integration |
|---|---|
| [Claude Code](https://claude.ai/code) | `.claude-plugin/plugin.json`, `CLAUDE.md` skill activation |
| [Codex CLI](https://github.com/openai/codex) | `AGENTS.md`, `.codex-plugin/plugin.json` |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `GEMINI.md` with `@./skills/...` references |
| [Cursor](https://cursor.sh) | MCP server registration via `mcp.json` |
| [Windsurf](https://codeium.com/windsurf) | MCP server registration |
| [OpenCode.ai](https://opencode.ai) | `.opencode/plugins/mcp-exec.js` bootstrap injection |
| [Cline](https://github.com/cline/cline) | MCP server registration |
| [GitHub Copilot](https://github.com/features/copilot) | MCP server registration |

---

## mcp-exec in the Wild

This section is a placeholder for projects, teams, and workflows that use mcp-exec in production.

If your project integrates mcp-exec, open a pull request to add yourself here. Include:

1. Your project name and a one-line description
2. A link (GitHub, docs, or landing page)
3. How you use mcp-exec (which runtimes, which MCP servers, what workflow)

PR target: [`website/docs/reference/projects-featured-in.md`](https://github.com/joeblackwaslike/mcp-exec/edit/main/website/docs/reference/projects-featured-in.md)

---

*No entries yet. Be the first.*

---

## Acknowledgments

mcp-exec exists because Anthropic published the "code execution with MCP" architectural pattern and released `@anthropic-ai/sandbox-runtime` as open infrastructure. The benchmark numbers that motivated this project (98.7% token reduction) came from the `olaservo/code-execution-with-mcp` demo. The community pain points that confirmed the need came from the `anthropics/claude-code` GitHub issue tracker.
