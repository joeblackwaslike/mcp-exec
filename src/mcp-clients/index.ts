import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export type McpClientMap = Record<string, Client>;

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
 * Connects to the named downstream MCP servers and returns a client map.
 * Connections are established in parallel.
 */
export async function connectMcpClients(
  serverNames: string[],
  cwd = process.cwd(),
): Promise<McpClientMap> {
  const configs = readMcpConfig(cwd);
  const entries = await Promise.all(
    serverNames.map(async (name) => {
      const config = configs[name];
      if (!config) {
        return [name, null] as const;
      }

      const client = new Client({ name: `mcp-exec/${name}`, version: '0.1.0' }, {});
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
      return [name, client] as const;
    }),
  );

  return Object.fromEntries(entries.filter(([, client]) => client !== null)) as McpClientMap;
}
