import { spawn } from 'node:child_process';
import type { ExecResult } from '../../types.js';

/** Runs Bash code in a stateless subprocess. No session state persists between calls. */
export function runInBash(
  code: string,
  opts: { timeout?: number; env?: Record<string, string> } = {},
): Promise<ExecResult> {
  return new Promise((resolve) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const child = spawn('bash', ['-c', code], {
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let timedOut = false;
    const timer = opts.timeout
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
        }, opts.timeout)
      : null;

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks).toString();
      const stderr = Buffer.concat(stderrChunks).toString();
      const exitCode = timedOut ? 124 : (code ?? 1);

      resolve({
        result: stdout,
        stdout,
        stderr,
        exitCode,
        tool_calls: [],
      });
    });
  });
}
