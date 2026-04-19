# Competitive Analysis: `mcp-exec`

**Last updated:** 2026-04-19  
**Status:** Research baseline — update as ecosystem evolves

---

## The Problem Space

When Claude Code connects to multiple MCP servers, token consumption becomes catastrophic:

| Setup | Token cost | % of 200K window |
|---|---|---|
| 7 servers (GitHub, Notion, Slack, etc.) | 67,300 tokens | 33% |
| 3 servers (GitHub, Playwright, IDE) | 143,000 tokens | 72% |
| MCP_DOCKER (135 tools) + chrome-devtools | 144,802 tokens | 72% |
| 6 servers (Slack, Google Docs, Asana, etc.) | 98,700 tokens | 49% |

**Two distinct problems:**
1. **Schema bloat** — tool definitions loaded into context at startup before any user input
2. **Result bloat** — tool call outputs (Playwright snapshots: 56KB, 20 GitHub issues: 59KB) injected verbatim into conversation history after every call

The community calls this "context rot." A representative quote from `anthropics/claude-code` #3036:

> "MCP servers eat context. Connecting Github, Linear, Context7 and Playwright to Claude Code consumes over 60k tokens or 1/3rd of your context window!"

Both problems compound each other. When context fills, Claude Code's auto-compaction triggers — and then resubmits the full bloated context for summarization, sometimes triggering the loop again (`anthropics/claude-code` #42647).

---

## The Landscape

### Category 1: Direct Prior Art — Code Execution Over MCP

These projects share mcp-exec's core thesis: write code that calls MCP tools, run it in a sandbox, return only the final result.

---

#### `elusznik/mcp-server-code-execution-mode` ★ 321

**GitHub:** https://github.com/elusznik/mcp-server-code-execution-mode  
**Status:** Active | **Language:** Python + Podman/Docker

The closest existing project to mcp-exec. Implements Anthropic's "Code Execution with MCP" pattern. Exposes one `run_python` tool. Discovery works in two stages: `discovered_servers()` lists available bridges without loading schemas; `get_server_schema(name)` loads a specific schema on demand. Claims a reduction from ~30K to ~200 tokens.

**What it does right:**
- Validates the core thesis with real numbers
- Two-stage lazy discovery is sound architecture

**Limitations:**
- Python-only — no Node.js, no Bash
- No session persistence between calls
- Requires Podman or Docker — container overhead, no OS-native primitives
- No Claude Code plugin distribution — manual install via `uvx --from git+...`
- Windows DLL load failures (Issues #5, #7)

**mcp-exec differentiation:**
- Multi-runtime: Node + Bash + Python
- OS-level sandboxing via `srt` (no Docker required, lower overhead)
- Session persistence via `vm.Context` / `globalThis`
- Claude Code plugin — one install command
- `tools(query)` as a first-class MCP tool with BM25+camelCase matching

---

#### `mhingston/conduit` ★ ~0

**npm:** `@mhingston5/conduit`  
**Status:** Published (10 npm versions) but low adoption | **Language:** TypeScript

Same "code execution substrate" concept. Agent writes TypeScript or Python; Conduit injects a `tools.*` SDK wrapping upstream MCP servers, runs in isolated sandboxes with CPU/memory/output limits. Fresh sandbox per execution (no state reuse). OAuth/PKCE auth for remote MCP servers.

**Limitations:**
- HTTP upstream only — cannot proxy stdio MCP servers
- Fresh sandbox per call — no session state at all
- Zero community adoption

---

#### `zbowling/mcpcodeserver` (npm: published, v1.0.14)

Connects to N child MCP servers, discovers all tools, exposes a single `generate_and_execute_code` tool. LLM writes TypeScript that calls downstream tools. Runs in a restricted Node.js sandbox (no `fs`, `http`, `child_process` — tool functions only).

**Limitation:** No OS-level isolation — the restriction is language-level (`vm` module with blocked globals), not enforced at the kernel/syscall level. Language-level blocks are bypassable.

---

#### `olaservo/code-execution-with-mcp` (Anthropic engineer demo)

**Blog:** https://www.anthropic.com/engineering/code-execution-with-mcp  
**Published:** November 2025

Anthropic's reference implementation demonstrating 98.7% token reduction (150K → 2K tokens) by presenting MCP servers as code APIs. The agent discovers tools by reading files on a virtual filesystem rather than receiving JSON schemas. Uses `@anthropic-ai/sandbox-runtime` — the same library mcp-exec builds on.

**Key finding from Anthropic's own benchmark:** Code execution processed 520K tokens worth of data in memory; only ~10K token summaries returned to context. This is the canonical benchmark mcp-exec should beat.

**Limitation:** Experimental demo, not a production package or distribution. Requires manual setup for every project.

---

### Category 2: MCP Aggregators / Proxies

These solve schema bloat (problem 1) but not result bloat (problem 2). They expose meta-tools like `search_tools` / `invoke_tool` instead of all schemas. Tool calls still return results to the model.

---

#### `smart-mcp-proxy/mcpproxy-go` (MCPProxy) ★ ~179

**GitHub:** https://github.com/smart-mcp-proxy/mcpproxy-go  
**Status:** Very active (v0.23.x, 132 releases) | **Language:** Go | Desktop app

BM25-based intelligent tool discovery. Exposes one `retrieve_tools(query)` meta-tool instead of all schemas. Docker isolation for stdio servers. Claims ~99% token reduction on definitions, 43% accuracy improvement. Web UI, system tray.

**Limitation:** Solves schema bloat only. Tool results still flow to context. Desktop app dependency.

---

#### `IBM/mcp-context-forge` ★ 3,523

**GitHub:** https://github.com/IBM/mcp-context-forge  
**Status:** Active, IBM-backed | **Language:** Python | **Deployment:** Docker / Kubernetes / Helm

Enterprise-grade AI gateway. Federates MCP, A2A, and REST/gRPC into a single endpoint. TOON compact format for schema compression. Multi-cluster Kubernetes support. OAuth, JWT, rate limiting, audit trails.

**Limitation:** Enterprise infrastructure play — Kubernetes, Docker Compose, OAuth server. Not a local developer tool. 892 open issues. Schema compression but no result suppression.

---

#### `atlassian-labs/mcp-compressor` ★ 11

**GitHub:** https://github.com/atlassian-labs/mcp-compressor  
**Status:** Active (Atlassian Labs, v0.6.1) | **Language:** Python + TypeScript

Transparent proxy that wraps any MCP server and replaces all its tools with exactly 2 tools: `get_tool_schema(tool_name)` and `invoke_tool(tool_name, args)`. Claims 70–97% token reduction on definitions.

**Limitation:** LLM must remember to call `get_tool_schema` before every new tool — adds a round-trip. Results still go to context.

**Complement, not competitor:** mcp-exec eliminates result tokens; mcp-compressor eliminates schema tokens. They solve different halves of the same problem.

---

#### `eznix86/mcp-gateway` ★ 21

**GitHub:** https://github.com/eznix86/mcp-gateway  
**Status:** Active | **Language:** TypeScript

Lightweight MCP gateway. Three meta-tools: `gateway.search`, `gateway.describe`, `gateway.invoke`. In-memory BM25+regex catalog. Supports stdio and HTTP upstream servers. Single npm package.

**Limitation:** No result suppression. Solo maintainer. Auth forwarding is manual.

---

#### `metatool-ai/metamcp` ★ 2,205

**GitHub:** https://github.com/metatool-ai/metamcp  
**Status:** Moderately active | **Language:** TypeScript | **Deployment:** Docker Compose

Full-stack MCP aggregator with Next.js frontend + Express backend. Per-tool enable/disable. Pre-allocates idle sessions to reduce cold-start. Namespace-based grouping.

**Known issues:** STDIO servers causing excessive memory (#272); stuck in ERROR state after restart (#263); subprocess leak race conditions (open PR #273). No result suppression.

---

#### Other notable aggregators

| Project | Stars | Notes |
|---|---|---|
| `sparfenyuk/mcp-proxy` | 2,432 | Transport bridge only (stdio ↔ SSE/HTTP), single-server, explicitly not a multi-server aggregator |
| `microsoft/mcp-gateway` | N/A | Kubernetes-native, session-aware routing. Enterprise/infra only |
| `KGT24k/mcp-tool-search` | N/A | 4 meta-tools, BM25 fuzzy search, ~85–96% schema reduction |

---

### Category 3: Cloud Sandbox Platforms

These provide sandboxed code execution for AI agents but are cloud-hosted, not MCP-native, and do not address context window management.

---

#### E2B ★ 12,000 | $21M Series A

**URL:** https://e2b.dev  
**Sandbox:** Firecracker microVMs | **Language:** TypeScript + Python SDKs

Each sandbox is an independent lightweight VM (Firecracker). Boot: ~150ms cold start. Stronger isolation than containers — guest kernel not shared with host.

**Known pain points (GitHub Issues):**
- 24-hour hard session limit even on Pro — the single most common complaint
- Timeout bugs: sessions evicted after 5 min despite 1-hour setting (fixed in v2.6.0)
- No per-domain egress controls (Vercel's fork has this; E2B doesn't)
- No credential brokering — tokens live inside VMs, exfiltrable via prompt injection (feature request #1160, 7 upvotes, open)
- Self-hosting becomes complex past ~100 concurrent sandboxes

**mcp-exec differentiation:** Local-first, zero cost, no session limits, network policy inherited from CC settings, no cloud dependency.

---

#### Modal

**URL:** https://modal.com  
**Sandbox:** Docker containers (not microVMs) | **Language:** Python SDK

Container-based sandboxes with `block_network` and `cidr_allowlist` egress control. GPU support (unique in the space). `modal.Secret` objects for credential management (somewhat better than raw env vars).

**Limitation:** Container isolation is weaker than microVMs (shared host kernel). Real-world cost: $100–$200/day for agentic workloads before aggressive auto-stop tuning. Cloud-only, no on-prem.

---

#### Daytona

**URL:** https://daytona.io  
**Sandbox:** Linux namespaces | **Boot:** <90ms (faster than Firecracker due to namespace vs. full VM)

Per-sandbox firewall rules, configurable egress. Snapshot support: capture full environment state. Custom regions and self-hosting via own runners.

**Limitation:** Shared kernel (namespace isolation, not microVM). Expensive at scale before `auto_stop_interval` tuning. Low concurrent limits on early plans (reported as "a joke" in community). API churn (v0.167 in April 2026).

---

#### Morph Cloud

**URL:** https://morph.so  
**Sandbox:** KVM VMs with CoW snapshotting ("Infinibranch")

Key differentiator: instant CoW branching — snapshot a VM state, fork into N parallel copies in <250ms, near-zero storage overhead. Unique use case: parallel agent evaluation (run 100 strategies from one checkpoint simultaneously).

**Limitation:** Small ecosystem (27 stars on examples repo). Cloud-only. KVM requires Linux host for hypervisor.

---

### Category 4: General Code Execution APIs

These are designed for competitive programming / code judging, not AI agents. Included because they are often cited in "sandboxed execution" discussions.

---

#### Piston ★ 15,000+

**Sandbox:** Isolate (Linux cgroups + namespaces + seccomp) inside Docker  
**Status:** Public API made private Feb 15, 2026 (requires auth token now)

50+ languages. Stateless one-shot execution — no session persistence, no network calls from code. **Not designed for AI agents.** Every call is isolated; no state between calls.

---

#### Judge0 ★ 14,000+

**Sandbox:** Isolate inside Docker  
**Critical CVEs (2024):**
- CVE-2024-28185 (CVSS 10.0): Symlink attack → write to arbitrary host files → root code execution outside container. Root cause: `--privileged` Docker flag in default compose config.
- CVE-2024-29021 (CVSS 9.1): SSRF → sandbox escape via `ALLOW_ENABLE_NETWORK` left open by default.

**Lesson for mcp-exec:** Never run the container / sandbox process with `--privileged`. Validate that `srt` does not have equivalent flags exposed. The `--privileged` flag was described as a "known bad practice" used for convenience — a cautionary tale.

---

### Category 5: AI Orchestration Frameworks

Not MCP-native, but set user expectations around multi-tool workflows.

---

#### LangChain ★ 95,000 / LangGraph ★ 10,000

Every tool call result appended to conversation history. `ConversationBufferWindowMemory` / `ConversationSummaryMemory` are coarse mitigations — they window or summarize the whole conversation, not selectively suppress tool results. LangGraph can avoid this with deliberate graph design, but requires the developer to build it explicitly.

**`PythonREPLTool`** executes code in the host process — no isolation. Multiple security issues filed, not resolved architecturally. The community workaround is to use E2B or Modal as external backends.

**Top complaint:** "My agent runs out of context after N steps" — consistently the most-filed issue category across LangChain and LangGraph repositories.

---

#### OpenAI Code Interpreter (Assistants API)

The closest analog to mcp-exec's core design intent. Code runs outside the model's context — only stdout/stderr (truncated) and explicitly returned values are returned to the model.

**Sandbox:** gVisor-based containers. Isolated per session. Network access **blocked** — cannot make external API calls from within Code Interpreter.

**mcp-exec differentiation:**
- Local-first vs. cloud-only
- Network-enabled (policy-controlled) vs. network-isolated
- Multi-runtime (Node + Bash + Python) vs. Python-only
- MCP-native vs. proprietary Assistants API
- No session cost ($0.03/session for Code Interpreter)
- No 10–30s container cold start

The network isolation is Code Interpreter's critical limitation for agentic workflows — it cannot call GitHub, Slack, or any external API from within the sandbox.

---

#### AutoGen ★ 40,000 (Microsoft)

**`DockerCommandLineCodeExecutor`** is the architectural analog — code runs in a Docker container, only stdout/stderr returns. This is the closest thing to mcp-exec in existing frameworks, but requires building a full multi-agent system around it.

- No MCP integration
- Docker required
- Multi-agent conversation loops still accumulate context aggressively
- v0.4 broke API compatibility with v0.2/v0.3 — significant community frustration, many projects pinned to old versions

---

### Archived / Abandoned

#### `pydantic/mcp-run-python` ★ 191 (ARCHIVED)

**Archived January 2026** — Pydantic tried WASM/Pyodide sandboxing for LLM-generated Python. Finding:

> "There's just no safe way to run Python within Pyodide safely with reasonable latency. Python code running in Pyodide can run arbitrary JavaScript, meaning it can do whatever the JavaScript runtime allows."

**Direct validation for mcp-exec:** WASM is not a viable sandboxing strategy for LLM-generated code. OS-level primitives (`srt`/`sandbox-exec`/`bubblewrap`) are the right call.

---

## Positioning Map

| | **MCP-native** | **Local-first** | **Result suppression** | **Schema lazy-load** | **Code sandbox** | **Network-enabled sandbox** | **Session state** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **mcp-exec** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| elusznik/code-exec-mode | ✓ | ✓ | ✓ | ✓ | Partial (Docker) | ✓ | ✗ |
| mhingston/conduit | ✓ | ✓ | ✓ | — | Partial | ✓ | ✗ |
| MCPProxy (mcpproxy-go) | ✓ | ✓ | ✗ | ✓ | ✗ | — | — |
| IBM ContextForge | ✓ | ✗ (K8s) | ✗ | Partial | ✗ | — | — |
| atlassian mcp-compressor | ✓ | ✓ | ✗ | ✓ | ✗ | — | — |
| E2B | ✗ | ✗ (cloud) | N/A | — | ✓ (Firecracker) | ✓ | ✓ |
| Modal | ✗ | ✗ (cloud) | N/A | — | ✓ (Docker) | ✓ | ✓ |
| OpenAI Code Interpreter | ✗ | ✗ (cloud) | ✓ | — | ✓ (gVisor) | ✗ | ✓ |
| AutoGen (Docker exec) | ✗ | ✓ (Docker) | Partial | — | ✓ (Docker) | ✓ | ✗ |
| LangChain | ✗ | ✓ | ✗ | — | ✗ (host process) | — | — |

**mcp-exec is the only project that checks all boxes.**

---

## Community Pain Points to Speak To

These are documented complaints from real users, with sources. Use as messaging anchors.

### "Tokens before hello"
> "A simple 'hi' message currently costs ~53k tokens before any conversation begins." — `anthropics/claude-code` #19105

> "I watched my context window die before I could write a single prompt — 67,000 tokens gone, just from connecting four MCP servers to Claude Code."

**mcp-exec answer:** `tools(query)` exposes all downstream MCP server tools as a single searchable index. The model loads zero schema tokens at startup. Only the two mcp-exec tool schemas (~100 tokens) enter the system prompt.

---

### Subagent failure cascade
> "Subagents fail with 'prompt is too long: 209117 tokens > 200000 maximum' before executing a single tool call... Any Claude Max user with 15+ MCP servers will hit this." — `anthropics/claude-code` #37793

**mcp-exec answer:** Subagents spawned by the main Claude Code session see only the mcp-exec schema in their tool list. All downstream server schemas stay out of the subagent's context.

---

### Tool result bloat destroys long sessions
> "Every MCP tool call dumps raw data into your 200K context window. A Playwright snapshot costs 56 KB, 20 GitHub issues cost 59 KB. After 30 minutes, 40% of your context is gone."

> "There's no PostToolUse hook in Claude Code that could modify or compress a response before it enters context." — HN commenter clarifying the architectural limitation

**mcp-exec answer:** Tool calls happen inside the sandbox subprocess. Only the final `result` string (user-controlled, IIFE return value or stdout) enters the context. The raw 56KB Playwright snapshot never leaves the sandbox.

---

### Binary server toggle — no selective tool loading
> "There's no way to load only some tools from an MCP server. It's a binary feature — you either use an MCP and thus load all tools into your MCP client's context, or you don't." — Stack Overflow, Aug 2025

**mcp-exec answer:** `tools("playwright screenshot")` returns exactly the tools matching that query. The model can discover and use subsets of any server's tool catalog without loading unrelated schemas.

---

### Cost at real scale
From fastn.ai analysis: a 5-developer DevOps team × 20 days × 10 sessions × 75,000 tokens/session = 750M tokens/month. At Claude Opus rates, that's $3,750/month in context overhead before any actual work.

**mcp-exec answer:** With `mcp-exec` + Tool Search, a 3-tool workflow consumes ~50 tokens instead of ~52,000. That 750M token overhead drops to ~750K.

---

### Compaction loop amplification
> "The current query + compaction pipeline is causing severe token inefficiency (50K–300K+ tokens per event) due to repeated full-context resubmissions." — `anthropics/claude-code` #42647

**mcp-exec answer:** mcp-exec + Tool Search keeps the system prompt to ~100 tokens and conversation history lean (only final results, not raw tool outputs). Compaction triggers later, summarizes less, and resubmits lighter context.

---

## Implementation Lessons and Pitfalls

### Security

**Don't use `--privileged` Docker.** Judge0 shipped with `--privileged` in their default compose config. CVE-2024-28185 (CVSS 10.0) followed — symlink attack allowed writing to arbitrary host files. mcp-exec avoids Docker entirely; `srt`'s Seatbelt/bubblewrap do not have an equivalent "privileged" escape hatch.

**WASM is not safe for LLM-generated code.** Pydantic found this out the hard way and archived `mcp-run-python`. Python inside Pyodide can execute arbitrary JavaScript in the Deno host. mcp-exec uses OS-level isolation instead.

**Language-level sandboxing is bypassable.** `zbowling/mcpcodeserver` restricts Node.js at the module level (`vm` with blocked globals). This is insufficient — native addons, `process.binding`, and prototype pollution have historically bypassed Node.js module restrictions. `srt`'s OS-level enforcement cannot be bypassed from within user code.

**Credential exfiltration via prompt injection.** All platforms that pass credentials as environment variables have this risk. `claude-code` CVE-2025-55284 demonstrated that project files can inject prompts that exfiltrate `.env`. mcp-exec inherits the same risk. Document it explicitly; do not claim to solve it until the per-invocation credential scoping work is done.

**`sandbox-exec` is deprecated.** Apple deprecated it in macOS 10.12 (2016). It works through macOS 15 but is not a supported API. mcp-exec's macOS sandbox depends on it via `srt`. This is the primary long-term platform risk. Track `srt`'s deprecation mitigation plans; consider documenting a fallback path to Linux/Docker if Apple removes it.

**84% of MCP server repos have security findings** (Inkog Labs, March 2026). Audit tool schema descriptions before returning them via `tools(query)` — prompt injection can be embedded in tool descriptions served by malicious or compromised MCP servers.

### Architecture

**Session state is Node-only.** Bash and Python runs are stateless subprocesses. Document this clearly. The community equivalent complaint in AutoGen was discovering that Docker exec sessions don't persist between calls — it confused users and caused silent bugs.

**Error line numbers need preamble offset.** The async IIFE wrapper adds 1 line before user code. Error `line` numbers from V8 point to the wrong line if not adjusted. `elusznik`'s project had no equivalent adjustment and bug reports mentioned confusing error positions.

**Two-stage discovery is essential.** `elusznik`'s project exposes `discovered_servers()` (lightweight list) and `get_server_schema(name)` (on-demand load). The equivalent in mcp-exec is `tools(query)` returning trimmed summaries — full schemas are never sent. This pattern is validated by multiple projects and by Anthropic's own blog post.

**Don't hardcode server hostnames for MCP config.** Early mcp-exec PRD iterations had `mcp-exec.config.json` for this. Reading `.claude/mcp.json` directly avoids a second config file users must maintain.

**Schema change → catalog regeneration.** Generated module source (the virtual `mcp/*` imports) must be regenerated when upstream server tool lists change. Cache invalidation on tool list changes, not on timer. `metatool-ai/metamcp` had a related bug where servers stuck in ERROR state after restart because the stale cache wasn't invalidated.

### Distribution

**Plugin distribution beats manual install.** Every project outside the Claude Code plugin ecosystem requires users to: install the package, edit `~/.claude/mcp.json`, restart Claude Code. The install-skill + plugin.json pattern collapses this to one command.

**Avoid Docker as a dependency for the local-first use case.** `philschmid/code-sandbox-mcp`, `elusznik`, and `alfonsograziano/node-code-sandbox-mcp` all require Docker or Podman. Multiple users report friction installing Docker on macOS for MCP tools. `srt` uses OS primitives — no daemon, no image pull, no cold start from container creation.

---

## What mcp-exec Does Uniquely

1. **Result suppression by architecture** — intermediate data never enters the context window because code runs in a subprocess and only the return value / stdout crosses the boundary. This is the unsolved half of the MCP token problem. All existing aggregators/proxies solve schema bloat; none solve result bloat.

2. **OS-level sandboxing without Docker** — same `srt` library Anthropic uses for Claude Code's own bash tool. macOS Seatbelt + Linux bubblewrap. No container daemon, no image management, <1ms process startup vs. ~150ms Firecracker or ~10ms Docker.

3. **Network-enabled sandbox with policy inheritance** — unlike OpenAI Code Interpreter (network blocked), mcp-exec sandbox inherits network policy from `~/.claude/settings.json`. Users who've already configured Claude Code's sandbox get correct mcp-exec network permissions for free.

4. **MCP-native distribution via Claude Code plugin** — one install command, no separate config files, no mcp.json editing. The plugin registers the MCP server and appends the skill loader to CLAUDE.md automatically.

5. **`tools(query)` as first-class MCP tool** — BM25 + camelCase splitting + stop-word removal. Downstream tool schemas are never sent to the model; only trimmed summaries are returned. Combined with Claude Code's built-in Tool Search, this achieves ~99.9% reduction vs. the no-optimization baseline.

6. **Multi-runtime with session state** — Node.js (persistent `vm.Context` with `globalThis` state), Bash (stateless, unix pipeline composition), Python (stateless, `uv run --isolated`). Cross-runtime data threading via `result.stdout`. No existing MCP code execution project supports all three.

---

## Appendix: Projects to Watch

| Project | Why | URL |
|---|---|---|
| Pydantic "Monty" | Replacement for mcp-run-python; OS-level sandboxing, better latency | Unreleased as of April 2026 |
| Vercel Sandbox | First to ship TLS MITM credential injection (credentials never enter VM) | https://vercel.com/docs/sandbox |
| `srt` deprecation path | Apple `sandbox-exec` risk mitigation | https://github.com/anthropic-experimental/sandbox-runtime |
| `modelcontextprotocol/modelcontextprotocol` #2211 | Proposal for `max_response_bytes` cap at the MCP protocol level | Open discussion |
| `modelcontextprotocol/modelcontextprotocol` #559 | Proposal for selective tool loading at the protocol level | Open discussion |
