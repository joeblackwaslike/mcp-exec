import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_ENV_ALLOW = [
  'PATH',
  'HOME',
  'TMPDIR',
  'TMP',
  'TEMP',
  'USER',
  'USERNAME',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'NODE_PATH',
  'SHELL',
];

interface SandboxRuntimeConfig {
  network?: { allowedDomains?: string[] };
  filesystem?: {
    allowWrite?: string[];
    denyRead?: string[];
    denyWrite?: string[];
    allowRead?: string[];
  };
  env?: { allow: string[] };
}

interface CcSandboxBlock {
  network?: { allowedDomains?: string[] };
  filesystem?: {
    allowWrite?: string[];
    denyRead?: string[];
    denyWrite?: string[];
    allowRead?: string[];
  };
  env?: { allow?: string[] };
}

function readSandboxBlock(settingsPath: string, nested = true): CcSandboxBlock {
  try {
    const raw = JSON.parse(readFileSync(settingsPath, 'utf8'));
    return ((nested ? raw?.sandbox : raw) as CcSandboxBlock) ?? {};
  } catch {
    return {};
  }
}

function mergeArrays(...arrays: (string[] | undefined)[]): string[] {
  return [...new Set(arrays.flat().filter((x): x is string => x != null))];
}

/**
 * Reads the sandbox block from user (~/.claude/settings.json) and project
 * (.claude/settings.json) CC config files and maps to SandboxRuntimeConfig.
 *
 * @param cwd - Project root directory (defaults to process.cwd())
 */
export function resolveSandboxConfig(cwd = process.cwd()): SandboxRuntimeConfig {
  const userSettings = join(homedir(), '.claude', 'settings.json');
  const projectSettings = join(cwd, '.claude', 'settings.json');

  const user = readSandboxBlock(userSettings);
  const project = readSandboxBlock(projectSettings);

  const configuredAllow = mergeArrays(user.env?.allow, project.env?.allow);

  return {
    network: {
      allowedDomains: mergeArrays(user.network?.allowedDomains, project.network?.allowedDomains),
    },
    filesystem: {
      allowWrite: mergeArrays(user.filesystem?.allowWrite, project.filesystem?.allowWrite, [
        '~/.mcp-exec/sessions',
      ]),
      denyRead: mergeArrays(user.filesystem?.denyRead, project.filesystem?.denyRead),
      denyWrite: mergeArrays(user.filesystem?.denyWrite, project.filesystem?.denyWrite),
      allowRead: mergeArrays(user.filesystem?.allowRead, project.filesystem?.allowRead),
    },
    env: {
      allow: configuredAllow.length > 0 ? configuredAllow : DEFAULT_ENV_ALLOW,
    },
  };
}

export type CodexSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';

export interface CodexConfig {
  sandboxMode: CodexSandboxMode | undefined;
  writableRoots: string[];
}

function readFileText(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function extractTomlString(toml: string, key: string): string | undefined {
  return new RegExp(String.raw`\b${key}\s*=\s*"([^"]*)"`, 'm').exec(toml)?.[1];
}

function extractTomlStringArray(toml: string, key: string): string[] {
  const m = new RegExp(String.raw`\b${key}\s*=\s*\[([^\]]*)\]`, 'ms').exec(toml);
  if (!m?.[1]) return [];
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

/**
 * Reads sandbox-relevant keys from Codex config.toml files (user + project).
 * Used for diagnostics when mcp-exec is running under Codex's native sandbox.
 */
export function resolveCodexConfig(cwd = process.cwd()): CodexConfig {
  const combined = [
    readFileText(join(homedir(), '.codex', 'config.toml')),
    readFileText(join(cwd, '.codex', 'config.toml')),
  ].join('\n');

  const rawMode = extractTomlString(combined, 'sandbox_mode');
  const sandboxMode: CodexSandboxMode | undefined =
    rawMode === 'read-only' || rawMode === 'workspace-write' || rawMode === 'danger-full-access'
      ? rawMode
      : undefined;

  return {
    sandboxMode,
    writableRoots: extractTomlStringArray(combined, 'writable_roots'),
  };
}

/** Returns true when mcp-exec is running under Codex's native sandbox. */
export function isCodexRuntime(): boolean {
  return process.env.MCP_EXEC_RUNTIME === 'codex';
}

/**
 * Reads sandbox config from ~/.srt-settings.json (user) and .srt-settings.json (project).
 * Used when mcp-exec is running under OpenCode, which does not provide its own sandbox.
 * The file format is the SandboxRuntimeConfig shape directly (no nesting under "sandbox").
 */
export function resolveOpenCodeConfig(cwd = process.cwd()): SandboxRuntimeConfig {
  const userSettings = join(homedir(), '.srt-settings.json');
  const projectSettings = join(cwd, '.srt-settings.json');

  const user = readSandboxBlock(userSettings, false);
  const project = readSandboxBlock(projectSettings, false);

  const configuredAllow = mergeArrays(user.env?.allow, project.env?.allow);

  return {
    network: {
      allowedDomains: mergeArrays(user.network?.allowedDomains, project.network?.allowedDomains),
    },
    filesystem: {
      allowWrite: mergeArrays(user.filesystem?.allowWrite, project.filesystem?.allowWrite, [
        '~/.mcp-exec/sessions',
      ]),
      denyRead: mergeArrays(user.filesystem?.denyRead, project.filesystem?.denyRead),
      denyWrite: mergeArrays(user.filesystem?.denyWrite, project.filesystem?.denyWrite),
      allowRead: mergeArrays(user.filesystem?.allowRead, project.filesystem?.allowRead),
    },
    env: {
      allow: configuredAllow.length > 0 ? configuredAllow : DEFAULT_ENV_ALLOW,
    },
  };
}

/** Returns true when mcp-exec is running under OpenCode. */
export function isOpenCodeRuntime(): boolean {
  return process.env.MCP_EXEC_RUNTIME === 'opencode';
}

export interface GeminiConfig {
  sandboxEnabled: boolean;
  sandboxType: string | undefined;
}

/**
 * Detects whether Gemini's native sandbox is active by checking the GEMINI_SANDBOX
 * env var (set by Gemini when sandbox mode is enabled) and ~/.gemini/settings.json.
 * Used for diagnostic logging only — Gemini enforces the sandbox at the OS level.
 */
export function resolveGeminiConfig(cwd = process.cwd()): GeminiConfig {
  const sandboxEnv = process.env.GEMINI_SANDBOX;
  if (sandboxEnv && sandboxEnv !== 'false' && sandboxEnv !== '0') {
    return { sandboxEnabled: true, sandboxType: sandboxEnv === 'true' ? 'auto' : sandboxEnv };
  }

  for (const settingsPath of [
    join(cwd, '.gemini', 'settings.json'),
    join(homedir(), '.gemini', 'settings.json'),
  ]) {
    try {
      const raw = JSON.parse(readFileSync(settingsPath, 'utf8'));
      if (raw?.tools?.sandbox === true || raw?.sandbox === true) {
        return { sandboxEnabled: true, sandboxType: 'settings' };
      }
    } catch {
      // file absent or malformed — continue
    }
  }

  return { sandboxEnabled: false, sandboxType: undefined };
}

/** Returns true when mcp-exec is running under Gemini CLI. */
export function isGeminiRuntime(): boolean {
  return process.env.MCP_EXEC_RUNTIME === 'gemini';
}

/**
 * Reads sandbox config from ~/.cursor/srt-settings.json (user) and
 * .cursor/srt-settings.json (project).
 * Used when mcp-exec is running under Cursor, which provides no native MCP sandbox.
 * Format is identical to SandboxRuntimeConfig (top-level, not nested under "sandbox").
 */
export function resolveCursorConfig(cwd = process.cwd()): SandboxRuntimeConfig {
  const userSettings = join(homedir(), '.cursor', 'srt-settings.json');
  const projectSettings = join(cwd, '.cursor', 'srt-settings.json');

  const user = readSandboxBlock(userSettings, false);
  const project = readSandboxBlock(projectSettings, false);

  const configuredAllow = mergeArrays(user.env?.allow, project.env?.allow);

  return {
    network: {
      allowedDomains: mergeArrays(user.network?.allowedDomains, project.network?.allowedDomains),
    },
    filesystem: {
      allowWrite: mergeArrays(user.filesystem?.allowWrite, project.filesystem?.allowWrite, [
        '~/.mcp-exec/sessions',
      ]),
      denyRead: mergeArrays(user.filesystem?.denyRead, project.filesystem?.denyRead),
      denyWrite: mergeArrays(user.filesystem?.denyWrite, project.filesystem?.denyWrite),
      allowRead: mergeArrays(user.filesystem?.allowRead, project.filesystem?.allowRead),
    },
    env: {
      allow: configuredAllow.length > 0 ? configuredAllow : DEFAULT_ENV_ALLOW,
    },
  };
}

/** Returns true when mcp-exec is running under Cursor. */
export function isCursorRuntime(): boolean {
  return process.env.MCP_EXEC_RUNTIME === 'cursor';
}

/** Filters process.env down to only the allowed variable names. */
export function filterEnv(
  env: NodeJS.ProcessEnv,
  allow: string[],
  extra?: Record<string, string>,
): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const key of allow) {
    if (env[key] != null) filtered[key] = env[key] as string;
  }
  return { ...filtered, ...extra };
}
