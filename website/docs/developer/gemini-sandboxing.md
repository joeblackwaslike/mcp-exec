---
sidebar_position: 6
description: "How mcp-exec integrates with Gemini CLI's native sandbox — detection, configuration, platform mechanisms, and troubleshooting."
---

# Gemini CLI Sandboxing

## How It Works

When mcp-exec detects it is running under Gemini CLI (`MCP_EXEC_RUNTIME=gemini`), it skips SRT initialization entirely. Gemini provides its own opt-in native sandbox that wraps the entire agent process — including all MCP server subprocesses.

```
┌────────────────────────────────────────────────────────────────┐
│  Gemini native sandbox (when GEMINI_SANDBOX is enabled)        │
│  (macOS Seatbelt / Linux bwrap|gVisor / Docker|Podman)        │
│  Configured by: GEMINI_SANDBOX env var or tools.sandbox        │
│  in ~/.gemini/settings.json                                    │
│                                                                │
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

:::caution Gemini's sandbox is opt-in
Unlike Codex CLI, Gemini's sandbox is **not enabled by default**. If you run mcp-exec under Gemini without enabling the sandbox, SRT is still skipped and no OS-level isolation is active. Always set `GEMINI_SANDBOX` or `tools.sandbox` in your settings when using mcp-exec for untrusted workflows.
:::

mcp-exec still applies application-level filters inside `exec()` — env var filtering (`DEFAULT_ENV_ALLOW`) and vm.Context isolation for Node — but these are not a substitute for OS-level sandboxing.

## Platform Sandbox Mechanisms

Gemini selects a sandbox mechanism based on the value of `GEMINI_SANDBOX` and the available tools on the host:

| Value | Mechanism | Platform | Notes |
| --- | --- | --- | --- |
| `true` (auto) | Platform default | All | macOS → Seatbelt; Linux → bwrap if available, else Docker |
| `sandbox-exec` | macOS Seatbelt | macOS | Built-in, no dependencies |
| `bwrap` | bubblewrap | Linux / WSL2 | `sudo apt install bubblewrap` |
| `runsc` | gVisor (strongest) | Linux | User-space kernel isolation; install separately |
| `docker` | Docker container | All | Docker daemon required |
| `podman` | Podman container | All | Rootless alternative to Docker |
| `lxc` | LXC/LXD | Linux | Full-system containers; experimental |

## Detection: `MCP_EXEC_RUNTIME=gemini`

mcp-exec detects the Gemini runtime via the `MCP_EXEC_RUNTIME` environment variable set in the extension manifest. At startup it also checks whether Gemini's sandbox is actually active:

1. `GEMINI_SANDBOX` env var — set by the shell or inherited from the Gemini process
2. `tools.sandbox` boolean in `.gemini/settings.json` or `~/.gemini/settings.json`

Startup log when sandbox is active:
```
[mcp-exec] Gemini native sandbox active (bwrap) — SRT initialization skipped
```

Startup log when sandbox is **not** active:
```
[mcp-exec] Gemini runtime detected, no sandbox active — SRT skipped; enable GEMINI_SANDBOX for isolation
```

## Configuration

### Enable Gemini's sandbox

**Via environment variable (recommended for CI/scripts):**
```sh
export GEMINI_SANDBOX=true          # auto-select
export GEMINI_SANDBOX=bwrap         # Linux: bubblewrap
export GEMINI_SANDBOX=sandbox-exec  # macOS: Seatbelt
export GEMINI_SANDBOX=docker        # all platforms
```

**Via settings file (recommended for day-to-day use):**
```json title="~/.gemini/settings.json"
{
  "tools": {
    "sandbox": true
  }
}
```

**Via CLI flag:**
```sh
gemini -s   # or --sandbox
```

### Advanced sandbox options

```sh
# Custom Docker image
export GEMINI_SANDBOX_IMAGE=my-custom-sandbox:latest

# Additional docker/podman flags
export SANDBOX_FLAGS="--memory=512m --cpus=1"

# Mount external directories
export SANDBOX_MOUNTS="/data:/data:ro,/tmp/output:/output:rw"

# macOS: override Seatbelt profile
export SEATBELT_PROFILE=restrictive-proxied
```

### MCP server configuration (manual registration)

If you are not using the extension manifest, add mcp-exec to your Gemini settings manually:

```json title="~/.gemini/settings.json"
{
  "mcpServers": {
    "mcp-exec": {
      "command": "npx",
      "args": ["@joeblackwaslike2/mcp-exec"],
      "env": {
        "MCP_EXEC_RUNTIME": "gemini"
      }
    }
  }
}
```

Or use the CLI helper:
```sh
gemini mcp add mcp-exec npx @joeblackwaslike2/mcp-exec
# then manually add env.MCP_EXEC_RUNTIME = "gemini" to the generated entry
```

## Running Under Claude Code vs Codex vs Gemini

| Scenario | Env var | SRT initialized | Sandbox enforced by |
| --- | --- | --- | --- |
| Claude Code | *(absent)* | Yes | SRT + `~/.claude/settings.json` |
| OpenCode | `MCP_EXEC_RUNTIME=opencode` | Yes | SRT + `~/.srt-settings.json` |
| Codex CLI | `MCP_EXEC_RUNTIME=codex` | No | Codex platform sandbox (always active) |
| Gemini CLI (sandbox on) | `MCP_EXEC_RUNTIME=gemini` | No | Gemini native sandbox |
| Gemini CLI (sandbox off) | `MCP_EXEC_RUNTIME=gemini` | No | **None** — enable `GEMINI_SANDBOX` |
| Tests / CI | `SKIP_SANDBOX=1` | No | None |

## Skills

The Gemini extension registers two skills automatically via `GEMINI.md`:

- **`using-mcp-exec`** — activated when the model is about to call 2+ MCP tools in sequence or a single tool returning large results
- **`mcp-exec-dev-workflow`** — activated during development research (fetching API docs, processing large responses)

The extension's `contextFileName` (`GEMINI.md`) is loaded as always-on context. Skills in the `skills/` directory are loaded on-demand when the model identifies a matching task.

## Troubleshooting

### Linux: bwrap not found

```sh
sudo apt-get install bubblewrap          # Ubuntu/Debian
sudo dnf install bubblewrap              # Fedora
cat /proc/sys/kernel/unprivileged_userns_clone   # must be 1
echo 1 | sudo tee /proc/sys/kernel/unprivileged_userns_clone
```

### macOS: sandbox-exec permission denied

On newer macOS, Seatbelt profiles may require additional entitlements. Switch to Docker if you encounter persistent permission errors:

```sh
export GEMINI_SANDBOX=docker
```

### Startup log shows "no sandbox active" warning

mcp-exec did not find `GEMINI_SANDBOX` in the environment or `tools.sandbox: true` in any settings file. Enable the sandbox via one of the methods above.

### exec() code that was working stops working under the sandbox

Gemini's sandbox restricts filesystem and network access. If `exec()` calls fail inside the sandbox that worked outside it:

1. Check if the failure is filesystem or network with a minimal test
2. For Docker/Podman: add mounts via `SANDBOX_MOUNTS` to expose required paths
3. For bwrap: verify the working directory is within the allowed bind-mount set
4. For Seatbelt: try `SEATBELT_PROFILE=permissive-open` to diagnose, then tighten
