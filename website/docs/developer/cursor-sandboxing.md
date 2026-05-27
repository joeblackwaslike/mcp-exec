---
sidebar_position: 7
description: "How mcp-exec handles sandboxing under Cursor — SRT configuration, ~/.cursor/srt-settings.json, rules-based skill wiring, and setup guide."
---

# Cursor Sandboxing

## How It Works

Cursor does not provide native OS-level sandboxing for MCP server subprocesses. MCP servers under Cursor run with the full permissions of the Cursor process. When mcp-exec detects it is running under Cursor (`MCP_EXEC_RUNTIME=cursor`), it initializes SRT using `~/.cursor/srt-settings.json` as the sandbox policy file.

```
┌────────────────────────────────────────────────────────────────┐
│  Cursor process (no native MCP sandbox)                        │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  mcp-exec process                                       │  │
│  │  SRT: initialized from ~/.cursor/srt-settings.json      │  │
│  │                                                         │  │
│  │  ┌───────────────────────────────────────────────────┐  │  │
│  │  │  exec() code                                      │  │  │
│  │  │  (Node: inside vm.Context + SRT)                  │  │  │
│  │  │  (Bash/Python: subprocess + filtered env + SRT)   │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

:::info
Cursor's agent sandbox (Seatbelt on macOS, Landlock/seccomp on Linux) applies to Cursor's own coding agents, not to MCP servers. MCP servers are explicitly excluded from Cursor's agent sandbox. SRT is the only isolation layer for `exec()` code.
:::

## Detection: `MCP_EXEC_RUNTIME=cursor`

The plugin manifest sets this env var in the MCP server entry. At startup mcp-exec logs:

```
[mcp-exec] Warning: no sandbox configuration found in ~/.cursor/srt-settings.json — running with default permissions
```

Once you create `~/.cursor/srt-settings.json`, the warning disappears.

## Configuration: `~/.cursor/srt-settings.json`

Create this file to configure the SRT sandbox policy. The format is a flat JSON object matching the SRT config shape — no nesting required.

```json title="~/.cursor/srt-settings.json"
{
  "network": {
    "allowedDomains": [
      "api.github.com",
      "*.googleapis.com",
      "registry.npmjs.org"
    ]
  },
  "filesystem": {
    "allowWrite": [
      "~/.mcp-exec/sessions",
      "/tmp"
    ],
    "denyRead": [
      "~/.ssh",
      "~/.aws",
      "~/.gnupg"
    ],
    "denyWrite": [
      "~"
    ]
  },
  "env": {
    "allow": [
      "PATH", "HOME", "TMPDIR", "USER",
      "GITHUB_TOKEN", "GOOGLE_API_KEY"
    ]
  }
}
```

For project-specific overrides, create `.cursor/srt-settings.json` in the project root. The format is identical — arrays are merged (union + dedup) across user and project files. `~/.mcp-exec/sessions` is always added to `allowWrite` even if absent from your config.

## Setup

### Install via plugin manifest

The preferred install path uses Cursor's native plugin system:

```sh
# Copy the plugin to your Cursor plugins directory
cp -r .cursor-plugin/ ~/.cursor/plugins/mcp-exec/
```

Or add the plugin from the Cursor marketplace if published.

### Manual MCP server registration

If you are not using the plugin manifest, add mcp-exec to your global or project MCP config:

```json title="~/.cursor/mcp.json"
{
  "mcpServers": {
    "mcp-exec": {
      "command": "npx",
      "args": ["@joeblackwaslike2/mcp-exec"],
      "env": {
        "MCP_EXEC_RUNTIME": "cursor"
      }
    }
  }
}
```

Project-level override (takes precedence over global):

```json title=".cursor/mcp.json"
{
  "mcpServers": {
    "mcp-exec": {
      "command": "npx",
      "args": ["@joeblackwaslike2/mcp-exec"],
      "env": {
        "MCP_EXEC_RUNTIME": "cursor"
      }
    }
  }
}
```

## Skills and Rules

### Plugin-registered skills

The plugin manifest declares `"skills": "./skills/"`. Cursor discovers both skills automatically:

- **`using-mcp-exec`** — on-demand: activated when the model recognises a multi-tool workflow or large-result tool call
- **`mcp-exec-dev-workflow`** — on-demand: activated during development research

### Always-on rule

The plugin also registers `.cursor/rules/mcp-exec.mdc` with `alwaysApply: true`. This loads a compact activation guide into every Cursor session so the model knows the tools are available without waiting for a skill trigger.

To install the rule manually:

```sh
mkdir -p ~/.cursor/rules
cp .cursor/rules/mcp-exec.mdc ~/.cursor/rules/
```

Or copy it into your project's `.cursor/rules/` directory for project-scoped activation.

## Runtime Comparison

| Scenario | Env var | SRT initialized | Config source |
| --- | --- | --- | --- |
| Claude Code | *(absent)* | Yes | `~/.claude/settings.json` |
| OpenCode | `MCP_EXEC_RUNTIME=opencode` | Yes | `~/.srt-settings.json` |
| Cursor | `MCP_EXEC_RUNTIME=cursor` | Yes | `~/.cursor/srt-settings.json` |
| Codex CLI | `MCP_EXEC_RUNTIME=codex` | No | Codex native sandbox |
| Gemini CLI (sandbox on) | `MCP_EXEC_RUNTIME=gemini` | No | Gemini native sandbox |
| Tests / CI | `SKIP_SANDBOX=1` | No | None |

## Security Note

Cursor's MCP server trust model pins trust to the server's key name in `mcp.json`, not the command being run. A malicious `.cursor/mcp.json` committed to a shared repository could replace the `mcp-exec` command with a different binary while keeping the same key name — Cursor would run it with the same trust level.

To mitigate: review `.cursor/mcp.json` changes in code review, and consider pinning the command to an absolute path or a locked npm package version.

## Troubleshooting

### exec() network calls fail

Check that the target domain is in `allowedDomains` in `~/.cursor/srt-settings.json`. If the file doesn't exist, mcp-exec runs with SRT defaults which allow no outbound network access.

### exec() writes fail with EACCES

The target path must be in `allowWrite`. The session storage path (`~/.mcp-exec/sessions`) and `/tmp` are always allowed. For project output directories, add them to `.cursor/srt-settings.json` at the project root.

### mcp-exec server fails to start

Check that `npx` is in `PATH`. If you installed mcp-exec globally, you can use an absolute path instead:

```json
{
  "mcpServers": {
    "mcp-exec": {
      "command": "/usr/local/bin/node",
      "args": ["/usr/local/lib/node_modules/@joeblackwaslike2/mcp-exec/dist/server.js"],
      "env": { "MCP_EXEC_RUNTIME": "cursor" }
    }
  }
}
```
