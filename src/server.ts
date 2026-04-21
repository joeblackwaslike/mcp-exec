import { register } from 'node:module';
import { SandboxManager } from '@anthropic-ai/sandbox-runtime';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { buildCatalog } from './catalog/builder.js';
import { searchTools, setCatalog } from './catalog/index.js';
import { connectMcpClients, readMcpConfig } from './mcp-clients/index.js';
import { resolveSandboxConfig } from './sandbox/config.js';
import { createExecDispatcher } from './sandbox/index.js';
import { SessionManager } from './sandbox/session.js';
import type { RuntimeParam } from './types.js';

async function main() {
  const skipSandbox = process.env.NODE_ENV === 'test' || process.env.SKIP_SANDBOX === '1';
  const skipLoader = process.env.NODE_ENV === 'test';

  // Initialize srt sandbox (skipped in test/SKIP_SANDBOX environments)
  if (!skipSandbox) {
    const sandboxConfig = resolveSandboxConfig();
    const hasSandboxBlock =
      (sandboxConfig.network?.allowedDomains?.length ?? 0) > 0 ||
      (sandboxConfig.filesystem?.allowWrite?.length ?? 1) > 1;

    if (!hasSandboxBlock) {
      process.stderr.write(
        '[mcp-exec] Warning: no sandbox configuration found in settings.json — running with default permissions\n',
      );
    }

    try {
      // biome-ignore lint/suspicious/noExplicitAny: SandboxRuntimeConfig shape doesn't match srt internal type
      await SandboxManager.initialize(sandboxConfig as any);
    } catch (err) {
      process.stderr.write(`[mcp-exec] Fatal: sandbox initialization failed: ${err}\n`);
      process.exit(1);
    }
  }

  // Connect all downstream MCP clients from mcp.json (excluding mcp-exec itself)
  const allServerNames = Object.keys(readMcpConfig()).filter((n) => n !== 'mcp-exec');
  const { clients, unavailable: connectUnavailable } = await connectMcpClients(allServerNames);

  // Fetch tool lists from connected clients — servers whose listTools fails join unavailable
  const { tools, unavailable, toolsByServer } = await buildCatalog(clients, connectUnavailable);
  setCatalog(tools, unavailable);

  // Register loader hooks with the fully-built catalog — must happen before any exec calls
  if (!skipLoader) {
    try {
      const unavailableServers = Object.fromEntries(unavailable.map((u) => [u.server, u.reason]));
      register('./loader/hooks.js', {
        parentURL: import.meta.url,
        data: { toolsByServer, unavailableServers },
      });
    } catch (err) {
      process.stderr.write(`[mcp-exec] Fatal: failed to register loader hooks: ${err}\n`);
      process.exit(1);
    }
  }

  // Set up session manager and exec dispatcher
  const sessions = new SessionManager();
  // biome-ignore lint/suspicious/noExplicitAny: McpClientMap (Client) vs duck-type callTool bridge
  const exec = createExecDispatcher(sessions, clients as any);

  // Create MCP server
  const server = new Server(
    { name: 'mcp-exec', version: '0.2.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'tools',
        description:
          'Search available MCP tools. Pass "*" to list all tools, or a query to filter. Returns trimmed summaries — full schemas are never loaded into context. Unavailable servers appear with status "unavailable" and a reason.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query, or "*" for all tools' },
          },
          required: ['query'],
        },
      },
      {
        name: 'exec',
        description:
          'Execute code in a sandboxed environment. Only the return value (Node) or stdout (Bash) enters the context window — intermediate data stays in the sandbox.',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'Code to execute' },
            runtime: {
              oneOf: [
                { type: 'string', enum: ['node', 'bash'], description: 'Runtime shorthand' },
                {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['node', 'bash'] },
                    timeout: { type: 'number', description: 'Timeout in milliseconds' },
                    env: { type: 'object', additionalProperties: { type: 'string' } },
                  },
                  required: ['type'],
                },
              ],
            },
            session_id: { type: 'string', description: 'Optional explicit session ID' },
          },
          required: ['code', 'runtime'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'tools') {
      const query = (args as { query: string }).query;
      const results = searchTools(query);
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
      };
    }

    if (name === 'exec') {
      const { code, runtime, session_id } = args as {
        code: string;
        runtime: RuntimeParam;
        session_id?: string;
      };
      const result = await exec({ code, runtime, session_id });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              result: result.result,
              tool_calls: result.tool_calls,
            }),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on('SIGINT', () => {
    sessions.cleanup();
    process.exit(0);
  });
}

main().catch((err) => {
  process.stderr.write(`[mcp-exec] Fatal: ${err}\n`);
  process.exit(1);
});
