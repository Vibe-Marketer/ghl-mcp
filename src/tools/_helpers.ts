import type { Env } from "../types";
import { GHLClient } from "../client";
import { initDb, getDefaultAccount, getAccountById, isTokenExpired, refreshLocationToken } from "../db/accounts";

// MCP response formatters
export function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function err(e: any) {
  const detail = e.details ? `\nDetails: ${e.details}` : "";
  return {
    content: [{ type: "text" as const, text: `Error: ${e.message || e}${detail}` }],
    isError: true,
  };
}

/**
 * Check whether a given locationId is permitted for the current user.
 * env.__allowedAccounts is injected by GHLMcpAgent.fetch() from the user's
 * allowed_accounts D1 field. null means no restriction (backwards-compat).
 */
function isAccountAllowed(env: Env, locationId: string): boolean {
  const allowed: string[] | null = (env as any).__allowedAccounts ?? null;
  if (allowed === null) return true;
  if (allowed.includes("*")) return true;
  return allowed.includes(locationId);
}

/**
 * Resolve a GHLClient from environment + optional locationId.
 *
 * Resolution order:
 *   1. locationId provided and found in D1 → use its stored API key
 *   2. locationId provided but not in D1   → use env.GHL_API_KEY with that location
 *   3. No locationId                        → use D1 default account
 *   4. No default in D1                    → fall back to env.GHL_API_KEY + env.GHL_LOCATION_ID
 *
 * In all cases, if the resolved account is not in the user's allowed_accounts list,
 * an error is thrown.
 */
export async function resolveClient(
  env: Env,
  locationId?: string
): Promise<GHLClient> {
  await initDb(env.GHL_DB);

  if (locationId) {
    if (!isAccountAllowed(env, locationId)) {
      throw new Error(`Access denied: you do not have permission to access account ${locationId}. Contact the admin to update your account access.`);
    }
    const account = await getAccountById(env.GHL_DB, locationId);
    if (account) {
      const apiKey = isTokenExpired(account)
        ? await refreshLocationToken(env, locationId).catch(() => account.api_key)
        : account.api_key;
      return new GHLClient({ apiKey, locationId: account.id });
    }
    // locationId not in D1 — require env fallback
    if (!env.GHL_API_KEY) {
      throw new Error(`Account "${locationId}" is not registered. Add it via ghl_add_sub_account or the admin panel.`);
    }
    return new GHLClient({ apiKey: env.GHL_API_KEY, locationId });
  }

  const defaultAccount = await getDefaultAccount(env.GHL_DB);
  if (defaultAccount) {
    if (!isAccountAllowed(env, defaultAccount.id)) {
      throw new Error(`Access denied: you do not have permission to access the default account (${defaultAccount.id}). Contact the admin to update your account access.`);
    }
    const apiKey = isTokenExpired(defaultAccount)
      ? await refreshLocationToken(env, defaultAccount.id).catch(() => defaultAccount.api_key)
      : defaultAccount.api_key;
    return new GHLClient({ apiKey, locationId: defaultAccount.id });
  }

  // No default account in D1 and no env fallback
  if (!env.GHL_API_KEY || !env.GHL_LOCATION_ID) {
    throw new Error("No default account configured. Add one via ghl_add_sub_account with isDefault=true, or set GHL_API_KEY + GHL_LOCATION_ID secrets.");
  }

  if (!isAccountAllowed(env, env.GHL_LOCATION_ID)) {
    throw new Error(`Access denied: you do not have permission to access any configured account. Contact the admin.`);
  }

  return new GHLClient({
    apiKey: env.GHL_API_KEY,
    locationId: env.GHL_LOCATION_ID,
  });
}
