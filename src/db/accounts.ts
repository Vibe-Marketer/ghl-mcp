import type { Env, SubAccount } from "../types";
import { CONFIG } from "../config";

// ---------------------------------------------------------------------------
// oauth_tokens table helpers
// ---------------------------------------------------------------------------

export interface OAuthTokenRow {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  company_id: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoreAgencyTokenParams {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  company_id: string;
  user_id?: string;
}

export async function initOAuthTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS oauth_tokens (
        id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        company_id TEXT NOT NULL,
        user_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`
    )
    .run();
}

export async function storeAgencyToken(
  db: D1Database,
  params: StoreAgencyTokenParams
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO oauth_tokens (id, access_token, refresh_token, expires_at, company_id, user_id, updated_at)
       VALUES ('agency', ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at,
         company_id = excluded.company_id,
         user_id = excluded.user_id,
         updated_at = datetime('now')`
    )
    .bind(
      params.access_token,
      params.refresh_token,
      params.expires_at,
      params.company_id,
      params.user_id ?? null
    )
    .run();
}

export async function getAgencyToken(
  db: D1Database
): Promise<OAuthTokenRow | null> {
  return db
    .prepare("SELECT * FROM oauth_tokens WHERE id = 'agency' LIMIT 1")
    .first<OAuthTokenRow>();
}

export async function refreshAgencyToken(env: Env): Promise<OAuthTokenRow> {
  const existing = await getAgencyToken(env.GHL_DB);
  if (!existing) {
    throw new Error("refreshAgencyToken: No agency token in D1. Complete the OAuth install flow first.");
  }

  const body = new URLSearchParams({
    client_id: env.GHL_CLIENT_ID,
    client_secret: env.GHL_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: existing.refresh_token,
    user_type: "Company",
  });

  const res = await fetch(`${CONFIG.API.BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`refreshAgencyToken: GHL returned ${res.status} — ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
    companyId?: string;
    userId?: string;
  };

  if (!data.access_token || !data.refresh_token) {
    throw new Error(`refreshAgencyToken: Incomplete response — ${JSON.stringify(data)}`);
  }

  const params: StoreAgencyTokenParams = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in ?? 86400),
    company_id: data.companyId ?? existing.company_id,
    user_id: data.userId ?? existing.user_id ?? undefined,
  };

  await storeAgencyToken(env.GHL_DB, params);

  const updated = await getAgencyToken(env.GHL_DB);
  if (!updated) throw new Error("refreshAgencyToken: Failed to retrieve updated row");
  return updated;
}

export async function refreshAllLocationTokens(env: Env): Promise<number> {
  const agencyRow = await refreshAgencyToken(env);
  const { access_token, company_id } = agencyRow;

  const result = await env.GHL_DB
    .prepare("SELECT id, name FROM sub_accounts")
    .all<{ id: string; name: string }>();

  const locations = result.results ?? [];
  let refreshed = 0;

  for (const loc of locations) {
    try {
      const body = new URLSearchParams({ companyId: company_id, locationId: loc.id });
      const res = await fetch(CONFIG.API.LOCATION_TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          Authorization: `Bearer ${access_token}`,
          Version: CONFIG.API.VERSION_STANDARD,
        },
        body: body.toString(),
      });

      if (!res.ok) continue;

      const data = (await res.json()) as { access_token?: string };
      if (!data.access_token) continue;

      await upsertSubAccountFromOAuth(env.GHL_DB, loc.id, loc.name, data.access_token, company_id);
      refreshed++;
    } catch {
      // Skip and continue
    }
  }

  return refreshed;
}

export async function upsertSubAccountFromOAuth(
  db: D1Database,
  locationId: string,
  name: string,
  locationToken: string,
  companyId: string,
  refreshToken?: string,
  expiresAt?: number
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sub_accounts (id, name, api_key, account_type, is_default, notes, refresh_token, expires_at, updated_at)
       VALUES (?, ?, ?, 'oauth_location', 0, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         api_key = excluded.api_key,
         account_type = excluded.account_type,
         notes = excluded.notes,
         refresh_token = COALESCE(excluded.refresh_token, sub_accounts.refresh_token),
         expires_at = COALESCE(excluded.expires_at, sub_accounts.expires_at),
         updated_at = datetime('now')`
    )
    .bind(
      locationId,
      name,
      locationToken,
      `company:${companyId}`,
      refreshToken ?? null,
      expiresAt ?? null
    )
    .run();
}

export async function initDb(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS sub_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_key TEXT NOT NULL,
    account_type TEXT DEFAULT 'sub_account',
    is_default INTEGER DEFAULT 0,
    notes TEXT,
    refresh_token TEXT,
    expires_at INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`
    )
    .run();

  // Migrate existing tables that predate the refresh_token / expires_at columns.
  // SQLite throws "duplicate column name" if the column already exists — swallow that error.
  for (const col of [
    "ALTER TABLE sub_accounts ADD COLUMN refresh_token TEXT",
    "ALTER TABLE sub_accounts ADD COLUMN expires_at INTEGER",
  ]) {
    try {
      await db.prepare(col).run();
    } catch {
      // Column already exists — safe to ignore.
    }
  }
}

export async function getDefaultAccount(db: D1Database): Promise<SubAccount | null> {
  return db
    .prepare("SELECT * FROM sub_accounts WHERE is_default = 1 LIMIT 1")
    .first<SubAccount>();
}

export async function getAccountById(db: D1Database, locationId: string): Promise<SubAccount | null> {
  return db
    .prepare("SELECT * FROM sub_accounts WHERE id = ?")
    .bind(locationId)
    .first<SubAccount>();
}

export async function getAccountByName(db: D1Database, name: string): Promise<SubAccount | null> {
  return db
    .prepare("SELECT * FROM sub_accounts WHERE LOWER(name) LIKE LOWER(?)")
    .bind(`%${name}%`)
    .first<SubAccount>();
}

/**
 * Returns true when the stored token is expired or within 5 minutes of expiry.
 * Static Private Integration tokens have no expires_at and never expire.
 */
export function isTokenExpired(account: SubAccount): boolean {
  if (!account.expires_at) return false;
  return Math.floor(Date.now() / 1000) > account.expires_at - 300;
}

/**
 * Refresh the location-scoped OAuth access token for a given locationId using its
 * stored refresh_token. Updates D1 with the new access_token, refresh_token, and
 * expires_at, then returns the new access_token.
 */
export async function refreshLocationToken(env: Env, locationId: string): Promise<string> {
  const account = await getAccountById(env.GHL_DB, locationId);
  if (!account) {
    throw new Error(`refreshLocationToken: No sub_account found for locationId ${locationId}`);
  }
  if (!account.refresh_token) {
    throw new Error(`refreshLocationToken: No refresh token available for ${locationId}`);
  }

  const body = new URLSearchParams({
    client_id: env.GHL_CLIENT_ID,
    client_secret: env.GHL_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: account.refresh_token,
    user_type: "Location",
  });

  const res = await fetch(`${CONFIG.API.BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`refreshLocationToken: GHL returned ${res.status} — ${text}`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!data.access_token || !data.refresh_token) {
    throw new Error(`refreshLocationToken: Incomplete response — ${JSON.stringify(data)}`);
  }

  const newExpiresAt = Math.floor(Date.now() / 1000) + (data.expires_in ?? 86400);

  // Derive companyId from the stored notes field ("company:<id>") or fall back to empty string.
  const companyId = account.notes?.startsWith("company:") ? account.notes.slice(8) : "";

  await upsertSubAccountFromOAuth(
    env.GHL_DB,
    locationId,
    account.name,
    data.access_token,
    companyId,
    data.refresh_token,
    newExpiresAt
  );

  return data.access_token;
}

/**
 * Exchange an agency-level access token for a location-scoped access token.
 *
 * GHL endpoint: POST /oauth/locationToken
 *
 * Reference: https://highlevel.stoplight.io/docs/integrations/0f4b1cb7b7540-get-location-access-token
 *
 * @param locationId  GHL Location ID to derive a token for
 * @param agencyToken  Agency-level Bearer token (obtained via OAuth flow)
 * @param companyId   GHL Company/Agency ID (from token response companyId field)
 * @returns location-scoped access_token string
 * @throws Error if the GHL API returns a non-200 response
 */
export async function getSubAccountTokenFromAgency(
  locationId: string,
  agencyToken: string,
  companyId: string
): Promise<string> {
  const body = new URLSearchParams({ companyId, locationId });
  const response = await fetch(CONFIG.API.LOCATION_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "Authorization": `Bearer ${agencyToken}`,
      "Version": CONFIG.API.VERSION_STANDARD,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    throw new Error(
      `getSubAccountTokenFromAgency: GHL returned ${response.status} — ${text}`
    );
  }

  const data = (await response.json()) as { access_token?: string; token?: string };
  const token = data.access_token ?? data.token;

  if (!token) {
    throw new Error(
      `getSubAccountTokenFromAgency: No token in GHL response — ${JSON.stringify(data)}`
    );
  }

  return token;
}
