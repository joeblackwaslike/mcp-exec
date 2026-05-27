---
sidebar_position: 4
description: "How mcp-exec integrates with Codex CLI's platform-native sandboxing — detection, configuration, and troubleshooting."
---

# Codex CLI Sandboxing

## How It Works

When mcp-exec detects it is running under Codex CLI (`MCP_EXEC_RUNTIME=codex`), it skips SRT initialization entirely. Codex provides its own platform-native sandbox that wraps the entire mcp-exec server process, so a second sandbox layer would be redundant and could cause initialization failures.

```
┌────────────────────────────────────────────────────────────────┐
│  Codex platform sandbox                                        │
│  (macOS Seatbelt / Linux bwrap / Windows Sandbox)             │
│  Configured by: ~/.codex/config.toml                          │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  mcp-exec process                                       │  │
│  │  SRT: not initialized                                   │  │
│  │                                                         │  │
│  │  ┌───────────────────────────────────────────────────┐  │  │
│  │  │  exec() code                                      │  │  │
│  │  │  (Node: inside vm.Context)                        │  │  │
│  │  │  (Bash/Python: subprocess with filtered env)      │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

mcp-exec still applies its own application-level filters inside `exec()` — env var filtering (`DEFAULT_ENV_ALLOW`) and vm.Context isolation for Node — but it does not initialize SRT. The OS-level enforcement is Codex's responsibility.

## Platform Sandbox Mechanisms

Codex uses different OS primitives per platform:

| Platform | Mechanism | Notes |
|---|---|---|
| macOS | macOS Seatbelt (`sandbox-exec`) | Built into the OS, no installation needed |
| Linux | bubblewrap (`bwrap`) | `sudo apt install bubblewrap` (Ubuntu) / `sudo dnf install bubblewrap` (Fedora) |
| WSL2 | bubblewrap (`bwrap`) in WSL2 | Same as Linux; ensure `bwrap` is available in the WSL2 distro |
| Windows (native) | Windows Sandbox (PowerShell) | Codex manages this directly |

## Detection: `MCP_EXEC_RUNTIME=codex`

mcp-exec detects the Codex runtime via the `MCP_EXEC_RUNTIME` environment variable. When it equals `"codex"`, SRT initialization is skipped and a startup message is logged:

```
[mcp-exec] Codex native sandbox detected (workspace-write mode) — SRT initialization skipped
```

The mode annotation (`workspace-write mode`) is read from `sandbox_mode` in your `~/.codex/config.toml`. If no config.toml is found or `sandbox_mode` is absent, the mode annotation is omitted.

This env var is set automatically when you register mcp-exec via the plugin manifest. Add it to your Codex `config.toml` MCP server entry if you register mcp-exec manually:

```toml title="~/.codex/config.toml"
[mcp_servers.mcp-exec]
command = "npx"
args = ["@joeblackwaslike2/mcp-exec"]

[mcp_servers.mcp-exec.env]
MCP_EXEC_RUNTIME = "codex"
```

## Configuration

Codex's sandbox is configured in `~/.codex/config.toml` (user-scope) and `.codex/config.toml` (project-scope). The sandbox-relevant keys:

| Key | Values | Default |
|---|---|---|
| `sandbox_mode` | `read-only`, `workspace-write`, `danger-full-access` | `workspace-write` |
| `approval_policy` | `untrusted`, `on-request`, `never` | `on-request` |
| `sandbox_workspace_write.writable_roots` | list of paths | workspace directory |

mcp-exec reads `sandbox_mode` and `writable_roots` for diagnostic logging at startup. It does not pass them to SRT (SRT is not initialized). Codex enforces these settings directly via the OS sandbox.

### Example config.toml

```toml title="~/.codex/config.toml"
sandbox_mode = "workspace-write"
approval_policy = "on-request"

[mcp_servers.mcp-exec]
command = "npx"
args = ["@joeblackwaslike2/mcp-exec"]

[mcp_servers.mcp-exec.env]
MCP_EXEC_RUNTIME = "codex"
```

## Running Under Claude Code vs Codex

The same mcp-exec binary handles both agents. The runtime flag determines the sandbox path:

| Scenario | Env var | SRT initialized | Sandbox enforced by |
| --- | --- | --- | --- |
| Claude Code | *(absent)* | Yes | SRT + `~/.claude/settings.json` |
| Codex CLI | `MCP_EXEC_RUNTIME=codex` | No | Codex platform sandbox |
| Tests / CI | `SKIP_SANDBOX=1` | No | None |

When running under Claude Code, configure sandbox policy via the `sandbox` block in `~/.claude/settings.json`. See the [Configuration guide](/docs/guide/configuration) for details.

## Troubleshooting

### Linux/WSL2: bwrap not found

**Symptom:** Codex CLI reports an error about bubblewrap or sandbox initialization.

```sh
# Install bwrap (Ubuntu/Debian)
sudo apt-get install bubblewrap

# Verify unprivileged user namespace support (must be 1)
cat /proc/sys/kernel/unprivileged_userns_clone
echo 1 | sudo tee /proc/sys/kernel/unprivileged_userns_clone
```

On Ubuntu 24.04, AppArmor may restrict bubblewrap. Check for the `bwrap-userns-restrict` profile and disable it if needed per Codex documentation.

### exec() sandbox not active

**Symptom:** mcp-exec logs show `SRT initialization skipped` but you expected SRT to be active.

This is expected behavior under Codex. Codex's OS-level sandbox replaces SRT. If you need SRT active, remove `MCP_EXEC_RUNTIME=codex` from the env vars in your Codex config.toml (not recommended — it may cause SRT initialization failures inside Codex's sandbox).

### exec() returns exitCode 124 (timeout)

Codex's platform sandbox may add latency to network calls and filesystem operations. If downstream MCP tool calls inside `exec()` are hitting your timeout, increase it:

```typescript
exec({ code, runtime: { type: 'node', timeout: 30000 } })
```
