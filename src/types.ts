/**
 * GHL MCP Server v2 — Shared Type Definitions
 */

export interface Env {
  // Legacy / fallback credentials (Private Integration token)
  // These are OPTIONAL — all accounts should be in D1 instead.
  // Only set these if you need a catch-all fallback (not recommended).
  GHL_API_KEY?: string;
  GHL_LOCATION_ID?: string;

  // GHL OAuth App credentials (single app — all scopes, Agency-only install, white-label)
  GHL_CLIENT_ID: string;
  GHL_CLIENT_SECRET: string;

  MCP_OBJECT: DurableObjectNamespace;
  GHL_DB: D1Database;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: any;
  ERROR_WEBHOOK_URL?: string;
  ADMIN_PIN?: string;
  ADMIN_PASSWORD?: string;

  // Internal API (workflow builder) — Firebase auth for backend.leadconnectorhq.com
  GHL_FIREBASE_TOKEN?: string;        // Static ID token (fallback, expires in 1hr)
  GHL_FIREBASE_REFRESH_TOKEN?: string; // Refresh token (never expires, auto-refreshes ID token)
}

export interface User {
  id: string;
  name: string;
  email: string;
  api_key: string;
  status: "pending" | "active" | "disabled";
  scopes: string;           // JSON array string, e.g. '["*"]' or '["ghl_get_contact"]'
  allowed_accounts: string; // JSON array string, e.g. '["*"]' or '["locationId1","locationId2"]'
  created_at: string;
  updated_at: string;
  notes: string | null;
}

export interface SubAccount {
  id: string;
  name: string;
  api_key: string;
  account_type: string;
  is_default: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  refresh_token: string | null;
  expires_at: number | null;
}

export interface GHLClientConfig {
  apiKey: string;
  locationId: string;
}

export type ApiVersion = "2021-04-15" | "2021-07-28";
