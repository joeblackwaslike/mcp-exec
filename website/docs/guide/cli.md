---
sidebar_position: 5
description: "mcp-exec CLI reference — prime and env commands for CLAUDE.md skill activation and sandbox env allowlist management."
---

# CLI Reference

mcp-exec ships two CLI commands for managing skill activation and sandbox environment variables.

```bash
mcp-exec prime [--local]
mcp-exec env <subcommand> [args] [--local]
```

---

## `mcp-exec prime`

Appends a skill-activation rule to `CLAUDE.md` so Claude automatically loads the `using-mcp-exec` skill at the start of every session.

```bash
mcp-exec prime          # writes to ~/.claude/CLAUDE.md (user-level)
mcp-exec prime --local  # writes to .claude/CLAUDE.md   (project-level)
```

### What it does

Without priming, Claude picks up the skill file roughly 40% of the time. After priming, it loads reliably at 90–95%.

The command appends a single rule to the target `CLAUDE.md`:

```markdown
### mcp-exec (Context-Efficient MCP Workflows)

When you want to know what tools are available across all connected MCP servers,
or when any MCP tool call would return large results that would fill up context:

Invoke the `using-mcp-exec` skill.
```

### When to run it

Run `mcp-exec prime` once after installation. It's safe to run again — if the rule is already present the command exits without modifying the file (idempotent).

```bash
# After npm install -g @joeblackwaslike2/mcp-exec
mcp-exec prime

# For a specific project only
cd my-project
mcp-exec prime --local
```

### `--local` flag

| Flag | Target file | Scope |
|------|-------------|-------|
| _(none)_ | `~/.claude/CLAUDE.md` | All Claude Code sessions |
| `--local` | `.claude/CLAUDE.md` | This project only |

Use `--local` when you want to activate mcp-exec for a specific project without affecting your global Claude Code setup.

:::tip
For non-Claude Code agents (Cursor, Windsurf, Gemini CLI, etc.), priming is done manually by adding the activation text to `.cursorrules`, `GEMINI.md`, `AGENTS.md`, or your agent's custom instructions. See [Installation](/docs/guide/installation) for per-agent instructions.
:::

---

## `mcp-exec env`

Manages the sandbox environment variable allowlist — the set of env vars that are forwarded from your shell into sandbox exec calls.

By default, only a safe subset of env vars is passed through. This prevents credentials, API keys, and other sensitive values from leaking into sandboxed code unintentionally.

```bash
mcp-exec env list           # show which vars pass/block
mcp-exec env list --all     # include all vars present in current shell
mcp-exec env add VAR ...    # add vars to allowlist
mcp-exec env remove VAR ... # remove vars from allowlist
mcp-exec env show           # print raw JSON allowlist
mcp-exec env reset          # restore the default allowlist
```

All subcommands accept `--local` to target `.claude/settings.json` instead of `~/.claude/settings.json`.

### Default allowlist

These env vars are forwarded by default:

| Variable | Purpose |
|----------|---------|
| `PATH` | Command lookup |
| `HOME` | Home directory |
| `TMPDIR` | Temp directory (macOS) |
| `TMP` | Temp directory (Windows) |
| `TEMP` | Temp directory (Windows) |
| `USER` | Current username |
| `USERNAME` | Current username (Windows) |
| `LANG` | Locale setting |
| `LC_ALL` | Locale override |
| `LC_CTYPE` | Locale character encoding |
| `NODE_PATH` | Node.js module resolution |
| `SHELL` | Current shell |

Everything else — `GITHUB_TOKEN`, `AWS_SECRET_ACCESS_KEY`, custom API keys, etc. — is blocked unless explicitly added.

### `list`

Shows which env vars in your current shell are passed through vs blocked:

```text
$ mcp-exec env list
✅  PATH=/usr/local/bin:/usr/bin:/bin
✅  HOME=/Users/joe
✅  TMPDIR=/var/folders/...
✅  USER=joe
✅  SHELL=/bin/zsh
✅  LANG=en_US.UTF-8
🚫  GITHUB_TOKEN  (not in allowlist)
🚫  LINEAR_API_KEY  (not in allowlist)
```

`--all` includes every var currently set in your shell, not just the allowlisted ones:

```bash
mcp-exec env list --all
```

### `add`

Add one or more env vars to the allowlist:

```bash
mcp-exec env add GITHUB_TOKEN
mcp-exec env add GITHUB_TOKEN LINEAR_API_KEY OPENAI_API_KEY
```

After adding, those vars are forwarded into all sandbox exec calls automatically. You can also pass them on a per-call basis via the `runtime.env` config object — see [Per-call environment variables](/docs/guide/configuration#per-call-environment-variables).

### `remove`

Remove vars from the allowlist:

```bash
mcp-exec env remove LINEAR_API_KEY
```

### `show`

Print the raw JSON allowlist stored in the settings file:

```bash
$ mcp-exec env show
["PATH","HOME","TMPDIR","TMP","TEMP","USER","USERNAME","LANG","LC_ALL","LC_CTYPE","NODE_PATH","SHELL","GITHUB_TOKEN"]
```

### `reset`

Restore the default allowlist, discarding any customizations:

```bash
mcp-exec env reset
```

### `--local` flag

```bash
mcp-exec env add GITHUB_TOKEN --local  # project-scope only
mcp-exec env list --local              # show project-scope allowlist
```

Config is stored in `sandbox.env.allow` inside the target settings file:

```json title=".claude/settings.json"
{
  "sandbox": {
    "env": {
      "allow": ["PATH", "HOME", "TMPDIR", "USER", "GITHUB_TOKEN"]
    }
  }
}
```

When both user-level and project-level allowlists exist, they are merged (union).

---

## Related

- [Configuration →](/docs/guide/configuration) — full `sandbox` block reference
- [Security →](/docs/guide/security) — why env filtering matters
