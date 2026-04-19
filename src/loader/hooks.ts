import type { generateSource } from './sources.js';

// This import is evaluated in the loader context, which runs in a separate
// worker thread. We use a dynamic import to get the source generator.
let _generateSource: typeof generateSource | null = null;

async function getGenerateSource() {
  if (!_generateSource) {
    const mod = await import('./sources.js');
    _generateSource = mod.generateSource;
  }
  return _generateSource;
}

export async function resolve(
  specifier: string,
  context: { parentURL?: string },
  nextResolve: (s: string, c: typeof context) => Promise<{ url: string; shortCircuit?: boolean }>,
): Promise<{ url: string; shortCircuit?: boolean }> {
  if (specifier.startsWith('mcp/')) {
    return { url: `virtual:${specifier}`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(
  url: string,
  context: object,
  nextLoad: (u: string, c: object) => Promise<{ source: string; format: string; shortCircuit?: boolean }>,
): Promise<{ source: string; format: string; shortCircuit?: boolean }> {
  if (url.startsWith('virtual:mcp/')) {
    const serverName = url.replace('virtual:mcp/', '');
    const gen = await getGenerateSource();
    const source = gen(serverName);
    return { shortCircuit: true, format: 'module', source };
  }
  return nextLoad(url, context);
}
