import { beforeEach, describe, expect, it } from 'vitest';
import { SessionManager } from '../session.js';
import { runInNode } from './node.js';

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
    const result = await runInNode('console.log("hi"); return "done";', sessions.getOrCreate());
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

  it('adjusts line numbers for host-realm Error instances thrown inside the vm', async () => {
    // vm.runInContext uses a separate realm, so `new Error()` inside vm code fails
    // `instanceof Error` in the host. Injecting the host Error class lets us test the
    // adjustLineNumber path (lines 10-12, 62) which is otherwise unreachable.
    const ctx = sessions.getOrCreate('host-error-realm');
    ctx.HostError = Error;
    const result = await runInNode('throw new HostError("host realm error");', ctx);
    expect(result.exitCode).toBe(1);
    expect(result.result).toMatch(/host realm error/);
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
