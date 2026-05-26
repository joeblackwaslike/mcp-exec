---
description: Install mcp-exec for Claude Code, Cursor, Windsurf, GitHub Copilot, Gemini CLI, Codex CLI, or Cline.
---

# Installation

mcp-exec ships as an MCP server. Pick your agent below.

:::tabs
== Claude Code

[Claude Code MCP docs](https://docs.anthropic.com/en/docs/claude-code/mcp)

**Via the agent-marketplace (recommended):**

```sh
# Add the marketplace (one-time setup)
claude plugin marketplace add joeblackwaslike/agent-marketplace

# Install mcp-exec
claude plugin install mcp-exec
```

Then prime your CLAUDE.md so the model knows when to use it:

```sh
npx --package=@joeblackwaslike2/mcp-exec mcp-exec-prime-skill          # global (~/.claude/CLAUDE.md)
npx --package=@joeblackwaslike2/mcp-exec mcp-exec-prime-skill --local  # project-level (./CLAUDE.md)
```

> **Why prime?** Skills activate ~40% of the time from the skills directory alone. Priming adds a trigger rule to CLAUDE.md that brings reliability to ~90–95%. It's idempotent — safe to run more than once.

**Manual setup**

**1. Register the MCP server** — add to `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "mcp-exec": {
      "command": "npx",
      "args": ["@joeblackwaslike2/mcp-exec"]
    }
  }
}
```

**2. Prime your CLAUDE.md:**

```sh
npx --package=@joeblackwaslike2/mcp-exec mcp-exec-prime-skill          # global (~/.claude/CLAUDE.md)
npx --package=@joeblackwaslike2/mcp-exec mcp-exec-prime-skill --local  # project-level (./CLAUDE.md)
```

== Cursor

[Cursor MCP docs](https://docs.cursor.com/context/model-context-protocol)

**1.** Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "mcp-exec": {
      "command": "npx",
      "args": ["@joeblackwaslike2/mcp-exec"]
    }
  }
}
```

**2.** Add to `.cursorrules` (or Cursor's custom system prompt):

```text
## mcp-exec

When completing tasks that require multiple MCP tool calls or large intermediate data:
- Use tools(query) to discover available tools without loading full schemas into context
- Use exec(code, runtime) to run multi-step orchestration in a sandbox — only the final return value enters context
- Runtimes: "node" (stateful via globalThis), "bash" (stateless), "python" (stateless, supports PyPI via PEP 723)
```

== Windsurf

[Windsurf MCP docs](https://docs.windsurf.com/windsurf/cascade/mcp)

**1.** Add to `~/.codeium/windsurf/mcp_config.json` (create the file if it doesn't exist):

```json
{
  "mcpServers": {
    "mcp-exec": {
      "command": "npx",
      "args": ["@joeblackwaslike2/mcp-exec"]
    }
  }
}
```

**2.** Add to Windsurf's custom instructions (Settings → Cascade → Custom Instructions):

```text
## mcp-exec

When completing tasks that require multiple MCP tool calls or large intermediate data:
- Use tools(query) to discover available tools without loading full schemas into context
- Use exec(code, runtime) to run multi-step orchestration in a sandbox — only the final return value enters context
- Runtimes: "node" (stateful via globalThis), "bash" (stateless), "python" (stateless, supports PyPI via PEP 723)
```

Restart Windsurf after editing the config file.

== GitHub Copilot

[VS Code MCP docs](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)

> Requires VS Code 1.101+ and Copilot agent mode.

**1.** Add to `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "mcp-exec": {
      "command": "npx",
      "args": ["@joeblackwaslike2/mcp-exec"]
    }
  }
}
```

> **Gotcha:** VS Code uses `"servers"`, not `"mcpServers"`. Copy-pasting from a Cursor or Claude Code config without changing this key will silently fail to load the server.

**2.** Add to `.github/copilot-instructions.md`:

```markdown
## mcp-exec

When completing tasks that require multiple MCP tool calls or large intermediate data:
- Use tools(query) to discover available tools without loading full schemas into context
- Use exec(code, runtime) to run multi-step orchestration in a sandbox — only the final return value enters context
- Runtimes: "node" (stateful via globalThis), "bash" (stateless), "python" (stateless, supports PyPI via PEP 723)
```

== Gemini CLI

[Gemini CLI MCP docs](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md)

**1.** Add to `~/.gemini/settings.json` (global) or `.gemini/settings.json` (project):

```json
{
  "mcpServers": {
    "mcp-exec": {
      "command": "npx",
      "args": ["@joeblackwaslike2/mcp-exec"]
    }
  }
}
```

> **Gotcha:** Do not use underscores in the server name — use `mcp-exec`, not `mcp_exec`. The Gemini CLI policy parser splits on underscores and will misroute the server identity.

**2.** Add to `GEMINI.md` or `AGENTS.md` in your project root:

```markdown
## mcp-exec

When completing tasks that require multiple MCP tool calls or large intermediate data:
- Use tools(query) to discover available tools without loading full schemas into context
- Use exec(code, runtime) to run multi-step orchestration in a sandbox — only the final return value enters context
- Runtimes: "node" (stateful via globalThis), "bash" (stateless), "python" (stateless, supports PyPI via PEP 723)
```

== Codex CLI

[Codex CLI MCP docs](https://developers.openai.com/codex/mcp)

**1.** Add to `~/.codex/config.toml` (global) or `.codex/config.toml` (project):

```toml
[mcp_servers.mcp-exec]
command = "npx"
args = ["@joeblackwaslike2/mcp-exec"]
```

**2.** Add to `AGENTS.md` in your project root:

```markdown
## mcp-exec

When completing tasks that require multiple MCP tool calls or large intermediate data:
- Use tools(query) to discover available tools without loading full schemas into context
- Use exec(code, runtime) to run multi-step orchestration in a sandbox — only the final return value enters context
- Runtimes: "node" (stateful via globalThis), "bash" (stateless), "python" (stateless, supports PyPI via PEP 723)
```

== Cline

[Cline MCP docs](https://docs.cline.bot/mcp/configuring-mcp-servers)

**1.** In VS Code, open Cline's settings panel → MCP Servers tab → add a new server:

```json
{
  "mcpServers": {
    "mcp-exec": {
      "command": "npx",
      "args": ["@joeblackwaslike2/mcp-exec"]
    }
  }
}
```

**2.** In Cline's custom instructions (Settings → Custom Instructions), add:

```text
## mcp-exec

When completing tasks that require multiple MCP tool calls or large intermediate data:
- Use tools(query) to discover available tools without loading full schemas into context
- Use exec(code, runtime) to run multi-step orchestration in a sandbox — only the final return value enters context
- Runtimes: "node" (stateful via globalThis), "bash" (stateless), "python" (stateless, supports PyPI via PEP 723)
```

== OpenCode

[OpenCode](https://opencode.ai) uses a plugin system for MCP server and skill registration.

**1.** Register the MCP server — add to `opencode.json` in your project root (create it if it doesn't exist):

```json
{
  "mcpServers": {
    "mcp-exec": {
      "command": "npx",
      "args": ["@joeblackwaslike2/mcp-exec"]
    }
  },
  "plugins": [".opencode/plugins/mcp-exec.js"]
}
```

**2.** Add the plugin bootstrap file — copy `.opencode/plugins/mcp-exec.js` from the mcp-exec repo into your project:

```sh
mkdir -p .opencode/plugins
curl -sSL https://raw.githubusercontent.com/joeblackwaslike/mcp-exec/main/.opencode/plugins/mcp-exec.js \
  -o .opencode/plugins/mcp-exec.js
```

The plugin does two things automatically:

- Registers the `skills/` directory so OpenCode discovers mcp-exec skills
- Injects the `using-mcp-exec` skill bootstrap into the first user message of each session

Skills are auto-discovered — no manual skill loading needed. The `exec()` and `tools()` tools are available as soon as the session starts.

:::

## Requirements

- **Node.js** 20.12+
- **uv** (Python runtime) — `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **macOS** or **Linux** (sandbox uses `sandbox-exec`/bubblewrap; Windows is not supported)

## Next steps

- [Run your first exec() call →](/guide/getting-started)
- [Configure the sandbox →](/guide/configuration)
