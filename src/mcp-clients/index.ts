import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { UnavailableServer } from '../types.js';

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export type McpClientMap = Record<string, Client>;

export interface ConnectResult {
  clients: McpClientMap;
  unavailable: UnavailableServer[];
}

interface McpJson {
  mcpServers?: Record<string, McpServerConfig>;
}

/** Reads server configs from .claude/mcp.json in the given directory */
export function readMcpConfig(cwd = process.cwd()): Record<string, McpServerConfig> {
  try {
    const raw = readFileSync(join(cwd, '.claude', 'mcp.json'), 'utf8');
    const parsed = JSON.parse(raw) as McpJson;
    return parsed.mcpServers ?? {};
  } catch {
    return {};
  }
}

/**
 * Connects to the named downstream MCP servers using Promise.allSettled.
 * Servers that fail to connect (or are not configured) are returned in
 * `unavailable` with a reason — the server stays alive for the rest.
 */
export async function connectMcpClients(
  serverNames: string[],
  cwd = process.cwd(),
): Promise<ConnectResult> {
  const configs = readMcpConfig(cwd);
  const clients: McpClientMap = {};
  const unavailable: UnavailableServer[] = [];

  const results = await Promise.allSettled(
    serverNames.map(async (name) => {
      const config = configs[name];
      if (!config) {
        throw new Error(`not configured in mcp.json`);
      }

      const client = new Client({ name: `mcp-exec/${name}`, version: '0.2.0' }, {});
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args ?? [],
        env: Object.fromEntries(
          Object.entries({ ...process.env, ...(config.env ?? {}) }).filter(
            (entry): entry is [string, string] => entry[1] !== undefined,
          ),
        ),
      });

      await client.connect(transport);
      return { name, client };
    }),
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const name = serverNames[i];
    if (result.status === 'fulfilled') {
      clients[result.value.name] = result.value.client;
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      process.stderr.write(`[mcp-exec] Warning: failed to connect to '${name}': ${reason}\n`);
      unavailable.push({ server: name, status: 'unavailable', reason });
    }
  }

  return { clients, unavailable };
}
