import { beforeAll, describe, expect, it } from 'vitest';
import { createExecDispatcher } from '../sandbox/index.js';
import { SessionManager } from '../sandbox/session.js';
import { byteSize, EXEC_THRESHOLD, reportSavings } from './utils/measure.js';
import { salesforce } from './utils/mock-clients.js';

describe('salesforce: search → filter → summarize', () => {
  let exec!: ReturnType<typeof createExecDispatcher>;
  let baselineBytes: number;

  beforeAll(async () => {
    const sessions = new SessionManager();
    exec = createExecDispatcher(sessions, { salesforce });
    const raw = await salesforce.callTool({ name: 'search', arguments: {} });
    baselineBytes = byteSize(raw);
  });

  it('result is under 5% of raw tool output', async () => {
    const result = await exec({
      runtime: 'node',
      code: `
        const { search } = await import('mcp/salesforce');
        const leads = await search({ q: 'open deals' });
        return leads
          .filter(l => l.Status === 'Open')
          .slice(0, 3)
          .map(l => ({ name: l.Name, amount: l.Amount, status: l.Status }));
      `,
    });

    const resultBytes = byteSize(result.result);
    reportSavings('salesforce-filter', baselineBytes, resultBytes);
    expect(result.exitCode).toBe(0);
    expect(resultBytes / baselineBytes).toBeLessThan(EXEC_THRESHOLD);
  });
});
