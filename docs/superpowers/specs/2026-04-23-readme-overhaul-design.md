# README Overhaul Design

**Date:** 2026-04-23
**Branch:** feat/readme-overhaul
**Status:** Approved for implementation

---

## Goal

Rewrite README.md to convert visitors — engineers and vibe coders who land on the repo and immediately feel the pain mcp-exec solves. Current README explains the mechanism well but buries the hook. New README leads with the feeling, proves the claim visually, and gets someone to install in under 60 seconds.

---

## Brand & Visual Identity

### Logo mark
SVG inline in README. Filled gradient box (orange #fb923c → red #dc2626, 135° diagonal), corner radius 15, containing `›` and `_` in JetBrains Mono Bold knocked out in near-white (#fff7ed). Wordmark `mcp-exec` in JetBrains Mono ExtraBold to the right. Adapts: dark mode uses light wordmark (#f0f6fc), light mode uses dark (#1f2328).

Stored as `assets/logo.svg` (standalone file for use in other contexts).

### Tagline
> Reduce your token usage by as much as 99%.

This is the single claim. It appears directly below the mark. No raw token numbers in the hero — they have no context without the explanation that follows.

### Color palette
- Primary: `#fb923c` (orange) → `#dc2626` (red) gradient
- Dark background: `#0d1117` (GitHub dark)
- Text on dark: `#f0f6fc` (wordmark), `#8b949e` (tagline)

### Badges (in order)
`npm version` · `node ≥20.12` · `platform: macOS · Linux` · `license: MIT` · `works with Claude Code`

---

## README Structure

### 1. Hero
- SVG mark + wordmark (inline SVG, renders in GitHub markdown)
- Tagline: "Reduce your token usage by as much as 99%."
- Badges row

### 2. Anthropic article callout
Orange left-border block quote immediately after badges:

> **Implementation of** ["Code execution with MCP: building more efficient AI agents"](https://www.anthropic.com/engineering/code-execution-with-mcp) — Anthropic Engineering, Nov 2025. The canonical reference for this pattern.

### 3. Demo GIF
Full-width. No caption — it speaks for itself. Stored at `assets/demo.gif`.

**GIF structure (2 acts, target <60s total):**
- **Act 1 — The pain:** Multi-tool workflow runs. Raw tool results flood the terminal. The Claude rate limit message appears. "You've reached your usage limit. Resume in 5 hours." Hold for 2 seconds. Silence.
- **Act 2 — The fix:** New session. Same workflow, `exec()` call instead. Brief sandbox pause. One clean output line. Token count shown: `52,000 → 50`.

Produced with `vhs` (already installed). Tape script saved at `assets/demo.tape`.

### 4. CTA row
Two inline links immediately below GIF:
- `[Install →](#installation)` 
- `[How it works →](#how-it-works)`

### 5. The number
Single large callout block:
```
52,000 tokens → 50 tokens.
```
One sentence: this is architectural, not compression — intermediate data never enters the context window by design.

### 6. The pain hook — "You've been here"
Terminal block showing a realistic mid-workflow rate limit hit. The exact message engineers recognize: `"You've reached your usage limit and will be able to resume in 5 hours."` Captioned: tool calls worked, Claude ran out of room to think.

### 7. Before/After infographic (SVG)
Side-by-side flow comparison:
- Left: without mcp-exec — each tool result enters context window, running token total shown per step, context window breakdown table at bottom
- Right: with mcp-exec — exec() wraps entire workflow, intermediate results stay in sandbox, one small string returns

### 8. How it works
Two tools:
- `tools(query)` — searches connected MCP servers, returns trimmed summaries, full schemas never touch context
- `exec(code, runtime)` — runs code in sandbox, MCP servers importable as modules, only final return value surfaces

**Runtimes (v0.3):**
- `"node"` — persistent session state via `globalThis`, bundled packages (zod, lodash-es, date-fns, csv-parse, cheerio, xlsx), MCP imports via loader hooks
- `"bash"` — stateless subprocess, full Unix toolbox
- `"python"` — stateless via `uv run --isolated`, Python 3.12, PEP 723 inline dependencies, stdout as result channel, arbitrary PyPI packages declared inline

Architecture SVG diagram: Claude Code → tools()/exec() → sandbox boundary (dashed orange) → MCP servers → result (green arrow back, labeled "~50 tokens").

Runtime selector shown below diagram: three pills (Node · Bash · Python) indicating the runtime param.

### 9. Token savings chart (SVG)
Horizontal bar chart, 4 workflows, proportional bars (red = without, green = with):
- Email triage: 14,000 → 50 (99.6%)
- Cross-service report: 30,000 → 50 (99.8%)
- Large dataset (5k rows): 80,000 → 50 (99.9%)
- Schema overhead alone (6 servers): 40,000 → 0 (100%)

### 10. Scenarios
Three side-by-side code comparisons. Each has: scenario title, token savings badge, left column (without, pain bullets, token count), right column (with mcp-exec, win bullets, token count).

**Scenario 1: Overdue invoice triage** (QuickBooks + CRM + Gmail)
- Pain: 847 invoices in context, rate limit mid-task
- Fix: entire workflow in sandbox, "Draft created — 23 invoices" returns
- Savings: 27,000 → 80 tokens

**Scenario 2: Morning standup brief** (Linear + GitHub + Slack)
- Pain: 34 tickets + 12 PRs + 200 messages = 20k tokens before coffee
- Fix: three parallel fetches in sandbox, standup posted
- Savings: 20,000 → 60 tokens

**Scenario 3: Research loop** (browser/web + Google Drive)
- Pain: 3 pages fetched = 40k tokens, can't read more than 4 sources
- Fix: 10 pages in parallel in sandbox, only headings extracted and returned
- Savings: 40,000 → 55 tokens

### 11. Reproducible case study
Dark card with orange accent. Includes:
- **The workflow:** PR staleness nudge (GitHub + Slack) — step-by-step instructions anyone can replicate in 5 minutes with free MCP servers
- **Measured results:** 43,800 → 90 tokens (99.8% reduction)
- **Why:** schema bloat + result bloat both eliminated, explained in 3 bullet points
- **Download link:** `case-study.md` in repo root — full reproduction instructions, token logging commands, expected output

### 12. Skills (v0.3)
Two skills ship with the plugin, installed automatically:
- **`using-mcp-exec`** — activates when writing `exec()` or `tools()` calls. Includes `ts-sdk-reference.md` and `py-sdk-reference.md` as supporting references.
- **`dev-workflow`** — activates when building a project and about to fetch API docs, run multi-step research, or process large API responses.

Skills can be manually appended to CLAUDE.md via: `npx mcp-exec-install-skill` (global) or `npx mcp-exec-install-skill --local` (project).

### 13. Installation (Quick start)
Three steps:
```sh
# 1. Add the marketplace (one-time)
claude plugin marketplace add joeblackwaslike/agent-marketplace

# 2. Install mcp-exec
claude plugin install mcp-exec

# 3. Start using exec() in any conversation
```
Manual setup (mcp.json) as collapsed `<details>` below.

### 14. Requirements
- Node.js 20.12+ (required)
- `uv` (required for Python runtime — auto-detected, install via `curl -LsSf https://astral.sh/uv/install.sh | sh`)
- macOS or Linux
- Claude Code 2.1.7+ recommended

### 15. Reference (condensed)
`tools(query)` and `exec(params)` API reference including all three runtimes (node/bash/python). Session state (Node only — Bash and Python are stateless). Cross-runtime data threading. Error handling. Python PEP 723 inline dependency declaration. Bundled Node packages (zod, lodash-es, date-fns, csv-parse, cheerio, xlsx). Full detail in skills/.

### 16. When NOT to use mcp-exec
Keep from current README. Short, honest.

### 17. Security
Keep from current README. Reference known v0.1 limitations.

### 18. Roadmap table
Keep from current README (v0.1 ✅, v0.2 ✅, v0.3 ✅, v1.0 planned).

### 19. Plugin compatibility note
Keep from current README.

### 20. License
MIT.

---

## New Files

| File | Purpose |
|------|---------|
| `assets/logo.svg` | Standalone logo mark (dark bg version) |
| `assets/logo-light.svg` | Logo mark (light bg version) |
| `assets/demo.gif` | VHS-recorded terminal demo |
| `assets/demo.tape` | VHS tape script (source for GIF) |
| `case-study.md` | Reproducible 5-minute token benchmark |

---

## What Is NOT Changing

- `src/` — no code changes
- `skills/` — no changes
- `docs/prds/` — no changes
- Installation commands — exactly as they are today
- All existing reference content is preserved, just reordered and condensed

---

## Success Criteria

- Someone lands on the README and feels the pain in the first 10 seconds
- The 99% claim has a visible proof point within 2 scrolls
- Installation is reachable in under 60 seconds of reading
- The case study is self-contained and reproducible by anyone with GitHub + Slack MCP
