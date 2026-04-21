export interface ToolRef {
  name: string;
}

/** Converts an MCP tool name to a valid JS identifier for export names. */
function toIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_$]/g, '_').replace(/^(\d)/, '_$1');
}

function toolToExport(serverName: string, tool: ToolRef): string {
  const exportName = toIdentifier(tool.name);
  return `export async function ${exportName}(params) {
  return globalThis.__mcpClients['${serverName}'].callTool('${tool.name}', params);
}`;
}

/** Generates ESM source for a server's tool exports from a dynamic tool list */
export function generateSource(serverName: string, tools: ToolRef[]): string {
  return tools.map((t) => toolToExport(serverName, t)).join('\n\n');
}

/**
 * Generates ESM source for an unavailable server.
 * A top-level throw fails the module at evaluation time, so any import —
 * named or default — surfaces the descriptive error rather than a generic
 * "export not found" message.
 */
export function generateUnavailableSource(serverName: string, reason: string): string {
  const msg = `Server '${serverName}' is unavailable: ${reason}`;
  return `throw new Error(${JSON.stringify(msg)});`;
}
