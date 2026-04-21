import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Must mock before importing the module under test
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return {
    ...actual,
    homedir: vi.fn(() => '/mock/home'),
  };
});

import * as os from 'node:os';
import { resolveSandboxConfig } from './config.js';

describe('resolveSandboxConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mcp-exec-test-'));
  });

  it('returns empty arrays when no settings files exist', () => {
    vi.mocked(os.homedir).mockReturnValue(join(tmpDir, 'nonexistent'));
    const config = resolveSandboxConfig(join(tmpDir, 'nonexistent'));
    expect(config.network?.allowedDomains).toEqual([]);
    expect(config.filesystem?.allowWrite).toContain('~/.mcp-exec/sessions');
  });

  it('reads allowedDomains from user settings', () => {
    const userDir = join(tmpDir, '.claude');
    mkdirSync(userDir, { recursive: true });
    writeFileSync(
      join(userDir, 'settings.json'),
      JSON.stringify({ sandbox: { network: { allowedDomains: ['api.github.com'] } } }),
    );
    vi.mocked(os.homedir).mockReturnValue(tmpDir);
    const config = resolveSandboxConfig(tmpDir);
    expect(config.network?.allowedDomains).toContain('api.github.com');
  });

  it('merges allowedDomains from user and project settings without duplicates', () => {
    const userDir = join(tmpDir, '.claude');
    const projectDir = join(tmpDir, 'project', '.claude');
    mkdirSync(userDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(userDir, 'settings.json'),
      JSON.stringify({ sandbox: { network: { allowedDomains: ['api.github.com'] } } }),
    );
    writeFileSync(
      join(projectDir, 'settings.json'),
      JSON.stringify({
        sandbox: { network: { allowedDomains: ['api.github.com', 'slack.com'] } },
      }),
    );
    vi.mocked(os.homedir).mockReturnValue(tmpDir);
    const config = resolveSandboxConfig(join(tmpDir, 'project'));
    expect(config.network?.allowedDomains).toEqual(['api.github.com', 'slack.com']);
  });

  it('handles malformed JSON without throwing', () => {
    const userDir = join(tmpDir, '.claude');
    mkdirSync(userDir, { recursive: true });
    writeFileSync(join(userDir, 'settings.json'), 'not json');
    vi.mocked(os.homedir).mockReturnValue(tmpDir);
    expect(() => resolveSandboxConfig(tmpDir)).not.toThrow();
  });

  it('reads denyRead from user settings', () => {
    const userDir = join(tmpDir, '.claude');
    mkdirSync(userDir, { recursive: true });
    writeFileSync(
      join(userDir, 'settings.json'),
      JSON.stringify({ sandbox: { filesystem: { denyRead: ['/etc/passwd'] } } }),
    );
    vi.mocked(os.homedir).mockReturnValue(tmpDir);
    const config = resolveSandboxConfig(tmpDir);
    expect(config.filesystem?.denyRead).toContain('/etc/passwd');
  });

  it('merges denyWrite from user and project settings without duplicates', () => {
    const userDir = join(tmpDir, '.claude');
    const projectDir = join(tmpDir, 'project', '.claude');
    mkdirSync(userDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(userDir, 'settings.json'),
      JSON.stringify({ sandbox: { filesystem: { denyWrite: ['/etc'] } } }),
    );
    writeFileSync(
      join(projectDir, 'settings.json'),
      JSON.stringify({ sandbox: { filesystem: { denyWrite: ['/etc', '/usr'] } } }),
    );
    vi.mocked(os.homedir).mockReturnValue(tmpDir);
    const config = resolveSandboxConfig(join(tmpDir, 'project'));
    expect(config.filesystem?.denyWrite).toEqual(['/etc', '/usr']);
  });

  it('merges allowRead from user and project settings without duplicates', () => {
    const userDir = join(tmpDir, '.claude');
    const projectDir = join(tmpDir, 'project', '.claude');
    mkdirSync(userDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(userDir, 'settings.json'),
      JSON.stringify({ sandbox: { filesystem: { allowRead: ['/tmp'] } } }),
    );
    writeFileSync(
      join(projectDir, 'settings.json'),
      JSON.stringify({ sandbox: { filesystem: { allowRead: ['/tmp', '/var/log'] } } }),
    );
    vi.mocked(os.homedir).mockReturnValue(tmpDir);
    const config = resolveSandboxConfig(join(tmpDir, 'project'));
    expect(config.filesystem?.allowRead).toEqual(['/tmp', '/var/log']);
  });
});
