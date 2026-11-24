import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const repoFile = (path: string) => new URL(`../${path}`, import.meta.url);
const readManifest = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(repoFile(path), 'utf8'));

const MANIFESTS = [
  ['.claude-plugin/plugin.json', 'mcpServers'],
  ['.cursor-plugin/plugin.json', 'mcpServers'],
  ['.gemini-plugin/gemini-extension.json', 'mcpServers'],
  ['.codex-plugin/plugin.json', 'mcp_servers'],
] as const;

describe('plugin manifests', () => {
  it.each(MANIFESTS)('%s registers mcp-exec under %s', (path, key) => {
    expect(readManifest(path)).toHaveProperty([key, 'mcp-exec', 'command'], 'npx');
    expect(readManifest(path)).toHaveProperty([key, 'mcp-exec', 'args']);
    expect(JSON.stringify(readManifest(path)[key])).toContain('@joeblackwaslike2/mcp-exec');
  });

  it('claude manifest has no legacy mcp.servers block or inline commands', () => {
    const manifest = readManifest('.claude-plugin/plugin.json');
    expect(manifest).not.toHaveProperty('mcp');
    expect(manifest).not.toHaveProperty('commands');
    expect(existsSync(repoFile('commands/mcp-exec-prime-skill.md'))).toBe(true);
  });

  it('every manifest and the server report the package.json version', () => {
    const { version } = readManifest('package.json');
    for (const [path] of MANIFESTS) {
      expect(readManifest(path)).toHaveProperty('version', version);
    }
    expect(readFileSync(repoFile('src/server.ts'), 'utf8')).toContain(`version: '${version}'`);
  });
});
