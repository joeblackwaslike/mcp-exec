import { describe, expect, it, vi } from 'vitest';
import { BridgeServer } from '../../bridge/server.js';
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
    const first = await runInPython('x = 42\nprint("set")');
    expect(first.exitCode).toBe(0);
    expect(first.stdout).toContain('set');
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

  it('returns empty tool_calls array when no bridge provided', async () => {
    const result = await runInPython('print("x")');
    expect(result.tool_calls).toEqual([]);
  });

  it('exposes mcp.* imports and captures tool_calls when bridge is provided', async () => {
    const mockResult = { id: 1, title: 'Test PR' };
    const mockClient = { callTool: vi.fn().mockResolvedValue(mockResult) };
    const bridge = new BridgeServer({ github: mockClient });
    await bridge.start();

    try {
      const code = [
        'from mcp.github import list_pull_requests',
        'result = list_pull_requests(repo="owner/repo")',
        'print("ok")',
      ].join('\n');

      const result = await runInPython(code, {
        bridge,
        toolsByServer: { github: [{ name: 'listPullRequests' }] },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('ok');
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0].tool).toBe('listPullRequests');
      expect(result.tool_calls[0].server).toBe('github');
    } finally {
      bridge.close();
    }
  }, 30_000);
});
