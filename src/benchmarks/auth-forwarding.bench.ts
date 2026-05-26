import { beforeAll, describe, expect, it } from 'vitest';
import { createExecDispatcher } from '../sandbox/index.js';
import { SessionManager } from '../sandbox/session.js';
import { byteSize, EXEC_THRESHOLD, reportSavings } from './utils/measure.js';
import { authenticatedSalesforce } from './utils/mock-clients.js';

const TOKEN = 'test-api-token-abc123';

describe('auth credential forwarding', () => {
  let exec!: ReturnType<typeof createExecDispatcher>;
  let baselineBytes: number;

  beforeAll(async () => {
    const sessions = new SessionManager();
    const authClient = authenticatedSalesforce(TOKEN);
    exec = createExecDispatcher(sessions, { salesforce: authClient });
    const raw = await authClient.callTool({ name: 'search', arguments: { auth_token: TOKEN } });
    baselineBytes = byteSize(raw);
  });

  it('credential passes through exec — result is under 5% of raw output', async () => {
    // The agent inlines the credential in the code string (it has the token in its context)
    const result = await exec({
      runtime: 'node',
      code: `
        const { search } = await import('mcp/salesforce');
        const leads = await search({ auth_token: '${TOKEN}', q: 'enterprise deals' });
        return leads
          .filter(l => l.Rating === 'Hot')
          .slice(0, 3)
          .map(l => ({ name: l.Name, amount: l.Amount, company: l.Company }));
      `,
    });

    const resultBytes = byteSize(result.result);
    reportSavings('auth-forwarding', baselineBytes, resultBytes);
    expect(result.exitCode).toBe(0);
    expect(resultBytes / baselineBytes).toBeLessThan(EXEC_THRESHOLD);
  });

  it('invalid token surfaces as exec error, not full dataset', async () => {
    const result = await exec({
      runtime: 'node',
      code: `
        const { search } = await import('mcp/salesforce');
        return await search({ auth_token: 'wrong-token', q: 'test' });
      `,
    });

    // Error result is tiny — doesn't dump the full dataset
    const resultBytes = byteSize(result.result);
    expect(resultBytes).toBeLessThan(500);
  });
});
