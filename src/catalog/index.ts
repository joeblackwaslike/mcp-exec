import type { ToolSummary } from '../types.js';

const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'is', 'in', 'to', 'of', 'for', 'with']);

const CATALOG: ToolSummary[] = [
  // Gmail
  { server: 'gmail', name: 'searchEmails', description: 'Search emails by query string', signature: 'searchEmails(query: string): Email[]' },
  { server: 'gmail', name: 'getEmail', description: 'Get a single email by ID', signature: 'getEmail(id: string): Email' },
  { server: 'gmail', name: 'sendEmail', description: 'Send an email to a recipient', signature: 'sendEmail(to: string, subject: string, body: string): void' },
  { server: 'gmail', name: 'listLabels', description: 'List all Gmail labels', signature: 'listLabels(): Label[]' },
  // GDrive
  { server: 'gdrive', name: 'searchFiles', description: 'Search Google Drive files by name or content', signature: 'searchFiles(query: string): File[]' },
  { server: 'gdrive', name: 'getFile', description: 'Get file metadata by ID', signature: 'getFile(id: string): File' },
  { server: 'gdrive', name: 'createDocument', description: 'Create a new Google Doc with optional content', signature: 'createDocument(title: string, content?: string): File' },
  { server: 'gdrive', name: 'listFiles', description: 'List files in a Drive folder', signature: 'listFiles(folderId?: string): File[]' },
];

function camelCaseTokens(s: string): string[] {
  return s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/\s+/);
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t));
}

function toolText(tool: ToolSummary): string {
  return [tool.description.toLowerCase(), ...camelCaseTokens(tool.name)].join(' ');
}

export function getAllTools(): ToolSummary[] {
  return CATALOG;
}

export function searchTools(query: string): ToolSummary[] {
  if (query === '*') return CATALOG;
  const tokens = tokenize(query);
  if (tokens.length === 0) return CATALOG;
  return CATALOG.filter((tool) => {
    const text = toolText(tool);
    return tokens.every((token) => text.includes(token));
  });
}
