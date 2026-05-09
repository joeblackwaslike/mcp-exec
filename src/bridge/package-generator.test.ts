import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateMcpPackage, removeMcpPackage } from './package-generator.js';

const BRIDGE_URL = 'http://127.0.0.1:9999/call';
const EXEC_ID = 'test-exec-id';

describe('generateMcpPackage', () => {
  let pkgDir = '';

  afterEach(async () => {
    if (pkgDir) {
      await removeMcpPackage(pkgDir);
      pkgDir = '';
    }
  });

  it('creates mcp/__init__.py', async () => {
    pkgDir = await generateMcpPackage({}, BRIDGE_URL, EXEC_ID);
    await expect(stat(join(pkgDir, 'mcp', '__init__.py'))).resolves.toBeTruthy();
  });

  it('handles empty toolsByServer with only __init__.py', async () => {
    pkgDir = await generateMcpPackage({}, BRIDGE_URL, EXEC_ID);
    const files = await readdir(join(pkgDir, 'mcp'));
    expect(files).toEqual(['__init__.py']);
  });

  it('converts hyphenated server names to underscore module filenames', async () => {
    pkgDir = await generateMcpPackage(
      { 'github-actions': [{ name: 'runWorkflow' }] },
      BRIDGE_URL,
      EXEC_ID,
    );
    const files = await readdir(join(pkgDir, 'mcp'));
    expect(files).toContain('github_actions.py');
  });

  it('generates snake_case function names from camelCase tool names', async () => {
    pkgDir = await generateMcpPackage(
      { 'my-server': [{ name: 'listPullRequests' }, { name: 'getIssue' }] },
      BRIDGE_URL,
      EXEC_ID,
    );
    const content = await readFile(join(pkgDir, 'mcp', 'my_server.py'), 'utf8');
    expect(content).toContain('def list_pull_requests(**kwargs)');
    expect(content).toContain('def get_issue(**kwargs)');
  });

  it('preserves original camelCase tool name in _call invocations', async () => {
    pkgDir = await generateMcpPackage(
      { server1: [{ name: 'listPullRequests' }, { name: 'getIssue' }] },
      BRIDGE_URL,
      EXEC_ID,
    );
    const content = await readFile(join(pkgDir, 'mcp', 'server1.py'), 'utf8');
    expect(content).toContain('_call("listPullRequests"');
    expect(content).toContain('_call("getIssue"');
  });

  it('embeds the bridge URL in generated module', async () => {
    pkgDir = await generateMcpPackage(
      { s1: [{ name: 'doThing' }] },
      'http://127.0.0.1:1234/call',
      EXEC_ID,
    );
    const content = await readFile(join(pkgDir, 'mcp', 's1.py'), 'utf8');
    expect(content).toContain('http://127.0.0.1:1234/call');
  });

  it('embeds the execId in generated module', async () => {
    pkgDir = await generateMcpPackage(
      { s1: [{ name: 'doThing' }] },
      BRIDGE_URL,
      'my-unique-exec-id',
    );
    const content = await readFile(join(pkgDir, 'mcp', 's1.py'), 'utf8');
    expect(content).toContain('my-unique-exec-id');
  });

  it('creates one module per server', async () => {
    pkgDir = await generateMcpPackage(
      {
        github: [{ name: 'listRepos' }],
        slack: [{ name: 'sendMessage' }],
      },
      BRIDGE_URL,
      EXEC_ID,
    );
    const files = await readdir(join(pkgDir, 'mcp'));
    expect(files).toContain('github.py');
    expect(files).toContain('slack.py');
  });

  it('removeMcpPackage deletes the directory', async () => {
    pkgDir = await generateMcpPackage({}, BRIDGE_URL, EXEC_ID);
    const dir = pkgDir;
    pkgDir = '';
    await removeMcpPackage(dir);
    await expect(stat(dir)).rejects.toThrow();
  });

  it('generated module uses stdlib urllib.request with no external imports', async () => {
    pkgDir = await generateMcpPackage({ s1: [{ name: 'fetchData' }] }, BRIDGE_URL, EXEC_ID);
    const content = await readFile(join(pkgDir, 'mcp', 's1.py'), 'utf8');
    expect(content).toContain('import urllib.request');
    expect(content).not.toContain('import requests');
    expect(content).not.toContain('import httpx');
  });
});
