/**
 * GHL MCP Server v2 — Shared Type Definitions
 */

export interface Env {
  // Legacy / fallback credentials (Private Integration token)
  GHL_API_KEY: string;
  GHL_LOCATION_ID: string;

  // GHL OAuth App credentials (single app — all scopes, Agency-only install, white-label)
  GHL_CLIENT_ID: string;
  GHL_CLIENT_SECRET: string;

  MCP_OBJECT: DurableObjectNamespace;
  GHL_DB: D1Database;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: any;
  ERROR_WEBHOOK_URL?: string;
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
}

export interface GHLClientConfig {
  apiKey: string;
  locationId: string;
}

export type ApiVersion = "2021-04-15" | "2021-07-28";
