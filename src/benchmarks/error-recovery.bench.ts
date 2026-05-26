import { beforeAll, describe, expect, it } from 'vitest';
import { createExecDispatcher } from '../sandbox/index.js';
import { SessionManager } from '../sandbox/session.js';
import { byteSize, EXEC_THRESHOLD, reportSavings } from './utils/measure.js';
import { flakyDatabase } from './utils/mock-clients.js';

describe('error recovery and retry', () => {
  let exec!: ReturnType<typeof createExecDispatcher>;
  let baselineBytes: number;

  beforeAll(async () => {
    const sessions = new SessionManager();
    const db = flakyDatabase(0);
    exec = createExecDispatcher(sessions, { database: db });

    // Baseline: what the raw dataset looks like when the tool succeeds
    const rawDb = flakyDatabase(-1); // never fails
    const raw = await rawDb.callTool({ name: 'query', arguments: {} });
    baselineBytes = byteSize(raw);
  });

  it('inline error handling keeps result under 5% of raw dataset', async () => {
    const result = await exec({
      runtime: 'node',
      code: `
        const { query } = await import('mcp/database');
        let rows;
        try {
          rows = await query({ bad_param: true });
        } catch (_err) {
          rows = await query({});
        }
        return rows
          .filter(r => r.event_type === 'purchase')
          .slice(0, 5)
          .map(r => ({ id: r.id, user: r.user_id, value: r.properties?.value }));
      `,
    });

    const resultBytes = byteSize(result.result);
    reportSavings('error-recovery', baselineBytes, resultBytes);
    expect(result.exitCode).toBe(0);
    expect(resultBytes / baselineBytes).toBeLessThan(EXEC_THRESHOLD);
  });
});
