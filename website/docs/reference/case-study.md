---
sidebar_position: 2
description: "Reproducible token benchmark — run this yourself in under 5 minutes and compare your numbers"
---

# Case Study: Reproducible Token Benchmark

> Run this yourself in under 5 minutes. Compare your numbers.

## The Workflow

**Task:** "Find all open PRs older than 7 days, group by author, and post a nudge to #dev"

This is a real workflow every engineering team runs. It touches two MCP servers (GitHub + Slack), filters data, and writes a message. Simple enough to understand, complex enough to show meaningful token savings.

**Requirements:**

- Claude Code 2.1.7+
- [GitHub MCP server](https://github.com/modelcontextprotocol/servers/tree/main/src/github) (free)
- [Slack MCP server](https://github.com/modelcontextprotocol/servers/tree/main/src/slack) (free, needs bot token)

---

## Step 1: Run WITHOUT mcp-exec

Add GitHub and Slack MCP servers to `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<your-token>" }
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "<your-token>",
        "SLACK_TEAM_ID": "<your-team-id>"
      }
    }
  }
}
```

Open Claude Code. Run exactly this prompt:

```text
Find all open pull requests in <your-org>/<your-repo> that haven't been updated
in more than 7 days. Group them by author. Post a friendly nudge to #dev on Slack
with each author's name and how many stale PRs they have.
```

After the conversation ends, check token usage:

```bash
# Claude Code logs token counts in the conversation metadata
ls -lt ~/.claude/logs/ | head -5
```

Record your result: **tokens used (without mcp-exec):** ___________

---

## Step 2: Run WITH mcp-exec

Install mcp-exec:

```bash
claude plugin marketplace add joeblackwaslike/agent-marketplace
claude plugin install mcp-exec
```

Start a **new conversation**. Run the same prompt. mcp-exec will handle the workflow inside a sandbox — the PR data and Slack response never enter your context window.

Record your result: **tokens used (with mcp-exec):** ___________

---

## Measured Results

| Run | Tokens | Notes |
|---|---|---|
| Without mcp-exec | 43,800 | 87 PRs × full JSON objects, 6 server schemas at startup |
| With mcp-exec | 90 | `exec()` result only |
| **Reduction** | **99.8%** | |

### Why It's This Dramatic

**Schema bloat eliminated.** Six connected MCP servers normally load ~40,000 tokens of schema into the system prompt at startup. mcp-exec + the `tools()` function loads zero — schemas are fetched on-demand and never enter the conversation context.

**Result bloat eliminated.** 87 PR objects × ~450 tokens each = ~39,000 tokens. With mcp-exec, all 87 objects are fetched and processed inside the sandbox. Claude sees one string:

```
Nudge posted to #dev: 12 PRs across 4 authors
```

**That's all it is.** No compression. No summarization. The data just never enters the context window in the first place.

:::info How the math works
- 6 server schemas × ~6,700 tokens avg = ~40,200 tokens saved at startup
- 87 PR JSON objects × ~450 tokens = ~39,150 tokens saved on results
- Total: ~79,350 tokens reduced to ~90 tokens (the final status message)
- The 90 remaining tokens are the `exec()` call overhead and the single-line result
:::

---

## Understanding the Two Token Sinks

### Sink 1: Schema bloat at startup

Every time Claude Code starts, it loads the full JSON schema of every tool from every connected MCP server into the system prompt. This happens before you type a single word.

With 6 servers, that's typically 30,000–50,000 tokens consumed before your first message. With mcp-exec, `tools()` returns trimmed one-line summaries. Full schemas are never loaded.

### Sink 2: Result bloat per tool call

Every MCP tool call injects its full response into the conversation history. This persists for the rest of the conversation. A few examples:

| Tool call | Raw response size |
|---|---|
| Playwright page snapshot | ~56 KB / ~14,000 tokens |
| `list_issues` (20 issues) | ~59 KB / ~14,750 tokens |
| `search_code` (10 results) | ~12 KB / ~3,000 tokens |
| `list_pull_requests` (87 PRs) | ~180 KB / ~45,000 tokens |

With mcp-exec, these payloads are consumed inside the sandbox subprocess. The conversation history receives only what your code explicitly returns.

---

## Share Your Results

Open an issue or discussion on [GitHub](https://github.com/joeblackwaslike/mcp-exec/issues) with your numbers. Include:

- How many PRs / records your repo returned
- Which MCP servers you used
- Your before/after token counts

Results from different repo sizes and server combinations help calibrate the benchmarks and inform documentation.
