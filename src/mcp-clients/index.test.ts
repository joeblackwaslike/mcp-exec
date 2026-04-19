import { describe, it, expect } from 'vitest';
import { readMcpConfig } from './index.js';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

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
    expect(config['gmail']).toMatchObject({ command: 'npx' });
  });

  it('handles malformed mcp.json without throwing', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'mcp-exec-clients-test-'));
    const claudeDir = join(tmpDir, '.claude');
    mkdirSync(claudeDir);
    writeFileSync(join(claudeDir, 'mcp.json'), 'not json');
    expect(() => readMcpConfig(tmpDir)).not.toThrow();
  });
});
