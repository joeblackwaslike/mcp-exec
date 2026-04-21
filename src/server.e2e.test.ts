/**
 * E2E tests: spins up the echo-server fixture as a real downstream MCP server,
 * configures mcp-exec to connect to it via a temp mcp.json, and exercises the
 * full stack — tool discovery, unavailable server handling, exec+import path.
 *
 * Uses SKIP_SANDBOX=1 (not NODE_ENV=test) so loader hooks ARE registered,
 * enabling `import 'mcp/echo-fixture'` inside exec() to resolve.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const serverPath = fileURLToPath(new URL('./server.ts', import.meta.url));
const echoFixturePath = fileURLToPath(new URL('../test/fixtures/echo-server.ts', import.meta.url));
const tsxBin = join(process.cwd(), 'node_modules', '.bin', 'tsx');

function contentOf(result: unknown): Array<{ type: string; text: string }> {
  return (result as { content: Array<{ type: string; text: string }> }).content;
}

function makeTmpProjectDir(mcpServers: Record<string, { command: string; args: string[] }>) {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-exec-e2e-'));
  mkdirSync(join(dir, '.claude'));
  writeFileSync(join(dir, '.claude', 'mcp.json'), JSON.stringify({ mcpServers }));
  return dir;
}

describe('E2E: mcp-exec with real downstream echo server', () => {
  let client: Client;
  let projectDir: string;

  beforeAll(async () => {
    projectDir = makeTmpProjectDir({
      'echo-fixture': { command: tsxBin, args: [echoFixturePath] },
    });

    const transport = new StdioClientTransport({
      command: tsxBin,
      args: [serverPath],
      env: {
        ...process.env,
        SKIP_SANDBOX: '1',
      },
      cwd: projectDir,
    });
    client = new Client({ name: 'e2e-client', version: '1.0.0' }, {});
    await client.connect(transport);
  }, 20_000);

  afterAll(async () => {
    await client.close();
  });

  it('tools("*") returns tools discovered from the echo fixture server', async () => {
    const result = await client.callTool({ name: 'tools', arguments: { query: '*' } });
    const entries = JSON.parse(contentOf(result)[0].text) as { name?: string; server?: string }[];
    const toolNames = entries.filter((e) => e.name).map((e) => e.name);
    expect(toolNames).toContain('echo');
    expect(toolNames).toContain('add');
  });

  it('tools("echo") filters to matching tools by name', async () => {
    const result = await client.callTool({ name: 'tools', arguments: { query: 'echo' } });
    const entries = JSON.parse(contentOf(result)[0].text) as { name?: string }[];
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => !e.name || e.name.includes('echo'))).toBe(true);
  });

  it('tools("*") includes unavailable entry for a server that could not connect', async () => {
    const dirWithBadServer = makeTmpProjectDir({
      'echo-fixture': { command: tsxBin, args: [echoFixturePath] },
      'dead-server': { command: '/nonexistent/dead-mcp-binary', args: [] },
    });

    const transport = new StdioClientTransport({
      command: tsxBin,
      args: [serverPath],
      env: { ...process.env, SKIP_SANDBOX: '1' },
      cwd: dirWithBadServer,
    });
    const tempClient = new Client({ name: 'e2e-unavailable-test', version: '1.0.0' }, {});
    await tempClient.connect(transport);

    const result = await tempClient.callTool({ name: 'tools', arguments: { query: '*' } });
    const entries = JSON.parse(contentOf(result)[0].text) as { server?: string; status?: string }[];
    const unavailable = entries.filter((e) => e.status === 'unavailable');
    expect(unavailable.some((e) => e.server === 'dead-server')).toBe(true);

    await tempClient.close();
  }, 15_000);

  // Note: `import 'mcp/server'` inside exec() requires compiled JS (module.register()
  // workers don't inherit tsx transforms). The loader is covered by unit tests in
  // src/loader/. Here we test the downstream call path via globalThis.__mcpClients,
  // which is what the loader-generated shims delegate to at runtime.

  it('exec() calls downstream tool via globalThis.__mcpClients', async () => {
    const result = await client.callTool({
      name: 'exec',
      arguments: {
        code: `return await globalThis.__mcpClients['echo-fixture'].callTool('echo', { message: 'hello e2e' });`,
        runtime: 'node',
      },
    });
    const parsed = JSON.parse(contentOf(result)[0].text);
    expect(JSON.stringify(parsed.result)).toContain('hello e2e');
  });

  it('exec() can call multiple downstream tools in one script', async () => {
    const result = await client.callTool({
      name: 'exec',
      arguments: {
        code: `
          const sum = await globalThis.__mcpClients['echo-fixture'].callTool('add', { a: 21, b: 21 });
          return sum;
        `,
        runtime: 'node',
      },
    });
    const parsed = JSON.parse(contentOf(result)[0].text);
    expect(JSON.stringify(parsed.result)).toContain('42');
  });

  it('exec() downstream callTool error surfaces as structured { error, line, column }', async () => {
    const result = await client.callTool({
      name: 'exec',
      arguments: {
        code: `return await globalThis.__mcpClients['echo-fixture'].callTool('nonexistent-tool', {});`,
        runtime: 'node',
      },
    });
    const parsed = JSON.parse(contentOf(result)[0].text);
    const error = JSON.parse(parsed.result as string);
    expect(error.error).toBeDefined();
    expect(typeof error.line).toBe('number');
  });
});
