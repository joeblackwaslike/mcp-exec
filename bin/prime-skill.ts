#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

const MARKER = '`mcp-exec` — sandboxed execution + MCP tool search';

const SKILL_BLOCK = `\
## Skill Activations

### \`mcp-exec\` — sandboxed execution + MCP tool search

Activate the \`using-mcp-exec\` skill when you are about to:
- Call 2+ MCP tools in sequence where intermediate results don't need to stay in context
- Do multi-step research, data aggregation, or schema processing
- Fan out across multiple sources and return a single summary

Tools added: \`tools(query)\` (trimmed MCP catalog search) and \`exec(code, runtime)\` (sandboxed
Node/Bash/Python — only final output returned). See the skill for import syntax and examples.
`;

function prime(targetPath: string): 'added' | 'exists' {
  let existing = '';
  if (existsSync(targetPath)) {
    existing = readFileSync(targetPath, 'utf8');
  } else {
    mkdirSync(dirname(targetPath), { recursive: true });
  }

  if (existing.includes(MARKER)) return 'exists';

  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  writeFileSync(targetPath, existing + separator + SKILL_BLOCK);
  return 'added';
}

const args = process.argv.slice(2);
const scopeIdx = args.indexOf('--scope');
const scopeVal = scopeIdx !== -1 ? args[scopeIdx + 1] : undefined;
const isProject = args.includes('--local') || scopeVal === 'project';

const targetPath = isProject
  ? join(process.cwd(), 'CLAUDE.md')
  : join(homedir(), '.claude', 'CLAUDE.md');

const displayPath = isProject ? './CLAUDE.md' : '~/.claude/CLAUDE.md';
const altScope = isProject ? 'user' : 'project';
const altFile = isProject ? '~/.claude/CLAUDE.md' : './CLAUDE.md';

const result = prime(targetPath);
const statusLabel =
  result === 'exists' ? `${DIM}already primed — skipped${RESET}` : `${GREEN}primed${RESET}`;

process.stdout.write(`
${BOLD}mcp-exec plugin installed${RESET}
  ${GREEN}✓${RESET} mcp    mcp-exec (sandboxed exec + MCP tool search)
  ${GREEN}✓${RESET} skill  using-mcp-exec
  ${GREEN}✓${RESET} skill  dev-workflow
  ${GREEN}✓${RESET} cli    mcp-exec-prime-skill

${displayPath}  ${statusLabel}

${YELLOW}NOTE: Skills must be primed to activate reliably. This added a CLAUDE.md rule that
tells the model when to load the using-mcp-exec skill (~90-95% vs ~40% with skills alone).

  Run /mcp-exec:prime-skill --scope ${altScope} to prime ${altFile} instead.${RESET}

EXAMPLE rule added to ${displayPath}:

  ## Skill Activations
  ### \`mcp-exec\` — sandboxed execution + MCP tool search
  Activate the \`using-mcp-exec\` skill when you are about to:
  - Call 2+ MCP tools in sequence (intermediate results stay out of context)
  - Do multi-step research, data aggregation, or schema processing
  - Fan out across sources and return a single summary
  ...

`);
