---
sidebar_position: 3
description: "Your first exec() call, tool discovery with tools(), threading data between runtimes, and the session model."
---

# Getting Started

Before you begin, make sure mcp-exec is installed and your agent is primed. If not, see [Installation](/docs/guide/installation).

## Prerequisites

- mcp-exec registered as an MCP server in your agent's config
- Agent instructions/skill primed (CLAUDE.md, .cursorrules, AGENTS.md, etc.)
- Node.js 20.12+ on your PATH

## Your first exec() call

The simplest thing you can do is return a value from the sandbox:

```javascript title="Ask your agent to run this"
const result = await exec({
  runtime: "node",
  code: `return { message: "hello from the sandbox", ts: Date.now() }`
});
```

The agent sees only the return value — `{ message: "hello from the sandbox", ts: 1234567890 }` — not the code execution machinery around it.

That's the core mechanic: anything you compute inside stays inside; only the final `return` value surfaces to context.

## Discover available tools

Before writing orchestration code, find out what tools your connected MCP servers expose:

```javascript title="Natural language — search by intent"
tools("find issues assigned to me")
```

```javascript title="Or search by server name"
tools("linear")
tools("github pull requests")
```

Each result comes back as a trimmed summary: name, description, and parameter signature. Full JSON schemas never load into context. Discovering 50 tools across 4 servers costs ~200 tokens instead of ~40,000.

:::tip
Use `tools()` before writing an `exec()` call when you're not sure of the exact tool name or parameter shape. It's faster and cheaper than guessing.
:::

## A real workflow: the morning standup

Here's a concrete example. You want a standup summary: open Linear issues, recent GitHub PRs, and a Slack digest — posted back to Slack when done.

**Without mcp-exec**, each tool call returns its raw payload to context:

| Step | Call | Tokens added |
|------|------|-------------|
| 1 | `linear.searchIssues()` → 34 issue objects | ~8,400 |
| 2 | `github.listPullRequests()` → 12 PR objects | ~6,200 |
| 3 | `slack.getMessages()` → 48 messages | ~5,800 |
| 4 | `slack.postMessage()` → confirmation | ~200 |

Total context cost: ~20,600 tokens before the agent writes a word.

**With mcp-exec**, all four calls happen inside one sandbox execution:

```javascript title="All four steps — one exec() call"
exec({
  runtime: "node",
  code: `
    const linear = await import("@mcp/linear");
    const github = await import("@mcp/github");
    const slack  = await import("@mcp/slack");

    const [issues, prs, messages] = await Promise.all([
      linear.searchIssues({ assignee: "me", state: "in_progress" }),
      github.listPullRequests({ state: "open", author: "me" }),
      slack.getMessages({ channel: "eng-standup", limit: 48 }),
    ]);

    const summary = [
      "**In progress:** " + issues.map(i => i.title).join(", "),
      "**Open PRs:** " + prs.map(p => p.title).join(", "),
      "**Slack digest:** " + messages.length + " messages since yesterday",
    ].join("\n");

    await slack.postMessage({ channel: "eng-standup", text: summary });
    return \`Posted standup — \${issues.length} issues, \${prs.length} PRs\`;
  `
})
```

The agent receives: `"Posted standup — 6 issues, 3 PRs"` — roughly 60 tokens. The 34 issue objects, 12 PR objects, and 48 Slack messages were computed and discarded entirely inside the sandbox.

That's the 20,000 → 60 token reduction you'll see called out in the benchmark numbers.

## Python with inline dependencies

The Python runtime uses `uv run --isolated` and supports [PEP 723](https://peps.python.org/pep-0723/) inline script dependencies. Declare packages in a `# /// script` block at the top of your code — no `requirements.txt` or virtualenv needed:

```python title="Python with inline deps (PEP 723)"
exec({
  runtime: "python",
  code: `
# /// script
# dependencies = ["pandas", "httpx"]
# ///
import httpx, pandas as pd

resp = httpx.get("https://api.example.com/data")
df = pd.DataFrame(resp.json()["rows"])
return df.describe().to_dict()
  `
})
```

:::info
`uv` resolves and installs packages in an isolated environment on each call. First run for a new dependency set takes a few seconds; subsequent runs use uv's cache.
:::

## Session state in Node

The Node runtime persists state across calls within a conversation via `globalThis`:

```javascript title="First call — initialize state"
exec({
  runtime: "node",
  code: `globalThis.cache = { fetched: [] }; return "cache initialized"`
})
```

```javascript title="Later call — read it back"
exec({
  runtime: "node",
  code: `return globalThis.cache`
})
```

Bash and Python runtimes are stateless — each call starts fresh. Use Node when you need to accumulate state across multiple sandbox calls in a workflow.

:::info Session lifecycle
Sessions are implicit by default — all `exec()` calls within a conversation share the same Node context. Sessions have a 10-minute idle timeout and a max of 100 active sessions across all conversations. For parallel isolation, pass an explicit `session_id` in the runtime config.
:::

## Thread data between runtimes

`exec()` returns a standard `Promise<ExecResult>`. Thread output between runtimes by reading `stdout` explicitly:

```javascript title="Fetch in Node, analyze in Python"
// Step 1: fetch data in Node (has MCP imports)
const jsonResult = await exec({
  runtime: "node",
  code: `
    const gh = await import("@mcp/github");
    const prs = await gh.listPullRequests({ state: "closed", limit: 100 });
    return prs;
  `
});

// Step 2: analyze in Python (has pandas)
const analysis = await exec({
  runtime: "python",
  code: `
# /// script
# dependencies = ["pandas"]
# ///
import json, pandas as pd

data = json.loads("""${jsonResult.stdout}""")
df = pd.DataFrame(data)
return df.groupby("author")["id"].count().to_dict()
  `
});
```

The `ExecResult.stdout` field carries the JSON-serialized return value from the previous call. This is the standard pattern for multi-runtime pipelines.

## Next steps

- [Configure the sandbox →](/docs/guide/configuration)
- [Reference: exec() API →](/docs/manual/exec)
- [Reference: tools() API →](/docs/manual/tools)
