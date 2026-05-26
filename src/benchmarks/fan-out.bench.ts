import { beforeAll, describe, expect, it } from 'vitest';
import { createExecDispatcher } from '../sandbox/index.js';
import { SessionManager } from '../sandbox/session.js';
import { byteSize, EXEC_THRESHOLD, reportSavings } from './utils/measure.js';
import { calendar, gmail, slack } from './utils/mock-clients.js';

describe('multi-service fan-out: email + calendar + slack', () => {
  let exec!: ReturnType<typeof createExecDispatcher>;
  let baselineBytes: number;

  beforeAll(async () => {
    const sessions = new SessionManager();
    exec = createExecDispatcher(sessions, { gmail, calendar, slack });

    const [emails, events, messages] = await Promise.all([
      gmail.callTool({ name: 'listMessages', arguments: {} }),
      calendar.callTool({ name: 'listEvents', arguments: {} }),
      slack.callTool({ name: 'listChannels', arguments: {} }),
    ]);
    baselineBytes = byteSize(emails) + byteSize(events) + byteSize(messages);
  });

  it('aggregated result is under 5% of combined raw outputs', async () => {
    const result = await exec({
      runtime: 'node',
      code: `
        const { listMessages } = await import('mcp/gmail');
        const { listEvents } = await import('mcp/calendar');
        const { listChannels } = await import('mcp/slack');

        const [emails, events, messages] = await Promise.all([
          listMessages({}),
          listEvents({}),
          listChannels({}),
        ]);

        return {
          unread: emails.filter(e => e.labels?.includes('UNREAD')).length,
          nextMeeting: events[0]?.summary ?? 'none',
          recentSlack: messages.slice(0, 3).map(m => m.text?.slice(0, 60)),
        };
      `,
    });

    const resultBytes = byteSize(result.result);
    reportSavings('fan-out', baselineBytes, resultBytes);
    expect(result.exitCode).toBe(0);
    expect(resultBytes / baselineBytes).toBeLessThan(EXEC_THRESHOLD);
  });
});
