---
description: How CC hooks interact with exec() — what fires, what doesn't, and the tool_calls workaround
---

# Plugin Compatibility

## The key difference

Claude Code hooks fire on tool-use events that CC itself dispatches. When downstream MCP tool calls are made inside `exec()`, they happen inside the sandbox subprocess — invisible to CC's hook dispatch system. From CC's perspective, only one tool was called: `exec`.

This means any hook watching a downstream tool name (e.g. `PostToolUse` with matcher `github.listPRs`) will not receive events for calls made inside `exec`. The sandbox is opaque to CC's hook dispatch.

## Hook compatibility

| Hook type | Trigger | Affected by mcp-exec? |
| --- | --- | --- |
| `SessionStart` | CC conversation begins | No — fires normally |
| `pre-compact` | CC compacts conversation | No — fires normally |
| `PreToolUse` / `PostToolUse` on `exec` | The exec MCP tool call | No — fires normally |
| `PreToolUse` / `PostToolUse` on downstream tools | Downstream tool called via native CC | **Yes — does NOT fire when called inside exec** |

## The workaround

Use `tool_calls` from the exec result to restore per-tool observability in plugins that cannot rely on CC hook events.

```typescript
// Plugin reads tool_calls from PostToolUse event on exec
const { tool_calls } = execResult;
const githubCalls = tool_calls.filter(tc => tc.server === "github");
// Log each GitHub tool call, duration, and any errors
```

This gives plugins the same per-tool visibility they would have from native hook events, without requiring any changes to CC itself.

## Plugin compatibility checker (v0.2, planned)

```sh
npx --package=@joeblackwaslike2/mcp-exec mcp-exec-check-plugins
```

Scans `~/.claude/settings.json` and `.claude/settings.json` for hooks that watch downstream MCP tool names and prints a compatibility report identifying which hooks will not fire inside exec.
