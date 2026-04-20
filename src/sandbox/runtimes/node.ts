import vm from 'node:vm';
import type { ExecResult } from '../../types.js';

const PREAMBLE_LINES = 1;

function wrapCode(code: string): string {
  return `(async () => { ${code} })()`;
}

function adjustLineNumber(line: number): number {
  return Math.max(1, line - PREAMBLE_LINES);
}

/** Builds a console object that captures output into the provided arrays. */
function makeCapturedConsole(
  stdoutChunks: string[],
  stderrChunks: string[],
): Record<string, (...args: unknown[]) => void> {
  const toLine = (...args: unknown[]) => `${args.map(String).join(' ')}\n`;
  return {
    log: (...args) => stdoutChunks.push(toLine(...args)),
    info: (...args) => stdoutChunks.push(toLine(...args)),
    dir: (...args) => stdoutChunks.push(toLine(...args)),
    warn: (...args) => stderrChunks.push(toLine(...args)),
    error: (...args) => stderrChunks.push(toLine(...args)),
    debug: (...args) => stderrChunks.push(toLine(...args)),
  };
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

  // Inject an execution-scoped console — avoids any global process.stdout override
  // and correctly isolates output across concurrent exec() calls.
  context.console = makeCapturedConsole(stdoutChunks, stderrChunks);

  try {
    const wrapped = wrapCode(code);
    const returnValue = await vm.runInContext(wrapped, context, {
      timeout: opts.timeout,
      importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
    });

    return {
      result: returnValue as unknown,
      stdout: stdoutChunks.join(''),
      stderr: stderrChunks.join(''),
      exitCode: 0,
      tool_calls,
    };
  } catch (err) {
    const isError = err instanceof Error;
    const message = isError ? err.message : String(err);
    const line = isError
      ? adjustLineNumber((err as Error & { lineNumber?: number }).lineNumber ?? 1)
      : 1;
    const column = isError ? ((err as Error & { columnNumber?: number }).columnNumber ?? 1) : 1;
    return {
      result: JSON.stringify({ error: message, line, column }),
      stdout: stdoutChunks.join(''),
      stderr: stderrChunks.join(''),
      exitCode: 1,
      tool_calls,
    };
  }
}
