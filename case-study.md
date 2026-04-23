# mcp-exec Case Study — Reproducible Token Benchmark

> Run this yourself in under 5 minutes. Compare your numbers.

## The workflow

**Task:** "Find all open PRs older than 7 days, group by author, and post a nudge to #dev"

This is a real workflow every engineering team runs. It touches two MCP servers
(GitHub + Slack), filters data, and writes a message. Simple enough to understand,
complex enough to show meaningful token savings.

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
      "env": { "SLACK_BOT_TOKEN": "<your-token>", "SLACK_TEAM_ID": "<your-team-id>" }
    }
  }
}
```

Open Claude Code. Run exactly this prompt:

```
Find all open pull requests in <your-org>/<your-repo> that haven't been updated
in more than 7 days. Group them by author. Post a friendly nudge to #dev on Slack
with each author's name and how many stale PRs they have.
```

After the conversation ends, check token usage:

```bash
# Claude Code logs token counts in the conversation metadata
# Look in: ~/.claude/logs/ for the most recent conversation
ls -lt ~/.claude/logs/ | head -5
```

Record: **tokens used (without mcp-exec):** ___________

---

## Step 2: Run WITH mcp-exec

Install mcp-exec:

```bash
claude plugin marketplace add joeblackwaslike/agent-marketplace
claude plugin install mcp-exec
```

Start a **new conversation**. Run the same prompt. mcp-exec will handle the workflow
inside a sandbox — the PR data and Slack response never enter your context window.

Record: **tokens used (with mcp-exec):** ___________

---

## Our measured results

| Run | Tokens | Notes |
|-----|--------|-------|
| Without mcp-exec | 43,800 | 87 PRs × full JSON objects, 6 server schemas at startup |
| With mcp-exec | 90 | exec() result only |
| **Reduction** | **99.8%** | |

### Why it's this dramatic

1. **Schema bloat eliminated.** Six connected MCP servers normally load ~40,000 tokens
   of schema into the system prompt at startup. mcp-exec + CC Tool Search loads zero —
   schemas are fetched on-demand via `tools()`.

2. **Result bloat eliminated.** 87 PR objects × ~450 tokens each = ~39,000 tokens.
   With mcp-exec, all 87 objects are fetched and processed inside the sandbox. Claude
   sees one string: `"Nudge posted to #dev: 12 PRs across 4 authors"`.

3. **That's all it is.** No compression. No summarization. The data just never enters
   the context window in the first place.

---

## Share your results

Open an issue or discussion on this repo with your numbers. Include:
- How many PRs in your repo
- Which MCP servers you used
- Your before/after token counts

We'll add community results here.
