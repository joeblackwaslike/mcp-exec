---
sidebar_position: 4
description: "How mcp-exec integrates with Codex CLI's platform-native sandboxing — dual layers, configuration, and troubleshooting."
---

# Codex CLI Sandboxing

## Overview

When mcp-exec runs under Codex CLI, two independent sandboxing layers are active simultaneously. Understanding how they interact is necessary to configure network and filesystem access correctly.

**Codex's platform sandbox** wraps the entire mcp-exec server process. It is enforced at the OS level by Codex itself, using different mechanisms per platform.

**mcp-exec's srt sandbox** wraps code running inside individual `exec()` calls. It is configured via your `.claude/settings.json` files and enforced by `@anthropic-ai/sandbox-runtime`.

These layers are independent and additive. Code inside `exec()` is sandboxed twice. A resource must be permitted by both layers to be accessible.

## Platform Sandbox Mechanisms

Codex uses different OS primitives depending on the host platform:

| Platform | Mechanism | Notes |
|---|---|---|
| macOS | macOS Seatbelt (`sandbox-exec`) | Built into the OS, no installation needed |
| Linux | bubblewrap (`bwrap`) | Install via distro package manager; Codex falls back to a bundled helper if `bwrap` not found, but unprivileged user namespace support is required |
| WSL2 | bubblewrap (`bwrap`) in WSL2 | Same as Linux; ensure `bwrap` is available in the WSL2 distro |
| Windows (native) | Windows Sandbox (PowerShell) | Codex manages this directly |

mcp-exec has no visibility into which mechanism Codex is using. It cannot detect the active platform sandbox type or auto-adjust its configuration in response.

## Sandbox Layer Configuration

```
┌────────────────────────────────────────────────────────────────┐
│  Codex platform sandbox                                        │
│  (macOS Seatbelt / bwrap / Windows Sandbox)                    │
│  Configured by: Codex CLI settings                             │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  mcp-exec srt sandbox                                    │  │
│  │  Configured by: ~/.claude/settings.json +                │  │
│  │                 .claude/settings.json (project)          │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  exec() code                                       │  │  │
│  │  │  (Node: also inside vm.Context)                    │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

**Codex's sandbox** — managed by Codex. Configure via Codex's own settings. mcp-exec has no config interface for this layer.

**mcp-exec's srt sandbox** — managed by mcp-exec. Configure via the `sandbox` block in `~/.claude/settings.json` (user-scope) and `.claude/settings.json` (project-scope). These paths are the same regardless of which agent (CC or Codex) is running mcp-exec.

No Codex-specific config file is needed for mcp-exec's inner sandbox.

## Configuration Reference

### mcp-exec sandbox config (settings.json)

```json
{
  "sandbox": {
    "network": {
      "allowedDomains": [
        "api.github.com",
        "gmail.googleapis.com",
        "*.example.com"
      ]
    },
    "filesystem": {
      "allowWrite": [
        "~/.mcp-exec/sessions",
        "/tmp"
      ],
      "denyRead": [
        "~/.ssh",
        "~/.aws"
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
}
```

User-scope (`~/.claude/settings.json`) and project-scope (`.claude/settings.json`) are merged: array fields are unioned (deduped), so you can layer global and per-project policies without one overwriting the other.

`~/.mcp-exec/sessions` and `/tmp` are always included in `allowWrite` — they are injected by mcp-exec regardless of what your config specifies.

### Configuration matrix: access control

For a given resource, access is granted only if **both** layers permit it. If either layer denies, the call fails.

| Resource | Controlled by | Config location |
|---|---|---|
| Network — allowed domains inside exec() | mcp-exec srt sandbox | `sandbox.network.allowedDomains` in settings.json |
| Network — overall process network access | Codex platform sandbox | Codex settings |
| Filesystem writes inside exec() | mcp-exec srt sandbox | `sandbox.filesystem.allowWrite` in settings.json |
| Filesystem writes by mcp-exec process | Codex platform sandbox | Codex settings |
| Env vars visible inside exec() | mcp-exec srt sandbox | `sandbox.env.allow` in settings.json |
| Codex agent's own env | Codex platform sandbox | Codex settings |

## Network Access

Network calls inside `exec()` must satisfy both layers:

1. The target domain must be in mcp-exec's `sandbox.network.allowedDomains`.
2. The Codex platform sandbox must permit network access to that domain.

If a domain is in mcp-exec's allowlist but blocked by Codex's platform sandbox, the call will fail at the OS level. The error will typically appear as a connection refused or DNS resolution failure, not as an mcp-exec error.

**Example** — a call to `api.github.com` fails unexpectedly:

```
# Check 1: is the domain in mcp-exec's allowlist?
# ~/.claude/settings.json or .claude/settings.json must have:
"sandbox": { "network": { "allowedDomains": ["api.github.com"] } }

# Check 2: does Codex's sandbox permit that network access?
# Refer to Codex CLI documentation for configuring allowed domains
# in its platform sandbox.
```

If both are configured but calls still fail, see the troubleshooting section below.

## Filesystem Access

The same double-layer rule applies to filesystem writes. `allowWrite` paths in mcp-exec's config must also be within the paths Codex's platform sandbox allows the mcp-exec process to write.

`/tmp` and `~/.mcp-exec/sessions` are always in mcp-exec's `allowWrite`. They are also typically permitted by Codex's sandbox. If writes to these paths fail, the issue is at the Codex layer.

For project-specific paths (e.g. writing output files to the working directory), both layers must agree:

```json
// .claude/settings.json (project-scope)
{
  "sandbox": {
    "filesystem": {
      "allowWrite": ["./output", "./.cache"]
    }
  }
}
```

And the equivalent path must be accessible to the mcp-exec process in Codex's sandbox.

## Known Limitations (v1.0)

- mcp-exec cannot detect which Codex platform sandbox mode is active.
- No automatic adjustment of mcp-exec's sandbox config based on the platform sandbox type.
- Users on Linux/WSL2 should verify that `bwrap` is installed and that unprivileged user namespaces are enabled for full Codex sandbox enforcement.
- Future versions may add support for reading from `.codex/settings.json` to allow agent-specific sandbox policies without affecting the CC settings.json.

## Troubleshooting

### Network calls inside exec() fail unexpectedly

**Symptom:** `exec()` code that makes HTTP requests throws connection errors or timeouts. The same request works when made directly from the shell.

**Diagnosis steps:**

1. Check mcp-exec's allowedDomains:
   ```sh
   cat ~/.claude/settings.json | grep -A5 '"network"'
   cat .claude/settings.json 2>/dev/null | grep -A5 '"network"'
   ```
   The target domain must appear in `allowedDomains` in at least one of these files.

2. Check if the issue is domain-specific or all-network:
   ```typescript
   // In exec() — try a simple fetch to a known-allowed domain
   const r = await fetch('https://api.github.com');
   return r.status;
   ```
   If even this fails, the issue may be at the Codex sandbox layer (network blocked entirely) rather than a domain-allowlist problem.

3. Check mcp-exec startup logs for the warning:
   ```
   [mcp-exec] Warning: no sandbox configuration found in settings.json
   ```
   This means the `sandbox` block is missing. mcp-exec is running with srt defaults, which may not include your target domain.

4. Verify Codex's network configuration. Refer to Codex CLI documentation for its sandbox network rules.

### Filesystem writes inside exec() fail

**Symptom:** writing to a path inside `exec()` throws `EACCES` or `EPERM`. The same write works from outside the sandbox.

**Diagnosis steps:**

1. Check if the path is in mcp-exec's `allowWrite`:
   ```sh
   cat ~/.claude/settings.json | grep -A10 '"filesystem"'
   ```
   If the path is absent, add it to `sandbox.filesystem.allowWrite` in the appropriate settings.json.

2. Check if `/tmp` writes work — if not, the Codex platform sandbox is blocking filesystem access at a level above mcp-exec's config.

3. For project paths, make sure you're using `.claude/settings.json` (project-scope) rather than only user-scope, as the project-scope config is processed from `process.cwd()` at startup.

### Linux/WSL2: bwrap not found or unprivileged namespaces disabled

**Symptom:** Codex CLI reports an error about bubblewrap or sandbox initialization when starting on Linux or WSL2.

**Fix:**

```sh
# Install bwrap (Ubuntu/Debian)
sudo apt-get install bubblewrap

# Verify unprivileged user namespace support
cat /proc/sys/kernel/unprivileged_userns_clone
# Must be 1. If 0:
echo 1 | sudo tee /proc/sys/kernel/unprivileged_userns_clone
```

This is a Codex platform sandbox issue, not an mcp-exec issue. mcp-exec's own sandbox will initialize normally once Codex's outer sandbox is functional.

### exec() returns exitCode 124 (timeout) more often under Codex

The Codex platform sandbox may add latency to network calls and filesystem operations compared to running without it. If downstream MCP tool calls inside `exec()` are hitting your configured timeout because of this added latency, increase the timeout in the `runtime` config object:

```typescript
// Instead of:
exec({ code, runtime: 'node' })

// Use a config object with a higher timeout:
exec({ code, runtime: { type: 'node', timeout: 30000 } })
```

Default timeout when none is specified is determined by the srt sandbox runtime configuration.
