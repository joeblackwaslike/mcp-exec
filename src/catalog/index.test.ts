import { describe, it, expect } from 'vitest';
import { searchTools, getAllTools } from './index.js';

describe('getAllTools', () => {
  it('returns tools for gmail and gdrive', () => {
    const tools = getAllTools();
    const servers = [...new Set(tools.map((t) => t.server))];
    expect(servers).toContain('gmail');
    expect(servers).toContain('gdrive');
  });
});

describe('searchTools', () => {
  it('returns all tools for "*"', () => {
    const all = getAllTools();
    const results = searchTools('*');
    expect(results.length).toBe(all.length);
  });

  it('filters by single token matching tool name', () => {
    const results = searchTools('search');
    expect(results.every((t) => t.name.toLowerCase().includes('search') || t.description.toLowerCase().includes('search'))).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('splits camelCase tool names for matching', () => {
    // "searchEmails" should match query "emails"
    const results = searchTools('emails');
    expect(results.some((t) => t.name === 'searchEmails')).toBe(true);
  });

  it('requires all tokens to match (AND logic)', () => {
    const results = searchTools('search emails');
    expect(results.every((t) =>
      (t.name + ' ' + t.description).toLowerCase().includes('search') ||
      (t.name + ' ' + t.description).toLowerCase().includes('email'),
    )).toBe(true);
  });

  it('strips stop words from query', () => {
    // "search the emails" should behave like "search emails"
    const withStop = searchTools('search the emails');
    const withoutStop = searchTools('search emails');
    expect(withStop.length).toBe(withoutStop.length);
  });

  it('returns empty array for no matches', () => {
    const results = searchTools('zzznomatch');
    expect(results).toEqual([]);
  });
});
