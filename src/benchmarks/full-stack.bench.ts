import { beforeAll, describe, expect, it } from 'vitest';
import { createExecDispatcher } from '../sandbox/index.js';
import { SessionManager } from '../sandbox/session.js';
import { byteSize, FULL_STACK_THRESHOLD, reportSavings } from './utils/measure.js';
import { calendar, gmail, salesforce, slack } from './utils/mock-clients.js';

// Realistic schemas that CC would load for each downstream server.
// Each schema represents a tool definition as it would appear in Claude's context.
const DOWNSTREAM_SCHEMAS = [
  {
    server: 'salesforce',
    tools: [
      {
        name: 'search',
        description:
          'Search Salesforce CRM records (leads, contacts, accounts, opportunities) by query string. Supports filtering by object type, date ranges, field values, and owner. Returns full record objects with all field data.',
        inputSchema: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'SOSL search query' },
            object_type: { type: 'string', enum: ['Lead', 'Contact', 'Account', 'Opportunity'] },
            limit: { type: 'number' },
            offset: { type: 'number' },
            sort_field: { type: 'string' },
            sort_order: { type: 'string', enum: ['ASC', 'DESC'] },
            filters: { type: 'object', additionalProperties: true },
          },
          required: ['q'],
        },
      },
      {
        name: 'getRecord',
        description:
          'Retrieve a single Salesforce record by its ID. Returns the full record object including all standard and custom fields.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Salesforce record ID (18-char)' },
            fields: { type: 'array', items: { type: 'string' } },
          },
          required: ['id'],
        },
      },
      {
        name: 'updateRecord',
        description:
          'Update fields on an existing Salesforce record. Accepts a partial record object with only the fields to update.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            object_type: { type: 'string' },
            fields: { type: 'object', additionalProperties: true },
          },
          required: ['id', 'object_type', 'fields'],
        },
      },
    ],
  },
  {
    server: 'gmail',
    tools: [
      {
        name: 'listMessages',
        description:
          'List Gmail messages matching the given filter criteria. Returns full message objects including headers, body, attachments metadata, labels, and thread information.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Gmail search query (e.g. "from:boss@co.com is:unread")',
            },
            maxResults: { type: 'number', default: 50 },
            labelIds: { type: 'array', items: { type: 'string' } },
            includeSpamTrash: { type: 'boolean' },
          },
        },
      },
      {
        name: 'sendMessage',
        description: 'Compose and send a new email message or reply to an existing thread.',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'array', items: { type: 'string' } },
            subject: { type: 'string' },
            body: { type: 'string' },
            threadId: { type: 'string' },
            cc: { type: 'array', items: { type: 'string' } },
          },
          required: ['to', 'subject', 'body'],
        },
      },
    ],
  },
  {
    server: 'calendar',
    tools: [
      {
        name: 'listEvents',
        description:
          'List Google Calendar events in a time range. Returns full event objects with attendee lists, RSVP statuses, recurrence rules, video conference links, and custom properties.',
        inputSchema: {
          type: 'object',
          properties: {
            calendarId: { type: 'string', default: 'primary' },
            timeMin: { type: 'string', format: 'date-time' },
            timeMax: { type: 'string', format: 'date-time' },
            maxResults: { type: 'number', default: 30 },
            orderBy: { type: 'string', enum: ['startTime', 'updated'] },
            singleEvents: { type: 'boolean', default: true },
          },
        },
      },
      {
        name: 'createEvent',
        description:
          'Create a new calendar event, optionally recurring. Sends invites to attendees and creates video conference links on request.',
        inputSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            start: { type: 'object' },
            end: { type: 'object' },
            attendees: { type: 'array' },
            description: { type: 'string' },
            recurrence: { type: 'array' },
            conferenceData: { type: 'object' },
          },
          required: ['summary', 'start', 'end'],
        },
      },
    ],
  },
  {
    server: 'slack',
    tools: [
      {
        name: 'listChannels',
        description:
          'List Slack messages in a channel or DM thread. Returns full message objects including reactions, replies, user info, and file attachments.',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string' },
            limit: { type: 'number', default: 100 },
            oldest: { type: 'string' },
            latest: { type: 'string' },
            inclusive: { type: 'boolean' },
          },
        },
      },
      {
        name: 'postMessage',
        description:
          'Post a message to a Slack channel or DM. Supports blocks layout, attachments, and threading.',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string' },
            text: { type: 'string' },
            blocks: { type: 'array' },
            thread_ts: { type: 'string' },
          },
          required: ['channel', 'text'],
        },
      },
    ],
  },
];

// mcp-exec's own 2-tool schema — the only schema CC sees when mcp-exec is used.
const MCP_EXEC_SCHEMA = [
  {
    name: 'tools',
    description:
      'Search available MCP tools. Pass "*" to list all tools, or a query to filter. Returns trimmed summaries — full schemas are never loaded into context.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query, or "*" for all tools' } },
      required: ['query'],
    },
  },
  {
    name: 'exec',
    description:
      'Execute code in a sandboxed environment. Only the return value (Node) or stdout (Bash/Python) enters the context window — intermediate data stays in the sandbox.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        runtime: {
          oneOf: [
            { type: 'string', enum: ['node', 'bash', 'python'] },
            {
              type: 'object',
              properties: {
                type: { type: 'string' },
                timeout: { type: 'number' },
                env: { type: 'object' },
              },
              required: ['type'],
            },
          ],
        },
        session_id: { type: 'string' },
      },
      required: ['code', 'runtime'],
    },
  },
];

describe('full stack: schema + data reduction', () => {
  let exec!: ReturnType<typeof createExecDispatcher>;
  let totalBaseline: number;
  let mcpExecSchemaBytes: number;

  beforeAll(async () => {
    const sessions = new SessionManager();
    exec = createExecDispatcher(sessions, { gmail, calendar, slack, salesforce });

    const [emails, events, messages, leads] = await Promise.all([
      gmail.callTool({ name: 'listMessages', arguments: {} }),
      calendar.callTool({ name: 'listEvents', arguments: {} }),
      slack.callTool({ name: 'listChannels', arguments: {} }),
      salesforce.callTool({ name: 'search', arguments: {} }),
    ]);

    const schemaBaseline = byteSize(DOWNSTREAM_SCHEMAS);
    const dataBaseline = byteSize(emails) + byteSize(events) + byteSize(messages) + byteSize(leads);
    totalBaseline = schemaBaseline + dataBaseline;
    mcpExecSchemaBytes = byteSize(MCP_EXEC_SCHEMA);
  });

  it('total (schema + result) is under 10% of direct-tool baseline', async () => {
    const result = await exec({
      runtime: 'node',
      code: `
        const { listMessages } = await import('mcp/gmail');
        const { listEvents } = await import('mcp/calendar');
        const { listChannels } = await import('mcp/slack');
        const { search } = await import('mcp/salesforce');

        const [emails, events, messages, leads] = await Promise.all([
          listMessages({}),
          listEvents({}),
          listChannels({}),
          search({ q: 'open deals' }),
        ]);

        return {
          unread: emails.filter(e => e.labels?.includes('UNREAD')).length,
          nextMeeting: events[0]?.summary ?? 'none',
          recentActivity: messages.slice(0, 2).map(m => m.text?.slice(0, 50)),
          hotLeads: leads.filter(l => l.Rating === 'Hot').slice(0, 3).map(l => l.Name),
        };
      `,
    });

    const execResultBytes = byteSize(result.result);
    const totalWithMcpExec = mcpExecSchemaBytes + execResultBytes;
    reportSavings('full-stack', totalBaseline, totalWithMcpExec);
    expect(result.exitCode).toBe(0);
    expect(totalWithMcpExec / totalBaseline).toBeLessThan(FULL_STACK_THRESHOLD);
  });
});
