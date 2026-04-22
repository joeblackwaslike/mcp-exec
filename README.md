# mcp-exec

Claude Code plugin that keeps intermediate MCP tool call results out of your context window. Instead of calling MCP tools directly, the LLM writes short scripts that import them as code modules run inside an OS-level sandbox. Only the final output returns to the model.

## The problem

When Claude Code is connected to many MCP servers, intermediate results from tool calls pass through the context window on every round trip. For workflows touching 10+ tools this burns 50k–150k tokens per workflow — increasing cost, latency, and exhausting context faster.

```text
Baseline (6 servers, no mcp-exec):
  schemas loaded at startup        →  40,000 tokens
  gmail.search result in context   →   8,000 tokens
  gdrive.create result in context  →   3,000 tokens
  slack.post result in context     →   1,000 tokens
                                   ─────────────────
  Total                            →  52,000 tokens

mcp-exec + CC Tool Search:
  schemas loaded on-demand         →       0 tokens
  exec(full three-step workflow)   →      50 tokens
                                   ─────────────────
  Total                            →      50 tokens   (~99.9% reduction)
```

Two compounding problems drive this:

1. **Schema bloat.** CC loads every connected server's full schema into the system prompt upfront, even if only one tool gets used. 6 servers = 40k tokens before the conversation starts.
2. **Result bloat.** Every intermediate tool result (a list of 200 emails, a raw API response, a full document body) passes through the context window even when Claude only needs the final summary.

mcp-exec eliminates both. CC's built-in MCP Tool Search (v2.1.7+) handles schema bloat by loading only the tools Claude actually needs on demand. mcp-exec handles result bloat by running multi-step workflows inside a sandbox — only the final return value comes back.

## How it works

mcp-exec adds two tools to Claude Code:

- **`tools(query)`** — searches your connected MCP servers and returns trimmed summaries. Full schemas never touch the context window.
- **`exec(code, runtime)`** — runs code in an OS-level sandbox. MCP servers are importable as modules. Only the final return value (Node) or stdout (Bash) comes back.

```text
Claude Code ──► tools("search emails")  →  [{name, description, signature}, ...]
            └── exec(code, "node")      →  {result, tool_calls}
                          │
                          ▼  sandbox (srt — same sandbox CC uses for bash)
                          │
                          ├── import { searchEmails } from 'mcp/gmail'
                          │     → [200 emails]  ← stays here
                          │
                          ├── const urgent = emails.filter(...)
                          │     → [3 emails]   ← stays here
                          │
                          └── return urgent.map(e => e.subject)
                                → ["Re: Q4 deadline", ...]  ← this reaches Claude
```

The sandbox uses `@anthropic-ai/sandbox-runtime` (srt) — the same OS-level sandbox Anthropic uses internally for Claude Code's bash tool. On macOS this is `sandbox-exec` (Seatbelt); on Linux it's `bubblewrap`. All network and filesystem restrictions apply to every child process spawned inside it.

### MCP imports inside the sandbox

Node.js loader hooks (`module.register()`) intercept `import { toolName } from 'mcp/server-name'` inside sandbox code strings. The `resolve` hook maps `mcp/*` to a virtual URL; the `load` hook generates source with one named async export per tool — no files on disk. Server names match keys in `.claude/mcp.json`.

```typescript
// this import inside exec() ...
import { searchEmails, sendEmail } from 'mcp/gmail';

// ... resolves to generated source like this:
export async function searchEmails(params) {
  return globalThis.__mcpClients['gmail'].callTool('searchEmails', params);
}
export async function sendEmail(params) {
  return globalThis.__mcpClients['gmail'].callTool('sendEmail', params);
}
```

## Scenarios

### Scenario 1: Multi-step email triage

**Without mcp-exec:** Claude calls `gmail.search`, gets back 200 emails (8,000 tokens) in context, filters them, calls `gmail.getEmail` for each match (3 × 1,500 tokens), and finally calls `slack.postMessage`. Every intermediate result lives in context permanently.

**With mcp-exec:**

```typescript
exec({
  runtime: "node",
  code: `
    import { searchEmails, getEmail } from 'mcp/gmail';
    import { postMessage } from 'mcp/slack';

    // fetch 200 emails — never touches context window
    const emails = await searchEmails({ query: 'is:unread label:urgent' });

    // filter and fetch details — all in sandbox
    const urgent = emails.filter(e => e.subject.includes('ACTION'));
    const details = await Promise.all(urgent.map(e => getEmail({ id: e.id })));

    // post summary — one small result comes back
    await postMessage({
      channel: '#oncall',
      text: details.map(e => e.subject).join('\n')
    });

    return \`Posted \${details.length} urgent emails to #oncall\`;
  `
})
// result: "Posted 3 urgent emails to #oncall"
// tokens used: ~50 (one exec call)
// tokens without mcp-exec: ~14,000
```

### Scenario 2: Cross-service data aggregation

Pulling data from multiple services, aggregating, and writing a report — the kind of workflow that normally saturates context halfway through.

```typescript
exec({
  runtime: "node",
  code: `
    import { listIssues } from 'mcp/github';
    import { searchMessages } from 'mcp/slack';
    import { createDocument } from 'mcp/gdrive';

    // pull from three services simultaneously — all stays in sandbox
    const [issues, messages] = await Promise.all([
      listIssues({ repo: 'acme/backend', state: 'open', label: 'bug' }),
      searchMessages({ channel: '#backend', query: 'incident', days: 7 }),
    ]);

    // aggregate — large intermediate objects, zero context cost
    const criticalBugs = issues.filter(i => i.labels.includes('P0'));
    const recentIncidents = messages.filter(m => m.reactions?.includes('fire'));

    const report = [
      '# Backend Health Report',
      \`## Critical Bugs (\${criticalBugs.length})\`,
      criticalBugs.map(b => \`- [\${b.number}] \${b.title}\`).join('\n'),
      \`## Recent Incidents (\${recentIncidents.length})\`,
      recentIncidents.map(m => \`- \${m.text.slice(0, 100)}\`).join('\n'),
    ].join('\n\n');

    const doc = await createDocument({ title: 'Backend Health Report', content: report });
    return doc.url;
  `
})
// result: "https://docs.google.com/document/d/..."
// tokens used: ~50
// tokens without mcp-exec: ~30,000+
```

### Scenario 3: Stateful multi-step research

Session state persists across `exec()` calls in the same conversation — no re-fetching between steps.

```typescript
// Step 1 — fetch and cache a large dataset
exec({ runtime: "node", code: `
  import { listPullRequests } from 'mcp/github';
  globalThis.prs = await listPullRequests({ state: 'open', per_page: 100 });
  return globalThis.prs.length + ' PRs loaded';
`});
// → "100 PRs loaded"

// Step 2 — slice a different way without re-fetching
exec({ runtime: "node", code: `
  const stale = globalThis.prs.filter(pr => {
    const days = (Date.now() - new Date(pr.updated_at)) / 86400000;
    return days > 14;
  });
  return stale.map(pr => ({ number: pr.number, title: pr.title, days: Math.floor((Date.now() - new Date(pr.updated_at)) / 86400000) }));
`});
// → [{number: 42, title: "...", days: 21}, ...]

// Step 3 — act on the results
exec({ runtime: "node", code: `
  import { addLabel } from 'mcp/github';
  await Promise.all(
    globalThis.prs
      .filter(pr => pr.draft)
      .map(pr => addLabel({ number: pr.number, labels: ['needs-review'] }))
  );
  return 'Labels applied';
`});
```

All 100 PRs stay in the sandbox across all three calls. Context window sees only the small final returns.

### Scenario 4: Unix-style post-processing

Combine Node MCP orchestration with Bash for `jq`, `awk`, `grep` — the full Unix toolbox.

```typescript
// fetch structured data with Node
const prData = await exec({ runtime: "node", code: `
  import { listPullRequests } from 'mcp/github';
  return JSON.stringify(await listPullRequests({ state: 'open' }));
`});

// filter and reshape with jq — no JSON parsing code needed
const report = await exec({
  runtime: "bash",
  code: `
    echo '${prData.result}' \
      | jq -r '.[] | select(.draft == false) | "\(.number)\t\(.user.login)\t\(.title)"' \
      | sort -k2 \
      | column -t
  `
});
// result: formatted table of open non-draft PRs, sorted by author
```

### Scenario 5: Large dataset transformation

Process thousands of rows from an API — the kind of response that would immediately overflow context if returned directly.

```typescript
exec({
  runtime: "node",
  code: `
    import { queryRecords } from 'mcp/salesforce';

    // 5,000 deal records — would be ~80,000 tokens in context
    const deals = await queryRecords({
      object: 'Opportunity',
      fields: ['Name', 'Amount', 'StageName', 'CloseDate', 'OwnerId'],
      limit: 5000
    });

    // aggregate entirely in sandbox
    const byStage = deals.reduce((acc, d) => {
      acc[d.StageName] = (acc[d.StageName] ?? 0) + d.Amount;
      return acc;
    }, {});

    const top5 = Object.entries(byStage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([stage, total]) => ({ stage, total: '$' + (total/1e6).toFixed(1) + 'M' }));

    return top5;
  `
})
// result: [{stage: "Closed Won", total: "$12.4M"}, ...]
// tokens used: ~50 — not 80,000
```

## Requirements

- **Node.js** 20.12+ (required for `vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER`)
- **macOS** or **Linux** (sandbox uses `sandbox-exec`/bubblewrap; Windows not supported)
- **Claude Code** 2.1.7+ recommended (enables CC Tool Search for maximum token savings)

## Installation

### Via the agent-marketplace (recommended)

```sh
# Add the marketplace (one-time setup)
claude plugin marketplace add joeblackwaslike/agent-marketplace

# Install mcp-exec
claude plugin install mcp-exec
```

This registers the MCP server and installs the skills so Claude knows how to use them.

### Manual setup

Add to `.claude/mcp.json`:

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

Install the skill:

```sh
npx mcp-exec-install-skill          # appends to ~/.claude/CLAUDE.md (global)
npx mcp-exec-install-skill --local  # appends to ./CLAUDE.md (project)
```

## Skills

mcp-exec ships two Claude Code skills that activate automatically when the plugin is installed.

| Skill | Activates when... | Supporting references |
|---|---|---|
| **Using mcp-exec** | You're writing `exec()` or `tools()` calls in a conversation | `ts-sdk-reference.md`, `py-sdk-reference.md` |
| **mcp-exec Dev Workflow** | You're building a project and about to fetch API docs, run multi-step research, or process large API responses | — |

To load the skills manually (if you installed mcp-exec without the plugin system):

```sh
npx mcp-exec-install-skill          # appends to ~/.claude/CLAUDE.md (global)
npx mcp-exec-install-skill --local  # appends to .claude/CLAUDE.md (project)
```

## Sandbox configuration

mcp-exec reads the `sandbox` block from your existing Claude Code settings — no separate config file:

```text
~/.claude/settings.json    (user scope)
.claude/settings.json      (project scope, merged on top)
```

Arrays from both files are unioned. Example project config:

```json
{
  "sandbox": {
    "network": {
      "allowedDomains": [
        "gmail.googleapis.com",
        "www.googleapis.com",
        "slack.com",
        "api.github.com"
      ]
    },
    "filesystem": {
      "allowWrite": ["~/.mcp-exec/sessions", "/tmp"],
      "denyRead": ["~/.ssh", "~/.aws"]
    }
  }
}
```

If no sandbox block is found, a startup warning is emitted and all outbound network is blocked (srt's default). You must explicitly opt in to network access for each domain your MCP servers need.

## Reference

### `tools(query)`

```typescript
tools("*")                    // all tools across all connected servers
tools("search emails")        // AND match: "search" AND "emails"
tools("github pull request")  // camelCase names are split: listPullRequests → list, pull, requests
tools('"pull request"')       // exact phrase match
```

Returns `{ server, name, description, signature }[]` — trimmed summaries, no full schemas.

### `exec(params)`

```typescript
exec({
  code: string,           // code string to execute
  runtime:                // shorthand or config object
    | "node"              // Node.js vm.Context (persistent session state)
    | "bash"              // stateless subprocess
    | { type: "node" | "bash", timeout?: number, env?: Record<string, string> },
  session_id?: string     // optional explicit session ID for parallel isolation
})
// → { result: unknown, tool_calls: ToolCallRecord[] }
```

**Node runtime:** Code is wrapped in an async IIFE. Top-level `await` and `return` are valid. The return value becomes `result`.

**Bash runtime:** stdout becomes `result`. The process is stateless — no session globals.

**`tool_calls`:** Array of `{ server, tool, duration_ms, error? }` for every MCP call made inside the sandbox. Useful for observability when CC hooks cannot see inside the sandbox.

### Session state

Each conversation gets an implicit session automatically (one mcp-exec process per conversation via stdio transport). Variables on `globalThis` persist across calls.

For parallel or isolated sessions, use explicit session IDs:

```typescript
exec({ session_id: "branch-a", runtime: "node", code: `...` })
exec({ session_id: "branch-b", runtime: "node", code: `...` })
```

Sessions expire after 10 minutes of idle time. Maximum 100 concurrent sessions.

### Cross-runtime data threading

Bash cannot read Node session globals. Pass data explicitly:

```typescript
const { result } = await exec({ runtime: "node", code: `
  import { queryRecords } from 'mcp/salesforce';
  return JSON.stringify(await queryRecords({ ... }));
`});

const filtered = await exec({
  runtime: "bash",
  code: `echo '${result}' | jq '[.[] | select(.Amount > 100000) | .Name]'`
});
```

### Error handling

Errors return as structured objects, not exceptions:

```typescript
const { result } = await exec({ runtime: "node", code: `...` });

if (typeof result === 'object' && result !== null && 'error' in result) {
  const { error, line, column } = result;
  // line and column are relative to your code (preamble offset subtracted)
}
```

## When NOT to use mcp-exec

- Single-tool calls where the result is small and you want it visible in context
- When you need to display raw API output verbatim to the user
- Interactive tool calls where the user needs to confirm intermediate results

## Security

The sandbox enforces restrictions at the OS level via srt. All child processes inherit them — there is no language-level bypass.

**v0.1 known limitations** (tracked in [#3](https://github.com/joeblackwaslike/mcp-exec/issues/3)):

- Bash runtime inherits the full process environment. All host env vars (including secrets) are visible to sandbox code. Env var filtering is planned.
- Auth for downstream MCP servers works automatically via env vars present in your shell — no extra config, but all credentials are in scope for the session lifetime.

## Plugin compatibility

CC `PreToolUse`/`PostToolUse` hooks watching downstream tool names (e.g. `gmail.searchEmails`) will **not** fire when those tools are called inside `exec` — the sandbox is opaque to the CC event system.

Use `tool_calls` in the exec result for observability. Lifecycle hooks (`SessionStart`, `PostToolUse` on `exec` itself) fire normally.

## Roadmap

| Version | Status | Focus |
|---------|--------|-------|
| v0.1 | ✅ | Node + Bash runtimes, MCP shim loader hooks, `tools` + `exec`, implicit sessions |
| v0.2 | ✅ | Generic MCP shim generator (any server), lazy tool catalog, TypeScript SDK reference |
| v0.3 | ✅ | Python runtime via `uv run --isolated`, Python SDK reference, plugin polish |
| v1.0 | planned | Token benchmark CI suite, state persistence, per-workflow telemetry |

## For app developers

If you're building a TypeScript application with a conversational agent, mcp-exec is relevant in two ways:

**1. As a dev tool** — install the plugin and use `exec()` during development to keep large API responses, research results, and intermediate data out of your context window. See the [mcp-exec Dev Workflow skill](skills/dev-workflow/SKILL.md).

**2. As a design pattern** — apply the same server-side aggregation philosophy to your own agent tool layer. Instead of returning raw query results to the agent, each tool aggregates server-side and returns a single clean structured object. The agent receives a decision-ready summary in ~200 tokens instead of 15 raw rows.

```
❌ Thin: agent → search_comps() → 15 raw rows → agent reasons over them
✅ Thick: agent → research_pricing(id) → { price, confidence, evidence }
```

See [DEVELOPER.md](docs/DEVELOPER.md) for the full pattern, hook compatibility details, and `tool_calls` observability inside the sandbox.

## Development

```sh
npm install
npm run dev         # start server with tsx
npm test            # vitest
npm run typecheck   # tsc --noEmit
npm run lint        # biome check
```

Issue tracking: `bd ready` (requires beads).

## License

MIT
