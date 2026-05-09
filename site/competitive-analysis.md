---
description: How mcp-exec compares to the landscape of MCP aggregators, cloud sandboxes, and code execution APIs
---

# Competitive Analysis

**Last updated:** 2026-04-19  
**Status:** Research baseline — update as ecosystem evolves

---

## The Problem Space

When Claude Code connects to multiple MCP servers, token consumption becomes catastrophic:

| Setup | Token cost | % of 200K window |
| --- | --- | --- |
| 7 servers (GitHub, Notion, Slack, etc.) | 67,300 tokens | 33% |
| 3 servers (GitHub, Playwright, IDE) | 143,000 tokens | 72% |
| MCP_DOCKER (135 tools) + chrome-devtools | 144,802 tokens | 72% |
| 6 servers (Slack, Google Docs, Asana, etc.) | 98,700 tokens | 49% |

**Two distinct problems:**

1. **Schema bloat** — tool definitions loaded into context at startup before any user input
2. **Result bloat** — tool call outputs (Playwright snapshots: 56KB, 20 GitHub issues: 59KB) injected verbatim into conversation history after every call

The community calls this "context rot." A representative quote from `anthropics/claude-code` #3036:

> "MCP servers eat context. Connecting Github, Linear, Context7 and Playwright to Claude Code consumes over 60k tokens or 1/3rd of your context window!"

Both problems compound each other. When context fills, Claude Code's auto-compaction triggers — and then resubmits the full bloated context for summarization, sometimes triggering the loop again.

---

## The Landscape

### Category 1: Direct Prior Art — Code Execution Over MCP

These projects share mcp-exec's core thesis: write code that calls MCP tools, run it in a sandbox, return only the final result.

---

#### `elusznik/mcp-server-code-execution-mode` ★ 321

The closest existing project to mcp-exec. Implements Anthropic's "Code Execution with MCP" pattern. Exposes one `run_python` tool. Claims a reduction from ~30K to ~200 tokens.

**What it does right:** Validates the core thesis with real numbers. Two-stage lazy discovery is sound architecture.

**Limitations:**

- Python-only — no Node.js, no Bash
- No session persistence between calls
- Requires Podman or Docker — container overhead
- No Claude Code plugin distribution

**mcp-exec differentiation:** Multi-runtime (Node + Bash + Python), OS-level sandboxing via `srt` (no Docker), session persistence, Claude Code plugin distribution.

---

#### `mhingston/conduit`

Same "code execution substrate" concept. Agent writes TypeScript or Python; Conduit injects a `tools.*` SDK. Fresh sandbox per execution — no state reuse. HTTP upstream only (cannot proxy stdio MCP servers).

---

#### `zbowling/mcpcodeserver`

Connects to N child MCP servers, exposes a single `generate_and_execute_code` tool. LLM writes TypeScript that calls downstream tools. **Limitation:** No OS-level isolation — restrictions are language-level (`vm` module), not kernel-enforced.

---

#### `olaservo/code-execution-with-mcp` (Anthropic engineer demo)

Anthropic's reference implementation demonstrating 98.7% token reduction (150K → 2K tokens). The canonical blog post that inspired mcp-exec. Uses `@anthropic-ai/sandbox-runtime` — the same library mcp-exec builds on. **Limitation:** Experimental demo, not a production package.

---

### Category 2: MCP Aggregators / Proxies

These solve **schema bloat** (problem 1) but **not result bloat** (problem 2). Tool calls still return results to the model.

| Project | Stars | Schema reduction | Result suppression | Notes |
| --- | --- | --- | --- | --- |
| MCPProxy (mcpproxy-go) | ~179 | ✓ BM25 | ✗ | Desktop app, Go, Docker |
| IBM ContextForge | 3,523 | ✓ TOON format | ✗ | Enterprise K8s, not local |
| atlassian mcp-compressor | 11 | ✓ | ✗ | Complements mcp-exec |
| eznix86/mcp-gateway | 21 | ✓ BM25+regex | ✗ | TypeScript, lightweight |
| metatool-ai/metamcp | 2,205 | ✓ | ✗ | Memory leaks, subprocess bugs |

**Note on mcp-compressor:** Solves schema bloat; mcp-exec solves result bloat. They're complements, not competitors — you can use both together.

---

### Category 3: Cloud Sandbox Platforms

These provide sandboxed code execution for AI agents but are **cloud-hosted**, not MCP-native, and do not address context window management.

| Platform | Sandbox | Key limitation |
| --- | --- | --- |
| E2B | Firecracker microVMs | 24-hour session limit, cloud-only, $cost |
| Modal | Docker containers | Cloud-only, container isolation weaker than microVM |
| Daytona | Linux namespaces | Shared kernel, API churn (v0.167 in April 2026) |
| Morph Cloud | KVM + CoW snapshots | Small ecosystem, cloud-only, KVM requires Linux host |

**mcp-exec differentiation:** Local-first, zero cost, no session limits, network policy inherited from CC settings.

---

### Category 4: Code Execution APIs

Designed for competitive programming, not AI agents. Piston (★15k) and Judge0 (★14k) are stateless one-shot executors with no session state or MCP awareness. **Judge0 had critical CVEs in 2024** (CVSS 10.0, 9.1) from `--privileged` Docker flag — a security anti-pattern mcp-exec avoids entirely.

---

### Category 5: AI Orchestration Frameworks

| Framework | Result suppression | MCP-native | Isolation |
| --- | --- | --- | --- |
| LangChain | ✗ | ✗ | ✗ (host process) |
| LangGraph | Manual | ✗ | Manual |
| OpenAI Code Interpreter | ✓ | ✗ | gVisor (cloud) |
| AutoGen (Docker exec) | Partial | ✗ | Docker |

**OpenAI Code Interpreter** is the closest analog — code runs outside context, only stdout returns. **Critical limitation:** network access is blocked — it cannot call GitHub, Slack, or any external API from within the sandbox. This makes it unsuitable for MCP orchestration workflows.

---

## Positioning Map

| | MCP-native | Local-first | Result suppression | Schema lazy-load | Code sandbox | Network-enabled | Session state |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **mcp-exec** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| elusznik/code-exec-mode | ✓ | ✓ | ✓ | ✓ | Partial | ✓ | ✗ |
| MCPProxy | ✓ | ✓ | ✗ | ✓ | ✗ | — | — |
| IBM ContextForge | ✓ | ✗ | ✗ | Partial | ✗ | — | — |
| E2B | ✗ | ✗ | N/A | — | ✓ | ✓ | ✓ |
| OpenAI Code Interpreter | ✗ | ✗ | ✓ | — | ✓ | ✗ | ✓ |

**mcp-exec is the only project that checks all seven boxes.**

---

## What mcp-exec Does Uniquely

1. **Result suppression by architecture** — intermediate data never enters context because code runs in a subprocess and only the return value/stdout crosses the boundary. All existing aggregators solve schema bloat; none solve result bloat.

2. **OS-level sandboxing without Docker** — uses `@anthropic-ai/sandbox-runtime` (macOS Seatbelt + Linux bubblewrap). No container daemon, no image management, <1ms process startup vs. ~150ms Firecracker.

3. **Network-enabled sandbox with policy inheritance** — unlike OpenAI Code Interpreter (network blocked), mcp-exec inherits network policy from `~/.claude/settings.json`.

4. **MCP-native distribution** — one install command via Claude Code plugin. No mcp.json editing, no restart.

5. **Multi-runtime with session state** — Node.js (persistent `globalThis`), Bash (stateless pipelines), Python (stateless, PEP 723 dependencies). No existing project supports all three.

---

## Community Pain Points

> "A simple 'hi' message currently costs ~53k tokens before any conversation begins." — `anthropics/claude-code` #19105
>
> "Subagents fail with 'prompt is too long: 209117 tokens > 200000 maximum' before executing a single tool call." — `anthropics/claude-code` #37793
>
> "Every MCP tool call dumps raw data into your 200K context window. A Playwright snapshot costs 56 KB, 20 GitHub issues cost 59 KB."
>
> "There's no way to load only some tools from an MCP server — it's a binary feature."

mcp-exec addresses each of these at the architectural level.

---

## Archived / Lessons Learned

**`pydantic/mcp-run-python`** (archived Jan 2026) found that WASM/Pyodide is not a viable sandboxing strategy — Python in Pyodide can run arbitrary JavaScript. This directly validates mcp-exec's choice of OS-level primitives (`srt`).

**`sandbox-exec` deprecation risk:** Apple deprecated `sandbox-exec` in macOS 10.12 (2016). It works through macOS 15 but is not a supported API. Track `srt`'s deprecation mitigation plans.
