---
description: Your first exec() call, tool discovery with tools(), and a complete real-world workflow example.
---

# Getting Started

Before you begin, make sure mcp-exec is installed and your agent is primed. If not, see [Installation](/guide/installation).

## Prerequisites

- mcp-exec registered as an MCP server in your agent's config
- Agent instructions/skill primed (CLAUDE.md, .cursorrules, etc.)
- Node.js 20.12+ on your PATH

## Your first exec() call

The simplest thing you can do is return a value from the sandbox:

```javascript
// Ask your agent to run this
const result = await exec({
  runtime: "node",
  code: `return { message: "hello from the sandbox", ts: Date.now() }`
});
```

The agent sees only the return value — `{ message: "hello from the sandbox", ts: 1234567890 }` — not the code execution machinery around it. That's the core mechanic: anything you compute inside stays inside; only the final `return` value surfaces to context.

## Discover available tools

Before writing orchestration code, find out what tools your connected MCP servers expose:

```javascript
// Natural language — search by intent
tools("find issues assigned to me")

// Or by server name
tools("linear")
tools("github pull requests")
```

Each result comes back as a trimmed summary: name, description, and parameter signature. Full JSON schemas never load into context. Discovering 50 tools across 4 servers costs ~200 tokens instead of ~40,000.

## A real workflow: the morning standup

Here's a concrete example. You want a standup summary: open Linear issues, recent GitHub PRs, and a Slack digest — posted back to Slack when done.

**Without mcp-exec**, each tool call returns its raw payload to context:

| Step | Call | Tokens added |
| ---- | ---- | ----------- |
| 1 | `linear.searchIssues()` → 34 issue objects | ~8,400 |
| 2 | `github.listPullRequests()` → 12 PR objects | ~6,200 |
| 3 | `slack.getMessages()` → 48 messages | ~5,800 |
| 4 | `slack.postMessage()` → confirmation | ~200 |

Total context cost: ~20,600 tokens before the agent writes a word.

**With mcp-exec**, all four calls happen inside one sandbox execution:

```javascript
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

That's the 20,000 → 60 token reduction you'll see called out in the headline numbers.

## Session state in Node

The Node runtime persists state across calls within a conversation via `globalThis`:

```javascript
// First call — store something
exec({
  runtime: "node",
  code: `globalThis.cache = { fetched: [] }; return "cache initialized"`
})

// Later call — read it back
exec({
  runtime: "node",
  code: `return globalThis.cache`
})
```

Bash and Python runtimes are stateless — each call starts fresh. Use Node when you need to accumulate state across multiple sandbox calls in a workflow.

## Pass data between runtimes

`exec()` returns a standard `Promise<ExecResult>`. Thread output between runtimes by reading `stdout` explicitly:

```javascript
const jsonResult = await exec({ runtime: "node", code: `return fetchData()` });
const processed  = await exec({
  runtime: "python",
  code: `
# /// script
# dependencies = ["pandas"]
# ///
import json, pandas as pd
data = json.loads("""${jsonResult.stdout}""")
df = pd.DataFrame(data)
return df.describe().to_dict()
  `
});
```

## Next steps

- [Configure the sandbox →](/guide/configuration)
- [Reference: exec() API →](/manual/exec)
- [Reference: tools() API →](/manual/tools)
