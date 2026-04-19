import vm from 'vm';

const IMPLICIT_SESSION_ID = '__implicit__';

interface SessionEntry {
  context: vm.Context;
  lastUsedAt: number;
  expiryTimer: NodeJS.Timeout;
}

interface SessionManagerOptions {
  idleTimeoutMs?: number;
}

export class SessionManager {
  private readonly sessions = new Map<string, SessionEntry>();
  private readonly idleTimeoutMs: number;

  constructor(options: SessionManagerOptions = {}) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? 10 * 60 * 1000;
  }

  getOrCreate(sessionId?: string, mcpClients?: Record<string, unknown>): vm.Context {
    const id = sessionId ?? IMPLICIT_SESSION_ID;
    const existing = this.sessions.get(id);

    if (existing) {
      clearTimeout(existing.expiryTimer);
      existing.lastUsedAt = Date.now();
      existing.expiryTimer = this.createExpiryTimer(id);
      return existing.context;
    }

    const context = vm.createContext({
      ...globalThis,
      __mcpClients: mcpClients ?? {},
      __session_id: id,
    });

    const entry: SessionEntry = {
      context,
      lastUsedAt: Date.now(),
      expiryTimer: this.createExpiryTimer(id),
    };

    this.sessions.set(id, entry);
    return context;
  }

  cleanup(): void {
    for (const [, entry] of this.sessions) {
      clearTimeout(entry.expiryTimer);
    }
    this.sessions.clear();
  }

  private createExpiryTimer(id: string): NodeJS.Timeout {
    return setTimeout(() => this.sessions.delete(id), this.idleTimeoutMs).unref();
  }
}
