import { register } from 'module';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SandboxManager } from '@anthropic-ai/sandbox-runtime';
import { resolveSandboxConfig } from './sandbox/config.js';
import { SessionManager } from './sandbox/session.js';
import { createExecDispatcher } from './sandbox/index.js';
import { searchTools } from './catalog/index.js';
import { connectMcpClients } from './mcp-clients/index.js';
import type { RuntimeParam } from './types.js';

// Register mcp/* loader hooks before any dynamic imports run (best-effort)
try {
  register('./loader/hooks.js', import.meta.url);
} catch (err) {
  console.warn('[mcp-exec] Could not register loader hooks (non-fatal):', (err as Error).message);
}

const V0_1_SERVERS = ['gmail', 'gdrive'];

async function main() {
  // Initialize srt sandbox (skipped in test environments)
  if (process.env.NODE_ENV !== 'test') {
    const sandboxConfig = resolveSandboxConfig();
    const hasSandboxBlock =
      (sandboxConfig.network?.allowedDomains?.length ?? 0) > 0 ||
      (sandboxConfig.filesystem?.allowWrite?.length ?? 1) > 1;

    if (!hasSandboxBlock) {
      console.warn(
        '[mcp-exec] No sandbox block found in ~/.claude/settings.json or .claude/settings.json.\n' +
          'Network access will be blocked by default (srt policy). To configure sandbox\n' +
          'permissions, see: https://docs.anthropic.com/claude-code/sandbox',
      );
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await SandboxManager.initialize(sandboxConfig as any);
    } catch (err) {
      console.warn(
        '[mcp-exec] SandboxManager.initialize() failed (running outside srt sandbox process — non-fatal):',
        (err as Error).message,
      );
    }
  }

  // Connect downstream MCP clients
  const mcpClients = await connectMcpClients(V0_1_SERVERS);

  // Set up session manager and exec dispatcher
  const sessions = new SessionManager();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exec = createExecDispatcher(sessions, mcpClients as any);

  // Create MCP server
  const server = new Server(
    { name: 'mcp-exec', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'tools',
        description:
          'Search available MCP tools. Pass "*" to list all tools, or a query to filter. Returns trimmed summaries — full schemas are never loaded into context.',
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
  console.error('[mcp-exec] Fatal error:', err);
  process.exit(1);
});
