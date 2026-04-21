import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialize, load, resolve } from './hooks.js';

const githubTools = [{ name: 'listPullRequests' }, { name: 'createIssue' }];

beforeEach(() => {
  initialize({
    toolsByServer: { github: githubTools },
    unavailableServers: { slack: 'ENOENT: slack-mcp not found' },
  });
});

describe('resolve', () => {
  it('intercepts mcp/* specifiers and redirects to virtual: URL', async () => {
    const nextResolve = vi.fn();
    const result = await resolve('mcp/github', {}, nextResolve);
    expect(result).toEqual({ url: 'virtual:mcp/github', shortCircuit: true });
    expect(nextResolve).not.toHaveBeenCalled();
  });

  it('delegates non-mcp specifiers to nextResolve', async () => {
    const nextResolve = vi.fn().mockResolvedValue({ url: 'node:fs' });
    const result = await resolve('node:fs', {}, nextResolve);
    expect(nextResolve).toHaveBeenCalledWith('node:fs', {});
    expect(result).toEqual({ url: 'node:fs' });
  });

  it('passes parentURL context through to nextResolve', async () => {
    const ctx = { parentURL: 'file:///some/file.js' };
    const nextResolve = vi.fn().mockResolvedValue({ url: 'node:path' });
    await resolve('node:path', ctx, nextResolve);
    expect(nextResolve).toHaveBeenCalledWith('node:path', ctx);
  });
});

describe('load', () => {
  it('generates ESM module source for a known server', async () => {
    const nextLoad = vi.fn();
    const result = await load('virtual:mcp/github', {}, nextLoad);
    expect(result.format).toBe('module');
    expect(result.shortCircuit).toBe(true);
    expect(result.source).toContain('export async function listPullRequests');
    expect(nextLoad).not.toHaveBeenCalled();
  });

  it('generates an error-throwing module for unavailable servers', async () => {
    const nextLoad = vi.fn();
    const result = await load('virtual:mcp/slack', {}, nextLoad);
    expect(result.format).toBe('module');
    expect(result.source).toContain('unavailable');
    expect(result.source).toContain('slack');
    expect(nextLoad).not.toHaveBeenCalled();
  });

  it('throws for servers not in toolsByServer or unavailable', async () => {
    const nextLoad = vi.fn();
    await expect(load('virtual:mcp/unknown-server-xyz', {}, nextLoad)).rejects.toThrow();
  });

  it('delegates non-virtual URLs to nextLoad', async () => {
    const nextLoad = vi.fn().mockResolvedValue({ source: 'export {}', format: 'module' });
    const result = await load('node:fs', {}, nextLoad);
    expect(nextLoad).toHaveBeenCalledWith('node:fs', {});
    expect(result).toEqual({ source: 'export {}', format: 'module' });
  });
});
