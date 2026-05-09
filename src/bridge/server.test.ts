import { afterEach, describe, expect, it, vi } from 'vitest';
import { BridgeServer } from './server.js';

describe('BridgeServer', () => {
  let server: BridgeServer;

  afterEach(() => {
    server.close();
  });

  it('starts and returns a valid port', async () => {
    server = new BridgeServer({});
    await server.start();
    expect(server.getPort()).toBeGreaterThan(0);
    expect(server.getPort()).toBeLessThanOrEqual(65535);
  });

  it('returns 404 for non-POST /call requests', async () => {
    server = new BridgeServer({});
    await server.start();
    const res = await fetch(`http://127.0.0.1:${server.getPort()}/call`, { method: 'GET' });
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown paths', async () => {
    server = new BridgeServer({});
    await server.start();
    const res = await fetch(`http://127.0.0.1:${server.getPort()}/unknown`, { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it('returns error for invalid JSON body', async () => {
    server = new BridgeServer({});
    await server.start();
    const res = await fetch(`http://127.0.0.1:${server.getPort()}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('returns error JSON for unknown server', async () => {
    server = new BridgeServer({});
    await server.start();
    const res = await fetch(`http://127.0.0.1:${server.getPort()}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server: 'missing', tool: 'foo', args: {}, execId: 'e1' }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toMatch(/not connected/);
  });

  it('proxies a call to the correct MCP client and returns result', async () => {
    const mockClient = { callTool: vi.fn().mockResolvedValue({ content: 'result' }) };
    server = new BridgeServer({ myServer: mockClient });
    await server.start();

    const res = await fetch(`http://127.0.0.1:${server.getPort()}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server: 'myServer', tool: 'myTool', args: { a: 1 }, execId: 'e1' }),
    });
    const data = (await res.json()) as { result: unknown };
    expect(data.result).toEqual({ content: 'result' });
    expect(mockClient.callTool).toHaveBeenCalledWith({ name: 'myTool', arguments: { a: 1 } });
  });

  it('records tool calls per execId and flushes them once', async () => {
    const mockClient = { callTool: vi.fn().mockResolvedValue('ok') };
    server = new BridgeServer({ s1: mockClient });
    await server.start();
    const url = `http://127.0.0.1:${server.getPort()}/call`;

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server: 's1', tool: 'foo', args: {}, execId: 'exec-1' }),
    });
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server: 's1', tool: 'bar', args: {}, execId: 'exec-1' }),
    });

    const calls = server.flushCalls('exec-1');
    expect(calls).toHaveLength(2);
    expect(calls[0].tool).toBe('foo');
    expect(calls[1].tool).toBe('bar');
    expect(calls[0].duration_ms).toBeGreaterThanOrEqual(0);
    expect(server.flushCalls('exec-1')).toEqual([]);
  });

  it('isolates tool calls between different execIds', async () => {
    const mockClient = { callTool: vi.fn().mockResolvedValue('ok') };
    server = new BridgeServer({ s1: mockClient });
    await server.start();
    const url = `http://127.0.0.1:${server.getPort()}/call`;

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server: 's1', tool: 'foo', args: {}, execId: 'exec-A' }),
    });
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server: 's1', tool: 'bar', args: {}, execId: 'exec-B' }),
    });

    expect(server.flushCalls('exec-A')).toHaveLength(1);
    expect(server.flushCalls('exec-B')).toHaveLength(1);
  });

  it('records errors in tool_calls when client throws', async () => {
    const mockClient = { callTool: vi.fn().mockRejectedValue(new Error('tool failed')) };
    server = new BridgeServer({ s1: mockClient });
    await server.start();

    const res = await fetch(`http://127.0.0.1:${server.getPort()}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server: 's1', tool: 'broken', args: {}, execId: 'e1' }),
    });
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('tool failed');

    const calls = server.flushCalls('e1');
    expect(calls[0].error).toBe('tool failed');
  });

  it('flushCalls returns empty array for unknown execId', () => {
    server = new BridgeServer({});
    expect(server.flushCalls('never-existed')).toEqual([]);
  });
});
