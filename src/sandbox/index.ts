import type { ExecResult, RuntimeParam } from '../types.js';
import type { SessionManager } from './session.js';
import { runInNode } from './runtimes/node.js';
import { runInBash } from './runtimes/bash.js';

interface ExecOptions {
  code: string;
  runtime: RuntimeParam;
  session_id?: string;
}

type McpClientMap = Record<string, { callTool: (name: string, params?: unknown) => Promise<unknown> }>;

export function createExecDispatcher(sessions: SessionManager, mcpClients: McpClientMap) {
  return async function exec(opts: ExecOptions): Promise<ExecResult> {
    const { code, runtime, session_id } = opts;
    const type = typeof runtime === 'string' ? runtime : runtime.type;
    const timeout = typeof runtime === 'object' ? runtime.timeout : undefined;
    const env = typeof runtime === 'object' ? runtime.env : undefined;

    if (type === 'node') {
      const context = sessions.getOrCreate(session_id, mcpClients);
      return runInNode(code, context, { timeout });
    }

    if (type === 'bash') {
      return runInBash(code, { timeout, env });
    }

    throw new Error(`Unsupported runtime: ${type}`);
  };
}
