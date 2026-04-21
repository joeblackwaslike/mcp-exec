import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface HookCommand {
  type: string;
  command: string;
}

export interface HookEntry {
  matcher?: string;
  hooks: HookCommand[];
}

export interface AffectedHook {
  event: string;
  matcher: string;
  matchedServer: string;
  commands: string[];
}

const TOOL_EVENTS = new Set(['PreToolUse', 'PostToolUse']);

/**
 * Finds PreToolUse/PostToolUse hooks whose matcher specifically references a
 * downstream MCP server name. These hooks won't fire when that server's tools
 * are called inside an exec() sandbox.
 */
export function findAffectedHooks(
  hooks: Record<string, HookEntry[]>,
  serverNames: string[],
): AffectedHook[] {
  const affected: AffectedHook[] = [];

  for (const [event, entries] of Object.entries(hooks)) {
    if (!TOOL_EVENTS.has(event)) continue;

    for (const entry of entries) {
      const matcher = entry.matcher ?? '';
      if (!matcher || matcher === '*') continue;

      const matchedServer = serverNames.find((name) => matcher.includes(name));
      if (!matchedServer) continue;

      affected.push({
        event,
        matcher,
        matchedServer,
        commands: entry.hooks.map((h) => h.command),
      });
    }
  }

  return affected;
}

function readJsonFile(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function main() {
  const globalSettings = readJsonFile(join(homedir(), '.claude', 'settings.json'));
  const projectSettings = readJsonFile(join(process.cwd(), '.claude', 'settings.json'));
  const mcpConfig = readJsonFile(join(process.cwd(), '.claude', 'mcp.json'));

  const serverNames = Object.keys((mcpConfig.mcpServers ?? {}) as Record<string, unknown>).filter(
    (n) => n !== 'mcp-exec',
  );

  if (serverNames.length === 0) {
    return;
  }

  const allHooks = {
    ...((globalSettings.hooks as Record<string, HookEntry[]> | undefined) ?? {}),
    ...((projectSettings.hooks as Record<string, HookEntry[]> | undefined) ?? {}),
  };

  const affected = findAffectedHooks(allHooks, serverNames);

  if (affected.length === 0) {
    return;
  }

  for (const hook of affected) {
    for (const cmd of hook.commands) {
      const _preview = cmd.length > 80 ? `${cmd.slice(0, 77)}...` : cmd;
    }
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
