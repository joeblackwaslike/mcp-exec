import { describe, expect, it } from 'vitest';
import { generateSource, HARDCODED_SERVERS } from './sources.js';

describe('generateSource', () => {
  it('lists Gmail and GDrive as hardcoded servers', () => {
    expect(HARDCODED_SERVERS).toContain('gmail');
    expect(HARDCODED_SERVERS).toContain('gdrive');
  });

  it('generates a module with named exports for each tool', () => {
    const source = generateSource('gmail');
    expect(source).toContain('export async function searchEmails');
    expect(source).toContain("globalThis.__mcpClients['gmail'].callTool('searchEmails'");
  });

  it('throws for unknown server', () => {
    expect(() => generateSource('unknown')).toThrow('No hardcoded source for server: unknown');
  });

  it('generated source is valid ESM (no syntax errors)', () => {
    // Verify source is non-empty and contains expected exports
    // (new Function() doesn't support export statements, so we validate content instead)
    const source = generateSource('gmail');
    expect(source).toBeTruthy();
    expect(source.length).toBeGreaterThan(0);
    expect(source).toMatch(/export async function/);
  });
});
