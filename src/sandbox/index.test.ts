import { describe, expect, it } from 'vitest';
import { createExecDispatcher } from './index.js';
import { SessionManager } from './session.js';

describe('createExecDispatcher', () => {
  it('routes "node" runtime to Node.js execution', async () => {
    const sessions = new SessionManager();
    const exec = createExecDispatcher(sessions, {});
    const result = await exec({ code: 'return 42;', runtime: 'node' });
    expect(result.result).toBe(42);
    expect(result.exitCode).toBe(0);
  });

  it('routes "bash" runtime to Bash execution', async () => {
    const sessions = new SessionManager();
    const exec = createExecDispatcher(sessions, {});
    const result = await exec({ code: 'echo hi', runtime: 'bash' });
    expect(result.result).toContain('hi');
  });

  it('accepts config object with type field', async () => {
    const sessions = new SessionManager();
    const exec = createExecDispatcher(sessions, {});
    const result = await exec({ code: 'return "ok";', runtime: { type: 'node' } });
    expect(result.result).toBe('ok');
  });

  it('passes env overrides to bash runtime', async () => {
    const sessions = new SessionManager();
    const exec = createExecDispatcher(sessions, {});
    const result = await exec({
      code: 'echo $TESTVAR',
      runtime: { type: 'bash', env: { TESTVAR: 'injected' } },
    });
    expect(result.result).toContain('injected');
  });

  it('throws on unsupported runtime type', async () => {
    const sessions = new SessionManager();
    const exec = createExecDispatcher(sessions, {});
    // biome-ignore lint/suspicious/noExplicitAny: testing unsupported runtime rejection
    await expect(exec({ code: 'print("hi")', runtime: 'python' as any })).rejects.toThrow(
      'Unsupported runtime: python',
    );
  });
});
