import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExecResult } from '../../types.js';

/** Runs Python code in a stateless uv subprocess. No session state persists between calls. */
export async function runInPython(
  code: string,
  opts: { timeout?: number; env?: Record<string, string> } = {},
): Promise<ExecResult> {
  const tmpFile = join(tmpdir(), `mcp-exec-${randomUUID()}.py`);
  await writeFile(tmpFile, code, 'utf8');

  try {
    return await spawnPython(tmpFile, opts);
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

function spawnPython(
  scriptPath: string,
  opts: { timeout?: number; env?: Record<string, string> },
): Promise<ExecResult> {
  return new Promise((resolve) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const child = spawn('uv', ['run', '--isolated', scriptPath], {
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let settled = false;
    const settle = (result: ExecResult) => {
      if (settled) return;
      settled = true;
      if (sigkillTimer) clearTimeout(sigkillTimer);
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    let timedOut = false;
    let sigkillTimer: NodeJS.Timeout | null = null;
    const timer = opts.timeout
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
          sigkillTimer = setTimeout(() => child.kill('SIGKILL'), 2000);
        }, opts.timeout)
      : null;

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('error', (err) => {
      settle({
        result: '',
        stdout: '',
        stderr: `Failed to spawn uv: ${err.message}. Is uv installed and on PATH?`,
        exitCode: 127,
        tool_calls: [],
      });
    });

    child.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString();
      const stderr = Buffer.concat(stderrChunks).toString();
      const exitCode = timedOut ? 124 : (code ?? 1);
      settle({ result: stdout, stdout, stderr, exitCode, tool_calls: [] });
    });
  });
}
