import { readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

      const matchedServer = serverNames.find((name) => matcher.includes(`${name}__`));
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

export function readJsonFile(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function main(cwd = process.cwd()): void {
  const globalSettings = readJsonFile(join(homedir(), '.claude', 'settings.json'));
  const projectSettings = readJsonFile(join(cwd, '.claude', 'settings.json'));
  const mcpConfig = readJsonFile(join(cwd, '.claude', 'mcp.json'));

  const serverNames = Object.keys((mcpConfig.mcpServers ?? {}) as Record<string, unknown>).filter(
    (n) => n !== 'mcp-exec',
  );

  if (serverNames.length === 0) {
    process.stdout.write(
      'mcp-exec check-plugins: no downstream MCP servers found in .claude/mcp.json\n',
    );
    return;
  }

  const globalHooks = (globalSettings.hooks as Record<string, HookEntry[]> | undefined) ?? {};
  const projectHooks = (projectSettings.hooks as Record<string, HookEntry[]> | undefined) ?? {};
  const allEvents = new Set([...Object.keys(globalHooks), ...Object.keys(projectHooks)]);
  const allHooks: Record<string, HookEntry[]> = {};
  for (const event of allEvents) {
    allHooks[event] = [...(globalHooks[event] ?? []), ...(projectHooks[event] ?? [])];
  }

  const affected = findAffectedHooks(allHooks, serverNames);

  if (affected.length === 0) {
    process.stdout.write('✓ mcp-exec check-plugins: no compatibility issues found\n');
    return;
  }

  process.stdout.write(
    `⚠ mcp-exec check-plugins: ${affected.length} hook(s) watch downstream tool names that won't fire inside exec()\n\n`,
  );
  process.stdout.write(
    '  Calls to these tools via exec() are sandboxed — CC hook events are not emitted for them.\n',
  );
  process.stdout.write(
    '  Use the tool_calls[] field in exec() results for per-tool observability.\n\n',
  );

  for (const hook of affected) {
    process.stdout.write(
      `  [${hook.event}] matcher: "${hook.matcher}" (server: ${hook.matchedServer})\n`,
    );
    for (const cmd of hook.commands) {
      const preview = cmd.length > 80 ? `${cmd.slice(0, 77)}...` : cmd;
      process.stdout.write(`    command: ${preview}\n`);
    }
    process.stdout.write('\n');
  }

  process.stdout.write('  See docs/DEVELOPER.md for the tool_calls schema and migration guide.\n');
}

try {
  if (realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    main();
  }
} catch {
  // argv[1] may not be a resolvable path in some environments; skip auto-run
}
