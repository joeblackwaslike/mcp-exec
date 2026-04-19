import { describe, it, expect, beforeEach } from 'vitest';
import { runInNode } from './node.js';
import { SessionManager } from '../session.js';

describe('runInNode', () => {
  let sessions: SessionManager;

  beforeEach(() => {
    sessions = new SessionManager();
  });

  it('executes code and returns the return value as result', async () => {
    const result = await runInNode('return "hello";', sessions.getOrCreate());
    expect(result.result).toBe('hello');
    expect(result.exitCode).toBe(0);
  });

  it('captures stdout in the stdout field', async () => {
    const result = await runInNode(
      'process.stdout.write("hi\\n"); return "done";',
      sessions.getOrCreate(),
    );
    expect(result.stdout).toContain('hi');
    expect(result.result).toBe('done');
  });

  it('handles async code with await', async () => {
    const result = await runInNode(
      'const x = await Promise.resolve(42); return x;',
      sessions.getOrCreate(),
    );
    expect(result.result).toBe(42);
  });

  it('captures thrown errors in result.result with adjusted line numbers', async () => {
    const result = await runInNode('throw new Error("boom");', sessions.getOrCreate());
    expect(result.exitCode).toBe(1);
    expect(result.result).toMatch(/boom/);
    // Line should be 1, not 2 (preamble offset subtracted)
    expect(result.result).toMatch(/"line":1/);
  });

  it('globalThis state persists across calls to the same context', async () => {
    const ctx = sessions.getOrCreate('persist-test');
    await runInNode('globalThis.counter = 1;', ctx);
    const result = await runInNode('return globalThis.counter;', ctx);
    expect(result.result).toBe(1);
  });

  it('state does not bleed between different contexts', async () => {
    const ctx1 = sessions.getOrCreate('ctx1');
    const ctx2 = sessions.getOrCreate('ctx2');
    await runInNode('globalThis.secret = "a";', ctx1);
    const result = await runInNode('return globalThis.secret;', ctx2);
    expect(result.result).toBeUndefined();
  });
});
