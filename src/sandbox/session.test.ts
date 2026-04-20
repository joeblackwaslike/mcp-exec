import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionManager } from './session.js';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager({ idleTimeoutMs: 100 });
  });

  it('creates a new implicit session on first call', () => {
    const ctx = manager.getOrCreate();
    expect(ctx).toBeDefined();
  });

  it('returns the same context for the implicit session across calls', () => {
    const ctx1 = manager.getOrCreate();
    const ctx2 = manager.getOrCreate();
    expect(ctx1).toBe(ctx2);
  });

  it('returns different contexts for different explicit session IDs', () => {
    const ctx1 = manager.getOrCreate('session-a');
    const ctx2 = manager.getOrCreate('session-b');
    expect(ctx1).not.toBe(ctx2);
  });

  it('injects mcpClients into session context', () => {
    const mockClients = { gmail: { callTool: vi.fn() } };
    // biome-ignore lint/suspicious/noExplicitAny: test mock bypasses McpClientMap type
    const ctx = manager.getOrCreate(undefined, mockClients as any);
    // biome-ignore lint/suspicious/noExplicitAny: accessing vm.Context sandbox property
    expect((ctx as any).__mcpClients).toBe(mockClients);
  });

  it('expires idle sessions after timeout', async () => {
    const ctx1 = manager.getOrCreate('my-session');
    await new Promise((r) => setTimeout(r, 150));
    const ctx2 = manager.getOrCreate('my-session');
    // After expiry, a new context is created
    expect(ctx1).not.toBe(ctx2);
  });

  it('cleanup removes all sessions', () => {
    manager.getOrCreate('s1');
    manager.getOrCreate('s2');
    manager.cleanup();
    // After cleanup, getOrCreate creates a fresh context
    const fresh = manager.getOrCreate('s1');
    expect(fresh).toBeDefined();
  });
});
