#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

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
    console.log(`[mcp-exec] Skill loader already present in ${targetPath} — skipping.`);
    return;
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  writeFileSync(targetPath, existing + separator + SKILL_BLOCK);
  console.log(`[mcp-exec] Skill loader appended to ${targetPath}`);
}

const isLocal = process.argv.includes('--local');
const targetPath = isLocal
  ? join(process.cwd(), 'CLAUDE.md')
  : join(homedir(), '.claude', 'CLAUDE.md');

installSkill(targetPath);
