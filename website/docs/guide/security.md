---
sidebar_position: 6
description: "How mcp-exec sandboxes code execution — OS-level isolation, env filtering, network policy, filesystem restrictions, and credential best practices."
---

# Security

mcp-exec enforces isolation at the OS level via `@anthropic-ai/sandbox-runtime` (`srt`) — the same sandbox Claude Code itself uses. Restrictions apply to all child processes spawned inside `exec()`. There is no language-level bypass.

## OS-level sandboxing model

Every `exec()` call runs inside a restricted OS-level sandbox. The sandbox mechanism varies by platform:

| Platform | Mechanism |
|----------|-----------|
| macOS | `sandbox-exec` (Seatbelt) |
| Linux | `bubblewrap` (`bwrap`) |

The sandbox is applied before any user code runs. Code executing inside `exec()` — including MCP tool calls made via imported modules — runs under these restrictions for the lifetime of the call.

### What the sandbox restricts

- **Network** — outbound requests are blocked by default. `allowedDomains` in `sandbox.network` controls what hostnames are reachable. Requests to unlisted hosts are rejected at the OS level, not by the runtime.
- **Filesystem writes** — writes are blocked except to `/tmp` by default. `allowWrite` controls additional writable paths. `denyWrite` can block specific paths inside an allowed parent.
- **Filesystem reads** — most paths are readable by default. `denyRead` blocks specific paths (e.g. `/etc/shadow`, `~/.ssh`).
- **Child processes** — processes spawned inside `exec()` inherit the same sandbox restrictions. They cannot escalate privileges or escape the sandbox by forking.

Sandbox policy is global and set in `~/.claude/settings.json` or `.claude/settings.json`. It cannot be overridden per `exec()` call — only `env` and `timeout` are per-call configurable.

See [Configuration →](/docs/guide/configuration) for the full `sandbox` block reference.

### What the sandbox does NOT protect against

:::warning
The sandbox is not a security boundary against malicious code. It is a policy layer designed to prevent accidental data leakage and unintended side effects in normal agentic workflows.
:::

Specifically, the sandbox does **not** protect against:

- **Malicious packages** — if you declare `pandas` in a PEP 723 script, `uv` fetches it from PyPI. A compromised package could attempt to exfiltrate data through permitted network channels (those in `allowedDomains`) or through the filesystem within `allowWrite` paths.
- **Data exfiltration through permitted channels** — code that is permitted to reach `api.github.com` can send arbitrary data to `api.github.com`. `allowedDomains` controls reachability, not content.
- **Secrets passed via `runtime.env`** — env vars explicitly forwarded per-call are available to all code running in that call. Only forward what the code actually needs.
- **Host process compromise** — the sandbox does not protect the mcp-exec process itself from compromise. It only constrains code running inside `exec()`.

## Environment variable filtering

By default, only a safe minimal set of env vars is forwarded from your shell into Bash and Python subprocesses. This prevents credentials, API keys, and tokens from leaking into sandboxed code unintentionally.

**Default allowlist:** `PATH`, `HOME`, `TMPDIR`, `TMP`, `TEMP`, `USER`, `USERNAME`, `LANG`, `LC_ALL`, `LC_CTYPE`, `NODE_PATH`, `SHELL`

Everything else — `GITHUB_TOKEN`, `AWS_SECRET_ACCESS_KEY`, custom API keys — is stripped before the child process spawns.

:::warning
The Node runtime uses `vm.runInContext` (not a subprocess) and does not get the same env filtering. The Node sandbox runs in the same process as mcp-exec and has access to the parent process environment. Do not rely on env filtering alone to protect secrets from Node exec calls — use `allowedDomains` to constrain what the code can reach.
:::

To forward additional vars to Bash/Python:

```bash
mcp-exec env add GITHUB_TOKEN           # user-level
mcp-exec env add GITHUB_TOKEN --local   # project-level
mcp-exec env list                       # see what passes vs blocks
```

See [CLI Reference → mcp-exec env](/docs/guide/cli#mcp-exec-env) for full subcommand documentation.

## Network restrictions

Network access is blocked by default for all runtimes. To enable access to specific hosts:

```json title=".claude/settings.json"
{
  "sandbox": {
    "network": {
      "allowedDomains": ["api.github.com", "api.linear.app"]
    }
  }
}
```

MCP server hostnames are extracted from `.claude/mcp.json` at startup and merged into `allowedDomains` automatically — you don't need to re-list servers you've already configured.

:::info
For stdio-based MCP servers (command + args), no domain is extracted — only HTTP/SSE servers with a `url` field contribute to the auto-populated list.
:::

## Filesystem restrictions

By default:

- All paths are **readable** (except those explicitly listed in `denyRead`)
- All paths are **read-only** except `/tmp`

To allow writes to additional paths:

```json
{
  "sandbox": {
    "filesystem": {
      "allowWrite": ["/tmp", "/home/user/workspace/output"],
      "denyRead":   ["/etc/shadow", "/home/user/.ssh"],
      "denyWrite":  ["/tmp/sensitive"]
    }
  }
}
```

`denyWrite` takes precedence over `allowWrite` — you can allow a broad path and deny a specific subdirectory within it.

## Hook opacity

`PreToolUse`/`PostToolUse` hooks watching downstream MCP tool names will **not** fire when those tools are called inside `exec()`. The sandbox is opaque to the Claude Code event system.

:::warning
If you have hooks that enforce policy on specific MCP tool calls (e.g. blocking writes to certain Linear projects, or requiring approval before posting to Slack), those hooks will not trigger for calls made inside `exec()`. Audit your hook policies before routing sensitive tool calls through the sandbox.
:::

If you need to observe which tools were called inside a sandbox run, use the `tool_calls` field on the exec result:

```typescript
const { result, tool_calls } = await exec({ runtime: "node", code: `...` });
// tool_calls: [{ server: "github", name: "listPullRequests", args: {...}, result: {...} }]
```

## Credential handling

mcp-exec does not have a credential system. Authentication tokens reach MCP servers via env vars present in the shell environment (`.env`, direnv, secrets manager, etc.) — the same mechanism the MCP servers themselves use. No credentials are stored, proxied, or managed by mcp-exec.

### Credential best practices

- **Use direnv or a secrets manager** rather than hardcoding tokens in settings files or code. mcp-exec reads env vars from the shell at startup — whatever mechanism populates your shell env works automatically.
- **Use `mcp-exec env add` rather than `runtime.env`** for tokens you need in every session. Per-call `runtime.env` is appropriate for tokens that differ per workflow or that you want to explicitly control per call.
- **Scope `allowedDomains` tightly.** If a credential only needs to reach one API, only allow that API's domain. A leaked credential is less useful if the sandbox can only send it to its intended destination.
- **Use `denyRead` to exclude sensitive files** like `~/.ssh`, `~/.gnupg`, and credential files in your home directory, even though they're not writable by default. Defense in depth.

```json title="Example: tightened credential posture"
{
  "sandbox": {
    "network": {
      "allowedDomains": ["api.github.com"]
    },
    "filesystem": {
      "denyRead": ["/home/user/.ssh", "/home/user/.gnupg", "/home/user/.aws"]
    },
    "env": {
      "allow": ["PATH", "HOME", "TMPDIR", "USER", "SHELL", "GITHUB_TOKEN"]
    }
  }
}
```

## Related

- [Configuration →](/docs/guide/configuration) — sandbox policy reference
- [CLI Reference →](/docs/guide/cli) — env allowlist management
