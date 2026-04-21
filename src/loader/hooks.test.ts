import { describe, expect, it, vi } from 'vitest';
import { load, resolve } from './hooks.js';

describe('resolve', () => {
  it('intercepts mcp/* specifiers and redirects to virtual: URL', async () => {
    const nextResolve = vi.fn();
    const result = await resolve('mcp/gmail', {}, nextResolve);
    expect(result).toEqual({ url: 'virtual:mcp/gmail', shortCircuit: true });
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
  it('generates ESM module source for virtual:mcp/* URLs', async () => {
    const nextLoad = vi.fn();
    const result = await load('virtual:mcp/gmail', {}, nextLoad);
    expect(result.format).toBe('module');
    expect(result.shortCircuit).toBe(true);
    expect(typeof result.source).toBe('string');
    expect(result.source).toContain('export');
    expect(nextLoad).not.toHaveBeenCalled();
  });

  it('throws for unknown server names', async () => {
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
