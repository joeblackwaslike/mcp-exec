import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AffectedHook,
  findAffectedHooks,
  type HookEntry,
  main,
  readJsonFile,
} from './check-plugins.js';

const serverNames = ['github', 'gdrive', 'slack'];

function makeHooks(event: string, matcher: string): Record<string, HookEntry[]> {
  return {
    [event]: [{ matcher, hooks: [{ type: 'command', command: 'echo test' }] }],
  };
}

describe('findAffectedHooks', () => {
  it('returns empty when hooks object is empty', () => {
    expect(findAffectedHooks({}, serverNames)).toHaveLength(0);
  });

  it('ignores non-PreToolUse/PostToolUse events', () => {
    const hooks = makeHooks('SessionStart', 'github__listPullRequests');
    expect(findAffectedHooks(hooks, serverNames)).toHaveLength(0);
  });

  it('flags PreToolUse hook whose matcher contains a server name', () => {
    const hooks = makeHooks('PreToolUse', 'github__listPullRequests');
    const results = findAffectedHooks(hooks, serverNames);
    expect(results).toHaveLength(1);
    expect(results[0].event).toBe('PreToolUse');
    expect(results[0].matcher).toBe('github__listPullRequests');
    expect(results[0].matchedServer).toBe('github');
  });

  it('flags PostToolUse hook with a server name pattern', () => {
    const hooks = makeHooks('PostToolUse', 'slack__.*');
    const results = findAffectedHooks(hooks, serverNames);
    expect(results).toHaveLength(1);
    expect(results[0].matchedServer).toBe('slack');
  });

  it('does not flag hooks with matchers that do not reference any server name', () => {
    const hooks = makeHooks('PreToolUse', 'Read|Edit|Write|Bash');
    expect(findAffectedHooks(hooks, serverNames)).toHaveLength(0);
  });

  it('does not flag wildcard * matchers (not specifically targeting downstream tools)', () => {
    const hooks = makeHooks('PreToolUse', '*');
    expect(findAffectedHooks(hooks, serverNames)).toHaveLength(0);
  });

  it('does not flag a server name that is a substring of another (e.g. "git" vs "github")', () => {
    const hooks = makeHooks('PreToolUse', 'github__createIssue');
    expect(findAffectedHooks(hooks, ['git'])).toHaveLength(0);
  });

  it('flags multiple hooks across events', () => {
    const hooks = {
      PreToolUse: [
        { matcher: 'github__createIssue', hooks: [{ type: 'command', command: 'echo a' }] },
      ],
      PostToolUse: [
        { matcher: 'gdrive__searchFiles', hooks: [{ type: 'command', command: 'echo b' }] },
      ],
    };
    const results = findAffectedHooks(hooks, serverNames);
    expect(results).toHaveLength(2);
    expect(results.map((r: AffectedHook) => r.event)).toContain('PreToolUse');
    expect(results.map((r: AffectedHook) => r.event)).toContain('PostToolUse');
  });

  it('reports the commands from the affected hook entry', () => {
    const hooks = makeHooks('PreToolUse', 'github__listPullRequests');
    const results = findAffectedHooks(hooks, serverNames);
    expect(results[0].commands).toContain('echo test');
  });
});

describe('readJsonFile', () => {
  it('returns empty object for nonexistent file', () => {
    expect(readJsonFile('/nonexistent/path/file.json')).toEqual({});
  });

  it('returns empty object for malformed JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'check-plugins-test-'));
    const file = join(dir, 'bad.json');
    writeFileSync(file, 'not json');
    expect(readJsonFile(file)).toEqual({});
  });

  it('parses valid JSON file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'check-plugins-test-'));
    const file = join(dir, 'good.json');
    writeFileSync(file, JSON.stringify({ key: 'value' }));
    expect(readJsonFile(file)).toEqual({ key: 'value' });
  });
});

describe('main', () => {
  let capturedOutput: string;
  let tmpDir: string;

  beforeEach(() => {
    capturedOutput = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      capturedOutput += chunk;
      return true;
    });
    tmpDir = mkdtempSync(join(tmpdir(), 'check-plugins-main-test-'));
    mkdirSync(join(tmpDir, '.claude'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints no-servers message when mcp.json has no servers', () => {
    writeFileSync(join(tmpDir, '.claude', 'mcp.json'), JSON.stringify({ mcpServers: {} }));
    main(tmpDir);
    expect(capturedOutput).toContain('no downstream MCP servers found');
  });

  it('prints clean report when no hooks match', () => {
    writeFileSync(
      join(tmpDir, '.claude', 'mcp.json'),
      JSON.stringify({ mcpServers: { github: { command: 'gh-mcp' } } }),
    );
    writeFileSync(
      join(tmpDir, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo ok' }] }],
        },
      }),
    );
    main(tmpDir);
    expect(capturedOutput).toContain('no compatibility issues found');
  });

  it('prints warning with hook details when downstream server is matched', () => {
    writeFileSync(
      join(tmpDir, '.claude', 'mcp.json'),
      JSON.stringify({ mcpServers: { github: { command: 'gh-mcp' } } }),
    );
    writeFileSync(
      join(tmpDir, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: 'github__listPullRequests',
              hooks: [{ type: 'command', command: 'echo hook fired' }],
            },
          ],
        },
      }),
    );
    main(tmpDir);
    expect(capturedOutput).toContain('1 hook(s)');
    expect(capturedOutput).toContain('github__listPullRequests');
    expect(capturedOutput).toContain('echo hook fired');
  });

  it('truncates long commands to 80 chars in output', () => {
    const longCmd = 'x'.repeat(100);
    writeFileSync(
      join(tmpDir, '.claude', 'mcp.json'),
      JSON.stringify({ mcpServers: { github: { command: 'gh-mcp' } } }),
    );
    writeFileSync(
      join(tmpDir, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: 'github__createIssue',
              hooks: [{ type: 'command', command: longCmd }],
            },
          ],
        },
      }),
    );
    main(tmpDir);
    expect(capturedOutput).toContain('...');
    expect(capturedOutput).not.toContain(longCmd);
  });
});
