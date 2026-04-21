import { describe, expect, it } from 'vitest';
import { findAffectedHooks, type HookEntry } from './check-plugins.js';

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
    expect(results.map((r) => r.event)).toContain('PreToolUse');
    expect(results.map((r) => r.event)).toContain('PostToolUse');
  });

  it('reports the commands from the affected hook entry', () => {
    const hooks = makeHooks('PreToolUse', 'github__listPullRequests');
    const results = findAffectedHooks(hooks, serverNames);
    expect(results[0].commands).toContain('echo test');
  });
});
