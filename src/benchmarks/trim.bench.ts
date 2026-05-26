import { beforeAll, describe, expect, it } from 'vitest';
import { createExecDispatcher } from '../sandbox/index.js';
import { SessionManager } from '../sandbox/session.js';
import { byteSize, EXEC_THRESHOLD, reportSavings } from './utils/measure.js';
import { database } from './utils/mock-clients.js';

describe('large result trimming: 10k rows → 5 rows', () => {
  let exec!: ReturnType<typeof createExecDispatcher>;
  let baselineBytes: number;

  beforeAll(async () => {
    const sessions = new SessionManager();
    exec = createExecDispatcher(sessions, { database });
    const raw = await database.callTool({ name: 'query', arguments: {} });
    baselineBytes = byteSize(raw);
  });

  it('result is under 5% of raw 10k-row dataset', async () => {
    const result = await exec({
      runtime: 'node',
      code: `
        const { query } = await import('mcp/database');
        const rows = await query({});
        return rows
          .filter(r => r.event_type === 'purchase')
          .slice(0, 5)
          .map(r => ({ id: r.id, user: r.user_id, value: r.properties?.value }));
      `,
    });

    const resultBytes = byteSize(result.result);
    reportSavings('large-trim', baselineBytes, resultBytes);
    expect(result.exitCode).toBe(0);
    expect(resultBytes / baselineBytes).toBeLessThan(EXEC_THRESHOLD);
  });
});
