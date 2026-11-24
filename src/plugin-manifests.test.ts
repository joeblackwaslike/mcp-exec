import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readManifest = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));

describe('plugin manifests', () => {
  it.each([
    ['.claude-plugin/plugin.json', 'mcpServers'],
    ['.cursor-plugin/plugin.json', 'mcpServers'],
    ['.gemini-plugin/gemini-extension.json', 'mcpServers'],
    ['.codex-plugin/plugin.json', 'mcp_servers'],
  ])('%s registers mcp-exec under %s', (path, key) => {
    expect(Object.keys(readManifest(path)[key] as object)).toContain('mcp-exec');
  });

  it('claude manifest has no legacy mcp.servers block', () => {
    expect(readManifest('.claude-plugin/plugin.json')).not.toHaveProperty('mcp');
  });
});
