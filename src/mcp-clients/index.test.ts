import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const mockConnect = vi.fn().mockResolvedValue(undefined);

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => ({})),
}));

import { connectMcpClients, readMcpConfig } from './index.js';

function makeTmpWithServers(servers: Record<string, { command: string; args?: string[] }>) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'mcp-exec-clients-test-'));
  const claudeDir = join(tmpDir, '.claude');
  mkdirSync(claudeDir);
  writeFileSync(join(claudeDir, 'mcp.json'), JSON.stringify({ mcpServers: servers }));
  return tmpDir;
}

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
  it('puts servers missing from mcp.json into unavailable (not a crash)', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'mcp-exec-clients-test-'));
    const result = await connectMcpClients(['gmail'], tmpDir);
    expect(Object.keys(result.clients)).toHaveLength(0);
    expect(result.unavailable).toHaveLength(1);
    expect(result.unavailable[0].server).toBe('gmail');
  });

  it('returns connected client in clients map', async () => {
    const tmpDir = makeTmpWithServers({
      gmail: { command: 'npx', args: ['-y', '@gargr/gmail-mcp'] },
    });
    const result = await connectMcpClients(['gmail'], tmpDir);
    expect(result.clients.gmail).toBeDefined();
    expect(result.unavailable).toHaveLength(0);
  });

  it('connects to multiple servers in parallel', async () => {
    const tmpDir = makeTmpWithServers({
      gmail: { command: 'npx', args: ['-y', '@gargr/gmail-mcp'] },
      gdrive: { command: 'npx', args: ['-y', '@gargr/gdrive-mcp'] },
    });
    const result = await connectMcpClients(['gmail', 'gdrive'], tmpDir);
    expect(Object.keys(result.clients)).toContain('gmail');
    expect(Object.keys(result.clients)).toContain('gdrive');
    expect(result.unavailable).toHaveLength(0);
  });

  it('puts servers missing from mcp.json into unavailable alongside successful ones', async () => {
    const tmpDir = makeTmpWithServers({
      gmail: { command: 'npx', args: ['-y', '@gargr/gmail-mcp'] },
    });
    const result = await connectMcpClients(['gmail', 'nonexistent'], tmpDir);
    expect(Object.keys(result.clients)).toContain('gmail');
    expect(result.unavailable).toHaveLength(1);
    expect(result.unavailable[0].server).toBe('nonexistent');
    expect(result.unavailable[0].status).toBe('unavailable');
  });

  it('puts servers that fail to connect into unavailable with reason', async () => {
    mockConnect.mockRejectedValueOnce(new Error('ENOENT: binary not found'));
    const tmpDir = makeTmpWithServers({
      slack: { command: 'slack-mcp', args: [] },
      github: { command: 'github-mcp', args: [] },
    });
    const result = await connectMcpClients(['slack', 'github'], tmpDir);
    const unavailableNames = result.unavailable.map((u) => u.server);
    expect(unavailableNames).toContain('slack');
    expect(result.unavailable.find((u) => u.server === 'slack')?.reason).toContain('ENOENT');
    expect(Object.keys(result.clients)).toContain('github');
  });

  it('returns all servers as unavailable when all connections fail', async () => {
    mockConnect.mockRejectedValue(new Error('connection refused'));
    const tmpDir = makeTmpWithServers({
      slack: { command: 'slack-mcp', args: [] },
    });
    const result = await connectMcpClients(['slack'], tmpDir);
    expect(Object.keys(result.clients)).toHaveLength(0);
    expect(result.unavailable).toHaveLength(1);
    mockConnect.mockResolvedValue(undefined);
  });
});
