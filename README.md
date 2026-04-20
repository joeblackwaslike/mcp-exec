# mcp-exec

Claude Code plugin that keeps intermediate MCP tool call results out of your context window. Instead of calling MCP tools directly, you write short scripts that import them as code modules and run inside an OS-level sandbox. Only the final output returns to the model.

## The problem

When Claude Code is connected to many MCP servers, intermediate results from tool calls pass through the context window. For workflows touching 10+ tools, this burns 50k–150k tokens per workflow — increasing cost, latency, and exhausting context faster.

```
Baseline (6 servers, no mcp-exec):
  schemas loaded at startup        →  40,000 tokens
  gmail.search result in context   →   8,000 tokens
  gdrive.create result in context  →   3,000 tokens
  slack.post result in context     →   1,000 tokens
                                   ─────────────────
  Total                            →  52,000 tokens

mcp-exec + CC Tool Search:
  schemas loaded on-demand         →       0 tokens
  exec(full workflow)              →      50 tokens
                                   ─────────────────
  Total                            →      50 tokens   (~99.9% reduction)
```

## How it works

mcp-exec exposes two tools to Claude Code:

- **`tools(query)`** — searches your connected MCP servers and returns trimmed summaries. Full schemas never touch the context window.
- **`exec(code, runtime)`** — runs code in an OS-level sandbox. MCP servers are importable as modules inside the sandbox. Only the return value (Node) or stdout (Bash) comes back.

```
Claude Code ──► mcp-exec
                  ├── tools("search emails")  →  [{name, description, signature}, ...]
                  └── exec(code, "node")      →  {result, tool_calls}
                            │
                            ▼
                      sandbox (srt)
                            │
                            ├── import { searchEmails } from 'mcp/gmail'
                            ├── import { createDocument } from 'mcp/gdrive'
                            └── ... intermediate results stay here
```

## Requirements

- **Node.js** 20.12+ (required for `vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER`)
- **macOS** or **Linux** (sandbox uses `sandbox-exec`/bubblewrap; Windows not supported)
- **Claude Code** 2.1.7+ recommended (enables CC Tool Search for maximum savings)

## Installation

### As a Claude Code plugin

```sh
npx claude install-plugin mcp-exec
```

This registers the `mcp-exec` MCP server and installs the skill.

### Manual setup

Add to your `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "mcp-exec": {
      "command": "npx",
      "args": ["mcp-exec"]
    }
  }
}
```

Then install the skill so Claude knows how to use it:

```sh
npx mcp-exec-install-skill          # appends to ~/.claude/CLAUDE.md (global)
npx mcp-exec-install-skill --local  # appends to ./CLAUDE.md (project)
```

## Sandbox configuration

mcp-exec reads the `sandbox` block from your existing Claude Code settings files — no separate config:

```
~/.claude/settings.json    (user scope)
.claude/settings.json      (project scope)
```

Arrays from both files are merged (union, no duplicates). Example:

```json
{
  "sandbox": {
    "network": {
      "allowedDomains": ["gmail.googleapis.com", "www.googleapis.com"]
    },
    "filesystem": {
      "allowWrite": ["~/.mcp-exec/sessions", "/tmp"],
      "denyRead": ["~/.ssh", "~/.aws"]
    }
  }
}
```

If no sandbox block is found, a startup warning is emitted and srt's default policy applies (all outbound network blocked). You must explicitly opt in to network access.

> **Enterprise/managed settings** (MDM, registry, plist delivery) are not read. Add a local `sandbox` block to replicate any managed policies for mcp-exec.

## Usage

### Discovering tools

```typescript
// List all available tools
tools("*")

// Search for specific tools
tools("search emails")
tools("github pull request")
tools("drive create document")
```

Returns: `{ server, name, description, signature }[]` — trimmed summaries only.

### Executing code (Node.js)

```typescript
exec({
  runtime: "node",
  code: `
    import { searchEmails } from 'mcp/gmail';
    import { createDocument } from 'mcp/gdrive';

    const emails = await searchEmails({ query: 'from:boss subject:Q4' });
    const summary = emails.map(e => e.subject).join('\n');

    const doc = await createDocument({
      title: 'Q4 Email Summary',
      content: summary
    });

    return doc.url;
  `
})
```

The return value becomes `result`. Top-level `await` and `return` are valid.

### Executing code (Bash)

```typescript
exec({
  runtime: "bash",
  code: "curl -s https://api.example.com/data | jq '.items | length'"
})
```

stdout becomes `result`.

### Per-call options

```typescript
exec({
  runtime: { type: "node", timeout: 30000, env: { GITHUB_TOKEN: "..." } },
  code: `...`
})
```

Sandbox policy is global (from settings.json) — only `timeout` and `env` are configurable per call.

## Session state

Variables stored on `globalThis` persist across `exec()` calls in the same conversation. No `session_id` is needed — Claude Code spawns one mcp-exec process per conversation (stdio transport), giving natural per-conversation isolation.

```typescript
// Call 1 — fetch and store
exec({ runtime: "node", code: `
  import { searchEmails } from 'mcp/gmail';
  globalThis.emails = await searchEmails({ query: 'is:unread' });
  return globalThis.emails.length + ' emails fetched';
`});

// Call 2 — use stored state (same session, no re-fetch)
exec({ runtime: "node", code: `
  const urgent = globalThis.emails.filter(e => e.subject.includes('URGENT'));
  return urgent.map(e => e.subject);
`});
```

For parallel isolation, pass an explicit `session_id`:

```typescript
exec({ runtime: "node", session_id: "research-branch", code: `...` })
```

Sessions expire after 10 minutes of idle time.

## Cross-runtime data threading

Bash is stateless — it cannot read Node session globals. Thread data explicitly via `result.stdout`:

```typescript
const nodeResult = await exec({ runtime: "node", code: `
  import { listPullRequests } from 'mcp/github';
  return JSON.stringify(await listPullRequests({ state: 'open' }));
`});

const filtered = await exec({
  runtime: "bash",
  code: `echo '${nodeResult.result}' | jq '[.[] | select(.draft == false) | .url]'`
});
```

## Error handling

Runtime errors are returned as structured objects rather than thrown:

```typescript
const result = await exec({ runtime: "node", code: `...` });

if (typeof result.result === 'object' && 'error' in result.result) {
  const { error, line, column } = result.result;
  // line/column are relative to your code (preamble offset already subtracted)
  // retry with fixed code...
}
```

## When NOT to use mcp-exec

- Simple single-tool calls where the result is small and you want it in context
- When you need to display raw API output verbatim

## Security model

The execution sandbox is powered by `@anthropic-ai/sandbox-runtime` (srt) — the same sandbox Anthropic uses internally for Claude Code's bash tool. Restrictions are enforced at the OS level:

- **macOS**: `sandbox-exec` (Seatbelt)
- **Linux/WSL2**: `bubblewrap`

All child processes spawned inside the sandbox inherit these restrictions. OS-level enforcement closes bypasses that language-level global patching cannot address.

**Known limitations (inherited from srt, same as CC's sandbox):**

- Network filtering is domain-level; traffic content is not inspected. Broad domains like `github.com` carry data exfiltration risk.
- `allowUnixSockets` can grant access to powerful system services (e.g. Docker socket).
- Linux `enableWeakerNestedSandbox` weakens isolation; only use with container-level isolation.

**v0.1 environment limitations (tracked in [#3](https://github.com/joeblackwaslike/mcp-exec/issues/3)):**

- Bash runtime inherits the full process environment. All host env vars (including secrets) are readable by sandbox code. Env var filtering is planned for a future release.
- Auth for downstream MCP servers works via env vars already present in your shell — no extra config required, but all declared credentials are in scope for the session lifetime.

## Plugin and hook compatibility

CC hooks fire on tool-use events visible to the host process. Downstream tool calls inside `exec` happen within the sandbox and do not generate CC `PreToolUse`/`PostToolUse` events.

mcp-exec surfaces a `tool_calls` array in every exec result to restore observability:

```typescript
// exec result shape
{
  result: string,
  tool_calls: [
    { server: "gmail", tool: "searchEmails", duration_ms: 340 },
    { server: "gdrive", tool: "createDocument", duration_ms: 210 }
  ]
}
```

Lifecycle hooks (`SessionStart`, `PostToolUse` on the `exec` tool itself) fire normally.

## Roadmap

| Version | Focus |
|---------|-------|
| **v0.1** | Node + Bash runtimes, hardcoded Gmail/GDrive shims, `tools` + `exec`, implicit sessions ✅ |
| **v0.2** | Generic MCP shim generator (any server), lazy tool catalog, TypeScript SDK reference |
| **v0.3** | Python runtime via `uv run --isolated`, Python SDK reference |
| **v1.0** | Token benchmark CI suite, state persistence, per-workflow telemetry |

## Development

```sh
npm install
npm run dev         # start server with tsx
npm test            # vitest
npm run typecheck   # tsc --noEmit
npm run lint        # biome check
```

The project uses [beads](https://github.com/joeblackwaslike/beads) for issue tracking. Run `bd ready` to see available work.

## License

MIT
