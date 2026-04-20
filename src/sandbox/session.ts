import vm from 'node:vm';

const IMPLICIT_SESSION_ID = '__implicit__';
const MAX_SESSIONS = 100;

// Allowlist of Node.js globals that user code may legitimately use.
// Deliberately excludes process, require, and internal module machinery.
const SAFE_NODE_GLOBALS: Record<string, unknown> = {
  Buffer,
  URL,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
  structuredClone,
  queueMicrotask,
  atob,
  btoa,
  AbortController,
  AbortSignal,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  setImmediate,
  clearImmediate,
};

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

    if (this.sessions.size >= MAX_SESSIONS) {
      throw new Error(`Session limit reached (${MAX_SESSIONS} concurrent sessions)`);
    }

    const context = vm.createContext({
      ...SAFE_NODE_GLOBALS,
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
