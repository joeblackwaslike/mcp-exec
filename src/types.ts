/** Trimmed tool summary returned by tools(query) — never includes full JSON schema */
export type ToolSummary = {
  server: string;
  name: string;
  description: string;
  /** One-line human-readable signature, e.g. "searchEmails(query: string): EmailResult[]" */
  signature: string;
};

/** Record of a downstream tool call made inside exec() */
export type ToolCallRecord = {
  server: string;
  tool: string;
  duration_ms: number;
  error?: string;
};

/** Internal result type — superset of what MCP exposes */
export type ExecResult = {
  /** Primary output sent to Claude: IIFE return value (Node) or stdout (Bash) */
  result: unknown;
  /** Raw stdout — used internally for cross-runtime data threading */
  stdout: string;
  stderr: string;
  exitCode: number;
  tool_calls: ToolCallRecord[];
};

/** Runtime shorthand or config object accepted by exec() */
export type RuntimeParam =
  | 'node'
  | 'bash'
  | { type: 'node' | 'bash'; timeout?: number; env?: Record<string, string> };
