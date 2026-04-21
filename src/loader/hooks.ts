import { generateSource, generateUnavailableSource, type ToolRef } from './sources.js';

interface LoaderData {
  toolsByServer: Record<string, ToolRef[]>;
  unavailableServers: Record<string, string>;
}

let toolsByServer: Record<string, ToolRef[]> = {};
let unavailableServers: Record<string, string> = {};

/** Called once by Node when the loader worker starts, with data from module.register() */
export function initialize(data: LoaderData): void {
  toolsByServer = data.toolsByServer;
  unavailableServers = data.unavailableServers;
}

export async function resolve(
  specifier: string,
  context: { parentURL?: string },
  nextResolve: (s: string, c: typeof context) => Promise<{ url: string; shortCircuit?: boolean }>,
): Promise<{ url: string; shortCircuit?: boolean }> {
  if (specifier.startsWith('mcp/')) {
    return { url: `virtual:${specifier}`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(
  url: string,
  context: object,
  nextLoad: (
    u: string,
    c: object,
  ) => Promise<{ source: string; format: string; shortCircuit?: boolean }>,
): Promise<{ source: string; format: string; shortCircuit?: boolean }> {
  if (url.startsWith('virtual:mcp/')) {
    const serverName = url.replace('virtual:mcp/', '');

    if (serverName in unavailableServers) {
      return {
        shortCircuit: true,
        format: 'module',
        source: generateUnavailableSource(serverName, unavailableServers[serverName]),
      };
    }

    if (serverName in toolsByServer) {
      return {
        shortCircuit: true,
        format: 'module',
        source: generateSource(serverName, toolsByServer[serverName]),
      };
    }

    throw new Error(`[mcp-exec] No source for server: '${serverName}' — not in catalog`);
  }
  return nextLoad(url, context);
}
