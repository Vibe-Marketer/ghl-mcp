import type { Env, SubAccount } from "../types";
import { CONFIG } from "../config";

export async function initDb(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS sub_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_key TEXT NOT NULL,
    account_type TEXT DEFAULT 'sub_account',
    is_default INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`
    )
    .run();
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
      `getSubAccountTokenFromAgency: GHL returned ${response.status} - ${text}`
    );
  }

  const data = (await response.json()) as { access_token?: string; token?: string };
  const token = data.access_token ?? data.token;

  if (!token) {
    throw new Error(
      `getSubAccountTokenFromAgency: No token in GHL response - ${JSON.stringify(data)}`
    );
  }

  return token;
}
