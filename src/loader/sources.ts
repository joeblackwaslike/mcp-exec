export interface ToolRef {
  name: string;
}

function toolToExport(serverName: string, tool: ToolRef): string {
  return `export async function ${tool.name}(params) {
  return globalThis.__mcpClients['${serverName}'].callTool('${tool.name}', params);
}`;
}

/** Generates ESM source for a server's tool exports from a dynamic tool list */
export function generateSource(serverName: string, tools: ToolRef[]): string {
  return tools.map((t) => toolToExport(serverName, t)).join('\n\n');
}

/** Generates ESM source for a server that is unavailable — every named export throws */
export function generateUnavailableSource(serverName: string, reason: string): string {
  const msg = `Server '${serverName}' is unavailable: ${reason}`;
  return `export const __unavailable = true;
export default new Proxy({}, {
  get(_, prop) {
    return () => { throw new Error(${JSON.stringify(msg)}); };
  }
});
// Named import stub — throws on call
export function __namedImportStub() {
  throw new Error(${JSON.stringify(msg)});
}`;
}
