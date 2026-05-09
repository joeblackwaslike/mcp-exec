---
description: Configure the mcp-exec sandbox via settings.json — network, filesystem, and per-call env vars.
---

# Configuration

mcp-exec reads its sandbox policy from Claude Code's standard settings files. No separate config file is needed.

## Settings files

Two files are read and merged on startup:

| File | Scope |
| ---- | ----- |
| `~/.claude/settings.json` | User-level — applies to all projects |
| `.claude/settings.json` | Project-level — applies only to this repo |

Both files are optional. If neither exists, the sandbox runs with default-permissive settings.

## The `sandbox` block

Add a `sandbox` key anywhere in either settings file:

```json
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

> **Note:** Sandbox policy (network, filesystem) is global — it cannot be overridden per call. Only `env` and `timeout` are per-call configurable.

## Per-call timeout

```javascript
exec({
  runtime: { type: "node", timeout: 30000 },  // 30 s
  code: `return longRunningOperation()`
})
```

Default timeout is 10 seconds. Set `timeout` in milliseconds.

## Next steps

- [exec() API reference →](/manual/exec)
- [tools() API reference →](/manual/tools)
