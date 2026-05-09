import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ToolRef } from '../catalog/builder.js';

function toSnakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function toModuleName(serverName: string): string {
  return serverName.replace(/-/g, '_');
}

function generateServerModule(
  serverName: string,
  tools: ToolRef[],
  bridgeUrl: string,
  execId: string,
): string {
  const functionDefs = tools
    .map((t) => {
      const fnName = toSnakeCase(t.name);
      return `def ${fnName}(**kwargs):\n    return _call(${JSON.stringify(t.name)}, **kwargs)`;
    })
    .join('\n\n');

  return `import json
import urllib.request as _req

_BRIDGE = ${JSON.stringify(bridgeUrl)}
_EXEC_ID = ${JSON.stringify(execId)}
_SERVER = ${JSON.stringify(serverName)}


def _call(tool, **kwargs):
    data = json.dumps({"server": _SERVER, "tool": tool, "args": kwargs, "execId": _EXEC_ID}).encode()
    with _req.urlopen(_req.Request(_BRIDGE, data=data, headers={"Content-Type": "application/json"})) as r:
        body = json.loads(r.read())
    if "error" in body:
        raise RuntimeError(body["error"])
    return body["result"]


${functionDefs}
`;
}

export async function generateMcpPackage(
  toolsByServer: Record<string, ToolRef[]>,
  bridgeUrl: string,
  execId: string,
): Promise<string> {
  const pkgDir = join(tmpdir(), `mcp-exec-pkg-${randomUUID()}`);
  const mcpDir = join(pkgDir, 'mcp');
  await mkdir(mcpDir, { recursive: true });
  await writeFile(join(mcpDir, '__init__.py'), '', 'utf8');

  await Promise.all(
    Object.entries(toolsByServer).map(([serverName, tools]) => {
      const moduleName = toModuleName(serverName);
      const content = generateServerModule(serverName, tools, bridgeUrl, execId);
      return writeFile(join(mcpDir, `${moduleName}.py`), content, 'utf8');
    }),
  );

  return pkgDir;
}

export async function removeMcpPackage(pkgDir: string): Promise<void> {
  await rm(pkgDir, { recursive: true, force: true });
}
