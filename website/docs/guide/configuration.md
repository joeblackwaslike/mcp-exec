---
sidebar_position: 4
description: "Configure the mcp-exec sandbox via settings.json — network, filesystem, per-call env vars, and Codex CLI setup."
---

# Configuration

mcp-exec reads its sandbox policy from Claude Code's standard settings files. No separate config file is needed.

## Settings files

Two files are read and merged on startup:

| File | Scope |
|------|-------|
| `~/.claude/settings.json` | User-level — applies to all projects |
| `.claude/settings.json` | Project-level — applies only to this repo |

Both files are optional. If neither exists, the sandbox runs with default-permissive settings.

## The `sandbox` block

Add a `sandbox` key anywhere in either settings file:

```json title="~/.claude/settings.json or .claude/settings.json"
{
  "sandbox": {
    "network": {
      "allowedDomains": ["api.linear.app", "api.github.com"]
    },
    "filesystem": {
      "allowWrite": ["/tmp"],
      "denyRead":   ["/etc/passwd", "/etc/shadow"],
      "denyWrite":  ["/usr"]
    }
  }
}
```

All keys are optional — omit any section you don't need to restrict.

## Available settings

### `network.allowedDomains`

An array of hostnames the sandbox is permitted to reach. Requests to any other host are blocked at the OS level.

```json
{
  "sandbox": {
    "network": {
      "allowedDomains": [
        "api.linear.app",
        "api.github.com",
        "slack.com"
      ]
    }
  }
}
```

You do not need to list MCP server hostnames manually — they are extracted from `.claude/mcp.json` at startup and merged in automatically (see [Auto-populated domains](#auto-populated-domains) below).

### `filesystem.allowWrite`

Directories the sandbox may write to. Defaults to none (read-only everywhere except `/tmp`).

```json
{
  "sandbox": {
    "filesystem": {
      "allowWrite": ["/tmp", "/home/user/workspace/output"]
    }
  }
}
```

### `filesystem.denyRead`

Paths the sandbox may not read, even if they would otherwise be accessible.

```json
{
  "sandbox": {
    "filesystem": {
      "denyRead": ["/etc/passwd", "/etc/shadow", "/home/user/.ssh"]
    }
  }
}
```

### `filesystem.denyWrite`

Paths the sandbox may not write to, even if `allowWrite` would otherwise permit it. Useful for blocking specific subdirectories inside an allowed parent.

```json
{
  "sandbox": {
    "filesystem": {
      "allowWrite": ["/tmp"],
      "denyWrite":  ["/tmp/sensitive"]
    }
  }
}
```

## Merge behavior

When both settings files exist, their `sandbox` blocks are merged:

- **Objects** are deep-merged (project-level wins on scalar conflicts)
- **Arrays** (`allowedDomains`, `allowWrite`, `denyRead`, `denyWrite`) are concatenated and deduplicated

This lets you set a baseline in `~/.claude/settings.json` and add project-specific domains or paths in `.claude/settings.json` without repeating yourself.

## Auto-populated domains

At startup, mcp-exec reads `.claude/mcp.json` and extracts the hostname from every `url` field it finds. Those hostnames are merged into `allowedDomains` automatically, so MCP servers you've already configured can always reach their own APIs from inside the sandbox.

For stdio-based servers (command + args), no domain is extracted — only HTTP/SSE servers with a `url` field contribute.

## Per-call environment variables

The runtime shorthand (`"node"`, `"bash"`, `"python"`) can be expanded into a config object to pass environment variables into a specific sandbox call:

```javascript
exec({
  runtime: {
    type: "node",
    env: {
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      LINEAR_API_KEY: "lin_api_..."
    }
  },
  code: `
    const gh = await import("@mcp/github");
    return gh.listPullRequests({ state: "open" });
  `
})
```

The `env` values are available as `process.env.*` inside the sandbox for that call only. They are not persisted across calls.

:::info
Sandbox policy (network, filesystem) is global — it cannot be overridden per call. Only `env` and `timeout` are per-call configurable.
:::

## Per-call timeout

```javascript
exec({
  runtime: { type: "node", timeout: 30000 },  // 30 seconds
  code: `return longRunningOperation()`
})
```

Default timeout is 10 seconds. Set `timeout` in milliseconds.

## Environment variable allowlist

By default, sandbox exec calls only receive a safe subset of environment variables from your shell. This prevents credentials and API keys from leaking into sandboxed code unintentionally.

The allowlist is controlled by `sandbox.env.allow` in your settings file:

```json
{
  "sandbox": {
    "env": {
      "allow": ["PATH", "HOME", "TMPDIR", "USER", "SHELL", "GITHUB_TOKEN"]
    }
  }
}
```

**Default allowlist:** `PATH`, `HOME`, `TMPDIR`, `TMP`, `TEMP`, `USER`, `USERNAME`, `LANG`, `LC_ALL`, `LC_CTYPE`, `NODE_PATH`, `SHELL`

Everything else is blocked unless explicitly added. Use the `mcp-exec env` CLI to manage the allowlist interactively instead of editing the JSON by hand:

```bash
mcp-exec env list                   # see what passes vs blocks
mcp-exec env add GITHUB_TOKEN       # add a var
mcp-exec env remove LINEAR_API_KEY  # remove a var
mcp-exec env reset                  # restore defaults
```

See the [CLI Reference →](/docs/guide/cli#mcp-exec-env) for the full command reference.

## Configuration for Codex CLI

Codex CLI uses platform-native sandboxing to isolate its agent process:

| Platform | Sandbox mechanism |
|----------|------------------|
| macOS | `sandbox-exec` (Seatbelt) |
| Linux / WSL2 | `bubblewrap` (`bwrap`) |
| Windows | Windows sandbox or `bwrap` in WSL2 |

When mcp-exec runs inside Codex, **two independent sandbox layers** are in play:

1. **Codex's platform sandbox** — restricts what the mcp-exec process itself can do at the OS level (file access, syscalls, network)
2. **mcp-exec's `srt` sandbox** — restricts what code inside `exec()` can do (network domains, filesystem writes, env vars)

Both layers apply independently. The Codex sandbox constrains mcp-exec; mcp-exec's sandbox constrains your exec code. Neither layer can be widened by the other.

:::info Config file location
mcp-exec reads the same settings files regardless of which agent is running it: `~/.claude/settings.json` (user-level) and `.claude/settings.json` (project-level). Codex users place exec sandbox config in these same files — no separate Codex config is needed.
:::

For most workflows, the default config is sufficient. To allow network access from within `exec()`:

```json title=".claude/settings.json"
{
  "sandbox": {
    "network": {
      "allowedDomains": ["api.github.com", "api.linear.app"]
    }
  }
}
```

:::warning
Widening `allowedDomains` inside mcp-exec does not affect Codex's outer sandbox. If the Codex platform sandbox blocks outbound network for the mcp-exec process itself, `exec()` calls that make network requests will still fail regardless of what `allowedDomains` contains. In that case, use stdio-based MCP servers (command + args) rather than HTTP/SSE servers — stdio transport does not require outbound network from the mcp-exec process.
:::

## Next steps

- [CLI Reference →](/docs/guide/cli) — manage env allowlist and skill activation from the command line
- [Security →](/docs/guide/security) — what the sandbox does and does not protect against
- [exec() API reference →](/docs/manual/exec)
- [tools() API reference →](/docs/manual/tools)
