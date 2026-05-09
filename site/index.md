---
layout: home

hero:
  name: "mcp-exec"
  text: "52,000 tokens → 50 tokens."
  tagline: "Intermediate data never enters the context window. The sandbox is opaque to Claude by design."
  image:
    src: /logo-light.svg
    alt: mcp-exec
  actions:
    - theme: brand
      text: Install Now
      link: /guide/installation
    - theme: alt
      text: How it works
      link: /guide/introduction

features:
  - icon: 🔍
    title: tools(query)
    details: Search connected MCP servers without loading full schemas. Tool discovery stays out of context — no more 40,000-token system prompt bloat.
    link: /manual/tools
    linkText: API reference
  - icon: ⚡
    title: exec(code, runtime)
    details: Run multi-step MCP orchestration in an OS-level sandbox. Only the final return value comes back to Claude. Intermediate data never appears in context.
    link: /manual/exec
    linkText: API reference
  - icon: 🔄
    title: Node · Bash · Python
    details: Stateful Node.js sessions via globalThis, Unix pipelines, and PyPI packages via PEP 723 — all in one tool.
    link: /manual/runtimes
    linkText: Runtime guide
---

## How it works

Most agentic workflows are wasteful by design. Claude calls a GitHub tool, loads 200 PRs into context, calls a Slack tool, loads channel history into context — by the time a simple "post a nudge" workflow finishes, you've burned tens of thousands of tokens on data Claude read once and immediately discarded.

`mcp-exec` breaks that pattern. When Claude calls `exec()`, the code runs in an OS-level sandbox. Raw API responses, filtered lists, full document bodies — all of that flows through the sandbox's working memory, not the context window. Claude sees only the final `return` value: a one-line summary, a count, a confirmation string.

This isn't a compression trick. Intermediate data never enters the context window at all. The sandbox is opaque to Claude by design. The result is a 99.8% reduction in token usage on real workflows — not an estimate, a measured benchmark.

## Quick start

```typescript
// Find stale PRs and post a Slack nudge — 43,800 tokens → 90 tokens
exec({
  runtime: "node",
  code: `
    import { listPullRequests } from 'mcp/github';
    import { postMessage } from 'mcp/slack';

    const prs = await listPullRequests({ state: 'open', per_page: 100 });
    const stale = prs.filter(pr => {
      const days = (Date.now() - new Date(pr.updated_at)) / 86400000;
      return days > 7;
    });

    await postMessage({
      channel: '#dev',
      text: \`Stale PRs: \${stale.length} across \${[...new Set(stale.map(p => p.user.login))].length} authors\`,
    });
    return \`Nudge posted — \${stale.length} stale PRs\`;
  \`
})
// → "Nudge posted — 23 stale PRs"  (tokens used: ~90)
```

## Runtimes

| Runtime | State | Best for |
| ------- | ----- | -------- |
| `"node"` | Persistent (`globalThis`) | MCP orchestration, multi-step workflows |
| `"bash"` | Stateless | Unix pipelines, `jq`, post-processing |
| `"python"` | Stateless (`uv run --isolated`) | Data analysis, pandas, PyPI packages |

## Install

```sh
# Claude Code (recommended)
claude plugin marketplace add joeblackwaslike/agent-marketplace
claude plugin install mcp-exec
```

[→ Full installation guide](/guide/installation) — includes setup for Cursor, Windsurf, GitHub Copilot, Gemini CLI, Codex CLI, and Cline.

## Reproducible benchmark

The 99.8% reduction (43,800 tokens → 90 tokens) is a reproducible benchmark on a real GitHub + Slack workflow, not a synthetic demo. [→ See the case study](/case-study).
