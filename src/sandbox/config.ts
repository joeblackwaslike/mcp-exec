import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

interface SandboxRuntimeConfig {
  network?: { allowedDomains?: string[] };
  filesystem?: {
    allowWrite?: string[];
    denyRead?: string[];
    denyWrite?: string[];
    allowRead?: string[];
  };
}

interface CcSandboxBlock {
  network?: { allowedDomains?: string[] };
  filesystem?: {
    allowWrite?: string[];
    denyRead?: string[];
    denyWrite?: string[];
    allowRead?: string[];
  };
}

function readSandboxBlock(settingsPath: string): CcSandboxBlock {
  try {
    const raw = JSON.parse(readFileSync(settingsPath, 'utf8'));
    return (raw?.sandbox as CcSandboxBlock) ?? {};
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
  };
}
