---
description: How mcp-exec sandboxes code execution — OS-level isolation, env filtering, network policy, and hook opacity.
---

# Security

mcp-exec enforces isolation at the OS level via `@anthropic-ai/sandbox-runtime`. Restrictions apply to all child processes — there is no language-level bypass.

## Sandbox isolation

Every `exec()` call runs inside a restricted OS-level sandbox:

- **Network:** outbound requests are blocked by default; `allowedDomains` in `sandbox.network` controls what hostnames are reachable
- **Filesystem:** writes are blocked except `/tmp` by default; `allowWrite` and `denyRead`/`denyWrite` control access
- **Process:** child processes inherit the same sandbox restrictions; they cannot escalate privileges

The sandbox policy is global and set in `~/.claude/settings.json` or `.claude/settings.json`. It cannot be overridden per-call (only `env` and `timeout` are per-call configurable).

See [Configuration →](/guide/configuration) for the full `sandbox` block reference.

## Environment variable filtering

By default, only a safe minimal set of env vars is forwarded from your shell into Bash and Python subprocesses. This prevents credentials, API keys, and tokens from leaking into sandboxed code unintentionally.

**Default allowlist:** `PATH`, `HOME`, `TMPDIR`, `TMP`, `TEMP`, `USER`, `USERNAME`, `LANG`, `LC_ALL`, `LC_CTYPE`, `NODE_PATH`, `SHELL`

Everything else — `GITHUB_TOKEN`, `AWS_SECRET_ACCESS_KEY`, custom API keys — is stripped before the child process spawns.

To forward additional vars:

```bash
mcp-exec env add GITHUB_TOKEN           # user-level
mcp-exec env add GITHUB_TOKEN --local   # project-level
mcp-exec env list                       # see what passes vs blocks
```

The Node runtime uses `vm.Context` and does not spawn a subprocess, so its env exposure is limited to the parent process scope.

See [CLI Reference → mcp-exec env](/guide/cli#mcp-exec-env) for full subcommand documentation.

## Hook opacity

`PreToolUse`/`PostToolUse` hooks watching downstream MCP tool names will **not** fire when those tools are called inside `exec()`. The sandbox is opaque to the Claude Code event system.

If you need to observe which tools were called inside a sandbox run, use the `tool_calls` field on the exec result:

```typescript
const { result, tool_calls } = await exec({ runtime: "node", code: `...` });
// tool_calls: [{ server: "github", name: "listPullRequests", args: {...}, result: {...} }]
```

## Credential handling

mcp-exec does not have a credential system. Authentication tokens reach MCP servers via env vars present in the shell environment (`.env`, direnv, secrets manager, etc.) — the same mechanism the MCP servers themselves use. No credentials are stored, proxied, or managed by mcp-exec.

## Related

- [Configuration →](/guide/configuration) — sandbox policy reference
- [CLI Reference →](/guide/cli) — env allowlist management
