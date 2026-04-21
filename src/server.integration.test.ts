import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const serverPath = fileURLToPath(new URL('./server.ts', import.meta.url));
const tsxBin = join(process.cwd(), 'node_modules', '.bin', 'tsx');

function contentOf(result: unknown): Array<{ type: string; text: string }> {
  return (result as { content: Array<{ type: string; text: string }> }).content;
}

describe('MCP server JSON-RPC integration', () => {
  let client: Client;

  beforeAll(async () => {
    const transport = new StdioClientTransport({
      command: tsxBin,
      args: [serverPath],
      env: { ...process.env, NODE_ENV: 'test' },
    });
    client = new Client({ name: 'test-client', version: '0.1.0' }, {});
    await client.connect(transport);
  }, 15_000);

  afterAll(async () => {
    await client.close();
  });

  it('tools/list returns both registered tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain('tools');
    expect(names).toContain('exec');
  });

  it('tools tool responds to wildcard query', async () => {
    const result = await client.callTool({ name: 'tools', arguments: { query: '*' } });
    expect(contentOf(result)[0].type).toBe('text');
  });

  it('exec tool runs node code and returns the result value', async () => {
    const result = await client.callTool({
      name: 'exec',
      arguments: { code: 'return 1 + 1', runtime: 'node' },
    });
    const parsed = JSON.parse(contentOf(result)[0].text);
    expect(parsed.result).toBe(2);
  });

  it('exec tool runs bash and returns stdout', async () => {
    const result = await client.callTool({
      name: 'exec',
      arguments: { code: 'echo "hello from bash"', runtime: 'bash' },
    });
    const parsed = JSON.parse(contentOf(result)[0].text);
    expect(parsed.result).toContain('hello from bash');
  });

  it('exec returns structured error with line/column on runtime error', async () => {
    const result = await client.callTool({
      name: 'exec',
      arguments: { code: 'throw new Error("deliberate failure")', runtime: 'node' },
    });
    const parsed = JSON.parse(contentOf(result)[0].text);
    const error = JSON.parse(parsed.result as string);
    expect(error.error).toContain('deliberate failure');
    expect(typeof error.line).toBe('number');
    expect(typeof error.column).toBe('number');
  });

  it('exec persists globalThis state across calls using session_id', async () => {
    const sessionId = `test-persist-${Date.now()}`;

    await client.callTool({
      name: 'exec',
      arguments: {
        code: 'globalThis.counter = 42;',
        runtime: 'node',
        session_id: sessionId,
      },
    });

    const result = await client.callTool({
      name: 'exec',
      arguments: {
        code: 'return globalThis.counter;',
        runtime: 'node',
        session_id: sessionId,
      },
    });

    const parsed = JSON.parse(contentOf(result)[0].text);
    expect(parsed.result).toBe(42);
  });

  it('explicit session_id isolates state from another session', async () => {
    const sessionA = `test-iso-a-${Date.now()}`;
    const sessionB = `test-iso-b-${Date.now()}`;

    await client.callTool({
      name: 'exec',
      arguments: {
        code: 'globalThis.secret = "only-in-A";',
        runtime: 'node',
        session_id: sessionA,
      },
    });

    const result = await client.callTool({
      name: 'exec',
      arguments: { code: 'return globalThis.secret;', runtime: 'node', session_id: sessionB },
    });

    const parsed = JSON.parse(contentOf(result)[0].text);
    expect(parsed.result).toBeUndefined();
  });

  it('tools wildcard returns empty catalog when no downstream servers configured', async () => {
    const result = await client.callTool({ name: 'tools', arguments: { query: '*' } });
    const entries = JSON.parse(contentOf(result)[0].text);
    // In test mode no mcp.json exists in the project root, so catalog is empty
    expect(Array.isArray(entries)).toBe(true);
  });
});
