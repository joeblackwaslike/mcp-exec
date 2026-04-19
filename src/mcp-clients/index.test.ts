import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readMcpConfig } from './index.js';

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
