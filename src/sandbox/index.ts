import type { ExecResult, RuntimeParam } from '../types.js';
import { runInBash } from './runtimes/bash.js';
import { runInNode } from './runtimes/node.js';
import type { SessionManager } from './session.js';

interface ExecOptions {
  code: string;
  runtime: RuntimeParam;
  session_id?: string;
}

/** Duck-type interface expected by generated shims: callTool(name, params) */
type ShimClientMap = Record<
  string,
  { callTool: (name: string, params?: unknown) => Promise<unknown> }
>;

/** Real MCP SDK Client.callTool shape: callTool({ name, arguments }) */
interface SdkClient {
  callTool(request: { name: string; arguments?: Record<string, unknown> }): Promise<unknown>;
}

/**
 * Wraps real MCP SDK clients into the two-argument duck-type interface expected
 * by generated shims. Passes through objects that already match the shim interface.
 */
function wrapClients(clients: Record<string, SdkClient | ShimClientMap[string]>): ShimClientMap {
  return Object.fromEntries(
    Object.entries(clients).map(([name, client]) => {
      const wrapped = {
        callTool: (toolName: string, params?: unknown) => {
          const sdkClient = client as SdkClient;
          if (typeof sdkClient.callTool === 'function') {
            return sdkClient.callTool({
              name: toolName,
              arguments: params as Record<string, unknown> | undefined,
            });
          }
          return (client as ShimClientMap[string]).callTool(toolName, params);
        },
      };
      return [name, wrapped];
    }),
  );
}

export function createExecDispatcher(
  sessions: SessionManager,
  // biome-ignore lint/suspicious/noExplicitAny: real MCP Client vs duck-type shim bridge
  mcpClients: Record<string, any>,
) {
  const shimClients = wrapClients(mcpClients);

  return async function exec(opts: ExecOptions): Promise<ExecResult> {
    const { code, runtime, session_id } = opts;
    const type = typeof runtime === 'string' ? runtime : runtime.type;
    const timeout = typeof runtime === 'object' ? runtime.timeout : undefined;
    const env = typeof runtime === 'object' ? runtime.env : undefined;

    if (type === 'node') {
      const context = sessions.getOrCreate(session_id, shimClients);
      return runInNode(code, context, { timeout });
    }

    if (type === 'bash') {
      return runInBash(code, { timeout, env });
    }

    throw new Error(`Unsupported runtime: ${type}`);
  };
}
