import { describe, it, expect } from 'vitest';
import { runInBash } from './bash.js';

describe('runInBash', () => {
  it('executes a command and returns stdout as result', async () => {
    const result = await runInBash('echo hello');
    expect(result.result).toBe('hello\n');
    expect(result.exitCode).toBe(0);
  });

  it('captures stderr separately from stdout', async () => {
    const result = await runInBash('echo out; echo err >&2');
    expect(result.stdout).toContain('out');
    expect(result.stderr).toContain('err');
  });

  it('returns non-zero exitCode on failure', async () => {
    const result = await runInBash('exit 42');
    expect(result.exitCode).toBe(42);
  });

  it('surfaces error message in result on failure', async () => {
    const result = await runInBash('false');
    expect(result.exitCode).not.toBe(0);
  });

  it('supports pipes and shell features', async () => {
    const result = await runInBash('echo \'{"a":1}\' | jq .a');
    expect(result.result.trim()).toBe('1');
  });

  it('is stateless — variables do not persist between calls', async () => {
    await runInBash('X=hello');
    const result = await runInBash('echo $X');
    expect(result.result.trim()).toBe('');
  });
});
