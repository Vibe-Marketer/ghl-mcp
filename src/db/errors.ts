/**
 * D1 CRUD helpers for the mcp_errors table.
 */

export interface McpError {
  id: string;
  tool_name: string;
  error_text: string;
  args: string | null;
  resolved: number;
  created_at: string;
}

export async function initErrorsDb(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS mcp_errors (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    tool_name TEXT NOT NULL,
    error_text TEXT NOT NULL,
    args TEXT,
    resolved INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_mcp_errors_resolved ON mcp_errors(resolved, created_at DESC);`
    )
    .run();
}

export async function logError(
  db: D1Database,
  toolName: string,
  errorText: string,
  args?: Record<string, unknown>
): Promise<string> {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  // MED-4 fix: truncate args to prevent unbounded storage
  const argsStr = args ? JSON.stringify(args).slice(0, 2048) : null;
  await db
    .prepare(
      `INSERT INTO mcp_errors (id, tool_name, error_text, args) VALUES (?, ?, ?, ?)`
    )
    .bind(id, toolName, errorText, argsStr)
    .run();

  // MED-4 fix: auto-purge errors older than 30 days
  try {
    await db.prepare("DELETE FROM mcp_errors WHERE created_at < datetime('now', '-30 days')").run();
  } catch {
    // Non-fatal — don't block error logging
  }

  return id;
}

export async function listErrors(
  db: D1Database,
  limit = 50
): Promise<McpError[]> {
  const result = await db
    .prepare(
      `SELECT * FROM mcp_errors WHERE resolved = 0 ORDER BY created_at DESC LIMIT ?`
    )
    .bind(limit)
    .all<McpError>();
  return result.results ?? [];
}

export async function clearError(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(`UPDATE mcp_errors SET resolved = 1 WHERE id = ?`)
    .bind(id)
    .run();
}

export async function clearAllErrors(db: D1Database): Promise<void> {
  await db
    .prepare(`UPDATE mcp_errors SET resolved = 1 WHERE resolved = 0`)
    .run();
}
