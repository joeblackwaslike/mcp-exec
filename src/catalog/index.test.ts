import { beforeEach, describe, expect, it } from 'vitest';
import type { ToolSummary, UnavailableServer } from '../types.js';
import { getAllTools, searchTools, setCatalog } from './index.js';

const sampleTools: ToolSummary[] = [
  {
    server: 'github',
    name: 'listPullRequests',
    description: 'List open pull requests',
    signature: 'listPullRequests(state?: string): PR[]',
  },
  {
    server: 'github',
    name: 'createIssue',
    description: 'Create a new issue',
    signature: 'createIssue(title: string, body?: string): Issue',
  },
  {
    server: 'gdrive',
    name: 'searchFiles',
    description: 'Search Drive files by name or content',
    signature: 'searchFiles(query: string): File[]',
  },
];

const sampleUnavailable: UnavailableServer[] = [
  { server: 'slack', status: 'unavailable', reason: 'ENOENT: slack-mcp not found' },
];

beforeEach(() => {
  setCatalog(sampleTools, sampleUnavailable);
});

describe('getAllTools', () => {
  it('returns all tools from the catalog', () => {
    const entries = getAllTools();
    const tools = entries.filter((e): e is ToolSummary => !('status' in e));
    expect(tools).toHaveLength(3);
  });

  it('includes unavailable server entries', () => {
    const entries = getAllTools();
    const unavailable = entries.filter((e): e is UnavailableServer => 'status' in e);
    expect(unavailable).toHaveLength(1);
    expect(unavailable[0].server).toBe('slack');
    expect(unavailable[0].reason).toContain('ENOENT');
  });

  it('returns empty catalog before setCatalog is called', () => {
    setCatalog([], []);
    expect(getAllTools()).toHaveLength(0);
  });
});

describe('searchTools', () => {
  it('returns all tools and unavailable entries for "*"', () => {
    const results = searchTools('*');
    expect(results).toHaveLength(sampleTools.length + sampleUnavailable.length);
  });

  it('filters by single token matching tool name', () => {
    const results = searchTools('search');
    const tools = results.filter((e): e is ToolSummary => !('status' in e));
    expect(
      tools.every(
        (t) =>
          t.name.toLowerCase().includes('search') || t.description.toLowerCase().includes('search'),
      ),
    ).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });

  it('splits camelCase tool names for matching', () => {
    const results = searchTools('pull');
    const tools = results.filter((e): e is ToolSummary => !('status' in e));
    expect(tools.some((t) => t.name === 'listPullRequests')).toBe(true);
  });

  it('requires all tokens to match (AND logic)', () => {
    const results = searchTools('list pull');
    const tools = results.filter((e): e is ToolSummary => !('status' in e));
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('listPullRequests');
  });

  it('strips stop words from query', () => {
    const withStop = searchTools('search the files');
    const withoutStop = searchTools('search files');
    expect(withStop.length).toBe(withoutStop.length);
  });

  it('returns empty array for no matches', () => {
    const results = searchTools('zzznomatch');
    expect(results).toEqual([]);
  });

  it('does not include unavailable entries for non-wildcard queries', () => {
    const results = searchTools('slack');
    const unavailable = results.filter((e) => 'status' in e);
    expect(unavailable).toHaveLength(0);
  });
});
