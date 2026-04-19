#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SKILL_BLOCK = `
## Important

Load the \`using-mcp-exec\` skill always. Better to load and not need it than to need
it and not have it.
`.trimStart();

const MARKER = 'Load the `using-mcp-exec` skill always';

function installSkill(targetPath: string): void {
  let existing = '';
  if (existsSync(targetPath)) {
    existing = readFileSync(targetPath, 'utf8');
  }

  if (existing.includes(MARKER)) {
    return;
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  writeFileSync(targetPath, existing + separator + SKILL_BLOCK);
}

const isLocal = process.argv.includes('--local');
const targetPath = isLocal
  ? join(process.cwd(), 'CLAUDE.md')
  : join(homedir(), '.claude', 'CLAUDE.md');

installSkill(targetPath);
