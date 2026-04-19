import { describe, it, expect } from 'vitest';
import type { ToolSummary, ToolCallRecord, ExecResult, RuntimeParam } from './types.js';

describe('types', () => {
  it('ToolSummary has required shape', () => {
    const summary: ToolSummary = {
      server: 'gmail',
      name: 'searchEmails',
      description: 'Search emails by query',
      signature: 'searchEmails(query: string): EmailResult[]',
    };
    expect(summary.server).toBe('gmail');
    expect(summary.name).toBe('searchEmails');
  });

  it('ToolCallRecord has required shape', () => {
    const record: ToolCallRecord = {
      server: 'gmail',
      tool: 'searchEmails',
      duration_ms: 123,
    };
    expect(record.duration_ms).toBe(123);
  });

  it('ExecResult has required shape', () => {
    const result: ExecResult = {
      result: 'ok',
      stdout: 'ok',
      stderr: '',
      exitCode: 0,
      tool_calls: [],
    };
    expect(result.result).toBe('ok');
  });

  it('RuntimeParam accepts string shorthand', () => {
    const runtime: RuntimeParam = 'node';
    expect(runtime).toBe('node');
  });

  it('RuntimeParam accepts config object', () => {
    const runtime: RuntimeParam = { type: 'node', timeout: 5000, env: { FOO: 'bar' } };
    expect(runtime.type).toBe('node');
  });
});
