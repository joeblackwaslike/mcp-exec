---
sidebar_position: 5
description: "How to install and configure the mcp-exec plugin for Claude Code, Codex CLI, OpenCode, and Gemini CLI — including sandbox configuration and skill wiring for each agent."
---

# Agent Plugin Setup

mcp-exec ships plugin manifests for every supported AI agent. Each manifest registers the MCP server, wires skills, and sets the correct `MCP_EXEC_RUNTIME` env var so the server selects the right sandbox path at startup.

## How Detection Works

mcp-exec reads the `MCP_EXEC_RUNTIME` environment variable at startup to select a sandbox strategy:

| Value | Sandbox | Config source |
| --- | --- | --- |
| *(absent)* | SRT (`@anthropic-ai/sandbox-runtime`) | `~/.claude/settings.json` + `.claude/settings.json` |
| `opencode` | SRT | `~/.srt-settings.json` + `.srt-settings.json` |
| `codex` | Codex native (Seatbelt / bwrap) | `~/.codex/config.toml` (diagnostics only) |

Each plugin manifest sets this env var automatically. You do not need to set it manually.

---

## Claude Code

**Plugin manifest:** `.claude-plugin/plugin.json`

### Install

```sh
claude plugin install joeblackwaslike/mcp-exec
```

Or manually add to your Claude Code MCP config:

```json title=".claude/mcp.json"
{
  "mcpServers": {
    "mcp-exec": {
      "command": "npx",
      "args": ["@joeblackwaslike2/mcp-exec"]
    }
  }
}
```

### Skills

Claude Code discovers skills from the plugin's `skills/` directory automatically. To also prime the activation rule into your `CLAUDE.md` (recommended — increases skill trigger reliability from ~60% to ~95%):

```sh
mcp-exec-prime-skill
```

This appends a one-time activation rule to your project's `CLAUDE.md`. Run it once per project.

### Sandbox configuration

`MCP_EXEC_RUNTIME` is not set — mcp-exec uses SRT and reads from `~/.claude/settings.json`.

Add a `sandbox` block to configure network and filesystem access:

```json title="~/.claude/settings.json"
{
  "sandbox": {
    "network": {
      "allowedDomains": ["api.github.com", "*.googleapis.com"]
    },
    "filesystem": {
      "allowWrite": ["~/.mcp-exec/sessions", "/tmp", "./output"],
      "denyRead": ["~/.ssh", "~/.aws"]
    },
    "env": {
      "allow": ["PATH", "HOME", "TMPDIR", "USER", "GITHUB_TOKEN"]
    }
  }
}
```

Project-scope overrides go in `.claude/settings.json` at the project root. Array fields are merged (union + dedup) across user and project configs.

---

## OpenCode

**Plugin file:** `.opencode/plugins/mcp-exec.js`

### Install

Copy or symlink the plugin file into your OpenCode plugins directory:

```sh
cp .opencode/plugins/mcp-exec.js ~/.opencode/plugins/mcp-exec.js
```

Or reference the project-local plugin in your OpenCode config.

### What the plugin does

The plugin hooks three things:

1. **Skills** — pushes the `skills/` directory to `config.skills.paths` so OpenCode auto-discovers `using-mcp-exec` and `mcp-exec-dev-workflow`
2. **MCP server** — registers `mcp-exec` in `config.mcp.servers` with `MCP_EXEC_RUNTIME=opencode`
3. **Bootstrap injection** — prepends the `using-mcp-exec` skill content to the first user message of each conversation so the model knows the tools are available without waiting for a skill trigger

### Sandbox configuration

OpenCode does not provide a native OS sandbox. mcp-exec uses SRT and reads from `~/.srt-settings.json`.

Create this file with your sandbox policy:

```json title="~/.srt-settings.json"
{
  "network": {
    "allowedDomains": ["api.github.com", "*.googleapis.com"]
  },
  "filesystem": {
    "allowWrite": ["~/.mcp-exec/sessions", "/tmp"],
    "denyRead": ["~/.ssh", "~/.aws"]
  },
  "env": {
    "allow": ["PATH", "HOME", "TMPDIR", "USER", "GITHUB_TOKEN"]
  }
}
```

For project-specific overrides, create `.srt-settings.json` in the project root. The format is identical — arrays are merged across user and project files.

The `~/.mcp-exec/sessions` path is always added to `allowWrite` even if absent from your config.

---

## Codex CLI

**Plugin manifest:** `.codex-plugin/plugin.json`

### Install

Add mcp-exec to your Codex config:

```toml title="~/.codex/config.toml"
[mcp_servers.mcp-exec]
command = "npx"
args = ["@joeblackwaslike2/mcp-exec"]

[mcp_servers.mcp-exec.env]
MCP_EXEC_RUNTIME = "codex"
```

### Skills

The plugin manifest declares `"skills": "./skills/"`. Codex auto-discovers skills from this path when the plugin is installed. No manual step required.

### Sandbox

Codex provides platform-native sandboxing. mcp-exec **does not initialize SRT** when `MCP_EXEC_RUNTIME=codex` is set. Codex's OS-level sandbox handles all enforcement.

| Platform | Mechanism | Prerequisites |
| --- | --- | --- |
| macOS | Seatbelt (`sandbox-exec`) | None — built into macOS |
| Linux | bubblewrap (`bwrap`) | `sudo apt install bubblewrap` (Ubuntu) |
| WSL2 | bubblewrap in WSL2 | Same as Linux |
| Windows | Windows Sandbox | Managed by Codex |

Configure the sandbox in your Codex config:

```toml title="~/.codex/config.toml"
sandbox_mode = "workspace-write"
approval_policy = "on-request"
```

See the [Codex Sandboxing reference](/docs/developer/codex-sandboxing) for full details.

---

## Gemini CLI

**Config file:** `GEMINI.md`

### Install

Add the MCP server to your Gemini CLI config and include the skill references in your `GEMINI.md`:

```md title="GEMINI.md"
@./skills/using-mcp-exec/SKILL.md
@./skills/mcp-exec-dev-workflow/SKILL.md
```

Gemini CLI loads `@`-referenced files at session start. The skills inject at startup — no trigger phrase needed.

For the MCP server, add to your Gemini tools config:

```json title="~/.gemini/settings.json"
{
  "mcpServers": {
    "mcp-exec": {
      "command": "npx",
      "args": ["@joeblackwaslike2/mcp-exec"]
    }
  }
}
```

### Sandbox

Gemini CLI does not provide a native sandbox. mcp-exec uses SRT and reads from `~/.claude/settings.json` (the default when no `MCP_EXEC_RUNTIME` is set).

If you prefer a Gemini-specific config file, you can set `MCP_EXEC_RUNTIME=opencode` in your Gemini MCP server env and use `~/.srt-settings.json` instead:

```json title="~/.gemini/settings.json"
{
  "mcpServers": {
    "mcp-exec": {
      "command": "npx",
      "args": ["@joeblackwaslike2/mcp-exec"],
      "env": { "MCP_EXEC_RUNTIME": "opencode" }
    }
  }
}
```

---

## Summary: Skills Wiring Per Agent

| Agent | Skills mechanism | Auto or manual |
| --- | --- | --- |
| Claude Code | `skills/` dir in plugin manifest + `mcp-exec-prime-skill` primes CLAUDE.md | Auto-discover; prime command recommended |
| OpenCode | `config.skills.paths` in plugin hook + bootstrap injection in every conversation | Fully automatic |
| Codex CLI | `skills/` field in plugin manifest | Fully automatic |
| Gemini CLI | `@./skills/...` in GEMINI.md | Automatic at session start |

## Adding a New Agent

To wire mcp-exec into a new agent:

1. Register the MCP server with `MCP_EXEC_RUNTIME=<agent-name>` as an env var
2. Add a detection function in `src/sandbox/config.ts`:
   ```typescript
   export function isMyAgentRuntime(): boolean {
     return process.env.MCP_EXEC_RUNTIME === 'my-agent';
   }
   ```
3. Add a branch in `initializeSandbox()` in `src/server.ts` — either skip SRT (if the agent provides native sandboxing) or call SRT with an appropriate config resolver
4. Point the agent at the `skills/` directory so it discovers `using-mcp-exec` and `mcp-exec-dev-workflow`
