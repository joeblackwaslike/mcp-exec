import vm from 'vm';
import type { ExecResult } from '../../types.js';

const PREAMBLE_LINES = 1;

function wrapCode(code: string): string {
  return `(async () => { ${code} })()`;
}

function adjustLineNumber(line: number): number {
  return Math.max(1, line - PREAMBLE_LINES);
}

/** Runs code in a persistent vm.Context. Does not apply srt wrapping (done at server level). */
export async function runInNode(
  code: string,
  context: vm.Context,
  opts: { timeout?: number } = {},
): Promise<ExecResult> {
  const tool_calls: ExecResult['tool_calls'] = [];
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);

  const captureStdout = (chunk: string | Buffer): boolean => {
    stdoutChunks.push(chunk.toString());
    return origStdoutWrite(chunk as string);
  };

  const captureStderr = (chunk: string | Buffer): boolean => {
    stderrChunks.push(chunk.toString());
    return origStderrWrite(chunk as string);
  };

  // Ensure process is available in the context
  if (!context.process) {
    context.process = process;
  }

  // Hook process.stdout.write and process.stderr.write in the context
  if (context.process && context.process.stdout) {
    context.process.stdout.write = captureStdout as any;
  }
  if (context.process && context.process.stderr) {
    context.process.stderr.write = captureStderr as any;
  }

  try {
    const wrapped = wrapCode(code);
    const returnValue = await vm.runInContext(wrapped, context, {
      timeout: opts.timeout,
      importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
    });

    const stdout = stdoutChunks.join('');
    return {
      result: returnValue as unknown,
      stdout,
      stderr: stderrChunks.join(''),
      exitCode: 0,
      tool_calls,
    };
  } catch (err) {
    const error = err as Error & { lineNumber?: number; columnNumber?: number };
    const line = adjustLineNumber(error.lineNumber ?? 1);
    const errorResult = JSON.stringify({
      error: error.message,
      line,
      column: error.columnNumber ?? 1,
    });
    return {
      result: errorResult,
      stdout: stdoutChunks.join(''),
      stderr: stderrChunks.join(''),
      exitCode: 1,
      tool_calls,
    };
  }
}
