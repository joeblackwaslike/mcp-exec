import module from 'node:module';

const toolsByServer: Record<string, Array<{ name: string }>> = {
  salesforce: [{ name: 'search' }, { name: 'getRecord' }],
  gmail: [{ name: 'listMessages' }],
  calendar: [{ name: 'listEvents' }],
  slack: [{ name: 'listChannels' }],
  database: [{ name: 'query' }],
};

function toId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_$]/g, '_').replace(/^(\d)/, '_$1');
}

function shimSource(serverName: string, tools: Array<{ name: string }>): string {
  return tools
    .map(
      (t) =>
        `export async function ${toId(t.name)}(params) {\n  return globalThis.__mcpClients['${serverName}'].callTool('${t.name}', params);\n}`,
    )
    .join('\n\n');
}

// biome-ignore lint/suspicious/noExplicitAny: registerHooks not in @types/node v20
(module as any).registerHooks({
  resolve(
    specifier: string,
    context: unknown,
    nextResolve: (s: string, c: unknown) => unknown,
  ): unknown {
    if (specifier.startsWith('mcp/')) {
      return { url: `virtual:${specifier}`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url: string, context: unknown, nextLoad: (u: string, c: unknown) => unknown): unknown {
    if (url.startsWith('virtual:mcp/')) {
      const serverName = url.replace('virtual:mcp/', '');
      const tools = toolsByServer[serverName];
      if (!tools)
        throw new Error(
          `[benchmarks] No tools for '${serverName}' — add it to toolsByServer in setup.ts`,
        );
      return { shortCircuit: true, format: 'module', source: shimSource(serverName, tools) };
    }
    return nextLoad(url, context);
  },
});
