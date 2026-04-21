import type { ToolSummary, UnavailableServer } from '../types.js';

interface InputSchema {
  properties?: Record<string, { type?: string }>;
  required?: string[];
}

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: InputSchema;
}

interface ListToolsResult {
  tools: McpTool[];
}

interface McpClient {
  listTools(): Promise<ListToolsResult>;
}

export interface ToolRef {
  name: string;
}

export interface BuildCatalogResult {
  tools: ToolSummary[];
  unavailable: UnavailableServer[];
  toolsByServer: Record<string, ToolRef[]>;
}

function deriveSignature(name: string, schema?: InputSchema): string {
  if (!schema?.properties) return `${name}(): unknown`;

  const required = new Set(schema.required ?? []);
  const params = Object.entries(schema.properties)
    .map(([param, def]) => {
      const type = def.type ?? 'unknown';
      return required.has(param) ? `${param}: ${type}` : `${param}?: ${type}`;
    })
    .join(', ');

  return `${name}(${params}): unknown`;
}

/**
 * Fetches tool lists from all connected MCP clients using Promise.allSettled.
 * Clients whose listTools() call fails are moved to unavailable — the rest
 * of the catalog is unaffected.
 */
export async function buildCatalog(
  clients: Record<string, McpClient>,
  connectUnavailable: UnavailableServer[],
): Promise<BuildCatalogResult> {
  const tools: ToolSummary[] = [];
  const unavailable: UnavailableServer[] = [...connectUnavailable];
  const toolsByServer: Record<string, ToolRef[]> = {};

  const serverNames = Object.keys(clients);
  const results = await Promise.allSettled(serverNames.map((name) => clients[name].listTools()));

  for (let i = 0; i < results.length; i++) {
    const name = serverNames[i];
    const result = results[i];

    if (result.status === 'rejected') {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      process.stderr.write(`[mcp-exec] Warning: failed to list tools for '${name}': ${reason}\n`);
      unavailable.push({ server: name, status: 'unavailable', reason });
      continue;
    }

    const serverTools = result.value.tools;
    toolsByServer[name] = serverTools.map((t) => ({ name: t.name }));
    for (const tool of serverTools) {
      tools.push({
        server: name,
        name: tool.name,
        description: tool.description ?? '',
        signature: deriveSignature(tool.name, tool.inputSchema),
      });
    }
  }

  return { tools, unavailable, toolsByServer };
}
