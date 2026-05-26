#!/usr/bin/env node
/**
 * Smoke test for the built mcp-exec package.
 *
 * Verifies the built binary (dist/) works correctly — not source via tsx.
 * Run via: just smoke  (which builds first, then runs this script)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const DIST_SERVER = join(root, 'dist/src/server.js');
const DIST_PRIME = join(root, 'dist/bin/prime-skill.js');

const _GREEN = '\x1b[32m';
const _RED = '\x1b[31m';
const _BOLD = '\x1b[1m';
const _DIM = '\x1b[2m';
const _RESET = '\x1b[0m';

let failures = 0;

function pass(_msg) {}

function fail(_msg) {
  failures++;
}

function section(_title) {}

function contentOf(result) {
  return result.content;
}

// ─── 1. Dist exists ───────────────────────────────────────────────────────────
section('1. Build output');

if (!existsSync(DIST_SERVER)) {
  process.exit(1);
}
if (!existsSync(DIST_PRIME)) {
  process.exit(1);
}
pass('dist/src/server.js');
pass('dist/bin/prime-skill.js');

// ─── 2. prime-skill CLI ───────────────────────────────────────────────────────
section('2. prime-skill CLI');

const tmpHome = mkdtempSync(join(tmpdir(), 'mcp-exec-smoke-'));
try {
  const out = execFileSync('node', [DIST_PRIME], {
    encoding: 'utf8',
    env: { ...process.env, HOME: tmpHome },
  });
  if (out.includes('mcp-exec plugin installed')) {
    pass('runs successfully and outputs expected banner');
  } else {
    fail(`unexpected output: ${out.slice(0, 120)}`);
  }

  // Idempotent: run a second time — should say "already primed"
  const out2 = execFileSync('node', [DIST_PRIME], {
    encoding: 'utf8',
    env: { ...process.env, HOME: tmpHome },
  });
  if (out2.includes('already primed')) {
    pass('idempotent: second run says "already primed — skipped"');
  } else {
    fail(`second run did not show idempotency message`);
  }
} catch (err) {
  fail(`prime-skill crashed: ${err.message}`);
} finally {
  rmSync(tmpHome, { recursive: true, force: true });
}

// ─── 3. MCP server JSON-RPC ───────────────────────────────────────────────────
section('3. MCP server (JSON-RPC over stdio)');

const transport = new StdioClientTransport({
  command: 'node',
  args: [DIST_SERVER],
  env: { ...process.env, NODE_ENV: 'test' },
  cwd: root,
});
const client = new Client({ name: 'smoke-test', version: '1.0.0' }, {});

try {
  await client.connect(transport);
  pass('server started and MCP handshake completed');

  // tools/list
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  if (names.includes('exec') && names.includes('tools')) {
    pass(`tools/list → [${names.join(', ')}]`);
  } else {
    fail(`tools/list missing expected tools. Got: [${names.join(', ')}]`);
  }

  // exec: node runtime
  const nodeResult = await client.callTool({
    name: 'exec',
    arguments: { code: 'return 1 + 1', runtime: 'node' },
  });
  const nodeParsed = JSON.parse(contentOf(nodeResult)[0].text);
  if (nodeParsed.result === 2) {
    pass('exec(node): `return 1 + 1` → 2');
  } else {
    fail(`exec(node): expected 2, got ${JSON.stringify(nodeParsed.result)}`);
  }

  // exec: bash runtime
  const bashResult = await client.callTool({
    name: 'exec',
    arguments: { code: 'echo "smoke-ok"', runtime: 'bash' },
  });
  const bashParsed = JSON.parse(contentOf(bashResult)[0].text);
  if (String(bashParsed.result).includes('smoke-ok')) {
    pass('exec(bash): `echo "smoke-ok"` → "smoke-ok"');
  } else {
    fail(`exec(bash): expected "smoke-ok", got ${JSON.stringify(bashParsed.result)}`);
  }

  // exec: node session persistence
  const sessionId = `smoke-persist-${Date.now()}`;
  await client.callTool({
    name: 'exec',
    arguments: { code: 'globalThis.__smoke = 99;', runtime: 'node', session_id: sessionId },
  });
  const persistResult = await client.callTool({
    name: 'exec',
    arguments: { code: 'return globalThis.__smoke;', runtime: 'node', session_id: sessionId },
  });
  const persistParsed = JSON.parse(contentOf(persistResult)[0].text);
  if (persistParsed.result === 99) {
    pass('exec(node): globalThis persists across calls within same session_id');
  } else {
    fail(
      `exec(node) session persistence: expected 99, got ${JSON.stringify(persistParsed.result)}`,
    );
  }

  // tools query
  const toolsResult = await client.callTool({ name: 'tools', arguments: { query: '*' } });
  const toolsContent = contentOf(toolsResult)[0];
  if (toolsContent.type === 'text') {
    pass('tools("*"): returns text response');
  } else {
    fail(`tools("*"): expected text content, got ${toolsContent.type}`);
  }
} catch (err) {
  fail(`MCP communication error: ${err.message}`);
} finally {
  await client.close().catch(() => {});
}
if (failures === 0) {
  process.exit(0);
} else {
  process.exit(1);
}
