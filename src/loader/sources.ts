/** Tool definitions for hardcoded v0.1 servers */
const GMAIL_TOOLS = [
  { name: 'searchEmails', description: 'Search emails by query', params: 'query: string' },
  { name: 'getEmail', description: 'Get a single email by ID', params: 'id: string' },
  { name: 'sendEmail', description: 'Send an email', params: 'to: string, subject: string, body: string' },
  { name: 'listLabels', description: 'List all Gmail labels', params: '' },
];

const GDRIVE_TOOLS = [
  { name: 'searchFiles', description: 'Search Drive files by name or content', params: 'query: string' },
  { name: 'getFile', description: 'Get file metadata by ID', params: 'id: string' },
  { name: 'createDocument', description: 'Create a new Google Doc', params: 'title: string, content?: string' },
  { name: 'listFiles', description: 'List files in a folder', params: 'folderId?: string' },
];

const SERVER_TOOLS: Record<string, { name: string; description: string; params: string }[]> = {
  gmail: GMAIL_TOOLS,
  gdrive: GDRIVE_TOOLS,
};

export const HARDCODED_SERVERS = Object.keys(SERVER_TOOLS);

function toolToExport(serverName: string, tool: { name: string; params: string }): string {
  return `
export async function ${tool.name}(params) {
  return globalThis.__mcpClients['${serverName}'].callTool('${tool.name}', params);
}`.trim();
}

/** Generates ESM source for a hardcoded server's tool exports */
export function generateSource(serverName: string): string {
  const tools = SERVER_TOOLS[serverName];
  if (!tools) throw new Error(`No hardcoded source for server: ${serverName}`);
  return tools.map((t) => toolToExport(serverName, t)).join('\n\n');
}
