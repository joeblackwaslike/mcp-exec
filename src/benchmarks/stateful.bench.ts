import { beforeAll, describe, expect, it } from 'vitest';
import { createExecDispatcher } from '../sandbox/index.js';
import { SessionManager } from '../sandbox/session.js';
import { byteSize, EXEC_THRESHOLD, reportSavings } from './utils/measure.js';
import { database } from './utils/mock-clients.js';

const SESSION = 'bench-stateful';

describe('stateful multi-call session', () => {
  let exec!: ReturnType<typeof createExecDispatcher>;
  let baselineBytes: number;

  beforeAll(async () => {
    const sessions = new SessionManager();
    exec = createExecDispatcher(sessions, { database });
    const raw = await database.callTool({ name: 'query', arguments: {} });
    baselineBytes = byteSize(raw);
  });

  it('second call uses cached state — result is under 5% of raw data', async () => {
    // First call: fetch full dataset, aggregate into globalThis, return summary
    await exec({
      runtime: 'node',
      session_id: SESSION,
      code: `
        const { query } = await import('mcp/database');
        const rows = await query({});
        globalThis.eventStats = rows.reduce((acc, r) => {
          acc[r.event_type] = (acc[r.event_type] || 0) + 1;
          return acc;
        }, {});
        return rows.length;
      `,
    });

    // Second call: no tool fetch — reads cached aggregation
    const result = await exec({
      runtime: 'node',
      session_id: SESSION,
      code: `
        return globalThis.eventStats;
      `,
    });

    const resultBytes = byteSize(result.result);
    reportSavings('stateful-session', baselineBytes, resultBytes);
    expect(result.exitCode).toBe(0);
    expect(resultBytes / baselineBytes).toBeLessThan(EXEC_THRESHOLD);
  });
});
