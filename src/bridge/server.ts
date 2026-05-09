import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ToolCallRecord } from '../types.js';

interface SdkClient {
  callTool(req: { name: string; arguments?: Record<string, unknown> }): Promise<unknown>;
}

interface CallRequest {
  server: string;
  tool: string;
  args: Record<string, unknown>;
  execId: string;
}

/** HTTP bridge that proxies Python mcp.* import calls to the real MCP SDK clients. */
export class BridgeServer {
  private readonly httpServer = createServer((req, res) => void this.handle(req, res));
  private port = 0;
  private readonly log = new Map<string, ToolCallRecord[]>();

  constructor(private readonly clients: Record<string, SdkClient>) {}

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(0, '127.0.0.1', () => {
        this.port = (this.httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  }

  getPort(): number {
    return this.port;
  }

  /** Returns and clears all tool_calls recorded under a given exec invocation. */
  flushCalls(execId: string): ToolCallRecord[] {
    const calls = this.log.get(execId) ?? [];
    this.log.delete(execId);
    return calls;
  }

  close(): void {
    this.httpServer.close();
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST' || req.url !== '/call') {
      res.writeHead(404);
      res.end();
      return;
    }

    let body: CallRequest;
    try {
      body = JSON.parse(await readBody(req)) as CallRequest;
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }

    const { server, tool, args, execId } = body;
    const client = this.clients[server];

    if (!client) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Server '${server}' not connected` }));
      return;
    }

    const start = Date.now();
    try {
      const result = await client.callTool({ name: tool, arguments: args });
      this.record(execId, { server, tool, duration_ms: Date.now() - start });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ result }));
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.record(execId, { server, tool, duration_ms: Date.now() - start, error });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error }));
    }
  }

  private record(execId: string, entry: ToolCallRecord): void {
    const list = this.log.get(execId);
    if (list) {
      list.push(entry);
    } else {
      this.log.set(execId, [entry]);
    }
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
