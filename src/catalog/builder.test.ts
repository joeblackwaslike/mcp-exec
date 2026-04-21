import { describe, expect, it, vi } from 'vitest';
import type { UnavailableServer } from '../types.js';
import { buildCatalog } from './builder.js';

function makeClient(tools: { name: string; description?: string; inputSchema?: object }[]) {
  return {
    listTools: vi.fn().mockResolvedValue({ tools }),
  };
}

function makeFailingClient(error: string) {
  return {
    listTools: vi.fn().mockRejectedValue(new Error(error)),
  };
}

describe('buildCatalog', () => {
  it('returns empty tools and empty unavailable when no clients', async () => {
    const result = await buildCatalog({}, []);
    expect(result.tools).toHaveLength(0);
    expect(result.unavailable).toHaveLength(0);
  });

  it('fetches tools from each client and builds ToolSummary entries', async () => {
    const clients = {
      github: makeClient([
        { name: 'listPullRequests', description: 'List PRs' },
        { name: 'createIssue', description: 'Create issue' },
      ]),
    };
    const result = await buildCatalog(clients, []);
    expect(result.tools).toHaveLength(2);
    expect(result.tools[0]).toMatchObject({ server: 'github', name: 'listPullRequests' });
    expect(result.tools[1]).toMatchObject({ server: 'github', name: 'createIssue' });
  });

  it('derives signature from inputSchema properties', async () => {
    const clients = {
      github: makeClient([
        {
          name: 'createIssue',
          description: 'Create issue',
          inputSchema: {
            properties: { title: { type: 'string' }, body: { type: 'string' } },
            required: ['title'],
          },
        },
      ]),
    };
    const result = await buildCatalog(clients, []);
    expect(result.tools[0].signature).toBe('createIssue(title: string, body?: string): unknown');
  });

  it('falls back to plain signature when no inputSchema', async () => {
    const clients = {
      github: makeClient([{ name: 'ping', description: 'Health check' }]),
    };
    const result = await buildCatalog(clients, []);
    expect(result.tools[0].signature).toBe('ping(): unknown');
  });

  it('moves client to unavailable when listTools throws', async () => {
    const clients = {
      slack: makeFailingClient('connection reset'),
      github: makeClient([{ name: 'listPRs', description: 'List PRs' }]),
    };
    const result = await buildCatalog(clients, []);
    expect(result.tools.every((t) => t.server !== 'slack')).toBe(true);
    const slackEntry = result.unavailable.find((u) => u.server === 'slack');
    expect(slackEntry?.reason).toContain('connection reset');
    expect(result.tools.some((t) => t.server === 'github')).toBe(true);
  });

  it('includes pre-existing unavailable entries from connection phase', async () => {
    const connectPhaseUnavailable: UnavailableServer[] = [
      { server: 'pieces', status: 'unavailable', reason: 'ENOENT: binary not found' },
    ];
    const result = await buildCatalog({}, connectPhaseUnavailable);
    expect(result.unavailable).toHaveLength(1);
    expect(result.unavailable[0].server).toBe('pieces');
  });

  it('builds toolsByServer map alongside tools list', async () => {
    const clients = {
      github: makeClient([
        { name: 'listPullRequests', description: 'List PRs' },
        { name: 'createIssue', description: 'Create issue' },
      ]),
    };
    const result = await buildCatalog(clients, []);
    expect(result.toolsByServer.github).toHaveLength(2);
    expect(result.toolsByServer.github[0].name).toBe('listPullRequests');
  });
});
