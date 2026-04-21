import type { CatalogEntry, ToolSummary, UnavailableServer } from '../types.js';

const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'is', 'in', 'to', 'of', 'for', 'with']);

let catalog: ToolSummary[] = [];
let unavailableServers: UnavailableServer[] = [];

export function setCatalog(tools: ToolSummary[], unavailable: UnavailableServer[]): void {
  catalog = tools;
  unavailableServers = unavailable;
}

export function getAllTools(): CatalogEntry[] {
  return [...catalog, ...unavailableServers];
}

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

export function searchTools(query: string): CatalogEntry[] {
  if (query === '*') return getAllTools();
  const tokens = tokenize(query);
  if (tokens.length === 0) return getAllTools();
  return catalog.filter((tool) => {
    const text = toolText(tool);
    return tokens.every((token) => text.includes(token));
  });
}
