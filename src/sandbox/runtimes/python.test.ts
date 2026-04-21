import { describe, expect, it } from 'vitest';
import { runInPython } from './python.js';

describe('runInPython', () => {
  it('executes a script and returns stdout as result', async () => {
    const result = await runInPython('print("hello")');
    expect(result.result).toBe('hello\n');
    expect(result.exitCode).toBe(0);
  });

  it('captures stderr separately from stdout', async () => {
    const result = await runInPython('import sys; print("out"); print("err", file=sys.stderr)');
    expect(result.stdout).toContain('out');
    expect(result.stderr).toContain('err');
  });

  it('returns non-zero exitCode on failure', async () => {
    const result = await runInPython('raise ValueError("boom")');
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('ValueError');
  });

  it('is stateless — variables do not persist between calls', async () => {
    await runInPython('x = 42');
    const result = await runInPython('print(x)');
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('NameError');
  });

  it('kills long-running scripts and returns exitCode 124', async () => {
    const result = await runInPython('import time; time.sleep(10)', { timeout: 200 });
    expect(result.exitCode).toBe(124);
  }, 5_000);

  it('supports PEP 723 inline dependencies', async () => {
    const code = [
      '# /// script',
      '# dependencies = ["requests"]',
      '# ///',
      'import requests',
      'print("ok")',
    ].join('\n');
    const result = await runInPython(code);
    expect(result.result).toBe('ok\n');
    expect(result.exitCode).toBe(0);
  }, 30_000);

  it('returns empty tool_calls array', async () => {
    const result = await runInPython('print("x")');
    expect(result.tool_calls).toEqual([]);
  });
});
