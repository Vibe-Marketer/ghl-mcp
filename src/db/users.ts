/**
 * D1 helpers for the `users` table — User registration and access control.
 */

import type { User } from "../types";

// ---------------------------------------------------------------------------
// Schema initialisation
// ---------------------------------------------------------------------------

export async function initUsersDb(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        api_key TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending',
        scopes TEXT NOT NULL DEFAULT '["*"]',
        allowed_accounts TEXT NOT NULL DEFAULT '["*"]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        notes TEXT
      )`
    )
    .run();

  // Add allowed_accounts column if it doesn't exist yet (idempotent migration)
  try {
    await db.prepare(`ALTER TABLE users ADD COLUMN allowed_accounts TEXT NOT NULL DEFAULT '["*"]'`).run();
  } catch {
    // Column already exists — ignore
  }
}

// ---------------------------------------------------------------------------
// Generate a prefixed API key + SHA-256 hash for storage (HIGH-4 fix)
// ---------------------------------------------------------------------------

function generateApiKey(): string {
  return `uk_${crypto.randomUUID()}`;
}

async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

/** Self-registration: user signs up via /signup, starts as 'pending'.
 *  HIGH-4 fix: stores SHA-256 hash of API key, not plaintext. */
export async function createUser(
  db: D1Database,
  name: string,
  email: string
): Promise<{ user: User; rawApiKey: string }> {
  const id = crypto.randomUUID();
  const rawApiKey = generateApiKey();
  const hashedKey = await hashApiKey(rawApiKey);
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO users (id, name, email, api_key, status, scopes, allowed_accounts, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', '["*"]', '["*"]', ?, ?)`
    )
    .bind(id, name, email.toLowerCase(), hashedKey, now, now)
    .run();

  const user: User = {
    id,
    name,
    email: email.toLowerCase(),
    api_key: hashedKey,
    status: "pending",
    scopes: '["*"]',
    allowed_accounts: '["*"]',
    created_at: now,
    updated_at: now,
    notes: null,
  };

  return { user, rawApiKey };
}

/** Admin-created user: immediately active, full control over status/scopes/accounts.
 *  HIGH-4 fix: stores SHA-256 hash of API key, not plaintext. */
export async function createUserByAdmin(
  db: D1Database,
  opts: {
    name: string;
    email: string;
    status?: string;
    scopes?: string;
    allowed_accounts?: string;
    notes?: string;
  }
): Promise<{ user: User; rawApiKey: string }> {
  const id = crypto.randomUUID();
  const rawApiKey = generateApiKey();
  const hashedKey = await hashApiKey(rawApiKey);
  const now = new Date().toISOString();
  const status = opts.status ?? "active";
  const scopes = opts.scopes ?? '["*"]';
  const allowed_accounts = opts.allowed_accounts ?? '["*"]';
  const notes = opts.notes ?? null;

  await db
    .prepare(
      `INSERT INTO users (id, name, email, api_key, status, scopes, allowed_accounts, created_at, updated_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, opts.name, opts.email.toLowerCase(), hashedKey, status, scopes, allowed_accounts, now, now, notes)
    .run();

  const user: User = {
    id,
    name: opts.name,
    email: opts.email.toLowerCase(),
    api_key: hashedKey,
    status: status as User["status"],
    scopes,
    allowed_accounts,
    created_at: now,
    updated_at: now,
    notes,
  };

  return { user, rawApiKey };
}

/** HIGH-4 fix: hash the incoming key and look up by hash.
 *  H-2 fix (2026-03-19): removed plaintext fallback — all keys are now hashed. */
export async function getUserByApiKey(
  db: D1Database,
  apiKey: string
): Promise<User | null> {
  const hashedKey = await hashApiKey(apiKey);
  return db
    .prepare("SELECT * FROM users WHERE api_key = ? LIMIT 1")
    .bind(hashedKey)
    .first<User>();
}

export async function getUserById(
  db: D1Database,
  id: string
): Promise<User | null> {
  return db
    .prepare("SELECT * FROM users WHERE id = ? LIMIT 1")
    .bind(id)
    .first<User>();
}

export async function getUserByEmail(
  db: D1Database,
  email: string
): Promise<User | null> {
  return db
    .prepare("SELECT * FROM users WHERE email = ? LIMIT 1")
    .bind(email.toLowerCase())
    .first<User>();
}

export async function getAllUsers(db: D1Database): Promise<User[]> {
  const result = await db
    .prepare("SELECT * FROM users ORDER BY created_at DESC")
    .all<User>();
  return result.results ?? [];
}

export async function updateUser(
  db: D1Database,
  id: string,
  updates: { status?: string; scopes?: string; allowed_accounts?: string; notes?: string }
): Promise<void> {
  const sets: string[] = ["updated_at = datetime('now')"];
  const binds: (string | null)[] = [];

  if (updates.status !== undefined) {
    sets.push("status = ?");
    binds.push(updates.status);
  }
  if (updates.scopes !== undefined) {
    sets.push("scopes = ?");
    binds.push(updates.scopes);
  }
  if (updates.allowed_accounts !== undefined) {
    sets.push("allowed_accounts = ?");
    binds.push(updates.allowed_accounts);
  }
  if (updates.notes !== undefined) {
    sets.push("notes = ?");
    binds.push(updates.notes);
  }

  binds.push(id);

  await db
    .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...binds)
    .run();
}

export async function deleteUser(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
}
