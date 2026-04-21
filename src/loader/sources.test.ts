import { describe, expect, it } from 'vitest';
import { generateSource, generateUnavailableSource } from './sources.js';

const sampleTools = [{ name: 'listPullRequests' }, { name: 'createIssue' }];

describe('generateSource', () => {
  it('generates a named export for each tool', () => {
    const source = generateSource('github', sampleTools);
    expect(source).toContain('export async function listPullRequests');
    expect(source).toContain('export async function createIssue');
  });

  it('routes each tool call through globalThis.__mcpClients', () => {
    const source = generateSource('github', sampleTools);
    expect(source).toContain("globalThis.__mcpClients['github'].callTool('listPullRequests'");
    expect(source).toContain("globalThis.__mcpClients['github'].callTool('createIssue'");
  });

  it('produces valid ESM with export keywords', () => {
    const source = generateSource('github', sampleTools);
    expect(source).toMatch(/export async function/);
    expect(source.length).toBeGreaterThan(0);
  });

  it('generates empty module for server with no tools', () => {
    const source = generateSource('empty-server', []);
    expect(source).toBe('');
  });

  it('sanitizes hyphenated tool names to valid JS identifiers', () => {
    const source = generateSource('github', [{ name: 'list-pull-requests' }]);
    expect(source).toContain('export async function list_pull_requests');
    expect(source).toContain("callTool('list-pull-requests'");
  });
});

describe('generateUnavailableSource', () => {
  it('generates a top-level throw so any import surfaces the error', () => {
    const source = generateUnavailableSource('slack', 'ENOENT: binary not found');
    expect(source).toMatch(/^throw new Error\(/);
    expect(source).toContain('slack');
    expect(source).toContain('unavailable');
  });

  it('includes the reason in the thrown error', () => {
    const source = generateUnavailableSource('slack', 'connection refused');
    expect(source).toContain('connection refused');
  });
});
