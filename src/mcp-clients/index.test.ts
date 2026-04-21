import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => ({})),
}));

import { connectMcpClients, readMcpConfig } from './index.js';

describe('readMcpConfig', () => {
  it('returns empty object when mcp.json does not exist', () => {
    const config = readMcpConfig(join(tmpdir(), 'nonexistent-dir'));
    expect(config).toEqual({});
  });

  it('reads server configs from .claude/mcp.json', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'mcp-exec-clients-test-'));
    const claudeDir = join(tmpDir, '.claude');
    mkdirSync(claudeDir);
    writeFileSync(
      join(claudeDir, 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          gmail: { command: 'npx', args: ['-y', '@gargr/gmail-mcp'] },
        },
      }),
    );
    const config = readMcpConfig(tmpDir);
    expect(config.gmail).toMatchObject({ command: 'npx' });
  });

  it('handles malformed mcp.json without throwing', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'mcp-exec-clients-test-'));
    const claudeDir = join(tmpDir, '.claude');
    mkdirSync(claudeDir);
    writeFileSync(join(claudeDir, 'mcp.json'), 'not json');
    expect(() => readMcpConfig(tmpDir)).not.toThrow();
  });
});

describe('connectMcpClients', () => {
  function makeTmpWithServers(servers: Record<string, { command: string; args?: string[] }>) {
    const tmpDir = mkdtempSync(join(tmpdir(), 'mcp-exec-clients-test-'));
    const claudeDir = join(tmpDir, '.claude');
    mkdirSync(claudeDir);
    writeFileSync(join(claudeDir, 'mcp.json'), JSON.stringify({ mcpServers: servers }));
    return tmpDir;
  }

  it('returns empty map when requested servers are missing from mcp.json', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'mcp-exec-clients-test-'));
    const map = await connectMcpClients(['gmail'], tmpDir);
    expect(Object.keys(map)).toHaveLength(0);
  });

  it('connects to a server listed in mcp.json and returns it in the client map', async () => {
    const tmpDir = makeTmpWithServers({
      gmail: { command: 'npx', args: ['-y', '@gargr/gmail-mcp'] },
    });
    const map = await connectMcpClients(['gmail'], tmpDir);
    expect(Object.keys(map)).toContain('gmail');
    expect(map.gmail).toBeDefined();
  });

  it('connects to multiple servers in parallel', async () => {
    const tmpDir = makeTmpWithServers({
      gmail: { command: 'npx', args: ['-y', '@gargr/gmail-mcp'] },
      gdrive: { command: 'npx', args: ['-y', '@gargr/gdrive-mcp'] },
    });
    const map = await connectMcpClients(['gmail', 'gdrive'], tmpDir);
    expect(Object.keys(map)).toContain('gmail');
    expect(Object.keys(map)).toContain('gdrive');
  });

  it('skips servers not found in mcp.json without failing', async () => {
    const tmpDir = makeTmpWithServers({
      gmail: { command: 'npx', args: ['-y', '@gargr/gmail-mcp'] },
    });
    const map = await connectMcpClients(['gmail', 'nonexistent'], tmpDir);
    expect(Object.keys(map)).toContain('gmail');
    expect(Object.keys(map)).not.toContain('nonexistent');
  });
});
