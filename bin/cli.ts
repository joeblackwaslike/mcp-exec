#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { DEFAULT_ENV_ALLOW } from '../src/sandbox/config.js';

// ── colours ──────────────────────────────────────────────────────────────────
const ESC = '';
const G = `${ESC}[32m`;
const Y = `${ESC}[33m`;
const C = `${ESC}[36m`;
const D = `${ESC}[2m`;
const B = `${ESC}[1m`;
const R = `${ESC}[0m`;

/** Strip ANSI escape sequences to measure visible length. */
const ANSI_RE = new RegExp(String.raw`${ESC}\[[^m]*m`, 'g');
const visLen = (s: string) => s.replace(ANSI_RE, '').length;

// ── settings helpers ─────────────────────────────────────────────────────────

function settingsPath(local: boolean): string {
  return local
    ? join(process.cwd(), '.claude', 'settings.json')
    : join(homedir(), '.claude', 'settings.json');
}

function readSettings(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeSettings(path: string, data: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function getConfiguredAllow(path: string): string[] | undefined {
  const s = readSettings(path);
  const block = s?.sandbox as { env?: { allow?: string[] } } | undefined;
  return block?.env?.allow;
}

function setConfiguredAllow(path: string, allow: string[]): void {
  const s = readSettings(path);
  const sandbox = (s.sandbox ?? {}) as Record<string, unknown>;
  const env = (sandbox.env ?? {}) as Record<string, unknown>;
  env.allow = allow;
  sandbox.env = env;
  s.sandbox = sandbox;
  writeSettings(path, s);
}

// ── prime command ─────────────────────────────────────────────────────────────

const PRIME_MARKER = '`mcp-exec` — sandboxed execution + MCP tool search';

const PRIME_BLOCK = `\
## Skill Activations

### \`mcp-exec\` — sandboxed execution + MCP tool search

Activate the \`using-mcp-exec\` skill when you are about to:
- Call 2+ MCP tools in sequence where intermediate results don't need to stay in context
- Call a single MCP tool that returns more data than you need — wrap in exec() and filter inline
- Do multi-step research, data aggregation, or schema processing
- Fan out across multiple sources and return a single summary

Tools added: \`tools(query)\` (trimmed MCP catalog search) and \`exec(code, runtime)\` (sandboxed
Node/Bash/Python — only final output returned). See the skill for import syntax and examples.
`;

function runPrime(args: string[]): void {
  const local = args.includes('--local') || args.includes('--scope=project');
  const target = local ? join(process.cwd(), 'CLAUDE.md') : join(homedir(), '.claude', 'CLAUDE.md');
  const display = local ? './CLAUDE.md' : '~/.claude/CLAUDE.md';
  const _alt = local ? 'user' : 'project';
  const altFile = local ? '~/.claude/CLAUDE.md' : './CLAUDE.md';

  let existing = '';
  if (existsSync(target)) {
    existing = readFileSync(target, 'utf8');
  } else {
    mkdirSync(dirname(target), { recursive: true });
  }

  const status = existing.includes(PRIME_MARKER) ? 'exists' : 'added';
  if (status === 'added') {
    const sep = existing.endsWith('\n') ? '\n' : '\n\n';
    writeFileSync(target, existing + sep + PRIME_BLOCK);
  }

  const label = status === 'exists' ? `${D}already primed — skipped${R}` : `${G}primed${R}`;
  process.stdout.write(`
${B}mcp-exec plugin installed${R}
  ${G}✓${R} mcp    mcp-exec (sandboxed exec + MCP tool search)
  ${G}✓${R} skill  using-mcp-exec
  ${G}✓${R} skill  mcp-exec-dev-workflow
  ${G}✓${R} cli    mcp-exec prime / mcp-exec env

${display}  ${label}

${Y}NOTE: Skills must be primed to activate reliably. This added a CLAUDE.md rule that
tells the model when to load the using-mcp-exec skill (~90–95% vs ~40% with skills alone).

  Run 'mcp-exec prime --local' to prime ${altFile} instead.${R}

Run 'mcp-exec --help' for all commands.

`);
}

// ── env command ───────────────────────────────────────────────────────────────

function runEnv(args: string[]): void {
  const [sub, ...rest] = args;
  const local = rest.includes('--local');
  const path = settingsPath(local);
  const display = local ? '.claude/settings.json' : '~/.claude/settings.json';

  switch (sub) {
    case 'list':
      envList(path, display, rest.includes('--all'));
      break;
    case 'add':
      envAdd(
        path,
        display,
        rest.filter((a) => !a.startsWith('-')),
      );
      break;
    case 'remove':
    case 'rm':
      envRemove(
        path,
        display,
        rest.filter((a) => !a.startsWith('-')),
      );
      break;
    case 'show':
      envShow(path, display);
      break;
    case 'reset':
      envReset(path, display);
      break;
    default:
      process.stdout.write(`
${B}mcp-exec env${R} — manage the sandbox environment variable allowlist

  ${C}mcp-exec env list${R}           Show which env vars pass through to the sandbox
  ${C}mcp-exec env list --all${R}     Also list blocked vars (names only)
  ${C}mcp-exec env add <VAR...>${R}   Add vars to the allowlist
  ${C}mcp-exec env remove <VAR...>${R} Remove vars from the allowlist
  ${C}mcp-exec env show${R}           Print the raw allowlist from settings.json
  ${C}mcp-exec env reset${R}          Reset to the built-in default allowlist

  Add ${C}--local${R} to any command to target .claude/settings.json instead of ~/.claude/settings.json.

`);
  }
}

function envList(path: string, display: string, showAll: boolean): void {
  const configured = getConfiguredAllow(path);
  const effective = configured ?? DEFAULT_ENV_ALLOW;
  const source = configured ? 'config' : 'default';

  const passing: Array<{ name: string; value: string; source: string }> = [];
  const blocked: string[] = [];

  for (const [k, v] of Object.entries(process.env)) {
    if (effective.includes(k)) {
      passing.push({ name: k, value: v ?? '', source });
    } else {
      blocked.push(k);
    }
  }

  // also show allowlist vars not currently set
  for (const k of effective) {
    if (process.env[k] === undefined) {
      passing.push({ name: k, value: `${D}(not set)${R}`, source });
    }
  }

  passing.sort((a, b) => a.name.localeCompare(b.name));

  const nameW = Math.max(4, ...passing.map((r) => r.name.length));
  const valW = Math.min(50, Math.max(5, ...passing.map((r) => visLen(r.value))));

  process.stdout.write(
    `\n${B}Env vars passing through to the sandbox${R}  ${D}(${display})${R}\n\n`,
  );
  process.stdout.write(`  ${'NAME'.padEnd(nameW)}  ${'VALUE'.padEnd(valW)}  SOURCE\n`);
  process.stdout.write(`  ${'─'.repeat(nameW)}  ${'─'.repeat(valW)}  ${'─'.repeat(12)}\n`);

  for (const row of passing) {
    const truncVal = row.value.length > 50 ? `${row.value.slice(0, 47)}...` : row.value;
    process.stdout.write(
      `  ${G}${row.name.padEnd(nameW)}${R}  ${truncVal.padEnd(valW + (truncVal.length - visLen(truncVal)))}  ${D}[${row.source}]${R}\n`,
    );
  }

  process.stdout.write(`\n  ${D}Blocked: ${blocked.length} vars${R}`);
  if (showAll && blocked.length > 0) {
    process.stdout.write(`\n\n  ${blocked.sort().join(', ')}`);
  }
  process.stdout.write('\n\n');
  process.stdout.write(`  Run ${C}mcp-exec env add <VAR>${R} to allow additional vars.\n\n`);
}

function envAdd(path: string, display: string, vars: string[]): void {
  if (vars.length === 0) {
    process.stderr.write(`Usage: mcp-exec env add <VAR> [<VAR>...]\n`);
    process.exit(1);
  }
  const current = getConfiguredAllow(path) ?? DEFAULT_ENV_ALLOW;
  const next = [...new Set([...current, ...vars])];
  setConfiguredAllow(path, next);
  const added = vars.filter((v) => !current.includes(v));
  process.stdout.write(
    `\n${G}✓${R} Added to allowlist in ${display}: ${added.map((v) => `${C}${v}${R}`).join(', ')}\n\n`,
  );
}

function envRemove(path: string, display: string, vars: string[]): void {
  if (vars.length === 0) {
    process.stderr.write(`Usage: mcp-exec env remove <VAR> [<VAR>...]\n`);
    process.exit(1);
  }
  const current = getConfiguredAllow(path) ?? DEFAULT_ENV_ALLOW;
  const next = current.filter((v) => !vars.includes(v));
  setConfiguredAllow(path, next);
  process.stdout.write(
    `\n${G}✓${R} Removed from allowlist in ${display}: ${vars.map((v) => `${C}${v}${R}`).join(', ')}\n\n`,
  );
}

function envShow(path: string, display: string): void {
  const configured = getConfiguredAllow(path);
  if (!configured) {
    process.stdout.write(
      `\n${D}No env allowlist configured in ${display}. Using built-in defaults:${R}\n\n  ${DEFAULT_ENV_ALLOW.join(', ')}\n\n`,
    );
  } else {
    process.stdout.write(`\n${B}Allowlist in ${display}:${R}\n\n  ${configured.join(', ')}\n\n`);
  }
}

function envReset(path: string, display: string): void {
  setConfiguredAllow(path, DEFAULT_ENV_ALLOW);
  process.stdout.write(
    `\n${G}✓${R} Reset allowlist in ${display} to defaults:\n\n  ${DEFAULT_ENV_ALLOW.join(', ')}\n\n`,
  );
}

// ── help ──────────────────────────────────────────────────────────────────────

function showHelp(): void {
  process.stdout.write(`
${B}mcp-exec${R} — sandboxed code execution + MCP tool search

${B}Usage:${R}
  ${C}mcp-exec${R}                   Start the MCP server (stdio transport)
  ${C}mcp-exec prime${R}             Add skill activation rule to ~/.claude/CLAUDE.md
  ${C}mcp-exec prime --local${R}     Add to ./CLAUDE.md instead
  ${C}mcp-exec env <subcommand>${R}  Manage the sandbox env var allowlist

${B}env subcommands:${R}
  ${C}mcp-exec env list${R}           Show vars passing through vs blocked
  ${C}mcp-exec env add <VAR...>${R}   Add to allowlist
  ${C}mcp-exec env remove <VAR...>${R} Remove from allowlist
  ${C}mcp-exec env show${R}           Print raw allowlist config
  ${C}mcp-exec env reset${R}          Reset to built-in defaults

  Add ${C}--local${R} to env commands to target .claude/settings.json (project-level).

`);
}

// ── dispatch ──────────────────────────────────────────────────────────────────

const [, , cmd, ...rest] = process.argv;

switch (cmd) {
  case undefined:
  case 'serve':
    // Start MCP server — backward compat: `npx @joeblackwaslike2/mcp-exec` in MCP configs
    await import('../src/server.js');
    break;
  case 'prime':
    runPrime(rest);
    break;
  case 'env':
    runEnv(rest);
    break;
  case '--help':
  case '-h':
  case 'help':
    showHelp();
    break;
  default:
    process.stderr.write(`Unknown command: ${cmd}\nRun 'mcp-exec --help' for usage.\n`);
    process.exit(1);
}
